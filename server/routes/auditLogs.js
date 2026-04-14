const express = require('express');
const { getAll, getOne } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// GET / — 목록 (필터: user_id, action, resource_type, from, to, 페이지네이션)
router.get('/', async (req, res) => {
  try {
    const { user_id, action, resource_type, from, to, limit = 50, offset = 0 } = req.query;
    const conds = ['academy_id = ?'];
    const params = [req.academyId];

    if (user_id) { conds.push('user_id = ?'); params.push(user_id); }
    if (action) { conds.push('action = ?'); params.push(action); }
    if (resource_type) { conds.push('resource_type = ?'); params.push(resource_type); }
    if (from) { conds.push('created_at >= ?'); params.push(from); }
    if (to) { conds.push('created_at <= ?'); params.push(to); }

    const where = conds.join(' AND ');
    const total = await getOne(
      `SELECT COUNT(*)::int AS n FROM audit_logs WHERE ${where}`,
      params
    );
    const rows = await getAll(
      `SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    res.json({ total: total?.n || 0, rows });
  } catch (err) {
    console.error('[auditLogs GET]', err);
    res.status(500).json({ error: '감사 로그 조회 실패' });
  }
});

// GET /:id — 상세
router.get('/:id', async (req, res) => {
  try {
    const row = await getOne(
      'SELECT * FROM audit_logs WHERE id = ? AND academy_id = ?',
      [req.params.id, req.academyId]
    );
    if (!row) return res.status(404).json({ error: '감사 로그를 찾을 수 없습니다.' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: '조회 실패' });
  }
});

// GET /resource/:type/:id — 특정 리소스의 전체 변경 이력
router.get('/resource/:type/:id', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT * FROM audit_logs
       WHERE academy_id = ? AND resource_type = ? AND resource_id = ?
       ORDER BY created_at DESC`,
      [req.academyId, req.params.type, req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '조회 실패' });
  }
});

module.exports = router;
