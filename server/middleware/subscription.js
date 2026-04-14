const { getOne } = require('../db/database');

// ============================================================================
// 요금제 4단 구조 (마누스 권고 기준) — 모든 가격 VAT 별도
// Free        : 체험용 (15명) — 성적/출결/공지/자료/Q&A만
// Starter     : 49,000원/월 (50명) — 운영 기본팩 (학생/수납/SMS/보호자앱/기본상담)
// Pro         : 129,000원/월 (100명) — 자동화 + 상담 CRM + 고급 리포트 + AI 리포트
// First Class : 별도 문의 — 게이미피케이션/랭킹/상점/AI 문제 생성/브랜딩
// ※ 표기된 가격은 모두 VAT 별도 금액 (UI에서 "VAT 별도" 문구 노출 필수)
// ============================================================================

// 공통 Free 기능 (체험용 최소 기능 세트)
// - scores      : 성적 관리 (routes/scores.js)
// - attendance  : 출결 (routes/attendance.js)
// - notices     : 공지사항 (routes/notices.js)
// - materials   : 수업자료 (routes/materials.js)
// - qna         : Q&A (routes/qna.js)
const FREE_FEATURES = ['scores', 'attendance', 'notices', 'materials', 'qna'];

// Starter 추가 기능 (운영 기본팩)
// - students           : 학생 관리 고급 (routes/students.js)
// - tuition_basic      : 수납 기본 (routes/tuition.js 기본 기능)
// - sms                : SMS 발송 (routes/sms.js, Solapi)
// - parent_app         : 보호자 앱/확인 기능 (routes/parent.js)
// - reviews            : 리뷰/피드백 (routes/reviews.js)
// - consultation_basic : 기본 상담 메모 (routes/consultations.js 기본)
// - consultation       : (호환) 기존 키 유지
const STARTER_EXTRA = [
  'students',
  'tuition_basic',
  'sms',
  'parent_app',
  'reviews',
  'consultation_basic',
  'consultation', // 기존 호환성
];

// Pro 추가 기능 (자동화 + CRM + 리포트)
// - automation         : 자동화 규칙 (routes/automations.js, 크론잡)
// - consultation_crm   : 상담 CRM — 단계/파이프라인/히스토리
// - advanced_reports   : 고급 리포트 (routes/reports.js)
// - messaging_policy   : 메시징 정책 (발송 룰/수신거부)
// - leads_pipeline     : 리드/상담 신청 파이프라인
// - tuition_exceptions : 수납 예외/할인/분납 (routes/tuition.js 고급)
// - ai_reports         : AI 리포트 (routes/ai.js 리포트 생성)
// - attendance_alert   : 출결 알림 (기존 호환)
// - clinic             : 클리닉 (기존 호환)
// - homework           : 과제 (기존 호환)
// - study_timer        : 공부 타이머 (기존 호환)
// - omr                : OMR (기존 호환)
// - detailed_reports   : 상세 리포트 (기존 호환)
// - notice_reads       : 공지 읽음 확인 (기존 호환)
const PRO_EXTRA = [
  'automation',
  'consultation_crm',
  'advanced_reports',
  'messaging_policy',
  'leads_pipeline',
  'tuition_exceptions',
  'ai_reports',
  // 기존 호환
  'attendance_alert',
  'clinic',
  'homework',
  'study_timer',
  'omr',
  'detailed_reports',
  'notice_reads',
];

// First Class 추가 기능 (리텐션/게이미피케이션/AI)
// - gamification        : 게이미피케이션 시스템 (routes/gamification.js)
// - rankings            : 랭킹 (routes/rankings.js)
// - shop                : 상점/포인트 교환 (routes/shop.js)
// - titles              : 칭호 (routes/titles.js)
// - quiz_vocab          : 어휘 퀴즈 (routes/quiz.js)
// - quiz_knowledge      : 지식 퀴즈
// - quiz_reading        : 독해 퀴즈
// - ox_quiz             : OX 퀴즈
// - avatar              : 아바타 커스터마이징 (routes/avatar.js)
// - ai_quiz_generation  : AI 문제 생성 (routes/ai.js 문제 생성)
// - portfolio           : 학습 포트폴리오 (기존 호환)
// - branding            : 브랜딩 (로고/컬러/도메인)
// - branding_logo       : (호환) 기존 로고 브랜딩 키
// - hall_of_fame        : 명예의 전당
// - quiz                : (호환) 기존 퀴즈 통합 키
// - knowledge_quiz      : (호환) 기존 키
// - reading_quiz        : (호환) 기존 키
const FIRST_CLASS_EXTRA = [
  'gamification',
  'rankings',
  'shop',
  'titles',
  'quiz_vocab',
  'quiz_knowledge',
  'quiz_reading',
  'ox_quiz',
  'avatar',
  'ai_quiz_generation',
  'portfolio',
  'branding',
  'branding_logo',
  'hall_of_fame',
  // 기존 호환
  'quiz',
  'knowledge_quiz',
  'reading_quiz',
];

