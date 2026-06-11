-- 핸드폰 인증 (가입/비밀번호 재설정 남용 방지)
CREATE TABLE IF NOT EXISTS phone_verifications (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(10) NOT NULL,
  purpose VARCHAR(32) NOT NULL, -- 'signup' | 'password_reset'
  ip VARCHAR(64),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  token VARCHAR(64), -- 인증 성공 시 발급되는 일회용 토큰
  token_used BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_ip ON phone_verifications (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_token ON phone_verifications (token) WHERE token IS NOT NULL;
