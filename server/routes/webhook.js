/**
 * PortOne V2 웹훅 핸들러
 *
 * POST /api/webhook/portone
 *
 * - 인증 미들웨어 스킵 (별도 시그니처 검증)
 * - 중복 처리 방지 (webhook_events 테이블로 idempotency 체크)
 * - 이벤트 타입별 처리:
 *   - payment.paid → payments 상태 업데이트 + 구독 기간 연장
 *   - payment.failed → payments 실패 기록 + 재시도 큐
 *   - payment.cancelled → 환불 처리
 *   - billing_key.deleted → 빌링키 삭제 처리
 */

const express = require('express');
const crypto = require('crypto');
const { getAll, getOne, runQuery, runInsert } = require('../db/database');
const { TIER_LIMITS, YEARLY_PRICES } = require('../middleware/subscription');
const { logAction } = require('../services/audit');

const router = express.Router();

// ─────────────────────────────────────────────
// PortOne V2 웹훅 시그니처 검증
// ─────────────────────────────────────────────
function verifyWebhookSignature(req) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    // 시크릿 미설정 시 테스트 모드로 통과
    console.warn('[웹훅] PORTONE_WEBHOOK_SECRET 미설정 — 시그니처 검증 스킵');
    return true;
  }

  const signature = req.headers['x-portone-signature'];
  if (!signature) {
    console.error('[웹훅] 시그니처 헤더 누락');
    return false;
  }

  // PortOne V2: HMAC-SHA256(webhook_secret, raw_body)
  const rawBody = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expected, 'utf8')
  );
}

// ─────────────────────────────────────────────
// 중복 처리 방지 (idempotency)
// ─────────────────────────────────────────────
async function checkDuplicate(paymentId, eventType) {
  if (!paymentId) return false;

  const existing = await getOne(
    `SELECT id FROM webhook_events WHERE payment_id = ? AND event_type = ?`,
    [paymentId, eventType]
  );

  return !!existing;
}

async function logWebhookEvent(eventType, paymentId, webhookId, rawData) {
  await runInsert(
    `INSERT INTO webhook_events (event_type, payment_id, webhook_id, raw_data, processed_at)
     VALUES (?, ?, ?, ?::jsonb, NOW())`,
    [eventType, paymentId, webhookId, JSON.stringify(rawData)]
  );
}

