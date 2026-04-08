const express = require('express');
const router = express.Router();
const { runQuery, runInsert, getOne, getAll, runBatch } = require('../../db/database');
const { authenticateToken } = require('../../middleware/auth');
const { getLevelInfo, checkAndGrantTitles, rankingCache, getTodayKST } = require('./utils');

// 게임 참여 가능한 사용자인지 확인 (조교/선생님만 차단, 관리자는 허용)
async function getGameStudent(req) {
  let student = await getOne("SELECT s.id, s.school FROM students s WHERE s.user_id = ? AND s.academy_id = ?", [req.user.id, req.academyId]);
  if (!student && req.user.role === 'admin') {
    await runQuery("INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      [req.user.id, '관리자', '관리자', '', '', req.academyId]);
    student = await getOne("SELECT s.id, s.school FROM students s WHERE s.user_id = ? AND s.academy_id = ?", [req.user.id, req.academyId]);
  }
  if (student && ['조교', '선생님'].includes(student.school)) return null;
  return student || null;
}

// Quiz lock to prevent daily limit race condition (Critical #8)
const quizLocks = new Map();
function acquireQuizLock(studentId) {
  if (quizLocks.has(studentId)) return false;
  quizLocks.set(studentId, Date.now());
  setTimeout(() => quizLocks.delete(studentId), 5000); // 5s lock
  return true;
}
function releaseQuizLock(studentId) {
  quizLocks.delete(studentId);
}

// === Vocab Quiz ===

// 단어 카테고리 목록
router.get('/vocab/categories', authenticateToken, async (req, res) => {
  const categories = await getAll('SELECT category, COUNT(*) as count FROM vocab_words WHERE (academy_id = ? OR academy_id = 0) GROUP BY category', [req.academyId]);
  res.json(categories);
});

// 단어 퀴즈 시작
router.get('/vocab/start', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  // Daily limit race condition lock (Critical #8)
  if (!acquireQuizLock(`vocab_${student.id}`)) {
    return res.status(429).json({ error: '퀴즈 시작 처리 중입니다. 잠시 후 다시 시도하세요.' });
  }

  try {

  // 게임 설정에서 일일 제한 가져오기
  const limitSetting = await getOne("SELECT value FROM game_settings WHERE key = 'daily_quiz_limit' AND academy_id = ?", [req.academyId]);
  const dailyLimit = limitSetting ? parseInt(limitSetting.value) || 50 : 50;

  // 하루 제한 체크
  const today = getTodayKST();
  const todayResult = await getOne(
    "SELECT COALESCE(SUM(total_questions), 0) as cnt FROM vocab_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, req.academyId]
  );
  const todayCount = todayResult ? todayResult.cnt : 0;
  const remaining = dailyLimit - todayCount;
  if (remaining <= 0) {
    return res.status(400).json({ error: `오늘의 퀴즈 제한(${dailyLimit}문제)에 도달했습니다. 내일 다시 도전하세요!` });
  }

  const category = req.query.category;
  let count = parseInt(req.query.count) || 10;
  if (count > dailyLimit) count = dailyLimit;

  // 남은 문제 수로 제한
  if (count > remaining) count = remaining;

  // 최근 풀었던 문제 ID 수집 (맞힌 문제 3일, 틀린 문제 1일 제외)
  let excludeIds = [];
  if (student) {
    // 최근 3일 이내 맞힌 문제 제외
    const correctRows = await getAll(
      `SELECT DISTINCT word_id FROM vocab_question_results
       WHERE student_id = ? AND is_correct = 1 AND answered_at > datetime('now', '-3 days') AND academy_id = ?`,
      [student.id, req.academyId]
    );
    const correctIds = correctRows.map(r => r.word_id);

    // 최근 1일 이내 틀린 문제도 제외 (너무 빨리 재출제 방지)
    const recentWrongRows = await getAll(
      `SELECT DISTINCT word_id FROM vocab_question_results
       WHERE student_id = ? AND is_correct = 0 AND answered_at > datetime('now', '-1 days') AND academy_id = ?`,
      [student.id, req.academyId]
    );
    const recentWrongIds = recentWrongRows.map(r => r.word_id);

    excludeIds = [...new Set([...correctIds, ...recentWrongIds])];
  }
  const excludePlaceholder = excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.join(',')})` : '';

  let words;
  if (category) {
    words = await getAll(`SELECT id, question_text, correct_answer, wrong_answers, difficulty FROM vocab_words WHERE category = ? AND (academy_id = ? OR academy_id = 0) ${excludePlaceholder} ORDER BY RANDOM() LIMIT ?`, [category, req.academyId, count * 3]);
  } else {
    words = await getAll(`SELECT id, question_text, correct_answer, wrong_answers, difficulty FROM vocab_words WHERE (academy_id = ? OR academy_id = 0) ${excludePlaceholder} ORDER BY RANDOM() LIMIT ?`, [req.academyId, count * 3]);
  }

  // 제외 후 문제가 부족하면 전체에서 랜덤 추가
  if (words.length < count) {
    const existingIds = words.map(w => w.id);
    const moreExclude = existingIds.length > 0 ? `AND id NOT IN (${existingIds.join(',')})` : '';
    const more = category
      ? await getAll(`SELECT id, question_text, correct_answer, wrong_answers, difficulty FROM vocab_words WHERE category = ? AND (academy_id = ? OR academy_id = 0) ${moreExclude} ORDER BY RANDOM() LIMIT ?`, [category, req.academyId, count - words.length])
      : await getAll(`SELECT id, question_text, correct_answer, wrong_answers, difficulty FROM vocab_words WHERE (academy_id = ? OR academy_id = 0) ${moreExclude} ORDER BY RANDOM() LIMIT ?`, [req.academyId, count - words.length]);
    words = [...words, ...more];
  }

  words = words.sort(() => Math.random() - 0.5).slice(0, count);

  const questions = words.map(w => {
    let wrongAnswers;
    try {
      wrongAnswers = JSON.parse(w.wrong_answers);
    } catch {
      wrongAnswers = [];
    }
    // 정답 위치를 0~3 중 균등하게 분배
    const wrongSlice = wrongAnswers.slice(0, 3);
    const correctIdx = Math.floor(Math.random() * (wrongSlice.length + 1));
    const options = [...wrongSlice];
    options.splice(correctIdx, 0, w.correct_answer);
    return {
      id: w.id,
      questionText: w.question_text,
      options
    };
  });

  // 시작 즉시 log 삽입 → 오늘 횟수 즉시 차감 (어뷰징 방지)
  const logId = await runInsert(
    "INSERT INTO vocab_game_logs (student_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, 0, 0, ?)",
    [student.id, questions.length, req.academyId]
  );

  res.json({ questions, logId });

  } finally {
    releaseQuizLock(`vocab_${student.id}`);
  }
});

// 단어 퀴즈 제출
router.post('/vocab/submit', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const { answers, logId } = req.body;
  if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: '답안을 제출해주세요.' });

  let totalXpEarned = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let streak = 0;
  const details = [];

  // 모든 wordId를 모아서 한 번에 조회 (N+1 방지)
  const wordIds = answers.map(a => a.wordId).filter(Boolean);
  const placeholders = wordIds.map((_, i) => `$${i + 1}`).join(',');
  const allWords = wordIds.length > 0
    ? await getAll(`SELECT * FROM vocab_words WHERE id IN (${placeholders}) AND (academy_id = ? OR academy_id = 0)`, [...wordIds, req.academyId])
    : [];
  const wordMap = {};
  for (const w of allWords) wordMap[w.id] = w;

  // 배치 INSERT용 데이터 준비
  const resultRows = [];

  for (const ans of answers) {
    const word = wordMap[ans.wordId];
    if (!word) continue;

    const isCorrect = ans.selectedAnswer === word.correct_answer;

    if (isCorrect) {
      correctCount++;
      streak++;
      // 정답 보상: 쉬움 +5, 보통 +8, 어려움 +12
      let xp = 5;
      if (word.difficulty === 2) xp = 8;
      else if (word.difficulty === 3) xp = 12;

      // 연속 정답 보너스 (5연속부터 +3)
      if (streak >= 5) xp += 3;

      totalXpEarned += xp;
    } else {
      wrongCount++;
      streak = 0;
      // 오답 감점: 쉬움 -2, 보통 -3, 어려움 -5
      let penalty = -2;
      if (word.difficulty === 2) penalty = -3;
      else if (word.difficulty === 3) penalty = -5;

      totalXpEarned += penalty;
    }

    details.push({
      wordId: word.id,
      correct: isCorrect,
      correctAnswer: word.correct_answer,
      explanation: word.explanation || null
    });

    resultRows.push(student.id, word.id, isCorrect ? 1 : 0, req.academyId);
  }

  // 개별 문제 결과 일괄 기록 (반복 출제 방지용)
  if (resultRows.length > 0) {
    const rowCount = resultRows.length / 4;
    const insertPlaceholders = [];
    for (let i = 0; i < rowCount; i++) {
      const base = i * 4;
      insertPlaceholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    }
    try {
      await runQuery(
        `INSERT INTO vocab_question_results (student_id, word_id, is_correct, academy_id) VALUES ${insertPlaceholders.join(', ')}`,
        resultRows
      );
    } catch (e) { /* 무시 */ }
  }

  // Perfect score bonus (+50%)
  if (correctCount === answers.length && answers.length >= 5) {
    totalXpEarned = Math.floor(totalXpEarned * 1.5);
  }

  // 최소 0 XP (마이너스가 되진 않도록)
  if (totalXpEarned < 0) totalXpEarned = 0;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const oldLevel = getLevelInfo(sc.xp).level;
  const newLevel = getLevelInfo(sc.xp + totalXpEarned).level;

  // Atomic XP/points update — prevents race condition (Critical #7)
  await runQuery('UPDATE student_characters SET xp = GREATEST(xp + ?, 0), points = GREATEST(points + ?, 0), level = ? WHERE student_id = ? AND academy_id = ?',
    [totalXpEarned, totalXpEarned, newLevel, student.id, req.academyId]);

  // logId가 있으면 start 시 만든 row를 UPDATE, 없으면 INSERT (하위호환)
  if (logId) {
    await runQuery(
      "UPDATE vocab_game_logs SET total_questions = ?, correct_count = ?, xp_earned = ? WHERE id = ? AND student_id = ? AND academy_id = ?",
      [answers.length, correctCount, totalXpEarned, logId, student.id, req.academyId]
    );
  } else {
    await runInsert(
      "INSERT INTO vocab_game_logs (student_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, ?, ?, ?)",
      [student.id, answers.length, correctCount, totalXpEarned, req.academyId]
    );
  }

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'quiz', ?, ?)",
    [student.id, totalXpEarned, `단어 퀴즈 ${correctCount}/${answers.length}`, req.academyId]);

  await checkAndGrantTitles(student.id, req.academyId);

  rankingCache.invalidate();
  res.json({ correct: correctCount, total: answers.length, xpEarned: totalXpEarned, details, leveledUp: newLevel > oldLevel, newLevel });
});

// ============================================================
// ========== 지식 퀴즈 (Knowledge Quiz) ==========
// ============================================================

router.get('/knowledge/categories', authenticateToken, async (req, res) => {
  const categories = await getAll('SELECT category, COUNT(*) as count FROM knowledge_questions WHERE (academy_id = ? OR academy_id = 0) GROUP BY category', [req.academyId]);
  res.json(categories);
});

router.get('/knowledge/start', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  // Daily limit race condition lock (Critical #8)
  if (!acquireQuizLock(`knowledge_${student.id}`)) {
    return res.status(429).json({ error: '퀴즈 시작 처리 중입니다. 잠시 후 다시 시도하세요.' });
  }

  try {

  const limitSetting = await getOne("SELECT value FROM game_settings WHERE key = 'daily_knowledge_limit' AND academy_id = ?", [req.academyId]);
  const dailyLimit = limitSetting ? parseInt(limitSetting.value) || 50 : 50;

  const today = getTodayKST();
  const todayResult = await getOne(
    "SELECT COALESCE(SUM(total_questions), 0) as cnt FROM knowledge_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, req.academyId]
  );
  const todayCount = todayResult ? todayResult.cnt : 0;
  const remaining = dailyLimit - todayCount;
  if (remaining <= 0) {
    return res.status(400).json({ error: `오늘의 지식 퀴즈 제한(${dailyLimit}문제)에 도달했습니다.` });
  }

  const category = req.query.category;
  let count = parseInt(req.query.count) || 10;
  if (count > remaining) count = remaining;

  // 맞힌 문제 제외, 틀린 문제는 7일 후 재출제
  const correctRows2 = await getAll(
    `SELECT DISTINCT question_id FROM knowledge_question_results
     WHERE student_id = ? AND is_correct = 1 AND academy_id = ?`,
    [student.id, req.academyId]
  );
  const correctIds = correctRows2.map(r => r.question_id);

  const recentWrongRows2 = await getAll(
    `SELECT DISTINCT question_id FROM knowledge_question_results
     WHERE student_id = ? AND is_correct = 0
     AND answered_at > datetime('now', '-7 days') AND academy_id = ?`,
    [student.id, req.academyId]
  );
  const recentWrongIds = recentWrongRows2.map(r => r.question_id);

  const excludeIds = [...new Set([...correctIds, ...recentWrongIds])];
  const excludePlaceholder = excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.join(',')})` : '';

  let words;
  if (category) {
    words = await getAll(`SELECT id, category, question_text, correct_answer, wrong_answers, difficulty, explanation FROM knowledge_questions WHERE category = ? AND (academy_id = ? OR academy_id = 0) ${excludePlaceholder} ORDER BY RANDOM() LIMIT ?`, [category, req.academyId, count * 2]);
  } else {
    words = await getAll(`SELECT id, category, question_text, correct_answer, wrong_answers, difficulty, explanation FROM knowledge_questions WHERE (academy_id = ? OR academy_id = 0) ${excludePlaceholder} ORDER BY RANDOM() LIMIT ?`, [req.academyId, count * 2]);
  }
  words = words.sort(() => Math.random() - 0.5).slice(0, count);

  if (words.length === 0) {
    return res.status(400).json({ error: '출제할 수 있는 문제가 없습니다. 모든 문제를 맞혔거나, 잠시 후 다시 시도해주세요.' });
  }

  const questions = words.map(w => {
    let wrongAnswers;
    try { wrongAnswers = JSON.parse(w.wrong_answers); } catch { wrongAnswers = []; }
    const wrongSlice = wrongAnswers.slice(0, 3);
    const correctIdx = Math.floor(Math.random() * (wrongSlice.length + 1));
    const options = [...wrongSlice];
    options.splice(correctIdx, 0, w.correct_answer);
    return { id: w.id, category: w.category, questionText: w.question_text, options, difficulty: w.difficulty, correctAnswer: w.correct_answer, explanation: w.explanation || '' };
  });

  // 시작 즉시 log 삽입 → 오늘 횟수 즉시 차감 (어뷰징 방지)
  const logId = await runInsert(
    "INSERT INTO knowledge_game_logs (student_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, 0, 0, ?)",
    [student.id, questions.length, req.academyId]
  );

  res.json({ questions, logId });

  } finally {
    releaseQuizLock(`knowledge_${student.id}`);
  }
});

