-- 025: 학원 초대 코드 시스템
-- 학생/학부모 가입 시 학원 식별용 전용 초대 코드
-- 기존 slug 기반 초대 코드 플로우와 병행 유지 (하위호환)

ALTER TABLE academies ADD COLUMN IF NOT EXISTS student_invite_code VARCHAR(20);
ALTER TABLE academies ADD COLUMN IF NOT EXISTS parent_invite_code VARCHAR(20);

-- 부분 UNIQUE 인덱스 (NULL 은 중복 허용)
CREATE UNIQUE INDEX IF NOT EXISTS idx_academies_student_invite_code
  ON academies(student_invite_code) WHERE student_invite_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_academies_parent_invite_code
  ON academies(parent_invite_code) WHERE parent_invite_code IS NOT NULL;
