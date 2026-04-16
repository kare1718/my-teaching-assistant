require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { pool, runMigration, getConsecutiveErrors } = require('./db/database');

// ── 프로세스 에러 핸들링 (서버 크래시 방지) ──
let server;
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  if (typeof gracefulShutdown === 'function') {
    gracefulShutdown('uncaughtException');
  } else {
    process.exit(1);
  }
});

const app = express();
const PORT = process.env.PORT || 3002;

// ── 보안 미들웨어 ──
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : process.env.NODE_ENV === 'production'
    ? true
    : ['http://localhost:5174', 'http://localhost:3002'];
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// ── Rate Limiting ──
// 로그인 속도 제한
const loginAttempts = new Map();
// 15분마다 만료된 기록 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts.entries()) {
    const filtered = val.filter(t => now - t < 15 * 60 * 1000);
    if (filtered.length === 0) loginAttempts.delete(key);
    else loginAttempts.set(key, filtered);
  }
}, 15 * 60 * 1000);

app.use('/api/auth/login', (req, res, next) => {
  if (req.method !== 'POST') return next();
  const ip = req.ip || req.connection.remoteAddress;
  const key = `${ip}_${(req.body?.username || '').toLowerCase()}`;
  const now = Date.now();
  const attempts = loginAttempts.get(key) || [];
  const recent = attempts.filter(t => now - t < 15 * 60 * 1000);
  if (recent.length >= 15) {
    return res.status(429).json({ error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' });
  }
  recent.push(now);
  loginAttempts.set(key, recent);
  next();
});

// ── 정적 파일 서빙 ──
// assets/는 해시 파일명이므로 장기 캐시, index.html은 캐시 금지
app.use('/assets', express.static(path.join(__dirname, '../client/dist/assets'), { maxAge: '7d', immutable: true }));
app.use(express.static(path.join(__dirname, '../client/dist'), { maxAge: 0, etag: false, setHeaders: (res, filePath) => {
  if (filePath.endsWith('.html')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
  }
}}));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── 헬스 체크 (라우트보다 먼저 등록) ──
app.get('/api/health', async (req, res) => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - start;
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      db: 'connected',
      dbLatency: `${dbLatency}ms`,
      pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
      consecutiveErrors: getConsecutiveErrors(),
      uptime: `${Math.floor(process.uptime())}s`,
      memory: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: err.message,
      consecutiveErrors: getConsecutiveErrors(),
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api/version', (req, res) => {
  res.json({ version: '2026-04-08-v1', service: '나만의 조교', timestamp: new Date().toISOString() });
});

// ── API 라우트 ──
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
app.use('/api/study-timer', require('./routes/studyTimer'));
app.use('/api/ai', require('./routes/aiAssistant'));
app.use('/api/parents', require('./routes/parents'));

// SaaS 전용 라우트
app.use('/api/academies', require('./routes/academies'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/legal-info', require('./routes/legalInfo'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/kpi', require('./routes/kpi'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// 웹훅 라우트 (인증 미들웨어 스킵 — 별도 시그니처 검증)
app.use('/api/webhook', require('./routes/webhook'));

// 신규 기능 라우트 (파일이 존재할 때만 로드)
const optionalRoutes = [
  { path: '/api/attendance', file: './routes/attendance' },
  { path: '/api/tuition', file: './routes/tuition' },
  { path: '/api/consultation', file: './routes/consultation' },
  { path: '/api/leads', file: './routes/leads' },
  { path: '/api/portfolio', file: './routes/portfolio' },
  { path: '/api/sms-credits', file: './routes/sms-credits' },
  { path: '/api/classes', file: './routes/classes' },
  { path: '/api/automation', file: './routes/automation' },
  { path: '/api/timeline', file: './routes/timeline' },
  { path: '/api/dashboard', file: './routes/dashboard' },
  { path: '/api/parent', file: './routes/parentApp' },
  { path: '/api/data-import', file: './routes/dataImport' },
  { path: '/api/sample-data', file: './routes/sampleData' },
];
for (const route of optionalRoutes) {
  try {
    app.use(route.path, require(route.file));
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') console.error(`[라우트 로드 실패] ${route.path}:`, e.message);
  }
}

// 공개 API (인증 불필요)
try {
  const { publicRouter } = require('./routes/tuition');
  if (publicRouter) app.use('/api/public', publicRouter);
} catch (e) { /* tuition.js 없으면 무시 */ }

// ── API 404 핸들러 ──
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ── 글로벌 에러 핸들러 (API 에러를 JSON으로 반환) ──
app.use((err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  if (res.headersSent) return next(err);

  const isDbError = err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' || (err.message || '').includes('Connection terminated') ||
    (err.message || '').includes('timeout');

  const status = isDbError ? 503 : (err.status || 500);
  const message = isDbError
    ? '서버가 일시적으로 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.'
    : '서버 오류가 발생했습니다.';

  res.status(status).json({ error: message });
});

// ── SPA fallback (에러 핸들러 뒤에 배치) ──
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// ── 마이그레이션 러너 ──
async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ta_migrations (
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
    const { rows } = await pool.query('SELECT id FROM ta_migrations WHERE name = $1', [file]);
    if (rows.length > 0) continue;

    console.log(`[마이그레이션] ${file} 적용 중...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await runMigration(sql);
    await pool.query('INSERT INTO ta_migrations (name) VALUES ($1)', [file]);
    console.log(`[마이그레이션] ${file} 완료`);
  }
}

// ── 초대 코드 보장 ──
async function ensureInviteCodes() {
  const { generateUniqueStudentCode, generateUniqueParentCode } = require('./utils/inviteCode');
  const { rows } = await pool.query(
    'SELECT id, student_invite_code, parent_invite_code FROM academies WHERE student_invite_code IS NULL OR parent_invite_code IS NULL'
  );
  for (const row of rows) {
    const sets = [];
    const values = [];
    if (!row.student_invite_code) {
      const code = await generateUniqueStudentCode();
      sets.push(`student_invite_code = $${values.length + 1}`);
      values.push(code);
    }
    if (!row.parent_invite_code) {
      const code = await generateUniqueParentCode();
      sets.push(`parent_invite_code = $${values.length + 1}`);
      values.push(code);
    }
    if (sets.length > 0) {
      values.push(row.id);
      await pool.query(
        `UPDATE academies SET ${sets.join(', ')} WHERE id = $${values.length}`,
        values
      );
    }
  }
  if (rows.length > 0) {
    console.log(`[초대 코드] ${rows.length}개 학원에 코드 발급 완료`);
  }
}

// ── 서버 시작 ──
async function start() {
  try {
    await pool.query('SELECT NOW()');
    console.log('[DB] PostgreSQL 연결 성공');

    await runMigrations();
    console.log('[DB] 마이그레이션 완료');

    // 학원별 초대 코드 보장 (누락된 학원 자동 발급)
    try {
      await ensureInviteCodes();
    } catch (e) {
      console.error('[초대 코드] 초기화 실패:', e.message);
    }

    try {
      const { runSeeds } = require('./db/seed');
      await runSeeds();
      console.log('[DB] 시드 데이터 확인 완료');
    } catch (e) { console.error('[DB] 시드 데이터 오류:', e.message); }

    // 크론잡 스케줄러 초기화
    try {
      const { initCronJobs } = require('./services/cronJobs');
      initCronJobs();
    } catch (e) {
      console.error('[크론] 스케줄러 초기화 실패:', e.message);
    }

    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[나만의 조교] 서버 시작: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[서버 시작 실패]', err.message);
    process.exit(1);
  }
}

// ── Graceful Shutdown ──
function gracefulShutdown(signal) {
  console.log(`\n[${signal}] 서버 종료 시작...`);
  if (server) {
    server.close(async () => {
      console.log('[서버] HTTP 연결 종료');
      try {
        await pool.end();
        console.log('[DB] 연결 풀 종료');
      } catch (err) {
        console.error('[DB] 종료 오류:', err.message);
      }
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[서버] 강제 종료 (5초 타임아웃)');
      process.exit(0);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
