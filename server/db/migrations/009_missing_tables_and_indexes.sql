-- 010: 누락 테이블 생성 + academy_id 인덱스 보완
-- 009 이전에 필요했으나 누락된 테이블들을 보완

-- ============================================================
-- 1. sms_send_logs 테이블 생성 (smsBilling.js에서 사용)
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_send_logs (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  batch_id VARCHAR(100),
  message_type VARCHAR(20) DEFAULT 'SMS',
  recipient_phone VARCHAR(20),
  recipient_name VARCHAR(100),
  message_content TEXT,
  cost NUMERIC(10,1) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  solapi_message_id VARCHAR(200),
  error_message TEXT,
  sent_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_send_logs_academy ON sms_send_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_batch ON sms_send_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_created ON sms_send_logs(created_at);

-- ============================================================
-- 2. sms_templates 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_templates (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  name VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(30) DEFAULT 'operational',
  variables TEXT,
  is_default BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_academy ON sms_templates(academy_id);
CREATE INDEX IF NOT EXISTS idx_sms_templates_type ON sms_templates(message_type);

-- ============================================================
-- 3. sms_pricing 테이블 생성 (smsBilling.js에서 조회)
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_pricing (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER DEFAULT 1,
  message_type VARCHAR(20) NOT NULL,
  cost_per_message NUMERIC(10,1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO sms_pricing (academy_id, message_type, cost_per_message) VALUES
  (1, 'SMS', 13), (1, 'LMS', 29), (1, 'MMS', 60), (1, 'ALIMTALK', 8)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. notification_logs 테이블 생성 (notification.js에서 사용)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  student_id INTEGER,
  message TEXT,
  channel VARCHAR(20),
  status VARCHAR(20),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_academy ON notification_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_student ON notification_logs(student_id);

-- ============================================================
-- 5. academy_id 인덱스 누락 보완 (003에서 누락된 25개)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_class_materials_academy ON class_materials(academy_id);
CREATE INDEX IF NOT EXISTS idx_profile_edit_requests_academy ON profile_edit_requests(academy_id);
CREATE INDEX IF NOT EXISTS idx_student_characters_academy ON student_characters(academy_id);
CREATE INDEX IF NOT EXISTS idx_student_titles_academy ON student_titles(academy_id);
CREATE INDEX IF NOT EXISTS idx_code_redemptions_academy ON code_redemptions(academy_id);
CREATE INDEX IF NOT EXISTS idx_vocab_game_logs_academy ON vocab_game_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_academy ON shop_purchases(academy_id);
CREATE INDEX IF NOT EXISTS idx_schedules_academy ON schedules(academy_id);
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_academy ON hall_of_fame(academy_id);
CREATE INDEX IF NOT EXISTS idx_ta_schedules_academy ON ta_schedules(academy_id);
CREATE INDEX IF NOT EXISTS idx_homework_academy ON homework(academy_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_academy ON homework_submissions(academy_id);
CREATE INDEX IF NOT EXISTS idx_ox_questions_academy ON ox_questions(academy_id);
CREATE INDEX IF NOT EXISTS idx_ox_game_logs_academy ON ox_game_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_reading_passages_academy ON reading_passages(academy_id);
CREATE INDEX IF NOT EXISTS idx_reading_questions_academy ON reading_questions(academy_id);
CREATE INDEX IF NOT EXISTS idx_reading_game_logs_academy ON reading_game_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_questions_academy ON knowledge_questions(academy_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_game_logs_academy ON knowledge_game_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_academy ON sms_logs(academy_id);
CREATE INDEX IF NOT EXISTS idx_reports_academy ON reports(academy_id);