router.post('/knowledge/submit', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const { answers, logId } = req.body;
  if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: '답안을 제출해주세요.' });

  let totalXpEarned = 0;
  let correctCount = 0;
  let streak = 0;
  const details = [];

  // 모든 questionId를 모아서 한 번에 조회 (N+1 방지)
  const questionIds = answers.map(a => a.wordId).filter(Boolean);
  const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(',');
  const allQuestions = questionIds.length > 0
    ? await getAll(`SELECT * FROM knowledge_questions WHERE id IN (${placeholders}) AND (academy_id = ? OR academy_id = 0)`, [...questionIds, req.academyId])
    : [];
  const questionMap = {};
  for (const q of allQuestions) questionMap[q.id] = q;

  // 배치 INSERT용 데이터 준비
  const resultRows = [];

  for (const ans of answers) {
    const q = questionMap[ans.wordId];
    if (!q) continue;

    const isCorrect = ans.selectedAnswer === q.correct_answer;

    resultRows.push(student.id, q.id, isCorrect ? 1 : 0, req.academyId);

    if (isCorrect) {
      correctCount++;
      streak++;
      let xp = q.difficulty === 3 ? 12 : q.difficulty === 2 ? 8 : 5;
      if (streak >= 5) xp += 3;
      totalXpEarned += xp;
    } else {
      streak = 0;
      let penalty = q.difficulty === 3 ? -5 : q.difficulty === 2 ? -3 : -2;
      totalXpEarned += penalty;
    }

    details.push({
      wordId: q.id,
      correct: isCorrect,
      correctAnswer: q.correct_answer,
      explanation: q.explanation || null
    });
  }

  // 문제별 결과 일괄 기록
  if (resultRows.length > 0) {
    const rowCount = resultRows.length / 4;
    const insertPlaceholders = [];
    for (let i = 0; i < rowCount; i++) {
      const base = i * 4;
      insertPlaceholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    }
    try {
      await runQuery(
        `INSERT INTO knowledge_question_results (student_id, question_id, is_correct, academy_id) VALUES ${insertPlaceholders.join(', ')}`,
        resultRows
      );
    } catch (e) { /* 무시 */ }
  }

  if (correctCount === answers.length && answers.length >= 5) {
    totalXpEarned = Math.floor(totalXpEarned * 1.5);
  }
  if (totalXpEarned < 0) totalXpEarned = 0;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const oldLevel = getLevelInfo(sc.xp).level;
  const newLevel = getLevelInfo(sc.xp + totalXpEarned).level;

  // Atomic XP/points update — prevents race condition (Critical #7)
  await runQuery('UPDATE student_characters SET xp = GREATEST(xp + ?, 0), points = GREATEST(points + ?, 0), level = ? WHERE student_id = ? AND academy_id = ?',
    [totalXpEarned, totalXpEarned, newLevel, student.id, req.academyId]);

  // logId가 있으면 start 시 만든 row를 UPDATE, 없으면 INSERT (하위호환)
  if (logId) {
    await runQuery(
      "UPDATE knowledge_game_logs SET total_questions = ?, correct_count = ?, xp_earned = ? WHERE id = ? AND student_id = ? AND academy_id = ?",
      [answers.length, correctCount, totalXpEarned, logId, student.id, req.academyId]
    );
  } else {
    await runInsert(
      "INSERT INTO knowledge_game_logs (student_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, ?, ?, ?)",
      [student.id, answers.length, correctCount, totalXpEarned, req.academyId]
    );
  }

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'knowledge_quiz', ?, ?)",
    [student.id, totalXpEarned, `지식 퀴즈 ${correctCount}/${answers.length}`, req.academyId]);

  await checkAndGrantTitles(student.id, req.academyId);

  rankingCache.invalidate();
  res.json({ correct: correctCount, total: answers.length, xpEarned: totalXpEarned, details, leveledUp: newLevel > oldLevel, newLevel });
});

