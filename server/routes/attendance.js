const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendToParent } = require('../services/notification');
const { addEvent } = require('../services/timeline');
const { logAction } = require('../services/audit');
const { track, trackFirst } = require('../services/analytics');

const router = express.Router();
router.use(authenticateToken);

// ══════════════════════════════════════
// 헬퍼: 출결 정책 조회 (없으면 기본값)
// ══════════════════════════════════════
async function getAttendanceRules(academyId) {
  const rules = await getOne(
    'SELECT * FROM attendance_rules WHERE academy_id = ?',
    [academyId]
  );
  return rules || {
    late_threshold_minutes: 10,
    absence_alert_enabled: true,
    absence_alert_delay_minutes: 30,
    auto_parent_notify: true,
    consecutive_absence_alert: 3,
    makeup_deadline_days: 14,
  };
}

// ══════════════════════════════════════
// 학생용 엔드포인트
// ══════════════════════════════════════

// 학생 출석 체크 (PIN 코드) — class_session_id 지원 + 자동 지각 판정
router.post('/check-in', async (req, res) => {
  try {
    const { code, student_id, method, class_session_id } = req.body;
    const academyId = req.academyId;
    const today = new Date().toISOString().slice(0, 10);

    let targetStudentId;

    if (req.user.role === 'student') {
      const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
      if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

      if (code) {
        const validCode = await getOne(
          "SELECT setting_value FROM clinic_settings WHERE setting_key = 'attendance_code' AND academy_id = ?",
          [academyId]
        );
        if (!validCode || validCode.setting_value !== code) {
          return res.status(400).json({ error: '출석 코드가 올바르지 않습니다.' });
        }
      }
      targetStudentId = student.id;
    } else if (req.user.role === 'admin' || req.user.school === '조교' || req.user.school === '선생님') {
      if (!student_id) return res.status(400).json({ error: 'student_id는 필수입니다.' });
      targetStudentId = student_id;
    } else {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const validMethods = ['number', 'qr', 'manual'];
    const checkMethod = validMethods.includes(method) ? method : (code ? 'number' : 'manual');

    const existing = await getOne(
      'SELECT id FROM attendance WHERE academy_id = ? AND student_id = ? AND date = ?',
      [academyId, targetStudentId, today]
    );
    if (existing) return res.status(400).json({ error: '이미 오늘 체크인 되었습니다.' });

    // 자동 지각 판정: class_session_id가 있으면 수업 시작시간 + threshold 비교
    let status = 'present';
    if (class_session_id) {
      const session = await getOne(
        'SELECT start_time FROM class_sessions WHERE id = ? AND academy_id = ?',
        [class_session_id, academyId]
      );
      if (session) {
        const rules = await getAttendanceRules(academyId);
        const now = new Date();
        const [h, m] = session.start_time.split(':').map(Number);
        const sessionStart = new Date(now);
        sessionStart.setHours(h, m, 0, 0);
        const diffMinutes = (now - sessionStart) / 60000;
        if (diffMinutes > rules.late_threshold_minutes) {
          status = 'late';
        }
      }
    }

    const id = await runInsert(
      `INSERT INTO attendance (academy_id, student_id, date, check_in_at, method, status, class_session_id)
       VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
      [academyId, targetStudentId, today, checkMethod, status, class_session_id || null]
    );

    sendToParent(academyId, targetStudentId, '자녀가 학원에 등원했습니다.', 'attendance').catch(() => {});

    // 타임라인 이벤트
    const statusLabel = status === 'present' ? '출석' : status === 'late' ? '지각' : status;
    addEvent(academyId, targetStudentId, status === 'present' ? 'attendance' : status === 'late' ? 'late' : 'attendance',
      `${statusLabel} 체크인`, null, { attendance_id: id, status }, req.user?.id
    ).catch(e => console.error('[timeline]', e.message));

    // [KPI] first_attendance + feature_used
    trackFirst(req, 'first_attendance', { student_id: targetStudentId }).catch(() => {});
    track(req, 'feature_used', { feature: 'attendance.check_in', method: checkMethod, status }).catch(() => {});

    res.json({ id, status, message: status === 'late' ? '지각 처리되었습니다.' : '출석이 확인되었습니다!' });
  } catch (err) {
    console.error('[출결 체크인 오류]', err.message);
    res.status(500).json({ error: '출석 처리 중 오류가 발생했습니다.' });
  }
});

// 학생 본인 출결 이력
router.get('/student/me', async (req, res) => {
  try {
    const academyId = req.academyId;
    const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, academyId]);
    if (!student) return res.json([]);

    const rows = await getAll(
      `SELECT date, check_in_at as check_in_time, check_out_at, method,
              CASE WHEN check_in_at IS NOT NULL THEN 'present' ELSE 'absent' END as status
       FROM attendance
       WHERE academy_id = ? AND student_id = ?
       ORDER BY date DESC LIMIT 30`,
      [academyId, student.id]
    );

    res.json(rows);
  } catch (err) {
    console.error('[출결 이력 오류]', err.message);
    res.status(500).json({ error: '출결 이력 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════
// 관리자용 엔드포인트
// ══════════════════════════════════════

// 학생 하원 체크
router.post('/check-out', requireAdmin, async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id는 필수입니다.' });

    const academyId = req.academyId;
    const today = new Date().toISOString().slice(0, 10);

    const record = await getOne(
      'SELECT id FROM attendance WHERE academy_id = ? AND student_id = ? AND date = ? AND check_out_at IS NULL',
      [academyId, student_id, today]
    );
    if (!record) return res.status(404).json({ error: '오늘 체크인 기록이 없거나 이미 하원 처리되었습니다.' });

    await runQuery('UPDATE attendance SET check_out_at = NOW() WHERE id = ? AND academy_id = ?', [record.id, academyId]);

    sendToParent(academyId, student_id, '자녀가 학원에서 하원했습니다.', 'attendance').catch(() => {});

    res.json({ message: '체크아웃 완료' });
  } catch (err) {
    console.error('[하원 처리 오류]', err.message);
    res.status(500).json({ error: '하원 처리 중 오류가 발생했습니다.' });
  }
});

// 오늘 출결 현황
router.get('/today', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const rows = await getAll(`
      SELECT s.id as student_id, u.name, s.school, s.grade,
             a.id as attendance_id, a.check_in_at, a.check_out_at, a.method,
             a.status, a.class_session_id, a.makeup_status
      FROM students s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ? AND a.academy_id = ?
      WHERE (s.status IS NULL OR s.status = 'active') AND s.academy_id = ?
      ORDER BY s.school, s.grade, u.name
    `, [date, academyId, academyId]);

    const total = rows.length;
    const present = rows.filter(r => r.check_in_at).length;
    const late = rows.filter(r => r.status === 'late').length;

    res.json({ date, total, present, absent: total - present, late, students: rows });
  } catch (err) {
    console.error('[출결 현황 오류]', err.message);
    res.status(500).json({ error: '출결 현황 조회 중 오류가 발생했습니다.' });
  }
});

// 미출석자 목록
router.get('/absent', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const rows = await getAll(`
      SELECT s.id, u.name, s.school, s.grade, s.parent_phone
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE (s.status IS NULL OR s.status = 'active') AND s.academy_id = ?
        AND s.id NOT IN (
          SELECT student_id FROM attendance WHERE academy_id = ? AND date = ?
        )
      ORDER BY s.school, s.grade, u.name
    `, [academyId, academyId, date]);

    res.json(rows);
  } catch (err) {
    console.error('[미출석 조회 오류]', err.message);
    res.status(500).json({ error: '미출석 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 월간 출결 통계
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'year, month 파라미터가 필요합니다.' });

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    // 일별 통계
    const daily = await getAll(`
      SELECT a.date as day,
             COUNT(DISTINCT a.student_id) as present,
             (SELECT COUNT(*) FROM students WHERE academy_id = ? AND (status IS NULL OR status = 'active')) as total
      FROM attendance a
      WHERE a.academy_id = ? AND a.date BETWEEN ? AND ?
      GROUP BY a.date
      ORDER BY a.date
    `, [academyId, academyId, startDate, endDate]);

    const totalStudents = await getOne(
      "SELECT COUNT(*) as count FROM students WHERE academy_id = ? AND (status IS NULL OR status = 'active')",
      [academyId]
    );
    const totalCount = totalStudents?.count || 0;

    // 일별 데이터를 day 번호로 변환
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyStats = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const found = daily.find(r => {
        const rDate = typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10);
        return rDate === dateStr;
      });
      dailyStats.push({
        day: d,
        present: found ? Number(found.present) : 0,
        total: totalCount,
      });
    }

    const totalPresent = dailyStats.reduce((sum, d) => sum + d.present, 0);
    const totalPossible = dailyStats.filter(d => d.present > 0).length * totalCount;
    const average = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;

    res.json({ year, month, daily: dailyStats, average });
  } catch (err) {
    console.error('[출결 통계 오류]', err.message);
    res.status(500).json({ error: '출결 통계 조회 중 오류가 발생했습니다.' });
  }
});

// 특정 학생 출결 이력
router.get('/student/:id', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const studentId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;

    const rows = await getAll(
      'SELECT * FROM attendance WHERE academy_id = ? AND student_id = ? ORDER BY date DESC LIMIT ? OFFSET ?',
      [academyId, studentId, limit, offset]
    );

    const countRow = await getOne(
      'SELECT COUNT(*) as total FROM attendance WHERE academy_id = ? AND student_id = ?',
      [academyId, studentId]
    );

    res.json({ records: rows, total: countRow?.total || 0, page, limit });
  } catch (err) {
    console.error('[학생 출결 이력 오류]', err.message);
    res.status(500).json({ error: '출결 이력 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════
// 출결 정정 (이력 기록 포함)
// ══════════════════════════════════════

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const attendanceId = req.params.id;
    const { status, change_reason } = req.body;

    if (!status) return res.status(400).json({ error: 'status는 필수입니다.' });

    const existing = await getOne(
      'SELECT id, status, student_id, date FROM attendance WHERE id = ? AND academy_id = ?',
      [attendanceId, academyId]
    );
    if (!existing) return res.status(404).json({ error: '출결 기록을 찾을 수 없습니다.' });

    const previousStatus = existing.status || 'present';

    // 출결 상태 업데이트
    await runQuery(
      'UPDATE attendance SET status = ?, modified_by = ?, modified_at = NOW(), modification_reason = ? WHERE id = ? AND academy_id = ?',
      [status, req.user.id, change_reason || null, attendanceId, academyId]
    );

    // 정정 이력 저장
    await runInsert(
      'INSERT INTO attendance_logs (attendance_id, previous_status, new_status, changed_by, change_reason) VALUES (?, ?, ?, ?, ?)',
      [attendanceId, previousStatus, status, req.user.id, change_reason || null]
    );

    // 출결 정정 후 자동화 트리거 (결석으로 변경 시)
    if (status === 'absent') {
      const { onAttendanceMarked } = require('../services/automation');
      const dateStr = existing.date ? (typeof existing.date === 'string' ? existing.date.slice(0, 10) : new Date(existing.date).toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
      onAttendanceMarked(academyId, { student_id: existing.student_id, status, date: dateStr }).catch(e => console.error('[자동화] 출결 트리거 오류:', e.message));
    }

    await logAction({
      req, action: 'attendance_modify', resourceType: 'attendance', resourceId: parseInt(attendanceId),
      before: { status: previousStatus }, after: { status, change_reason: change_reason || null },
    });
    res.json({ message: '출결 상태가 수정되었습니다.', previous: previousStatus, current: status });
  } catch (err) {
    console.error('[출결 정정 오류]', err.message);
    res.status(500).json({ error: '출결 정정 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════
// 출결 정책 (Rules)
// ══════════════════════════════════════

// 출결 정책 조회
router.get('/rules', requireAdmin, async (req, res) => {
  try {
    const rules = await getAttendanceRules(req.academyId);
    res.json(rules);
  } catch (err) {
    console.error('[출결 정책 조회 오류]', err.message);
    res.status(500).json({ error: '출결 정책 조회 중 오류가 발생했습니다.' });
  }
});

// 출결 정책 수정 (UPSERT)
router.put('/rules', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const {
      late_threshold_minutes,
      absence_alert_enabled,
      absence_alert_delay_minutes,
      auto_parent_notify,
      consecutive_absence_alert,
      makeup_deadline_days,
    } = req.body;

    const existing = await getOne('SELECT id FROM attendance_rules WHERE academy_id = ?', [academyId]);

    if (existing) {
      await runQuery(
        `UPDATE attendance_rules SET
          late_threshold_minutes = COALESCE(?, late_threshold_minutes),
          absence_alert_enabled = COALESCE(?, absence_alert_enabled),
          absence_alert_delay_minutes = COALESCE(?, absence_alert_delay_minutes),
          auto_parent_notify = COALESCE(?, auto_parent_notify),
          consecutive_absence_alert = COALESCE(?, consecutive_absence_alert),
          makeup_deadline_days = COALESCE(?, makeup_deadline_days),
          updated_at = NOW()
        WHERE academy_id = ?`,
        [late_threshold_minutes, absence_alert_enabled, absence_alert_delay_minutes, auto_parent_notify, consecutive_absence_alert, makeup_deadline_days, academyId]
      );
    } else {
      await runInsert(
        `INSERT INTO attendance_rules (academy_id, late_threshold_minutes, absence_alert_enabled, absence_alert_delay_minutes, auto_parent_notify, consecutive_absence_alert, makeup_deadline_days)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          academyId,
          late_threshold_minutes ?? 10,
          absence_alert_enabled ?? true,
          absence_alert_delay_minutes ?? 30,
          auto_parent_notify ?? true,
          consecutive_absence_alert ?? 3,
          makeup_deadline_days ?? 14,
        ]
      );
    }

    const rules = await getAttendanceRules(academyId);
    res.json({ message: '출결 정책이 저장되었습니다.', rules });
  } catch (err) {
    console.error('[출결 정책 수정 오류]', err.message);
    res.status(500).json({ error: '출결 정책 수정 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════
// 정정 이력 (Logs)
// ══════════════════════════════════════

router.get('/logs/:attendanceId', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const { attendanceId } = req.params;

    // 해당 출결 기록이 이 학원 소속인지 확인
    const attendance = await getOne(
      'SELECT id FROM attendance WHERE id = ? AND academy_id = ?',
      [attendanceId, academyId]
    );
    if (!attendance) return res.status(404).json({ error: '출결 기록을 찾을 수 없습니다.' });

    const logs = await getAll(
      `SELECT al.*, u.name as changed_by_name
       FROM attendance_logs al
       LEFT JOIN users u ON u.id = al.changed_by
       WHERE al.attendance_id = ?
       ORDER BY al.changed_at DESC`,
      [attendanceId]
    );

    res.json(logs);
  } catch (err) {
    console.error('[정정 이력 조회 오류]', err.message);
    res.status(500).json({ error: '정정 이력 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════
// 연속 결석 학생 목록
// ══════════════════════════════════════

router.get('/absent-streak', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const rules = await getAttendanceRules(academyId);
    const threshold = rules.consecutive_absence_alert || 3;

    // 최근 N개 수업일(출결 기록이 있는 날짜) 기준으로 연속 결석 학생 조회
    const recentDates = await getAll(
      `SELECT DISTINCT date FROM attendance WHERE academy_id = ? ORDER BY date DESC LIMIT ?`,
      [academyId, threshold]
    );

    if (recentDates.length < threshold) {
      return res.json({ threshold, students: [] });
    }

    const oldestDate = recentDates[recentDates.length - 1].date;

    // 해당 기간 동안 출석 기록이 전혀 없는 활성 학생
    const rows = await getAll(`
      SELECT s.id, u.name, s.school, s.grade, s.parent_phone,
             (SELECT COUNT(*) FROM attendance
              WHERE student_id = s.id AND academy_id = ? AND date >= ?) as attend_count
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.academy_id = ? AND (s.status IS NULL OR s.status = 'active')
      HAVING (SELECT COUNT(*) FROM attendance
              WHERE student_id = s.id AND academy_id = ? AND date >= ?) = 0
      ORDER BY u.name
    `, [academyId, oldestDate, academyId, academyId, oldestDate]);

    res.json({ threshold, since: oldestDate, students: rows });
  } catch (err) {
    console.error('[연속 결석 조회 오류]', err.message);
    res.status(500).json({ error: '연속 결석 학생 조회 중 오류가 발생했습니다.' });
  }
});

// ══════════════════════════════════════
// 보강 관리 (Makeup)
// ══════════════════════════════════════

// 보강 요청
router.post('/:id/request-makeup', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const attendanceId = req.params.id;

    const existing = await getOne(
      'SELECT id, makeup_status FROM attendance WHERE id = ? AND academy_id = ?',
      [attendanceId, academyId]
    );
    if (!existing) return res.status(404).json({ error: '출결 기록을 찾을 수 없습니다.' });
    if (existing.makeup_status) {
      return res.status(400).json({ error: `이미 보강 상태(${existing.makeup_status})입니다.` });
    }

    await runQuery(
      'UPDATE attendance SET makeup_status = ? WHERE id = ? AND academy_id = ?',
      ['pending', attendanceId, academyId]
    );

    res.json({ message: '보강이 요청되었습니다.', makeup_status: 'pending' });
  } catch (err) {
    console.error('[보강 요청 오류]', err.message);
    res.status(500).json({ error: '보강 요청 중 오류가 발생했습니다.' });
  }
});

// 보강 편성
router.put('/:id/schedule-makeup', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const attendanceId = req.params.id;
    const { makeup_session_id } = req.body;

    if (!makeup_session_id) return res.status(400).json({ error: 'makeup_session_id는 필수입니다.' });

    const existing = await getOne(
      'SELECT id, makeup_status FROM attendance WHERE id = ? AND academy_id = ?',
      [attendanceId, academyId]
    );
    if (!existing) return res.status(404).json({ error: '출결 기록을 찾을 수 없습니다.' });

    // 보강 세션 존재 확인
    const session = await getOne(
      'SELECT id FROM class_sessions WHERE id = ? AND academy_id = ?',
      [makeup_session_id, academyId]
    );
    if (!session) return res.status(404).json({ error: '보강 세션을 찾을 수 없습니다.' });

    await runQuery(
      'UPDATE attendance SET makeup_session_id = ?, makeup_status = ? WHERE id = ? AND academy_id = ?',
      [makeup_session_id, 'scheduled', attendanceId, academyId]
    );

    res.json({ message: '보강이 편성되었습니다.', makeup_status: 'scheduled', makeup_session_id });
  } catch (err) {
    console.error('[보강 편성 오류]', err.message);
    res.status(500).json({ error: '보강 편성 중 오류가 발생했습니다.' });
  }
});

// 보강 완료
router.put('/:id/complete-makeup', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;
    const attendanceId = req.params.id;

    const existing = await getOne(
      'SELECT id, makeup_status FROM attendance WHERE id = ? AND academy_id = ?',
      [attendanceId, academyId]
    );
    if (!existing) return res.status(404).json({ error: '출결 기록을 찾을 수 없습니다.' });
    if (existing.makeup_status !== 'scheduled') {
      return res.status(400).json({ error: '편성된 보강만 완료 처리할 수 있습니다.' });
    }

    await runQuery(
      'UPDATE attendance SET makeup_status = ? WHERE id = ? AND academy_id = ?',
      ['completed', attendanceId, academyId]
    );

    res.json({ message: '보강이 완료 처리되었습니다.', makeup_status: 'completed' });
  } catch (err) {
    console.error('[보강 완료 오류]', err.message);
    res.status(500).json({ error: '보강 완료 처리 중 오류가 발생했습니다.' });
  }
});

// 보강 대기 목록
router.get('/makeup-pending', requireAdmin, async (req, res) => {
  try {
    const academyId = req.academyId;

    const rows = await getAll(`
      SELECT a.id, a.student_id, a.date, a.status, a.makeup_status, a.makeup_session_id,
             u.name as student_name, s.school, s.grade,
             cs.session_date as makeup_date, cs.start_time as makeup_start, cs.end_time as makeup_end
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      JOIN users u ON u.id = s.user_id
      LEFT JOIN class_sessions cs ON cs.id = a.makeup_session_id
      WHERE a.academy_id = ? AND a.makeup_status IN ('pending', 'scheduled')
      ORDER BY a.date DESC
    `, [academyId]);

    res.json(rows);
  } catch (err) {
    console.error('[보강 대기 조회 오류]', err.message);
    res.status(500).json({ error: '보강 대기 목록 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
