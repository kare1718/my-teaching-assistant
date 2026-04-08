const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// 제한인원 헬퍼
async function getMaxPerSlot(academyId) {
  const row = await getOne("SELECT setting_value FROM clinic_settings WHERE setting_key = 'max_per_slot' AND academy_id = ?", [academyId]);
  return row ? parseInt(row.setting_value) || 0 : 0; // 0이면 무제한
}

async function getSlotCount(date, slot, academyId) {
  const row = await getOne(
    "SELECT COUNT(*) as cnt FROM clinic_appointments WHERE appointment_date = ? AND time_slot = ? AND status != 'rejected' AND academy_id = ?",
    [date, slot, academyId]
  );
  return row?.cnt || 0;
}

// 특정 날짜의 타임별 신청 현황
router.get('/slot-counts', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.json({ counts: {}, maxPerSlot: 0 });
  const rows = await getAll(
    "SELECT time_slot, COUNT(*) as cnt FROM clinic_appointments WHERE appointment_date = ? AND status != 'rejected' AND academy_id = ? GROUP BY time_slot",
    [date, req.academyId]
  );
  const counts = {};
  rows.forEach(r => { counts[r.time_slot] = r.cnt; });
  const maxPerSlot = await getMaxPerSlot(req.academyId);
  res.json({ counts, maxPerSlot });
});

// === 학생용 ===

// 클리닉 신청
router.post('/', async (req, res) => {
  if (req.user.role !== 'student' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '권한이 없습니다.' });
  }

  const { appointment_date, time_slot, topic, detail } = req.body;
  if (!appointment_date || !time_slot || !topic) {
    return res.status(400).json({ error: '날짜, 시간, 질문 내용을 모두 입력해주세요.' });
  }

  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  // 같은 날짜+시간 중복 신청 방지
  const dup = await getOne(
    "SELECT id FROM clinic_appointments WHERE student_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'rejected' AND academy_id = ?",
    [student.id, appointment_date, time_slot, req.academyId]
  );
  if (dup) return res.status(400).json({ error: '이미 같은 날짜와 시간에 신청한 클리닉이 있습니다.' });

  // 제한인원 체크
  const maxPerSlot = await getMaxPerSlot(req.academyId);
  if (maxPerSlot > 0) {
    const currentCount = await getSlotCount(appointment_date, time_slot, req.academyId);
    if (currentCount >= maxPerSlot) {
      return res.status(400).json({ error: `해당 시간대의 제한 인원(${maxPerSlot}명)이 다 찼습니다. 다른 시간을 선택해주세요.` });
    }
  }

  const id = await runInsert(
    'INSERT INTO clinic_appointments (student_id, appointment_date, time_slot, topic, detail, academy_id) VALUES (?, ?, ?, ?, ?, ?)',
    [student.id, appointment_date, time_slot, topic.trim(), (detail || '').trim(), req.academyId]
  );

  res.json({
    message: '클리닉 신청이 완료되었습니다. 승인 후 일정이 확정됩니다.',
    id,
  });
});

// 내 클리닉 목록
router.get('/my', async (req, res) => {
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.json([]);

  const appointments = await getAll(
    `SELECT * FROM clinic_appointments WHERE student_id = ? AND academy_id = ? ORDER BY appointment_date DESC, time_slot ASC`,
    [student.id, req.academyId]
  );
  res.json(appointments);
});

// 내 다가오는 클리닉 (승인된 것만, 오늘 이후)
router.get('/my/upcoming', async (req, res) => {
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.json([]);

  const today = new Date().toISOString().split('T')[0];
  const upcoming = await getAll(
    `SELECT * FROM clinic_appointments
     WHERE student_id = ? AND status = 'approved' AND appointment_date >= ? AND academy_id = ?
     ORDER BY appointment_date ASC, time_slot ASC LIMIT 5`,
    [student.id, today, req.academyId]
  );
  res.json(upcoming);
});

