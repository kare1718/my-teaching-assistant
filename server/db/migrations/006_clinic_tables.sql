-- 006_clinic_tables.sql
-- 클리닉 관리 테이블 정의 + 고도화 (출석 체크, 상담 연동)

-- clinic_appointments: 클리닉 예약/신청
CREATE TABLE IF NOT EXISTS clinic_appointments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  academy_id INTEGER REFERENCES academies(id),
  appointment_date DATE NOT NULL,
  time_slot VARCHAR(10) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  detail TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  admin_note TEXT,
  approved_at TIMESTAMPTZ,
  attended BOOLEAN DEFAULT NULL,
  consultation_log_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- clinic_notes: 클리닉 세션별 기록/특이사항
CREATE TABLE IF NOT EXISTS clinic_notes (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES clinic_appointments(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  academy_id INTEGER REFERENCES academies(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- clinic_settings: 클리닉 설정 (타임당 제한인원 등)
CREATE TABLE IF NOT EXISTS clinic_settings (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  UNIQUE(setting_key, academy_id)
);

-- 기존 테이블에 새 컬럼 추가 (이미 존재하면 무시)
ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT NULL;
ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS consultation_log_id INTEGER;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_clinic_appts_academy_date ON clinic_appointments(academy_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_clinic_appts_student ON clinic_appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_clinic_appts_status ON clinic_appointments(status);
CREATE INDEX IF NOT EXISTS idx_clinic_notes_appointment ON clinic_notes(appointment_id);
