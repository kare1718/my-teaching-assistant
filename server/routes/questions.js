const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// 이미지 업로드 설정
const uploadDir = path.join(__dirname, '../../uploads/questions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  }
});
const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (allowedTypes.test(ext) || file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('이미지 또는 PDF만 업로드 가능합니다.'), false);
};
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter }); // 10MB

const TEACHER_PROMPT = `너는 국어 전문 강사야. 학생들의 국어 관련 질문에 답변하는 역할이야.

절대 하지 말 것:
- 자기소개 하지 마 (이름, 출신 학교, 학원 이름 등 절대 언급 금지)
- 발랄하거나 오글거리는 표현 금지
- 과한 감정 표현이나 리액션 금지

말투 규칙:
- 편안한 존댓말 사용 (예: "~해요", "~이에요", "~거든요", "~드릴게요")
- 차분하고 신뢰감 있는 톤
- 이모지는 한 답변에 최대 3개, 자연스럽게만
- 격려는 담백하게, 유머는 가볍게

답변 규칙:
- 질문에 대해 자세하고 정확하게 답변해줘
- 예시를 들어 이해하기 쉽게 설명해줘
- 핵심 포인트를 명확히 짚어줘
- 이미지가 첨부된 경우, 이미지 내용을 분석해서 질문에 맞게 답변해줘
- 전문 분야 외 질문에는 "해당 분야는 답변이 어려워요. 수업 관련 질문은 편하게 물어보세요." 라고만 안내해줘

학생 이름이 주어지면 자연스럽게 이름을 불러줘. "님"은 붙이지 마. "민준아", "서연아", "민준이가 물어본 거는~", "예은이 질문 좋아요" 등 상황에 맞게 자연스럽게 호칭해줘.
바로 질문에 대한 답변부터 시작해.`;

