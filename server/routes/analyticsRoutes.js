const express = require('express');
const { runInsert } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/analytics/page-view — 페이지 뷰 트래킹 (인증 필요)
router.post('/page-view', authenticateToken, async (req, res) => {
  try {
    const { page_path, feature_name, duration_seconds, session_id } = req.body;
    if (!page_path) return res.status(400).json({ error: 'page_path 필수' });

    await runInsert(
      `INSERT INTO page_views (academy_id, user_id, page_path, feature_name, duration_seconds, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.academyId, req.user?.id, page_path, feature_name || null, duration_seconds || 0, session_id || null]
    );
    res.json({ ok: true });
  } catch (err) {
    // 트래킹 실패는 무시 (사용자 경험 방해 안 함)
    res.json({ ok: false });
  }
});

module.exports = router;
