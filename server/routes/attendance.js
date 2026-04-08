const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendToParent } = require('../services/notification');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// 학생 등원 체크
router.post('/check-in', async (req, res) => {
  const { student_id, method } = req.body;
  if (!student_id) return res.status(400).json({ error: 'student_id는 필수입니다.' });

  const validMethods = ['number', 'qr', 'manual'];
  const checkMethod = validMethods.includes(method) ? method : 'manual';
  const academyId = req.academyId;
  const today = new Date().toISOString().slice(0, 10);

  const existing = await getOne(
    'SELECT id FROM attendance WHERE academy_id = ? AND student_id = ? AND date = ?',
    [academyId, student_id, today]
  );
  if (existing) return res.status(400).json({ error: '이미 오늘 체크인 되었습니다.' });

  const id = await runInsert(
    'INSERT INTO attendance (academy_id, student_id, date, check_in_at, method) VALUES (?, ?, ?, NOW(), ?)',
    [academyId, student_id, today, checkMethod]
  );

  // 학부모 알림 (비동기, 실패해도 체크인은 성공)
  sendToParent(academyId, student_id, '자녀가 학원에 등원했습니다.', 'attendance').catch(() => {});

  res.json({ id, message: '체크인 완료' });
});

// 학생 하원 체크
router.post('/check-out', async (req, res) => {
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
});

// 오늘 출결 현황
router.get('/today', async (req, res) => {
  const academyId = req.academyId;
  const today = new Date().toISOString().slice(0, 10);

  const rows = await getAll(`
    SELECT s.id as student_id, s.name, s.school, s.grade,
           a.id as attendance_id, a.check_in_at, a.check_out_at, a.method
    FROM students s
    LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ? AND a.academy_id = ?
    WHERE s.status = 'active'
    ORDER BY s.school, s.grade, s.name
  `, [today, academyId]);

  const total = rows.length;
  const checkedIn = rows.filter(r => r.check_in_at).length;

  res.json({ date: today, total, checkedIn, absent: total - checkedIn, students: rows });
});

// 미출석자 목록
router.get('/absent', async (req, res) => {
  const academyId = req.academyId;
  const today = new Date().toISOString().slice(0, 10);

  const rows = await getAll(`
    SELECT s.id, s.name, s.school, s.grade, s.parent_phone
    FROM students s
    WHERE s.status = 'active'
      AND s.id NOT IN (
        SELECT student_id FROM attendance WHERE academy_id = ? AND date = ?
      )
    ORDER BY s.school, s.grade, s.name
  `, [academyId, today]);

  res.json(rows);
});

// 월간 출결 통계
router.get('/stats', async (req, res) => {
  const academyId = req.academyId;
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year, month 파라미터가 필요합니다.' });

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const stats = await getAll(`
    SELECT s.id as student_id, s.name, s.school,
           COUNT(a.id) as attended_days,
           COUNT(CASE WHEN a.check_in_at::time > '14:30:00' THEN 1 END) as late_days
    FROM students s
    LEFT JOIN attendance a ON a.student_id = s.id AND a.academy_id = ? AND a.date BETWEEN ? AND ?
    WHERE s.status = 'active'
    GROUP BY s.id, s.name, s.school
    ORDER BY s.school, s.name
  `, [academyId, startDate, endDate]);

  res.json({ year, month, stats });
});

// 특정 학생 출결 이력
router.get('/student/:id', async (req, res) => {
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
});

module.exports = router;
