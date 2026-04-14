-- 022: 수납 예외 처리 8가지 (형제할인/장학금/일할/반변경/분할/부분환불/혼합수납/보강차감)

-- 1. 할인 규칙 (학원 공용)
CREATE TABLE IF NOT EXISTS discount_rules (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(30) NOT NULL, -- sibling/scholarship/promotion/custom
  condition JSONB NOT NULL DEFAULT '{}'::jsonb, -- {min_siblings: 2, ...}
  discount_type VARCHAR(20) NOT NULL, -- percent/fixed
  discount_value INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discount_rules_academy ON discount_rules(academy_id);

-- 2. 학생별 개별 할인 (장학금 등)
CREATE TABLE IF NOT EXISTS student_discounts (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  rule_id INTEGER REFERENCES discount_rules(id) ON DELETE SET NULL,
  amount INTEGER,
  discount_type VARCHAR(20), -- percent/fixed (rule이 없을 경우)
  reason TEXT,
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_discounts_academy ON student_discounts(academy_id);
CREATE INDEX IF NOT EXISTS idx_student_discounts_student ON student_discounts(student_id);

-- 3. 혼합 수납 (한 청구에 여러 결제 수단)
CREATE TABLE IF NOT EXISTS payment_splits (
  id SERIAL PRIMARY KEY,
  tuition_record_id INTEGER REFERENCES tuition_records(id) ON DELETE CASCADE,
  academy_id INTEGER REFERENCES academies(id),
  method VARCHAR(30) NOT NULL, -- card/cash/bank/portone
  amount INTEGER NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  memo TEXT,
  received_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_payment_splits_record ON payment_splits(tuition_record_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_academy ON payment_splits(academy_id);

-- 4. 보강 차감 (결석→보강 미편성 시 다음 청구에서 차감)
CREATE TABLE IF NOT EXISTS makeup_credits (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  attendance_id INTEGER,
  credit_amount INTEGER NOT NULL,
  applied_to_record_id INTEGER REFERENCES tuition_records(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending/applied/expired
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_makeup_credits_academy ON makeup_credits(academy_id);
CREATE INDEX IF NOT EXISTS idx_makeup_credits_student ON makeup_credits(student_id);
CREATE INDEX IF NOT EXISTS idx_makeup_credits_status ON makeup_credits(status);
