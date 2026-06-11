// 요금제 미들웨어 — DB 기반 동적 설정
//
// 2026-04 변경:
//   기존: 가격/학생수/기능이 모두 코드에 하드코딩
//   현재: subscription_tiers 테이블 기반 동적 조회 + 메모리 캐시
//
// 기능 매핑 (FEATURE_MATRIX)은 여전히 코드에 — 기능 키는 라우트에 하드코딩되어 있어
// DB 화한다고 의미 없음. 대신 티어별 기능 포함 여부만 DB로 관리 가능 (features_included 컬럼).
// 현재는 tier 레벨(Free→Basic→Pro→First Class) 오름차순 포함 관계를 유지.

const { getOne, getAll } = require('../db/database');

// ─────────────────────────────────────────────
// 기능 매트릭스 (코드 기반 — 라우트 키와 일치해야 함)
// 상위 티어는 하위 티어 기능을 모두 포함
// ─────────────────────────────────────────────
const FREE_FEATURES = ['scores', 'attendance', 'notices', 'materials', 'qna'];

const BASIC_EXTRA = [
  'students', 'tuition_basic', 'sms', 'parent_app', 'reviews',
  'consultation_basic', 'consultation',
];

const PRO_EXTRA = [
  'automation', 'consultation_crm', 'advanced_reports', 'messaging_policy',
  'leads_pipeline', 'tuition_exceptions', 'ai_reports',
  // 호환
  'attendance_alert', 'clinic', 'homework', 'study_timer', 'omr',
  'detailed_reports', 'notice_reads',
];

const FIRST_CLASS_EXTRA = [
  'gamification', 'rankings', 'shop', 'titles', 'quiz_vocab',
  'quiz_knowledge', 'quiz_reading', 'ox_quiz', 'avatar',
  'ai_quiz_generation', 'portfolio', 'branding', 'branding_logo', 'hall_of_fame',
  // 호환
  'quiz', 'knowledge_quiz', 'reading_quiz',
];

// 계층형 합산 (tier_key → 해당 티어에서 쓸 수 있는 모든 기능)
const FREE = [...FREE_FEATURES];
const BASIC = [...FREE, ...BASIC_EXTRA];
const PRO = [...BASIC, ...PRO_EXTRA];
const FIRST_CLASS = [...PRO, ...FIRST_CLASS_EXTRA];

const TIER_FEATURES = {
  free: FREE,
  basic: BASIC,
  pro: PRO,
  first_class: FIRST_CLASS,
  // 레거시 호환
  trial: FREE,
  starter: BASIC,          // 2026-04: Starter → Basic 리네임
  standard: PRO,
  growth: PRO,
  premium: FIRST_CLASS,
};

const TIER_LABELS = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  first_class: 'First Class',
};

// ─────────────────────────────────────────────
// DB 기반 요금제 캐시 (60초)
// 슈퍼관리자가 수정하면 cache invalidation
// ─────────────────────────────────────────────
let tierCache = null;
let tierCacheAt = 0;
const CACHE_TTL_MS = 60 * 1000;

function invalidateTierCache() {
  tierCache = null;
  tierCacheAt = 0;
}

async function loadTiers() {
  const now = Date.now();
  if (tierCache && (now - tierCacheAt) < CACHE_TTL_MS) return tierCache;

  try {
    const rows = await getAll(
      `SELECT tier_key, display_name, sort_order, monthly_price, yearly_price,
              max_students, ai_credits_monthly, description, features,
              highlighted, cta_label, cta_type, is_public, is_active,
              legacy_aliases
       FROM subscription_tiers
       WHERE is_active = TRUE
       ORDER BY sort_order ASC`,
      []
    );
    const byKey = {};
    const aliasMap = {};
    for (const r of rows) {
      const features = Array.isArray(r.features) ? r.features : (typeof r.features === 'string' ? JSON.parse(r.features) : []);
      const aliases = Array.isArray(r.legacy_aliases) ? r.legacy_aliases : (typeof r.legacy_aliases === 'string' ? JSON.parse(r.legacy_aliases) : []);
      const info = {
        key: r.tier_key,
        name: r.display_name,
        sortOrder: r.sort_order,
        monthlyPrice: r.monthly_price,
        yearlyPrice: r.yearly_price,
        maxStudents: r.max_students,
        aiCreditsMonthly: r.ai_credits_monthly,
        description: r.description,
        featuresLabel: features,
        highlighted: r.highlighted,
        ctaLabel: r.cta_label,
        ctaType: r.cta_type,
        isPublic: r.is_public,
        legacyAliases: aliases,
      };
      byKey[r.tier_key] = info;
      for (const a of aliases) aliasMap[a] = r.tier_key;
    }
    tierCache = { byKey, aliasMap, list: rows.map((r) => byKey[r.tier_key]) };
    tierCacheAt = now;
    return tierCache;
  } catch (err) {
    console.error('[subscription] loadTiers 실패 (하드코딩 fallback):', err.message);
    // DB 접근 실패 시 하드코딩 fallback
    return {
      byKey: {
        free: { key: 'free', maxStudents: 15, monthlyPrice: 0, aiCreditsMonthly: 30 },
        basic: { key: 'basic', maxStudents: 50, monthlyPrice: 99000, aiCreditsMonthly: 700 },
        pro: { key: 'pro', maxStudents: 100, monthlyPrice: 199000, aiCreditsMonthly: 1500 },
        first_class: { key: 'first_class', maxStudents: null, monthlyPrice: null, aiCreditsMonthly: 10000 },
      },
      aliasMap: { trial: 'free', starter: 'basic', standard: 'pro', growth: 'pro', premium: 'first_class' },
      list: [],
    };
  }
}

