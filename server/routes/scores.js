const express = require('express');
const multer = require('multer');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, isStaffUser, requireStaff, requireAdmin } = require('../middleware/auth');
const { addEvent } = require('../services/timeline');
const { logAction } = require('../services/audit');
const {
  MAX_FILE_BYTES,
  fetchGoogleDrivePdfBuffer,
  parseAnswerKeyFromFile,
} = require('../services/omrPdfParser');

const answerKeyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const name = String(file.originalname || '').toLowerCase();
    const ok =
      mime === 'application/pdf' ||
      mime.startsWith('image/') ||
      /\.(pdf|png|jpe?g|webp)$/i.test(name);
    if (ok) cb(null, true);
    else cb(new Error('PDF 또는 이미지 파일(PNG, JPG, WebP)만 업로드할 수 있습니다.'), false);
  },
});

const router = express.Router();

// === 관리자·조교 공용 ===

// 시험 등록 (만점 포함)
router.post('/exams', authenticateToken, requireStaff, async (req, res) => {
  const { examType, name, examDate, examEndDate, school, grade, maxScore } = req.body;
  if (!name) {
    return res.status(400).json({ error: '시험명을 입력해주세요.' });
  }
  const id = await runInsert(
    'INSERT INTO exams (exam_type, name, exam_date, exam_end_date, school, grade, max_score, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [examType || '기타', name, examDate || null, examEndDate || null, school || null, grade || null, maxScore || 100, req.academyId]
  );
  res.json({ message: '시험이 등록되었습니다.', id });
});

// 시험 목록
router.get('/exams', authenticateToken, async (req, res) => {
  const exams = await getAll('SELECT * FROM exams WHERE academy_id = ? ORDER BY exam_date DESC, id DESC', [req.academyId]);
  res.json(exams);
});

// 시험 수정
router.put('/exams/:id', authenticateToken, requireStaff, async (req, res) => {
  const { examType, name, examDate, examEndDate, school, grade, maxScore } = req.body;
  if (!name) {
    return res.status(400).json({ error: '시험명을 입력해주세요.' });
  }
  await runQuery(
    'UPDATE exams SET exam_type = ?, name = ?, exam_date = ?, exam_end_date = ?, school = ?, grade = ?, max_score = ? WHERE id = ? AND academy_id = ?',
    [examType || '기타', name, examDate || null, examEndDate || null, school || null, grade || null, maxScore || 100, parseInt(req.params.id), req.academyId]
  );
  res.json({ message: '시험이 수정되었습니다.' });
});

// 시험 삭제 (관리자 전용 유지)
router.delete('/exams/:id', authenticateToken, requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM scores WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  await runQuery('DELETE FROM exams WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '시험이 삭제되었습니다.' });
});

// 성적 입력 (단일)
router.post('/score', authenticateToken, requireStaff, async (req, res) => {
  const { studentId, examId, score, note } = req.body;

  const existing = await getOne(
    'SELECT id FROM scores WHERE student_id = ? AND exam_id = ? AND academy_id = ?',
    [studentId, examId, req.academyId]
  );

  if (existing) {
    await runQuery(
      'UPDATE scores SET score = ?, note = ? WHERE id = ? AND academy_id = ?',
      [score, note || '', existing.id, req.academyId]
    );
  } else {
    await runQuery(
      'INSERT INTO scores (student_id, exam_id, score, note, academy_id) VALUES (?, ?, ?, ?, ?)',
      [studentId, examId, score, note || '', req.academyId]
    );
  }

  // 등수 자동 계산
  await calculateRanks(examId, req.academyId);

  // 타임라인 이벤트
  const exam = await getOne('SELECT name FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  addEvent(req.academyId, studentId, 'exam_score', `${exam?.name || '시험'}: ${score}점`,
    note || null, { exam_id: examId, score }, req.user?.id
  ).catch(e => console.error('[timeline]', e.message));

  res.json({ message: '성적이 저장되었습니다.' });
});

// 성적 일괄 입력 + 등수 자동 계산
router.post('/batch', authenticateToken, requireStaff, async (req, res) => {
  const { examId, scores } = req.body;
  if (!examId || !scores || !Array.isArray(scores)) {
    return res.status(400).json({ error: '유효하지 않은 데이터입니다.' });
  }

  // 시험 소유 검증 (타 학원 examId 차단) — 타임라인용 이름도 함께 확보
  const exam = await getOne('SELECT id, name FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  // UNIQUE(student_id, exam_id) 기반 upsert — 학생당 SELECT+INSERT/UPDATE 2회 왕복을 1회로
  for (const s of scores) {
    await runQuery(
      `INSERT INTO scores (student_id, exam_id, score, note, status, academy_id) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (student_id, exam_id) DO UPDATE SET score = EXCLUDED.score, note = EXCLUDED.note, status = EXCLUDED.status`,
      [s.studentId, examId, s.score, s.note || '', s.status || 'normal', req.academyId]
    );
  }

  // 등수 자동 계산
  await calculateRanks(examId, req.academyId);

  // 타임라인 이벤트 (일괄)
  for (const s of scores) {
    if (s.score != null) {
      addEvent(req.academyId, s.studentId, 'exam_score', `${exam?.name || '시험'}: ${s.score}점`,
        s.note || null, { exam_id: examId, score: s.score }, req.user?.id
      ).catch(e => console.error('[timeline]', e.message));
    }
  }

  res.json({ message: `${scores.length}명의 성적이 저장되었습니다.` });
});

// 등수 자동 계산 함수 (해당 시험만, 다른 시험 등수에 영향 없음)
async function calculateRanks(examId, academyId) {
  // 결석/미응시는 등수 계산에서 제외 (status가 normal이거나 NULL인 것만)
  const allScores = await getAll(
    "SELECT id, score, status FROM scores WHERE exam_id = ? AND academy_id = ? ORDER BY score DESC",
    [examId, academyId]
  );

  if (allScores.length === 0) return;

  const normalScores = allScores.filter(s => !s.status || s.status === 'normal');
  const excludedScores = allScores.filter(s => s.status && s.status !== 'normal');

  // 정상 응시자만 등수 계산
  let rank = 1;
  for (let i = 0; i < normalScores.length; i++) {
    if (i > 0 && normalScores[i].score < normalScores[i - 1].score) {
      rank = i + 1;
    }
    await runQuery('UPDATE scores SET rank_num = ? WHERE id = ? AND academy_id = ?', [rank, normalScores[i].id, academyId]);
  }

  // 결석/미응시/재시험은 등수 NULL
  for (const s of excludedScores) {
    await runQuery('UPDATE scores SET rank_num = NULL WHERE id = ? AND academy_id = ?', [s.id, academyId]);
  }
}

// 수동 등수 재계산 엔드포인트
router.post('/exams/:examId/recalculate-ranks', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  await calculateRanks(examId, req.academyId);

  const scores = await getAll(
    `SELECT sc.*, u.name as student_name
     FROM scores sc
     JOIN students st ON sc.student_id = st.id
     JOIN users u ON st.user_id = u.id
     WHERE sc.exam_id = ? AND sc.academy_id = ?
     ORDER BY sc.score DESC`,
    [examId, req.academyId]
  );

  res.json({ message: '등수가 재계산되었습니다.', scores });
});

// 시험별 성적 조회 (관리자·조교)
router.get('/exams/:examId/scores', authenticateToken, requireStaff, async (req, res) => {
  const scores = await getAll(
    `SELECT sc.*, u.name as student_name, st.school, st.grade
     FROM scores sc
     JOIN students st ON sc.student_id = st.id
     JOIN users u ON st.user_id = u.id
     WHERE sc.exam_id = ? AND sc.academy_id = ?
     ORDER BY sc.score DESC`,
    [parseInt(req.params.examId), req.academyId]
  );
  res.json(scores);
});

// 개별 성적 삭제
router.delete('/score/:scoreId', authenticateToken, requireStaff, async (req, res) => {
  const scoreId = parseInt(req.params.scoreId);
  const score = await getOne('SELECT exam_id FROM scores WHERE id = ? AND academy_id = ?', [scoreId, req.academyId]);
  if (!score) return res.status(404).json({ error: '성적을 찾을 수 없습니다.' });
  await runQuery('DELETE FROM scores WHERE id = ? AND academy_id = ?', [scoreId, req.academyId]);
  // 등수 재계산
  await calculateRanks(score.exam_id, req.academyId);
  res.json({ message: '성적이 삭제되었습니다.' });
});

