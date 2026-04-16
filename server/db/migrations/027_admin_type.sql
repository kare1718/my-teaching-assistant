-- 027: 관리자 세부 유형 (원장/강사/행정/상담)
-- admin role인 사용자의 세부 직함을 구분
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_type VARCHAR(20) DEFAULT 'owner';
-- admin_type: 'owner' (원장/대표), 'instructor' (강사/선생님), 'staff' (행정), 'counselor' (상담)
-- admin role인 사용자만 의미 있음
