const express = require('express');
const { getAll, getOne } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// ══════════════════════════════════════
// GET /owner — 원장/admin 대시보드
// ══════════════════════════════════════
router.get('/owner', async (req, res) => {
  try {
    const aid = req.academyId;
    const today = new Date().toISOString().slice(0, 10);

    // ── 1. today_summary ──
    const totalStudents = await getOne(
      `SELECT COUNT(*) AS cnt FROM students WHERE academy_id = ? AND status = 'active'`, [aid]
    );
    const newThisMonth = await getOne(
      `SELECT COUNT(*) AS cnt FROM students WHERE academy_id = ? AND enrolled_at >= date_trunc('month', CURRENT_DATE)`, [aid]
    );
    const withdrawnThisMonth = await getOne(
      `SELECT COUNT(*) AS cnt FROM students WHERE academy_id = ? AND withdrawn_at >= date_trunc('month', CURRENT_DATE)`, [aid]
    );

    // ── 2. attendance_today ──
    const attPresent = await getOne(
      `SELECT COUNT(*) AS cnt FROM attendance WHERE academy_id = ? AND date = ? AND status = 'present'`, [aid, today]
    );
    const attAbsent = await getOne(
      `SELECT COUNT(*) AS cnt FROM attendance WHERE academy_id = ? AND date = ? AND status = 'absent'`, [aid, today]
    );
    const attLate = await getOne(
      `SELECT COUNT(*) AS cnt FROM attendance WHERE academy_id = ? AND date = ? AND status = 'late'`, [aid, today]
    );
    const attExcused = await getOne(
      `SELECT COUNT(*) AS cnt FROM attendance WHERE academy_id = ? AND date = ? AND status = 'excused'`, [aid, today]
    );
    const totalActive = parseInt(totalStudents?.cnt || 0);
    const present = parseInt(attPresent?.cnt || 0);
    const absent = parseInt(attAbsent?.cnt || 0);
    const late = parseInt(attLate?.cnt || 0);
    const excused = parseInt(attExcused?.cnt || 0);
    const notChecked = Math.max(0, totalActive - (present + absent + late + excused));

    // ── 3. tuition_summary ──
    const thisMonthBilled = await getOne(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM tuition_records
       WHERE academy_id = ? AND due_date >= date_trunc('month', CURRENT_DATE)
       AND due_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`, [aid]
    );
    const thisMonthCollected = await getOne(
      `SELECT COALESCE(SUM(paid_amount), 0) AS total FROM tuition_records
       WHERE academy_id = ? AND paid_at >= date_trunc('month', CURRENT_DATE)
       AND paid_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`, [aid]
    );
    const outstandingTotal = await getOne(
      `SELECT COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) AS total
       FROM tuition_records WHERE academy_id = ? AND status IN ('pending', 'overdue')`, [aid]
    );
    const overdueCount = await getOne(
      `SELECT COUNT(*) AS cnt FROM tuition_records WHERE academy_id = ? AND status = 'overdue'`, [aid]
    );

    // ── 4. risk_alerts ──
    // 연속 결석 3회+ (최근 출석 기록 기반)
    const absenceAlerts = await getAll(
      `SELECT s.id AS student_id, u.name AS student_name, COUNT(*) AS streak
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
       WHERE a.academy_id = ? AND a.status = 'absent'
         AND a.date >= CURRENT_DATE - INTERVAL '14 days'
       GROUP BY s.id, u.name
       HAVING COUNT(*) >= 3
       ORDER BY streak DESC
       LIMIT 10`, [aid]
    );
    // 미납 2건+
    const tuitionAlerts = await getAll(
      `SELECT s.id AS student_id, u.name AS student_name, COUNT(*) AS overdue_count
       FROM tuition_records tr
       JOIN students s ON s.id = tr.student_id
       JOIN users u ON u.id = s.user_id
       WHERE tr.academy_id = ? AND tr.status IN ('pending', 'overdue') AND tr.due_date < CURRENT_DATE
       GROUP BY s.id, u.name
       HAVING COUNT(*) >= 2
       ORDER BY overdue_count DESC
       LIMIT 10`, [aid]
    );

    const riskAlerts = [
      ...absenceAlerts.map(a => ({
        type: 'consecutive_absence',
        student_name: a.student_name,
        student_id: a.student_id,
        message: `최근 2주간 ${a.streak}회 결석`,
        severity: parseInt(a.streak) >= 5 ? 'high' : 'medium',
      })),
      ...tuitionAlerts.map(t => ({
        type: 'overdue_tuition',
        student_name: t.student_name,
        student_id: t.student_id,
        message: `미납 ${t.overdue_count}건`,
        severity: parseInt(t.overdue_count) >= 3 ? 'high' : 'medium',
      })),
    ];

    // ── 5. tasks_summary ──
    const tasksPending = await getOne(
      `SELECT COUNT(*) AS cnt FROM task_queue WHERE academy_id = ? AND status = 'pending'`, [aid]
    );
    const tasksUrgent = await getOne(
      `SELECT COUNT(*) AS cnt FROM task_queue WHERE academy_id = ? AND priority = 'urgent' AND status = 'pending'`, [aid]
    );
    const tasksOverdue = await getOne(
      `SELECT COUNT(*) AS cnt FROM task_queue WHERE academy_id = ? AND due_date < NOW() AND status = 'pending'`, [aid]
    );

    // ── 6. recent_events ──
    const recentEvents = await getAll(
      `SELECT se.*, u.name AS student_name
       FROM student_events se
       LEFT JOIN students s ON s.id = se.student_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE se.academy_id = ?
       ORDER BY se.event_date DESC LIMIT 5`, [aid]
    );

    // ── 7. class_occupancy ──
    const classOccupancy = await getAll(
      `SELECT c.id, c.name, c.capacity,
         (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id AND cs.status = 'active') AS current_count
       FROM classes c
       WHERE c.academy_id = ? AND c.status = 'active'
       ORDER BY c.name`, [aid]
    );

    res.json({
      today_summary: {
        total_students: totalActive,
        new_this_month: parseInt(newThisMonth?.cnt || 0),
        withdrawn_this_month: parseInt(withdrawnThisMonth?.cnt || 0),
      },
      attendance_today: { present, absent, late, excused, not_checked: notChecked },
      tuition_summary: {
        this_month_billed: parseInt(thisMonthBilled?.total || 0),
        this_month_collected: parseInt(thisMonthCollected?.total || 0),
        outstanding_total: parseInt(outstandingTotal?.total || 0),
        overdue_count: parseInt(overdueCount?.cnt || 0),
      },
      risk_alerts: riskAlerts,
      tasks_summary: {
        pending: parseInt(tasksPending?.cnt || 0),
        urgent: parseInt(tasksUrgent?.cnt || 0),
        overdue: parseInt(tasksOverdue?.cnt || 0),
      },
      recent_events: recentEvents,
      class_occupancy: classOccupancy.map(c => ({
        id: c.id,
        name: c.name,
        current_count: parseInt(c.current_count || 0),
        capacity: c.capacity || 0,
        rate: c.capacity ? Math.round((parseInt(c.current_count || 0) / c.capacity) * 100) : 0,
      })),
    });
  } catch (err) {
    console.error('[Dashboard/owner]', err);
    res.status(500).json({ error: '대시보드 데이터 조회 실패' });
  }
});

// ══════════════════════════════════════
// GET /teacher — 강사용 대시보드
// ══════════════════════════════════════
router.get('/teacher', async (req, res) => {
  try {
    const userId = req.user.id;
    const aid = req.academyId;
    const today = new Date().toISOString().slice(0, 10);

    // 오늘 수업 목록
    const todayClasses = await getAll(
      `SELECT c.id, c.name, c.subject, c.room, cs.session_date, cs.start_time, cs.end_time, cs.status AS session_status,
         (SELECT COUNT(*) FROM class_students cst WHERE cst.class_id = c.id AND cst.status = 'active') AS student_count
       FROM class_sessions cs
       JOIN classes c ON c.id = cs.class_id
       WHERE cs.session_date = ? AND (c.teacher_id = ? OR cs.teacher_id = ?) AND cs.status != 'cancelled'
       ORDER BY cs.start_time`, [today, userId, userId]
    );

    // 출결 미입력 건수 (오늘 수업의 학생 중 출결 기록 없는 수)
    const attendancePending = await getOne(
      `SELECT COUNT(*) AS cnt FROM class_sessions cs
       JOIN classes c ON c.id = cs.class_id
       JOIN class_students cst ON cst.class_id = c.id AND cst.status = 'active'
       LEFT JOIN attendance a ON a.student_id = cst.student_id AND a.date = cs.session_date
         AND a.academy_id = ?
       WHERE cs.session_date = ? AND (c.teacher_id = ? OR cs.teacher_id = ?)
         AND cs.status != 'cancelled' AND a.id IS NULL`,
      [aid, today, userId, userId]
    );

    // 담당 반 학생 중 연속 결석 알림
    const studentAlerts = await getAll(
      `SELECT s.id AS student_id, u.name AS student_name, COUNT(*) AS absence_count
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
       JOIN class_students cst ON cst.student_id = s.id AND cst.status = 'active'
       JOIN classes c ON c.id = cst.class_id AND (c.teacher_id = ? OR c.academy_id = ?)
       WHERE a.academy_id = ? AND a.status = 'absent'
         AND a.date >= CURRENT_DATE - INTERVAL '14 days'
       GROUP BY s.id, u.name
       HAVING COUNT(*) >= 2
       ORDER BY absence_count DESC LIMIT 10`,
      [userId, aid, aid]
    );

    res.json({
      today_classes: todayClasses,
      attendance_pending: parseInt(attendancePending?.cnt || 0),
      student_alerts: studentAlerts.map(a => ({
        student_id: a.student_id,
        student_name: a.student_name,
        message: `최근 2주간 ${a.absence_count}회 결석`,
      })),
      homework_summary: { not_submitted_count: 0, checked_count: 0 },
    });
  } catch (err) {
    console.error('[Dashboard/teacher]', err);
    res.status(500).json({ error: '대시보드 데이터 조회 실패' });
  }
});

// ══════════════════════════════════════
// GET /counselor — 상담용 대시보드
// ══════════════════════════════════════
router.get('/counselor', async (req, res) => {
  try {
    const aid = req.academyId;
    const today = new Date().toISOString().slice(0, 10);

    // 오늘 예정 상담
    const todayConsultations = await getAll(
      `SELECT cl.*, u.name AS student_name
       FROM consultation_logs cl
       LEFT JOIN students s ON s.id = cl.student_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE cl.academy_id = ? AND cl.follow_up_date = ?
       ORDER BY cl.created_at DESC`, [aid, today]
    );

    // 후속조치 기한 도래
    const followUpDue = await getAll(
      `SELECT cl.*, u.name AS student_name
       FROM consultation_logs cl
       LEFT JOIN students s ON s.id = cl.student_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE cl.academy_id = ? AND cl.follow_up_date <= ? AND cl.follow_up_done = 0
       ORDER BY cl.follow_up_date ASC LIMIT 20`, [aid, today]
    );

    // 신규 문의
    const newInquiries = await getAll(
      `SELECT * FROM leads WHERE academy_id = ? AND status = 'new' ORDER BY created_at DESC LIMIT 20`, [aid]
    );

    // 전환 통계
    const thisMonthInquiries = await getOne(
      `SELECT COUNT(*) AS cnt FROM leads WHERE academy_id = ? AND created_at >= date_trunc('month', CURRENT_DATE)`, [aid]
    );
    const thisMonthEnrolled = await getOne(
      `SELECT COUNT(*) AS cnt FROM leads WHERE academy_id = ? AND status = 'converted' AND updated_at >= date_trunc('month', CURRENT_DATE)`, [aid]
    );
    const inquiries = parseInt(thisMonthInquiries?.cnt || 0);
    const enrolled = parseInt(thisMonthEnrolled?.cnt || 0);

    res.json({
      today_consultations: todayConsultations,
      follow_up_due: followUpDue,
      new_inquiries: newInquiries,
      conversion_stats: {
        this_month_inquiries: inquiries,
        this_month_enrolled: enrolled,
        conversion_rate: inquiries > 0 ? Math.round((enrolled / inquiries) * 100) : 0,
      },
    });
  } catch (err) {
    console.error('[Dashboard/counselor]', err);
    res.status(500).json({ error: '대시보드 데이터 조회 실패' });
  }
});

// ══════════════════════════════════════
// GET /staff — 행정용 대시보드
// ══════════════════════════════════════
router.get('/staff', async (req, res) => {
  try {
    const aid = req.academyId;
    const today = new Date().toISOString().slice(0, 10);

    // 오늘 수납 현황
    const dueToday = await getOne(
      `SELECT COUNT(*) AS cnt FROM tuition_records WHERE academy_id = ? AND due_date = ? AND status = 'pending'`, [aid, today]
    );
    const pendingConfirmation = await getOne(
      `SELECT COUNT(*) AS cnt FROM tuition_records WHERE academy_id = ? AND status = 'pending'`, [aid]
    );

    // 연체 목록 TOP 10
    const overdueList = await getAll(
      `SELECT tr.id, tr.amount, tr.paid_amount, tr.due_date, tr.status, u.name AS student_name, s.id AS student_id
       FROM tuition_records tr
       JOIN students s ON s.id = tr.student_id
       JOIN users u ON u.id = s.user_id
       WHERE tr.academy_id = ? AND tr.status = 'overdue'
       ORDER BY tr.due_date ASC LIMIT 10`, [aid]
    );

    // SMS 잔액
    const smsCredits = await getOne(
      `SELECT balance, total_used FROM sms_credits WHERE academy_id = ?`, [aid]
    );

    res.json({
      tuition_today: {
        due_today: parseInt(dueToday?.cnt || 0),
        pending_confirmation: parseInt(pendingConfirmation?.cnt || 0),
      },
      overdue_list: overdueList,
      sms_balance: {
        balance: parseInt(smsCredits?.balance || 0),
        total_used: parseInt(smsCredits?.total_used || 0),
      },
      settlement_status: { status: 'normal', message: '정상' },
    });
  } catch (err) {
    console.error('[Dashboard/staff]', err);
    res.status(500).json({ error: '대시보드 데이터 조회 실패' });
  }
});

module.exports = router;
