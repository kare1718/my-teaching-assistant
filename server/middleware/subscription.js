const { getOne } = require('../db/database');

// 구독 티어별 기능 제한
const TIER_FEATURES = {
  basic: ['scores', 'gamification', 'rankings', 'shop', 'titles', 'notices', 'materials', 'reviews', 'qna'],
  standard: ['scores', 'gamification', 'rankings', 'shop', 'titles', 'notices', 'materials', 'reviews', 'qna', 'ai_reports', 'quiz', 'ox_quiz', 'reading_quiz', 'knowledge_quiz'],
  pro: ['scores', 'gamification', 'rankings', 'shop', 'titles', 'notices', 'materials', 'reviews', 'qna', 'ai_reports', 'quiz', 'ox_quiz', 'reading_quiz', 'knowledge_quiz', 'sms', 'clinic', 'homework', 'hall_of_fame', 'ta_schedule', 'schedules', 'reports'],
  enterprise: ['all'],
  trial: ['scores', 'gamification', 'rankings', 'shop', 'titles', 'notices', 'materials', 'reviews', 'qna', 'ai_reports', 'quiz', 'ox_quiz', 'reading_quiz', 'knowledge_quiz', 'sms', 'clinic', 'homework', 'hall_of_fame', 'ta_schedule', 'schedules', 'reports'],
};

const TIER_LIMITS = {
  basic: { maxStudents: 30, price: 30000 },
  standard: { maxStudents: 50, price: 50000 },
  pro: { maxStudents: 100, price: 80000 },
  enterprise: { maxStudents: 9999, price: 0 },
  trial: { maxStudents: 10, price: 0 },
};

function requireFeature(feature) {
  return async (req, res, next) => {
    if (!req.academyId) return next();
    // superadmin은 모든 기능 접근 가능
    if (req.user && req.user.role === 'superadmin') return next();

    try {
      const academy = await getOne('SELECT subscription_tier FROM academies WHERE id = ?', [req.academyId]);
      if (!academy) return res.status(404).json({ error: '학원 정보를 찾을 수 없습니다.' });

      const tier = academy.subscription_tier || 'basic';
      const features = TIER_FEATURES[tier] || TIER_FEATURES.basic;

      if (features.includes('all') || features.includes(feature)) {
        return next();
      }

      return res.status(403).json({
        error: '현재 구독 플랜에서 사용할 수 없는 기능입니다.',
        requiredTier: Object.entries(TIER_FEATURES).find(([, feats]) => feats.includes(feature))?.[0] || 'pro',
        currentTier: tier,
      });
    } catch (err) {
      console.error('Subscription check error:', err);
      next();
    }
  };
}

module.exports = { requireFeature, TIER_FEATURES, TIER_LIMITS };
