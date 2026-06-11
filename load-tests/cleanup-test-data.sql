-- 부하 테스트 데이터 정리 (테스트 후 실행)
BEGIN;

DELETE FROM attendance WHERE student_id IN (
  SELECT id FROM students WHERE academy_id IN (SELECT id FROM academies WHERE slug LIKE 'loadtest-%')
);
DELETE FROM students WHERE academy_id IN (SELECT id FROM academies WHERE slug LIKE 'loadtest-%');
DELETE FROM classes WHERE academy_id IN (SELECT id FROM academies WHERE slug LIKE 'loadtest-%');
DELETE FROM users WHERE username LIKE 'loadtest_%';
DELETE FROM academies WHERE slug LIKE 'loadtest-%';

COMMIT;
