-- 012: 반/수업 모델 도입

-- 1. classes (반)
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  name VARCHAR(100) NOT NULL,
  class_type VARCHAR(30) NOT NULL DEFAULT 'regular',
  subject VARCHAR(50),
  teacher_id INTEGER REFERENCES users(id),
  capacity INTEGER,
  room VARCHAR(50),
  tuition_plan_id INTEGER REFERENCES tuition_plans(id),
  status VARCHAR(20) DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_academy ON classes(academy_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(status);

-- 2. class_students (수강생)
CREATE TABLE IF NOT EXISTS class_students (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  dropped_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);

-- 3. class_sessions (수업 세션)
CREATE TABLE IF NOT EXISTS class_sessions (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  academy_id INTEGER REFERENCES academies(id),
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  teacher_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'scheduled',
  cancel_reason TEXT,
  is_makeup BOOLEAN DEFAULT false,
  original_session_id INTEGER,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_academy ON class_sessions(academy_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class ON class_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_date ON class_sessions(session_date);

-- 4. class_schedules_recurring (반복 일정 규칙)
CREATE TABLE IF NOT EXISTS class_schedules_recurring (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  effective_from DATE,
  effective_until DATE,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_class_recurring_class ON class_schedules_recurring(class_id);

-- 5. teacher_assignments (강사 배정 이력)
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id),
  teacher_id INTEGER REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class ON teacher_assignments(class_id);

-- 6. class_waitlist (대기자)
CREATE TABLE IF NOT EXISTS class_waitlist (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id),
  student_id INTEGER REFERENCES students(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'waiting',
  notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_class_waitlist_class ON class_waitlist(class_id);
