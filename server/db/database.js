const { Pool, types } = require('pg');
const dns = require('dns');

// ── IPv4 강제 (Supabase IPv6 문제 방지) ──
dns.setDefaultResultOrder('ipv4first');
const origLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (typeof options === 'number') options = { family: options };
  options = Object.assign({}, options, { family: 4 });
  return origLookup.call(this, hostname, options, callback);
};

// ── PostgreSQL 타입 파서 (BIGINT → Number) ──
types.setTypeParser(20, (val) => parseInt(val, 10));    // int8
types.setTypeParser(1700, (val) => parseFloat(val));     // numeric

// ── Connection Pool 설정 (Supabase Pooler 최적화) ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  min: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  allowExitOnIdle: true,
});

// ── 연속 연결 에러 추적 ──
let consecutiveConnectionErrors = 0;

pool.on('error', (err) => {
  console.error('[DB Pool] 예기치 않은 에러:', err.message);
});

// ── 헬스체크 (production: 3분, dev: 5분) ──
const healthCheckInterval = process.env.NODE_ENV === 'production' ? 3 * 60 * 1000 : 5 * 60 * 1000;
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`[DB Health] OK | total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`);
  } catch (err) {
    console.error('[DB Health] 연결 실패:', err.message);
  }
}, healthCheckInterval);

// ── 연결 에러 판별 ──
function isConnectionError(err) {
  if (!err) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return (
    code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' ||
    code === 'EPIPE' || code === 'ENOTFOUND' ||
    code === '57P01' || code === '57P03' || code === '08006' || code === '08003' ||
    msg.includes('connection terminated') ||
    msg.includes('connect timeout') ||
    msg.includes('the database system is') ||
    msg.includes('connection refused') ||
    msg.includes('network') ||
    msg.includes('ssl')
  );
}

// ── 재시도 로직이 포함된 쿼리 실행 ──
async function queryWithRetry(sql, params) {
  const start = Date.now();
  try {
    const result = await pool.query(sql, params);
    const elapsed = Date.now() - start;
    if (elapsed > 1000) {
      console.warn(`[DB Slow] ${elapsed}ms | ${sql.substring(0, 80)}`);
    }
    consecutiveConnectionErrors = 0;
    return result;
  } catch (err) {
    if (isConnectionError(err)) {
      consecutiveConnectionErrors++;
      if (consecutiveConnectionErrors >= 3) {
        console.error(`[DB CRITICAL] 연속 ${consecutiveConnectionErrors}회 연결 실패`);
      }
      // 500ms 후 1회 재시도
      await new Promise(r => setTimeout(r, 500));
      try {
        const result = await pool.query(sql, params);
        consecutiveConnectionErrors = 0;
        return result;
      } catch (retryErr) {
        consecutiveConnectionErrors++;
        throw retryErr;
      }
    }
    throw err;
  }
}

// ── ? → $N 자동 변환 헬퍼 ──
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// ── 쿼리 함수들 ──
async function runQuery(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  await queryWithRetry(pgSql, params);
}

async function runInsert(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const returningSQL = pgSql.includes('RETURNING') ? pgSql : pgSql.replace(/;?\s*$/, ' RETURNING id');
  try {
    const result = await queryWithRetry(returningSQL, params);
    return result.rows[0]?.id ?? null;
  } catch (err) {
    await queryWithRetry(pgSql, params);
    return null;
  }
}

async function getOne(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await queryWithRetry(pgSql, params);
  return result.rows[0] || null;
}

async function getAll(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await queryWithRetry(pgSql, params);
  return result.rows;
}

async function getDb() {
  await pool.query('SELECT 1');
  console.log('[DB] PostgreSQL 연결 성공');
  return pool;
}

async function runMigration(sql) {
  await pool.query(sql);
}

function getConsecutiveErrors() {
  return consecutiveConnectionErrors;
}

module.exports = { getDb, runQuery, runInsert, getOne, getAll, runMigration, pool, getConsecutiveErrors };
