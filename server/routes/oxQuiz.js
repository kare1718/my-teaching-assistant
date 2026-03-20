const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// 이미지 업로드 설정
const uploadDir = path.join(__dirname, '../../uploads/ox-quiz');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Gemini 응답에서 JSON 파싱
function parseGeminiJSON(text) {
  // 마크다운 코드블록 제거
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try { return JSON.parse(cleaned); } catch (e) {}

  // 배열 추출 시도
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch (e) {}
  }

  // 객체 추출 시도
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch (e) {}
  }

  return null;
}

// Gemini API 호출
async function callGemini(parts, timeoutMs = 30000) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API 키가 설정되지 않았습니다.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini 응답이 비어있습니다.');
    return text;
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('AI 응답 시간이 초과되었습니다. 다시 시도해주세요.');
    throw e;
  }
}

// === 문학 O/X ===
router.post('/generate', async (req, res) => {
  const { author, work } = req.body;
  if (!author || !work) return res.status(400).json({ error: '작가명과 작품명을 입력해주세요.' });

  const prompt = `너는 수능 국어 문학 출제 전문가야.

다음 작품에 대해 O/X(참/거짓) 문제를 정확히 10개 만들어줘.
- 작가: ${author}
- 작품: ${work}

출제 기준:
1. 수능 국어 문학 영역의 감상/해석 문제 스타일로 출제
2. 작품의 표현법, 주제의식, 화자/서술자, 시어/시구 의미, 문학사적 맥락, 갈래적 특성 등 다양한 관점에서 출제
3. O(참)와 X(거짓)의 비율은 대략 5:5 또는 4:6으로 균형있게
4. X(거짓) 문제는 그럴듯하지만 미묘하게 틀린 진술로 만들어서 변별력을 확보해
5. 해설은 간결하고 핵심만 (2~3문장)
6. 해당 작품이 존재하지 않거나 잘 모르는 경우 {"error": "해당 작품을 찾을 수 없습니다. 작가명과 작품명을 다시 확인해주세요."} 형태로 응답해

반드시 아래 JSON 배열 형식으로만 응답해. 다른 텍스트 없이 JSON만:
[
  {"statement": "이 작품에서 화자는 ...", "answer": true, "explanation": "..."},
  ...
]`;

  try {
    const text = await callGemini([{ text: prompt }]);
    const parsed = parseGeminiJSON(text);

    if (!parsed) return res.status(500).json({ error: '문제 생성에 실패했습니다. 다시 시도해주세요.' });
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const questions = Array.isArray(parsed) ? parsed : parsed.questions || [];
    if (questions.length === 0) return res.status(500).json({ error: '문제를 생성할 수 없습니다. 작품명을 확인해주세요.' });

    res.json({
      quizType: 'literature',
      author, work,
      questions: questions.slice(0, 10).map((q, i) => ({
        id: i + 1,
        statement: q.statement,
        answer: q.answer === true || q.answer === 'true',
        explanation: q.explanation || '',
      }))
    });
  } catch (e) {
    console.error('[OX Quiz] 문학 생성 오류:', e.message);
    res.status(500).json({ error: e.message || '문제 생성 중 오류가 발생했습니다.' });
  }
});

// === 비문학 O/X (텍스트) ===
router.post('/generate-text', async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 50) return res.status(400).json({ error: '지문은 50자 이상 입력해주세요.' });

  const prompt = `너는 수능 국어 비문학(독서) 출제 전문가야.

다음 지문을 읽고 O/X(참/거짓) 문제를 정확히 10개 만들어줘.

[지문]
${text}

출제 기준:
1. 수능 국어 비문학(독서) 영역 스타일로 출제
2. 지문의 핵심 논지, 세부 정보, 인과관계, 비교/대조, 추론 등 다양한 유형으로 출제
3. O(참)와 X(거짓)의 비율은 대략 5:5 또는 4:6으로 균형있게
4. X(거짓) 문제는 지문 내용을 미묘하게 왜곡하거나 과잉/과소 일반화하여 변별력 확보
5. 해설은 지문의 어느 부분을 근거로 하는지 명시 (2~3문장)

반드시 아래 JSON 배열 형식으로만 응답해:
[
  {"statement": "...", "answer": true, "explanation": "..."},
  ...
]`;

  try {
    const responseText = await callGemini([{ text: prompt }]);
    const parsed = parseGeminiJSON(responseText);

    if (!parsed) return res.status(500).json({ error: '문제 생성에 실패했습니다. 다시 시도해주세요.' });

    const questions = Array.isArray(parsed) ? parsed : parsed.questions || [];
    if (questions.length === 0) return res.status(500).json({ error: '문제를 생성할 수 없습니다. 지문을 확인해주세요.' });

    res.json({
      quizType: 'nonfiction',
      questions: questions.slice(0, 10).map((q, i) => ({
        id: i + 1,
        statement: q.statement,
        answer: q.answer === true || q.answer === 'true',
        explanation: q.explanation || '',
      }))
    });
  } catch (e) {
    console.error('[OX Quiz] 비문학 텍스트 생성 오류:', e.message);
    res.status(500).json({ error: e.message || '문제 생성 중 오류가 발생했습니다.' });
  }
});