// 등급컷 저장 (시험별) — v2: extended format with pass_criteria
router.put('/exams/:examId/grade-cuts', authenticateToken, requireStaff, async (req, res) => {
  const { grade_cuts } = req.body;
  if (!grade_cuts) {
    // Clear grade cuts
    await runQuery('UPDATE exams SET grade_cuts = NULL WHERE id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
    return res.json({ message: '평가 기준이 삭제되었습니다.' });
  }
  await runQuery('UPDATE exams SET grade_cuts = ? WHERE id = ? AND academy_id = ?', [JSON.stringify(grade_cuts), parseInt(req.params.examId), req.academyId]);
  res.json({ message: '평가 기준이 저장되었습니다.' });
});

// 등급컷 조회 (시험별) — backward compatible: old array format wrapped in v2 structure
router.get('/exams/:examId/grade-cuts', authenticateToken, async (req, res) => {
  const exam = await getOne('SELECT grade_cuts FROM exams WHERE id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  if (!exam || !exam.grade_cuts) return res.json({ grade_cuts: null });

  try {
    const parsed = JSON.parse(exam.grade_cuts);
    if (Array.isArray(parsed)) {
      // Old format — wrap in new structure
      res.json({
        grade_cuts: {
          version: 2,
          apply_grade_cuts: true,
          grade_cuts: parsed,
          pass_criteria: { enabled: false, pass_score: 60, pass_label: '통과', fail_label: '재시험' }
        }
      });
    } else {
      // New format
      res.json({ grade_cuts: parsed });
    }
  } catch {
    res.json({ grade_cuts: null });
  }
});

// 등급컷 삭제 (시험별)
router.delete('/exams/:examId/grade-cuts', authenticateToken, requireStaff, async (req, res) => {
  await runQuery('UPDATE exams SET grade_cuts = NULL WHERE id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  res.json({ message: '평가 기준이 삭제되었습니다.' });
});

// === 학생용 ===

// 내 성적 조회 (시험 유형, 만점 정보 포함)
router.get('/my-scores', authenticateToken, async (req, res) => {
  const { studentId } = req.query;

  // 관리자/조교/선생님이 특정 학생 성적 조회
  let targetStudentId;
  if (studentId && (['admin', 'assistant'].includes(req.user.role) || ['조교', '선생님'].includes(req.user.school))) {
    targetStudentId = parseInt(studentId);
  } else {
    const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
    if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
    targetStudentId = student.id;
  }

  const scores = await getAll(
    `SELECT sc.score, sc.first_score, sc.retest_score, sc.rank_num, sc.note,
            e.name as exam_name, e.exam_date, e.exam_type, e.max_score, e.id as exam_id,
            (SELECT COUNT(*) FROM scores WHERE exam_id = e.id AND academy_id = ?) as total_students,
            CASE WHEN ak.id IS NOT NULL THEN 1 ELSE 0 END as has_answer_key,
            CASE WHEN sa.id IS NOT NULL AND sa.answers IS NOT NULL THEN 1 ELSE 0 END as has_submission,
            sa.first_score as omr_first_score,
            sa.score as omr_latest_score,
            sa.attempt_count as omr_attempt_count,
            sa.is_finalized as omr_is_finalized
     FROM scores sc JOIN exams e ON sc.exam_id = e.id
     LEFT JOIN exam_answer_keys ak ON e.id = ak.exam_id
     LEFT JOIN student_answers sa ON e.id = sa.exam_id AND sa.student_id = sc.student_id
     WHERE sc.student_id = ? AND sc.academy_id = ?
     ORDER BY e.exam_date ASC, e.id ASC`,
    [req.academyId, targetStudentId, req.academyId]
  );
  res.json(scores);
});

// 관리자·조교용: 전체 재원 학생 목록 (성적·OMR 관리용)
router.get('/students-list', authenticateToken, requireStaff, async (req, res) => {
  const isAdminUser = ['admin', 'superadmin'].includes(req.user.role);
  const selectCols = isAdminUser
    ? 's.id, u.name, s.school, s.grade, s.status, u.phone, s.parent_name, s.parent_phone'
    : 's.id, u.name, s.school, s.grade, s.status';
  const students = await getAll(
    `SELECT ${selectCols}
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE u.approved = 1 AND u.role = 'student'
       AND (s.school IS NULL OR s.school NOT IN ('조교', '선생님'))
       AND (s.status IS NULL OR s.status != 'inactive')
       AND s.academy_id = ?
     ORDER BY s.school, s.grade, u.name`,
    [req.academyId]
  );
  res.json(students);
});

// 특정 시험 성적 분포 (만점 기준 동적 분포)
router.get('/exams/:examId/distribution', authenticateToken, async (req, res) => {
  const examId = parseInt(req.params.examId);

  const exam = await getOne('SELECT max_score FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  const maxScore = exam ? exam.max_score : 100;

  const allScores = await getAll(
    'SELECT score FROM scores WHERE exam_id = ? AND academy_id = ? ORDER BY score',
    [examId, req.academyId]
  );

  // 동점자 포함 학생별 점수+이름+등수
  const studentScores = await getAll(
    `SELECT sc.score, sc.rank_num, u.name, s.school
     FROM scores sc
     JOIN students s ON sc.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE sc.exam_id = ? AND sc.academy_id = ?
     ORDER BY sc.score DESC`,
    [examId, req.academyId]
  );

  let myScore = null;
  if (req.user.role === 'student') {
    const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
    if (student) {
      const my = await getOne(
        'SELECT score FROM scores WHERE student_id = ? AND exam_id = ? AND academy_id = ?',
        [student.id, examId, req.academyId]
      );
      if (my) myScore = my.score;
    }
  }

  // 만점에 따라 동적 분포 구간 생성
  const bucketSize = maxScore <= 30 ? 5 : 10;
  const distribution = {};
  for (let i = 0; i <= maxScore; i += bucketSize) {
    const upper = Math.min(i + bucketSize - 1, maxScore);
    distribution[`${i}-${upper}`] = 0;
  }
  for (const s of allScores) {
    const bucket = Math.min(Math.floor(s.score / bucketSize) * bucketSize, maxScore);
    const upper = Math.min(bucket + bucketSize - 1, maxScore);
    const key = `${bucket}-${upper}`;
    if (distribution[key] !== undefined) {
      distribution[key]++;
    }
  }

  const avg = allScores.length > 0
    ? allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length
    : 0;

  res.json({
    distribution,
    totalStudents: allScores.length,
    average: Math.round(avg * 10) / 10,
    highest: allScores.length > 0 ? allScores[allScores.length - 1].score : 0,
    lowest: allScores.length > 0 ? allScores[0].score : 0,
    maxScore,
    myScore,
    allScores: allScores.map(s => s.score),
    studentScores: studentScores.map(s => ({ name: s.name, score: s.score, rank: s.rank_num, school: s.school }))
  });
});

// ============ OMR / 정답키 / 자동 채점 / 타이머 / 재제출 시스템 ============

// 입력자 역할 정규화 ('admin' | 'assistant' | 'student')
function getActorRole(user) {
  if (!user) return 'student';
  if (user.role === 'admin' || user.role === 'superadmin') return 'admin';
  if (['assistant', 'teacher'].includes(user.role) || ['조교', '선생님'].includes(user.school)) return 'assistant';
  return 'student';
}

// 정답키 파싱 (프론트 형식 or 배열 형식 모두 지원)
function parseAnswerKey(rawKey) {
  if (!rawKey) return { numQuestions: 0, numChoices: 5, questions: [], scoringType: 'equal' };
  const key = typeof rawKey === 'string' ? JSON.parse(rawKey) : rawKey;
  // 프론트 형식: {numQuestions, questions: [{num, answer, points?}], scoringType, ...}
  if (key && key.questions && Array.isArray(key.questions)) {
    return {
      ...key,
      numQuestions: key.numQuestions || key.questions.length,
      numChoices: key.numChoices || 5,
      scoringType: key.scoringType || 'equal',
    };
  }
  // 배열 형식: ["1","2","3",...]
  if (Array.isArray(key)) {
    return {
      numQuestions: key.length,
      numChoices: 5,
      questions: key.map((ans, idx) => ({ num: idx + 1, answer: Number(ans) || ans })),
      scoringType: 'equal'
    };
  }
  return { numQuestions: 0, numChoices: 5, questions: [], scoringType: 'equal' };
}

// 학생 답안을 { [questionNum]: answer } 맵으로 정규화
function normalizeAnswerMap(rawAnswers) {
  if (!rawAnswers) return {};
  let parsed = rawAnswers;
  if (typeof rawAnswers === 'string') {
    try { parsed = JSON.parse(rawAnswers); } catch { return {}; }
  }
  const ansMap = {};
  if (Array.isArray(parsed)) {
    parsed.forEach((a, idx) => {
      if (a && typeof a === 'object' && a.num !== undefined) {
        if (a.answer !== undefined && a.answer !== '' && a.answer !== null) {
          ansMap[Number(a.num)] = Number(a.answer) || a.answer;
        }
      } else if (a !== undefined && a !== '' && a !== null) {
        ansMap[idx + 1] = Number(a) || a;
      }
    });
  } else if (parsed && typeof parsed === 'object') {
    Object.entries(parsed).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) {
        ansMap[Number(k)] = Number(v) || v;
      }
    });
  }
  return ansMap;
}

// 정규화된 맵을 [{num, answer}] 배열로 직렬화
function serializeAnswersArray(ansMap, numQuestions) {
  const arr = [];
  const maxQ = numQuestions || Math.max(0, ...Object.keys(ansMap).map(Number));
  for (let i = 1; i <= maxQ; i++) {
    if (ansMap[i] !== undefined && ansMap[i] !== '' && ansMap[i] !== null) {
      arr.push({ num: i, answer: Number(ansMap[i]) || ansMap[i] });
    }
  }
  return arr;
}

// 해설 파일 URL 안전 검증 (http/https만 허용)
function sanitizeExplanationUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

// 시험 단위 연동 해설 파일(구글 드라이브 / 네이버 MYBOX·N드라이브 / PDF) 추출
function extractExplanationFile(parsedKey) {
  if (!parsedKey || typeof parsedKey !== 'object') return null;
  const raw = parsedKey.explanationFile;
  if (!raw || typeof raw !== 'object') return null;
  const safeUrl = sanitizeExplanationUrl(raw.url);
  if (!safeUrl) return null;
  return {
    url: safeUrl,
    title: typeof raw.title === 'string' ? raw.title.trim() : '',
    provider: typeof raw.provider === 'string' ? raw.provider.trim() : '',
  };
}

// 자동 채점 함수
function gradeAnswers(studentAnswers, parsedKey, pointConfig, maxScore) {
  const questions = parsedKey.questions || [];
  const numQ = parsedKey.numQuestions || questions.length;
  let correctCount = 0;
  let totalScore = 0;
  const results = [];

  const ansMap = normalizeAnswerMap(studentAnswers);
  const effMaxScore = Number(maxScore) || Number(parsedKey.maxScore) || 100;
  const isEqual = !pointConfig || pointConfig === 'equal' || parsedKey.scoringType === 'equal';
  const equalPoints = numQ > 0 ? effMaxScore / numQ : 0;
  let configObj = null;
  if (!isEqual && pointConfig && pointConfig !== 'equal') {
    try { configObj = typeof pointConfig === 'string' ? JSON.parse(pointConfig) : pointConfig; } catch {}
  }

  questions.forEach(q => {
    const studentAns = ansMap[q.num];
    const isCorrect = studentAns !== undefined && studentAns !== '' && String(studentAns) === String(q.answer);
    if (isCorrect) correctCount++;

    let qPoint = equalPoints;
    if (!isEqual) {
      if (q.points !== undefined) qPoint = Number(q.points);
      else if (configObj) {
        const custom = configObj.custom?.[String(q.num)];
        qPoint = custom !== undefined ? Number(custom) : (Number(configObj.default) || equalPoints);
      }
    }

    const earnedPoints = isCorrect ? qPoint : 0;
    const rawExplanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';
    const rawExplanationUrl = sanitizeExplanationUrl(q.explanationUrl);
    const parsedPage = q.explanationPage !== undefined && q.explanationPage !== null && q.explanationPage !== ''
      ? Math.max(1, parseInt(q.explanationPage, 10) || 0) || null
      : null;
    const rawCategory = typeof q.category === 'string' ? q.category.trim() : '';
    totalScore += earnedPoints;
    results.push({
      questionNum: q.num,
      student: studentAns !== undefined ? studentAns : '',
      correct: q.answer,
      isCorrect,
      points: Math.round(earnedPoints * 100) / 100,
      maxPoints: Math.round(qPoint * 100) / 100,
      explanation: rawExplanation,
      explanationPage: parsedPage,
      explanationUrl: rawExplanationUrl,
      category: rawCategory,
      hasExplanation: rawExplanation.length > 0 || rawExplanationUrl.length > 0 || parsedPage !== null,
    });
  });

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    correctCount,
    totalQuestions: numQ,
    results
  };
}

