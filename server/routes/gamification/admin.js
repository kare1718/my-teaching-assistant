const express = require('express');
const router = express.Router();
const { runQuery, runInsert, getOne, getAll, runBatch } = require('../../db/database');
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../../middleware/auth');
const { getLevelInfo, checkAndGrantTitles, generateCode, rankingCache, callGemini, parseGeminiJSON } = require('./utils');

// === Codes Management ===

// 코드 목록
router.get('/codes', authenticateToken, requireAdmin, async (req, res) => {
  const codes = await getAll('SELECT * FROM redeem_codes WHERE academy_id = ? ORDER BY created_at DESC', [req.academyId]);
  res.json(codes);
});

// 코드 ���성
router.post('/codes', authenticateToken, requireAdmin, async (req, res) => {
  let { code, codeType, xpAmount, description, maxUses, expiresAt } = req.body;
  if (!code) code = generateCode();

  const id = await runInsert(
    'INSERT INTO redeem_codes (code, code_type, xp_amount, description, max_uses, expires_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [code, codeType || 'general', xpAmount || 0, description || '', maxUses || null, expiresAt || null, req.academyId]
  );
  res.json({ message: '코드가 생성되었습니다.', id, code });
});

// 코드 수정
router.put('/codes/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { code, codeType, xpAmount, description, maxUses, expiresAt, isActive } = req.body;
  const fields = [];
  const values = [];

  if (code !== undefined) { fields.push('code = ?'); values.push(code); }
  if (codeType !== undefined) { fields.push('code_type = ?'); values.push(codeType); }
  if (xpAmount !== undefined) { fields.push('xp_amount = ?'); values.push(xpAmount); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (maxUses !== undefined) { fields.push('max_uses = ?'); values.push(maxUses); }
  if (expiresAt !== undefined) { fields.push('expires_at = ?'); values.push(expiresAt); }
  if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive); }

  if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니��.' });

  values.push(parseInt(req.params.id));
  values.push(req.academyId);
  await runQuery(`UPDATE redeem_codes SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, values);
  res.json({ message: '코드��� 수정되었습니다.' });
});

// 코드 삭제
router.delete('/codes/:id', authenticateToken, requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM redeem_codes WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '코드가 삭제되었습니다.' });
});

// 코드 일괄 생성
router.post('/codes/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const { count, codeType, xpAmount, description, maxUses, expiresAt } = req.body;
  if (!count || count < 1) return res.status(400).json({ error: '생성 수량을 입력해주세요.' });

  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    const id = await runInsert(
      'INSERT INTO redeem_codes (code, code_type, xp_amount, description, max_uses, expires_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, codeType || 'general', xpAmount || 0, description || '', maxUses || null, expiresAt || null, req.academyId]
    );
    codes.push({ id, code });
  }
  res.json({ message: `${count}개의 코드��� 생성되었습니다.`, codes });
});

// === XP Management ===

// XP 현황
router.get('/xp-overview', authenticateToken, requireAdmin, async (req, res) => {
  const overview = await getAll(
    `SELECT sc.*, u.name, s.school, s.grade, c.emoji, c.name as char_name
     FROM student_characters sc
     JOIN students s ON sc.student_id = s.id
     JOIN users u ON s.user_id = u.id
     LEFT JOIN characters c ON sc.character_id = c.id
     WHERE sc.academy_id = ?
     ORDER BY sc.xp DESC`,
    [req.academyId]
  );
  res.json(overview);
});

// XP 조정
router.put('/adjust-xp', authenticateToken, requireAdmin, async (req, res) => {
  const { studentId, amount, description } = req.body;
  if (!studentId || amount === undefined) return res.status(400).json({ error: '학생 ID와 수량을 입력해주세요.' });

  const sc = await getOne('SELECT * FROM student_characters WHERE student_id = ? AND academy_id = ?', [studentId, req.academyId]);
  if (!sc) return res.status(404).json({ error: '캐릭터 정보를 찾을 수 없���니다.' });

  const newXp = sc.xp + amount;
  let newPoints = sc.points + amount;
  if (newPoints < 0) newPoints = 0;
  const newLevel = getLevelInfo(newXp).level;

  await runQuery('UPDATE student_characters SET xp = ?, points = ?, level = ? WHERE student_id = ? AND academy_id = ?',
    [newXp, newPoints, newLevel, studentId, req.academyId]);

  await runInsert("INSERT INTO xp_logs (student_id, amount, source, description, academy_id) VALUES (?, ?, 'admin_adjust', ?, ?)",
    [studentId, amount, description || '관리자 조정', req.academyId]);

  if (amount > 0) await checkAndGrantTitles(studentId, req.academyId);

  rankingCache.invalidate();
  const updated = await getOne(
    `SELECT sc.*, c.name as char_name, c.emoji
     FROM student_characters sc
     LEFT JOIN characters c ON sc.character_id = c.id
     WHERE sc.student_id = ? AND sc.academy_id = ?`,
    [studentId, req.academyId]
  );
  res.json(updated);
});

// === Titles Management ===

router.get('/titles', authenticateToken, requireAdmin, async (req, res) => {
  const titles = await getAll('SELECT * FROM titles WHERE (academy_id = ? OR academy_id = 0)', [req.academyId]);
  res.json(titles);
});

router.post('/titles', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, conditionType, conditionValue, icon } = req.body;
  const id = await runInsert(
    'INSERT INTO titles (name, description, condition_type, condition_value, icon, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
    [name, description || '', conditionType || 'manual', conditionValue || 0, icon || '', req.academyId]
  );
  res.json({ message: '���호가 생성되었습니다.', id });
});

router.put('/titles/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, conditionType, conditionValue, icon } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (conditionType !== undefined) { fields.push('condition_type = ?'); values.push(conditionType); }
  if (conditionValue !== undefined) { fields.push('condition_value = ?'); values.push(conditionValue); }
  if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }

  if (fields.length === 0) return res.status(400).json({ error: '수정할 항���이 없습니다.' });

  values.push(parseInt(req.params.id));
  values.push(req.academyId);
  await runQuery(`UPDATE titles SET ${fields.join(', ')} WHERE id = ? AND (academy_id = ? OR academy_id = 0)`, values);
  res.json({ message: '칭호가 수정되었습니다.' });
});

router.delete('/titles/:id', authenticateToken, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await runQuery('DELETE FROM student_titles WHERE title_id = ? AND academy_id = ?', [id, req.academyId]);
  await runQuery('DELETE FROM titles WHERE id = ? AND (academy_id = ? OR academy_id = 0)', [id, req.academyId]);
  res.json({ message: '칭호가 삭제되었습니다.' });
});

router.post('/titles/grant', authenticateToken, requireAdmin, async (req, res) => {
  const { studentId, titleId } = req.body;
  // 중복 체크
  const already = await getOne('SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?', [studentId, titleId, req.academyId]);
  if (already) return res.status(400).json({ error: '이미 부여된 칭호입니다.' });

  await runInsert('INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)', [studentId, titleId, req.academyId]);

  // 알림
  const user = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [studentId, req.academyId]);
  const title = await getOne('SELECT name FROM titles WHERE id = ? AND (academy_id = ? OR academy_id = 0)', [titleId, req.academyId]);
  if (user && title) {
    await runInsert('INSERT INTO notifications (user_id, type, title, message, academy_id) VALUES (?, ?, ?, ?, ?)',
      [user.user_id, 'title', '🎖️ 새 칭호 획득!', `"${title.name}" 칭호를 획득했습���다!`, req.academyId]);
  }

  res.json({ message: '칭호가 부여되었습니다.' });
});

// 칭호 부여 취소
router.post('/titles/revoke', authenticateToken, requireAdmin, async (req, res) => {
  const { studentId, titleId } = req.body;
  await runQuery('DELETE FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?', [studentId, titleId, req.academyId]);
  res.json({ message: '칭호가 회수되었습니다.' });
});

// 특정 칭호를 보유한 학생 목록
router.get('/titles/:titleId/students', authenticateToken, requireAdmin, async (req, res) => {
  const students = await getAll(
    `SELECT st.id as grant_id, st.earned_at, s.id as student_id, u.name, s.school, s.grade
     FROM student_titles st
     JOIN students s ON st.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE st.title_id = ? AND st.academy_id = ?
     ORDER BY u.name`,
    [parseInt(req.params.titleId), req.academyId]
  );
  res.json(students);
});

// === Vocab Management ===

router.get('/vocab', authenticateToken, requireAdmin, async (req, res) => {
  const { category } = req.query;
  let words;
  if (category) {
    words = await getAll('SELECT * FROM vocab_words WHERE category = ? AND (academy_id = ? OR academy_id = 0)', [category, req.academyId]);
  } else {
    words = await getAll('SELECT * FROM vocab_words WHERE (academy_id = ? OR academy_id = 0)', [req.academyId]);
  }
  res.json(words);
});

router.post('/vocab', authenticateToken, requireAdmin, async (req, res) => {
  const { category, questionText, correctAnswer, wrongAnswers, difficulty, explanation } = req.body;
  const id = await runInsert(
    'INSERT INTO vocab_words (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [category, questionText, correctAnswer, JSON.stringify(wrongAnswers), difficulty || 1, explanation || '', req.academyId]
  );
  res.json({ message: '단어가 추가되었습니다.', id });
});

router.put('/vocab/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { category, questionText, correctAnswer, wrongAnswers, difficulty, explanation } = req.body;
  const fields = [];
  const values = [];

  if (category !== undefined) { fields.push('category = ?'); values.push(category); }
  if (questionText !== undefined) { fields.push('question_text = ?'); values.push(questionText); }
  if (correctAnswer !== undefined) { fields.push('correct_answer = ?'); values.push(correctAnswer); }
  if (wrongAnswers !== undefined) { fields.push('wrong_answers = ?'); values.push(JSON.stringify(wrongAnswers)); }
  if (difficulty !== undefined) { fields.push('difficulty = ?'); values.push(difficulty); }
  if (explanation !== undefined) { fields.push('explanation = ?'); values.push(explanation); }

  if (fields.length === 0) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

  values.push(parseInt(req.params.id));
  values.push(req.academyId);
  await runQuery(`UPDATE vocab_words SET ${fields.join(', ')} WHERE id = ? AND (academy_id = ? OR academy_id = 0)`, values);
  res.json({ message: '단어가 수정되었습니다.' });
});

router.delete('/vocab/:id', authenticateToken, requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM vocab_words WHERE id = ? AND (academy_id = ? OR academy_id = 0)', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '단어가 삭제되었습니다.' });
});

router.post('/vocab/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const { words } = req.body;
  if (!words || !Array.isArray(words)) return res.status(400).json({ error: '단어 목록을 입력해��세요.' });

  const ids = [];
  for (const w of words) {
    const id = await runInsert(
      'INSERT INTO vocab_words (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [w.category, w.questionText, w.correctAnswer, JSON.stringify(w.wrongAnswers || []), w.difficulty || 1, w.explanation || '', req.academyId]
    );
    ids.push(id);
  }
  res.json({ message: `${words.length}개의 단어가 추가되었습니���.`, ids });
});

// 어휘 데이터 리시드 (시드 문제만 교체, 직접 추가한 문제 보존)
router.post('/vocab/reseed', authenticateToken, requireAdmin, async (req, res) => {
  try {
    delete require.cache[require.resolve('../../db/vocabSeed')];
    const vocabData = require('../../db/vocabSeed');

    const seedQuestions = new Set(vocabData.map(([, q]) => q));
    const existing = await getAll('SELECT id, question_text FROM vocab_words WHERE (academy_id = ? OR academy_id = 0)', [req.academyId]);

    await runBatch(async ({ run }) => {
      // 시드 문제만 삭제 (직접 추가한 문제는 보존)
      let deletedCount = 0;
      for (const row of existing) {
        if (seedQuestions.has(row.question_text)) {
          await run('DELETE FROM vocab_words WHERE id = ? AND (academy_id = ? OR academy_id = 0)', [row.id, req.academyId]);
          deletedCount++;
        }
      }
      // 시드 데이터 다시 삽입
      for (const [cat, q, correct, wrong, diff, exp] of vocabData) {
        await run('INSERT INTO vocab_words (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [cat, q, correct, wrong, diff, exp, req.academyId]);
      }
    });

    const manualCount = existing.length - existing.filter(r => seedQuestions.has(r.question_text)).length;
    res.json({ message: `시드 ${vocabData.length}개 새로고침, 직접 추가 ${manualCount}개 보존됨`, count: vocabData.length + manualCount });
  } catch (e) {
    res.status(500).json({ error: '어휘 리시드 실패: ' + (e.message || String(e)) });
  }
});

// 지식 퀴즈 전체 리시드 (기존 문제 모두 교���)
router.post('/knowledge/reseed', authenticateToken, requireAdmin, async (req, res) => {
  try {
    delete require.cache[require.resolve('../../db/knowledgeQuizSeed')];
    const kqData = require('../../db/knowledgeQuizSeed');
    await runBatch(async ({ run }) => {
      await run('DELETE FROM knowledge_questions WHERE (academy_id = ? OR academy_id = 0)', [req.academyId]);
      for (const [cat, q, correct, wrong, diff, exp] of kqData) {
        await run('INSERT INTO knowledge_questions (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [cat, q, correct, wrong, diff, exp, req.academyId]);
      }
    });
    res.json({ message: `지식 퀴즈 ${kqData.length}개 문제로 리시드 완료`, count: kqData.length });
  } catch (e) {
    res.status(500).json({ error: '지�� 퀴즈 리시드 실패: ' + (e.message || String(e)) });
  }
});

router.post('/reading/reseed', authenticateToken, requireAdmin, async (req, res) => {
  try {
    delete require.cache[require.resolve('../../db/readingPassageSeed')];
    const rpData = require('../../db/readingPassageSeed');

    // 트랜잭션 없이 먼저 삭제
    await runQuery('DELETE FROM reading_questions WHERE (academy_id = ? OR academy_id = 0)', [req.academyId]);
    await runQuery('DELETE FROM reading_passages WHERE (academy_id = ? OR academy_id = 0)', [req.academyId]);

    let passageCount = 0, questionCount = 0;
    // 배치로 삽입 (saveDb 한 번만 호출)
    await runBatch(async ({ run }) => {
      for (const p of rpData) {
        await run('INSERT INTO reading_passages (category, title, content, difficulty, source_info, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
          [p.category, p.title, p.content, p.difficulty || 2, p.source_info || '', req.academyId]);
        passageCount++;
        // runBatch 안에서는 last_insert_rowid 직접 사용
      }
    });

    // passage ID 매핑 (title 기준)
    const allPassages = await getAll('SELECT id, title FROM reading_passages WHERE (academy_id = ? OR academy_id = 0)', [req.academyId]);
    const titleToId = {};
    for (const p of allPassages) { titleToId[p.title] = p.id; }

    await runBatch(async ({ run }) => {
      for (const p of rpData) {
        const pid = titleToId[p.title];
        if (!pid) return;
        for (const q of (p.questions || [])) {
          await run('INSERT INTO reading_questions (passage_id, question_type, question_text, correct_answer, wrong_answers, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [pid, q.type || '내용일치', q.text, q.correct, JSON.stringify(q.wrongs), q.explanation || '', req.academyId]);
          questionCount++;
        }
      }
    });

    res.json({ message: `비문학 독해 ${passageCount}개 지문, ${questionCount}개 문제로 리시드 완료`, passageCount, questionCount });
  } catch (e) {
    res.status(500).json({ error: '비문학 리시드 실패: ' + (e.message || String(e)) });
  }
});

// === AI 문제 생성 ===

// 지식 ��즈 AI 생성 (카테고리 → Gemini → DB INSERT)
router.post('/knowledge/generate-ai', authenticateToken, requireAdmin, async (req, res) => {
  const { category, count = 10 } = req.body;
  if (!category) return res.status(400).json({ error: '카테고리를 선택해주세요.' });
  const safeCount = Math.min(Math.max(parseInt(count) || 10, 5), 20);

  const prompt = `너는 대한민국 고등학생을 위한 배경지식 퀴즈 출제 전문가야.
카테고리: ${category}

이 카테고리에서 고등학생 수준의 배경지식 퀴즈 문제를 정확히 ${safeCount}개 만들어줘.

출제 기준:
1. 수능/내신에 도움이 되는 핵심 개념과 지식
2. 각 문제는 서로 다른 세부 주제에서 출제 (중복 없이)
3. 문제는 4지선다 형식이며 하나의 정답, 세 개의 오답
4. 오답은 그럴듯하지만 명확히 틀린 선택지
5. 난이도는 1(쉬움)~3(어려움) 중 하나
6. 해설은 핵심 내용 위주로 간결하게 (2~3문장)

반드시 아래 JSON 배열 형식으로만 응답해. 다른 텍스트 없이 JSON만:
[
  {
    "question_text": "문제 내용 (선택지 포함 or 설명형)",
    "correct_answer": "정답",
    "wrong_answers": ["오답1", "오답2", "오답3"],
    "difficulty": 2,
    "explanation": "해설 내용"
  }
]`;

  try {
    const text = await callGemini(prompt);
    const parsed = parseGeminiJSON(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return res.status(500).json({ error: '문제 생성에 실패했습니다. 다시 시도해주세요.' });
    }

    let inserted = 0;
    for (const q of parsed) {
      if (!q.question_text || !q.correct_answer || !Array.isArray(q.wrong_answers)) continue;
      await runQuery(
        'INSERT INTO knowledge_questions (category, question_text, correct_answer, wrong_answers, difficulty, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [category, q.question_text, q.correct_answer, JSON.stringify(q.wrong_answers), q.difficulty || 2, q.explanation || '', req.academyId]
      );
      inserted++;
    }

    res.json({ message: `${category} 카테고리에 ${inserted}개 문제가 추가되었습니다.`, count: inserted });
  } catch (e) {
    console.error('[AI 지식퀴즈 생성]', e.message);
    res.status(500).json({ error: e.message || '문제 생성 중 ���류가 발생했습니다.' });
  }
});

// 비문학 AI 생성 (카테고리 → Gemini → DB INSERT)
router.post('/reading/generate-ai', authenticateToken, requireAdmin, async (req, res) => {
  const { category, count = 3 } = req.body;
  if (!category) return res.status(400).json({ error: '카테고리를 선택해주세요.' });
  const safeCount = Math.min(Math.max(parseInt(count) || 3, 1), 5);

  const prompt = `너는 대한민국 수능 국어 비문학(독서) 출제 전문가야.
카테고리: ${category}

이 카테고리에서 고등학생 수준의 비문학 지문과 독해 문제를 ${safeCount}세트 만들어줘.
각 세트는 지문 1개 + 문제 3개로 구성돼.

출제 기준:
1. 지문: 수능 비문학 스타일, 500~800자 분량, 핵심 개념을 명확히 담을 것
2. 각 세트는 서로 다른 세부 ��제에서 출제
3. 문제 유형: 내용일치(반드시 1개), 추론(1개), 어휘/구조(1개) 혼합
4. 문제는 4지선다 (정답 1개 + 오답 3개)
5. 난이도는 1~3 중 하나
6. 해설은 지문 근거를 명시

반드시 아래 JSON ��열 형식으로만 응답해:
[
  {
    "title": "지문 제목",
    "category": "${category}",
    "difficulty": 2,
    "content": "지문 내용 (500~800자)",
    "questions": [
      {
        "type": "내용일치",
        "text": "문제 내용",
        "correct": "정답",
        "wrongs": ["오답1", "오답2", "오답3"],
        "explanation": "해설"
      }
    ]
  }
]`;

  try {
    const text = await callGemini(prompt, 60000);
    const parsed = parseGeminiJSON(text);
    const passages = Array.isArray(parsed) ? parsed : (parsed?.passages || []);
    if (passages.length === 0) {
      return res.status(500).json({ error: '지문 생성에 실패했습니다. 다시 ��도해주세요.' });
    }

    let passageCount = 0, questionCount = 0;
    for (const p of passages) {
      if (!p.title || !p.content) continue;
      const pid = await runInsert(
        'INSERT INTO reading_passages (category, title, content, difficulty, source_info, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
        [p.category || category, p.title, p.content, p.difficulty || 2, 'AI 생성', req.academyId]
      );
      passageCount++;
      for (const q of (p.questions || [])) {
        if (!q.text || !q.correct) continue;
        await runQuery(
          'INSERT INTO reading_questions (passage_id, question_type, question_text, correct_answer, wrong_answers, explanation, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [pid, q.type || '내용일치', q.text, q.correct, JSON.stringify(q.wrongs || []), q.explanation || '', req.academyId]
        );
        questionCount++;
      }
    }

    res.json({ message: `${category} 카테고리에 ${passageCount}개 지���, ${questionCount}개 문제가 ���가되었습니다.`, passageCount, questionCount });
  } catch (e) {
    console.error('[AI 비문학 생성]', e.message);
    res.status(500).json({ error: e.message || '지문 생�� 중 오류가 발생했습니다.' });
  }
});

// === 학생 시드 데이터 ===
router.post('/seed-students', authenticateToken, requireAdminOnly, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    delete require.cache[require.resolve('../../db/studentSeed')];
    const studentData = require('../../db/studentSeed');
    const hashedPassword = bcrypt.hashSync('1234', 10);

    let created = 0, skipped = 0;
    for (const [username, pw, name, school, grade, parentName, parentPhone] of studentData) {
      const existing = await getOne('SELECT id FROM users WHERE username = ? AND academy_id = ?', [username, req.academyId]);
      if (existing) { skipped++; continue; }

      const userId = await runInsert(
        'INSERT INTO users (username, password, name, role, approved, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, name, 'student', 1, req.academyId]
      );
      await runInsert(
        'INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, school, grade, parentName, parentPhone, req.academyId]
      );
      created++;
    }

    res.json({ message: `학생 시드 완료! ${created}명 생성, ${skipped}명 이미 존재`, created, skipped });
  } catch (e) {
    res.status(500).json({ error: '학생 시드 실패: ' + e.message });
  }
});

// === 상점/칭호/캐릭터 리셋 (시드 데���터 다시 적용) ===
router.post('/reseed-game-config', authenticateToken, requireAdminOnly, async (req, res) => {
  try {
    // 상점 아이템 리셋
    await runQuery('DELETE FROM shop_items WHERE academy_id = ?', [req.academyId]);
    const shopData = [
      ['두쫀쿠 교환권', '달콤한 두쫀쿠 1개', '🍪', 2000, null, 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=300&fit=crop'],
      ['꽈배기 교환권', '맛있는 꽈배기 1개', '🥨', 1500, null, 'https://images.unsplash.com/photo-1558326567-98ae2405596b?w=400&h=300&fit=crop'],
      ['메가커피 5000원권', '메가커피 5,000원 음료 교환권', '☕', 4000, null, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop'],
      ['바나프레소 5000원권', '바나프레소 5,000원 음료 교환권', '🥤', 4000, null, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop'],
      ['세븐일레븐 3000원권', '세븐일레븐 편의점 3,000원 이용권', '🏪', 5000, null, 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=300&fit=crop'],
      ['씨유 3000원권', 'CU 편의점 3,000원 이용권', '🏬', 5000, null, 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=300&fit=crop'],
      ['치킨 교환권', '치킨 1마리 교환권', '🍗', 15000, 3, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=300&fit=crop'],
      ['피자 교환권', '피자 1판 교환권', '🍕', 20000, 2, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop'],
      ['과제 면제권', '과제 1회 면제', '📋', 8000, 5, ''],
      ['선생님 커피 심부름권', '선생님한테 커피 사오라고 시키기', '☕', 2000, null, ''],
      ['선생님이랑 식사데이트', '선생님과 함께하는 특별한 식사!', '🍽️', 30000, 2, ''],
    ];
    for (const [name, desc, icon, price, stock, imageUrl] of shopData) {
      await runQuery('INSERT INTO shop_items (name, description, icon, price, stock, image_url, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, desc, icon, price, stock, imageUrl || '', req.academyId]);
    }

    // 칭��� 리셋
    await runQuery('DELETE FROM titles WHERE (academy_id = ? OR academy_id = 0)', [req.academyId]);
    // [name, description, condition_type, condition_value, icon, is_hidden]
    const titles = [
      // 일반 칭호 - XP
      ['천리길도 한걸음부터', '첫 퀴즈 도전!', 'xp_total', 100, '👣', 0],
      ['국어 근성러', 'XP 1,000 달성', 'xp_total', 1000, '💪', 0],
      ['포인트 수집가', 'XP 3,000 달성', 'xp_total', 3000, '💰', 0],
      ['경험의 대가', 'XP 10,000 달��', 'xp_total', 10000, '���', 0],
      ['포인트 부자', 'XP 30,000 달성', 'xp_total', 30000, '🤑', 0],
      ['만렙 도전자', 'XP 50,000 달성', 'xp_total', 50000, '🔥', 0],
      // 일반 칭호 - 퀴즈
      ['어휘 새싹', '어휘 퀴즈 50문제 정답', 'quiz_count', 50, '🌱', 0],
      ['문제은행 털이범', '퀴즈 100문제 정답', 'quiz_count', 100, '🏦', 0],
      ['어휘왕', '어휘 퀴즈 200문제 정답', 'quiz_count', 200, '👑', 0],
      ['퀴즈 광풍', '퀴즈 500문제 정���', 'quiz_count', 500, '🌪️', 0],
      ['퀴즈의 신', '퀴즈 1000문제 정답', 'quiz_count', 1000, '⚡', 0],
      // 일반 칭호 - 코드
      ['코드 헌터', '코드 10회 입력', 'code_count', 10, '🔎', 0],
      ['출석의 달인', '코드 30회 입력', 'code_count', 30, '���', 0],
      ['꾸준함의 미학', '코드 50회 입력', 'code_count', 50, '🏃', 0],
      ['코드 마니아', '코드 100회 입력', 'code_count', 100, '🎯', 0],
      // 일반 칭호 - 레벨
      ['학도의 길', '레벨 10 달성', 'level', 10, '📘', 0],
      ['국어 덕후', '레벨 20 달성', 'level', 20, '🤓', 0],
      ['고수의 경지', '레벨 30 달성', 'level', 30, '🏆', 0],
      ['전설의 시작', '레벨 40 달성', 'level', 40, '🌟', 0],
      ['국어의 신', '레벨 50 달성', 'level', 50, '🌈', 0],
      ['초월자', '레벨 60 달성', 'level', 60, '🌀', 0],
      ['지배자', '레벨 70 달성', 'level', 70, '🦁', 0],
      ['인간 국보', '레벨 80 달��', 'level', 80, '🏛️', 0],
      ['세종대왕급', '레벨 90 달성', 'level', 90, '👑', 0],
      ['선생님과 동급', '레벨 100 달성', 'level', 100, '🌈', 0],
      // 히든 칭호
      ['초월자', '???', 'xp_total', 100000, '🌀', 1],
      ['선생님의 비밀병기', '???', 'level', 45, '🗡️', 1],
      ['퀴즈 폐인', '???', 'quiz_count', 2000, '🧟', 1],
      ['코드 수집광', '???', 'code_count', 200, '🗃️', 1],
      ['전설은 아니고 레전드', '???', 'level', 35, '����', 1],
      ['뭔가 대단한 사람', '???', 'xp_total', 7777, '✴️', 1],
      ['숨겨진 고수', '???', 'quiz_count', 777, '🥷', 1],
      ['선생님 절친', '???', 'manual', 0, '🤝', 1],
      ['국어 마스터', '???', 'level', 75, '��', 1],
      ['XP 백만장자', '???', 'xp_total', 200000, '💵', 1],
    ];
    for (const [name, desc, type, val, icon, hidden] of titles) {
      await runQuery('INSERT INTO titles (name, description, condition_type, condition_value, icon, is_hidden, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [name, desc, type, val, icon, hidden, req.academyId]);
    }

    // 캐릭터 잠금레벨 업데이트 (기존 ID 유지하도록 UPSERT)
    const chars = [
      [1, '호랑이', '🐯', '용맹한 한국의 수호 동물', 1],
      [2, '용', '🐲', '하늘을 나는 지혜의 상징', 5],
      [3, '독수리', '🦅', '높이 나는 자유의 새', 1],
      [4, '여우', '🦊', '영리한 숲의 요정', 1],
      [5, '늑대', '🐺', '용맹한 달밤의 사냥꾼', 10],
      [6, '사자', '🦁', '당당한 초원의 왕', 15],
      [7, '불사조', '🔥', '전설의 불새', 30],
      [8, '유니콘', '🦄', '신비로운 마법의 존재', 40],
    ];
    await runQuery('DELETE FROM characters WHERE id NOT IN (1,2,3,4,5,6,7,8) AND (academy_id = ? OR academy_id = 0)', [req.academyId]);
    for (const [id, name, emoji, desc, lvl] of chars) {
      const existing = await getOne('SELECT id FROM characters WHERE id = ? AND (academy_id = ? OR academy_id = 0)', [id, req.academyId]);
      if (existing) {
        await runQuery('UPDATE characters SET name=?, emoji=?, description=?, unlock_level=? WHERE id=? AND (academy_id = ? OR academy_id = 0)', [name, emoji, desc, lvl, id, req.academyId]);
      } else {
        await runQuery('INSERT INTO characters (id, name, emoji, description, unlock_level, academy_id) VALUES (?, ?, ?, ?, ?, ?)', [id, name, emoji, desc, lvl, req.academyId]);
      }
    }
    // 기존 학생들의 character_id가 유효���지 않으면 1로 리��
    await runQuery('UPDATE student_characters SET character_id = 1 WHERE character_id NOT IN (SELECT id FROM characters WHERE (academy_id = ? OR academy_id = 0)) AND academy_id = ?', [req.academyId, req.academyId]);

    res.json({ message: `게임 설정 리셋 완료! 상점 ${shopData.length}개, 칭호 ${titles.length}개, 캐릭터 ${chars.length}개 재생성` });
  } catch (e) {
    res.status(500).json({ error: '게임 설정 리셋 실패: ' + e.message });
  }
});

// === 만렙 마스터 계정 생성 ===
router.post('/create-master', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // 관리자 본인의 user_id로 학생 레코드 생성 (관리자=마스터 통합)
    const adminUserId = req.user.id;

    // 기존 별도 master 유저가 있으면 삭제
    const oldMaster = await getOne("SELECT id FROM users WHERE username = 'master' AND academy_id = ?", [req.academyId]);
    if (oldMaster) {
      const oldStudent = await getOne("SELECT id FROM students WHERE user_id = ? AND academy_id = ?", [oldMaster.id, req.academyId]);
      if (oldStudent) {
        await runQuery("DELETE FROM student_characters WHERE student_id = ? AND academy_id = ?", [oldStudent.id, req.academyId]);
        await runQuery("DELETE FROM student_titles WHERE student_id = ? AND academy_id = ?", [oldStudent.id, req.academyId]);
        await runQuery("DELETE FROM vocab_game_logs WHERE student_id = ? AND academy_id = ?", [oldStudent.id, req.academyId]);
        await runQuery("DELETE FROM xp_logs WHERE student_id = ? AND academy_id = ?", [oldStudent.id, req.academyId]);
        await runQuery("DELETE FROM students WHERE id = ? AND academy_id = ?", [oldStudent.id, req.academyId]);
      }
      await runQuery("DELETE FROM users WHERE id = ? AND academy_id = ?", [oldMaster.id, req.academyId]);
    }

    // admin의 학생 레코드 확인/생성
    let adminStudent = await getOne("SELECT id FROM students WHERE user_id = ? AND academy_id = ?", [adminUserId, req.academyId]);
    if (!adminStudent) {
      await runQuery(
        "INSERT INTO students (user_id, school, grade, parent_name, parent_phone, academy_id) VALUES (?, ?, ?, ?, ?, ?)",
        [adminUserId, '관리자', '관리자', '', '', req.academyId]
      );
      adminStudent = await getOne("SELECT id FROM students WHERE user_id = ? AND academy_id = ?", [adminUserId, req.academyId]);
    }

    // Lv.100에 필요한 XP 계산
    let totalXp = 0;
    for (let lv = 1; lv < 100; lv++) {
      totalXp += Math.floor(40 * Math.pow(lv + 1, 1.4));
    }
    totalXp += 100;

    const masterAvatarConfig = JSON.stringify({
      topType: 'WinterHat4',
      accessoriesType: 'Sunglasses',
      hairColor: 'Platinum',
      facialHairType: 'Blank',
      clotheType: 'BlazerSweater',
      clotheColor: 'Black',
      eyeType: 'Happy',
      eyebrowType: 'Default',
      mouthType: 'Smile',
      skinColor: 'Light',
      mascot: 'unicorn',
    });

    // student_characters 생성/업데이트
    const existing = await getOne("SELECT id FROM student_characters WHERE student_id = ? AND academy_id = ?", [adminStudent.id, req.academyId]);
    if (existing) {
      await runQuery(
        "UPDATE student_characters SET xp = ?, level = 100, points = 999999, avatar_config = ? WHERE student_id = ? AND academy_id = ?",
        [totalXp, masterAvatarConfig, adminStudent.id, req.academyId]
      );
    } else {
      await runQuery(
        "INSERT INTO student_characters (student_id, character_id, xp, level, points, avatar_config, academy_id) VALUES (?, 8, ?, 100, 999999, ?, ?)",
        [adminStudent.id, totalXp, masterAvatarConfig, req.academyId]
      );
    }

    // 모든 칭호 부여
    const allTitles = await getAll("SELECT id FROM titles WHERE (academy_id = ? OR academy_id = 0)", [req.academyId]);
    for (const t of allTitles) {
      const has = await getOne("SELECT id FROM student_titles WHERE student_id = ? AND title_id = ? AND academy_id = ?", [adminStudent.id, t.id, req.academyId]);
      if (!has) {
        await runQuery("INSERT INTO student_titles (student_id, title_id, academy_id) VALUES (?, ?, ?)", [adminStudent.id, t.id, req.academyId]);
      }
    }

    res.json({
      message: '관리자 마스터 캐릭터 설정 완료! (관리자 계정에 통합)',
      level: 100,
      xp: totalXp,
      points: 999999
    });
  } catch (e) {
    res.status(500).json({ error: '마스터 설정 실패: ' + e.message });
  }
});

// === 게임 설정 API ===
router.get('/game-settings', authenticateToken, requireAdmin, async (req, res) => {
  const settings = await getAll('SELECT * FROM game_settings WHERE academy_id = ?', [req.academyId]);
  const obj = {};
  for (const s of settings) { obj[s.key] = s.value; }
  res.json(obj);
});

router.put('/game-settings', authenticateToken, requireAdmin, async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: '설정 데이터가 필요합니다.' });
  for (const [key, value] of Object.entries(settings)) {
    const existing = await getOne('SELECT key FROM game_settings WHERE key = ? AND academy_id = ?', [key, req.academyId]);
    if (existing) {
      await runQuery('UPDATE game_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ? AND academy_id = ?', [String(value), key, req.academyId]);
    } else {
      await runQuery('INSERT INTO game_settings (key, value, academy_id) VALUES (?, ?, ?)', [key, String(value), req.academyId]);
    }
  }
  res.json({ message: '설정이 저장되었습니다.' });
});

// === 어휘 DB 엑셀 다운로드 ===
router.get('/vocab/export', authenticateToken, requireAdmin, async (req, res) => {
  const words = await getAll('SELECT category, question_text, correct_answer, wrong_answers, difficulty, explanation FROM vocab_words WHERE (academy_id = ? OR academy_id = 0) ORDER BY category, id', [req.academyId]);
  // CSV format
  let csv = '\uFEFF카테고리,질문,정답,오답들,난이도,설명\n';
  words.forEach(w => {
    const escape = (s) => '"' + (s || '').replace(/"/g, '""') + '"';
    csv += `${escape(w.category)},${escape(w.question_text)},${escape(w.correct_answer)},${escape(w.wrong_answers)},${w.difficulty},${escape(w.explanation)}\n`;
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=vocab_words.csv');
  res.send(csv);
});

// === 관리자: 학생 XP/포인트 획득 내역 ===
router.get('/xp-logs/:studentId', authenticateToken, requireAdmin, async (req, res) => {
  const { page, limit: lim } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(lim) || 50;
  const offset = (pageNum - 1) * limitNum;

  const total = await getOne('SELECT COUNT(*) as cnt FROM xp_logs WHERE student_id = ? AND academy_id = ?', [req.params.studentId, req.academyId]);
  const logs = await getAll(
    `SELECT * FROM xp_logs WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [req.params.studentId, req.academyId, limitNum, offset]
  );

  res.json({
    logs,
    total: total ? total.cnt : 0,
    page: pageNum,
    totalPages: Math.ceil((total ? total.cnt : 0) / limitNum),
  });
});

// 관리자: 전체 XP 로그 (최근 활동)
router.get('/xp-logs', authenticateToken, requireAdmin, async (req, res) => {
  const { source, days } = req.query;
  const daysNum = parseInt(days) || 7;
  let where = `xl.created_at >= datetime('now', '-${daysNum} days') AND xl.academy_id = ?`;
  const params = [req.academyId];
  if (source) { where += ' AND xl.source = ?'; params.push(source); }

  const logs = await getAll(
    `SELECT xl.*, u.name as student_name, s.school, s.grade
     FROM xp_logs xl
     JOIN students s ON xl.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE ${where}
     ORDER BY xl.created_at DESC LIMIT 2000`,
    params
  );

  // 소스별 요약
  const summary = await getAll(
    `SELECT source, SUM(amount) as total_amount, COUNT(*) as count
     FROM xp_logs WHERE created_at >= datetime('now', '-${daysNum} days') AND academy_id = ?
     GROUP BY source ORDER BY total_amount DESC`,
    [req.academyId]
  );

  res.json({ logs, summary });
});

module.exports = router;
