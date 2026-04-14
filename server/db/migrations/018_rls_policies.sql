-- 018_rls_policies.sql
-- Supabase / PostgreSQL Row Level Security 정책
--
-- 목적: 애플리케이션 레벨 academy_id 필터가 누락되어도 DB에서 한 번 더 차단.
-- 적용 대상: 핵심 10개 테넌트 스코프 테이블
--
-- 전제:
--   1) 서버가 커넥션 획득 직후 SET app.academy_id = '<학원id>' 실행
--   2) superuser/서비스 롤은 BYPASS RLS 권한을 갖지 않는 일반 롤로 연결
--      (Supabase에서는 'authenticated' 롤 혹은 별도 'app_user' 롤 사용 권장)
--   3) 마이그레이션은 idempotent — 재실행 안전
--
-- 헬퍼:
--   서버측 db/database.js 에서 pool.on('connect', client => client.query(...))
--   로 SET app.academy_id 를 적용하거나, 각 요청 시작 시
--   `SELECT set_config('app.academy_id', $1, true)` 를 호출.

BEGIN;

-- 현재 요청의 academy_id를 안전하게 추출하는 함수
CREATE OR REPLACE FUNCTION app_current_academy_id() RETURNS INTEGER
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v TEXT;
BEGIN
  v := current_setting('app.academy_id', true);
  IF v IS NULL OR v = '' THEN
    RETURN NULL;
  END IF;
  RETURN v::INTEGER;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- 10개 핵심 테이블에 RLS 활성화 + USING/ WITH CHECK 정책 생성
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'students',
    'parents',
    'tuition_records',
    'consultation_logs',
    'leads',
    'classes',
    'class_sessions',
    'attendance',
    'notices',
    'student_events'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- 테이블 존재할 때만 적용
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

      -- 기존 정책 제거 후 재생성 (재실행 안전)
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_modify ON %I', t);

      EXECUTE format($f$
        CREATE POLICY tenant_isolation_select ON %I
        FOR SELECT
        USING (academy_id = app_current_academy_id())
      $f$, t);

      EXECUTE format($f$
        CREATE POLICY tenant_isolation_modify ON %I
        FOR ALL
        USING (academy_id = app_current_academy_id())
        WITH CHECK (academy_id = app_current_academy_id())
      $f$, t);
    END IF;
  END LOOP;
END $$;

-- 감사 로그: RLS 적용 시각 기록
CREATE TABLE IF NOT EXISTS rls_policy_audit (
  id SERIAL PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  migration TEXT NOT NULL
);
INSERT INTO rls_policy_audit (migration) VALUES ('018_rls_policies');

COMMIT;

-- 롤백 참고:
--   ALTER TABLE students DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS tenant_isolation_select ON students;
--   ... (위 tables 배열의 각 테이블에 반복)
--   DROP FUNCTION IF EXISTS app_current_academy_id();