// 지식 퀴즈 오늘 풀이 수
router.get('/knowledge/today-count', authenticateToken, async (req, res) => {
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.json({ count: 0 });
  const today = getTodayKST();
  const result = await getOne(
    "SELECT COALESCE(SUM(total_questions), 0) as cnt FROM knowledge_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, req.academyId]
  );
  res.json({ count: result ? result.cnt : 0 });
});

// ============================================================
// ========== 비문학 독해 (Reading Quiz) ==========
// ============================================================

router.get('/reading/categories', authenticateToken, async (req, res) => {
  const categories = await getAll(
    `SELECT rp.category, COUNT(DISTINCT rp.id) as passage_count, COUNT(rq.id) as question_count
     FROM reading_passages rp
     LEFT JOIN reading_questions rq ON rq.passage_id = rp.id
     WHERE (rp.academy_id = ? OR rp.academy_id = 0)
     GROUP BY rp.category`,
    [req.academyId]
  );
  res.json(categories);
});

router.get('/reading/start', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  // Daily limit race condition lock (Critical #8)
  if (!acquireQuizLock(`reading_${student.id}`)) {
    return res.status(429).json({ error: '퀴즈 시작 처리 중입니다. 잠시 후 다시 시도하세요.' });
  }

  try {

  const limitSetting = await getOne("SELECT value FROM game_settings WHERE key = 'daily_reading_limit' AND academy_id = ?", [req.academyId]);
  const dailyLimit = limitSetting ? parseInt(limitSetting.value) || 5 : 5;

  const today = getTodayKST();
  const todayResult = await getOne(
    "SELECT COUNT(DISTINCT passage_id) as cnt FROM reading_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, req.academyId]
  );
  const todayCount = todayResult ? todayResult.cnt : 0;
  if (todayCount >= dailyLimit) {
    return res.status(400).json({ error: `오늘의 비문학 제한(${dailyLimit}지문)에 도달했습니다.` });
  }

  const category = req.query.category;

  // 모든 문제를 맞힌 지문 제외
  const perfectRows = await getAll(
    `SELECT DISTINCT rgl.passage_id FROM reading_game_logs rgl
     WHERE rgl.student_id = ? AND rgl.correct_count = rgl.total_questions AND rgl.total_questions > 0 AND rgl.academy_id = ?`,
    [student.id, req.academyId]
  );
  const perfectPassages = perfectRows.map(r => r.passage_id);

  // 최근 7일 이내 틀린 지문 제외
  const recentWrongRows3 = await getAll(
    `SELECT DISTINCT rgl.passage_id FROM reading_game_logs rgl
     WHERE rgl.student_id = ? AND rgl.correct_count < rgl.total_questions
     AND rgl.played_at > datetime('now', '-7 days') AND rgl.academy_id = ?`,
    [student.id, req.academyId]
  );
  const recentWrongPassages = recentWrongRows3.map(r => r.passage_id);

  // 오늘 이미 시작한(미제출 포함) 지문 제외 → 같은 지문 반복 방지
  const pendingRows = await getAll(
    "SELECT passage_id FROM reading_game_logs WHERE student_id = ? AND total_questions = 0 AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, req.academyId]
  );
  const pendingPassages = pendingRows.map(r => r.passage_id);

  const excludeIds = [...new Set([...perfectPassages, ...recentWrongPassages, ...pendingPassages])];
  const excludePlaceholder = excludeIds.length > 0 ? `AND rp.id NOT IN (${excludeIds.join(',')})` : '';

  // 카테고리 파라미터 무시하고 랜덤 선택 (어뷰징 방지)
  const passage = await getOne(`SELECT * FROM reading_passages rp WHERE (rp.academy_id = ? OR rp.academy_id = 0) ${excludePlaceholder} ORDER BY RANDOM() LIMIT 1`, [req.academyId]);

  if (!passage) {
    return res.status(400).json({ error: '출제할 수 있는 지문이 없습니다. 모든 지문을 완료했거나, 잠시 후 다시 시도해주세요.' });
  }

  const questions = await getAll('SELECT * FROM reading_questions WHERE passage_id = ? AND (academy_id = ? OR academy_id = 0)', [passage.id, req.academyId]);

  const formattedQuestions = questions.map(q => {
    let wrongAnswers;
    try { wrongAnswers = JSON.parse(q.wrong_answers); } catch { wrongAnswers = []; }
    const wrongSlice = wrongAnswers.slice(0, 3);
    const correctIdx = Math.floor(Math.random() * (wrongSlice.length + 1));
    const options = [...wrongSlice];
    options.splice(correctIdx, 0, q.correct_answer);
    return {
      id: q.id,
      type: q.question_type,
      questionText: q.question_text,
      options
    };
  });

  // 시작 즉시 log 삽입 → 오늘 횟수 즉시 차감 (어뷰징 방지)
  const logId = await runInsert(
    "INSERT INTO reading_game_logs (student_id, passage_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, 0, 0, 0, ?)",
    [student.id, passage.id, req.academyId]
  );

  res.json({
    passage: {
      id: passage.id,
      title: passage.title,
      content: passage.content,
      category: passage.category,
      difficulty: passage.difficulty
    },
    questions: formattedQuestions,
    logId
  });

  } finally {
    releaseQuizLock(`reading_${student.id}`);
  }
});