// OMR 응시 상태·쿨타임·타이머·정답 공개 가능 여부 계산 헬퍼
function computeOmrSessionStatus(keyRow, subRow, parsedKey) {
  const numQ = Number(keyRow.question_count) || parsedKey?.numQuestions || 0;
  const attemptCount = subRow
    ? (subRow.attempt_count !== undefined && subRow.attempt_count !== null
        ? Number(subRow.attempt_count)
        : (subRow.answers ? 1 : 0))
    : 0;
  const allowResubmit = keyRow.allow_resubmit !== undefined && keyRow.allow_resubmit !== null
    ? Boolean(keyRow.allow_resubmit)
    : true;
  const maxAttempts = keyRow.max_attempts !== undefined && keyRow.max_attempts !== null
    ? Number(keyRow.max_attempts)
    : 2;
  const cooldownMinutes = keyRow.resubmit_cooldown_minutes !== undefined && keyRow.resubmit_cooldown_minutes !== null
    ? Number(keyRow.resubmit_cooldown_minutes)
    : 30;
  const timeLimitMinutes = keyRow.time_limit_minutes ? Number(keyRow.time_limit_minutes) : null;
  const resubmitMode = keyRow.resubmit_mode || 'wrong_only';
  const revealAnswersPolicy = keyRow.reveal_answers_policy || 'after_final';

  const isPerfect = subRow && subRow.correct_count !== null && subRow.correct_count !== undefined && numQ > 0
    && Number(subRow.correct_count) >= numQ;
  const hasAttemptsLeft = attemptCount === 0 || (
    allowResubmit &&
    !isPerfect &&
    !subRow?.is_finalized &&
    (maxAttempts === 0 || attemptCount < maxAttempts)
  );
  const isFinalized = Boolean(subRow?.is_finalized) || (attemptCount >= 1 && !hasAttemptsLeft);

  // 재제출 쿨타임 계산
  let cooldownRemainingSeconds = 0;
  let nextRetryAvailableAt = null;
  if (attemptCount >= 1 && !isFinalized && subRow?.submitted_at && cooldownMinutes > 0) {
    const nextMs = new Date(subRow.submitted_at).getTime() + cooldownMinutes * 60 * 1000;
    nextRetryAvailableAt = new Date(nextMs).toISOString();
    cooldownRemainingSeconds = Math.max(0, Math.ceil((nextMs - Date.now()) / 1000));
  }

  // 응시 타이머 계산
  let timerRemainingSeconds = null;
  let expiresAt = null;
  if (subRow?.started_at && timeLimitMinutes && timeLimitMinutes > 0) {
    const expMs = new Date(subRow.started_at).getTime() + timeLimitMinutes * 60 * 1000;
    expiresAt = new Date(expMs).toISOString();
    timerRemainingSeconds = Math.max(0, Math.ceil((expMs - Date.now()) / 1000));
  }

  let myStatus = 'not_started';
  if (subRow?.started_at) {
    myStatus = 'in_progress';
  } else if (attemptCount === 0) {
    myStatus = 'not_started';
  } else if (isFinalized) {
    myStatus = 'completed';
  } else if (cooldownRemainingSeconds > 0) {
    myStatus = 'cooldown';
  } else {
    myStatus = 'retry_available';
  }

  let canRevealAnswers = false;
  if (revealAnswersPolicy === 'immediate') {
    canRevealAnswers = attemptCount >= 1;
  } else if (revealAnswersPolicy === 'after_final') {
    canRevealAnswers = isFinalized && attemptCount >= 1;
  } else {
    canRevealAnswers = false;
  }

  return {
    attemptCount,
    allowResubmit,
    maxAttempts,
    cooldownMinutes,
    timeLimitMinutes,
    resubmitMode,
    revealAnswersPolicy,
    isPerfect: Boolean(isPerfect),
    hasAttemptsLeft,
    isFinalized,
    cooldownRemainingSeconds,
    nextRetryAvailableAt,
    timerRemainingSeconds,
    expiresAt,
    myStatus,
    canRevealAnswers,
  };
}

// ── 문항별 정답률 · 선지별 선택률 · 변별도 집계 엔진 및 캐시 ──
const examStatsCache = new Map(); // key -> { ts, data }
const EXAM_STATS_TTL_MS = 30_000;

function invalidateExamStatsCache(academyId, examId) {
  const prefix = `${academyId}:${examId}:`;
  for (const key of examStatsCache.keys()) {
    if (key.startsWith(prefix)) examStatsCache.delete(key);
  }
}

function getDifficultyTier(rate) {
  if (rate === null || rate === undefined) return null;
  if (rate < 40) return 'high';
  if (rate < 70) return 'medium';
  return 'low';
}

function buildChoiceDistribution(countsObj, totalCount, numChoices, correctAnswer) {
  const rates = {};
  let topWrongChoice = null;
  for (let c = 1; c <= numChoices; c++) {
    const k = String(c);
    const cnt = countsObj[k] || 0;
    const rate = totalCount > 0 ? Math.round((cnt / totalCount) * 100) : 0;
    rates[k] = rate;
    if (String(c) !== String(correctAnswer) && cnt > 0) {
      if (!topWrongChoice || cnt > topWrongChoice.count) {
        topWrongChoice = { choice: c, count: cnt, rate };
      }
    }
  }
  return { rates, topWrongChoice };
}

// 순수 집계 함수 (테스트 가능: student_answers JOIN rows 입력 -> 문항별 1차/최종 정답률·교정률·선지 분포·변별도·TOP5 오답 산출)
function computeQuestionStatsFromRows(rows, parsedKey, choiceCount = 5, includeStudentNames = false) {
  const questions = parsedKey?.questions || [];
  const numChoices = Number(choiceCount) || parsedKey?.numChoices || 5;
  const totalRespondents = rows.length;

  const normalizedRows = rows.map(row => ({
    studentId: row.student_id,
    name: row.student_name || '',
    school: row.school || '',
    grade: row.grade || '',
    firstScore: Number(row.first_score ?? row.score ?? 0),
    latestScore: Number(row.score ?? 0),
    attemptCount: Number(row.attempt_count || 1),
    firstMap: normalizeAnswerMap(row.first_answers || row.answers),
    latestMap: normalizeAnswerMap(row.answers),
  }));

  const averageFirstScore = totalRespondents > 0
    ? Math.round((normalizedRows.reduce((s, r) => s + r.firstScore, 0) / totalRespondents) * 10) / 10
    : null;
  const averageLatestScore = totalRespondents > 0
    ? Math.round((normalizedRows.reduce((s, r) => s + r.latestScore, 0) / totalRespondents) * 10) / 10
    : null;

  // 변별도(상위 27% vs 하위 27%) 계산용 점수 정렬
  let topGroup = [];
  let bottomGroup = [];
  if (totalRespondents >= 10) {
    const sorted = [...normalizedRows].sort((a, b) => b.firstScore - a.firstScore);
    const groupSize = Math.max(2, Math.round(totalRespondents * 0.27));
    topGroup = sorted.slice(0, groupSize);
    bottomGroup = sorted.slice(sorted.length - groupSize);
  }

  const categoryAgg = {};
  const stats = questions.map(q => {
    const correctStr = String(q.answer);
    const category = typeof q.category === 'string' ? q.category.trim() : '';

    let firstCorrectCount = 0;
    let latestCorrectCount = 0;
    let firstWrongCount = 0;
    let correctedOnRetryCount = 0;
    const firstChoiceCounts = {};
    const latestChoiceCounts = {};
    const wrongStudentsFirst = [];
    const wrongStudentsLatest = [];

    for (const r of normalizedRows) {
      const fAns = r.firstMap[q.num] !== undefined ? String(r.firstMap[q.num]) : '';
      const lAns = r.latestMap[q.num] !== undefined ? String(r.latestMap[q.num]) : '';

      const fOk = fAns !== '' && fAns === correctStr;
      const lOk = lAns !== '' && lAns === correctStr;

      if (fOk) firstCorrectCount++;
      else {
        firstWrongCount++;
        if (lOk) correctedOnRetryCount++;
        if (includeStudentNames) {
          wrongStudentsFirst.push({
            studentId: r.studentId,
            name: r.name,
            school: r.school,
            grade: r.grade,
            choice: fAns ? Number(fAns) || fAns : null,
          });
        }
      }

      if (lOk) latestCorrectCount++;
      else if (includeStudentNames) {
        wrongStudentsLatest.push({
          studentId: r.studentId,
          name: r.name,
          school: r.school,
          grade: r.grade,
          choice: lAns ? Number(lAns) || lAns : null,
        });
      }

      if (fAns) firstChoiceCounts[fAns] = (firstChoiceCounts[fAns] || 0) + 1;
      if (lAns) latestChoiceCounts[lAns] = (latestChoiceCounts[lAns] || 0) + 1;
    }

    const firstCorrectRate = totalRespondents > 0 ? Math.round((firstCorrectCount / totalRespondents) * 100) : 0;
    const latestCorrectRate = totalRespondents > 0 ? Math.round((latestCorrectCount / totalRespondents) * 100) : 0;
    const correctionRate = firstWrongCount > 0 ? Math.round((correctedOnRetryCount / firstWrongCount) * 100) : null;

    const firstDist = buildChoiceDistribution(firstChoiceCounts, totalRespondents, numChoices, q.answer);
    const latestDist = buildChoiceDistribution(latestChoiceCounts, totalRespondents, numChoices, q.answer);

    let discrimination = null;
    if (topGroup.length > 0 && bottomGroup.length > 0) {
      const topCorrect = topGroup.filter(r => String(r.firstMap[q.num] ?? '') === correctStr).length;
      const bottomCorrect = bottomGroup.filter(r => String(r.firstMap[q.num] ?? '') === correctStr).length;
      const diff = (topCorrect / topGroup.length) - (bottomCorrect / bottomGroup.length);
      discrimination = Math.round(diff * 100) / 100;
    }

    if (category) {
      if (!categoryAgg[category]) {
        categoryAgg[category] = { category, questionCount: 0, firstRateSum: 0, latestRateSum: 0, questionNums: [] };
      }
      categoryAgg[category].questionCount++;
      categoryAgg[category].firstRateSum += firstCorrectRate;
      categoryAgg[category].latestRateSum += latestCorrectRate;
      categoryAgg[category].questionNums.push(q.num);
    }

    return {
      questionNum: q.num,
      correctAnswer: q.answer,
      category,
      totalSubmissions: totalRespondents,
      // 기본 correctRate는 1차 기준(실제 시험 난이도)으로 유지하고 최종 기준도 함께 제공
      correctRate: firstCorrectRate,
      firstCorrectCount,
      firstCorrectRate,
      latestCorrectCount,
      latestCorrectRate,
      firstWrongCount,
      latestWrongCount: totalRespondents - latestCorrectCount,
      correctedOnRetryCount,
      correctionRate,
      difficultyTier: totalRespondents > 0 ? getDifficultyTier(firstCorrectRate) : null,
      choiceCounts: firstChoiceCounts,
      firstChoiceCounts,
      firstChoiceRates: firstDist.rates,
      firstTopWrongChoice: firstDist.topWrongChoice,
      latestChoiceCounts,
      latestChoiceRates: latestDist.rates,
      latestTopWrongChoice: latestDist.topWrongChoice,
      discrimination,
      ...(includeStudentNames ? { wrongStudentsFirst, wrongStudentsLatest } : {}),
    };
  });

  const topWrongQuestions = totalRespondents > 0
    ? [...stats]
        .sort((a, b) => (a.firstCorrectRate - b.firstCorrectRate) || (a.questionNum - b.questionNum))
        .slice(0, 5)
    : [];

  const categorySummary = Object.values(categoryAgg).map(c => ({
    category: c.category,
    questionCount: c.questionCount,
    questionNums: c.questionNums,
    avgFirstCorrectRate: Math.round(c.firstRateSum / c.questionCount),
    avgLatestCorrectRate: Math.round(c.latestRateSum / c.questionCount),
  }));

  return {
    totalRespondents,
    totalSubmissions: totalRespondents,
    averageFirstScore,
    averageLatestScore,
    stats,
    topWrongQuestions,
    categorySummary,
  };
}

