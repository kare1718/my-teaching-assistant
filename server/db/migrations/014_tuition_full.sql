-- 014: 수납 6레이어 완성 (조정, 환불, 정산, 증빙)

-- 1. tuition_records 컬럼 추가
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS adjusted_amount INTEGER;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS approved_by INTEGER;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS refund_amount INTEGER DEFAULT 0;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS refund_method VARCHAR(30);
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS refund_approved_by INTEGER;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS refund_at TIMESTAMPTZ;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS receipt_issued BOOLEAN DEFAULT false;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS class_id INTEGER;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS parent_id INTEGER;
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS installment_group_id VARCHAR(100);
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS installment_seq INTEGER;

-- 2. tuition_adjustments (조정 이력)
CREATE TABLE IF NOT EXISTS tuition_adjustments (
  id SERIAL PRIMARY KEY,
  tuition_record_id INTEGER REFERENCES tuition_records(id) ON DELETE CASCADE,
  academy_id INTEGER REFERENCES academies(id),
  adjustment_type VARCHAR(30) NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  approved_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tuition_adj_record ON tuition_adjustments(tuition_record_id);
CREATE INDEX IF NOT EXISTS idx_tuition_adj_academy ON tuition_adjustments(academy_id);

-- 3. tuition_refunds (환불)
CREATE TABLE IF NOT EXISTS tuition_refunds (
  id SERIAL PRIMARY KEY,
  tuition_record_id INTEGER REFERENCES tuition_records(id),
  academy_id INTEGER REFERENCES academies(id),
  refund_amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  calculation_detail JSONB,
  refund_method VARCHAR(30),
  status VARCHAR(20) DEFAULT 'pending',
  requested_by INTEGER,
  approved_by INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tuition_refunds_record ON tuition_refunds(tuition_record_id);
CREATE INDEX IF NOT EXISTS idx_tuition_refunds_academy ON tuition_refunds(academy_id);
CREATE INDEX IF NOT EXISTS idx_tuition_refunds_status ON tuition_refunds(status);

-- 4. tuition_settlements (정산/마감)
CREATE TABLE IF NOT EXISTS tuition_settlements (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  settlement_month VARCHAR(7) NOT NULL,
  total_billed INTEGER DEFAULT 0,
  total_collected INTEGER DEFAULT 0,
  total_outstanding INTEGER DEFAULT 0,
  total_refunded INTEGER DEFAULT 0,
  total_adjusted INTEGER DEFAULT 0,
  net_revenue INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open',
  closed_by INTEGER,
  closed_at TIMESTAMPTZ,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academy_id, settlement_month)
);
CREATE INDEX IF NOT EXISTS idx_tuition_settlements_academy ON tuition_settlements(academy_id);
