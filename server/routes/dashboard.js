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
    // role='student' 필터로 관리자/조교/선생님 제외
    const totalStudents = await getOne(
      `SELECT COUNT(*) AS cnt FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.academy_id = ? AND s.status = 'active' AND u.role = 'student'`, [aid]
    );
    const newThisMonth = await getOne(
      `SELECT COUNT(*) AS cnt FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.academy_id = ? AND u.role = 'student'
         AND s.enrolled_at >= date_trunc('month', CURRENT_DATE)`, [aid]
    );
    const withdrawnThisMonth = await getOne(
      `SELECT COUNT(*) AS cnt FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.academy_id = ? AND u.role = 'student'
         AND s.withdrawn_at >= date_trunc('month', CURRENT_DATE)`, [aid]
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

    // ── 8. today_tasks (마누스 IA: "오늘 할 일") ──
    // 우선순위별 태스크 생성 — 최대 10개
    const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 };

    // 8-1. 미납 tuition_records → urgent/high
    const overdueTuitions = await getAll(
      `SELECT tr.id, tr.amount, tr.paid_amount, tr.due_date, u.name AS student_name, s.id AS student_id,
              (CURRENT_DATE - tr.due_date) AS days_overdue
       FROM tuition_records tr
       JOIN students s ON s.id = tr.student_id
       JOIN users u ON u.id = s.user_id
       WHERE tr.academy_id = ? AND tr.status = 'overdue'
       ORDER BY tr.due_date ASC LIMIT 20`, [aid]
    );

    // 8-2. 오늘 결석 + 미통지 → high
    const absentNotNotified = await getAll(
      `SELECT a.id, u.name AS student_name, s.id AS student_id
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
       WHERE a.academy_id = ? AND a.date = ? AND a.status = 'absent'
         AND COALESCE(a.auto_notified, false) = false
       LIMIT 20`, [aid, today]
    );

    // 8-3. 상담 후속조치 기한 도래 → high
    const followUpsDue = await getAll(
      `SELECT cl.id, cl.consultation_type, cl.follow_up_date, u.name AS student_name, s.id AS student_id
       FROM consultation_logs cl
       LEFT JOIN students s ON s.id = cl.student_id
       LEFT JOIN users u ON u.id = s.user_id
       WHERE cl.academy_id = ? AND cl.follow_up_date <= ?
         AND COALESCE(cl.follow_up_done, 0) = 0
       ORDER BY cl.follow_up_date ASC LIMIT 20`, [aid, today]
    );

    // 8-4. task_queue pending
    const taskQueueItems = await getAll(
      `SELECT id, task_type, title, description, priority, due_date, related_student_id
       FROM task_queue
       WHERE academy_id = ? AND status = 'pending'
       ORDER BY
         CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         due_date ASC NULLS LAST
       LIMIT 20`, [aid]
    );

    const todayTasks = [];
    overdueTuitions.forEach(t => {
      const days = parseInt(t.days_overdue || 0);
      todayTasks.push({
        id: `tui-${t.id}`,
        type: 'tuition_overdue',
        priority: days >= 7 ? 'urgent' : 'high',
        title: `${t.student_name} 수강료 미납 (D+${days})`,
        description: `${parseInt(t.amount || 0).toLocaleString()}원 · 기한 ${t.due_date}`,
        action_label: '독촉 SMS',
        action_url: `/admin/tuition?student=${t.student_id}`,
      });
    });
    absentNotNotified.forEach(a => {
      todayTasks.push({
        id: `att-${a.id}`,
        type: 'absence_notify',
        priority: 'high',
        title: `${a.student_name} 오늘 결석 연락 필요`,
        description: '학부모 통지 미발송',
        action_label: '연락하기',
        action_url: `/admin/student-view/${a.student_id}`,
      });
    });
    followUpsDue.forEach(f => {
      todayTasks.push({
        id: `fu-${f.id}`,
        type: 'consultation_followup',
        priority: 'high',
        title: `${f.student_name || '미배정'} 상담 후속조치`,
        description: `${f.consultation_type || '상담'} · 기한 ${f.follow_up_date}`,
        action_label: '상담 기록',
        action_url: `/admin/consultation`,
      });
    });
    taskQueueItems.forEach(t => {
      todayTasks.push({
        id: `tq-${t.id}`,
        type: t.task_type || 'task',
        priority: t.priority || 'normal',
        title: t.title,
        description: t.description || '',
        action_label: '처리',
        action_url: '/admin/automation',
        related_student_id: t.related_student_id,
      });
    });

    todayTasks.sort((a, b) =>
      (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
    );
    const todayTasksTop = todayTasks.slice(0, 10);

    // ── 9. quick_actions (고정, 6종) ──
    const quickActions = [
      { label: '출결 입력', icon: 'how_to_reg', url: '/admin/attendance' },
      { label: '학생 추가', icon: 'person_add', url: '/admin/students' },
      { label: '수강료 청구', icon: 'receipt_long', url: '/admin/tuition' },
      { label: '공지 발송', icon: 'campaign', url: '/admin/sms' },
      { label: '상담 기록', icon: 'edit_note', url: '/admin/consultation' },
      { label: '메시지', icon: 'chat', url: '/admin/messages' },
    ];

    // ── 10. 최근 7일 평균 출결률 (비교용) ──
    const last7Att = await getOne(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('present','late')) AS ok,
         COUNT(*) AS total
       FROM attendance
       WHERE academy_id = ? AND date >= CURRENT_DATE - INTERVAL '7 days' AND date < CURRENT_DATE`, [aid]
    );
    const last7Total = parseInt(last7Att?.total || 0);
    const last7Rate = last7Total > 0 ? Math.round((parseInt(last7Att?.ok || 0) / last7Total) * 100) : 0;

    // ── 11. 다음 결제 예정일 ──
    const nextPayment = await getOne(
      `SELECT MIN(due_date) AS next_due FROM tuition_records
       WHERE academy_id = ? AND status = 'pending' AND due_date >= CURRENT_DATE`, [aid]
    );

    // ── 12. weekly_classes (이번 주 수업) ──
    const weeklyClasses = await getAll(
      `SELECT cs.session_date, cs.start_time, cs.end_time, cs.status,
              c.name AS class_name, c.class_type
       FROM class_sessions cs
       JOIN classes c ON c.id = cs.class_id
       WHERE c.academy_id = ?
         AND cs.session_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '6 days')
         AND cs.status != 'cancelled'
       ORDER BY cs.session_date, cs.start_time
       LIMIT 20`,
      [aid]
    ).catch(() => []);

    // ── 13. revenue_trend (최근 6개월 매출) ──
    const revenueTrend = await getAll(
      `SELECT TO_CHAR(paid_at, 'MM') || '월' AS month,
              COALESCE(SUM(paid_amount), 0)::int AS amount
       FROM tuition_records
       WHERE academy_id = ? AND paid_at IS NOT NULL
         AND paid_at >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(paid_at, 'YYYY-MM'), TO_CHAR(paid_at, 'MM')
       ORDER BY TO_CHAR(paid_at, 'YYYY-MM')`,
      [aid]
    ).catch(() => []);

    const attTotal = present + absent + late + excused;

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
        collection_rate: parseInt(thisMonthBilled?.total || 0) > 0
          ? Math.round((parseInt(thisMonthCollected?.total || 0) / parseInt(thisMonthBilled?.total || 0)) * 100)
          : 0,
        next_payment_date: nextPayment?.next_due || null,
      },
      attendance_trend: {
        today_rate: attTotal > 0 ? Math.round(((present + late) / attTotal) * 100) : 0,
        last7_rate: last7Rate,
      },
      risk_alerts: riskAlerts,
      tasks_summary: {
        pending: parseInt(tasksPending?.cnt || 0),
        urgent: parseInt(tasksUrgent?.cnt || 0),
        overdue: parseInt(tasksOverdue?.cnt || 0),
      },
      today_tasks: todayTasksTop,
      today_tasks_total: todayTasks.length,
      quick_stats: {
        students_active: totalActive,
        attendance_rate_today: attTotal > 0 ? Math.round(((present + late) / attTotal) * 100) : 0,
        tuition_collected_month: parseInt(thisMonthCollected?.total || 0),
        tuition_outstanding: parseInt(outstandingTotal?.total || 0),
      },
      quick_actions: quickActions,
      recent_events: recentEvents,
      class_occupancy: classOccupancy.map(c => ({
        id: c.id,
        name: c.name,
        current_count: parseInt(c.current_count || 0),
        capacity: c.capacity || 0,
        rate: c.capacity ? Math.round((parseInt(c.current_count || 0) / c.capacity) * 100) : 0,
      })),
      weekly_classes: weeklyClasses,
      revenue_trend: revenueTrend,
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

    // today_tasks: 출결 미입력 건 + 연속 결석 알림
    const todayTasks = [];
    const attPendingCnt = parseInt(attendancePending?.cnt || 0);
    if (attPendingCnt > 0) {
      todayTasks.push({
        id: 'att-pending',
        type: 'attendance_pending',
        priority: 'urgent',
        title: `출결 미입력 ${attPendingCnt}건`,
        description: '오늘 수업 출결을 입력하세요',
        action_label: '출결 입력',
        action_url: '/admin/attendance',
      });
    }
    todayClasses.forEach(c => {
      todayTasks.push({
        id: `cls-${c.id}`,
        type: 'class_today',
        priority: 'normal',
        title: `${c.name} 수업`,
        description: `${(c.start_time || '').slice(0, 5)}~${(c.end_time || '').slice(0, 5)} · ${c.student_count || 0}명`,
        action_label: '출결',
        action_url: '/admin/attendance',
      });
    });
    studentAlerts.forEach(a => {
      todayTasks.push({
        id: `alert-${a.student_id}`,
        type: 'absence_alert',
        priority: 'high',
        title: `${a.student_name} 연속 결석`,
        description: `최근 2주간 ${a.absence_count}회 결석`,
        action_label: '학생 보기',
        action_url: `/admin/student-view/${a.student_id}`,
      });
    });

    res.json({
      today_classes: todayClasses,
      attendance_pending: attPendingCnt,
      student_alerts: studentAlerts.map(a => ({
        student_id: a.student_id,
        student_name: a.student_name,
        message: `최근 2주간 ${a.absence_count}회 결석`,
      })),
      homework_summary: { not_submitted_count: 0, checked_count: 0 },
      today_tasks: todayTasks.slice(0, 10),
      today_tasks_total: todayTasks.length,
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

    const todayTasks = [];
    followUpDue.forEach(c => {
      todayTasks.push({
        id: `fu-${c.id}`,
        type: 'consultation_followup',
        priority: 'high',
        title: `${c.student_name || '미배정'} 후속조치`,
        description: `${c.consultation_type || '상담'} · 기한 ${c.follow_up_date}`,
        action_label: '상담 기록',
        action_url: '/admin/consultation',
      });
    });
    todayConsultations.forEach(c => {
      todayTasks.push({
        id: `tc-${c.id}`,
        type: 'consultation_today',
        priority: 'normal',
        title: `${c.student_name || '미배정'} 오늘 상담`,
        description: c.consultation_type || '상담 예정',
        action_label: '열기',
        action_url: '/admin/consultation',
      });
    });
    newInquiries.slice(0, 5).forEach(lead => {
      todayTasks.push({
        id: `lead-${lead.id}`,
        type: 'new_lead',
        priority: 'normal',
        title: `신규 문의: ${lead.student_name}`,
        description: `${lead.school || ''} ${lead.grade || ''} ${lead.source ? '· ' + lead.source : ''}`.trim(),
        action_label: '리드 보기',
        action_url: '/admin/leads',
      });
    });

    res.json({
      today_consultations: todayConsultations,
      follow_up_due: followUpDue,
      new_inquiries: newInquiries,
      conversion_stats: {
        this_month_inquiries: inquiries,
        this_month_enrolled: enrolled,
        conversion_rate: inquiries > 0 ? Math.round((enrolled / inquiries) * 100) : 0,
      },
      today_tasks: todayTasks.slice(0, 10),
      today_tasks_total: todayTasks.length,
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

    const todayTasks = [];
    const dueTodayCnt = parseInt(dueToday?.cnt || 0);
    if (dueTodayCnt > 0) {
      todayTasks.push({
        id: 'due-today',
        type: 'tuition_due_today',
        priority: 'urgent',
        title: `오늘 납부 기한 ${dueTodayCnt}건`,
        description: '입금 확인 필요',
        action_label: '수납 확인',
        action_url: '/admin/tuition',
      });
    }
    overdueList.forEach(t => {
      const days = Math.max(0, Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000));
      todayTasks.push({
        id: `ov-${t.id}`,
        type: 'tuition_overdue',
        priority: days >= 7 ? 'urgent' : 'high',
        title: `${t.student_name} 미납 D+${days}`,
        description: `${parseInt(t.amount || 0).toLocaleString()}원`,
        action_label: '독촉 SMS',
        action_url: `/admin/tuition?student=${t.student_id}`,
      });
    });

    res.json({
      tuition_today: {
        due_today: dueTodayCnt,
        pending_confirmation: parseInt(pendingConfirmation?.cnt || 0),
      },
      overdue_list: overdueList,
      sms_balance: {
        balance: parseInt(smsCredits?.balance || 0),
        total_used: parseInt(smsCredits?.total_used || 0),
      },
      settlement_status: { status: 'normal', message: '정상' },
      today_tasks: todayTasks.slice(0, 10),
      today_tasks_total: todayTasks.length,
    });
  } catch (err) {
    console.error('[Dashboard/staff]', err);
    res.status(500).json({ error: '대시보드 데이터 조회 실패' });
  }
});

module.exports = router;
