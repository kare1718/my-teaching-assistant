const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// 상담 기록 목록
router.get('/', async (req, res) => {
  const { student_id, page: pageStr, limit: limitStr } = req.query;
  const page = parseInt(pageStr) || 1;
  const limit = parseInt(limitStr) || 30;
  const offset = (page - 1) * limit;

  let sql = `
    SELECT c.*, s.name as student_name, s.school, s.grade
    FROM consultations c
    LEFT JOIN students s ON s.id = c.student_id
    WHERE c.academy_id = ?
  `;
  const params = [req.academyId];

  if (student_id) { sql += ' AND c.student_id = ?'; params.push(student_id); }

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await getAll(sql, params);
  res.json(rows);
});

// 상담 기록 생성
router.post('/', async (req, res) => {
  const { student_id, content, counselor_name, tags } = req.body;
  if (!student_id || !content) return res.status(400).json({ error: '학생과 상담 내용은 필수입니다.' });

  const counselor = counselor_name || req.user.name || '관리자';
  const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : (tags || '[]');

  const id = await runInsert(
    'INSERT INTO consultations (academy_id, student_id, counselor_name, content, tags) VALUES (?, ?, ?, ?, ?)',
    [req.academyId, student_id, counselor, content, tagsJson]
  );
  res.json({ id, message: '상담 기록이 저장되었습니다.' });
});

// 상담 기록 수정
router.put('/:id', async (req, res) => {
  const record = await getOne('SELECT id FROM consultations WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!record) return res.status(404).json({ error: '상담 기록을 찾을 수 없습니다.' });

  const { content, counselor_name, tags } = req.body;
  const fields = [];
  const params = [];

  if (content !== undefined) { fields.push('content = ?'); params.push(content); }
  if (counselor_name !== undefined) { fields.push('counselor_name = ?'); params.push(counselor_name); }
  if (tags !== undefined) {
    fields.push('tags = ?');
    params.push(Array.isArray(tags) ? JSON.stringify(tags) : tags);
  }
  fields.push('updated_at = NOW()');

  if (fields.length === 1) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

  params.push(req.params.id, req.academyId);
  await runQuery(`UPDATE consultations SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, params);
  res.json({ message: '상담 기록이 수정되었습니다.' });
});

// 상담 기록 삭제
router.delete('/:id', async (req, res) => {
  const record = await getOne('SELECT id FROM consultations WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  if (!record) return res.status(404).json({ error: '상담 기록을 찾을 수 없습니다.' });

  await runQuery('DELETE FROM consultations WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
  res.json({ message: '상담 기록이 삭제되었습니다.' });
});

// 특정 학생 상담 이력
router.get('/student/:id', async (req, res) => {
  const rows = await getAll(
    'SELECT * FROM consultations WHERE academy_id = ? AND student_id = ? ORDER BY created_at DESC',
    [req.academyId, req.params.id]
  );
  res.json(rows);
});

module.exports = router;
