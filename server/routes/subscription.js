const express = require('express');
const { runQuery, runInsert, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { TIER_LIMITS, YEARLY_PRICES } = require('../middleware/subscription');
const { verifyPayment, getBillingKeyInfo, cancelPayment, retryPayment } = require('../services/billing');
const { logAction } = require('../services/audit');
const { track } = require('../services/analytics');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// ─────────────────────────────────────────────
// 현재 구독 정보
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const academy = await getOne(
      'SELECT id, name, subscription_tier, max_students FROM academies WHERE id = ?',
      [req.academyId]
    );
    if (!academy) return res.status(404).json({ error: '학원 정보를 찾을 수 없습니다.' });

    // DB max_students가 현재 tier 기준과 다르면 보정
    const tierLimit = TIER_LIMITS[academy.subscription_tier];
    if (tierLimit && academy.max_students !== tierLimit.maxStudents) {
      await runQuery('UPDATE academies SET max_students = ? WHERE id = ?', [tierLimit.maxStudents, academy.id]);
      academy.max_students = tierLimit.maxStudents;
    }

    const subscription = await getOne(
      'SELECT * FROM subscriptions WHERE academy_id = ? ORDER BY id DESC LIMIT 1',
      [req.academyId]
    );

    const studentCount = await getOne(
      'SELECT COUNT(*) as count FROM students s JOIN users u ON s.user_id = u.id WHERE s.academy_id = ? AND (s.status IS NULL OR s.status = ?) AND u.role = ?',
      [req.academyId, 'active', 'student']
    );

    res.json({
      academy,
      subscription,
      currentStudents: studentCount?.count || 0,
      tierLimits: TIER_LIMITS,
      yearlyPrices: YEARLY_PRICES,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// 요금제 목록 (프론트엔드용)
// ─────────────────────────────────────────────
router.get('/plans', (req, res) => {
  const plans = Object.entries(TIER_LIMITS)
    .filter(([key]) => key !== 'trial')
    .map(([key, val]) => ({
      id: key,
      name: key === 'free' ? 'Free' : key === 'basic' ? 'Basic' : key === 'standard' ? 'Standard' : 'Pro',
      price: val.price,
      yearlyPrice: YEARLY_PRICES[key] || null,
      maxStudents: val.maxStudents === 9999 ? '무제한' : `${val.maxStudents}명`,
    }));
  res.json(plans);
});

// ─────────────────────────────────────────────
// 구독 신청 (빌링키 등록 + 첫 결제)
// ─────────────────────────────────────────────
router.post('/subscribe', async (req, res) => {
  try {
    const { planType, billingCycle, billingKey, paymentId } = req.body;

    if (!planType || !['basic', 'standard', 'pro'].includes(planType)) {
      return res.status(400).json({ error: '유효한 플랜을 선택해주세요.' });
    }
    if (!billingKey && !paymentId) {
      return res.status(400).json({ error: '결제 정보가 필요합니다.' });
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const limits = TIER_LIMITS[planType];
    const amount = cycle === 'yearly' ? (YEARLY_PRICES[planType] || limits.price) : limits.price;

    // 결제 검증
    if (paymentId) {
      const verification = await verifyPayment(paymentId);
      if (!verification.verified) {
        return res.status(400).json({ error: '결제 검증에 실패했습니다.' });
      }
      // 금액 검증 (테스트 모드가 아닌 경우)
      if (!verification.testMode && verification.amount !== amount) {
        return res.status(400).json({ error: `결제 금액이 일치하지 않습니다. (예상: ${amount}원, 실제: ${verification.amount}원)` });
      }
    }

    // 빌링키 검증
    if (billingKey) {
      const keyInfo = await getBillingKeyInfo(billingKey);
      if (!keyInfo.valid) {
        return res.status(400).json({ error: '빌링키 검증에 실패했습니다.' });
      }
    }

    // 기존 구독 비활성화
    await runQuery(
      `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE academy_id = ? AND status IN ('active', 'trial')`,
      [req.academyId]
    );

    // 구독 생성
    const now = new Date();
    const periodEnd = new Date(now);
    if (cycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subId = await runInsert(
      `INSERT INTO subscriptions (academy_id, plan_type, billing_cycle, status, portone_billing_key, current_period_start, current_period_end)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      [req.academyId, planType, cycle, billingKey || null, now.toISOString(), periodEnd.toISOString()]
    );

    // 학원 업데이트
    await runQuery(
      'UPDATE academies SET subscription_tier = ?, max_students = ? WHERE id = ?',
      [planType, limits.maxStudents, req.academyId]
    );

    // 결제 기록
    await runInsert(
      `INSERT INTO payments (academy_id, subscription_id, portone_payment_id, amount, status, paid_at)
       VALUES (?, ?, ?, ?, 'paid', NOW())`,
      [req.academyId, subId, paymentId || 'billing_key_initial', amount]
    );

    // [KPI] payment_success + trial_started + plan_upgraded
    track(req, 'payment_success', { plan: planType, cycle, amount }).catch(() => {});
    track(req, 'plan_upgraded', { to: planType, cycle }).catch(() => {});

    res.json({
      message: '구독이 시작되었습니다.',
      subscription: {
        planType,
        billingCycle: cycle,
        currentPeriodEnd: periodEnd.toISOString(),
        maxStudents: limits.maxStudents,
      },
    });
  } catch (err) {
    console.error('[구독 신청 오류]', err);
    res.status(500).json({ error: '구독 처리 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// 플랜 변경 (업/다운그레이드)
// ─────────────────────────────────────────────
router.put('/change-plan', async (req, res) => {
  try {
    const { planType } = req.body;
    if (!planType || !TIER_LIMITS[planType]) {
      return res.status(400).json({ error: '유효한 플랜을 선택해주세요.' });
    }

    const sub = await getOne(
      `SELECT * FROM subscriptions WHERE academy_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
      [req.academyId]
    );

    if (!sub) {
      return res.status(400).json({ error: '활성 구독이 없습니다.' });
    }

    const limits = TIER_LIMITS[planType];
    const tierOrder = { free: 0, basic: 1, standard: 2, pro: 3 };
    const currentOrder = tierOrder[sub.plan_type] || 0;
    const newOrder = tierOrder[planType] || 0;
    const isUpgrade = newOrder > currentOrder;

    // 업그레이드: 즉시 적용 (차액은 다음 결제에 반영)
    // 다운그레이드: 다음 결제일부터 적용
    if (isUpgrade) {
      await runQuery('UPDATE subscriptions SET plan_type = ? WHERE id = ? AND academy_id = ?', [planType, sub.id, req.academyId]);
      await runQuery(
        'UPDATE academies SET subscription_tier = ?, max_students = ? WHERE id = ?',
        [planType, limits.maxStudents, req.academyId]
      );
    } else {
      // 다운그레이드 예약: 현재 주기 끝나면 변경
      await runQuery(
        `UPDATE subscriptions SET plan_type = ? WHERE id = ? AND academy_id = ?`,
        [planType, sub.id, req.academyId]
      );
      // 학생 수 제한은 다음 결제 시 적용 (현재는 유지)
    }

    // [KPI] plan_upgraded / plan_downgraded
    track(req, isUpgrade ? 'plan_upgraded' : 'plan_downgraded', { from: sub.plan_type, to: planType }).catch(() => {});

    res.json({
      message: isUpgrade ? '플랜이 즉시 업그레이드되었습니다.' : '다음 결제일부터 플랜이 변경됩니다.',
      planType,
      isUpgrade,
      effectiveDate: isUpgrade ? new Date().toISOString() : sub.current_period_end,
    });
  } catch (err) {
    console.error('[플랜 변경 오류]', err);
    res.status(500).json({ error: '플랜 변경 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// 구독 해지
// ─────────────────────────────────────────────
router.post('/cancel', async (req, res) => {
  try {
    const sub = await getOne(
      `SELECT * FROM subscriptions WHERE academy_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
      [req.academyId]
    );

    if (!sub) {
      return res.status(400).json({ error: '활성 구독이 없습니다.' });
    }

    // 즉시 해지하지 않고, 현재 결제 주기 끝까지 사용
    await runQuery(
      `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW(), auto_renew = 0 WHERE id = ? AND academy_id = ?`,
      [sub.id, req.academyId]
    );

    await logAction({
      req, action: 'subscription_cancel', resourceType: 'subscription', resourceId: sub.id,
      before: { status: 'active' }, after: { status: 'canceled', effectiveDate: sub.current_period_end },
    });
    // [KPI] subscription_canceled
    track(req, 'subscription_canceled', { plan: sub.plan_type }).catch(() => {});

    res.json({
      message: '구독이 해지되었습니다. 현재 결제 주기가 끝날 때까지 사용 가능합니다.',
      effectiveDate: sub.current_period_end,
    });
  } catch (err) {
    console.error('[구독 해지 오류]', err);
    res.status(500).json({ error: '해지 처리 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// 결제 수단 변경 (빌링키 재발급)
// ─────────────────────────────────────────────
router.put('/payment-method', async (req, res) => {
  try {
    const { billingKey } = req.body;
    if (!billingKey) return res.status(400).json({ error: '빌링키가 필요합니다.' });

    const keyInfo = await getBillingKeyInfo(billingKey);
    if (!keyInfo.valid) {
      return res.status(400).json({ error: '빌링키 검증 실패' });
    }

    await runQuery(
      `UPDATE subscriptions SET portone_billing_key = ? WHERE academy_id = ? AND status IN ('active', 'past_due')`,
      [billingKey, req.academyId]
    );

    res.json({
      message: '결제 수단이 변경되었습니다.',
      cardInfo: keyInfo.cardInfo,
    });
  } catch (err) {
    console.error('[결제 수단 변경 오류]', err);
    res.status(500).json({ error: '처리 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// 수동 재결제 (결제 실패 후)
// ─────────────────────────────────────────────
router.post('/retry-payment', async (req, res) => {
  try {
    const result = await retryPayment(req.academyId);
    if (result.success) {
      res.json({ message: '결제가 성공했습니다. 구독이 복구되었습니다.' });
    } else {
      res.status(400).json({ error: result.error || '결제에 실패했습니다.' });
    }
  } catch (err) {
    console.error('[재결제 오류]', err);
    res.status(500).json({ error: '처리 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// 이번 달 사용량
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// 결제 내역
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// 결제 검증 (프론트엔드 콜백 — 일회성 결제)
// ─────────────────────────────────────────────
router.post('/verify-payment', async (req, res) => {
  try {
    const { paymentId, amount, planType, billingCycle } = req.body;

    const verification = await verifyPayment(paymentId);
    if (!verification.verified) {
      return res.status(400).json({ error: '결제 검증에 실패했습니다.' });
    }

    const tier = planType || 'basic';
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.basic;
    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';

    // 구독 생성
    const now = new Date();
    const periodEnd = new Date(now);
    if (cycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // 기존 구독 비활성화
    await runQuery(
      `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE academy_id = ? AND status IN ('active', 'trial')`,
      [req.academyId]
    );

    await runInsert(
      `INSERT INTO subscriptions (academy_id, plan_type, billing_cycle, status, current_period_start, current_period_end)
       VALUES (?, ?, ?, 'active', ?, ?)`,
      [req.academyId, tier, cycle, now.toISOString(), periodEnd.toISOString()]
    );

    await runQuery(
      'UPDATE academies SET subscription_tier = ?, max_students = ? WHERE id = ?',
      [tier, limits.maxStudents, req.academyId]
    );

    await runInsert(
      `INSERT INTO payments (academy_id, portone_payment_id, amount, status, paid_at) VALUES (?, ?, ?, 'paid', NOW())`,
      [req.academyId, paymentId, amount]
    );

    res.json({ message: '결제가 완료되었습니다.', tier, maxStudents: limits.maxStudents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '결제 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