async function getGeminiAnswer(question, imagePath, studentName) {
  if (!GEMINI_API_KEY) {
    console.log('[Gemini] API 키 미설정');
    return '아직 AI 답변 기능이 설정되지 않았어요. 선생님이 직접 답변드릴게요!';
  }

  const FALLBACK = '잠시 답변이 어려운 상황이에요. 선생님이 직접 답변드릴게요!';

  try {
    // 콘텐츠 parts 구성
    const parts = [];

    // 이미지가 있으면 base64로 변환해서 추가
    if (imagePath) {
      try {
        const fullPath = path.join(__dirname, '../../', imagePath);
        const imageBuffer = fs.readFileSync(fullPath);
        const base64Image = imageBuffer.toString('base64');
        const ext = path.extname(imagePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        parts.push({ inline_data: { mime_type: mimeType, data: base64Image } });
      } catch (e) {
        console.error('[Gemini] 이미지 읽기 오류:', e.message);
      }
    }

    const nameInfo = studentName ? `\n질문한 학생 이름: ${studentName}` : '';
    parts.push({
      text: `${TEACHER_PROMPT}${nameInfo}\n\n학생 질문: ${question || '(이미지 참고)'}\n\n답변:`
    });

    const body = JSON.stringify({
      contents: [{ parts }],
      // thinking 비활성화 → 응답 속도 향상
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } }
    });

    // 최대 2회 시도 (재시도 1회)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 50000); // 50초 타임아웃

        console.log(`[Gemini] API 호출 시작 (시도 ${attempt}/2)...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        console.log('[Gemini] 응답 상태:', response.status);

        if (response.status === 429 || response.status === 503) {
          console.error(`[Gemini] ${response.status} - ${attempt < 2 ? '재시도...' : '포기'}`);
          if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
          return FALLBACK;
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error('[Gemini] API 에러:', response.status, errText.substring(0, 300));
          return FALLBACK;
        }

        const json = await response.json();

        // 안전 필터 차단 체크
        if (json.candidates?.[0]?.finishReason === 'SAFETY') {
          console.error('[Gemini] 안전 필터 차단');
          return FALLBACK;
        }
        if (json.promptFeedback?.blockReason) {
          console.error('[Gemini] 프롬프트 차단:', json.promptFeedback.blockReason);
          return FALLBACK;
        }

        // 정상 응답 파싱 (여러 parts 중 텍스트 찾기)
        if (json.candidates?.[0]?.content?.parts) {
          const textParts = json.candidates[0].content.parts.filter(p => p.text);
          const answer = textParts.map(p => p.text).join('').trim();
          if (answer) {
            console.log('[Gemini] 답변 생성 완료 (길이:', answer.length, ')');
            return answer;
          }
        }

        console.error('[Gemini] 응답 형식 오류:', JSON.stringify(json).substring(0, 500));
        if (attempt < 2) continue;
        return FALLBACK;
      } catch (err) {
        if (err.name === 'AbortError') {
          console.error(`[Gemini] 타임아웃 (50초, 시도 ${attempt})`);
        } else {
          console.error(`[Gemini] 오류 (시도 ${attempt}):`, err.message);
        }
        if (attempt < 2) { await new Promise(r => setTimeout(r, 1000)); continue; }
        return FALLBACK;
      }
    }
    return FALLBACK;
  } catch (outerErr) {
    console.error('[Gemini] 외부 오류:', outerErr.message);
    return FALLBACK;
  }
}

// === 학생용 ===

// 질문 등록 (이미지 첨부 가능)
router.post('/', upload.single('image'), async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: '학생만 질문할 수 있습니다.' });

  const { question } = req.body;
  const imagePath = req.file ? `/uploads/questions/${req.file.filename}` : null;

  if ((!question || !question.trim()) && !imagePath) {
    return res.status(400).json({ error: '질문을 입력하거나 이미지를 첨부해주세요.' });
  }

  const student = await getOne(
    'SELECT s.id, u.name FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ? AND s.academy_id = ?',
    [req.user.id, req.academyId]
  );
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  // 질문 저장
  const questionId = await runInsert(
    'INSERT INTO questions (student_id, question, image, academy_id) VALUES (?, ?, ?, ?)',
    [student.id, (question || '').trim(), imagePath, req.academyId]
  );

  // 즉시 응답 (Render.com 30초 타임아웃 방지)
  res.json({ message: '질문이 등록되었습니다.', id: questionId });
  console.log(`[QnA] 질문 ${questionId} 저장 완료, AI 답변 처리 시작`);

  const FALLBACK_MSG = '잠시 답변이 어려운 상황이에요. 선생님이 직접 답변드릴게요!';

  // 안전장치: 60초 후에도 답변이 없으면 fallback 저장
  const safetyTimer = setTimeout(async () => {
    try {
      const q = await getOne('SELECT answer FROM questions WHERE id = ? AND academy_id = ?', [questionId, req.academyId]);
      if (!q || !q.answer) {
        console.log(`[QnA] 질문 ${questionId} 안전장치 발동 - fallback 답변 저장`);
        await runQuery(
          'UPDATE questions SET answer = ?, status = ?, answered_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
          [FALLBACK_MSG, 'answered', questionId, req.academyId]
        );
      }
    } catch (e) {
      console.error('[QnA] 안전장치 오류:', e.message);
    }
  }, 60000);

  // AI 자동 답변 백그라운드 처리
  getGeminiAnswer((question || '').trim(), imagePath, student.name)
    .then(async (aiAnswer) => {
      clearTimeout(safetyTimer);
      if (aiAnswer) {
        await runQuery(
          'UPDATE questions SET answer = ?, status = ?, answered_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
          [aiAnswer, 'answered', questionId, req.academyId]
        );
        console.log(`[QnA] 질문 ${questionId} AI 답변 완료`);
      } else {
        await runQuery(
          'UPDATE questions SET answer = ?, status = ?, answered_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
          [FALLBACK_MSG, 'answered', questionId, req.academyId]
        );
        console.log(`[QnA] 질문 ${questionId} AI 답변 null → fallback 저장`);
      }
    })
    .catch(async (err) => {
      clearTimeout(safetyTimer);
      console.error(`[QnA] 질문 ${questionId} AI 답변 오류:`, err.message || err);
      await runQuery(
        'UPDATE questions SET answer = ?, status = ?, answered_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
        [FALLBACK_MSG, 'answered', questionId, req.academyId]
      );
    });
});

// 특정 질문 상태 확인 (폴링용)
router.get('/status/:id', async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: '권한이 없습니다.' });
  const q = await getOne('SELECT id, status, answer, answered_at FROM questions WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  if (!q) return res.status(404).json({ error: '질문을 찾을 수 없습니다.' });
  res.json(q);
});

// 내 질문 목록
router.get('/my', async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: '권한이 없습니다.' });

  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const questions = await getAll(
    'SELECT * FROM questions WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC',
    [student.id, req.academyId]
  );
  res.json(questions);
});

// === 관리자용 ===

// 전체 질문 목록
router.get('/all', requireAdmin, async (req, res) => {
  const questions = await getAll(
    `SELECT q.*, u.name as student_name, s.school, s.grade
     FROM questions q
     JOIN students s ON q.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE q.academy_id = ?
     ORDER BY q.created_at DESC`,
    [req.academyId]
  );
  res.json(questions);
});

// 학생별 질문 요약 (관리자)
router.get('/summary', requireAdmin, async (req, res) => {
  const summary = await getAll(
    `SELECT s.id as student_id, u.name as student_name, s.school, s.grade,
       COUNT(q.id) as total_questions,
       SUM(CASE WHEN q.status = 'answered' THEN 1 ELSE 0 END) as answered_count,
       MAX(q.created_at) as last_question_at
     FROM students s
     JOIN users u ON s.user_id = u.id
     JOIN questions q ON q.student_id = s.id
     WHERE s.academy_id = ?
     GROUP BY s.id
     ORDER BY last_question_at DESC`,
    [req.academyId]
  );
  res.json(summary);
});

// 특정 학생의 질문 목록 (관리자)
router.get('/student/:studentId', requireAdmin, async (req, res) => {
  const questions = await getAll(
    'SELECT * FROM questions WHERE student_id = ? AND academy_id = ? ORDER BY created_at DESC',
    [parseInt(req.params.studentId), req.academyId]
  );
  res.json(questions);
});

// 관리자 직접 답변/수정
router.put('/:id/answer', requireAdmin, async (req, res) => {
  const { answer } = req.body;
  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: '답변을 입력해주세요.' });
  }
  await runQuery(
    'UPDATE questions SET answer = ?, status = ?, answered_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
    [answer.trim(), 'answered', parseInt(req.params.id), req.academyId]
  );
  res.json({ message: '답변이 등록되었습니다.' });
});

// 질문 삭제
router.delete('/:id', requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM questions WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '질문이 삭제되었습니다.' });
});

// 답변 기준 CRUD
router.get('/guidelines', requireAdmin, async (req, res) => {
  const guidelines = await getAll('SELECT * FROM answer_guidelines WHERE academy_id = ? ORDER BY sort_order ASC, id ASC', [req.academyId]);
  res.json(guidelines);
});

router.post('/guidelines', requireAdmin, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  const maxOrder = await getOne('SELECT MAX(sort_order) as m FROM answer_guidelines WHERE academy_id = ?', [req.academyId]);
  const order = (maxOrder && maxOrder.m !== null) ? maxOrder.m + 1 : 0;
  const id = await runInsert('INSERT INTO answer_guidelines (title, content, sort_order, academy_id) VALUES (?, ?, ?, ?)', [title, content, order, req.academyId]);
  res.json({ message: '답변 기준이 추가되었습니다.', id });
});

router.put('/guidelines/:id', requireAdmin, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  await runQuery('UPDATE answer_guidelines SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND academy_id = ?',
    [title, content, parseInt(req.params.id), req.academyId]);
  res.json({ message: '답변 기준이 수정되었습니다.' });
});

router.delete('/guidelines/:id', requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM answer_guidelines WHERE id = ? AND academy_id = ?', [parseInt(req.params.id), req.academyId]);
  res.json({ message: '답변 기준이 삭제되었습니다.' });
});

module.exports = router;
