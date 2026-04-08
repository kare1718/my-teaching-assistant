/**
 * PortOne V2 결제 서비스
 *
 * 3가지 결제 유형:
 * 1. SaaS 구독 정기결제 (빌링키 기반)
 * 2. SMS 크레딧 일회성 결제
 * 3. 학부모 수납 일회성 결제 (공개 링크)
 */

const PORTONE_API_URL = 'https://api.portone.io';

// PortOne V2 인증 토큰 발급
async function getAccessToken() {
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    console.warn('[PortOne] API_SECRET 미설정 — 테스트 모드');
    return null;
  }

  const res = await fetch(`${PORTONE_API_URL}/login/api-secret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiSecret }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PortOne 인증 실패: ${err}`);
  }

  const data = await res.json();
  return data.accessToken;
}

// ─────────────────────────────────────────────
// 1. 결제 검증 (일회성 + 빌링키 결제 모두)
// ─────────────────────────────────────────────

async function verifyPayment(paymentId) {
  const token = await getAccessToken();
  if (!token) {
    // 테스트 모드: API 키 없으면 항상 성공 처리
    return { verified: true, testMode: true, amount: 0, status: 'PAID' };
  }

  const res = await fetch(`${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`결제 조회 실패: ${err}`);
  }

  const payment = await res.json();

  return {
    verified: payment.status === 'PAID',
    testMode: false,
    amount: payment.amount?.total || 0,
    status: payment.status,
    method: payment.method?.type || 'unknown',
    paidAt: payment.paidAt,
    billingKey: payment.billingKey || null,
    raw: payment,
  };
}

// ─────────────────────────────────────────────
// 2. 빌링키 발급 (정기결제용 카드 등록)
// ─────────────────────────────────────────────

// 프론트엔드에서 PortOne SDK로 빌링키를 발급받고,
// 서버에서는 발급된 빌링키를 검증만 합니다.
async function getBillingKeyInfo(billingKey) {
  const token = await getAccessToken();
  if (!token) {
    return { valid: true, testMode: true };
  }

  const res = await fetch(`${PORTONE_API_URL}/billing-keys/${encodeURIComponent(billingKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return { valid: false, error: '빌링키 조회 실패' };
  }

  const data = await res.json();
  return {
    valid: true,
    testMode: false,
    cardInfo: data.methods?.[0]?.card || null,
    issuedAt: data.issuedAt,
  };
}

// ─────────────────────────────────────────────
// 3. 빌링키로 정기결제 실행
// ─────────────────────────────────────────────

async function chargeByBillingKey({ billingKey, amount, orderName, academyId, subscriptionId }) {
  const token = await getAccessToken();
  const paymentId = `sub_${academyId}_${Date.now()}`;

  if (!token) {
    // 테스트 모드
    console.log(`[PortOne 테스트] 정기결제: ${amount}원, 학원 ${academyId}`);
    return {
      success: true,
      testMode: true,
      paymentId,
      amount,
    };
  }

  const res = await fetch(`${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}/billing-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      billingKey,
      orderName: orderName || `나만의 조교 구독 (학원 #${academyId})`,
      amount: { total: amount },
      currency: 'KRW',
      customer: { id: `academy_${academyId}` },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return {
      success: false,
      testMode: false,
      error: err.message || '결제 실패',
      paymentId,
    };
  }

  const data = await res.json();
  return {
    success: true,
    testMode: false,
    paymentId,
    amount,
    paidAt: data.paidAt,
  };
}

// ─────────────────────────────────────────────
// 4. 결제 취소 (환불)
// ─────────────────────────────────────────────

async function cancelPayment(paymentId, reason, amount) {
  const token = await getAccessToken();
  if (!token) {
    return { success: true, testMode: true };
  }

  const body = { reason: reason || '구독 해지' };
  if (amount) body.amount = amount; // 부분 환불

  const res = await fetch(`${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.message || '환불 실패' };
  }

  return { success: true, testMode: false };
}

// ─────────────────────────────────────────────
// 5. 자동 결제 처리 (cron에서 호출)
// ─────────────────────────────────────────────

const { getAll, getOne, runQuery, runInsert } = require('../db/database');
const { TIER_LIMITS, YEARLY_PRICES } = require('../middleware/subscription');

async function processAutoPayments() {
  console.log('[자동결제] 만료 구독 확인 중...');

  // 오늘 만료되는 active 구독 조회
  const expiring = await getAll(
    `SELECT s.*, a.name as academy_name, a.subscription_tier
     FROM subscriptions s
     JOIN academies a ON a.id = s.academy_id
     WHERE s.status = 'active'
       AND s.portone_billing_key IS NOT NULL
       AND s.current_period_end::date <= CURRENT_DATE`,
    []
  );

  console.log(`[자동결제] ${expiring.length}건 처리 대상`);

  for (const sub of expiring) {
    const tier = sub.plan_type;
    const isYearly = sub.billing_cycle === 'yearly';
    const amount = isYearly ? (YEARLY_PRICES[tier] || 0) : (TIER_LIMITS[tier]?.price || 0);

    if (amount <= 0) continue;

    const result = await chargeByBillingKey({
      billingKey: sub.portone_billing_key,
      amount,
      orderName: `나만의 조교 ${tier} ${isYearly ? '연간' : '월간'} 구독`,
      academyId: sub.academy_id,
      subscriptionId: sub.id,
    });

    if (result.success) {
      // 결제 성공 → 구독 기간 연장
      const nextEnd = new Date(sub.current_period_end);
      if (isYearly) {
        nextEnd.setFullYear(nextEnd.getFullYear() + 1);
      } else {
        nextEnd.setMonth(nextEnd.getMonth() + 1);
      }

      await runQuery(
        `UPDATE subscriptions SET current_period_start = current_period_end, current_period_end = ?, status = 'active' WHERE id = ?`,
        [nextEnd.toISOString(), sub.id]
      );

      await runInsert(
        `INSERT INTO payments (academy_id, subscription_id, portone_payment_id, amount, status, paid_at) VALUES (?, ?, ?, ?, 'paid', NOW())`,
        [sub.academy_id, sub.id, result.paymentId, amount]
      );

      console.log(`[자동결제] ✅ 학원 ${sub.academy_name}: ${amount}원 결제 성공`);
    } else {
      // 결제 실패 → past_due로 변경
      await runQuery(`UPDATE subscriptions SET status = 'past_due' WHERE id = ?`, [sub.id]);

      await runInsert(
        `INSERT INTO payments (academy_id, subscription_id, portone_payment_id, amount, status, created_at) VALUES (?, ?, ?, ?, 'failed', NOW())`,
        [sub.academy_id, sub.id, result.paymentId || 'auto_failed', amount]
      );

      console.log(`[자동결제] ❌ 학원 ${sub.academy_name}: 결제 실패 — ${result.error}`);
    }
  }

  // past_due 14일 이상 → suspended
  await runQuery(
    `UPDATE subscriptions SET status = 'suspended'
     WHERE status = 'past_due'
       AND current_period_end::date <= CURRENT_DATE - INTERVAL '14 days'`,
    []
  );

  // suspended → academy 비활성화
  const suspended = await getAll(
    `SELECT academy_id FROM subscriptions WHERE status = 'suspended'`,
    []
  );
  for (const s of suspended) {
    await runQuery(`UPDATE academies SET is_active = 0 WHERE id = ?`, [s.academy_id]);
  }

  console.log('[자동결제] 처리 완료');
}

// ─────────────────────────────────────────────
// 6. 결제 실패 재시도 (수동)
// ─────────────────────────────────────────────

async function retryPayment(academyId) {
  const sub = await getOne(
    `SELECT * FROM subscriptions WHERE academy_id = ? AND status IN ('past_due', 'suspended') ORDER BY id DESC LIMIT 1`,
    [academyId]
  );

  if (!sub) return { success: false, error: '재시도할 구독이 없습니다.' };
  if (!sub.portone_billing_key) return { success: false, error: '등록된 결제 수단이 없습니다.' };

  const tier = sub.plan_type;
  const isYearly = sub.billing_cycle === 'yearly';
  const amount = isYearly ? (YEARLY_PRICES[tier] || 0) : (TIER_LIMITS[tier]?.price || 0);

  const result = await chargeByBillingKey({
    billingKey: sub.portone_billing_key,
    amount,
    orderName: `나만의 조교 ${tier} 구독 (재결제)`,
    academyId,
    subscriptionId: sub.id,
  });

  if (result.success) {
    const nextEnd = new Date();
    if (isYearly) {
      nextEnd.setFullYear(nextEnd.getFullYear() + 1);
    } else {
      nextEnd.setMonth(nextEnd.getMonth() + 1);
    }

    await runQuery(
      `UPDATE subscriptions SET status = 'active', current_period_start = NOW(), current_period_end = ? WHERE id = ?`,
      [nextEnd.toISOString(), sub.id]
    );

    await runQuery(`UPDATE academies SET is_active = 1 WHERE id = ?`, [academyId]);

    await runInsert(
      `INSERT INTO payments (academy_id, subscription_id, portone_payment_id, amount, status, paid_at) VALUES (?, ?, ?, ?, 'paid', NOW())`,
      [academyId, sub.id, result.paymentId, amount]
    );
  }

  return result;
}

module.exports = {
  getAccessToken,
  verifyPayment,
  getBillingKeyInfo,
  chargeByBillingKey,
  cancelPayment,
  processAutoPayments,
  retryPayment,
};
