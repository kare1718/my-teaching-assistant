-- 004: SaaS 신규 기능 테이블 + 기존 테이블 보강

-- ============================================================
-- 1. 출결 시스템 강화 (attendance 테이블 보강)
-- ============================================================

-- 기존 attendance 테이블에 컬럼 추가
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'present';
  -- status: present(출석), absent(결석), late(지각), early_leave(조퇴), makeup(보강), counseling(상담)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS method VARCHAR(20) DEFAULT 'manual';
  -- method: manual(수동), number(번호입력), qr(QR코드)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS parent_notified INTEGER DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS class_name VARCHAR(100);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS noted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- ============================================================
-- 2. 수납 관리 (tuition)
-- ============================================================

-- 수강료 플랜
CREATE TABLE IF NOT EXISTS tuition_plans (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  name VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 수납 기록
CREATE TABLE IF NOT EXISTS tuition_records (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  student_id INTEGER REFERENCES students(id),
  plan_id INTEGER REFERENCES tuition_plans(id),
  amount INTEGER NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  -- status: pending(미납), paid(완납), overdue(연체), partial(부분납부), refunded(환불)
  paid_at TIMESTAMPTZ,
  paid_amount INTEGER DEFAULT 0,
  payment_method VARCHAR(50),
  portone_payment_id VARCHAR(255),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 수납 알림 설정
CREATE TABLE IF NOT EXISTS tuition_alert_settings (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id) UNIQUE,
  days_before_due INTEGER DEFAULT 5,
  days_after_overdue INTEGER DEFAULT 7,
  alert_time VARCHAR(5) DEFAULT '12:45',
  alert_method VARCHAR(20) DEFAULT 'alimtalk',
  -- alert_method: sms, alimtalk
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tuition_records_academy ON tuition_records(academy_id);
CREATE INDEX IF NOT EXISTS idx_tuition_records_student ON tuition_records(student_id);
CREATE INDEX IF NOT EXISTS idx_tuition_records_status ON tuition_records(status);
CREATE INDEX IF NOT EXISTS idx_tuition_records_due ON tuition_records(due_date);
CREATE INDEX IF NOT EXISTS idx_tuition_plans_academy ON tuition_plans(academy_id);

-- ============================================================
-- 3. 상담 일지
-- ============================================================

CREATE TABLE IF NOT EXISTS consultation_logs (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  student_id INTEGER REFERENCES students(id),
  counselor_name VARCHAR(100),
  counselor_user_id INTEGER,
  consultation_type VARCHAR(50) DEFAULT 'general',
  -- type: general(일반), phone(전화), visit(방문), online(온라인)
  content TEXT NOT NULL,
  tags TEXT,
  follow_up_date DATE,
  follow_up_done INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_academy ON consultation_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_consultation_student ON consultation_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_consultation_date ON consultation_logs(created_at);

-- ============================================================
-- 4. 학생 포트폴리오
-- ============================================================

CREATE TABLE IF NOT EXISTS portfolios (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  student_id INTEGER REFERENCES students(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500),
  file_type VARCHAR(50),
  file_size INTEGER,
  uploaded_by INTEGER,
  is_visible_to_parent INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_academy ON portfolios(academy_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_student ON portfolios(student_id);

-- ============================================================
-- 5. SMS 크레딧 시스템
-- ============================================================

-- 학원별 SMS 잔액
CREATE TABLE IF NOT EXISTS sms_credits (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id) UNIQUE,
  balance INTEGER DEFAULT 0,
  total_charged INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0,
  last_charged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS 크레딧 거래 내역
CREATE TABLE IF NOT EXISTS sms_credit_transactions (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  type VARCHAR(20) NOT NULL,
  -- type: charge(충전), use(사용), refund(환불)
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  sms_type VARCHAR(20),
  -- sms_type: sms(9.9원), lms(30원), alimtalk(7.5원), friendtalk(15원)
  unit_price NUMERIC(10,1),
  message_count INTEGER,
  portone_payment_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_credits_academy ON sms_credits(academy_id);
CREATE INDEX IF NOT EXISTS idx_sms_transactions_academy ON sms_credit_transactions(academy_id);
CREATE INDEX IF NOT EXISTS idx_sms_transactions_type ON sms_credit_transactions(type);

-- ============================================================
-- 6. 공지 읽음 확인
-- ============================================================

CREATE TABLE IF NOT EXISTS notice_reads (
  id SERIAL PRIMARY KEY,
  notice_id INTEGER REFERENCES notices(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notice_reads_notice ON notice_reads(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_reads_user ON notice_reads(user_id);

-- ============================================================
-- 7. 푸시 알림 토큰 (앱 출시 대비)
-- ============================================================

CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  academy_id INTEGER REFERENCES academies(id),
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,
  -- platform: ios, android, web
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_academy ON push_tokens(academy_id);

-- ============================================================
-- 8. 학생 테이블 보강 (원생 명부)
-- ============================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS enrolled_at DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS withdrawn_at DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_number VARCHAR(20);
  -- 출결 체크용 고유 번호 (4자리)

-- ============================================================
-- 9. 구독 테이블 보강
-- ============================================================

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS portone_billing_key TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- ============================================================
-- 10. 학원 테이블 보강
-- ============================================================

ALTER TABLE academies ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'trial';
-- subscription_tier가 이미 있으면 무시됨 (IF NOT EXISTS)
