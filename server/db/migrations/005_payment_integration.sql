-- 005: 결제 연동 보강

-- 수납 기록에 결제 토큰 + 결제 ID 추가
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS payment_token VARCHAR(255);
ALTER TABLE tuition_records ADD COLUMN IF NOT EXISTS portone_payment_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_tuition_records_token ON tuition_records(payment_token);

-- 구독 테이블에 auto_renew 추가 (없으면)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew INTEGER DEFAULT 1;

-- payments 테이블에 subscription_id 추가 (없으면)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS subscription_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failed_reason TEXT;
