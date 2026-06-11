-- 030: 요금제를 DB 기반 동적 설정으로 전환 + AI 크레딧 시스템
--
-- 배경:
--   기존: server/middleware/subscription.js 에 TIER_LIMITS 하드코딩
--   변경: subscription_tiers 테이블에서 동적 조회, 슈퍼관리자가 UI로 수정
--
-- AI 크레딧:
--   각 학원당 월별 크레딧 풀 (subscription_tier에 따라 크기 다름)
--   매월 1일 00:00 (cron) 자동 리필
--   AI 답변/리포트/문항생성 호출 시 차감
--   부족하면 해당 기능 일시 잠금 or 추가 결제

-- ============================================================
-- 1. 요금제 테이블 (동적 관리)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id SERIAL PRIMARY KEY,
  tier_key VARCHAR(32) UNIQUE NOT NULL,       -- 'free' | 'basic' | 'pro' | 'first_class'
  display_name VARCHAR(64) NOT NULL,           -- 'Free' | 'Basic' | 'Pro' | 'First Class'
  sort_order INT NOT NULL DEFAULT 0,           -- 랜딩페이지 카드 정렬 순서
  monthly_price INT NOT NULL DEFAULT 0,        -- 원 (VAT 별도)
  yearly_price INT,                            -- 연 결제 할인가 (NULL이면 연결제 미제공)
  max_students INT NOT NULL DEFAULT 15,
  ai_credits_monthly INT NOT NULL DEFAULT 0,   -- 월 AI 크레딧
  description TEXT,                            -- 카드 부제목 ("학원 시작에 딱")
  features JSONB NOT NULL DEFAULT '[]'::jsonb, -- 기능 목록 배열 (랜딩페이지 표시)
  highlighted BOOLEAN NOT NULL DEFAULT FALSE,  -- "가장 인기" 배지 표시
  cta_label VARCHAR(32) DEFAULT '시작하기',    -- CTA 버튼 문구
  cta_type VARCHAR(16) DEFAULT 'signup',       -- 'signup' | 'contact' | 'upgrade'
  is_public BOOLEAN NOT NULL DEFAULT TRUE,     -- 랜딩에 노출 여부
  is_active BOOLEAN NOT NULL DEFAULT TRUE,     -- 활성 티어 (false면 신규 가입 차단)
  legacy_aliases JSONB DEFAULT '[]'::jsonb,    -- 레거시 tier_key 매핑 ['starter', 'basic']
  updated_by INT,                              -- 마지막 수정 user_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiers_public_sort
  ON subscription_tiers(is_public, is_active, sort_order);

-- ============================================================
-- 2. 초기 요금제 시드 (새 가격 체계)
-- ============================================================
INSERT INTO subscription_tiers (tier_key, display_name, sort_order, monthly_price, max_students, ai_credits_monthly, description, features, highlighted, cta_label, cta_type, legacy_aliases)
VALUES
  ('free', 'Free', 1, 0, 15, 30,
   '학원 운영을 처음 시작하는 분께',
   '["학생 15명", "출결·성적·공지·자료·Q&A", "월 AI 크레딧 30 (체험용)", "기본 게이미피케이션"]'::jsonb,
   false, '무료로 시작', 'signup',
   '["trial"]'::jsonb),

  ('basic', 'Basic', 2, 99000, 50, 700,
   '체계적인 학원 운영에 필요한 필수 기능',
   '["학생 50명", "SMS·보호자 앱·수납 관리", "상담 CRM 기본", "월 AI 크레딧 700", "자동 알림", "엑셀 Import/Export"]'::jsonb,
   false, '14일 무료 체험', 'signup',
   '["starter"]'::jsonb),

  ('pro', 'Pro', 3, 199000, 100, 1500,
   '자동화와 AI로 시간을 돌려받는 학원',
   '["학생 100명", "Basic 전체 기능 포함", "자동화 엔진 무제한", "월 AI 크레딧 1,500", "AI 학습 리포트", "고급 분석 대시보드", "우선 기술지원"]'::jsonb,
   true, '14일 무료 체험', 'signup',
   '["standard", "growth"]'::jsonb),

  ('first_class', 'First Class', 4, 0, 999, 10000,
   '대형 학원·프랜차이즈를 위한 맞춤 계약',
   '["학생 무제한", "Pro 전체 기능 포함", "월 AI 크레딧 10,000+", "AI 문항 자동 생성", "게이미피케이션 고도화", "화이트라벨/브랜딩", "전담 매니저"]'::jsonb,
   false, '상담 문의', 'contact',
   '["premium"]'::jsonb)
ON CONFLICT (tier_key) DO NOTHING;

