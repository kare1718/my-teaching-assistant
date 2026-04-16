-- 026: 학원별 사용 현황 분석

-- 페이지 뷰 / 기능 사용 트래킹
CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  user_id INTEGER REFERENCES users(id),
  page_path VARCHAR(200) NOT NULL,
  feature_name VARCHAR(100),
  duration_seconds INTEGER DEFAULT 0,
  session_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_academy ON page_views(academy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_feature ON page_views(academy_id, feature_name);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);

-- 일별 학원 요약 (집계 테이블, 크론잡으로 갱신)
CREATE TABLE IF NOT EXISTS academy_daily_stats (
  id SERIAL PRIMARY KEY,
  academy_id INTEGER REFERENCES academies(id),
  stat_date DATE NOT NULL,
  total_logins INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  total_page_views INTEGER DEFAULT 0,
  avg_session_seconds INTEGER DEFAULT 0,
  top_features JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academy_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_academy_daily_academy ON academy_daily_stats(academy_id, stat_date DESC);
