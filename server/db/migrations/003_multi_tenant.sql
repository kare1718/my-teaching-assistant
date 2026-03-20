-- 003: Multi-tenancy tables

-- 학원(테넌트) 테이블
CREATE TABLE IF NOT EXISTS academies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_user_id INTEGER,
  subscription_tier VARCHAR(50) DEFAULT 'basic',
  max_students INTEGER DEFAULT 30,
  settings JSONB DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 구독 테이블
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  plan_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  auto_renew INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 결제 내역
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  subscription_id INTEGER REFERENCES subscriptions(id),
  portone_payment_id VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'KRW',
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(100),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용량 로그
CREATE TABLE IF NOT EXISTS usage_logs (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  usage_type VARCHAR(100),
  count INTEGER DEFAULT 1,
  month VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 테이블에 academy_id 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE students ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE class_materials ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE notices ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE profile_edit_requests ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE student_characters ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE xp_logs ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE student_titles ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE redeem_codes ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE code_redemptions ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE vocab_game_logs ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE shop_purchases ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE clinic_slots ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE clinic_applications ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE hall_of_fame ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE ta_schedules ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE homework ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE ox_questions ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE ox_game_logs ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE reading_passages ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE reading_questions ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE reading_game_logs ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE knowledge_questions ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE knowledge_game_logs ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_academy ON users(academy_id);
CREATE INDEX IF NOT EXISTS idx_students_academy ON students(academy_id);
CREATE INDEX IF NOT EXISTS idx_exams_academy ON exams(academy_id);
CREATE INDEX IF NOT EXISTS idx_scores_academy ON scores(academy_id);
CREATE INDEX IF NOT EXISTS idx_notices_academy ON notices(academy_id);
CREATE INDEX IF NOT EXISTS idx_reviews_academy ON reviews(academy_id);
CREATE INDEX IF NOT EXISTS idx_questions_academy ON questions(academy_id);
CREATE INDEX IF NOT EXISTS idx_characters_academy ON characters(academy_id);
CREATE INDEX IF NOT EXISTS idx_vocab_words_academy ON vocab_words(academy_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_academy ON shop_items(academy_id);
CREATE INDEX IF NOT EXISTS idx_xp_logs_academy ON xp_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_academy ON redeem_codes(academy_id);

-- 마이그레이션 추적 테이블
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