router.post('/reading/submit', authenticateToken, async (req, res) => {
  const student = await getGameStudent(req);
  if (!student) return res.status(403).json({ error: '게임은 학생만 참여할 수 있습니다.' });

  const { passageId, answers, logId } = req.body;
  if (!passageId || !answers || !Array.isArray(answers)) return res.status(400).json({ error: '답안을 제출해주세요.' });

  const passage = await getOne('SELECT * FROM reading_passages WHERE id = ? AND (academy_id = ? OR academy_id = 0)', [passageId, req.academyId]);
  if (!passage) return res.status(404).json({ error: '지문을 찾을 수 없습니다.' });

  let totalXpEarned = 0;
  let correctCount = 0;
  const details = [];
  const diff = passage.difficulty;

  // N+1 수정: 한 번에 모든 문제 로드
  const allQuestions = await getAll('SELECT * FROM reading_questions WHERE passage_id = ? AND (academy_id = ? OR academy_id = 0)', [passageId, req.academyId]);
  const questionMap = new Map(allQuestions.map(q => [q.id, q]));

  for (const ans of answers) {
    const q = questionMap.get(ans.questionId);
    if (!q) continue;

    const isCorrect = ans.selectedAnswer === q.correct_answer;

    await runInsert(
      'INSERT INTO reading_question_results (student_id, question_id, is_correct, academy_id) VALUES (?, ?, ?, ?)',
      [student.id, q.id, isCorrect ? 1 : 0, req.academyId]
    );

    if (isCorrect) {
      correctCount++;
      let xp = diff === 3 ? 20 : diff === 2 ? 15 : 10;
      totalXpEarned += xp;
    } else {
      let penalty = diff === 3 ? -5 : diff === 2 ? -3 : -2;
      totalXpEarned += penalty;
    }

    details.push({
      questionId: q.id,
      correct: isCorrect,
      correctAnswer: q.correct_answer,
      explanation: q.explanation || null
    });
  }

  // 전문 맞추면 보너스
  if (correctCount === answers.length && answers.length >= 2) {
    totalXpEarned = Math.floor(totalXpEarned * 1.5);
  }
  if (totalXpEarned < 0) totalXpEarned = 0;

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, req.academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보가 없습니다.' });

  const oldLevel = getLevelInfo(sc.xp).level;
  const newLevel = getLevelInfo(sc.xp + totalXpEarned).level;

  // Atomic XP/points update — prevents race condition (Critical #7)
  await runQuery('UPDATE student_characters SET xp = GREATEST(xp + ?, 0), points = GREATEST(points + ?, 0), level = ? WHERE student_id = ? AND academy_id = ?',
    [totalXpEarned, totalXpEarned, newLevel, student.id, req.academyId]);

  // start 시점에 삽입된 log를 UPDATE (logId 없으면 INSERT 폴백)
  if (logId) {
    await runQuery(
      "UPDATE reading_game_logs SET total_questions=?, correct_count=?, xp_earned=? WHERE id=? AND academy_id = ?",
      [answers.length, correctCount, totalXpEarned, logId, req.academyId]
    );
  } else {
    await runInsert(
      "INSERT INTO reading_game_logs (student_id, passage_id, total_questions, correct_count, xp_earned, academy_id) VALUES (?, ?, ?, ?, ?, ?)",
      [student.id, passageId, answers.length, correctCount, totalXpEarned, req.academyId]
    );
  }

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'reading_quiz', ?, ?)",
    [student.id, totalXpEarned, `비문학 독해 ${correctCount}/${answers.length}`, req.academyId]);

  await checkAndGrantTitles(student.id, req.academyId);

  rankingCache.invalidate();
  res.json({ correct: correctCount, total: answers.length, xpEarned: totalXpEarned, details, leveledUp: newLevel > oldLevel, newLevel, passageTitle: passage.title });
});

// 비문학 오늘 풀이 수
router.get('/reading/today-count', authenticateToken, async (req, res) => {
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.json({ count: 0 });
  const today = getTodayKST();
  const result = await getOne(
    "SELECT COUNT(DISTINCT passage_id) as cnt FROM reading_game_logs WHERE student_id = ? AND date(played_at) = date(?) AND academy_id = ?",
    [student.id, today, req.academyId]
  );
  res.json({ count: result ? result.cnt : 0 });
});

module.exports = router;