// 클리닉 취소 (학생)
router.delete('/:id', async (req, res) => {
  const student = await getOne('SELECT id FROM students WHERE user_id = ? AND academy_id = ?', [req.user.id, req.academyId]);
  if (!student) return res.status(404).json({ error: '학생 정보를 찾을 수 없습니다.' });

  const appt = await getOne('SELECT * FROM clinic_appointments WHERE id = ? AND student_id = ? AND academy_id = ?', [req.params.id, student.id, req.academyId]);
  if (!appt) return res.status(404).json({ error: '클리닉 신청을 찾을 수 없습니다.' });
  if (appt.status === 'completed') return res.status(400).json({ error: '완료된 클리닉은 취소할 수 없습니다.' });

  await runQuery('DELETE FROM clinic_appointments WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '클리닉 신청이 취소되었습니다.' });
});

// === 관리자/조교용 ===

// 조교/관리자가 학생 대신 클리닉 입력
router.post('/admin/create', requireAdmin, async (req, res) => {
  const { student_id, appointment_date, time_slot, topic, detail } = req.body;
  if (!student_id || !appointment_date || !time_slot || !topic) {
    return res.status(400).json({ error: '학생, 날짜, 시간, 주제를 모두 입력해주세요.' });
  }

  const student = await getOne(
    'SELECT s.id, u.name FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.academy_id = ?',
    [student_id, req.academyId]
  );
  if (!student) return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });

  // 같은 날짜+시간 중복 체크
  const dup = await getOne(
    "SELECT id FROM clinic_appointments WHERE student_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'rejected' AND academy_id = ?",
    [student_id, appointment_date, time_slot, req.academyId]
  );
  if (dup) return res.status(400).json({ error: '이미 같은 날짜와 시간에 해당 학생의 클리닉이 있습니다.' });

  const id = await runInsert(
    'INSERT INTO clinic_appointments (student_id, appointment_date, time_slot, topic, detail, status, approved_at, academy_id) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
    [student_id, appointment_date, time_slot, topic.trim(), (detail || '').trim(), 'approved', req.academyId]
  );

  res.json({ message: `${student.name} 학생 클리닉이 등록되었습니다.`, id });
});

// 학생 목록 조회 (클리닉 입력 시 학생 선택용)
router.get('/admin/students', requireAdmin, async (req, res) => {
  const students = await getAll(
    `SELECT s.id, u.name, s.school, s.grade
     FROM students s JOIN users u ON s.user_id = u.id
     WHERE u.role = 'student' AND u.approved = 1 AND s.school NOT IN ('조교', '선생님', '관리자') AND s.academy_id = ?
     ORDER BY u.name ASC`,
    [req.academyId]
  );
  res.json(students);
});

// 전체 클리닉 목록 (캘린더용)
router.get('/admin/all', requireAdmin, async (req, res) => {
  const { month, year } = req.query;
  let where = '';
  const params = [];

  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = parseInt(month) + 1;
    const endDate = endMonth > 12
      ? `${parseInt(year) + 1}-01-01`
      : `${year}-${String(endMonth).padStart(2, '0')}-01`;
    where = 'WHERE ca.appointment_date >= ? AND ca.appointment_date < ? AND ca.academy_id = ?';
    params.push(startDate, endDate, req.academyId);
  } else {
    where = 'WHERE ca.academy_id = ?';
    params.push(req.academyId);
  }

  const appointments = await getAll(
    `SELECT ca.*, u.name as student_name, s.school, s.grade
     FROM clinic_appointments ca
     JOIN students s ON ca.student_id = s.id
     JOIN users u ON s.user_id = u.id
     ${where}
     ORDER BY ca.appointment_date ASC, ca.time_slot ASC`,
    params
  );
  res.json(appointments);
});

// 승인/거절/완료 처리
router.put('/admin/:id/status', requireAdmin, async (req, res) => {
  const { status, admin_note } = req.body;
  if (!['approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ error: '올바르지 않은 상태입니다.' });
  }

  const appt = await getOne('SELECT * FROM clinic_appointments WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!appt) return res.status(404).json({ error: '클리닉 신청을 찾을 수 없습니다.' });

  const updates = ['status = ?'];
  const updateParams = [status];

  if (status === 'approved') {
    updates.push('approved_at = CURRENT_TIMESTAMP');
  }
  if (admin_note !== undefined) {
    updates.push('admin_note = ?');
    updateParams.push(admin_note);
  }

  updateParams.push(req.params.id, req.academyId);
  await runQuery(`UPDATE clinic_appointments SET ${updates.join(', ')} WHERE id = ? AND academy_id = ?`, updateParams);

  // 승인 시 알림 생성
  if (status === 'approved') {
    try {
      const student = await getOne('SELECT user_id FROM students WHERE id = ? AND academy_id = ?', [appt.student_id, req.academyId]);
      if (student) {
        await runInsert(
          'INSERT INTO notifications (user_id, title, message, academy_id) VALUES (?, ?, ?, ?)',
          [student.user_id, '클리닉 승인', `${appt.appointment_date} ${appt.time_slot} 개별 클리닉이 승인되었습니다.`, req.academyId]
        );
      }
    } catch (e) { /* notifications 테이블 없으면 무시 */ }
  }

  const statusLabel = status === 'approved' ? '승인' : status === 'rejected' ? '거절' : '완료';
  res.json({ message: `클리닉이 ${statusLabel} 처리되었습니다.` });
});

// 관리자 클리닉 삭제
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM clinic_notes WHERE appointment_id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  await runQuery('DELETE FROM clinic_appointments WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '클리닉이 삭제되었습니다.' });
});

// === 클리닉 기록(노트) ===

// 특정 클리닉의 기록 조회
router.get('/admin/:id/notes', requireAdmin, async (req, res) => {
  const notes = await getAll(
    `SELECT cn.*, u.name as author_name
     FROM clinic_notes cn
     JOIN users u ON cn.author_id = u.id
     WHERE cn.appointment_id = ? AND cn.academy_id = ?
     ORDER BY cn.created_at ASC`,
    [req.params.id, req.academyId]
  );
  res.json(notes);
});

// 클리닉 기록 추가
router.post('/admin/:id/notes', requireAdmin, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });

  const id = await runInsert(
    'INSERT INTO clinic_notes (appointment_id, author_id, content, academy_id) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.id, content.trim(), req.academyId]
  );
  res.json({ message: '기록이 추가되었습니다.', id });
});

