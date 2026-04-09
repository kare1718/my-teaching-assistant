const { getOne } = require('../db/database');

// 구독 티어별 기능 제한
// Basic(7.9만): 핵심 기능 — 성적, 게이미피케이션(퀴즈4종/아바타/상점/랭킹), 공지, 수업자료, 브랜딩(학원명/강사명)
// Standard(15.9만): + AI, SMS, 출결알림, 클리닉, 과제, 공부타이머, OMR, 상세리포트, 로고/컬러
// Pro(별도 문의): + 커스텀퀴즈(AI생성), 조교관리, 성적분석그래프, PDF리포트+학부모발송, 수납관리, 전체테마, API내보내기
const TIER_FEATURES = {
  free: ['scores', 'gamification', 'rankings', 'shop', 'titles', 'notices', 'materials', 'reviews', 'qna', 'quiz', 'ox_quiz', 'reading_quiz', 'knowledge_quiz', 'attendance'],
  basic: ['scores', 'gamification', 'rankings', 'shop', 'titles', 'notices', 'materials', 'reviews', 'qna', 'quiz', 'ox_quiz', 'reading_quiz', 'knowledge_quiz', 'attendance'],
  standard: ['scores', 'gamification', 'rankings', 'shop', 'titles', 'notices', 'materials', 'reviews', 'qna', 'quiz', 'ox_quiz', 'reading_quiz', 'knowledge_quiz', 'attendance', 'ai_reports', 'sms', 'attendance_alert', 'clinic', 'homework', 'study_timer', 'omr', 'detailed_reports', 'branding_logo', 'consultation', 'portfolio', 'notice_reads'],
  pro: ['all'],
  trial: ['scores', 'gamification', 'rankings', 'shop', 'titles', 'notices', 'materials', 'reviews', 'qna', 'quiz', 'ox_quiz', 'reading_quiz', 'knowledge_quiz', 'attendance', 'ai_reports', 'sms', 'attendance_alert', 'clinic', 'homework', 'study_timer', 'omr', 'detailed_reports', 'branding_logo', 'consultation', 'portfolio', 'notice_reads'],
};

const TIER_LIMITS = {
  free: { maxStudents: 10, price: 0, smsIncluded: 0 },
  basic: { maxStudents: 50, price: 79000, smsIncluded: 0 },
  standard: { maxStudents: 100, price: 159000, smsIncluded: 0 },
  pro: { maxStudents: 9999, price: 0, smsIncluded: 0 },
  trial: { maxStudents: 10, price: 0, smsIncluded: 0 },
};

// 연간 결제 시 할인 (20%)
// 연간 결제 시 할인 (15%)
const YEARLY_PRICES = {
  basic: 67000,     // 월환산 6.7만 (연 80.4만, 15% 할인)
  standard: 135000, // 월환산 13.5만 (연 162만, 15% 할인)
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

module.exports = { requireFeature, TIER_FEATURES, TIER_LIMITS, YEARLY_PRICES };
