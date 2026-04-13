const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { addEvent } = require('../services/timeline');

const router = express.Router();

// === 관리자 전용 ===

// 시험 등록 (만점 포함)
router.post('/exams', authenticateToken, requireAdmin, async (req, res) => {
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
router.put('/exams/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// 시험 삭제
router.delete('/exams/:id', authenticateToken, requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM scores WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  await runQuery('DELETE FROM exams WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '시험이 삭제되었습니다.' });
});

// 성적 입력 (단일)
router.post('/score', authenticateToken, requireAdmin, async (req, res) => {
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
router.post('/batch', authenticateToken, requireAdmin, async (req, res) => {
  const { examId, scores } = req.body;
  if (!examId || !scores || !Array.isArray(scores)) {
    return res.status(400).json({ error: '유효하지 않은 데이터입니다.' });
  }

  for (const s of scores) {
    const existing = await getOne(
      'SELECT id FROM scores WHERE student_id = ? AND exam_id = ? AND academy_id = ?',
      [s.studentId, examId, req.academyId]
    );

    if (existing) {
      await runQuery(
        'UPDATE scores SET score = ?, note = ?, status = ? WHERE id = ? AND academy_id = ?',
        [s.score, s.note || '', s.status || 'normal', existing.id, req.academyId]
      );
    } else {
      await runQuery(
        'INSERT INTO scores (student_id, exam_id, score, note, status, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
        [s.studentId, examId, s.score, s.note || '', s.status || 'normal', req.academyId]
      );
    }
  }

  // 등수 자동 계산
  await calculateRanks(examId, req.academyId);

  // 타임라인 이벤트 (일괄)
  const exam = await getOne('SELECT name FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
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
router.post('/exams/:examId/recalculate-ranks', authenticateToken, requireAdmin, async (req, res) => {
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

// 시험별 성적 조회 (관리자)
router.get('/exams/:examId/scores', authenticateToken, requireAdmin, async (req, res) => {
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
router.delete('/score/:scoreId', authenticateToken, requireAdmin, async (req, res) => {
  const scoreId = parseInt(req.params.scoreId);
  const score = await getOne('SELECT exam_id FROM scores WHERE id = ? AND academy_id = ?', [scoreId, req.academyId]);
  if (!score) return res.status(404).json({ error: '성적을 찾을 수 없습니다.' });
  await runQuery('DELETE FROM scores WHERE id = ? AND academy_id = ?', [scoreId, req.academyId]);
  // 등수 재계산
  await calculateRanks(score.exam_id, req.academyId);
  res.json({ message: '성적이 삭제되었습니다.' });
});

// 등급컷 저장 (시험별) — v2: extended format with pass_criteria
router.put('/exams/:examId/grade-cuts', authenticateToken, requireAdmin, async (req, res) => {
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
router.delete('/exams/:examId/grade-cuts', authenticateToken, requireAdmin, async (req, res) => {
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
    `SELECT sc.score, sc.rank_num, sc.note,
            e.name as exam_name, e.exam_date, e.exam_type, e.max_score, e.id as exam_id,
            (SELECT COUNT(*) FROM scores WHERE exam_id = e.id AND academy_id = ?) as total_students,
            CASE WHEN ak.id IS NOT NULL THEN 1 ELSE 0 END as has_answer_key,
            CASE WHEN sa.id IS NOT NULL THEN 1 ELSE 0 END as has_submission
     FROM scores sc JOIN exams e ON sc.exam_id = e.id
     LEFT JOIN exam_answer_keys ak ON e.id = ak.exam_id
     LEFT JOIN student_answers sa ON e.id = sa.exam_id AND sa.student_id = sc.student_id
     WHERE sc.student_id = ? AND sc.academy_id = ?
     ORDER BY e.exam_date ASC, e.id ASC`,
    [req.academyId, targetStudentId, req.academyId]
  );
  res.json(scores);
});

// 관리자용: 전체 학생 목록 (성적 조회용)
router.get('/students-list', authenticateToken, async (req, res) => {
  if (!['admin', 'assistant'].includes(req.user.role) && !['조교', '선생님'].includes(req.user.school)) {
    return res.status(403).json({ error: '권한이 없습니다.' });
  }
  const students = await getAll(
    `SELECT s.id, u.name, s.school, s.grade
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE u.approved = 1 AND u.role = 'student' AND s.school NOT IN ('조교', '선생님') AND s.academy_id = ?
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

// ============ OMR / 정답키 / 자동 채점 ============

// 정답키 파싱 (프론트 형식 or 배열 형식 모두 지원)
function parseAnswerKey(rawKey) {
  const key = typeof rawKey === 'string' ? JSON.parse(rawKey) : rawKey;
  // 프론트 형식: {numQuestions, questions: [{num, answer, points?}], scoringType, ...}
  if (key.questions && Array.isArray(key.questions)) {
    return key;
  }
  // 배열 형식: ["1","2","3",...]
  if (Array.isArray(key)) {
    return {
      numQuestions: key.length,
      questions: key.map((ans, idx) => ({ num: idx + 1, answer: ans })),
      scoringType: 'equal'
    };
  }
  return key;
}

// 자동 채점 함수 (프론트 형식 지원)
function gradeAnswers(studentAnswers, parsedKey, pointConfig, maxScore) {
  const questions = parsedKey.questions || [];
  const numQ = parsedKey.numQuestions || questions.length;
  let correctCount = 0;
  let totalScore = 0;
  const results = [];

  // studentAnswers: [{num, answer}] 또는 {1: 3, 2: 1} 형식 모두 지원
  let ansMap = {};
  if (Array.isArray(studentAnswers)) {
    studentAnswers.forEach(a => {
      if (a.num !== undefined) ansMap[a.num] = a.answer;
      else ansMap[studentAnswers.indexOf(a) + 1] = a;
    });
  } else if (typeof studentAnswers === 'object') {
    ansMap = studentAnswers;
  }

  const isEqual = !pointConfig || pointConfig === 'equal' || parsedKey.scoringType === 'equal';
  const equalPoints = numQ > 0 ? maxScore / numQ : 0;
  let configObj = null;
  if (!isEqual && pointConfig && pointConfig !== 'equal') {
    try { configObj = typeof pointConfig === 'string' ? JSON.parse(pointConfig) : pointConfig; } catch(e) {}
  }

  questions.forEach(q => {
    const studentAns = ansMap[q.num];
    const isCorrect = studentAns !== undefined && String(studentAns) === String(q.answer);
    if (isCorrect) correctCount++;

    let points = 0;
    if (isEqual) {
      points = isCorrect ? equalPoints : 0;
    } else if (q.points !== undefined) {
      points = isCorrect ? q.points : 0;
    } else if (configObj) {
      const custom = configObj.custom?.[String(q.num)];
      points = isCorrect ? (custom || configObj.default || equalPoints) : 0;
    } else {
      points = isCorrect ? equalPoints : 0;
    }

    totalScore += points;
    results.push({ questionNum: q.num, student: studentAns || '', correct: q.answer, isCorrect, points: Math.round(points * 100) / 100 });
  });

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    correctCount,
    totalQuestions: numQ,
    results
  };
}

// 정답키 등록/수정 (프론트 형식: {numQuestions, questions: [{num, answer, points?}], ...})
router.post('/exams/:examId/answer-key', authenticateToken, requireAdmin, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const body = req.body;

  const exam = await getOne('SELECT id, max_score FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  // 프론트 형식 지원: {numQuestions, numChoices, scoringType, maxScore, defaultPoints, questions: [{num, answer, points?}]}
  let questionCount, answerKeyArr, pointConfigStr, choiceCount;

  if (body.questions && Array.isArray(body.questions)) {
    questionCount = body.numQuestions || body.questions.length;
    choiceCount = body.numChoices || 5;
    // answer_key: 전체 정보를 JSON으로 저장
    answerKeyArr = JSON.stringify(body); // 전체 payload를 answer_key에 저장
    pointConfigStr = body.scoringType === 'individual' ? JSON.stringify({
      default: body.defaultPoints || 5,
      custom: Object.fromEntries(body.questions.filter(q => q.points !== undefined).map(q => [String(q.num), q.points]))
    }) : 'equal';
  } else if (body.questionCount && body.answerKey) {
    // 기존 배열 형식도 지원
    questionCount = body.questionCount;
    choiceCount = body.choiceCount || 5;
    answerKeyArr = JSON.stringify(body.answerKey);
    pointConfigStr = body.pointConfig && body.pointConfig !== 'equal'
      ? (typeof body.pointConfig === 'string' ? body.pointConfig : JSON.stringify(body.pointConfig))
      : 'equal';
  } else {
    return res.status(400).json({ error: '문제 수와 정답을 입력해주세요.' });
  }

  const existing = await getOne('SELECT id FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);

  if (existing) {
    await runQuery('UPDATE exam_answer_keys SET question_count = ?, answer_key = ?, point_config = ?, choice_count = ? WHERE exam_id = ? AND academy_id = ?',
      [questionCount, answerKeyArr, pointConfigStr, choiceCount, examId, req.academyId]);
  } else {
    await runQuery('INSERT INTO exam_answer_keys (exam_id, question_count, answer_key, point_config, choice_count, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
      [examId, questionCount, answerKeyArr, pointConfigStr, choiceCount, req.academyId]);
  }

  res.json({ message: '정답키가 저장되었습니다.', questionCount, choiceCount });
});

// 정답키 조회
router.get('/exams/:examId/answer-key', authenticateToken, async (req, res) => {
  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  if (!key) return res.json(null);
  try { key.answer_key = JSON.parse(key.answer_key); } catch(e) {}
  if (key.point_config && key.point_config !== 'equal') {
    try { key.point_config = JSON.parse(key.point_config); } catch(e) {}
  }
  res.json(key);
});

// 정답키 삭제
router.delete('/exams/:examId/answer-key', authenticateToken, requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  res.json({ message: '정답키가 삭제되었습니다.' });
});

// 답안 제출 + 자동 채점 (학생 또는 관리자)
router.post('/exams/:examId/submit-answers', authenticateToken, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { studentId, answers } = req.body;

  // 관리자는 studentId 지정 가능, 학생은 자신만
  let targetStudentId = studentId;
  if (!['admin', 'assistant'].includes(req.user.role) && req.user.school !== '조교') {
    const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
    if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
    targetStudentId = student.id;
  }

  const exam = await getOne('SELECT * FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.status(400).json({ error: '정답키가 설정되지 않았습니다.' });

  const parsedKey = parseAnswerKey(key.answer_key);
  if (!answers) {
    return res.status(400).json({ error: '답안을 입력해주세요.' });
  }

  // 채점
  const graded = gradeAnswers(answers, parsedKey, key.point_config, exam.max_score);

  // student_answers 저장
  const existing = await getOne('SELECT id FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, targetStudentId, req.academyId]);
  if (existing) {
    await runQuery('UPDATE student_answers SET answers = ?, score = ?, correct_count = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
      [JSON.stringify(answers), graded.totalScore, graded.correctCount, existing.id, req.academyId]);
  } else {
    await runQuery('INSERT INTO student_answers (exam_id, student_id, answers, score, correct_count, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
      [examId, targetStudentId, JSON.stringify(answers), graded.totalScore, graded.correctCount, req.academyId]);
  }

  // scores 테이블에도 자동 반영
  const existingScore = await getOne('SELECT id FROM scores WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, targetStudentId, req.academyId]);
  if (existingScore) {
    await runQuery('UPDATE scores SET score = ? WHERE id = ? AND academy_id = ?', [graded.totalScore, existingScore.id, req.academyId]);
  } else {
    await runQuery('INSERT INTO scores (student_id, exam_id, score, academy_id) VALUES (?, ?, ?, ?)', [targetStudentId, examId, graded.totalScore, req.academyId]);
  }
  await calculateRanks(examId, req.academyId);

  res.json({
    message: '답안이 제출되고 채점되었습니다.',
    score: graded.totalScore,
    correctCount: graded.correctCount,
    totalQuestions: graded.totalQuestions,
    results: graded.results
  });
});

// 관리자 일괄 답안 입력
router.post('/exams/:examId/submit-answers-batch', authenticateToken, requireAdmin, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { submissions } = req.body; // [{studentId, answers}, ...]

  const exam = await getOne('SELECT * FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.status(400).json({ error: '정답키가 설정되지 않았습니다.' });

  const parsedKey = parseAnswerKey(key.answer_key);
  let savedCount = 0;

  for (const sub of submissions) {
    if (!sub.answers) continue;

    const graded = gradeAnswers(sub.answers, parsedKey, key.point_config, exam.max_score);

    const existing = await getOne('SELECT id FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, sub.studentId, req.academyId]);
    if (existing) {
      await runQuery('UPDATE student_answers SET answers = ?, score = ?, correct_count = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
        [JSON.stringify(sub.answers), graded.totalScore, graded.correctCount, existing.id, req.academyId]);
    } else {
      await runQuery('INSERT INTO student_answers (exam_id, student_id, answers, score, correct_count, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
        [examId, sub.studentId, JSON.stringify(sub.answers), graded.totalScore, graded.correctCount, req.academyId]);
    }

    // scores 테이블 반영
    const existingScore = await getOne('SELECT id FROM scores WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, sub.studentId, req.academyId]);
    if (existingScore) {
      await runQuery('UPDATE scores SET score = ? WHERE id = ? AND academy_id = ?', [graded.totalScore, existingScore.id, req.academyId]);
    } else {
      await runQuery('INSERT INTO scores (student_id, exam_id, score, academy_id) VALUES (?, ?, ?, ?)', [sub.studentId, examId, graded.totalScore, req.academyId]);
    }
    savedCount++;
  }

  await calculateRanks(examId, req.academyId);
  res.json({ message: `${savedCount}명의 답안이 저장되고 채점되었습니다.` });
});

// 답안 제출 현황 (관리자)
router.get('/exams/:examId/submissions', authenticateToken, requireAdmin, async (req, res) => {
  const submissions = await getAll(
    `SELECT sa.*, u.name as student_name, s.school, s.grade
     FROM student_answers sa
     JOIN students s ON sa.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE sa.exam_id = ? AND sa.academy_id = ?
     ORDER BY sa.score DESC`,
    [parseInt(req.params.examId), req.academyId]
  );
  submissions.forEach(s => { s.answers = JSON.parse(s.answers); });
  res.json(submissions);
});

// 내 답안 결과 (학생)
router.get('/exams/:examId/my-submission', authenticateToken, async (req, res) => {
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const submission = await getOne('SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?',
    [parseInt(req.params.examId), student.id, req.academyId]);
  if (!submission) return res.json(null);

  submission.answers = JSON.parse(submission.answers);

  // 정답키도 포함
  const key = await getOne('SELECT answer_key, question_count FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  if (key) {
    submission.answerKey = JSON.parse(key.answer_key);
    submission.questionCount = key.question_count;
  }

  res.json(submission);
});

// 문항별 정답률 통계 (관리자)
router.get('/exams/:examId/question-stats', authenticateToken, requireAdmin, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.json({ stats: [] });

  const parsedKey = parseAnswerKey(key.answer_key);
  const questions = parsedKey.questions || [];
  const submissions = await getAll('SELECT answers FROM student_answers WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);

  const stats = questions.map(q => {
    let correctCount = 0;
    const choiceCounts = {};
    submissions.forEach(s => {
      let ans;
      try { ans = JSON.parse(s.answers); } catch(e) { return; }
      // 답안 형식: [{num, answer}] 또는 {1: 3}
      let studentAns;
      if (Array.isArray(ans)) {
        const found = ans.find(a => a.num === q.num);
        studentAns = found ? String(found.answer) : '';
      } else if (typeof ans === 'object') {
        studentAns = ans[q.num] ? String(ans[q.num]) : '';
      } else {
        studentAns = '';
      }
      if (studentAns === String(q.answer)) correctCount++;
      if (studentAns) choiceCounts[studentAns] = (choiceCounts[studentAns] || 0) + 1;
    });
    return {
      questionNum: q.num,
      correctAnswer: q.answer,
      correctRate: submissions.length > 0 ? Math.round((correctCount / submissions.length) * 100) : 0,
      totalSubmissions: submissions.length,
      choiceCounts
    };
  });

  res.json({ stats, totalSubmissions: submissions.length });
});

// 정답키가 설정된 시험 목록
router.get('/exams-with-keys', authenticateToken, async (req, res) => {
  const exams = await getAll(
    `SELECT e.*, ak.question_count, ak.choice_count
     FROM exams e
     INNER JOIN exam_answer_keys ak ON e.id = ak.exam_id
     WHERE e.academy_id = ?
     ORDER BY e.exam_date DESC, e.id DESC`,
    [req.academyId]
  );
  res.json(exams);
});

// ═══════════════════════════════════════════════
// OMR 자동 채점 시스템
// ═══════════════════════════════════════════════

// 채점 함수
function gradeAnswers(studentAnswers, answerKey, pointConfig, maxScore) {
  let correctCount = 0;
  let totalScore = 0;
  const results = [];
  const questionCount = answerKey.length;

  answerKey.forEach((correct, idx) => {
    const student = studentAnswers[idx] || '';
    const isCorrect = String(student) === String(correct);
    let points = 0;

    if (isCorrect) {
      correctCount++;
      if (pointConfig === 'equal') {
        points = maxScore / questionCount;
      } else {
        try {
          const config = typeof pointConfig === 'string' ? JSON.parse(pointConfig) : pointConfig;
          points = config.custom?.[String(idx + 1)] || config.default || (maxScore / questionCount);
        } catch { points = maxScore / questionCount; }
      }
    }
    totalScore += points;
    results.push({ questionNum: idx + 1, student, correct, isCorrect, points: Math.round(points * 100) / 100 });
  });

  return { totalScore: Math.round(totalScore * 100) / 100, correctCount, results };
}

// 정답키 등록/수정 (관리자)
router.post('/exams/:examId/answer-key', requireAdmin, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { questionCount, answerKey, pointConfig, choiceCount } = req.body;
  if (!questionCount || !answerKey || !Array.isArray(answerKey)) {
    return res.status(400).json({ error: '문제 수와 정답키를 입력해주세요.' });
  }
  if (answerKey.length !== questionCount) {
    return res.status(400).json({ error: '정답키 개수가 문제 수와 일치하지 않습니다.' });
  }
  const exam = await getOne('SELECT id FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const existing = await getOne('SELECT id FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (existing) {
    await runQuery(
      'UPDATE exam_answer_keys SET question_count = ?, answer_key = ?, point_config = ?, choice_count = ? WHERE exam_id = ? AND academy_id = ?',
      [questionCount, JSON.stringify(answerKey), pointConfig === 'equal' ? 'equal' : JSON.stringify(pointConfig), choiceCount || 5, examId, req.academyId]
    );
  } else {
    await runInsert(
      'INSERT INTO exam_answer_keys (exam_id, question_count, answer_key, point_config, choice_count, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
      [examId, questionCount, JSON.stringify(answerKey), pointConfig === 'equal' ? 'equal' : JSON.stringify(pointConfig), choiceCount || 5, req.academyId]
    );
  }
  res.json({ message: '정답키가 저장되었습니다.' });
});

// 정답키 조회
router.get('/exams/:examId/answer-key', requireAdmin, async (req, res) => {
  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  if (!key) return res.json(null);
  key.answer_key = JSON.parse(key.answer_key);
  if (key.point_config !== 'equal') {
    try { key.point_config = JSON.parse(key.point_config); } catch {}
  }
  res.json(key);
});

// 정답키 삭제
router.delete('/exams/:examId/answer-key', requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  await runQuery('DELETE FROM student_answers WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  res.json({ message: '정답키와 관련 답안이 삭제되었습니다.' });
});

// 답안 제출 + 자동 채점 (관리자/학생)
router.post('/exams/:examId/submit-answers', async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { studentId, answers } = req.body;
  const targetStudentId = studentId || (await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]))?.id;
  if (!targetStudentId || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: '학생 ID와 답안을 입력해주세요.' });
  }

  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.status(404).json({ error: '정답키가 설정되지 않은 시험입니다.' });

  const exam = await getOne('SELECT * FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const answerKey = JSON.parse(key.answer_key);
  const { totalScore, correctCount, results } = gradeAnswers(answers, answerKey, key.point_config, exam.max_score || 100);

  // student_answers 저장
  const existing = await getOne('SELECT id FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, targetStudentId, req.academyId]);
  if (existing) {
    await runQuery(
      'UPDATE student_answers SET answers = ?, score = ?, correct_count = ?, submitted_at = NOW() WHERE exam_id = ? AND student_id = ? AND academy_id = ?',
      [JSON.stringify(answers), totalScore, correctCount, examId, targetStudentId, req.academyId]
    );
  } else {
    await runInsert(
      'INSERT INTO student_answers (exam_id, student_id, answers, score, correct_count, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
      [examId, targetStudentId, JSON.stringify(answers), totalScore, correctCount, req.academyId]
    );
  }

  // scores 테이블에도 반영
  const existingScore = await getOne('SELECT id FROM scores WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, targetStudentId, req.academyId]);
  if (existingScore) {
    await runQuery('UPDATE scores SET score = ? WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [totalScore, examId, targetStudentId, req.academyId]);
  } else {
    await runInsert('INSERT INTO scores (exam_id, student_id, score, academy_id) VALUES (?, ?, ?, ?)', [examId, targetStudentId, totalScore, req.academyId]);
  }

  // 등수 재계산
  const allScores = await getAll('SELECT id, score FROM scores WHERE exam_id = ? AND academy_id = ? ORDER BY score DESC', [examId, req.academyId]);
  for (let i = 0; i < allScores.length; i++) {
    await runQuery('UPDATE scores SET rank_num = ? WHERE id = ? AND academy_id = ?', [i + 1, allScores[i].id, req.academyId]);
  }

  res.json({ totalScore, correctCount, questionCount: answerKey.length, results });
});

// 관리자 일괄 답안 입력
router.post('/exams/:examId/submit-answers-batch', requireAdmin, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const { submissions } = req.body; // [{studentId, answers: [...]}]
  if (!submissions || !Array.isArray(submissions)) {
    return res.status(400).json({ error: '답안 목록을 입력해주세요.' });
  }

  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.status(404).json({ error: '정답키가 설정되지 않은 시험입니다.' });

  const exam = await getOne('SELECT * FROM exams WHERE id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!exam) return res.status(404).json({ error: '시험을 찾을 수 없습니다.' });

  const answerKey = JSON.parse(key.answer_key);
  const results = [];

  for (const sub of submissions) {
    const { totalScore, correctCount } = gradeAnswers(sub.answers, answerKey, key.point_config, exam.max_score || 100);

    const existing = await getOne('SELECT id FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, sub.studentId, req.academyId]);
    if (existing) {
      await runQuery(
        'UPDATE student_answers SET answers = ?, score = ?, correct_count = ?, submitted_at = NOW() WHERE exam_id = ? AND student_id = ? AND academy_id = ?',
        [JSON.stringify(sub.answers), totalScore, correctCount, examId, sub.studentId, req.academyId]
      );
    } else {
      await runInsert(
        'INSERT INTO student_answers (exam_id, student_id, answers, score, correct_count, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
        [examId, sub.studentId, JSON.stringify(sub.answers), totalScore, correctCount, req.academyId]
      );
    }

    // scores 동기화
    const existingScore = await getOne('SELECT id FROM scores WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [examId, sub.studentId, req.academyId]);
    if (existingScore) {
      await runQuery('UPDATE scores SET score = ? WHERE exam_id = ? AND student_id = ? AND academy_id = ?', [totalScore, examId, sub.studentId, req.academyId]);
    } else {
      await runInsert('INSERT INTO scores (exam_id, student_id, score, academy_id) VALUES (?, ?, ?, ?)', [examId, sub.studentId, totalScore, req.academyId]);
    }

    results.push({ studentId: sub.studentId, totalScore, correctCount });
  }

  // 등수 재계산
  const allScores = await getAll('SELECT id, score FROM scores WHERE exam_id = ? AND academy_id = ? ORDER BY score DESC', [examId, req.academyId]);
  for (let i = 0; i < allScores.length; i++) {
    await runQuery('UPDATE scores SET rank_num = ? WHERE id = ? AND academy_id = ?', [i + 1, allScores[i].id, req.academyId]);
  }

  res.json({ message: `${results.length}명 채점 완료`, results });
});

// 답안 제출 현황 (관리자)
router.get('/exams/:examId/submissions', requireAdmin, async (req, res) => {
  const submissions = await getAll(
    `SELECT sa.*, u.name as student_name, s.school, s.grade
     FROM student_answers sa
     JOIN students s ON sa.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE sa.exam_id = ? AND sa.academy_id = ?
     ORDER BY sa.score DESC`,
    [parseInt(req.params.examId), req.academyId]
  );
  submissions.forEach(s => {
    s.answers = JSON.parse(s.answers);
  });
  res.json(submissions);
});

// 내 답안 결과 (학생 / 관리자가 특정 학생 조회)
router.get('/exams/:examId/my-submission', async (req, res) => {
  let targetStudentId;
  const { studentId } = req.query;
  if (studentId && (['admin', 'assistant'].includes(req.user.role) || ['조교', '선생님'].includes(req.user.school))) {
    targetStudentId = parseInt(studentId);
  } else {
    const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
    if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });
    targetStudentId = student.id;
  }

  const submission = await getOne('SELECT * FROM student_answers WHERE exam_id = ? AND student_id = ? AND academy_id = ?',
    [parseInt(req.params.examId), targetStudentId, req.academyId]);
  if (!submission) return res.json(null);

  submission.answers = JSON.parse(submission.answers);

  // 정답키도 함께 반환
  const key = await getOne('SELECT answer_key, question_count FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [parseInt(req.params.examId), req.academyId]);
  if (key) key.answer_key = JSON.parse(key.answer_key);

  res.json({ submission, answerKey: key });
});

// 문항별 정답률 통계 (관리자)
router.get('/exams/:examId/question-stats', requireAdmin, async (req, res) => {
  const examId = parseInt(req.params.examId);
  const key = await getOne('SELECT * FROM exam_answer_keys WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);
  if (!key) return res.json([]);

  const answerKey = JSON.parse(key.answer_key);
  const submissions = await getAll('SELECT answers FROM student_answers WHERE exam_id = ? AND academy_id = ?', [examId, req.academyId]);

  const stats = answerKey.map((correct, idx) => {
    let correctCount = 0;
    const choiceDistribution = {};
    submissions.forEach(s => {
      const answers = JSON.parse(s.answers);
      const answer = answers[idx] || '';
      choiceDistribution[answer] = (choiceDistribution[answer] || 0) + 1;
      if (String(answer) === String(correct)) correctCount++;
    });
    return {
      questionNum: idx + 1,
      correct,
      correctRate: submissions.length > 0 ? Math.round(correctCount / submissions.length * 100) : 0,
      totalSubmissions: submissions.length,
      correctCount,
      choiceDistribution,
    };
  });

  res.json(stats);
});

module.exports = router;
