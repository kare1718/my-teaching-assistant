const express = require('express');
const { runInsert, getOne } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// ─── 유틸 ──────────────────────────────────────────────
const normalizePhone = (v) => String(v || '').replace(/[^0-9]/g, '').replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');

function validateStudentRow(row) {
  const errors = [];
  if (!row.name || !String(row.name).trim()) errors.push('이름 누락');
  if (!row.school || !String(row.school).trim()) errors.push('학교 누락');
  if (!row.grade || !String(row.grade).trim()) errors.push('학년 누락');
  if (!row.parentName || !String(row.parentName).trim()) errors.push('보호자 이름 누락');
  if (!row.parentPhone || !String(row.parentPhone).trim()) errors.push('보호자 전화 누락');
  return errors;
}

function validateTuitionRow(row) {
  const errors = [];
  if (!row.studentName || !String(row.studentName).trim()) errors.push('학생 이름 누락');
  if (!row.amount || isNaN(Number(row.amount))) errors.push('금액 오류');
  if (!row.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.dueDate))) errors.push('납기일 형식 오류 (YYYY-MM-DD)');
  return errors;
}

function validateAttendanceRow(row) {
  const errors = [];
  if (!row.studentName) errors.push('학생 이름 누락');
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date))) errors.push('날짜 형식 오류');
  const allowed = ['present', 'absent', 'late', 'excused', '출석', '결석', '지각', '조퇴'];
  if (!allowed.includes(String(row.status || '').trim())) errors.push('상태 값 오류');
  return errors;
}

// POST /validate — 행 검증만 수행
router.post('/validate', async (req, res) => {
  const { type, rows } = req.body || {};
  if (!type || !Array.isArray(rows)) return res.status(400).json({ error: 'type, rows 필수' });

  const validator = type === 'students' ? validateStudentRow
    : type === 'tuition' ? validateTuitionRow
    : type === 'attendance' ? validateAttendanceRow
    : null;
  if (!validator) return res.status(400).json({ error: 'type은 students|tuition|attendance 중 하나여야 합니다.' });

  const result = rows.map((row, i) => ({
    index: i,
    row,
    errors: validator(row),
  }));
  const summary = {
    total: result.length,
    valid: result.filter(r => r.errors.length === 0).length,
    invalid: result.filter(r => r.errors.length > 0).length,
  };
  res.json({ summary, rows: result });
});

// POST /commit — 실제 등록
router.post('/commit', async (req, res) => {
  const { type, rows } = req.body || {};
  if (!type || !Array.isArray(rows)) return res.status(400).json({ error: 'type, rows 필수' });
  const academyId = req.academyId;
  if (!academyId) return res.status(400).json({ error: '학원 정보가 없습니다.' });

  let success = 0, failed = 0, skipped = 0;
  const errors = [];

  try {
    if (type === 'students') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const errs = validateStudentRow(r);
        if (errs.length > 0) { failed++; errors.push({ index: i, errors: errs }); continue; }
        try {
          // 중복 체크 (같은 이름 + 학교 + 학년)
          const existing = await getOne(
            `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id
             WHERE u.name = ? AND s.school = ? AND s.grade = ? AND s.academy_id = ?`,
            [r.name, r.school, r.grade, academyId]
          );
          if (existing) { skipped++; continue; }
          const username = `__import_${academyId}_${Date.now()}_${i}`;
          const userId = await runInsert(
            `INSERT INTO users (username, password, name, role, approved, phone, academy_id)
             VALUES (?, '', ?, 'student', 1, '', ?)`,
            [username, r.name, academyId]
          );
          await runInsert(
            `INSERT INTO students (user_id, school, grade, parent_name, parent_phone, memo, academy_id)
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
            [userId, r.school, r.grade, r.parentName, normalizePhone(r.parentPhone), r.memo || '', academyId]
          );
          success++;
        } catch (e) { failed++; errors.push({ index: i, errors: [e.message] }); }
      }
    } else if (type === 'tuition') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const errs = validateTuitionRow(r);
        if (errs.length > 0) { failed++; errors.push({ index: i, errors: errs }); continue; }
        try {
          const stu = await getOne(
            `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id
             WHERE u.name = ? AND s.academy_id = ? LIMIT 1`,
            [r.studentName, academyId]
          );
          if (!stu) { failed++; errors.push({ index: i, errors: ['학생을 찾을 수 없음'] }); continue; }
          await runInsert(
            `INSERT INTO tuition_records (academy_id, student_id, amount, due_date, status)
             VALUES (?, ?, ?, ?, 'pending')`,
            [academyId, stu.id, Number(r.amount), r.dueDate]
          );
          success++;
        } catch (e) { failed++; errors.push({ index: i, errors: [e.message] }); }
      }
    } else if (type === 'attendance') {
      const statusMap = { '출석': 'present', '결석': 'absent', '지각': 'late', '조퇴': 'excused' };
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const errs = validateAttendanceRow(r);
        if (errs.length > 0) { failed++; errors.push({ index: i, errors: errs }); continue; }
        try {
          const stu = await getOne(
            `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id
             WHERE u.name = ? AND s.academy_id = ? LIMIT 1`,
            [r.studentName, academyId]
          );
          if (!stu) { failed++; errors.push({ index: i, errors: ['학생을 찾을 수 없음'] }); continue; }
          const status = statusMap[r.status] || r.status;
          try {
            await runInsert(
              `INSERT INTO attendance (student_id, date, status, academy_id) VALUES (?, ?, ?, ?)`,
              [stu.id, r.date, status, academyId]
            );
            success++;
          } catch (e) {
            if ((e.message || '').includes('duplicate') || (e.message || '').includes('UNIQUE')) skipped++;
            else { failed++; errors.push({ index: i, errors: [e.message] }); }
          }
        } catch (e) { failed++; errors.push({ index: i, errors: [e.message] }); }
      }
    } else {
      return res.status(400).json({ error: 'type이 올바르지 않습니다.' });
    }

    res.json({ message: '가져오기 완료', summary: { success, failed, skipped }, errors: errors.slice(0, 50) });
  } catch (err) {
    console.error('[data-import/commit]', err);
    res.status(500).json({ error: '가져오기 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