-- ============================================================
-- 3. AI 크레딧 잔액 (학원별)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_credits (
  academy_id INT PRIMARY KEY REFERENCES academies(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,              -- 현재 남은 크레딧
  monthly_quota INT NOT NULL DEFAULT 0,        -- 이번달 할당량 (티어 기준)
  used_this_month INT NOT NULL DEFAULT 0,      -- 이번달 누적 사용량
  purchased_credits INT NOT NULL DEFAULT 0,    -- 별도 구매한 크레딧 (이월 가능)
  last_refilled_at TIMESTAMPTZ,                -- 마지막 월 리필 시간
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_last_refill
  ON ai_credits(last_refilled_at);

-- 기존 학원에 대해 현재 tier 기반으로 크레딧 초기화
INSERT INTO ai_credits (academy_id, balance, monthly_quota, last_refilled_at)
SELECT
  a.id,
  COALESCE(t.ai_credits_monthly, 0),
  COALESCE(t.ai_credits_monthly, 0),
  NOW()
FROM academies a
LEFT JOIN subscription_tiers t ON (
  t.tier_key = a.subscription_tier
  OR t.legacy_aliases ? a.subscription_tier
)
WHERE NOT EXISTS (SELECT 1 FROM ai_credits WHERE academy_id = a.id);

-- ============================================================
-- 4. AI 크레딧 거래 이력 (감사용)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id SERIAL PRIMARY KEY,
  academy_id INT NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,           -- 'refill' | 'use' | 'purchase' | 'grant' | 'adjust'
  amount INT NOT NULL,                 -- 양수: 추가, 음수: 차감
  balance_after INT NOT NULL,
  feature VARCHAR(64),                 -- 'ai_answer' | 'ai_report' | 'ai_question' 등
  user_id INT,                         -- 사용한 사용자 (관리자/학생)
  meta JSONB,                          -- 추가 정보 (token count, model name 등)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_tx_academy_created
  ON ai_credit_transactions(academy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_credit_tx_type
  ON ai_credit_transactions(type, created_at DESC);

-- ============================================================
-- 5. AI 기능별 크레딧 단가 (수정 가능)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_feature_costs (
  feature_key VARCHAR(64) PRIMARY KEY,    -- 'ai_answer' | 'ai_report' | 'ai_question_gen' 등
  display_name VARCHAR(128) NOT NULL,
  credit_cost INT NOT NULL DEFAULT 1,     -- 1회 실행당 차감할 크레딧
  model VARCHAR(64),                      -- 'gemini-1.5-flash' 등 (참고용)
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_feature_costs (feature_key, display_name, credit_cost, model, description)
VALUES
  ('ai_answer', 'AI 질문 답변', 1, 'gemini-1.5-flash', '학생/보호자 질문에 AI가 답변'),
  ('ai_report', 'AI 학습 리포트', 3, 'gemini-1.5-flash', '학생별 월간 학습 분석 리포트 생성'),
  ('ai_question_gen', 'AI 문항 생성', 2, 'gemini-1.5-flash', '수능형 국어 문항 자동 생성'),
  ('ai_summary', 'AI 상담 요약', 1, 'gemini-1.5-flash', '상담 기록 자동 요약'),
  ('ai_feedback', 'AI 첨삭', 2, 'gemini-1.5-flash', '서술형 답안 AI 첨삭'),
  ('ai_explain', 'AI 해설 생성', 1, 'gemini-1.5-flash', '오답 해설 자동 생성')
ON CONFLICT (feature_key) DO NOTHING;

-- ============================================================
-- 6. 학원 테이블에 크레딧 동기화 트리거용 컬럼 (이미 있으면 skip)
-- ============================================================
-- 새로운 academies가 생길 때 ai_credits 자동 생성하도록 트리거
CREATE OR REPLACE FUNCTION create_ai_credits_for_new_academy()
RETURNS TRIGGER AS $$
DECLARE
  quota INT;
BEGIN
  SELECT COALESCE(ai_credits_monthly, 0) INTO quota
  FROM subscription_tiers
  WHERE tier_key = NEW.subscription_tier
     OR legacy_aliases ? NEW.subscription_tier
  LIMIT 1;

  INSERT INTO ai_credits (academy_id, balance, monthly_quota, last_refilled_at)
  VALUES (NEW.id, COALESCE(quota, 0), COALESCE(quota, 0), NOW())
  ON CONFLICT (academy_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_ai_credits ON academies;
CREATE TRIGGER trg_create_ai_credits
  AFTER INSERT ON academies
  FOR EACH ROW
  EXECUTE FUNCTION create_ai_credits_for_new_academy();

COMMENT ON TABLE subscription_tiers IS '요금제 — 슈퍼관리자가 UI에서 동적 수정 가능';
COMMENT ON TABLE ai_credits IS '학원별 AI 크레딧 잔액 — 매월 1일 자동 리필';
COMMENT ON TABLE ai_credit_transactions IS 'AI 크레딧 사용/충전 이력';
COMMENT ON TABLE ai_feature_costs IS 'AI 기능별 크레딧 단가 — 슈퍼관리자 수정 가능';
