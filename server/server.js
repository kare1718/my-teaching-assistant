require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { pool, runMigration } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;

// === 보안 설정 ===
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// 로그인 속도 제한
const loginAttempts = new Map();
app.use('/api/auth/login', (req, res, next) => {
  if (req.method !== 'POST') return next();
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < 15 * 60 * 1000);
  if (recent.length >= 10) {
    return res.status(429).json({ error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' });
  }
  recent.push(now);
  loginAttempts.set(ip, recent);
  next();
});

// 정적 파일
app.use(express.static(path.join(__dirname, '../client/dist')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API 라우트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/students', require('./routes/students'));
app.use('/api/scores', require('./routes/scores'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/clinic', require('./routes/clinic'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/hall-of-fame', require('./routes/hallOfFame'));
app.use('/api/ta', require('./routes/taSchedule'));
app.use('/api/homework', require('./routes/homework'));
app.use('/api/ox-quiz', require('./routes/oxQuiz'));
app.use('/api/reports', require('./routes/reports'));

// SaaS 전용 라우트
app.use('/api/academies', require('./routes/academies'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/onboarding', require('./routes/onboarding'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// PostgreSQL 마이그레이션 러너
async function runMigrations() {
  // 마이그레이션 추적 테이블 생성
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, 'db', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT id FROM migrations WHERE name = $1', [file]);
    if (rows.length > 0) continue;

    console.log(`[마이그레이션] ${file} 적용 중...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await runMigration(sql);
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
    console.log(`[마이그레이션] ${file} 완료`);
  }
}

async function start() {
  try {
    // DB 연결 테스트
    await pool.query('SELECT NOW()');
    console.log('[DB] PostgreSQL 연결 성공');

    // 마이그레이션 실행
    await runMigrations();
    console.log('[DB] 마이그레이션 완료');

    app.listen(PORT, () => {
      console.log(`[나만의 조교] 서버 시작: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[서버 시작 실패]', err.message);
    process.exit(1);
  }
}

start();