// 계층형으로 합산 (상위 티어는 하위 티어 기능을 모두 포함)
const FREE = [...FREE_FEATURES];
const STARTER = [...FREE, ...STARTER_EXTRA];
const PRO = [...STARTER, ...PRO_EXTRA];
const FIRST_CLASS = [...PRO, ...FIRST_CLASS_EXTRA];

const TIER_FEATURES = {
  free: FREE,
  starter: STARTER,
  pro: PRO,
  first_class: FIRST_CLASS,

  // ─────────────────────────────────────────────
  // 레거시 호환 매핑 (삭제 금지)
  // 기존 DB에 남아있을 수 있는 tier 값을 현행 4단 구조로 매핑
  // 실제 신규 학원은 Free/Starter/Pro/First Class 중 선택
  // ─────────────────────────────────────────────
  trial: FREE,           // 구 체험 플랜 → free (14일 체험은 is_trial 플래그로 대체)
  basic: STARTER,        // 구 Basic → Starter
  standard: PRO,         // 구 Standard → Pro
  growth: PRO,           // 구 Growth → Pro
  premium: FIRST_CLASS,  // 구 Premium → First Class
};

// price는 모두 월 요금 (VAT 별도). first_class는 별도 문의 → price=null
// vatIncluded: false = 표시 금액이 VAT 별도임을 나타내는 플래그
const TIER_LIMITS = {
  free:        { maxStudents: 15,   price: 0,      smsIncluded: 0, vatIncluded: false },
  starter:     { maxStudents: 50,   price: 49000,  smsIncluded: 0, vatIncluded: false },
  pro:         { maxStudents: 100,  price: 129000, smsIncluded: 0, vatIncluded: false },
  first_class: { maxStudents: null, price: null,   smsIncluded: 0, vatIncluded: false, inquiry: true },

  // ─────────────────────────────────────────────
  // 레거시 호환 매핑 (삭제 금지)
  // 기존 DB에 남아있을 수 있는 tier 값을 현행 4단 구조로 매핑
  // ─────────────────────────────────────────────
  trial:    { maxStudents: 15,   price: 0,      smsIncluded: 0, vatIncluded: false },
  basic:    { maxStudents: 50,   price: 49000,  smsIncluded: 0, vatIncluded: false },
  standard: { maxStudents: 100,  price: 129000, smsIncluded: 0, vatIncluded: false },
  growth:   { maxStudents: 100,  price: 129000, smsIncluded: 0, vatIncluded: false },
  premium:  { maxStudents: null, price: null,   smsIncluded: 0, vatIncluded: false, inquiry: true },
};

// 티어 한글/표시명
// ─────────────────────────────────────────────
// 레거시 호환 주의 (삭제 금지)
// 레거시 tier(trial/basic/standard/growth/premium)는 UI 표시 시
// 반드시 TIER_FEATURES 매핑을 거쳐 현행 4단 중 하나의 label로 변환되어야 함
// (TIER_LABELS는 현행 키만 유지 — 신규 DB는 항상 이 4개 중 하나)
// ─────────────────────────────────────────────
const TIER_LABELS = {
  free:        'Free',
  starter:     'Starter',
  pro:         'Pro',
  first_class: 'First Class',
};

// 연간 결제 시 할인 (15%) — 월환산 금액, VAT 별도
// first_class는 별도 문의이므로 연간 가격 없음
const YEARLY_PRICES = {
  starter: 41650,   // 월환산 41,650원 (연 499,800원, 15% 할인)
  pro:     109650,  // 월환산 109,650원 (연 1,315,800원, 15% 할인)
  // 레거시 호환
  basic:    41650,
  standard: 109650,
  growth:   109650,
};

function requireFeature(feature) {
  return async (req, res, next) => {
    if (!req.academyId) return next();
    // superadmin은 모든 기능 접근 가능
    if (req.user && req.user.role === 'superadmin') return next();

    try {
      const academy = await getOne('SELECT subscription_tier FROM academies WHERE id = ?', [req.academyId]);
      if (!academy) return res.status(404).json({ error: '학원 정보를 찾을 수 없습니다.' });

      const tier = academy.subscription_tier || 'starter';
      const features = TIER_FEATURES[tier] || TIER_FEATURES.starter;

      if (features.includes('all') || features.includes(feature)) {
        return next();
      }

      return res.status(403).json({
        error: '현재 구독 플랜에서 사용할 수 없는 기능입니다.',
        requiredTier: Object.entries(TIER_FEATURES).find(([, feats]) => feats.includes(feature))?.[0] || 'first_class',
        currentTier: tier,
      });
    } catch (err) {
      console.error('Subscription check error:', err);
      next();
    }
  };
}

module.exports = { requireFeature, TIER_FEATURES, TIER_LIMITS, TIER_LABELS, YEARLY_PRICES };
