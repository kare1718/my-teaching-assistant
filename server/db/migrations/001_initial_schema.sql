-- 001: Initial PostgreSQL Schema
-- Converted from SQLite (academy-manager)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'student',
  approved INTEGER DEFAULT 0,
  phone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  school VARCHAR(255),
  grade VARCHAR(100),
  parent_name VARCHAR(255),
  parent_phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  exam_type VARCHAR(255),
  school VARCHAR(255),
  grade VARCHAR(100),
  total_score NUMERIC DEFAULT 100,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  exam_id INTEGER REFERENCES exams(id),
  score NUMERIC,
  rank INTEGER,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, exam_id)
);

CREATE TABLE IF NOT EXISTS class_materials (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  school VARCHAR(255),
  grade VARCHAR(100),
  uploaded_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notices (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  target_school VARCHAR(255),
  target_grade VARCHAR(100),
  is_pinned INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  content TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  is_best INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  title VARCHAR(255),
  content TEXT NOT NULL,
  answer TEXT,
  image_path VARCHAR(500),
  is_answered INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profile_edit_requests (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  field_name VARCHAR(100),
  old_value VARCHAR(255),
  new_value VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 게이미피케이션 테이블
CREATE TABLE IF NOT EXISTS characters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  emoji VARCHAR(10),
  description TEXT,
  unlock_level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_characters (
  id SERIAL PRIMARY KEY,
  student_id INTEGER UNIQUE,
  character_id INTEGER REFERENCES characters(id),
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  points INTEGER DEFAULT 0,
  selected_title_id INTEGER,
  avatar_config TEXT,
  nickname VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xp_logs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  amount INTEGER,
  source VARCHAR(100),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS titles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  condition_type VARCHAR(100),
  condition_value INTEGER,
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_titles (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  title_id INTEGER REFERENCES titles(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, title_id)
);

CREATE TABLE IF NOT EXISTS redeem_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  code_type VARCHAR(50) DEFAULT 'xp',
  xp_amount INTEGER DEFAULT 0,
  points_amount INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active INTEGER DEFAULT 1,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_redemptions (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  code_id INTEGER REFERENCES redeem_codes(id),
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, code_id)
);

CREATE TABLE IF NOT EXISTS vocab_words (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100),
  question_text TEXT NOT NULL,
  correct_answer VARCHAR(255) NOT NULL,
  wrong_answers TEXT,
  difficulty INTEGER DEFAULT 1,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vocab_game_logs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  category VARCHAR(100),
  total_questions INTEGER,
  correct_count INTEGER,
  xp_earned INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  price INTEGER NOT NULL,
  stock INTEGER DEFAULT -1,
  image_url VARCHAR(500),
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_purchases (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  item_id INTEGER REFERENCES shop_items(id),
  price_paid INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 클리닉 테이블
CREATE TABLE IF NOT EXISTS clinic_slots (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  max_students INTEGER DEFAULT 5,
  current_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinic_applications (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  slot_id INTEGER REFERENCES clinic_slots(id),
  status VARCHAR(50) DEFAULT 'pending',
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, slot_id)
);

-- 스케줄 테이블
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  school VARCHAR(255),
  grade VARCHAR(100),
  day_of_week INTEGER,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  room VARCHAR(100),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 명예의 전당
CREATE TABLE IF NOT EXISTS hall_of_fame (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  category VARCHAR(100),
  title VARCHAR(255),
  description TEXT,
  score NUMERIC,
  date DATE,
  is_visible INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 조교 스케줄
CREATE TABLE IF NOT EXISTS ta_schedules (
  id SERIAL PRIMARY KEY,
  ta_user_id INTEGER,
  day_of_week INTEGER,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  location VARCHAR(255),
  memo TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 숙제
CREATE TABLE IF NOT EXISTS homework (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  school VARCHAR(255),
  grade VARCHAR(100),
  due_date DATE,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homework_submissions (
  id SERIAL PRIMARY KEY,
  homework_id INTEGER REFERENCES homework(id),
  student_id INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  content TEXT,
  file_path VARCHAR(500),
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  grade_score INTEGER,
  feedback TEXT,
  UNIQUE(homework_id, student_id)
);

-- OX 퀴즈
CREATE TABLE IF NOT EXISTS ox_questions (
  id SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  correct_answer VARCHAR(1) NOT NULL,
  explanation TEXT,
  category VARCHAR(100),
  difficulty INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ox_game_logs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  total_questions INTEGER,
  correct_count INTEGER,
  xp_earned INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 독해 퀴즈
CREATE TABLE IF NOT EXISTS reading_passages (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  content TEXT NOT NULL,
  category VARCHAR(100),
  difficulty INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reading_questions (
  id SERIAL PRIMARY KEY,
  passage_id INTEGER REFERENCES reading_passages(id),
  question_text TEXT NOT NULL,
  correct_answer VARCHAR(255),
  wrong_answers TEXT,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reading_game_logs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  passage_id INTEGER,
  total_questions INTEGER,
  correct_count INTEGER,
  xp_earned INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 지식 퀴즈
CREATE TABLE IF NOT EXISTS knowledge_questions (
  id SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  correct_answer VARCHAR(255) NOT NULL,
  wrong_answers TEXT,
  category VARCHAR(100),
  difficulty INTEGER DEFAULT 1,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_game_logs (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  category VARCHAR(100),
  total_questions INTEGER,
  correct_count INTEGER,
  xp_earned INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS 로그
CREATE TABLE IF NOT EXISTS sms_logs (
  id SERIAL PRIMARY KEY,
  sender VARCHAR(50),
  receiver VARCHAR(50),
  message TEXT,
  status VARCHAR(50),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 리포트
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  report_type VARCHAR(100),
  content TEXT,
  ai_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 출석 체크
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  date DATE,
  status VARCHAR(50) DEFAULT 'present',
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);
