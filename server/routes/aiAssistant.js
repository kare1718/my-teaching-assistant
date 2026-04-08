const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { callGemini } = require('../utils/geminiHelper');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');

// ============================================================
// AI Admin Assistant - Gemini 기반 자연어 명령 + 대화
// ============================================================

const SCHOOL_LIST = ['계성고', '경신고', '용문고', '대일외고', '중학생'];

const ACTION_TYPES = {
  create_exam: { description: '시험 등록', params: ['name', 'exam_type', 'max_score', 'exam_date', 'school', 'grade'] },
  input_scores: { description: '성적 입력', params: ['exam_id', 'exam_name', 'scores'] },
  create_code: { description: '히든코드 생성', params: ['code', 'xp_amount', 'max_uses', 'description', 'expires_days'] },
  adjust_xp: { description: 'XP/포인트 조정', params: ['student_name', 'xp_amount', 'points_amount', 'reason'] },
  create_notice: { description: '공지 등록', params: ['title', 'content', 'target_type', 'target_school'] },
  query_data: { description: '데이터 조회', params: ['query_type'] },
  bulk_sms: { description: '문자 발송 준비', params: ['target', 'message_template'] },
};

/**
 * DB에서 실시간 컨텍스트 수집 - 각 쿼리 개별 에러 핸들링
 */
async function getRealtimeContext(academyId) {
  const ctx = {};

  // 학교별 학생 수
  try {
    ctx.students = await getAll(
      `SELECT s.school, COUNT(*) as cnt FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE u.role = 'student' AND (s.status IS NULL OR s.status = 'active')
       AND s.school NOT IN ('조교', '선생님')
       AND s.academy_id = ?
       GROUP BY s.school ORDER BY cnt DESC`,
      [academyId]
    );
    ctx.totalStudents = ctx.students.reduce((sum, s) => sum + s.cnt, 0);
  } catch (e) { ctx.students = []; ctx.totalStudents = 0; }

  // 학교별 학년별 인원
  try {
    ctx.gradeDetails = await getAll(
      `SELECT s.school, s.grade, COUNT(*) as cnt FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE u.role = 'student' AND (s.status IS NULL OR s.status = 'active')
       AND s.school NOT IN ('조교', '선생님')
       AND s.academy_id = ?
       GROUP BY s.school, s.grade ORDER BY s.school, s.grade`,
      [academyId]
    );
  } catch (e) { ctx.gradeDetails = []; }

  // 퇴원 학생 수
  try {
    const inactive = await getOne(
      `SELECT COUNT(*) as cnt FROM students s JOIN users u ON s.user_id = u.id WHERE s.status = 'inactive' AND s.academy_id = ?`,
      [academyId]
    );
    ctx.inactiveStudents = inactive?.cnt || 0;
  } catch (e) { ctx.inactiveStudents = 0; }

  // 최근 시험 5건
  try {
    ctx.recentExams = await getAll(
      'SELECT id, name, exam_type, exam_date, school, grade, max_score FROM exams WHERE academy_id = ? ORDER BY id DESC LIMIT 5',
      [academyId]
    );
  } catch (e) { ctx.recentExams = []; }

  // 최근 공지 3건
  try {
    ctx.recentNotices = await getAll(
      'SELECT id, title, target_type, target_school, created_at FROM notices WHERE academy_id = ? ORDER BY created_at DESC LIMIT 3',
      [academyId]
    );
  } catch (e) { ctx.recentNotices = []; }

  // 클리닉 대기 건수
  try {
    const clinicPending = await getOne(
      `SELECT COUNT(*) as cnt FROM clinic_appointments WHERE status = 'pending' AND academy_id = ?`,
      [academyId]
    );
    ctx.clinicPending = clinicPending?.cnt || 0;
  } catch (e) { ctx.clinicPending = 0; }

  // 가입 대기 건수
  try {
    const pendingUsers = await getOne(
      `SELECT COUNT(*) as cnt FROM users WHERE status = 'pending' AND academy_id = ?`,
      [academyId]
    );
    ctx.pendingUsers = pendingUsers?.cnt || 0;
  } catch (e) { ctx.pendingUsers = 0; }

  // 미답변 질문
  try {
    const pendingQna = await getOne(
      `SELECT COUNT(*) as cnt FROM questions WHERE status = 'pending' AND academy_id = ?`,
      [academyId]
    );
    ctx.pendingQna = pendingQna?.cnt || 0;
  } catch (e) { ctx.pendingQna = 0; }

  // 활성 히든코드
  try {
    ctx.activeCodes = await getAll(
      `SELECT code, xp_amount, current_uses, max_uses, expires_at FROM redeem_codes
       WHERE (expires_at IS NULL OR expires_at > datetime('now')) AND current_uses < max_uses
       AND academy_id = ?
       ORDER BY created_at DESC LIMIT 5`,
      [academyId]
    );
  } catch (e) { ctx.activeCodes = []; }

  // XP 랭킹 Top 5
  try {
    ctx.topRankers = await getAll(
      `SELECT u.name, s.school, sc.xp, sc.points, sc.level
       FROM student_characters sc
       JOIN students s ON s.id = sc.student_id
       JOIN users u ON s.user_id = u.id
       WHERE sc.academy_id = ?
       ORDER BY sc.xp DESC LIMIT 5`,
      [academyId]
    );
  } catch (e) { ctx.topRankers = []; }

  // 이번 주 수업 일정
  try {
    ctx.weekSchedules = await getAll(
      `SELECT title, schedule_date, time_slot, target_school, status FROM class_schedules
       WHERE schedule_date >= date('now', '-1 day') AND schedule_date <= date('now', '+7 days')
       AND academy_id = ?
       ORDER BY schedule_date, time_slot LIMIT 10`,
      [academyId]
    );
  } catch (e) { ctx.weekSchedules = []; }

  // 최근 수업 후기 베스트 3
  try {
    ctx.recentReviews = await getAll(
      `SELECT r.content, u.name, s.school, r.is_best, r.created_at
       FROM reviews r JOIN students s ON r.student_id = s.id JOIN users u ON s.user_id = u.id
       WHERE r.academy_id = ?
       ORDER BY r.created_at DESC LIMIT 3`,
      [academyId]
    );
  } catch (e) { ctx.recentReviews = []; }

  // 숙제 미제출 현황
  try {
    const hwPending = await getOne(
      `SELECT COUNT(*) as cnt FROM homework_submissions WHERE status = 'pending' AND academy_id = ?`,
      [academyId]
    );
    ctx.homeworkPending = hwPending?.cnt || 0;
  } catch (e) { ctx.homeworkPending = 0; }

  return ctx;
}