async function computeExamQuestionStats(examId, academyId, keyRow, parsedKey, options = {}) {
  const school = typeof options.school === 'string' ? options.school.trim() : '';
  const grade = typeof options.grade === 'string' ? options.grade.trim() : '';
  const includeStudentNames = Boolean(options.includeStudentNames);

  const cacheKey = `${academyId}:${examId}:${school}:${grade}:${includeStudentNames ? 1 : 0}`;
  const cached = examStatsCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < EXAM_STATS_TTL_MS) {
    return cached.data;
  }

  let sql = `
    SELECT sa.student_id, sa.answers, sa.first_answers, sa.score, sa.first_score, sa.attempt_count,
           u.name AS student_name, s.school, s.grade
    FROM student_answers sa
    JOIN students s ON sa.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE sa.exam_id = ? AND sa.academy_id = ?
      AND sa.answers IS NOT NULL
      AND u.role = 'student'
      AND COALESCE(s.school, '') NOT IN ('조교', '선생님')
  `;
  const params = [examId, academyId];
  if (school) {
    sql += ' AND s.school = ?';
    params.push(school);
  }
  if (grade) {
    sql += ' AND s.grade = ?';
    params.push(grade);
  }

  const rows = await getAll(sql, params);
  const choiceCount = Number(keyRow?.choice_count) || parsedKey?.numChoices || 5;
  const computed = computeQuestionStatsFromRows(rows, parsedKey, choiceCount, includeStudentNames);

  examStatsCache.set(cacheKey, { ts: Date.now(), data: computed });
  return computed;
}

// 학생 응답용 정답률·선지 분포 마스킹 (재제출 전 선지별 선택률 절대 유출 금지 + 최소 표본 인원 보호)
function buildStudentQuestionStats(statsResult, keyRow, canRevealAnswers, isStaff = false) {
  const revealPolicy = keyRow?.stats_reveal_policy || 'after_final';
  const basis = keyRow?.stats_basis === 'latest' ? 'latest' : 'first';
  const minSample = keyRow?.min_stats_sample !== undefined && keyRow?.min_stats_sample !== null
    ? Math.max(0, Number(keyRow.min_stats_sample))
    : 5;

  if (revealPolicy === 'off' && !isStaff) {
    return {
      summary: {
        enabled: false,
        revealPolicy: 'off',
        basis,
        totalRespondents: 0,
        minSample,
        isReady: false,
        canShowRate: false,
        canShowChoiceRates: false,
        averageScore: null,
      },
      byQuestion: {},
    };
  }

  const totalRespondents = statsResult?.totalRespondents || 0;
  const isReady = isStaff ? totalRespondents > 0 : totalRespondents >= minSample;
  const canShowRate = isReady && (isStaff || revealPolicy === 'rate_only_first' || canRevealAnswers);
  // 베끼기 방지: 선지별 선택률과 최다 오답 선지는 최종 정답 공개(canRevealAnswers=true) 이후에만 내려줌
  const canShowChoiceRates = isReady && (isStaff || canRevealAnswers);

  const byQuestion = {};
  (statsResult?.stats || []).forEach(st => {
    const rate = basis === 'latest' ? st.latestCorrectRate : st.firstCorrectRate;
    const choiceRates = basis === 'latest' ? st.latestChoiceRates : st.firstChoiceRates;
    const topWrong = basis === 'latest' ? st.latestTopWrongChoice : st.firstTopWrongChoice;
    byQuestion[st.questionNum] = {
      correctRate: canShowRate ? rate : null,
      difficultyTier: canShowRate ? getDifficultyTier(rate) : null,
      choiceRates: canShowChoiceRates ? choiceRates : null,
      topWrongChoice: canShowChoiceRates ? topWrong : null,
      category: st.category || '',
    };
  });

  return {
    summary: {
      enabled: true,
      revealPolicy,
      basis,
      totalRespondents,
      minSample,
      isReady,
      canShowRate,
      canShowChoiceRates,
      averageScore: canShowRate
        ? (basis === 'latest' ? statsResult?.averageLatestScore : statsResult?.averageFirstScore)
        : null,
    },
    byQuestion,
  };
}

// PDF / 이미지 정답표 AI 자동 인식 (파일 업로드 또는 Google Drive 공유 링크 — 관리자·조교 공용)
router.post('/answer-key/parse-pdf', authenticateToken, requireStaff, (req, res, next) => {
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    answerKeyUpload.single('file')(req, res, (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? '파일 크기는 최대 15MB까지 업로드할 수 있습니다.'
          : (err.message || '파일 업로드 처리 중 오류가 발생했습니다.');
        return res.status(400).json({ error: msg });
      }
      next();
    });
  } else {
    next();
  }
}, async (req, res) => {
  try {
    const expectedNumQuestions = req.body?.expectedNumQuestions ? parseInt(req.body.expectedNumQuestions, 10) : null;
    const expectedNumChoices = req.body?.expectedNumChoices ? parseInt(req.body.expectedNumChoices, 10) : null;

    let buffer = null;
    let mimeType = '';
    let sourceLabel = '';

    if (req.file && req.file.buffer) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype;
      sourceLabel = req.file.originalname || '업로드 파일';
    } else if (req.body?.url && typeof req.body.url === 'string' && req.body.url.trim()) {
      const fetched = await fetchGoogleDrivePdfBuffer(req.body.url.trim());
      buffer = fetched.buffer;
      mimeType = fetched.mimeType;
      sourceLabel = 'Google Drive 연동 파일';
    } else {
      return res.status(400).json({ error: 'PDF 또는 이미지 파일을 업로드하거나 Google Drive 공유 링크를 입력해 주세요.' });
    }

    const parsed = await parseAnswerKeyFromFile({
      buffer,
      mimeType,
      expectedNumQuestions,
      expectedNumChoices,
    });

    res.json({
      source: sourceLabel,
      ...parsed,
    });
  } catch (err) {
    console.error('[OMR PDF Parser] 인식 오류:', err.message);
    const status = err.statusCode || 400;
    res.status(status).json({ error: err.message || 'PDF 정답표 자동 인식에 실패했습니다.' });
  }
});

