const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { addEvent } = require('../services/timeline');
const { logAction } = require('../services/audit');
const { track } = require('../services/analytics');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// 상담 기록 목록
router.get('/', async (req, res) => {
  try {
    const { student, tag, page: pageStr, limit: limitStr } = req.query;
    const page = parseInt(pageStr) || 1;
    const limit = parseInt(limitStr) || 30;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT c.*, u.name as student_name, s.school, s.grade
      FROM consultation_logs c
      LEFT JOIN students s ON s.id = c.student_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE c.academy_id = ?
    `;
    const params = [req.academyId];

    if (student) { sql += ' AND u.name LIKE ?'; params.push(`%${student}%`); }
    if (tag) { sql += ' AND c.tags LIKE ?'; params.push(`%${tag}%`); }

    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await getAll(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('[상담 목록 오류]', err.message);
    res.status(500).json({ error: '상담 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 상담 기록 생성
router.post('/', requirePermission('consultations', 'create'), async (req, res) => {
  try {
    const { student_id, content, counselor_name, tags, date } = req.body;
    if (!student_id || !content) return res.status(400).json({ error: '학생과 상담 내용은 필수입니다.' });

    const counselor = counselor_name || req.user.name || '관리자';
    const tagsStr = Array.isArray(tags) ? tags.join(',') : (tags || '');

    const id = await runInsert(
      'INSERT INTO consultation_logs (academy_id, student_id, counselor_name, content, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [req.academyId, student_id, counselor, content, tagsStr, date ? new Date(date) : new Date()]
    );

    // 타임라인 이벤트
    addEvent(req.academyId, student_id, 'consultation', `상담: ${counselor}`,
      content, { consultation_id: id, tags: tagsStr }, req.user?.id
    ).catch(e => console.error('[timeline]', e.message));

    // [KPI] feature_used
    track(req, 'feature_used', { feature: 'consultation.create' }).catch(() => {});

    res.json({ id, message: '상담 기록이 저장되었습니다.' });
  } catch (err) {
    console.error('[상담 생성 오류]', err.message);
    res.status(500).json({ error: '상담 기록 저장 중 오류가 발생했습니다.' });
  }
});

// 상담 기록 수정
router.put('/:id', async (req, res) => {
  try {
    const record = await getOne('SELECT id FROM consultation_logs WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!record) return res.status(404).json({ error: '상담 기록을 찾을 수 없습니다.' });

    const { content, counselor_name, tags, date } = req.body;
    const fields = [];
    const params = [];

    if (content !== undefined) { fields.push('content = ?'); params.push(content); }
    if (counselor_name !== undefined) { fields.push('counselor_name = ?'); params.push(counselor_name); }
    if (tags !== undefined) {
      fields.push('tags = ?');
      params.push(Array.isArray(tags) ? tags.join(',') : tags);
    }
    if (date !== undefined) { fields.push('created_at = ?'); params.push(new Date(date)); }
    fields.push('updated_at = NOW()');

    if (fields.length === 1) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

    params.push(req.params.id, req.academyId);
    await runQuery(`UPDATE consultation_logs SET ${fields.join(', ')} WHERE id = ? AND academy_id = ?`, params);
    res.json({ message: '상담 기록이 수정되었습니다.' });
  } catch (err) {
    console.error('[상담 수정 오류]', err.message);
    res.status(500).json({ error: '상담 기록 수정 중 오류가 발생했습니다.' });
  }
});

// 상담 기록 삭제
router.delete('/:id', async (req, res) => {
  try {
    const record = await getOne('SELECT * FROM consultation_logs WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    if (!record) return res.status(404).json({ error: '상담 기록을 찾을 수 없습니다.' });

    await runQuery('DELETE FROM consultation_logs WHERE id = ? AND academy_id = ?', [req.params.id, req.academyId]);
    await logAction({
      req, action: 'consultation_delete', resourceType: 'consultation', resourceId: parseInt(req.params.id),
      before: record,
    });
    res.json({ message: '상담 기록이 삭제되었습니다.' });
  } catch (err) {
    console.error('[상담 삭제 오류]', err.message);
    res.status(500).json({ error: '상담 기록 삭제 중 오류가 발생했습니다.' });
  }
});

// 특정 학생 상담 이력
router.get('/student/:id', async (req, res) => {
  try {
    const rows = await getAll(
      'SELECT * FROM consultation_logs WHERE academy_id = ? AND student_id = ? ORDER BY created_at DESC',
      [req.academyId, req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[학생 상담 이력 오류]', err.message);
    res.status(500).json({ error: '상담 이력 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
