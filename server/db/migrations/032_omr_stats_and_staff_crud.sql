-- 032_omr_stats_and_staff_crud.sql
-- OMR 문항별 정답률·선지 분포 공개 정책 + 학생/조교/관리자 CRUD 감사 추적 컬럼 및 인덱스

-- 1. exam_answer_keys: 학생 정답률·선지 분포 공개 정책 컬럼 추가
ALTER TABLE exam_answer_keys
  ADD COLUMN IF NOT EXISTS stats_reveal_policy VARCHAR(20) NOT NULL DEFAULT 'after_final',
  ADD COLUMN IF NOT EXISTS stats_basis         VARCHAR(20) NOT NULL DEFAULT 'first',
  ADD COLUMN IF NOT EXISTS min_stats_sample    INTEGER NOT NULL DEFAULT 5;

-- 2. student_answers / student_answer_attempts: 학생·조교·관리자 입력자 감사 추적 컬럼
ALTER TABLE student_answers
  ADD COLUMN IF NOT EXISTS last_updated_by_role    VARCHAR(20) DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS last_updated_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE student_answer_attempts
  ADD COLUMN IF NOT EXISTS submitted_by_user_id    INTEGER;

-- 3. 문항별 정답률 집계를 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_student_answers_exam_academy_submitted
  ON student_answers (academy_id, exam_id)
  WHERE answers IS NOT NULL;
