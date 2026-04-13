-- 011: 보호자 엔티티 분리

-- 1. parents 테이블
CREATE TABLE IF NOT EXISTS parents (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(200),
  relationship VARCHAR(50) DEFAULT '보호자',
  is_payer BOOLEAN DEFAULT false,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academy_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_parents_academy ON parents(academy_id);
CREATE INDEX IF NOT EXISTS idx_parents_user ON parents(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_phone ON parents(phone);

-- 2. student_parents 다대다 연결
CREATE TABLE IF NOT EXISTS student_parents (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES parents(id) ON DELETE CASCADE,
  relationship VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  is_payer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_student_parents_student ON student_parents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_parents_parent ON student_parents(parent_id);

-- 3. message_consent에 FK 추가 (010에서 INTEGER로만 정의됨)
-- parents 테이블이 이제 존재하므로 FK 추가 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'message_consent_parent_id_fkey'
  ) THEN
    ALTER TABLE message_consent ADD CONSTRAINT message_consent_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE;
  END IF;
END $$;