// 스태프 목록 (작성자 변경용 - 관리자 + 조교)
router.get('/admin/staff-list', requireAdmin, async (req, res) => {
  const staff = await getAll(
    `SELECT u.id, u.name, s.school as role FROM users u
     LEFT JOIN students s ON u.id = s.user_id
     WHERE (u.role = 'admin' OR s.school IN ('조교', '선생님')) AND u.academy_id = ?
     ORDER BY u.name`,
    [req.academyId]
  );
  res.json(staff);
});

// 클리닉 기록 수정
router.put('/admin/notes/:noteId', requireAdmin, async (req, res) => {
  const { content, authorId } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });

  if (authorId) {
    await runQuery('UPDATE clinic_notes SET content = ?, author_id = ? WHERE id = ? AND academy_id = ?', [content.trim(), authorId, req.params.noteId, req.academyId]);
  } else {
    await runQuery('UPDATE clinic_notes SET content = ? WHERE id = ? AND academy_id = ?', [content.trim(), req.params.noteId, req.academyId]);
  }
  res.json({ message: '기록이 수정되었습니다.' });
});

// 클리닉 기록 삭제
router.delete('/admin/notes/:noteId', requireAdmin, async (req, res) => {
  await runQuery('DELETE FROM clinic_notes WHERE id = ? AND academy_id = ?', [req.params.noteId, req.academyId]);
  res.json({ message: '기록이 삭제되었습니다.' });
});

// 학생별 클리닉 기록 누적 조회
router.get('/admin/student/:studentId/history', requireAdmin, async (req, res) => {
  const appointments = await getAll(
    `SELECT ca.*, u.name as student_name, s.school, s.grade
     FROM clinic_appointments ca
     JOIN students s ON ca.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE ca.student_id = ? AND ca.academy_id = ?
     ORDER BY ca.appointment_date DESC, ca.time_slot ASC`,
    [req.params.studentId, req.academyId]
  );

  // 각 appointment에 notes 붙이기
  const result = [];
  for (const a of appointments) {
    const notes = await getAll(
      `SELECT cn.*, u.name as author_name
       FROM clinic_notes cn JOIN users u ON cn.author_id = u.id
       WHERE cn.appointment_id = ? AND cn.academy_id = ? ORDER BY cn.created_at ASC`,
      [a.id, req.academyId]
    );
    result.push({ ...a, notes });
  }

  res.json(result);
});

// 클리닉 제한인원 설정 조회
router.get('/admin/settings', requireAdmin, async (req, res) => {
  const maxPerSlot = await getMaxPerSlot(req.academyId);
  res.json({ maxPerSlot });
});

// 클리닉 제한인원 설정 변경
router.put('/admin/settings', requireAdmin, async (req, res) => {
  const { maxPerSlot } = req.body;
  const val = parseInt(maxPerSlot) || 0;
  await runQuery(
    "INSERT INTO clinic_settings (setting_key, setting_value, academy_id) VALUES ('max_per_slot', ?, ?) ON CONFLICT (setting_key, academy_id) DO UPDATE SET setting_value = ?",
    [String(val), req.academyId, String(val)]
  );
  res.json({ message: `타임당 제한인원이 ${val === 0 ? '무제한' : val + '명'}으로 설정되었습니다.` });
});

module.exports = router;
