-- 부하 테스트용 시드 데이터
-- 실행: psql $DATABASE_URL -f setup-test-data.sql
-- 주의: 로컬/스테이징 전용. 프로덕션 실행 금지.

BEGIN;

-- 1. 테스트 학원 5개
INSERT INTO academies (name, slug, subscription_tier, max_students, is_active, settings)
VALUES
  ('부하테스트학원1', 'loadtest-1', 'pro', 100, true, '{}'::jsonb),
  ('부하테스트학원2', 'loadtest-2', 'pro', 100, true, '{}'::jsonb),
  ('부하테스트학원3', 'loadtest-3', 'pro', 100, true, '{}'::jsonb),
  ('부하테스트학원4', 'loadtest-4', 'pro', 100, true, '{}'::jsonb),
  ('부하테스트학원5', 'loadtest-5', 'pro', 100, true, '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- 2. admin 계정 (비번: loadtest1234 → bcrypt 해시)
-- password 해시: $2a$10$N9qo8uLOickgx2ZMRZoMye... (loadtest1234)
-- 실제 사용 시 서버 콘솔에서 bcrypt.hash('loadtest1234', 10) 으로 교체
DO $$
DECLARE
  academy_rec RECORD;
  i INT;
  hashed_pw TEXT := '$2a$10$ZGQGr8K4FqQ0EjH1mGKXVuSzFhPCKqYxYJfRqVhMJqGQRQcBwXK.S';
BEGIN
  FOR academy_rec IN SELECT id, slug FROM academies WHERE slug LIKE 'loadtest-%'
  LOOP
    -- 학원당 admin 1명
    INSERT INTO users (username, password, name, role, approved, phone, academy_id)
    VALUES (
      'loadtest_admin_' || REPLACE(academy_rec.slug, 'loadtest-', ''),
      hashed_pw,
      '부하테스트관리자',
      'admin',
      1,
      '01000000000',
      academy_rec.id
    )
    ON CONFLICT (username) DO NOTHING;

    -- 학원당 학생 30명
    FOR i IN 1..30 LOOP
      INSERT INTO users (username, password, name, role, approved, phone, academy_id)
      VALUES (
        'loadtest_s_' || academy_rec.id || '_' || i,
        hashed_pw,
        '테스트학생' || i,
        'student',
        1,
        '01011111111',
        academy_rec.id
      )
      ON CONFLICT (username) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 3. students 테이블 (users 기반)
INSERT INTO students (user_id, academy_id, name, school, grade, parent_phone, status)
SELECT
  u.id,
  u.academy_id,
  u.name,
  '테스트고',
  '2학년',
  '01022222222',
  'active'
FROM users u
WHERE u.username LIKE 'loadtest_s_%'
  AND NOT EXISTS (SELECT 1 FROM students s WHERE s.user_id = u.id)
LIMIT 500;

-- 4. classes 학원당 3개
DO $$
DECLARE
  academy_rec RECORD;
BEGIN
  FOR academy_rec IN SELECT id FROM academies WHERE slug LIKE 'loadtest-%'
  LOOP
    INSERT INTO classes (academy_id, name, subject, description)
    VALUES
      (academy_rec.id, '평일 오후반', '국어', '부하테스트'),
      (academy_rec.id, '주말 오전반', '수학', '부하테스트'),
      (academy_rec.id, '심화반', '영어', '부하테스트')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

COMMIT;

-- 확인
SELECT 'academies' as t, COUNT(*) FROM academies WHERE slug LIKE 'loadtest-%'
UNION ALL
SELECT 'users', COUNT(*) FROM users WHERE username LIKE 'loadtest_%'
UNION ALL
SELECT 'students', COUNT(*) FROM students WHERE academy_id IN (SELECT id FROM academies WHERE slug LIKE 'loadtest-%')
UNION ALL
SELECT 'classes', COUNT(*) FROM classes WHERE description = '부하테스트';
