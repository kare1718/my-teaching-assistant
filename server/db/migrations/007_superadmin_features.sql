-- 007: Super Admin Features - 프로모션, 알림, 활동 로그, 메모

-- 프로모션 마스터 테이블
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  value JSONB NOT NULL,
  code VARCHAR(100) UNIQUE,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 학원별 프로모션 지급 내역
CREATE TABLE IF NOT EXISTS promotion_grants (
  id SERIAL PRIMARY KEY,
  promotion_id INTEGER REFERENCES promotions(id),
  academy_id INTEGER REFERENCES academies(id),
  granted_by INTEGER,
  status VARCHAR(50) DEFAULT 'granted',
  applied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 플랫폼 알림
CREATE TABLE IF NOT EXISTS platform_notifications (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 플랫폼 활동 로그
CREATE TABLE IF NOT EXISTS platform_activity_logs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 학원 메모 (슈퍼관리자용)
CREATE TABLE IF NOT EXISTS academy_memos (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  author_id INTEGER,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자 동의 관련 컬럼
ALTER TABLE users ADD COLUMN IF NOT EXISTS agree_privacy INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agree_marketing INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS agree_marketing_at TIMESTAMPTZ;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_type ON promotions(type);
CREATE INDEX IF NOT EXISTS idx_promotion_grants_academy ON promotion_grants(academy_id);
CREATE INDEX IF NOT EXISTS idx_promotion_grants_promotion ON promotion_grants(promotion_id);
CREATE INDEX IF NOT EXISTS idx_platform_notifications_academy ON platform_notifications(academy_id);
CREATE INDEX IF NOT EXISTS idx_platform_notifications_read ON platform_notifications(academy_id, is_read);
CREATE INDEX IF NOT EXISTS idx_platform_activity_logs_created ON platform_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academy_memos_academy ON academy_memos(academy_id);