/**
 * 실시간 컨텍스트를 포함한 시스템 프롬프트
 */
async function buildSystemPrompt(academyId) {
  const today = new Date().toISOString().split('T')[0];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = dayNames[new Date().getDay()];
  const ctx = await getRealtimeContext(academyId);

  // 학생 현황 텍스트
  const studentSummary = ctx.students?.map(s => `${s.school}: ${s.cnt}명`).join(', ') || '데이터 없음';
  const gradeSummary = ctx.gradeDetails?.map(g => `${g.school} ${g.grade}: ${g.cnt}명`).join(', ') || '';

  // 시험 목록
  const examList = ctx.recentExams?.map(e =>
    `[ID:${e.id}] ${e.name} (${e.exam_type}, ${e.exam_date || '날짜미정'}, ${e.school || '전체'}, 만점:${e.max_score})`
  ).join('\n  ') || '없음';

  // 공지 목록
  const noticeList = ctx.recentNotices?.map(n =>
    `[ID:${n.id}] ${n.title} (${n.target_type === 'all' ? '전체' : n.target_school}, ${n.created_at})`
  ).join('\n  ') || '없음';

  // 히든코드
  const codeList = ctx.activeCodes?.map(c =>
    `${c.code}: ${c.xp_amount}XP (${c.current_uses}/${c.max_uses}회 사용${c.expires_at ? ', 만료:' + c.expires_at.slice(0, 10) : ''})`
  ).join('\n  ') || '없음';

  // 랭킹
  const rankList = ctx.topRankers?.map((r, i) =>
    `${i + 1}위 ${r.name}(${r.school}) XP:${r.xp} P:${r.points} Lv.${r.level || 1}`
  ).join('\n  ') || '없음';

  // 수업 일정
  const scheduleList = ctx.weekSchedules?.length > 0
    ? ctx.weekSchedules.map(s =>
        `${s.schedule_date} ${s.time_slot || ''} ${s.title} (${s.target_school || '전체'})${s.status === 'cancelled' ? ' [휴강]' : ''}`
      ).join('\n  ')
    : '이번 주 일정 없음';

  // 최근 후기
  const reviewList = ctx.recentReviews?.length > 0
    ? ctx.recentReviews.map(r => `${r.name}(${r.school}): "${r.content?.slice(0, 30)}..."${r.is_best ? ' ⭐베스트' : ''}`).join('\n  ')
    : '없음';

  return `너는 "나만의 조교" 학원의 AI 관리 어시스턴트야. 이름은 "나만의 조교 AI"야.
관리자(선생님)와 자연스러운 대화를 하면서, 필요하면 관리 작업도 실행할 수 있어.

## 현재: ${today} (${dayOfWeek}요일)

## 📊 실시간 학원 현황 (DB에서 바로 가져온 데이터)
- 총 재원생: ${ctx.totalStudents || 0}명 (퇴원: ${ctx.inactiveStudents || 0}명)
- 학교별: ${studentSummary}
- 학년별 상세: ${gradeSummary || '없음'}
- 가입 승인 대기: ${ctx.pendingUsers || 0}건
- 미답변 질문: ${ctx.pendingQna || 0}건
- 클리닉 예약 대기: ${ctx.clinicPending || 0}건
- 숙제 확인 대기: ${ctx.homeworkPending || 0}건

## 📝 최근 시험 (최신 5건)
  ${examList}

## 📢 최근 공지 (최신 3건)
  ${noticeList}

## 🎮 활성 히든코드
  ${codeList}

## 🏆 XP 랭킹 Top 5
  ${rankList}

## 📅 이번 주 수업 일정
  ${scheduleList}

## 💬 최근 수업 후기
  ${reviewList}

## 학교 목록: ${SCHOOL_LIST.join(', ')}

## 🔧 응답 형식 (반드시 JSON만 출력!)

### 1) 일반 대화/질문 응답
현황 확인, 조언, 인사, 분석 등에는 자연스럽고 유용하게 답해.
위의 실시간 데이터를 적극 활용해서 구체적인 숫자와 이름으로 답변해.
질문에 대해 분석적으로 답하고, 필요하면 제안도 해줘.

형식: {"type": "chat", "message": "자연스러운 답변"}

message 안에서 줄바꿈은 \\n으로, 강조는 **텍스트**로 표시.
리스트가 필요하면 • 기호를 사용해.

### 2) 실행 명령
시험 등록, 공지 작성, 히든코드 생성, XP 조정 등:
{
  "type": "action",
  "actions": [{"type": "액션타입", "description": "설명", "params": { ... }}],
  "summary": "작업 요약 한 줄"
}

### 3) 데이터 조회
학생 목록, 성적, 랭킹 등 상세 데이터 조회:
{
  "type": "action",
  "actions": [{"type": "query_data", "params": {"query_type": "타입", "filters": {...}}}],
  "summary": "조회 설명"
}

### 4) 정보 부족
{"type": "clarification", "message": "구체적 질문"}

## 사용 가능한 액션
- **create_exam**: params = {name, exam_type(학력평가 모의고사/수능 모의고사/자체 모의고사/내신 파이널/기타), max_score(기본100), exam_date(YYYY-MM-DD), school, grade}
- **input_scores**: params = {exam_id 또는 exam_name, scores:[{student_name, score, note}]}
- **create_code**: params = {code, xp_amount, max_uses(기본50), description, expires_days(기본7)}
- **adjust_xp**: params = {student_name, xp_amount, points_amount, reason}
- **create_notice**: params = {title, content, target_type(all/school), target_school}
- **query_data**: params = {query_type(rankings/students/exams/scores/clinics/notices/homework), filters:{school, grade, limit 등}}

## 규칙
1. 반드시 위 JSON 형식 중 하나만 출력. 절대 다른 텍스트나 설명 없이 순수 JSON만.
2. 마크다운 코드블록(\`\`\`json 등) 절대 사용 금지. 순수 JSON만 출력.
3. 위 실시간 데이터를 최대한 활용해서 구체적 숫자, 이름으로 답변.
4. 날짜 기준: ${today}
5. 학생 이름은 정확히 매칭. 모호하면 clarification으로 확인.
6. 대화체로 친근하게, 존댓말 사용(~요, ~습니다).
7. "현황", "요약", "알려줘" 같은 질문에는 실시간 데이터 기반으로 chat 타입 응답.
8. 한번에 여러 작업이면 actions 배열에 여러 개 넣기.`;
}

