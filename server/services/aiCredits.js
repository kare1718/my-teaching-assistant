// AI 크레딧 서비스
//
// 사용 흐름:
//   1. AI 기능 호출 전: await checkAndDeduct(academyId, feature, userId)
//   2. 실패(잔액 부족) 시 → 402/403 반환
//   3. 성공 시 실제 AI 호출 진행
//   4. 매월 1일 00:00 cron → refillMonthlyCredits() 로 전체 학원 리필

const { getOne, getAll, runQuery, runInsert } = require('../db/database');

// 월별 리필 — 남은 balance는 버리지 않고, quota 만큼 추가 (purchased는 별도 이월)
// 정책: "남은 월 quota 는 이월 안함 (써야 해서), 구매 크레딧은 이월"
// → balance = purchased_credits + quota (매월 리필 시)
async function refillMonthlyCredits(academyId = null) {
  const sql = academyId
    ? `SELECT a.id, a.subscription_tier, ac.purchased_credits
       FROM academies a
       LEFT JOIN ai_credits ac ON ac.academy_id = a.id
       WHERE a.id = ? AND a.is_active = 1`
    : `SELECT a.id, a.subscription_tier, ac.purchased_credits
       FROM academies a
       LEFT JOIN ai_credits ac ON ac.academy_id = a.id
       WHERE a.is_active = 1`;
  const rows = await getAll(sql, academyId ? [academyId] : []);

  let refilled = 0;
  for (const r of rows) {
    // tier 조회해서 quota 결정
    const tier = await getOne(
      `SELECT ai_credits_monthly FROM subscription_tiers
       WHERE tier_key = ?
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(legacy_aliases, '[]'::jsonb)) AS alias(value)
            WHERE alias.value = ?
          )
       LIMIT 1`,
      [r.subscription_tier, r.subscription_tier]
    );
    const quota = tier?.ai_credits_monthly ?? 0;
    const purchased = r.purchased_credits || 0;
    const newBalance = quota + purchased;

    await runQuery(
      `INSERT INTO ai_credits (academy_id, balance, monthly_quota, used_this_month, last_refilled_at)
       VALUES (?, ?, ?, 0, NOW())
       ON CONFLICT (academy_id) DO UPDATE SET
         balance = EXCLUDED.balance,
         monthly_quota = EXCLUDED.monthly_quota,
         used_this_month = 0,
         last_refilled_at = NOW(),
         updated_at = NOW()`,
      [r.id, newBalance, quota]
    );

    await runInsert(
      `INSERT INTO ai_credit_transactions (academy_id, type, amount, balance_after, feature, meta)
       VALUES (?, 'refill', ?, ?, NULL, ?)`,
      [r.id, quota, newBalance, JSON.stringify({ reason: 'monthly_refill', quota, purchased })]
    );
    refilled++;
  }
  return refilled;
}

// 티어 변경 시 즉시 크레딧 재설정
async function resetCreditsForAcademy(academyId, newTierKey) {
  const tier = await getOne(
    `SELECT ai_credits_monthly FROM subscription_tiers WHERE tier_key = ?`,
    [newTierKey]
  );
  const quota = tier?.ai_credits_monthly ?? 0;
  const existing = await getOne(`SELECT purchased_credits FROM ai_credits WHERE academy_id = ?`, [academyId]);
  const purchased = existing?.purchased_credits || 0;
  const newBalance = quota + purchased;

  await runQuery(
    `INSERT INTO ai_credits (academy_id, balance, monthly_quota, used_this_month, last_refilled_at)
     VALUES (?, ?, ?, 0, NOW())
     ON CONFLICT (academy_id) DO UPDATE SET
       balance = EXCLUDED.balance,
       monthly_quota = EXCLUDED.monthly_quota,
       used_this_month = 0,
       last_refilled_at = NOW(),
       updated_at = NOW()`,
    [academyId, newBalance, quota]
  );
  await runInsert(
    `INSERT INTO ai_credit_transactions (academy_id, type, amount, balance_after, feature, meta)
     VALUES (?, 'adjust', ?, ?, NULL, ?)`,
    [academyId, newBalance, newBalance, JSON.stringify({ reason: 'tier_change', newTier: newTierKey, quota })]
  );
}

// 잔액 조회
async function getBalance(academyId) {
  const row = await getOne(`SELECT * FROM ai_credits WHERE academy_id = ?`, [academyId]);
  if (!row) return { balance: 0, monthly_quota: 0, used_this_month: 0, purchased_credits: 0 };
  return row;
}

