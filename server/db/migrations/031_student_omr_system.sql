-- 031: 학생 직접 OMR 카드 입력 & 타이머·재제출 시스템

-- 1. exams 테이블 누락 컬럼 보완 (기존 환경 호환)
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 100,
  ADD COLUMN IF NOT EXISTS exam_date DATE,
  ADD COLUMN IF NOT EXISTS exam_end_date DATE,
  ADD COLUMN IF NOT EXISTS grade_cuts TEXT,
  ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;

-- 2. exam_answer_keys 테이블 생성 및 OMR 세팅 컬럼 추가
CREATE TABLE IF NOT EXISTS exam_answer_keys (
  id                          SERIAL PRIMARY KEY,
  exam_id                     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  academy_id                  INTEGER NOT NULL DEFAULT 1,
  question_count              INTEGER NOT NULL DEFAULT 20,
  choice_count                INTEGER NOT NULL DEFAULT 5,
  answer_key                  TEXT NOT NULL,
  point_config                TEXT DEFAULT 'equal',
  student_omr_enabled         BOOLEAN NOT NULL DEFAULT false,
  time_limit_minutes          INTEGER DEFAULT NULL,
  allow_resubmit              BOOLEAN NOT NULL DEFAULT true,
  resubmit_cooldown_minutes   INTEGER NOT NULL DEFAULT 30,
  max_attempts                INTEGER NOT NULL DEFAULT 2,
  resubmit_mode               VARCHAR(20) NOT NULL DEFAULT 'wrong_only',
  reveal_answers_policy       VARCHAR(20) NOT NULL DEFAULT 'after_final',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, academy_id)
);

ALTER TABLE exam_answer_keys
  ADD COLUMN IF NOT EXISTS academy_id                INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS choice_count              INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS point_config              TEXT DEFAULT 'equal',
  ADD COLUMN IF NOT EXISTS student_omr_enabled       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_limit_minutes        INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allow_resubmit            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS resubmit_cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_attempts              INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS resubmit_mode             VARCHAR(20) NOT NULL DEFAULT 'wrong_only',
  ADD COLUMN IF NOT EXISTS reveal_answers_policy     VARCHAR(20) NOT NULL DEFAULT 'after_final',
  ADD COLUMN IF NOT EXISTS updated_at                TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_exam_answer_keys_academy_exam
  ON exam_answer_keys (academy_id, exam_id);

-- 3. student_answers 테이블 생성 및 1차/재제출·타이머 컬럼 추가
CREATE TABLE IF NOT EXISTS student_answers (
  id                  SERIAL PRIMARY KEY,
  exam_id             INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id          INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academy_id          INTEGER NOT NULL DEFAULT 1,
  answers             TEXT,
  score               NUMERIC,
  correct_count       INTEGER,
  submitted_at        TIMESTAMPTZ,
  first_answers       TEXT,
  first_score         NUMERIC,
  first_correct_count INTEGER,
  first_submitted_at  TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  draft_answers       TEXT,
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  is_finalized        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(exam_id, student_id, academy_id)
);

ALTER TABLE student_answers
  ADD COLUMN IF NOT EXISTS academy_id          INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_answers       TEXT,
  ADD COLUMN IF NOT EXISTS first_score         NUMERIC,
  ADD COLUMN IF NOT EXISTS first_correct_count INTEGER,
  ADD COLUMN IF NOT EXISTS first_submitted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS draft_answers       TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_finalized        BOOLEAN NOT NULL DEFAULT false;

-- 기존에 answers IS NOT NULL 제약이 있었을 경우 응시 시작(in_progress) 상태를 위해 NULL 허용
ALTER TABLE student_answers
  ALTER COLUMN answers DROP NOT NULL;

-- 기존 데이터 백필 (이미 제출된 1차 데이터를 first_* 에 복사)
UPDATE student_answers
SET first_answers = answers,
    first_score = score,
    first_correct_count = correct_count,
    first_submitted_at = submitted_at,
    attempt_count = CASE WHEN answers IS NOT NULL THEN 1 ELSE 0 END
WHERE first_score IS NULL AND answers IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_answers_academy_exam
  ON student_answers (academy_id, exam_id, student_id);

-- 4. 회차별 상세 제출 이력 테이블 (1차, 2차, N차 로그 보존)
CREATE TABLE IF NOT EXISTS student_answer_attempts (
  id               SERIAL PRIMARY KEY,
  exam_id          INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academy_id       INTEGER NOT NULL DEFAULT 1,
  attempt_num      INTEGER NOT NULL,
  answers          TEXT NOT NULL,
  score            NUMERIC NOT NULL,
  correct_count    INTEGER NOT NULL,
  duration_seconds INTEGER,
  submitted_by     VARCHAR(20) NOT NULL DEFAULT 'student',
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answer_attempts_exam_student
  ON student_answer_attempts (academy_id, exam_id, student_id, attempt_num);

-- 5. scores 테이블에 1차 점수 / 재제출 점수 컬럼 보완
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS rank_num     INTEGER,
  ADD COLUMN IF NOT EXISTS note         TEXT,
  ADD COLUMN IF NOT EXISTS status       VARCHAR(30) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS first_score  NUMERIC,
  ADD COLUMN IF NOT EXISTS retest_score NUMERIC;