// 정답키 등록/수정 (OMR 세부 설정 + 정답률 공개 정책 포함 — 관리자·조교 공용)
router.post('/exams/:examId/answer-key', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const body = req.body;

  const exam = await getOne('SELECT id, max_score FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  let questionCount, answerKeyArr, pointConfigStr, choiceCount;

  if (body.questions && Array.isArray(body.questions)) {
    questionCount = body.numQuestions || body.questions.length;
    choiceCount = body.numChoices || 5;
    answerKeyArr = JSON.stringify(body);
    pointConfigStr = body.scoringType === 'individual' ? JSON.stringify({
      default: body.defaultPoints || 5,
      custom: Object.fromEntries(body.questions.filter(q => q.points !== undefined).map(q => [String(q.num), q.points]))
    }) : 'equal';
  } else if (body.questionCount && body.answerKey) {
    questionCount = body.questionCount;
    choiceCount = body.choiceCount || 5;
    answerKeyArr = JSON.stringify(body.answerKey);
    pointConfigStr = body.pointConfig && body.pointConfig !== 'equal'
      ? (typeof body.pointConfig === 'string' ? body.pointConfig : JSON.stringify(body.pointConfig))
      : 'equal';
  } else {
    return res.status(400).json({ error: '문제 수와 정답을 입력해주세요.' });
  }

  const studentOmrEnabled = body.studentOmrEnabled !== undefined ? Boolean(body.studentOmrEnabled) : false;
  const timeLimitMinutes = body.timeLimitMinutes && Number(body.timeLimitMinutes) > 0 ? parseInt(body.timeLimitMinutes) : null;
  const allowResubmit = body.allowResubmit !== undefined ? Boolean(body.allowResubmit) : true;
  const resubmitCooldownMinutes = body.resubmitCooldownMinutes !== undefined && body.resubmitCooldownMinutes !== ''
    ? Math.max(0, parseInt(body.resubmitCooldownMinutes) || 0)
    : 30;
  const maxAttempts = body.maxAttempts !== undefined && body.maxAttempts !== ''
    ? Math.max(0, parseInt(body.maxAttempts))
    : 2;
  const resubmitMode = ['wrong_only', 'all'].includes(body.resubmitMode) ? body.resubmitMode : 'wrong_only';
  const revealAnswersPolicy = ['after_final', 'immediate', 'never'].includes(body.revealAnswersPolicy)
    ? body.revealAnswersPolicy
    : 'after_final';
  const statsRevealPolicy = ['after_final', 'rate_only_first', 'off'].includes(body.statsRevealPolicy)
    ? body.statsRevealPolicy
    : 'after_final';
  const statsBasis = ['first', 'latest'].includes(body.statsBasis) ? body.statsBasis : 'first';
  const minStatsSample = body.minStatsSample !== undefined && body.minStatsSample !== ''
    ? Math.max(0, Math.min(100, parseInt(body.minStatsSample) || 0))
    : 5;

  if (body.maxScore && Number(body.maxScore) > 0 && Number(body.maxScore) !== Number(exam.max_score)) {
    await runQuery('UPDATE exams SET max_score = ? WHERE id = ? AND academy_id = ?', [Number(body.maxScore), examId, req.academyId]);
  }

  const existing = await getOne('SELECT id FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);

  if (existing) {
    await runQuery(
      `UPDATE exam_answer_keys
       SET question_count = ?, answer_key = ?, point_config = ?, choice_count = ?,
           student_omr_enabled = ?, time_limit_minutes = ?, allow_resubmit = ?,
           resubmit_cooldown_minutes = ?, max_attempts = ?, resubmit_mode = ?,
           reveal_answers_policy = ?, stats_reveal_policy = ?, stats_basis = ?,
           min_stats_sample = ?, updated_at = NOW()
       WHERE exam_id = ? AND academy_id = ?`,
      [
        questionCount, answerKeyArr, pointConfigStr, choiceCount,
        studentOmrEnabled, timeLimitMinutes, allowResubmit,
        resubmitCooldownMinutes, maxAttempts, resubmitMode,
        revealAnswersPolicy, statsRevealPolicy, statsBasis,
        minStatsSample, examId, req.academyId
      ]
    );
  } else {
    await runQuery(
      `INSERT INTO exam_answer_keys (
         exam_id, question_count, answer_key, point_config, choice_count,
         student_omr_enabled, time_limit_minutes, allow_resubmit,
         resubmit_cooldown_minutes, max_attempts, resubmit_mode,
         reveal_answers_policy, stats_reveal_policy, stats_basis, min_stats_sample, academy_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        examId, questionCount, answerKeyArr, pointConfigStr, choiceCount,
        studentOmrEnabled, timeLimitMinutes, allowResubmit,
        resubmitCooldownMinutes, maxAttempts, resubmitMode,
        revealAnswersPolicy, statsRevealPolicy, statsBasis, minStatsSample, req.academyId
      ]
    );
  }

  invalidateExamStatsCache(req.academyId, examId);
  logAction({
    req,
    action: existing ? 'omr_answer_key_update' : 'omr_answer_key_create',
    resourceType: 'exam_answer_key',
    resourceId: String(examId),
    after: { questionCount, choiceCount, studentOmrEnabled, statsRevealPolicy, statsBasis, minStatsSample },
  }).catch(() => {});

  res.json({
    message: '정답키 및 OMR 설정이 저장되었습니다.',
    questionCount,
    choiceCount,
    studentOmrEnabled,
    timeLimitMinutes,
    allowResubmit,
    resubmitCooldownMinutes,
    maxAttempts,
    resubmitMode,
    revealAnswersPolicy,
    statsRevealPolicy,
    statsBasis,
    minStatsSample,
  });
});

// 정답키 조회 (보안: 관리자/강사/조교 전용 — 학생이 직접 호출해 정답을 열람하는 것 차단)
router.get('/exams/:examId/answer-key', authenticateToken, requireStaff, async (req, res) => {
  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  if (!key) return res.json(null);
  try { key.answer_key = JSON.parse(key.answer_key); } catch {}
  if (key.point_config && key.point_config !== 'equal') {
    try { key.point_config = JSON.parse(key.point_config); } catch {}
  }
  res.json(key);
});

// 정답키 삭제 (관리자·조교 공용)
router.delete('/exams/:examId/answer-key', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  await runQuery('DELETE FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  invalidateExamStatsCache(req.academyId, examId);
  logAction({
    req,
    action: 'omr_answer_key_delete',
    resourceType: 'exam_answer_key',
    resourceId: String(examId),
  }).catch(() => {});
  res.json({ message: '정답키가 삭제되었습니다.' });
});

// 학생용: 응시 가능한 OMR 시험 목록 및 내 진행 상태 조회 (정답 번호·해설·선지 분포 마스킹!)
router.get('/student/omr-exams', authenticateToken, async (req, res) => {
  const { studentId } = req.query;
  const isStaff = isStaffUser(req.user);
  let targetStudent;

  if (studentId && isStaff) {
    targetStudent = await getOne('SELECT id, school, grade FROM students WHERE id = ? AND academy_id = ?', [parseInt(studentId), req.academyId]);
  } else {
    targetStudent = await getOne('SELECT id, school, grade FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  }
  if (!targetStudent) return res.json([]);

  const rows = await getAll(
    `SELECT e.id as exam_id, e.name, e.exam_type, e.exam_date, e.exam_end_date, e.school, e.grade, e.max_score,
            ak.question_count, ak.choice_count, ak.answer_key, ak.point_config,
            ak.student_omr_enabled, ak.time_limit_minutes, ak.allow_resubmit,
            ak.resubmit_cooldown_minutes, ak.max_attempts, ak.resubmit_mode, ak.reveal_answers_policy,
            ak.stats_reveal_policy, ak.stats_basis, ak.min_stats_sample
     FROM exams e
     INNER JOIN exam_answer_keys ak ON e.id = ak.exam_id AND ak.academy_id = e.academy_id
     WHERE e.academy_id = ?
     ORDER BY e.exam_date DESC NULLS LAST, e.id DESC`,
    [req.academyId]
  );

  const mySubs = await getAll(
    'SELECT * FROM student_answers WHERE student_id = ? AND academy_id = ?',
    [targetStudent.id, req.academyId]
  );
  const subByExam = {};
  mySubs.forEach(s => { subByExam[s.exam_id] = s; });

  const result = [];
  for (const row of rows) {
    const sub = subByExam[row.exam_id] || null;
    // 학생 OMR 오픈된 시험이거나 이미 본인이 응시한 기록이 있는 시험만 노출
    if (!row.student_omr_enabled && !sub) continue;
    // 학교/학년 필터가 지정된 시험이면 본인 학교/학년과 일치하는지 확인 (이미 응시 기록이 있으면 표시)
    if (!sub) {
      if (row.school && targetStudent.school && row.school !== targetStudent.school) continue;
      if (row.grade && targetStudent.grade && row.grade !== targetStudent.grade) continue;
    }

    const parsedKey = parseAnswerKey(row.answer_key);
    const statusInfo = computeOmrSessionStatus(row, sub, parsedKey);
    const effMaxScore = Number(row.max_score) || Number(parsedKey.maxScore) || 100;
    const numQ = Number(row.question_count) || parsedKey.numQuestions || 0;
    const equalPoints = numQ > 0 ? Math.round((effMaxScore / numQ) * 100) / 100 : 0;

    // 정답 번호(answer)는 절대 내려주지 않고 문항 번호와 배점만 전달
    const questionMeta = (parsedKey.questions || []).map(q => ({
      num: q.num,
      points: parsedKey.scoringType === 'individual' && q.points !== undefined
        ? Number(q.points)
        : equalPoints,
    }));

    // 직전 제출이 있는 경우 맞힌 문항(잠금 대상), 틀린 문항, 그리고 마스킹된 문항별 정답률 계산
    let lockedQuestions = {};
    let previousWrongAnswers = {};
    let lastGradedResults = null;
    let statsSummary = null;
    const explanationFile = extractExplanationFile(parsedKey);

    if (sub && sub.answers) {
      const graded = gradeAnswers(sub.answers, parsedKey, row.point_config, effMaxScore);
      const firstMap = sub.first_answers ? normalizeAnswerMap(sub.first_answers) : normalizeAnswerMap(sub.answers);
      const rawStats = await computeExamQuestionStats(row.exam_id, req.academyId, row, parsedKey, { includeStudentNames: false });
      const studentStats = buildStudentQuestionStats(rawStats, row, statusInfo.canRevealAnswers, isStaff);
      statsSummary = studentStats.summary;

      graded.results.forEach(r => {
        if (r.isCorrect) {
          lockedQuestions[r.questionNum] = r.student;
        } else if (r.student !== '' && r.student !== undefined) {
          previousWrongAnswers[r.questionNum] = r.student;
        }
      });
      lastGradedResults = graded.results.map(r => {
        const qStat = studentStats.byQuestion[r.questionNum] || {};
        return {
          questionNum: r.questionNum,
          student: r.student,
          firstStudent: firstMap[r.questionNum] !== undefined ? firstMap[r.questionNum] : r.student,
          correct: statusInfo.canRevealAnswers ? r.correct : null,
          isCorrect: r.isCorrect,
          points: r.points,
          maxPoints: r.maxPoints,
          explanation: statusInfo.canRevealAnswers ? r.explanation : null,
          explanationPage: statusInfo.canRevealAnswers ? r.explanationPage : null,
          explanationUrl: statusInfo.canRevealAnswers ? r.explanationUrl : null,
          category: r.category || qStat.category || '',
          hasExplanation: Boolean(r.hasExplanation),
          correctRate: qStat.correctRate ?? null,
          difficultyTier: qStat.difficultyTier ?? null,
          choiceRates: qStat.choiceRates ?? null,
          topWrongChoice: qStat.topWrongChoice ?? null,
        };
      });
    }

    result.push({
      examId: row.exam_id,
      name: row.name,
      examType: row.exam_type,
      examDate: row.exam_date,
      examEndDate: row.exam_end_date,
      school: row.school,
      grade: row.grade,
      maxScore: effMaxScore,
      questionCount: numQ,
      choiceCount: Number(row.choice_count) || parsedKey.numChoices || 5,
      scoringType: parsedKey.scoringType || 'equal',
      studentOmrEnabled: Boolean(row.student_omr_enabled),
      questionMeta,
      ...statusInfo,
      explanationFile: statusInfo.canRevealAnswers ? explanationFile : null,
      hasExplanationFile: Boolean(explanationFile?.url),
      statsSummary,
      firstScore: sub?.first_score ?? null,
      firstCorrectCount: sub?.first_correct_count ?? null,
      firstSubmittedAt: sub?.first_submitted_at ?? null,
      latestScore: sub?.score ?? null,
      latestCorrectCount: sub?.correct_count ?? null,
      latestSubmittedAt: sub?.submitted_at ?? null,
      startedAt: sub?.started_at ?? null,
      draftAnswers: sub?.draft_answers ? normalizeAnswerMap(sub.draft_answers) : null,
      lockedQuestions,
      previousWrongAnswers,
      lastGradedResults,
    });
  }

  res.json(result);
});

// 학생용: OMR 시험 시작 / 재도전 시작 (서버 기준 started_at 기록)
router.post('/exams/:examId/start-omr', authenticateToken, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const student = await getOne('SELECT id, school, grade FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const exam = await getOne('SELECT * FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.status(400).json({ error: '정답키가 설정되지 않았습니다.' });
  if (!key.student_omr_enabled && !isStaffUser(req.user)) {
    return res.status(403).json({ error: '현재 학생 OMR 입력이 열려 있지 않은 시험입니다.' });
  }

  const parsedKey = parseAnswerKey(key.answer_key);
  let existing = await getOne('SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, student.id, req.academyId]);
  const statusInfo = computeOmrSessionStatus(key, existing, parsedKey);

  if (statusInfo.isFinalized) {
    return res.status(400).json({ error: '이미 최종 제출이 완료된 시험입니다.' });
  }

  if (statusInfo.attemptCount >= 1 && statusInfo.cooldownRemainingSeconds > 0) {
    const mins = Math.floor(statusInfo.cooldownRemainingSeconds / 60);
    const secs = statusInfo.cooldownRemainingSeconds % 60;
    return res.status(429).json({
      error: `재제출 대기 시간입니다. ${mins > 0 ? `${mins}분 ` : ''}${secs}초 후에 다시 도전할 수 있습니다.`,
      cooldownRemainingSeconds: statusInfo.cooldownRemainingSeconds,
      nextRetryAvailableAt: statusInfo.nextRetryAvailableAt,
    });
  }

  // 이미 시작된 세션이 없을 때만 started_at을 새로 기록 (새로고침으로 타이머 리셋 방지)
  if (!existing) {
    await runQuery(
      `INSERT INTO student_answers (exam_id, student_id, academy_id, started_at, attempt_count)
       VALUES (?, ?, ?, NOW(), 0)`,
      [examId, student.id, req.academyId]
    );
  } else if (!existing.started_at) {
    await runQuery(
      'UPDATE student_answers SET started_at = NOW(), draft_answers = NULL WHERE id = ? AND academy_id = ?',
      [existing.id, req.academyId]
    );
  }

  existing = await getOne('SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, student.id, req.academyId]);
  const updatedStatus = computeOmrSessionStatus(key, existing, parsedKey);

  // wrong_only 재도전일 때 잠금할 기존 정답 문항 계산
  const lockedQuestions = {};
  const previousWrongAnswers = {};
  if (existing && existing.answers && updatedStatus.attemptCount >= 1) {
    const graded = gradeAnswers(existing.answers, parsedKey, key.point_config, exam.max_score);
    graded.results.forEach(r => {
      if (r.isCorrect) lockedQuestions[r.questionNum] = r.student;
      else if (r.student !== '' && r.student !== undefined) previousWrongAnswers[r.questionNum] = r.student;
    });
  }

  res.json({
    message: updatedStatus.attemptCount === 0 ? '시험 응시가 시작되었습니다.' : '오답 재도전이 시작되었습니다.',
    startedAt: existing.started_at,
    expiresAt: updatedStatus.expiresAt,
    timerRemainingSeconds: updatedStatus.timerRemainingSeconds,
    timeLimitMinutes: updatedStatus.timeLimitMinutes,
    attemptNum: updatedStatus.attemptCount + 1,
    resubmitMode: updatedStatus.resubmitMode,
    lockedQuestions,
    previousWrongAnswers,
    draftAnswers: existing.draft_answers ? normalizeAnswerMap(existing.draft_answers) : {},
  });
});

// 학생용: 마킹 중인 답안 임시 저장 (새로고침·타이머 만료 대비)
router.put('/exams/:examId/draft-answers', authenticateToken, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { answers } = req.body;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const ansMap = normalizeAnswerMap(answers);
  const existing = await getOne('SELECT id FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, student.id, req.academyId]);
  if (existing) {
    await runQuery('UPDATE student_answers SET draft_answers = ?, updated_at = NOW() WHERE id = ? AND academy_id = ?', [JSON.stringify(ansMap), existing.id, req.academyId]);
  }
  res.json({ saved: true });
});

// 학생용: 응시 중인 임시 마킹 답안 전체 초기화 (타이머 started_at은 유지하여 리셋 악용 방지)
router.delete('/exams/:examId/draft-answers', authenticateToken, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const existing = await getOne('SELECT id, is_finalized FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, student.id, req.academyId]);
  if (existing && !existing.is_finalized) {
    await runQuery('UPDATE student_answers SET draft_answers = NULL, updated_at = NOW() WHERE id = ? AND academy_id = ?', [existing.id, req.academyId]);
  }
  res.json({ cleared: true, message: '임시 마킹이 초기화되었습니다.' });
});

// 답안 제출 + 자동 채점 (학생 또는 관리자 — 타이머·쿨타임·오답잠금·1차/재제출 이원 기록)
router.post('/exams/:examId/submit-answers', authenticateToken, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { studentId, answers, autoSubmittedByTimer } = req.body;
  const isStaff = isStaffUser(req.user);

  let targetStudentId = studentId ? parseInt(studentId) : null;
  if (!isStaff || !targetStudentId) {
    const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
    if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
    targetStudentId = student.id;
  }

  const exam = await getOne('SELECT * FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.status(400).json({ error: '정답키가 설정되지 않았습니다.' });

  if (!isStaff && !key.student_omr_enabled) {
    return res.status(403).json({ error: '현재 학생 OMR 제출이 허용되지 않은 시험입니다.' });
  }

  const parsedKey = parseAnswerKey(key.answer_key);
  if (!answers) {
    return res.status(400).json({ error: '답안을 입력해주세요.' });
  }

  const existing = await getOne(
    'SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?',
    [examId, targetStudentId, req.academyId]
  );
  const statusInfo = computeOmrSessionStatus(key, existing, parsedKey);

  // 학생 본인 제출인 경우 제출 횟수·쿨타임·제한시간 검증
  if (!isStaff) {
    if (statusInfo.isFinalized) {
      return res.status(400).json({ error: '더 이상 제출할 수 없는 시험입니다. (제출 횟수 소진 또는 최종 확정 완료)' });
    }
    if (statusInfo.attemptCount >= 1 && statusInfo.cooldownRemainingSeconds > 0) {
      const mins = Math.floor(statusInfo.cooldownRemainingSeconds / 60);
      const secs = statusInfo.cooldownRemainingSeconds % 60;
      return res.status(429).json({
        error: `재제출 대기 시간이 아직 끝나지 않았습니다. (${mins > 0 ? `${mins}분 ` : ''}${secs}초 남음)`,
        cooldownRemainingSeconds: statusInfo.cooldownRemainingSeconds,
        nextRetryAvailableAt: statusInfo.nextRetryAvailableAt,
      });
    }
    // 응시 제한시간 검증 (네트워크 지연 및 자동제출 감안 90초 유예)
    if (statusInfo.timeLimitMinutes && existing?.started_at && !autoSubmittedByTimer) {
      const elapsedSec = (Date.now() - new Date(existing.started_at).getTime()) / 1000;
      const allowedSec = statusInfo.timeLimitMinutes * 60 + 90;
      if (elapsedSec > allowedSec) {
        return res.status(400).json({ error: `시험 제한 시간(${statusInfo.timeLimitMinutes}분)이 초과되었습니다.` });
      }
    }
  }

  // 제출 답안 정규화 및 wrong_only 모드 시 기존 정답 문항 잠금 병합
  const incomingMap = normalizeAnswerMap(answers);
  const finalAnswerMap = { ...incomingMap };

  if (existing && existing.answers && statusInfo.attemptCount >= 1 && statusInfo.resubmitMode === 'wrong_only' && !isStaff) {
    const prevGraded = gradeAnswers(existing.answers, parsedKey, key.point_config, exam.max_score);
    prevGraded.results.forEach(r => {
      if (r.isCorrect) {
        finalAnswerMap[r.questionNum] = r.student;
      }
    });
  }

  const serializedAnswers = serializeAnswersArray(finalAnswerMap, Number(key.question_count) || parsedKey.numQuestions);
  const graded = gradeAnswers(serializedAnswers, parsedKey, key.point_config, exam.max_score);
  const nextAttemptCount = isStaff && existing?.attempt_count
    ? existing.attempt_count
    : (statusInfo.attemptCount + 1);

  const isPerfectNow = graded.totalQuestions > 0 && graded.correctCount >= graded.totalQuestions;
  const noMoreRetries = !statusInfo.allowResubmit || (statusInfo.maxAttempts > 0 && nextAttemptCount >= statusInfo.maxAttempts);
  const isFinalizedNow = Boolean(isPerfectNow || noMoreRetries);

  const durationSeconds = existing?.started_at
    ? Math.max(1, Math.round((Date.now() - new Date(existing.started_at).getTime()) / 1000))
    : null;

  let firstScoreVal = graded.totalScore;
  let firstCorrectVal = graded.correctCount;
  const actorRole = getActorRole(req.user);
  const actorUserId = req.user?.id || null;

  if (existing) {
    const isFirstSubmission = !existing.answers || statusInfo.attemptCount === 0;
    firstScoreVal = isFirstSubmission ? graded.totalScore : (existing.first_score ?? graded.totalScore);
    firstCorrectVal = isFirstSubmission ? graded.correctCount : (existing.first_correct_count ?? graded.correctCount);
    const firstAnswersStr = isFirstSubmission ? JSON.stringify(serializedAnswers) : (existing.first_answers || JSON.stringify(serializedAnswers));

    await runQuery(
      `UPDATE student_answers
       SET answers = ?, score = ?, correct_count = ?, submitted_at = NOW(),
           first_answers = ?, first_score = ?, first_correct_count = ?,
           first_submitted_at = COALESCE(first_submitted_at, NOW()),
           started_at = NULL, draft_answers = NULL,
           attempt_count = ?, is_finalized = ?,
           last_updated_by_role = ?, last_updated_by_user_id = ?, updated_at = NOW()
       WHERE id = ? AND academy_id = ?`,
      [
        JSON.stringify(serializedAnswers), graded.totalScore, graded.correctCount,
        firstAnswersStr, firstScoreVal, firstCorrectVal,
        nextAttemptCount, isFinalizedNow,
        actorRole, actorUserId,
        existing.id, req.academyId
      ]
    );
  } else {
    await runQuery(
      `INSERT INTO student_answers (
         exam_id, student_id, academy_id,
         answers, score, correct_count, submitted_at,
         first_answers, first_score, first_correct_count, first_submitted_at,
         started_at, draft_answers, attempt_count, is_finalized,
         last_updated_by_role, last_updated_by_user_id, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, NOW(), NULL, NULL, ?, ?, ?, ?, NOW())`,
      [
        examId, targetStudentId, req.academyId,
        JSON.stringify(serializedAnswers), graded.totalScore, graded.correctCount,
        JSON.stringify(serializedAnswers), graded.totalScore, graded.correctCount,
        nextAttemptCount, isFinalizedNow,
        actorRole, actorUserId
      ]
    );
  }

  // 회차별 이력 기록
  await runQuery(
    `INSERT INTO student_answer_attempts (
       exam_id, student_id, academy_id, attempt_num, answers, score, correct_count, duration_seconds, submitted_by, submitted_by_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      examId, targetStudentId, req.academyId, nextAttemptCount,
      JSON.stringify(serializedAnswers), graded.totalScore, graded.correctCount,
      durationSeconds, actorRole, actorUserId
    ]
  );

  // scores 테이블 자동 반영 (1차 원점수 first_score & 재제출 점수 retest_score 모두 기록)
  const retestScoreVal = nextAttemptCount >= 2 ? graded.totalScore : null;
  const scoreNote = nextAttemptCount >= 2
    ? `1차 ${firstScoreVal}점 → 재제출 ${graded.totalScore}점`
    : '';

  const existingScore = await getOne('SELECT id, note FROM scores WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, targetStudentId, req.academyId]);
  if (existingScore) {
    await runQuery(
      `UPDATE scores
       SET score = ?, first_score = COALESCE(first_score, ?), retest_score = ?,
           note = CASE WHEN ? != '' THEN ? ELSE note END
       WHERE id = ? AND academy_id = ?`,
      [graded.totalScore, firstScoreVal, retestScoreVal, scoreNote, scoreNote, existingScore.id, req.academyId]
    );
  } else {
    await runQuery(
      `INSERT INTO scores (student_id, exam_id, score, first_score, retest_score, note, academy_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [targetStudentId, examId, graded.totalScore, firstScoreVal, retestScoreVal, scoreNote, req.academyId]
    );
  }
  await calculateRanks(examId, req.academyId);
  invalidateExamStatsCache(req.academyId, examId);

  if (isStaff) {
    logAction({
      req,
      action: existing?.answers ? 'omr_submission_staff_update' : 'omr_submission_staff_create',
      resourceType: 'student_answer',
      resourceId: `${examId}:${targetStudentId}`,
      before: existing ? { score: existing.score, firstScore: existing.first_score, attemptCount: existing.attempt_count } : null,
      after: { score: graded.totalScore, firstScore: firstScoreVal, attemptCount: nextAttemptCount, actorRole },
    }).catch(() => {});
  }

  // 업데이트된 상태, 정답 공개 여부 및 문항별 정답률 계산
  const updatedSub = await getOne('SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, targetStudentId, req.academyId]);
  const postStatus = computeOmrSessionStatus(key, updatedSub, parsedKey);
  const revealNow = isStaff || postStatus.canRevealAnswers;
  const firstMap = updatedSub?.first_answers ? normalizeAnswerMap(updatedSub.first_answers) : normalizeAnswerMap(serializedAnswers);
  const explanationFile = extractExplanationFile(parsedKey);
  const rawStats = await computeExamQuestionStats(examId, req.academyId, key, parsedKey, { includeStudentNames: false });
  const studentStats = buildStudentQuestionStats(rawStats, key, revealNow, isStaff);

  const maskedResults = graded.results.map(r => {
    const qStat = studentStats.byQuestion[r.questionNum] || {};
    return {
      ...r,
      firstStudent: firstMap[r.questionNum] !== undefined ? firstMap[r.questionNum] : r.student,
      correct: revealNow ? r.correct : null,
      explanation: revealNow ? r.explanation : null,
      explanationPage: revealNow ? r.explanationPage : null,
      explanationUrl: revealNow ? r.explanationUrl : null,
      category: r.category || qStat.category || '',
      hasExplanation: Boolean(r.hasExplanation),
      correctRate: qStat.correctRate ?? null,
      difficultyTier: qStat.difficultyTier ?? null,
      choiceRates: qStat.choiceRates ?? null,
      topWrongChoice: qStat.topWrongChoice ?? null,
    };
  });

  res.json({
    message: nextAttemptCount === 1
      ? '1차 답안이 제출되고 채점되었습니다.'
      : `${nextAttemptCount}차 재제출 답안이 채점되었습니다.`,
    score: graded.totalScore,
    firstScore: firstScoreVal,
    retestScore: retestScoreVal,
    correctCount: graded.correctCount,
    firstCorrectCount: firstCorrectVal,
    totalQuestions: graded.totalQuestions,
    attemptCount: nextAttemptCount,
    maxAttempts: postStatus.maxAttempts,
    isFinalized: postStatus.isFinalized,
    canRevealAnswers: revealNow,
    explanationFile: revealNow ? explanationFile : null,
    hasExplanationFile: Boolean(explanationFile?.url),
    statsSummary: studentStats.summary,
    cooldownRemainingSeconds: postStatus.cooldownRemainingSeconds,
    nextRetryAvailableAt: postStatus.nextRetryAvailableAt,
    myStatus: postStatus.myStatus,
    results: maskedResults,
  });
});

// 관리자·조교용: 특정 학생 OMR 답안 수정(Update) 및 재채점
router.put('/exams/:examId/submissions/:studentId', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const targetStudentId = parseInt(req.params.studentId);
  const { answers, updateMode = 'latest', markFinalized } = req.body;

  if (!answers) return res.status(400).json({ error: '수정할 답안을 입력해주세요.' });

  const exam = await getOne('SELECT * FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.status(400).json({ error: '정답키가 설정되지 않았습니다.' });

  const parsedKey = parseAnswerKey(key.answer_key);
  const existing = await getOne(
    'SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?',
    [examId, targetStudentId, req.academyId]
  );

  const normalized = serializeAnswersArray(normalizeAnswerMap(answers), Number(key.question_count) || parsedKey.numQuestions);
  const graded = gradeAnswers(normalized, parsedKey, key.point_config, exam.max_score);
  const actorRole = getActorRole(req.user);
  const actorUserId = req.user?.id || null;

  let firstAnswersStr = JSON.stringify(normalized);
  let firstScoreVal = graded.totalScore;
  let firstCorrectVal = graded.correctCount;
  let latestAnswersStr = JSON.stringify(normalized);
  let latestScoreVal = graded.totalScore;
  let latestCorrectVal = graded.correctCount;
  let nextAttemptCount = Math.max(1, Number(existing?.attempt_count || 1));

  if (existing && existing.answers) {
    if (updateMode === 'first' && (existing.attempt_count || 1) >= 2) {
      // 1차 답안만 정정하고 최신(재제출) 답안은 유지
      latestAnswersStr = existing.answers;
      latestScoreVal = Number(existing.score ?? graded.totalScore);
      latestCorrectVal = Number(existing.correct_count ?? graded.correctCount);
    } else if (updateMode !== 'first' && (existing.attempt_count || 1) >= 2) {
      // 재제출 답안 정정, 기존 1차 원점수 보존
      firstAnswersStr = existing.first_answers || existing.answers;
      firstScoreVal = Number(existing.first_score ?? existing.score ?? graded.totalScore);
      firstCorrectVal = Number(existing.first_correct_count ?? existing.correct_count ?? graded.correctCount);
    }
  }

  const nextFinalized = markFinalized !== undefined
    ? Boolean(markFinalized)
    : Boolean(existing?.is_finalized);

  if (existing) {
    await runQuery(
      `UPDATE student_answers
       SET answers = ?, score = ?, correct_count = ?, submitted_at = COALESCE(submitted_at, NOW()),
           first_answers = ?, first_score = ?, first_correct_count = ?,
           first_submitted_at = COALESCE(first_submitted_at, NOW()),
           started_at = NULL, draft_answers = NULL,
           attempt_count = ?, is_finalized = ?,
           last_updated_by_role = ?, last_updated_by_user_id = ?, updated_at = NOW()
       WHERE id = ? AND academy_id = ?`,
      [
        latestAnswersStr, latestScoreVal, latestCorrectVal,
        firstAnswersStr, firstScoreVal, firstCorrectVal,
        nextAttemptCount, nextFinalized,
        actorRole, actorUserId,
        existing.id, req.academyId
      ]
    );
  } else {
    await runQuery(
      `INSERT INTO student_answers (
         exam_id, student_id, academy_id,
         answers, score, correct_count, submitted_at,
         first_answers, first_score, first_correct_count, first_submitted_at,
         started_at, draft_answers, attempt_count, is_finalized,
         last_updated_by_role, last_updated_by_user_id, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, NOW(), NULL, NULL, 1, ?, ?, ?, NOW())`,
      [
        examId, targetStudentId, req.academyId,
        latestAnswersStr, latestScoreVal, latestCorrectVal,
        firstAnswersStr, firstScoreVal, firstCorrectVal,
        nextFinalized, actorRole, actorUserId
      ]
    );
  }

  await runQuery(
    `INSERT INTO student_answer_attempts (
       exam_id, student_id, academy_id, attempt_num, answers, score, correct_count, submitted_by, submitted_by_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [examId, targetStudentId, req.academyId, nextAttemptCount, JSON.stringify(normalized), graded.totalScore, graded.correctCount, actorRole, actorUserId]
  );

  const retestScoreVal = nextAttemptCount >= 2 ? latestScoreVal : null;
  const scoreNote = nextAttemptCount >= 2 ? `1차 ${firstScoreVal}점 → 재제출 ${latestScoreVal}점` : '';
  const existingScore = await getOne('SELECT id FROM scores WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, targetStudentId, req.academyId]);
  if (existingScore) {
    await runQuery(
      `UPDATE scores
       SET score = ?, first_score = ?, retest_score = ?,
           note = CASE WHEN ? != '' THEN ? ELSE note END
       WHERE id = ? AND academy_id = ?`,
      [latestScoreVal, firstScoreVal, retestScoreVal, scoreNote, scoreNote, existingScore.id, req.academyId]
    );
  } else {
    await runQuery(
      `INSERT INTO scores (student_id, exam_id, score, first_score, retest_score, note, academy_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [targetStudentId, examId, latestScoreVal, firstScoreVal, retestScoreVal, scoreNote, req.academyId]
    );
  }

  await calculateRanks(examId, req.academyId);
  invalidateExamStatsCache(req.academyId, examId);
  logAction({
    req,
    action: 'omr_submission_staff_update',
    resourceType: 'student_answer',
    resourceId: `${examId}:${targetStudentId}`,
    before: existing ? { score: existing.score, firstScore: existing.first_score, attemptCount: existing.attempt_count } : null,
    after: { score: latestScoreVal, firstScore: firstScoreVal, updateMode, markFinalized: nextFinalized, actorRole },
  }).catch(() => {});

  res.json({
    message: '학생 OMR 답안이 수정되고 재채점되었습니다.',
    score: latestScoreVal,
    firstScore: firstScoreVal,
    retestScore: retestScoreVal,
    correctCount: latestCorrectVal,
    totalQuestions: graded.totalQuestions,
  });
});

// 관리자·조교용: 특정 학생 OMR 제출 기록 삭제(Delete) 및 연동 성적/등수 정리
router.delete('/exams/:examId/submissions/:studentId', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const targetStudentId = parseInt(req.params.studentId);
  const alsoDeleteScore = req.query.keepScore !== '1';

  const existing = await getOne(
    'SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?',
    [examId, targetStudentId, req.academyId]
  );
  if (!existing) {
    return res.status(404).json({ error: '삭제할 OMR 제출 기록이 없습니다.' });
  }

  await runQuery('DELETE FROM student_answer_attempts WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, targetStudentId, req.academyId]);
  await runQuery('DELETE FROM student_answers WHERE id = ? AND academy_id = ?', [existing.id, req.academyId]);

  if (alsoDeleteScore) {
    await runQuery('DELETE FROM scores WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, targetStudentId, req.academyId]);
    await calculateRanks(examId, req.academyId);
  }

  invalidateExamStatsCache(req.academyId, examId);
  logAction({
    req,
    action: 'omr_submission_staff_delete',
    resourceType: 'student_answer',
    resourceId: `${examId}:${targetStudentId}`,
    before: { score: existing.score, firstScore: existing.first_score, attemptCount: existing.attempt_count },
    after: { deleted: true, alsoDeleteScore },
  }).catch(() => {});

  res.json({ message: '학생의 OMR 제출 기록이 삭제되었습니다.' });
});

// 학생용: 재제출 포기하고 최종 확정 (즉시 정답 확인용)
router.post('/exams/:examId/finalize-submission', authenticateToken, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const sub = await getOne('SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, student.id, req.academyId]);
  if (!sub || !sub.answers) return res.status(400).json({ error: '제출된 답안이 없습니다.' });

  await runQuery('UPDATE student_answers SET is_finalized = true, started_at = NULL, updated_at = NOW() WHERE id = ? AND academy_id = ?', [sub.id, req.academyId]);
  res.json({ message: '최종 제출로 확정되었습니다. 이제 정답을 확인할 수 있습니다.', isFinalized: true });
});

// 관리자·조교용: 특정 학생의 재제출 쿨타임 해제 또는 추가 재응시 허용
router.post('/exams/:examId/reset-cooldown', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { studentId, action } = req.body; // action: 'clear_cooldown' | 'grant_retry' | 'reset_timer'
  if (!studentId) return res.status(400).json({ error: '학생 ID가 필요합니다.' });

  const sub = await getOne('SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, parseInt(studentId), req.academyId]);
  if (!sub) return res.status(404).json({ error: '해당 학생의 OMR 응시 기록이 없습니다.' });

  if (action === 'grant_retry') {
    const newAttemptCount = Math.max(1, (Number(sub.attempt_count) || 1) - 1);
    await runQuery(
      `UPDATE student_answers
       SET is_finalized = false, attempt_count = ?, submitted_at = NOW() - INTERVAL '1 day', started_at = NULL, updated_at = NOW()
       WHERE id = ? AND academy_id = ?`,
      [newAttemptCount, sub.id, req.academyId]
    );
    logAction({ req, action: 'omr_grant_retry', resourceType: 'student_answer', resourceId: `${examId}:${studentId}` }).catch(() => {});
    return res.json({ message: '재제출 기회가 부여되고 대기 시간이 해제되었습니다.' });
  }

  if (action === 'reset_timer') {
    await runQuery('UPDATE student_answers SET started_at = NOW(), updated_at = NOW() WHERE id = ? AND academy_id = ?', [sub.id, req.academyId]);
    logAction({ req, action: 'omr_reset_timer', resourceType: 'student_answer', resourceId: `${examId}:${studentId}` }).catch(() => {});
    return res.json({ message: '응시 타이머가 초기화되었습니다.' });
  }

  // 기본: clear_cooldown
  await runQuery(
    `UPDATE student_answers
     SET submitted_at = NOW() - INTERVAL '1 day', is_finalized = false, updated_at = NOW()
     WHERE id = ? AND academy_id = ?`,
    [sub.id, req.academyId]
  );
  logAction({ req, action: 'omr_clear_cooldown', resourceType: 'student_answer', resourceId: `${examId}:${studentId}` }).catch(() => {});
  res.json({ message: '재제출 대기 시간(쿨타임)이 즉시 해제되었습니다.' });
});

// 관리자·조교용: 정답키 수정 후 기존 제출 답안 전체 일괄 재채점
router.post('/exams/:examId/regrade-all', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const exam = await getOne('SELECT * FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.status(400).json({ error: '정답키가 설정되지 않았습니다.' });

  const parsedKey = parseAnswerKey(key.answer_key);
  const submissions = await getAll('SELECT * FROM student_answers WHERE exam_id = ? AND academy_id = ? AND answers IS NOT NULL', [examId, req.academyId]);

  for (const sub of submissions) {
    const latestGraded = gradeAnswers(sub.answers, parsedKey, key.point_config, exam.max_score);
    const firstGraded = sub.first_answers
      ? gradeAnswers(sub.first_answers, parsedKey, key.point_config, exam.max_score)
      : latestGraded;

    await runQuery(
      `UPDATE student_answers
       SET score = ?, correct_count = ?, first_score = ?, first_correct_count = ?, updated_at = NOW()
       WHERE id = ? AND academy_id = ?`,
      [latestGraded.totalScore, latestGraded.correctCount, firstGraded.totalScore, firstGraded.correctCount, sub.id, req.academyId]
    );

    const retestScoreVal = (sub.attempt_count || 1) >= 2 ? latestGraded.totalScore : null;
    await runQuery(
      `UPDATE scores
       SET score = ?, first_score = ?, retest_score = ?
       WHERE exam_id = ? AND student_id = ? AND academy_id = ?`,
      [latestGraded.totalScore, firstGraded.totalScore, retestScoreVal, examId, sub.student_id, req.academyId]
    );
  }

  await calculateRanks(examId, req.academyId);
  invalidateExamStatsCache(req.academyId, examId);
  logAction({ req, action: 'omr_regrade_all', resourceType: 'exam', resourceId: String(examId), after: { count: submissions.length } }).catch(() => {});
  res.json({ message: `${submissions.length}명의 제출 답안이 새 정답키로 재채점되었습니다.`, count: submissions.length });
});

// 관리자·조교 일괄 답안 입력
router.post('/exams/:examId/submit-answers-batch', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { submissions } = req.body; // [{studentId, answers}, ...]

  const exam = await getOne('SELECT * FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.status(400).json({ error: '정답키가 설정되지 않았습니다.' });

  const parsedKey = parseAnswerKey(key.answer_key);
  const actorRole = getActorRole(req.user);
  const actorUserId = req.user?.id || null;
  let savedCount = 0;

  for (const sub of submissions) {
    if (!sub.answers) continue;

    const normalized = serializeAnswersArray(normalizeAnswerMap(sub.answers), Number(key.question_count) || parsedKey.numQuestions);
    const graded = gradeAnswers(normalized, parsedKey, key.point_config, exam.max_score);

    const existing = await getOne('SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, sub.studentId, req.academyId]);
    if (existing) {
      const firstScoreVal = existing.first_score ?? graded.totalScore;
      const firstCorrectVal = existing.first_correct_count ?? graded.correctCount;
      const firstAnswersStr = existing.first_answers || JSON.stringify(normalized);
      await runQuery(
        `UPDATE student_answers
         SET answers = ?, score = ?, correct_count = ?, submitted_at = NOW(),
             first_answers = ?, first_score = ?, first_correct_count = ?,
             first_submitted_at = COALESCE(first_submitted_at, NOW()),
             attempt_count = GREATEST(COALESCE(attempt_count, 0), 1),
             last_updated_by_role = ?, last_updated_by_user_id = ?, updated_at = NOW()
         WHERE id = ? AND academy_id = ?`,
        [JSON.stringify(normalized), graded.totalScore, graded.correctCount, firstAnswersStr, firstScoreVal, firstCorrectVal, actorRole, actorUserId, existing.id, req.academyId]
      );
    } else {
      await runQuery(
        `INSERT INTO student_answers (
           exam_id, student_id, answers, score, correct_count, submitted_at,
           first_answers, first_score, first_correct_count, first_submitted_at,
           attempt_count, last_updated_by_role, last_updated_by_user_id, updated_at, academy_id
         ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, NOW(), 1, ?, ?, NOW(), ?)`,
        [examId, sub.studentId, JSON.stringify(normalized), graded.totalScore, graded.correctCount, JSON.stringify(normalized), graded.totalScore, graded.correctCount, actorRole, actorUserId, req.academyId]
      );
    }

    // scores 테이블 반영
    const existingScore = await getOne('SELECT id FROM scores WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, sub.studentId, req.academyId]);
    if (existingScore) {
      await runQuery('UPDATE scores SET score = ?, first_score = COALESCE(first_score, ?) WHERE id = ? AND academy_id = ?', [graded.totalScore, graded.totalScore, existingScore.id, req.academyId]);
    } else {
      await runQuery('INSERT INTO scores (student_id, exam_id, score, first_score, academy_id) VALUES (?, ?, ?, ?, ?)', [sub.studentId, examId, graded.totalScore, graded.totalScore, req.academyId]);
    }
    savedCount++;
  }

  await calculateRanks(examId, req.academyId);
  invalidateExamStatsCache(req.academyId, examId);
  logAction({ req, action: 'omr_submit_batch', resourceType: 'exam', resourceId: String(examId), after: { savedCount, actorRole } }).catch(() => {});
  res.json({ message: `${savedCount}명의 답안이 저장되고 채점되었습니다.` });
});

// 답안 제출 현황 (관리자·조교 공용 — 입력자 역할/이름 포함)
router.get('/exams/:examId/submissions', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  const parsedKey = key ? parseAnswerKey(key.answer_key) : null;

  const submissions = await getAll(
    `SELECT sa.*, u.name as student_name, s.school, s.grade,
            actor.name as last_updated_by_name
     FROM student_answers sa
     JOIN students s ON sa.student_id = s.id
     JOIN users u ON s.user_id = u.id
     LEFT JOIN users actor ON sa.last_updated_by_user_id = actor.id
     WHERE sa.exam_id = ? AND sa.academy_id = ?
     ORDER BY sa.score DESC NULLS LAST`,
    [examId, req.academyId]
  );

  submissions.forEach(s => {
    try { s.answers = s.answers ? JSON.parse(s.answers) : []; } catch { s.answers = []; }
    try { s.first_answers = s.first_answers ? JSON.parse(s.first_answers) : null; } catch { s.first_answers = null; }
    if (key) {
      Object.assign(s, computeOmrSessionStatus(key, s, parsedKey));
    }
  });
  res.json(submissions);
});

// 내 답안 결과 (학생 또는 관리자/조교가 특정 학생 조회 — 재제출 전에는 정답·해설·선지 분포 마스킹)
router.get('/exams/:examId/my-submission', authenticateToken, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { studentId } = req.query;
  const isStaff = isStaffUser(req.user);

  let targetStudentId = studentId && isStaff ? parseInt(studentId) : null;
  if (!targetStudentId) {
    const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
    if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
    targetStudentId = student.id;
  }

  const submission = await getOne(
    'SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?',
    [examId, targetStudentId, req.academyId]
  );
  if (!submission || !submission.answers) return res.json(null);

  const exam = await getOne('SELECT max_score FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.json(null);

  const parsedKey = parseAnswerKey(key.answer_key);
  const statusInfo = computeOmrSessionStatus(key, submission, parsedKey);
  const revealNow = isStaff || statusInfo.canRevealAnswers;
  const explanationFile = extractExplanationFile(parsedKey);

  const latestGraded = gradeAnswers(submission.answers, parsedKey, key.point_config, exam?.max_score || 100);
  const firstMap = submission.first_answers ? normalizeAnswerMap(submission.first_answers) : normalizeAnswerMap(submission.answers);
  const rawStats = await computeExamQuestionStats(examId, req.academyId, key, parsedKey, { includeStudentNames: false });
  const studentStats = buildStudentQuestionStats(rawStats, key, revealNow, isStaff);

  const results = latestGraded.results.map(r => {
    const qStat = studentStats.byQuestion[r.questionNum] || {};
    return {
      num: r.questionNum,
      questionNum: r.questionNum,
      student: r.student,
      firstStudent: firstMap[r.questionNum] !== undefined ? firstMap[r.questionNum] : r.student,
      correct: revealNow ? r.correct : null,
      isCorrect: r.isCorrect,
      points: r.points,
      maxPoints: r.maxPoints,
      explanation: revealNow ? r.explanation : null,
      explanationPage: revealNow ? r.explanationPage : null,
      explanationUrl: revealNow ? r.explanationUrl : null,
      category: r.category || qStat.category || '',
      hasExplanation: Boolean(r.hasExplanation),
      correctRate: qStat.correctRate ?? null,
      difficultyTier: qStat.difficultyTier ?? null,
      choiceRates: qStat.choiceRates ?? null,
      topWrongChoice: qStat.topWrongChoice ?? null,
    };
  });

  const attempts = await getAll(
    `SELECT attempt_num, score, correct_count, duration_seconds, submitted_by, submitted_at
     FROM student_answer_attempts
     WHERE exam_id = ? AND student_id = ? AND academy_id = ?
     ORDER BY attempt_num ASC`,
    [examId, targetStudentId, req.academyId]
  );

  res.json({
    id: submission.id,
    examId,
    studentId: targetStudentId,
    score: submission.score,
    correctCount: submission.correct_count,
    firstScore: submission.first_score ?? submission.score,
    firstCorrectCount: submission.first_correct_count ?? submission.correct_count,
    firstSubmittedAt: submission.first_submitted_at ?? submission.submitted_at,
    submittedAt: submission.submitted_at,
    questionCount: latestGraded.totalQuestions,
    choiceCount: Number(key.choice_count) || parsedKey.numChoices || 5,
    ...statusInfo,
    canRevealAnswers: revealNow,
    explanationFile: revealNow ? explanationFile : null,
    hasExplanationFile: Boolean(explanationFile?.url),
    statsSummary: studentStats.summary,
    results,
    attempts,
  });
});

// 문항별 정답률 · 선지 분포 · 킬러 문항 · 오답 학생 통계 (관리자·조교 공용, 학교/학년 필터 지원)
router.get('/exams/:examId/question-stats', authenticateToken, requireStaff, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { school = '', grade = '' } = req.query;
  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) {
    return res.json({
      stats: [],
      topWrongQuestions: [],
      categorySummary: [],
      totalSubmissions: 0,
      totalRespondents: 0,
      averageFirstScore: null,
      averageLatestScore: null,
    });
  }

  const parsedKey = parseAnswerKey(key.answer_key);
  const computed = await computeExamQuestionStats(examId, req.academyId, key, parsedKey, {
    school,
    grade,
    includeStudentNames: true,
  });

  res.json({
    ...computed,
    choiceCount: Number(key.choice_count) || parsedKey.numChoices || 5,
    statsRevealPolicy: key.stats_reveal_policy || 'after_final',
    statsBasis: key.stats_basis || 'first',
    minStatsSample: key.min_stats_sample ?? 5,
  });
});

// 정답키가 설정된 시험 목록
router.get('/exams-with-keys', authenticateToken, async (req, res) => {
  const exams = await getAll(
    `SELECT e.*, ak.question_count, ak.choice_count, ak.student_omr_enabled,
            ak.time_limit_minutes, ak.allow_resubmit, ak.resubmit_cooldown_minutes,
            ak.max_attempts, ak.resubmit_mode, ak.reveal_answers_policy,
            ak.stats_reveal_policy, ak.stats_basis, ak.min_stats_sample
     FROM exams e
     INNER JOIN exam_answer_keys ak ON e.id = ak.exam_id
     WHERE e.academy_id = ?
     ORDER BY e.exam_date DESC, e.id DESC`,
    [req.academyId]
  );
  res.json(exams);
});

module.exports = router;
