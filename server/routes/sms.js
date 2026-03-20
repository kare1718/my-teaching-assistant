const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendSMS, sendBulkSMS, isConfigured } = require('../utils/smsHelper');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// SMS 설정 상태 확인
router.get('/status', (req, res) => {
  res.json({ configured: isConfigured() });
});

// 학생 목록 (전화번호 포함)
router.get('/recipients', async (req, res) => {
  const { school, grade } = req.query;
  let query = `
    SELECT s.id, u.name, s.school, s.grade, u.phone, s.parent_phone
    FROM students s JOIN users u ON s.user_id = u.id
    WHERE s.status = 'active' AND s.school NOT IN ('조교', '선생님') AND s.academy_id = ?
  `;
  const params = [req.academyId];

  if (school) { query += ' AND s.school = ?'; params.push(school); }
  if (grade) { query += ' AND s.grade = ?'; params.push(grade); }

  query += ' ORDER BY s.school, s.grade, u.name';
  const students = await getAll(query, params);
  res.json(students);
});

// 학생별 최근 시험 성적 조회
router.get('/student-scores/:studentId', async (req, res) => {
  const scores = await getAll(
    `SELECT sc.score, sc.rank_num, sc.note,
            e.name as exam_name, e.exam_date, e.max_score,
            (SELECT COUNT(*) FROM scores WHERE exam_id = e.id AND academy_id = ?) as total_students
     FROM scores sc JOIN exams e ON sc.exam_id = e.id
     WHERE sc.student_id = ? AND sc.academy_id = ?
     ORDER BY e.exam_date DESC, e.id DESC LIMIT 5`,
    [req.academyId, req.params.studentId, req.academyId]
  );
  res.json(scores);
});

// 클리닉 일정 조회 (SMS 변수 입력용) - 학생별 최근 클리닉
router.get('/clinic-appointments', async (req, res) => {
  const { studentIds } = req.query; // comma-separated
  let where = "ca.status IN ('approved', 'completed') AND ca.academy_id = ?";
  const params = [req.academyId];

  if (studentIds) {
    const ids = studentIds.split(',').map(Number).filter(Boolean);
    if (ids.length > 0) {
      where += ` AND ca.student_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }
  }

  const appointments = await getAll(
    `SELECT ca.id, ca.student_id, ca.appointment_date, ca.time_slot, ca.topic, ca.detail,
            ca.status, ca.admin_note, u.name as student_name, s.school, s.grade
     FROM clinic_appointments ca
     JOIN students s ON ca.student_id = s.id
     JOIN users u ON s.user_id = u.id
     WHERE ${where}
     ORDER BY ca.appointment_date DESC, ca.time_slot ASC`,
    params
  );
  res.json(appointments);
});

// === 템플릿 CRUD ===
router.get('/templates', async (req, res) => {
  const templates = await getAll('SELECT * FROM sms_templates WHERE academy_id = ? ORDER BY id ASC', [req.academyId]);
  res.json(templates);
});

router.post('/templates', async (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ error: '이름과 내용을 입력해주세요.' });
  const id = await runInsert('INSERT INTO sms_templates (name, content, academy_id) VALUES (?, ?, ?)', [name, content, req.academyId]);
  res.json({ message: '템플릿 저장됨', id });
});

router.put('/templates/:id', async (req, res) => {
  const { name, content } = req.body;
  await runQuery('UPDATE sms_templates SET name = ?, content = ? WHERE id = ? AND academy_id = ?', [name, content, req.params.id, req.academyId]);
  res.json({ message: '템플릿 수정됨' });
});

router.delete('/templates/:id', async (req, res) => {
  await runQuery('DELETE FROM sms_templates WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '템플릿 삭제됨' });
});

// 개별 SMS (학생별 메시지 다를 수 있음)
router.post('/send-individual', async (req, res) => {
  const { messages } = req.body; // [{phone, message, name}]
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '발송 대상이 없습니다.' });
  }

  let success = 0, fail = 0;
  const errors = [];

  for (const m of messages) {
    try {
      await sendSMS(m.phone, m.message);
      success++;
    } catch (e) {
      fail++;
      errors.push({ name: m.name, phone: m.phone, error: e.message });
    }
  }

  res.json({ message: `전송 완료: 성공 ${success}건, 실패 ${fail}건`, success, fail, errors });
});

// 단일 SMS 발송
router.post('/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: '수신번호와 메시지를 입력해주세요.' });
  if (message.length > 2000) return res.status(400).json({ error: '메시지가 너무 깁니다 (최대 2000자).' });

  try {
    const result = await sendSMS(to, message);
    res.json({ message: 'SMS 전송 완료', result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 대량 SMS 발송
router.post('/send-bulk', async (req, res) => {
  const { recipients, message, targetType } = req.body;
  if (!message) return res.status(400).json({ error: '메시지를 입력해주세요.' });

  let phones = [];

  if (targetType === 'custom' && Array.isArray(recipients)) {
    phones = recipients;
  } else if (targetType === 'student' || targetType === 'parent') {
    const { school, grade } = req.body;
    let query = `SELECT u.phone, s.parent_phone FROM students s JOIN users u ON s.user_id = u.id WHERE s.status = 'active' AND s.academy_id = ?`;
    const params = [req.academyId];
    if (school) { query += ' AND s.school = ?'; params.push(school); }
    if (grade) { query += ' AND s.grade = ?'; params.push(grade); }

    const students = await getAll(query, params);
    phones = targetType === 'student'
      ? students.map(s => s.phone).filter(Boolean)
      : students.map(s => s.parent_phone).filter(Boolean);
  } else {
    return res.status(400).json({ error: '발송 대상을 선택해주세요.' });
  }

  if (phones.length === 0) return res.status(400).json({ error: '발송 대상이 없습니다.' });

  try {
    const result = await sendBulkSMS(phones, message);
    res.json({ message: `${phones.length}건 SMS 전송 완료`, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