/**
 * Gemini 응답 JSON 파싱 - 강건한 처리
 */
function parseGeminiResponse(text) {
  let cleaned = text.trim();

  // 마크다운 코드블록 제거
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // JSON 외 텍스트가 앞뒤에 있으면 제거
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // JSON 파싱 실패시 chat 응답으로 변환
    console.error('[AI Parse] JSON 파싱 실패, 원본:', text.slice(0, 200));
    return { type: 'chat', message: cleaned || 'AI 응답을 처리하지 못했습니다.' };
  }
}

function validateActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { valid: false, error: '실행할 액션이 없습니다.' };
  }
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (!action.type || !ACTION_TYPES[action.type]) {
      return { valid: false, error: `알 수 없는 액션 타입: ${action.type}` };
    }
    if (!action.params || typeof action.params !== 'object') {
      return { valid: false, error: `액션 #${i + 1}에 params가 없습니다.` };
    }
  }
  return { valid: true };
}

// ============================================================
// POST /api/ai/parse
// ============================================================
router.post('/parse', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { message, history } = req.body;
    const academyId = req.academyId;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: '메시지를 입력해주세요.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: '메시지가 너무 깁니다. (최대 2000자)' });
    }

    const systemPrompt = await buildSystemPrompt(academyId);

    // 대화 히스토리 포함
    let conversationContext = '';
    if (history && Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-8);
      conversationContext = '\n\n## 이전 대화:\n' + recentHistory.map(h =>
        `${h.role === 'user' ? '관리자' : 'AI'}: ${h.content}`
      ).join('\n');
    }

    const fullPrompt = `${systemPrompt}${conversationContext}\n\n관리자: ${message}`;

    const geminiResponse = await callGemini(fullPrompt);
    const parsed = parseGeminiResponse(geminiResponse);

    // 일반 대화 응답
    if (parsed.type === 'chat') {
      return res.json({
        status: 'done',
        message: parsed.message || '응답을 생성했습니다.',
      });
    }

    // 정보 부족 / 명확화 요청
    if (parsed.type === 'clarification' || parsed.clarification_needed) {
      return res.json({
        status: 'clarification',
        message: parsed.message || parsed.question || '추가 정보가 필요합니다.',
      });
    }

    // 액션 실행 요청
    if (parsed.type === 'action' || parsed.actions) {
      const actions = parsed.actions;
      if (!actions || !Array.isArray(actions)) {
        return res.json({
          status: 'done',
          message: parsed.summary || parsed.message || 'AI 응답을 해석할 수 없습니다.',
        });
      }

      const validation = validateActions(actions);
      if (!validation.valid) {
        return res.json({ status: 'error', message: validation.error });
      }

      // query_data는 즉시 실행 (확인 불필요)
      const isAllQuery = actions.every(a => a.type === 'query_data');
      if (isAllQuery) {
        try {
          const allResults = [];
          const allData = [];
          for (const action of actions) {
            const result = await executeAction(action, academyId);
            allResults.push(result.message);
            if (result.data) allData.push(...(Array.isArray(result.data) ? result.data : [result.data]));
          }
          return res.json({
            status: 'done',
            message: allResults.join('\n') || '조회 완료',
            data: allData.length > 0 ? allData : null,
          });
        } catch (err) {
          return res.json({ status: 'error', message: err.message });
        }
      }

      // 나머지 액션은 확인 필요
      return res.json({
        status: 'pending',
        message: parsed.summary || '아래 작업을 확인해주세요.',
        actions,
      });
    }

    // fallback
    return res.json({
      status: 'done',
      message: parsed.message || parsed.summary || '요청을 처리했습니다.',
    });

  } catch (err) {
    console.error('[AI Parse Error]', err.message);
    if (err.message.includes('Gemini')) {
      return res.json({ status: 'error', message: `AI 서비스 오류: ${err.message}` });
    }
    if (err instanceof SyntaxError) {
      return res.json({ status: 'error', message: 'AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.' });
    }
    res.json({ status: 'error', message: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================
// POST /api/ai/execute
// ============================================================
router.post('/execute', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { actions } = req.body;
    const academyId = req.academyId;
    const validation = validateActions(actions);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const results = [];
    for (const action of actions) {
      try {
        const result = await executeAction(action, academyId);
        results.push(result);
      } catch (err) {
        console.error(`[AI Execute Error] ${action.type}:`, err.message);
        results.push({ success: false, message: `${ACTION_TYPES[action.type]?.description || action.type} 실패: ${err.message}` });
      }
    }

    const allSuccess = results.every(r => r.success);
    const message = results.map(r => r.message).join('\n');
    const allData = results.filter(r => r.data).flatMap(r => Array.isArray(r.data) ? r.data : [r.data]);

    res.json({ message, data: allData.length > 0 ? allData : null, results });
  } catch (err) {
    console.error('[AI Execute Error]', err.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================
// GET /api/ai/status - AI 상태 확인 및 실시간 요약
// ============================================================
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const ctx = await getRealtimeContext(academyId);
    const alerts = [];

    if (ctx.pendingUsers > 0) alerts.push(`📋 가입 승인 대기 ${ctx.pendingUsers}건`);
    if (ctx.pendingQna > 0) alerts.push(`❓ 미답변 질문 ${ctx.pendingQna}건`);
    if (ctx.clinicPending > 0) alerts.push(`🏥 클리닉 예약 대기 ${ctx.clinicPending}건`);
    if (ctx.homeworkPending > 0) alerts.push(`📚 숙제 확인 대기 ${ctx.homeworkPending}건`);

    res.json({
      totalStudents: ctx.totalStudents,
      alerts,
      topRanker: ctx.topRankers?.[0] || null,
      recentExam: ctx.recentExams?.[0] || null,
    });
  } catch (err) {
    res.json({ totalStudents: 0, alerts: [], topRanker: null, recentExam: null });
  }
});

// ============================================================
// 액션 실행 핸들러
// ============================================================

async function executeAction(action, academyId) {
  const { type, params } = action;
  switch (type) {
    case 'create_exam': return await executeCreateExam(params, academyId);
    case 'input_scores': return await executeInputScores(params, academyId);
    case 'create_code': return await executeCreateCode(params, academyId);
    case 'adjust_xp': return await executeAdjustXp(params, academyId);
    case 'create_notice': return await executeCreateNotice(params, academyId);
    case 'query_data': return await executeQueryData(params, academyId);
    default: return { success: false, message: `지원하지 않는 액션: ${type}` };
  }
}

// --- create_exam ---
async function executeCreateExam(params, academyId) {
  const { name, exam_type, max_score, exam_date, school, grade } = params;
  if (!name) throw new Error('시험명은 필수입니다.');
  const id = await runInsert(
    `INSERT INTO exams (name, exam_type, max_score, exam_date, school, grade, academy_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [name, exam_type || '기타', max_score || 100, exam_date || new Date().toISOString().split('T')[0], school || null, grade || null, academyId]
  );
  return { success: true, message: `✅ 시험 "${name}" 등록 완료! (ID: ${id})` };
}

// --- input_scores ---
async function executeInputScores(params, academyId) {
  const { exam_id, exam_name, scores } = params;
  if (!scores || !Array.isArray(scores) || scores.length === 0) throw new Error('입력할 성적 데이터가 없습니다.');

  let exam = null;
  if (exam_id) exam = await getOne('SELECT id, name FROM exams WHERE id = ? AND academy_id = ?', [exam_id, academyId]);
  else if (exam_name) exam = await getOne('SELECT id, name FROM exams WHERE name LIKE ? AND academy_id = ? ORDER BY id DESC LIMIT 1', [`%${exam_name}%`, academyId]);
  if (!exam) throw new Error(exam_id ? `시험 ID ${exam_id}를 찾을 수 없습니다.` : `"${exam_name}" 시험을 찾을 수 없습니다.`);

  let successCount = 0;
  const errors = [];

  for (const entry of scores) {
    try {
      const { student_name, score, note } = entry;
      if (!student_name) { errors.push('이름 누락'); continue; }
      // 이름으로 학생 찾기 (부분 매칭 지원)
      let student = await getOne(
        `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.name = ? AND s.academy_id = ?`, [student_name, academyId]
      );
      if (!student) {
        student = await getOne(
          `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.name LIKE ? AND s.academy_id = ?`, [`%${student_name}%`, academyId]
        );
      }
      if (!student) { errors.push(`"${student_name}" 미발견`); continue; }
      const existing = await getOne('SELECT id FROM scores WHERE student_id = ? AND exam_id = ? AND academy_id = ?', [student.id, exam.id, academyId]);
      if (existing) {
        await runQuery('UPDATE scores SET score = ?, note = ? WHERE id = ? AND academy_id = ?', [score, note || null, existing.id, academyId]);
      } else {
        await runInsert(`INSERT INTO scores (student_id, exam_id, score, note, academy_id) VALUES (?, ?, ?, ?, ?)`, [student.id, exam.id, score, note || null, academyId]);
      }
      successCount++;
    } catch (e) { errors.push(e.message); }
  }

  let message = `✅ ${exam.name} 성적 ${successCount}건 입력 완료!`;
  if (errors.length > 0) message += `\n⚠️ 오류 ${errors.length}건: ${errors.join(', ')}`;
  return { success: true, message };
}

// --- create_code ---
async function executeCreateCode(params, academyId) {
  const { code, xp_amount, max_uses, description, expires_days } = params;
  if (!code) throw new Error('코드를 입력해주세요.');
  if (!xp_amount && xp_amount !== 0) throw new Error('XP 지급량을 입력해주세요.');
  const existing = await getOne('SELECT id FROM redeem_codes WHERE code = ? AND academy_id = ?', [code, academyId]);
  if (existing) throw new Error(`이미 존재하는 코드: ${code}`);
  const days = expires_days || 7;
  const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + days);
  await runInsert(
    `INSERT INTO redeem_codes (code, xp_amount, max_uses, current_uses, description, expires_at, academy_id, created_at) VALUES (?, ?, ?, 0, ?, ?, ?, datetime('now'))`,
    [code, xp_amount, max_uses || 50, description || '', expiresAt.toISOString(), academyId]
  );
  return { success: true, message: `✅ 히든코드 "${code}" 생성! (${xp_amount}XP, ${max_uses || 50}회 사용 가능, ${days}일 유효)` };
}

// --- adjust_xp ---
async function executeAdjustXp(params, academyId) {
  const { student_name, xp_amount, points_amount, reason } = params;
  if (!student_name) throw new Error('학생 이름을 입력해주세요.');
  if (!xp_amount && !points_amount) throw new Error('XP 또는 포인트 조정값을 입력해주세요.');

  // 정확한 매칭 먼저, 없으면 부분 매칭
  let student = await getOne(`SELECT s.id, u.name FROM students s JOIN users u ON s.user_id = u.id WHERE u.name = ? AND s.academy_id = ?`, [student_name, academyId]);
  if (!student) {
    student = await getOne(`SELECT s.id, u.name FROM students s JOIN users u ON s.user_id = u.id WHERE u.name LIKE ? AND s.academy_id = ?`, [`%${student_name}%`, academyId]);
  }
  if (!student) throw new Error(`학생 "${student_name}" 미발견`);

  const charRow = await getOne('SELECT id, xp, points FROM student_characters WHERE student_id = ? AND academy_id = ?', [student.id, academyId]);
  if (!charRow) throw new Error(`"${student.name}" 캐릭터 데이터 없음 (게임 미시작)`);

  const parts = [];
  if (xp_amount) {
    await runQuery('UPDATE student_characters SET xp = MAX(0, xp + ?) WHERE student_id = ? AND academy_id = ?', [xp_amount, student.id, academyId]);
    parts.push(`XP ${xp_amount > 0 ? '+' : ''}${xp_amount}`);
    await runInsert(`INSERT INTO xp_logs (student_id, amount, source, description, academy_id, created_at) VALUES (?, ?, 'ai_assistant', ?, ?, datetime('now'))`, [student.id, xp_amount, reason || 'AI 어시스턴트 조정', academyId]);
  }
  if (points_amount) {
    await runQuery('UPDATE student_characters SET points = MAX(0, points + ?) WHERE student_id = ? AND academy_id = ?', [points_amount, student.id, academyId]);
    parts.push(`포인트 ${points_amount > 0 ? '+' : ''}${points_amount}`);
  }
  return { success: true, message: `✅ ${student.name}: ${parts.join(', ')} 조정 완료${reason ? ` (사유: ${reason})` : ''}` };
}

// --- create_notice ---
async function executeCreateNotice(params, academyId) {
  const { title, content, target_type, target_school } = params;
  if (!title) throw new Error('공지 제목 필수');
  if (!content) throw new Error('공지 내용 필수');
  const id = await runInsert(
    `INSERT INTO notices (title, content, target_type, target_school, academy_id, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [title, content, target_type || 'all', target_school || null, academyId]
  );
  return { success: true, message: `✅ 공지 "${title}" 등록! (ID: ${id}, 대상: ${target_type === 'school' ? target_school : '전체'})` };
}

// --- query_data ---
async function executeQueryData(params, academyId) {
  const { query_type, filters = {} } = params;

  switch (query_type) {
    case 'rankings': {
      const limit = filters.limit || 10;
      let sql = `SELECT sc.xp, sc.points, sc.level, u.name, s.school, s.grade
         FROM student_characters sc JOIN students s ON s.id = sc.student_id JOIN users u ON s.user_id = u.id
         WHERE sc.academy_id = ?`;
      const p = [academyId];
      if (filters.school) { sql += ' AND s.school = ?'; p.push(filters.school); }
      sql += ' ORDER BY sc.xp DESC LIMIT ?';
      p.push(limit);
      const rows = await getAll(sql, p);
      return {
        success: true,
        message: `🏆 XP 랭킹 Top ${rows.length}${filters.school ? ` (${filters.school})` : ''}`,
        data: rows.map((r, i) => ({ 순위: i + 1, 이름: r.name, 학교: r.school, 학년: r.grade || '', XP: r.xp, 포인트: r.points, 레벨: r.level || 1 }))
      };
    }
    case 'students': {
      let sql = `SELECT u.name, s.school, s.grade, s.phone, s.parent_name, s.memo, s.status
         FROM students s JOIN users u ON s.user_id = u.id WHERE s.academy_id = ?`;
      const p = [academyId];
      if (filters.school) { sql += ' AND s.school = ?'; p.push(filters.school); }
      if (filters.grade) { sql += ' AND s.grade = ?'; p.push(filters.grade); }
      if (filters.status) { sql += ' AND s.status = ?'; p.push(filters.status); }
      else { sql += " AND (s.status IS NULL OR s.status = 'active')"; }
      if (filters.name) { sql += ' AND u.name LIKE ?'; p.push(`%${filters.name}%`); }
      sql += ' ORDER BY s.school, s.grade, u.name LIMIT ?';
      p.push(filters.limit || 50);
      const rows = await getAll(sql, p);
      return {
        success: true,
        message: `📋 학생 ${rows.length}명 조회${filters.school ? ` (${filters.school})` : ''}`,
        data: rows.map(r => ({ 이름: r.name, 학교: r.school, 학년: r.grade || '', 연락처: r.phone || '-', 학부모: r.parent_name || '-', 메모: r.memo || '', 상태: r.status === 'inactive' ? '퇴원' : '재원' }))
      };
    }
    case 'exams': {
      let sql = 'SELECT id, name, exam_type, max_score, exam_date, school, grade FROM exams WHERE academy_id = ?';
      const p = [academyId];
      if (filters.school) { sql += ' AND school = ?'; p.push(filters.school); }
      sql += ' ORDER BY id DESC LIMIT ?';
      p.push(filters.limit || 10);
      const rows = await getAll(sql, p);
      return {
        success: true,
        message: `📝 시험 ${rows.length}건 조회`,
        data: rows.map(r => ({ ID: r.id, 시험명: r.name, 유형: r.exam_type, 만점: r.max_score, 날짜: r.exam_date || '미정', 학교: r.school || '전체', 학년: r.grade || '전체' }))
      };
    }
    case 'scores': {
      let examId = filters.exam_id;
      if (!examId && filters.exam_name) {
        const exam = await getOne('SELECT id FROM exams WHERE name LIKE ? AND academy_id = ? ORDER BY id DESC LIMIT 1', [`%${filters.exam_name}%`, academyId]);
        if (exam) examId = exam.id;
      }
      if (!examId) {
        const exam = await getOne('SELECT id FROM exams WHERE academy_id = ? ORDER BY id DESC LIMIT 1', [academyId]);
        if (!exam) return { success: true, message: '등록된 시험이 없습니다.', data: [] };
        examId = exam.id;
      }
      const examInfo = await getOne('SELECT name, max_score FROM exams WHERE id = ? AND academy_id = ?', [examId, academyId]);
      let sql = `SELECT u.name, s.school, s.grade, sc.score, sc.note FROM scores sc
         JOIN students s ON s.id = sc.student_id JOIN users u ON s.user_id = u.id
         WHERE sc.exam_id = ? AND sc.academy_id = ?`;
      const p = [examId, academyId];
      if (filters.school) { sql += ' AND s.school = ?'; p.push(filters.school); }
      sql += ' ORDER BY sc.score DESC';
      const rows = await getAll(sql, p);
      const avg = rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length * 10) / 10 : 0;
      return {
        success: true,
        message: `📊 ${examInfo?.name || ''} 성적 ${rows.length}건 (평균: ${avg}점/${examInfo?.max_score || 100}점)`,
        data: rows.map((r, i) => ({ 순위: i + 1, 이름: r.name, 학교: r.school, 학년: r.grade || '', 점수: r.score, 메모: r.note || '' }))
      };
    }
    case 'clinics': {
      const rows = await getAll(
        `SELECT ca.appointment_date, ca.time_slot, ca.topic, ca.status, u.name as student_name, s.school
         FROM clinic_appointments ca JOIN students s ON ca.student_id = s.id JOIN users u ON s.user_id = u.id
         WHERE ca.appointment_date >= date('now', '-7 days')
         AND ca.academy_id = ?
         ORDER BY ca.appointment_date DESC, ca.time_slot LIMIT 20`,
        [academyId]
      );
      return {
        success: true,
        message: `🏥 클리닉 예약 ${rows.length}건`,
        data: rows.map(r => ({ 날짜: r.appointment_date, 시간: r.time_slot || '', 학생: r.student_name, 학교: r.school, 주제: r.topic || '', 상태: r.status === 'pending' ? '대기' : r.status === 'confirmed' ? '확정' : r.status }))
      };
    }
    case 'notices': {
      const rows = await getAll('SELECT id, title, content, target_type, target_school, created_at FROM notices WHERE academy_id = ? ORDER BY created_at DESC LIMIT ?', [academyId, filters.limit || 10]);
      return {
        success: true,
        message: `📢 공지 ${rows.length}건`,
        data: rows.map(r => ({ ID: r.id, 제목: r.title, 내용: r.content?.slice(0, 50) + (r.content?.length > 50 ? '...' : ''), 대상: r.target_type === 'all' ? '전체' : r.target_school, 등록일: r.created_at?.slice(0, 10) }))
      };
    }
    case 'homework': {
      try {
        const rows = await getAll(
          `SELECT h.title, h.due_date, h.target_school,
             (SELECT COUNT(*) FROM homework_submissions hs WHERE hs.homework_id = h.id AND hs.academy_id = ?) as submitted,
             (SELECT COUNT(*) FROM homework_submissions hs WHERE hs.homework_id = h.id AND hs.status = 'pending' AND hs.academy_id = ?) as pending
           FROM homeworks h WHERE h.academy_id = ? ORDER BY h.created_at DESC LIMIT ?`, [academyId, academyId, academyId, filters.limit || 10]
        );
        return {
          success: true,
          message: `📚 숙제 ${rows.length}건`,
          data: rows.map(r => ({ 제목: r.title, 마감일: r.due_date || '미정', 대상: r.target_school || '전체', 제출: r.submitted || 0, 미확인: r.pending || 0 }))
        };
      } catch (e) {
        return { success: true, message: '숙제 데이터 조회 실패', data: [] };
      }
    }
    default:
      return { success: false, message: `지원하지 않는 조회: ${query_type}. 가능한 조회: rankings, students, exams, scores, clinics, notices, homework` };
  }
}

module.exports = router;
