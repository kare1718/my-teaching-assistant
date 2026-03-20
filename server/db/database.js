const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error', err);
});

// ? -> $N 자동 변환 헬퍼
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function runQuery(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  await pool.query(pgSql, params);
}

async function runInsert(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  // RETURNING id 추가
  const returningSQL = pgSql.includes('RETURNING') ? pgSql : pgSql.replace(/;?\s*$/, ' RETURNING id');
  try {
    const result = await pool.query(returningSQL, params);
    return result.rows[0]?.id ?? null;
  } catch (err) {
    // RETURNING 실패 시 원본 쿼리 실행
    await pool.query(pgSql, params);
    return null;
  }
}

async function getOne(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows[0] || null;
}

async function getAll(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows;
}

async function getDb() {
  return pool;
}

// 마이그레이션 실행
async function runMigration(sql) {
  await pool.query(sql);
}

module.exports = { getDb, runQuery, runInsert, getOne, getAll, runMigration, pool };
