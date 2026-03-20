const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { TIER_LIMITS } = require('../middleware/subscription');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// 현재 구독 정보
router.get('/', async (req, res) => {
  try {
    const academy = await getOne(
      'SELECT id, name, subscription_tier, max_students FROM academies WHERE id = ?',
      [req.academyId]
    );
    if (!academy) return res.status(404).json({ error: '학원 정보를 찾을 수 없습니다.' });

    const subscription = await getOne(
      'SELECT * FROM subscriptions WHERE academy_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
      [req.academyId, 'active']
    );

    const studentCount = await getOne(
      'SELECT COUNT(*) as count FROM students WHERE academy_id = ? AND (status IS NULL OR status = ?)',
      [req.academyId, 'active']
    );

    res.json({
      academy,
      subscription,
      currentStudents: studentCount?.count || 0,
      tierLimits: TIER_LIMITS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 이번 달 사용량
router.get('/usage', async (req, res) => {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const usage = await getAll(
      'SELECT usage_type, SUM(count) as total FROM usage_logs WHERE academy_id = ? AND month = ? GROUP BY usage_type',
      [req.academyId, month]
    );
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 결제 내역
router.get('/payments', async (req, res) => {
  try {
    const payments = await getAll(
      'SELECT * FROM payments WHERE academy_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.academyId]
    );
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 결제 검증 (포트원 웹훅)
router.post('/verify-payment', async (req, res) => {
  try {
    const { paymentId, amount, planType } = req.body;
    // TODO: 포트원 API로 결제 검증
    // const verified = await verifyPayment(paymentId);

    const tier = planType || 'basic';
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.basic;

    // 구독 생성/갱신
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await runInsert(
      'INSERT INTO subscriptions (academy_id, plan_type, status, expires_at) VALUES (?, ?, ?, ?)',
      [req.academyId, tier, 'active', expiresAt.toISOString()]
    );

    await runQuery(
      'UPDATE academies SET subscription_tier = ?, max_students = ? WHERE id = ?',
      [tier, limits.maxStudents, req.academyId]
    );

    // 결제 기록
    await runInsert(
      'INSERT INTO payments (academy_id, portone_payment_id, amount, status, paid_at) VALUES (?, ?, ?, ?, NOW())',
      [req.academyId, paymentId, amount, 'paid']
    );

    res.json({ message: '결제가 완료되었습니다.', tier, maxStudents: limits.maxStudents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '결제 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
