const express = require('express');
const { runQuery, getOne } = require('../db/database');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/legal-info — 공개 조회 (푸터/정책 페이지용)
router.get('/', async (req, res) => {
  try {
    const row = await getOne('SELECT * FROM legal_info WHERE id = 1');
    res.json(row || {});
  } catch (err) {
    console.error('[legal-info GET]', err);
    res.status(500).json({ error: '법적 정보를 불러오지 못했습니다.' });
  }
});

// PUT /api/legal-info — SuperAdmin 전용 수정
router.put('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const {
      company_name, ceo_name, business_number, ecommerce_number,
      address, phone, email, privacy_officer, privacy_officer_email,
    } = req.body || {};

    await runQuery(
      `UPDATE legal_info SET
        company_name = ?, ceo_name = ?, business_number = ?, ecommerce_number = ?,
        address = ?, phone = ?, email = ?, privacy_officer = ?, privacy_officer_email = ?,
        updated_at = NOW()
       WHERE id = 1`,
      [company_name, ceo_name, business_number, ecommerce_number,
       address, phone, email, privacy_officer, privacy_officer_email]
    );

    const row = await getOne('SELECT * FROM legal_info WHERE id = 1');
    res.json(row);
  } catch (err) {
    console.error('[legal-info PUT]', err);
    res.status(500).json({ error: '법적 정보를 수정하지 못했습니다.' });
  }
});

module.exports = router;