// tier_key 또는 레거시 alias를 현행 tier_key로 정규화
async function resolveTierKey(rawTier) {
  const tiers = await loadTiers();
  if (!rawTier) return 'free';
  if (tiers.byKey[rawTier]) return rawTier;
  if (tiers.aliasMap[rawTier]) return tiers.aliasMap[rawTier];
  return 'free'; // 알 수 없으면 free로 폴백
}

// 특정 학원의 현재 티어 정보 조회
async function getTierForAcademy(academyId) {
  const academy = await getOne('SELECT subscription_tier FROM academies WHERE id = ?', [academyId]);
  if (!academy) return null;
  const key = await resolveTierKey(academy.subscription_tier);
  const tiers = await loadTiers();
  return tiers.byKey[key];
}

// ─────────────────────────────────────────────
// 하위 호환 export (기존 코드 유지)
// ─────────────────────────────────────────────

// 동기식 하드코딩 fallback (코드에서 이미 많이 쓰임 — 런타임 blocking 방지용)
// 이 값은 "초기 기본값" 이며, 실제 실행 경로에서는 DB 값을 사용해야 함.
const TIER_LIMITS = {
  free:        { maxStudents: 15,   price: 0,      smsIncluded: 0, vatIncluded: false, aiCredits: 30 },
  basic:       { maxStudents: 50,   price: 99000,  smsIncluded: 0, vatIncluded: false, aiCredits: 700 },
  pro:         { maxStudents: 100,  price: 199000, smsIncluded: 0, vatIncluded: false, aiCredits: 1500 },
  first_class: { maxStudents: null, price: null,   smsIncluded: 0, vatIncluded: false, inquiry: true, aiCredits: 10000 },
  // 레거시
  trial:    { maxStudents: 15,   price: 0,      smsIncluded: 0, vatIncluded: false, aiCredits: 30 },
  starter:  { maxStudents: 50,   price: 99000,  smsIncluded: 0, vatIncluded: false, aiCredits: 700 },
  standard: { maxStudents: 100,  price: 199000, smsIncluded: 0, vatIncluded: false, aiCredits: 1500 },
  growth:   { maxStudents: 100,  price: 199000, smsIncluded: 0, vatIncluded: false, aiCredits: 1500 },
  premium:  { maxStudents: null, price: null,   smsIncluded: 0, vatIncluded: false, inquiry: true, aiCredits: 10000 },
};

// 연간 할인 (15%) — 월환산
const YEARLY_PRICES = {
  basic:    84150,   // 99000 × 85%
  pro:      169150,  // 199000 × 85%
  // 레거시
  starter:  84150,
  standard: 169150,
  growth:   169150,
};

// ─────────────────────────────────────────────
// 기능 제한 미들웨어
// ─────────────────────────────────────────────
function requireFeature(feature) {
  return async (req, res, next) => {
    if (!req.academyId) return next();
    if (req.user && req.user.role === 'superadmin') return next();

    try {
      const academy = await getOne('SELECT subscription_tier FROM academies WHERE id = ?', [req.academyId]);
      if (!academy) return res.status(404).json({ error: '학원 정보를 찾을 수 없습니다.' });

      const tierKey = await resolveTierKey(academy.subscription_tier);
      const features = TIER_FEATURES[tierKey] || TIER_FEATURES.free;

      if (features.includes('all') || features.includes(feature)) {
        return next();
      }

      const requiredTier = Object.entries(TIER_FEATURES).find(([, feats]) => feats.includes(feature))?.[0] || 'first_class';
      return res.status(403).json({
        error: '현재 구독 플랜에서 사용할 수 없는 기능입니다.',
        requiredTier,
        currentTier: tierKey,
      });
    } catch (err) {
      console.error('Subscription check error:', err);
      next();
    }
  };
}

module.exports = {
  requireFeature,
  TIER_FEATURES,
  TIER_LIMITS,
  TIER_LABELS,
  YEARLY_PRICES,
  // 동적 API
  loadTiers,
  resolveTierKey,
  getTierForAcademy,
  invalidateTierCache,
};
