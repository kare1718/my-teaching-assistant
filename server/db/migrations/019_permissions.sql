-- 019_permissions.sql
-- RBAC 권한 매트릭스 (리소스 × 역할 × 액션)

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  allowed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academy_id, role, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_academy_role
  ON permissions(academy_id, role);