// ─────────────────────────────────────────────
// POST /api/webhook/portone
// ─────────────────────────────────────────────
router.post('/portone', async (req, res) => {
  const tag = '[웹훅/PortOne]';

  try {
    // 1. 시그니처 검증
    if (!verifyWebhookSignature(req)) {
      console.error(`${tag} 시그니처 검증 실패`);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, data } = req.body;
    const paymentId = data?.paymentId || data?.payment_id || null;
    const webhookId = req.headers['x-portone-idempotency-key'] || `wh_${Date.now()}`;

    console.log(`${tag} 이벤트 수신: ${type}, paymentId: ${paymentId}`);

    // 2. 중복 체크
    if (paymentId && await checkDuplicate(paymentId, type)) {
      console.log(`${tag} 중복 이벤트 무시: ${paymentId} / ${type}`);
      return res.status(200).json({ message: 'Already processed' });
    }

    // 3. 이벤트 타입별 처리
    const academyMatch = paymentId && paymentId.match(/^sub_(\d+)_/);
    const webhookAcademyId = academyMatch ? parseInt(academyMatch[1]) : null;
    // 웹훅은 req.user/req.academyId 없음 → 감사 로그용 shim
    const auditReq = {
      academyId: webhookAcademyId,
      user: null,
      headers: req.headers || {},
      ip: req.ip,
    };

    switch (type) {
      case 'payment.paid':
        await handlePaymentPaid(paymentId, data);
        await logAction({
          req: auditReq, action: 'payment_success', resourceType: 'payment',
          after: { paymentId, amount: data?.amount?.total || data?.amount || null },
        });
        break;

      case 'payment.failed':
        await handlePaymentFailed(paymentId, data);
        await logAction({
          req: auditReq, action: 'payment_failed', resourceType: 'payment',
          after: { paymentId, reason: data?.failure?.message || data?.failReason || null },
        });
        break;

      case 'payment.cancelled':
        await handlePaymentCancelled(paymentId, data);
        break;

      case 'billing_key.deleted':
        await handleBillingKeyDeleted(data);
        break;

      default:
        console.log(`${tag} 미처리 이벤트 타입: ${type}`);
    }

    // 4. 이벤트 로그 기록
    await logWebhookEvent(type, paymentId, webhookId, req.body);

    res.status(200).json({ message: 'OK' });
  } catch (err) {
    console.error(`${tag} 처리 오류:`, err.message);
    // 웹훅은 5xx 시 재전송하므로, 복구 가능한 에러는 200 반환 안 함
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// payment.paid 핸들러
// ─────────────────────────────────────────────
async function handlePaymentPaid(paymentId, data) {
  const tag = '[웹훅/payment.paid]';
  console.log(`${tag} 결제 완료: ${paymentId}`);

  // payments 테이블에서 해당 결제 찾기
  const payment = await getOne(
    `SELECT * FROM payments WHERE portone_payment_id = ?`,
    [paymentId]
  );

  if (payment) {
    // 이미 존재하는 결제 → 상태만 업데이트
    await runQuery(
      `UPDATE payments SET status = 'paid', paid_at = NOW() WHERE id = ?`,
      [payment.id]
    );
  }

  // 해당 학원의 active 구독 찾기 (paymentId에서 academy_id 추출)
  // paymentId 형식: sub_{academyId}_{timestamp}
  const match = paymentId.match(/^sub_(\d+)_/);
  if (!match) {
    console.log(`${tag} 구독 결제가 아닌 일반 결제 (paymentId: ${paymentId})`);
    return;
  }

  const academyId = parseInt(match[1]);
  const sub = await getOne(
    `SELECT * FROM subscriptions WHERE academy_id = ? AND status IN ('active', 'past_due') ORDER BY id DESC LIMIT 1`,
    [academyId]
  );

  if (!sub) {
    console.log(`${tag} 학원 ${academyId}의 활성 구독 없음`);
    return;
  }

  // 구독 기간 연장
  const isYearly = sub.billing_cycle === 'yearly';
  const nextEnd = new Date(sub.current_period_end || new Date());
  if (isYearly) {
    nextEnd.setFullYear(nextEnd.getFullYear() + 1);
  } else {
    nextEnd.setMonth(nextEnd.getMonth() + 1);
  }

  await runQuery(
    `UPDATE subscriptions
     SET status = 'active',
         current_period_start = current_period_end,
         current_period_end = ?,
         payment_retry_count = 0,
         last_payment_failed_at = NULL
     WHERE id = ?`,
    [nextEnd.toISOString(), sub.id]
  );

  await runQuery(`UPDATE academies SET is_active = 1 WHERE id = ?`, [academyId]);

  console.log(`${tag} ✅ 학원 ${academyId}: 구독 기간 연장 → ${nextEnd.toISOString()}`);
}

// ─────────────────────────────────────────────
// payment.failed 핸들러
// ─────────────────────────────────────────────
async function handlePaymentFailed(paymentId, data) {
  const tag = '[웹훅/payment.failed]';
  console.log(`${tag} 결제 실패: ${paymentId}`);

  const failReason = data?.failure?.message || data?.failReason || '결제 실패';

  // payments 테이블에서 해당 결제 찾기
  const payment = await getOne(
    `SELECT * FROM payments WHERE portone_payment_id = ?`,
    [paymentId]
  );

  if (payment) {
    await runQuery(
      `UPDATE payments SET status = 'failed', failed_reason = ? WHERE id = ?`,
      [failReason, payment.id]
    );
  }

  // 구독 결제인 경우 past_due 처리
  const match = paymentId.match(/^sub_(\d+)_/);
  if (!match) return;

  const academyId = parseInt(match[1]);
  const sub = await getOne(
    `SELECT * FROM subscriptions WHERE academy_id = ? AND status IN ('active', 'past_due') ORDER BY id DESC LIMIT 1`,
    [academyId]
  );

  if (sub) {
    const retryCount = (sub.payment_retry_count || 0) + 1;

    await runQuery(
      `UPDATE subscriptions
       SET status = 'past_due',
           payment_retry_count = ?,
           last_payment_failed_at = NOW()
       WHERE id = ?`,
      [retryCount, sub.id]
    );

    // 알림 발송
    await runInsert(
      `INSERT INTO platform_notifications (academy_id, type, title, message, created_at)
       VALUES (?, 'payment', '결제 실패', ?, NOW())`,
      [academyId, `자동 결제가 실패했습니다. (사유: ${failReason}) 결제 수단을 확인해주세요. (재시도 ${retryCount}/3회)`]
    );

    console.log(`${tag} 학원 ${academyId}: past_due 처리 (재시도 ${retryCount}/3)`);
  }
}

// ─────────────────────────────────────────────
// payment.cancelled 핸들러 (환불)
// ─────────────────────────────────────────────
async function handlePaymentCancelled(paymentId, data) {
  const tag = '[웹훅/payment.cancelled]';
  console.log(`${tag} 결제 취소/환불: ${paymentId}`);

  // payments 상태 업데이트
  await runQuery(
    `UPDATE payments SET status = 'refunded' WHERE portone_payment_id = ?`,
    [paymentId]
  );

  // 해당 학원 찾기
  const payment = await getOne(
    `SELECT academy_id, subscription_id FROM payments WHERE portone_payment_id = ?`,
    [paymentId]
  );

  if (payment?.academy_id) {
    await runInsert(
      `INSERT INTO platform_notifications (academy_id, type, title, message, created_at)
       VALUES (?, 'payment', '결제 환불 완료', '결제가 환불 처리되었습니다.', NOW())`,
      [payment.academy_id]
    );

    console.log(`${tag} ✅ 학원 ${payment.academy_id}: 환불 처리 완료`);
  }
}

// ─────────────────────────────────────────────
// billing_key.deleted 핸들러
// ─────────────────────────────────────────────
async function handleBillingKeyDeleted(data) {
  const tag = '[웹훅/billing_key.deleted]';
  const billingKey = data?.billingKey || data?.billing_key;

  if (!billingKey) {
    console.log(`${tag} 빌링키 정보 누락`);
    return;
  }

  console.log(`${tag} 빌링키 삭제: ${billingKey.substring(0, 10)}...`);

  // 해당 빌링키를 사용하는 구독 찾아서 NULL 처리
  const result = await runQuery(
    `UPDATE subscriptions SET portone_billing_key = NULL WHERE portone_billing_key = ?`,
    [billingKey]
  );

  // 해당 학원에 알림
  const subs = await getAll(
    `SELECT academy_id FROM subscriptions WHERE portone_billing_key IS NULL AND status = 'active'`,
    []
  );

  // 방금 NULL 처리된 구독의 학원에 알림
  // (billing_key가 이미 NULL이므로, 최근 변경된 건을 찾기 어려움 → 로그만 남김)
  console.log(`${tag} 빌링키 삭제 처리 완료`);
}

module.exports = router;
