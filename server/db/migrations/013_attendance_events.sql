-- 013: 출결 이벤트 모델 고도화

-- 1. attendance 테이블 컬럼 추가
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS class_session_id INTEGER;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS modified_by INTEGER;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS modification_reason TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS auto_notified BOOLEAN DEFAULT false;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS makeup_session_id INTEGER;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS makeup_status VARCHAR(20);

-- 2. attendance_logs (정정 이력)
CREATE TABLE IF NOT EXISTS attendance_logs (
  id SERIAL PRIMARY KEY,
  attendance_id INTEGER REFERENCES attendance(id) ON DELETE CASCADE,
  previous_status VARCHAR(30),
  new_status VARCHAR(30),
  changed_by INTEGER REFERENCES users(id),
  change_reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_attendance ON attendance_logs(attendance_id);

-- 3. attendance_rules (출결 정책)
CREATE TABLE IF NOT EXISTS attendance_rules (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id) UNIQUE,
  late_threshold_minutes INTEGER DEFAULT 10,
  absence_alert_enabled BOOLEAN DEFAULT true,
  absence_alert_delay_minutes INTEGER DEFAULT 30,
  auto_parent_notify BOOLEAN DEFAULT true,
  consecutive_absence_alert INTEGER DEFAULT 3,
  makeup_deadline_days INTEGER DEFAULT 14,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_rules_academy ON attendance_rules(academy_id);
