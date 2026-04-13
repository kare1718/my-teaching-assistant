const express = require('express');
const { getAll, getOne, runQuery, runInsert } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ── 보호자 role 체크 미들웨어 ──
function requireParent(req, res, next) {
  if (req.user.role !== 'parent') {
    return res.status(403).json({ error: '보호자 전용 기능입니다.' });
  }
  next();
}

router.use(requireParent);

// ── 헬퍼: 부모-자녀 관계 검증 ──
async function verifyParentChild(parentUserId, studentId, academyId) {
  const row = await getOne(
    `SELECT sp.id FROM student_parents sp
     JOIN parents p ON p.id = sp.parent_id
     WHERE p.user_id = ? AND sp.student_id = ? AND p.academy_id = ?`,
    [parentUserId, studentId, academyId]
  );
  return !!row;
}

// ══════════════════════════════════════════════
// GET /children — 내 자녀 목록
// ══════════════════════════════════════════════
router.get('/children', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT s.id, u.name, s.school, s.grade, s.status
       FROM students s
       JOIN users u ON u.id = s.user_id
       JOIN student_parents sp ON sp.student_id = s.id
       JOIN parents p ON p.id = sp.parent_id
       WHERE p.user_id = ? AND p.academy_id = ?`,
      [req.user.id, req.academyId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[보호자앱] 자녀 목록 오류:', err.message);
    res.status(500).json({ error: '자녀 목록 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// GET /children/:studentId/summary — 자녀 요약
// ══════════════════════════════════════════════
router.get('/children/:studentId/summary', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    if (!await verifyParentChild(req.user.id, studentId, req.academyId)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    // 이번주 출석률 + 오늘 출결
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const weekAttendance = await getAll(
      `SELECT status FROM attendance
       WHERE student_id = ? AND date >= ?`,
      [studentId, weekStartStr]
    );
    const totalWeek = weekAttendance.length;
    const presentWeek = weekAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const weekRate = totalWeek > 0 ? Math.round((presentWeek / totalWeek) * 100) : null;

    const todayAttendance = await getOne(
      `SELECT status, check_in_at FROM attendance WHERE student_id = ? AND date = ?`,
      [studentId, today]
    );

    // 미납 정보
    const unpaid = await getAll(
      `SELECT id, amount, due_date, adjusted_amount FROM tuition_records
       WHERE student_id = ? AND academy_id = ? AND status IN ('pending', 'overdue')
       ORDER BY due_date ASC`,
      [studentId, req.academyId]
    );
    const unpaidTotal = unpaid.reduce((sum, r) => sum + (r.adjusted_amount || r.amount), 0);
    const nextDue = unpaid.length > 0 ? unpaid[0].due_date : null;

    // 최근 시험
    const recentScore = await getOne(
      `SELECT sc.score, sc.rank, e.name AS exam_name, e.date AS exam_date, e.total_score
       FROM scores sc
       JOIN exams e ON e.id = sc.exam_id
       WHERE sc.student_id = ?
       ORDER BY e.date DESC NULLS LAST, sc.created_at DESC
       LIMIT 1`,
      [studentId]
    );

    // 마지막 상담일
    const lastConsultation = await getOne(
      `SELECT created_at FROM consultation_logs
       WHERE student_id = ? AND academy_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [studentId, req.academyId]
    );

    res.json({
      attendance_summary: {
        week_rate: weekRate,
        today_status: todayAttendance ? todayAttendance.status : null,
        today_check_in: todayAttendance ? todayAttendance.check_in_at : null,
      },
      tuition_summary: {
        has_unpaid: unpaid.length > 0,
        unpaid_count: unpaid.length,
        unpaid_total: unpaidTotal,
        next_due: nextDue,
      },
      recent_score: recentScore || null,
      last_consultation: lastConsultation ? lastConsultation.created_at : null,
    });
  } catch (err) {
    console.error('[보호자앱] 자녀 요약 오류:', err.message);
    res.status(500).json({ error: '자녀 요약 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// GET /children/:studentId/attendance — 출결 이력
// ══════════════════════════════════════════════
router.get('/children/:studentId/attendance', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    if (!await verifyParentChild(req.user.id, studentId, req.academyId)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const { month } = req.query; // YYYY-MM
    let dateFilter = '';
    const params = [studentId];

    if (month) {
      dateFilter = " AND TO_CHAR(date, 'YYYY-MM') = ?";
      params.push(month);
    }

    const rows = await getAll(
      `SELECT id, date, status, check_in_at, memo
       FROM attendance
       WHERE student_id = ?${dateFilter}
       ORDER BY date DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[보호자앱] 출결 이력 오류:', err.message);
    res.status(500).json({ error: '출결 이력 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// GET /children/:studentId/tuition — 수납 이력 + 미납
// ══════════════════════════════════════════════
router.get('/children/:studentId/tuition', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    if (!await verifyParentChild(req.user.id, studentId, req.academyId)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const rows = await getAll(
      `SELECT tr.id, tr.amount, tr.adjusted_amount, tr.due_date, tr.status,
              tr.paid_at, tr.payment_method, tr.payment_token,
              tp.name AS plan_name
       FROM tuition_records tr
       LEFT JOIN tuition_plans tp ON tp.id = tr.plan_id
       WHERE tr.student_id = ? AND tr.academy_id = ?
       ORDER BY tr.due_date DESC`,
      [studentId, req.academyId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[보호자앱] 수납 이력 오류:', err.message);
    res.status(500).json({ error: '수납 이력 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// GET /children/:studentId/scores — 성적 목록
// ══════════════════════════════════════════════
router.get('/children/:studentId/scores', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    if (!await verifyParentChild(req.user.id, studentId, req.academyId)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const rows = await getAll(
      `SELECT sc.id, sc.score, sc.rank, sc.memo,
              e.name AS exam_name, e.exam_type, e.date AS exam_date, e.total_score
       FROM scores sc
       JOIN exams e ON e.id = sc.exam_id
       WHERE sc.student_id = ?
       ORDER BY e.date DESC NULLS LAST, sc.created_at DESC`,
      [studentId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[보호자앱] 성적 목록 오류:', err.message);
    res.status(500).json({ error: '성적 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// GET /children/:studentId/timeline — 타임라인
// ══════════════════════════════════════════════
router.get('/children/:studentId/timeline', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    if (!await verifyParentChild(req.user.id, studentId, req.academyId)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const rows = await getAll(
      `SELECT id, event_type, event_date, title, description
       FROM student_events
       WHERE student_id = ? AND academy_id = ?
       ORDER BY event_date DESC
       LIMIT 20`,
      [studentId, req.academyId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[보호자앱] 타임라인 오류:', err.message);
    res.status(500).json({ error: '타임라인 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// GET /notices — 학원 공지
// ══════════════════════════════════════════════
router.get('/notices', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT n.id, n.title, n.content, n.is_pinned, n.created_at,
              CASE WHEN nr.id IS NOT NULL THEN true ELSE false END AS is_read
       FROM notices n
       LEFT JOIN notice_reads nr ON nr.notice_id = n.id AND nr.user_id = ?
       WHERE n.academy_id = ?
       ORDER BY n.is_pinned DESC, n.created_at DESC`,
      [req.user.id, req.academyId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[보호자앱] 공지 목록 오류:', err.message);
    res.status(500).json({ error: '공지 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// POST /notices/:id/read — 공지 읽음
// ══════════════════════════════════════════════
router.post('/notices/:id/read', async (req, res) => {
  try {
    const noticeId = parseInt(req.params.id);
    // UPSERT: 이미 읽었으면 무시
    await runQuery(
      `INSERT INTO notice_reads (notice_id, user_id)
       VALUES (?, ?)
       ON CONFLICT (notice_id, user_id) DO NOTHING`,
      [noticeId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[보호자앱] 공지 읽음 오류:', err.message);
    res.status(500).json({ error: '공지 읽음 처리 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// POST /inquiry — 문의 보내기
// ══════════════════════════════════════════════
router.post('/inquiry', async (req, res) => {
  try {
    const { content, student_id } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '문의 내용을 입력해주세요.' });
    }

    // student_id가 있으면 자녀 검증
    if (student_id) {
      if (!await verifyParentChild(req.user.id, student_id, req.academyId)) {
        return res.status(403).json({ error: '접근 권한이 없습니다.' });
      }
    }

    const id = await runInsert(
      `INSERT INTO questions (student_id, title, content, academy_id, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [student_id || null, '보호자 문의', content.trim(), req.academyId]
    );

    res.json({ id, message: '문의가 접수되었습니다.' });
  } catch (err) {
    console.error('[보호자앱] 문의 오류:', err.message);
    res.status(500).json({ error: '문의 접수 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// GET /children/:studentId/tuition/:recordId/pay-info — 결제 정보
// ══════════════════════════════════════════════
router.get('/children/:studentId/tuition/:recordId/pay-info', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const recordId = parseInt(req.params.recordId);
    if (!await verifyParentChild(req.user.id, studentId, req.academyId)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const record = await getOne(
      `SELECT tr.id, tr.amount, tr.adjusted_amount, tr.due_date, tr.status, tr.payment_token,
              tp.name AS plan_name
       FROM tuition_records tr
       LEFT JOIN tuition_plans tp ON tp.id = tr.plan_id
       WHERE tr.id = ? AND tr.student_id = ? AND tr.academy_id = ?`,
      [recordId, studentId, req.academyId]
    );
    if (!record) return res.status(404).json({ error: '수납 내역을 찾을 수 없습니다.' });

    res.json(record);
  } catch (err) {
    console.error('[보호자앱] 결제 정보 오류:', err.message);
    res.status(500).json({ error: '결제 정보 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// GET /consent — 수신 동의 상태
// ══════════════════════════════════════════════
router.get('/consent', async (req, res) => {
  try {
    // parent 찾기
    const parent = await getOne(
      'SELECT id FROM parents WHERE user_id = ? AND academy_id = ?',
      [req.user.id, req.academyId]
    );
    if (!parent) return res.json({ marketing_consent: false });

    const consent = await getOne(
      'SELECT marketing_consent, consented_at, consent_method FROM message_consent WHERE parent_id = ? AND academy_id = ?',
      [parent.id, req.academyId]
    );
    res.json(consent || { marketing_consent: false });
  } catch (err) {
    console.error('[보호자앱] 수신 동의 조회 오류:', err.message);
    res.status(500).json({ error: '수신 동의 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════════════
// PUT /consent — 수신 동의/철회
// ══════════════════════════════════════════════
router.put('/consent', async (req, res) => {
  try {
    const { marketing_consent } = req.body;

    const parent = await getOne(
      'SELECT id FROM parents WHERE user_id = ? AND academy_id = ?',
      [req.user.id, req.academyId]
    );
    if (!parent) return res.status(404).json({ error: '보호자 정보를 찾을 수 없습니다.' });

    const existing = await getOne(
      'SELECT id FROM message_consent WHERE parent_id = ? AND academy_id = ?',
      [parent.id, req.academyId]
    );

    if (existing) {
      await runQuery(
        `UPDATE message_consent SET marketing_consent = ?, consented_at = NOW(), consent_method = 'online'
         WHERE parent_id = ? AND academy_id = ?`,
        [!!marketing_consent, parent.id, req.academyId]
      );
    } else {
      await runInsert(
        `INSERT INTO message_consent (academy_id, parent_id, marketing_consent, consented_at, consent_method)
         VALUES (?, ?, ?, NOW(), 'online')`,
        [req.academyId, parent.id, !!marketing_consent]
      );
    }

    res.json({ success: true, marketing_consent: !!marketing_consent });
  } catch (err) {
    console.error('[보호자앱] 수신 동의 변경 오류:', err.message);
    res.status(500).json({ error: '수신 동의 변경 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