// 특정 기능의 크레딧 단가 조회
async function getFeatureCost(featureKey) {
  const row = await getOne(`SELECT credit_cost FROM ai_feature_costs WHERE feature_key = ? AND is_active = TRUE`, [featureKey]);
  return row?.credit_cost ?? 1;
}

// 크레딧 차감 (AI 호출 전 체크 + 차감)
// 성공: { ok: true, remaining }
// 실패: { ok: false, error, balance, required }
async function checkAndDeduct(academyId, featureKey, userId = null, meta = {}) {
  if (!academyId) return { ok: false, error: 'academy_id 필요' };

  const cost = await getFeatureCost(featureKey);
  const balance = await getBalance(academyId);

  if (balance.balance < cost) {
    return {
      ok: false,
      error: 'AI 크레딧이 부족합니다. 다음 달 리필까지 기다리거나 크레딧을 추가 구매해주세요.',
      balance: balance.balance,
      required: cost,
    };
  }

  // 우선 purchased_credits 에서 차감, 남으면 monthly quota에서 차감
  let deductPurchased = 0;
  let deductQuota = cost;

  // 단순화: balance 에서 cost 차감만 하고, purchased 추적은 별도 처리
  await runQuery(
    `UPDATE ai_credits SET
       balance = balance - ?,
       used_this_month = used_this_month + ?,
       updated_at = NOW()
     WHERE academy_id = ?`,
    [cost, cost, academyId]
  );

  const newBalance = balance.balance - cost;

  await runInsert(
    `INSERT INTO ai_credit_transactions (academy_id, type, amount, balance_after, feature, user_id, meta)
     VALUES (?, 'use', ?, ?, ?, ?, ?)`,
    [academyId, -cost, newBalance, featureKey, userId, JSON.stringify(meta || {})]
  );

  return { ok: true, remaining: newBalance, cost };
}

// 크레딧 충전 (구매 또는 프로모션 지급)
async function grantCredits(academyId, amount, reason = 'manual', grantedBy = null) {
  if (amount <= 0) throw new Error('amount는 양수여야 합니다.');

  await runQuery(
    `INSERT INTO ai_credits (academy_id, balance, purchased_credits, monthly_quota)
     VALUES (?, ?, ?, 0)
     ON CONFLICT (academy_id) DO UPDATE SET
       balance = ai_credits.balance + ?,
       purchased_credits = ai_credits.purchased_credits + ?,
       updated_at = NOW()`,
    [academyId, amount, amount, amount, amount]
  );

  const updated = await getBalance(academyId);
  await runInsert(
    `INSERT INTO ai_credit_transactions (academy_id, type, amount, balance_after, feature, user_id, meta)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    [
      academyId,
      reason === 'purchase' ? 'purchase' : 'grant',
      amount,
      updated.balance,
      grantedBy,
      JSON.stringify({ reason }),
    ]
  );

  return updated;
}

// 사용 이력 조회
async function getTransactionHistory(academyId, { limit = 50, offset = 0 } = {}) {
  return await getAll(
    `SELECT t.*, u.name as user_name
     FROM ai_credit_transactions t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.academy_id = ?
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [academyId, limit, offset]
  );
}

// Express 미들웨어 — 라우트에서 편하게 사용
// 사용법: router.post('/ai-answer', requireCredits('ai_answer'), handler)
// req.ai = { cost, deduct } 를 주입. 라우트에서 실제 호출 성공 직후 req.ai.deduct() 호출.
function requireCredits(featureKey) {
  return async (req, res, next) => {
    try {
      if (!req.academyId) return next();
      // superadmin은 크레딧 제약 없음
      if (req.user?.role === 'superadmin') {
        req.ai = { cost: 0, deduct: async () => ({ ok: true }) };
        return next();
      }

      const cost = await getFeatureCost(featureKey);
      const balance = await getBalance(req.academyId);

      if (balance.balance < cost) {
        return res.status(402).json({
          error: 'AI 크레딧이 부족합니다.',
          balance: balance.balance,
          required: cost,
          feature: featureKey,
        });
      }

      // 실제 차감은 라우트에서 AI 호출 성공 후 수동 트리거 (실패 시 낭비 방지)
      req.ai = {
        cost,
        feature: featureKey,
        deduct: async (meta = {}) =>
          checkAndDeduct(req.academyId, featureKey, req.user?.id, meta),
      };

      next();
    } catch (err) {
      console.error('[aiCredits middleware]', err);
      next();
    }
  };
}

module.exports = {
  refillMonthlyCredits,
  resetCreditsForAcademy,
  getBalance,
  getFeatureCost,
  checkAndDeduct,
  grantCredits,
  getTransactionHistory,
  requireCredits,
};
