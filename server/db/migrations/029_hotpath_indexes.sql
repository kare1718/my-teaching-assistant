-- 029: 런칭 전 핫패스 인덱스 보강
-- 감사 결과 누락된 인덱스들을 추가 (024 이후 실제 부하 패턴 분석 기반)
-- 모든 인덱스는 IF NOT EXISTS 로 멱등성 보장

-- ============================================================
-- students.user_id — JOIN 핵심 (매 로그인/학생페이지마다 호출)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_user_id
  ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_academy_user
  ON students(academy_id, user_id);
CREATE INDEX IF NOT EXISTS idx_students_academy_status
  ON students(academy_id, status);

-- ============================================================
-- users — 로그인/인증 핫패스
-- ============================================================
-- phone 조회 (로그인 시 username 못 찾으면 phone 시도)
CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone) WHERE phone IS NOT NULL AND phone <> '';
-- academy별 역할 조회 (admin 목록, 조교 목록 등)
CREATE INDEX IF NOT EXISTS idx_users_academy_role
  ON users(academy_id, role);
-- 승인 대기 사용자 조회
CREATE INDEX IF NOT EXISTS idx_users_academy_approved
  ON users(academy_id, approved);

-- ============================================================
-- scores — 학생 성적 조회 핫패스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_scores_student
  ON scores(student_id);
CREATE INDEX IF NOT EXISTS idx_scores_academy_student
  ON scores(academy_id, student_id);
CREATE INDEX IF NOT EXISTS idx_scores_academy_exam
  ON scores(academy_id, exam_id);

-- ============================================================
-- homework — 학원별 최신순 / 학교+학년 필터 (학생별 아닌 school+grade 구조)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_homework_academy_created
  ON homework(academy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_homework_academy_school_grade
  ON homework(academy_id, school, grade);

-- ============================================================
-- notices — 공지 목록 (학원별 최신순)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notices_academy_created
  ON notices(academy_id, created_at DESC);

-- ============================================================
-- notification_logs — 발송 내역 조회
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notification_logs_academy_created
  ON notification_logs(academy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_academy_status
  ON notification_logs(academy_id, status);

-- ============================================================
-- academies — slug 조회 (로그인/온보딩 핫패스)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_academies_slug_unique
  ON academies(slug);
CREATE INDEX IF NOT EXISTS idx_academies_active
  ON academies(is_active) WHERE is_active = 1;

-- ============================================================
-- class_students — 반 배정 조회
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_class_students_class
  ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student
  ON class_students(student_id);

-- ============================================================
-- tuition_records — 수납 상태 조회 (미납 리마인드 크론에서 사용)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tuition_academy_due_status
  ON tuition_records(academy_id, due_date, status);

-- ============================================================
-- subscriptions — 구독 상태 조회 (정기결제 크론, 티어 미들웨어)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_academy_status
  ON subscriptions(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires
  ON subscriptions(expires_at) WHERE status = 'active';

-- ============================================================
-- payments — 결제 내역 조회 + 실패 재시도 크론
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payments_academy_status
  ON payments(academy_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_status_created
  ON payments(status, created_at DESC);

-- ============================================================
-- vocab_game_logs — 퀴즈 기록 (학생 화면 XP 조회)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vocab_logs_academy_student
  ON vocab_game_logs(academy_id, student_id);
CREATE INDEX IF NOT EXISTS idx_vocab_logs_student_created
  ON vocab_game_logs(student_id, created_at DESC);

-- 통계용 — 인덱스 적용 후 ANALYZE 권장 (Postgres autovacuum이 처리하지만 배포 직후는 수동)
-- psql 에서: ANALYZE students; ANALYZE users; ANALYZE scores; ...