// === 비문학 O/X (이미지) ===
router.post('/generate-image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '이미지를 업로드해주세요.' });

  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const prompt = `너는 수능 국어 비문학(독서) 출제 전문가야.

첨부된 이미지에서 텍스트를 인식한 후, 그 내용을 바탕으로 O/X(참/거짓) 문제를 정확히 10개 만들어줘.

출제 기준:
1. 수능 국어 비문학(독서) 영역 스타일로 출제
2. 지문의 핵심 논지, 세부 정보, 인과관계, 비교/대조, 추론 등 다양한 유형
3. O(참)와 X(거짓)의 비율은 대략 5:5 또는 4:6
4. X(거짓) 문제는 지문 내용을 미묘하게 왜곡하거나 과잉/과소 일반화
5. 해설은 지문의 어느 부분을 근거로 하는지 명시 (2~3문장)

반드시 아래 JSON 형식으로만 응답해:
{
  "extractedText": "인식된 텍스트 전문",
  "questions": [
    {"statement": "...", "answer": true, "explanation": "..."},
    ...
  ]
}`;

    const parts = [
      { inline_data: { mime_type: mimeType, data: base64Image } },
      { text: prompt }
    ];

    const responseText = await callGemini(parts, 35000);
    const parsed = parseGeminiJSON(responseText);

    if (!parsed) return res.status(500).json({ error: '이미지 인식 또는 문제 생성에 실패했습니다.' });

    const questions = parsed.questions || (Array.isArray(parsed) ? parsed : []);
    if (questions.length === 0) return res.status(500).json({ error: '이미지에서 텍스트를 인식할 수 없습니다.' });

    res.json({
      quizType: 'nonfiction',
      extractedText: parsed.extractedText || '',
      questions: questions.slice(0, 10).map((q, i) => ({
        id: i + 1,
        statement: q.statement,
        answer: q.answer === true || q.answer === 'true',
        explanation: q.explanation || '',
      }))
    });
  } catch (e) {
    console.error('[OX Quiz] 이미지 생성 오류:', e.message);
    res.status(500).json({ error: e.message || '이미지 처리 중 오류가 발생했습니다.' });
  } finally {
    // 업로드 이미지 정리
    try { if (req.file) fs.unlinkSync(req.file.path); } catch (e) {}
  }
});

// === 결과 저장 ===
router.post('/save-result', async (req, res) => {
  const { quizType, inputData, totalQuestions, correctCount, questionsJson } = req.body;
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const id = await runInsert(
    `INSERT INTO ox_quiz_logs (student_id, quiz_type, input_data, total_questions, correct_count, questions_json, academy_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [student.id, quizType, JSON.stringify(inputData), totalQuestions || 10, correctCount || 0, JSON.stringify(questionsJson), req.academyId]
  );
  res.json({ message: '결과 저장 완료', id });
});

// === 내 풀이 기록 ===
router.get('/my-logs', async (req, res) => {
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.json([]);

  const logs = await getAll(
    `SELECT id, quiz_type, input_data, total_questions, correct_count, played_at
     FROM ox_quiz_logs WHERE student_id = ? AND academy_id = ? ORDER BY played_at DESC LIMIT 20`,
    [student.id, req.academyId]
  );
  res.json(logs.map(l => ({
    ...l,
    input_data: (() => { try { return JSON.parse(l.input_data); } catch(e) { return {}; } })()
  })));
});

module.exports = router;
