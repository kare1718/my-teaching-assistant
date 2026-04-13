-- 009: 메시지 정책 엔진 — 운영/마케팅/관계 3유형, 발송 검증, 예약, 수신동의

-- ============================================================
-- 1. sms_send_logs 테이블 컬럼 추가
-- ============================================================

ALTER TABLE sms_send_logs ADD COLUMN IF NOT EXISTS message_category VARCHAR(30) DEFAULT 'operational';
  -- message_category: operational(운영), marketing(마케팅), relationship(관계)
ALTER TABLE sms_send_logs ADD COLUMN IF NOT EXISTS template_id INTEGER;
ALTER TABLE sms_send_logs ADD COLUMN IF NOT EXISTS sender_id INTEGER;
ALTER TABLE sms_send_logs ADD COLUMN IF NOT EXISTS student_id INTEGER;
ALTER TABLE sms_send_logs ADD COLUMN IF NOT EXISTS parent_id INTEGER;
ALTER TABLE sms_send_logs ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'sms';
  -- channel: sms, lms, alimtalk, friendtalk, push
ALTER TABLE sms_send_logs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE sms_send_logs ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;
ALTER TABLE sms_send_logs ADD COLUMN IF NOT EXISTS automation_rule_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_sms_send_logs_category ON sms_send_logs(message_category);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_student ON sms_send_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_parent ON sms_send_logs(parent_id);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_scheduled ON sms_send_logs(scheduled_at);

-- ============================================================
-- 2. sms_templates 테이블 보강
-- ============================================================

ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS academy_id INTEGER;
ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS message_type VARCHAR(30) DEFAULT 'operational';
ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS variables TEXT;
  -- 사용 가능한 변수 목록 (JSON 배열 문자열): ["{student_name}","{parent_name}",...]
ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sms_templates_academy ON sms_templates(academy_id);
CREATE INDEX IF NOT EXISTS idx_sms_templates_type ON sms_templates(message_type);

-- ============================================================
-- 3. 수신 동의 테이블 (message_consent)
-- ============================================================

CREATE TABLE IF NOT EXISTS message_consent (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  parent_id INTEGER,
  -- FK to parents table will be added in future migration (parents table created in Phase 2)
  marketing_consent BOOLEAN DEFAULT false,
  consented_at TIMESTAMPTZ,
  consent_method VARCHAR(30),
    -- consent_method: online, written, verbal
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academy_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_message_consent_academy ON message_consent(academy_id);
CREATE INDEX IF NOT EXISTS idx_message_consent_parent ON message_consent(parent_id);

-- ============================================================
-- 4. 예약 발송 테이블 (message_schedule)
-- ============================================================

CREATE TABLE IF NOT EXISTS message_schedule (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  template_id INTEGER,
  message TEXT NOT NULL,
  message_type VARCHAR(30) NOT NULL DEFAULT 'operational',
  recipients JSONB NOT NULL,
    -- 예: {"student_ids": [1,2,3], "parent_ids": [4,5,6], "phones": ["010..."]}
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
    -- status: pending, sent, cancelled, failed
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_schedule_academy ON message_schedule(academy_id);
CREATE INDEX IF NOT EXISTS idx_message_schedule_status ON message_schedule(status, scheduled_at);
