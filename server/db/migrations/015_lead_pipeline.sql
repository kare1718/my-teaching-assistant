-- 015: 상담 CRM / 리드 파이프라인

-- 1. leads (리드/신규 문의)
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  student_name VARCHAR(100) NOT NULL,
  parent_name VARCHAR(100),
  parent_phone VARCHAR(20),
  school VARCHAR(100),
  grade VARCHAR(20),
  source VARCHAR(50),
  source_detail TEXT,
  status VARCHAR(30) DEFAULT 'new',
  interest_class_id INTEGER,
  assigned_to INTEGER,
  next_contact_date DATE,
  next_contact_memo TEXT,
  lost_reason TEXT,
  converted_student_id INTEGER,
  priority VARCHAR(20) DEFAULT 'normal',
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_academy ON leads(academy_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_contact ON leads(next_contact_date);

-- 2. lead_activities (리드 활동 이력)
CREATE TABLE IF NOT EXISTS lead_activities (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  activity_type VARCHAR(50),
  description TEXT,
  result TEXT,
  next_action TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id);

-- 3. trial_sessions (체험 수업)
CREATE TABLE IF NOT EXISTS trial_sessions (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id),
  academy_id INTEGER REFERENCES academies(id),
  class_id INTEGER,
  trial_date DATE NOT NULL,
  trial_time TIME,
  status VARCHAR(20) DEFAULT 'scheduled',
  feedback TEXT,
  satisfaction INTEGER,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_academy ON trial_sessions(academy_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_lead ON trial_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_date ON trial_sessions(trial_date);
