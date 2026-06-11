// 요금제 라우트
//
//   GET  /api/tiers                    — 공개 (랜딩 페이지용 — is_public=true 만)
//   GET  /api/tiers/all                — 관리자 (비공개 포함)
//   PUT  /api/superadmin/tiers/:key    — 슈퍼관리자 전용 수정
//   POST /api/superadmin/tiers         — 슈퍼관리자 신규 생성 (드뭄)
//   GET  /api/ai-credits               — 로그인한 학원의 잔액
//   GET  /api/ai-credits/history       — 사용 이력
//   POST /api/superadmin/ai-credits/:academyId/grant — 크레딧 지급

const express = require('express');
const { getAll, getOne, runQuery, runInsert } = require('../db/database');
const { authenticateToken, requireSuperAdmin, requireAdmin } = require('../middleware/auth');
const { invalidateTierCache } = require('../middleware/subscription');
const { getBalance, getTransactionHistory, grantCredits } = require('../services/aiCredits');

const router = express.Router();

// ─────────────────────────────────────────────
// 공개: 랜딩에서 요금제 카드 렌더링용
// ─────────────────────────────────────────────
router.get('/public', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT tier_key, display_name, sort_order, monthly_price, yearly_price,
              max_students, ai_credits_monthly, description, features,
              highlighted, cta_label, cta_type
       FROM subscription_tiers
       WHERE is_active = TRUE AND is_public = TRUE
       ORDER BY sort_order ASC`
    );
    res.json(rows.map((r) => ({
      ...r,
      features: typeof r.features === 'string' ? JSON.parse(r.features) : r.features,
    })));
  } catch (err) {
    console.error('[tiers/public]', err);
    res.status(500).json({ error: '요금제 정보를 불러올 수 없습니다.' });
  }
});

// ─────────────────────────────────────────────
// 로그인 사용자용 (AI 기능 접근 가능 여부 등)
// ─────────────────────────────────────────────
router.get('/features/:featureKey', async (req, res) => {
  try {
    const row = await getOne(
      `SELECT feature_key, display_name, credit_cost, description, is_active
       FROM ai_feature_costs WHERE feature_key = ?`,
      [req.params.featureKey]
    );
    if (!row) return res.status(404).json({ error: '기능을 찾을 수 없습니다.' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

router.get('/features', async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT feature_key, display_name, credit_cost, description, model, is_active
       FROM ai_feature_costs
       WHERE is_active = TRUE
       ORDER BY credit_cost, feature_key`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// 관리자 (로그인 필요)
// ─────────────────────────────────────────────
router.use(authenticateToken);

// 전체 목록 (슈퍼관리자용 — 비공개 포함)
router.get('/all', requireSuperAdmin, async (req, res) => {
  try {
    const rows = await getAll(
      `SELECT t.*, u.name as updated_by_name
       FROM subscription_tiers t
       LEFT JOIN users u ON u.id = t.updated_by
       ORDER BY sort_order ASC`
    );
    res.json(rows.map((r) => ({
      ...r,
      features: typeof r.features === 'string' ? JSON.parse(r.features) : r.features,
      legacy_aliases: typeof r.legacy_aliases === 'string' ? JSON.parse(r.legacy_aliases) : r.legacy_aliases,
    })));
  } catch (err) {
    console.error('[tiers/all]', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// 내 학원의 AI 크레딧 잔액 (admin)
// ─────────────────────────────────────────────
router.get('/my-credits', requireAdmin, async (req, res) => {
  try {
    if (!req.academyId) return res.json({ balance: 0, monthly_quota: 0 });
    const balance = await getBalance(req.academyId);
    res.json(balance);
  } catch (err) {
    res.status(500).json({ error: '크레딧 조회 실패' });
  }
});

router.get('/my-credits/history', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;
    const history = await getTransactionHistory(req.academyId, { limit, offset });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: '이력 조회 실패' });
  }
});

// ─────────────────────────────────────────────
// 슈퍼관리자: 요금제 수정
// ─────────────────────────────────────────────
router.put('/admin/:key', requireSuperAdmin, async (req, res) => {
  try {
    const tierKey = req.params.key;
    const {
      display_name, sort_order, monthly_price, yearly_price,
      max_students, ai_credits_monthly, description, features,
      highlighted, cta_label, cta_type, is_public, is_active,
    } = req.body;

    const existing = await getOne('SELECT id FROM subscription_tiers WHERE tier_key = ?', [tierKey]);
    if (!existing) return res.status(404).json({ error: '요금제를 찾을 수 없습니다.' });

    await runQuery(
      `UPDATE subscription_tiers SET
         display_name = COALESCE(?, display_name),
         sort_order = COALESCE(?, sort_order),
         monthly_price = COALESCE(?, monthly_price),
         yearly_price = COALESCE(?, yearly_price),
         max_students = COALESCE(?, max_students),
         ai_credits_monthly = COALESCE(?, ai_credits_monthly),
         description = COALESCE(?, description),
         features = COALESCE(?::jsonb, features),
         highlighted = COALESCE(?, highlighted),
         cta_label = COALESCE(?, cta_label),
         cta_type = COALESCE(?, cta_type),
         is_public = COALESCE(?, is_public),
         is_active = COALESCE(?, is_active),
         updated_by = ?,
         updated_at = NOW()
       WHERE tier_key = ?`,
      [
        display_name ?? null,
        sort_order ?? null,
        monthly_price ?? null,
        yearly_price ?? null,
        max_students ?? null,
        ai_credits_monthly ?? null,
        description ?? null,
        features !== undefined ? JSON.stringify(features) : null,
        highlighted ?? null,
        cta_label ?? null,
        cta_type ?? null,
        is_public ?? null,
        is_active ?? null,
        req.user.id,
        tierKey,
      ]
    );

    invalidateTierCache();
    const updated = await getOne('SELECT * FROM subscription_tiers WHERE tier_key = ?', [tierKey]);
    res.json({
      ...updated,
      features: typeof updated.features === 'string' ? JSON.parse(updated.features) : updated.features,
    });
  } catch (err) {
    console.error('[tiers/update]', err);
    res.status(500).json({ error: '요금제 수정 실패', detail: err.message });
  }
});

// AI 기능 단가 수정
router.put('/admin/features/:featureKey', requireSuperAdmin, async (req, res) => {
  try {
    const { credit_cost, display_name, description, is_active } = req.body;
    await runQuery(
      `UPDATE ai_feature_costs SET
         credit_cost = COALESCE(?, credit_cost),
         display_name = COALESCE(?, display_name),
         description = COALESCE(?, description),
         is_active = COALESCE(?, is_active),
         updated_at = NOW()
       WHERE feature_key = ?`,
      [credit_cost ?? null, display_name ?? null, description ?? null, is_active ?? null, req.params.featureKey]
    );
    const row = await getOne('SELECT * FROM ai_feature_costs WHERE feature_key = ?', [req.params.featureKey]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: '기능 단가 수정 실패' });
  }
});

// 특정 학원에 크레딧 지급
router.post('/admin/credits/:academyId/grant', requireSuperAdmin, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const n = parseInt(amount);
    if (!n || n <= 0) return res.status(400).json({ error: 'amount는 양수여야 합니다.' });

    const result = await grantCredits(parseInt(req.params.academyId), n, reason || 'manual', req.user.id);
    res.json({ message: `${n} 크레딧이 지급되었습니다.`, balance: result });
  } catch (err) {
    console.error('[tiers/grant]', err);
    res.status(500).json({ error: err.message || '크레딧 지급 실패' });
  }
});

module.exports = router;
