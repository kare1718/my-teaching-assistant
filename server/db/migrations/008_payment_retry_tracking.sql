-- 008: 결제 재시도 추적 + 웹훅 중복 방지

-- payments 테이블에 재시도 추적 컬럼 추가
ALTER TABLE payments ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

-- 웹훅 이벤트 로그 (idempotency 체크용)
CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  payment_id VARCHAR(255),
  webhook_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'processed',
  raw_data JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_payment_type
  ON webhook_events(payment_id, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at);

-- 구독 테이블에 결제 실패 추적 추가
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_retry_count INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ;
