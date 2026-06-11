// Node.js 기반 smoke test (k6 대체)
// k6 설치 전이라도 기본 헬스체크 돌려볼 수 있음.
// 실제 부하 테스트는 k6 설치 후 01-smoke.js 이상을 사용하세요.
//
// 실행: node load-tests/node-smoke.mjs [BASE_URL]
// 예: node load-tests/node-smoke.mjs http://localhost:3002

const BASE = process.argv[2] || process.env.BASE_URL || 'http://localhost:3002';
const TEST_USER = { username: '1234', password: '1234' };

let passed = 0, failed = 0;
const results = [];

function ms(t) { return `${t}ms`; }
function log(ok, name, detail) {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`);
  results.push({ ok, name, detail });
  ok ? passed++ : failed++;
}

async function timed(fn) {
  const start = Date.now();
  try {
    const res = await fn();
    return { ok: true, elapsed: Date.now() - start, res };
  } catch (err) {
    return { ok: false, elapsed: Date.now() - start, err: err.message };
  }
}

async function run() {
  console.log(`\n🔎 Smoke Test → ${BASE}\n`);

  // 1. Health
  {
    const r = await timed(() => fetch(`${BASE}/api/health`).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));
    log(r.ok && r.res?.status === 'ok', 'GET /api/health',
      r.ok ? `db=${r.res.db} latency=${r.res.dbLatency} memory=${r.res.memory} ${ms(r.elapsed)}` : r.err);
  }

  // 2. Login
  let token;
  {
    const r = await timed(() =>
      fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_USER),
      }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error || 'HTTP ' + r.status))))
    );
    token = r.res?.token;
    log(r.ok && !!token, 'POST /api/auth/login',
      r.ok ? `role=${r.res.user?.role} name=${r.res.user?.name} ${ms(r.elapsed)}` : r.err);
  }

  if (!token) {
    console.log('\n⚠ 로그인 실패 — 이후 인증 필요 테스트 스킵');
    summary(); return;
  }

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 3. /auth/me
  {
    const r = await timed(() =>
      fetch(`${BASE}/api/auth/me`, { headers: authHeaders }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    );
    log(r.ok, 'GET /api/auth/me', r.ok ? ms(r.elapsed) : r.err);
  }

  // 4. Admin students list
  {
    const r = await timed(() =>
      fetch(`${BASE}/api/admin/students`, { headers: authHeaders }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    );
    log(r.ok, 'GET /api/admin/students',
      r.ok ? `count=${Array.isArray(r.res) ? r.res.length : (r.res.data?.length ?? '?')} ${ms(r.elapsed)}` : r.err);
  }

  // 5. Admin dashboard KPI
  {
    const r = await timed(() =>
      fetch(`${BASE}/api/kpi/dashboard`, { headers: authHeaders }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    );
    log(r.ok, 'GET /api/kpi/dashboard', r.ok ? ms(r.elapsed) : r.err);
  }

  // 6. Attendance API (optional route — may return 404)
  {
    const today = new Date().toISOString().slice(0, 10);
    const r = await timed(() =>
      fetch(`${BASE}/api/attendance?date=${today}`, { headers: authHeaders }).then(async r => {
        if (r.ok) return r.json();
        if (r.status === 404) return { optional: true };
        return Promise.reject(new Error('HTTP ' + r.status));
      })
    );
    log(r.ok, `GET /api/attendance?date=${today}`,
      r.ok ? (r.res?.optional ? 'optional route not mounted' : ms(r.elapsed)) : r.err);
  }

  // 7. Classes
  {
    const r = await timed(() =>
      fetch(`${BASE}/api/classes`, { headers: authHeaders }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    );
    log(r.ok, 'GET /api/classes', r.ok ? ms(r.elapsed) : r.err);
  }

  // 8. Subscription (학원별)
  {
    const r = await timed(() =>
      fetch(`${BASE}/api/subscription/status`, { headers: authHeaders }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    );
    log(r.ok, 'GET /api/subscription/status', r.ok ? ms(r.elapsed) : r.err);
  }

  // 9. Phone verify send-code (rate-limited, skip if prev still active)
  {
    const r = await timed(() =>
      fetch(`${BASE}/api/phone-verify/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '01099999999', purpose: 'signup' }),
      }).then(async r => {
        if (r.ok) return r.json();
        const j = await r.json();
        // 60초 쿨다운은 예상된 에러
        if (r.status === 429) return { rateLimited: true, msg: j.error };
        return Promise.reject(new Error(j.error || 'HTTP ' + r.status));
      })
    );
    log(r.ok, 'POST /api/phone-verify/send-code',
      r.ok ? (r.res.rateLimited ? `rate-limited (예상됨: ${r.res.msg})` : `발송 OK ${ms(r.elapsed)}`) : r.err);
  }

  summary();
}

function summary() {
  console.log('\n' + '='.repeat(60));
  console.log(`결과: ${passed} passed, ${failed} failed (총 ${passed + failed})`);
  if (failed > 0) {
    console.log('\n실패 상세:');
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.name}: ${r.detail}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
