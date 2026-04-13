-- 017: 학생 통합 타임라인

CREATE TABLE IF NOT EXISTS student_events (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_date TIMESTAMPTZ DEFAULT NOW(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_by INTEGER,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_events_academy ON student_events(academy_id);
CREATE INDEX IF NOT EXISTS idx_student_events_student ON student_events(student_id);
CREATE INDEX IF NOT EXISTS idx_student_events_date ON student_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_events_type ON student_events(event_type);
