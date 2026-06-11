// 01-smoke.js — 최소 기능 동작 확인 (빌드 직후 게이트)
// 통과 시: API가 살아있고 주요 플로우가 동작
import http from 'k6/http';
import { sleep, group } from 'k6';
import { BASE_URL, pickAccount, login, authHeaders, checkOk } from './lib/helpers.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],        // 에러율 1% 미만
    http_req_duration: ['p(95)<500'],      // p95 500ms 미만
    checks: ['rate>0.99'],                 // check 통과율 99%+
  },
};

export default function () {
  group('smoke', () => {
    // 1. Health check
    const health = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } });
    checkOk(health, 'health');

    // 2. 로그인
    const account = pickAccount();
    const { token } = login(account);

    // 3. 내 정보 조회
    const me = http.get(`${BASE_URL}/api/auth/me`, {
      headers: authHeaders(token),
      tags: { name: 'auth_me' },
    });
    checkOk(me, 'auth_me');

    // 4. 대시보드
    const dashboard = http.get(`${BASE_URL}/api/dashboard`, {
      headers: authHeaders(token),
      tags: { name: 'dashboard' },
    });
    checkOk(dashboard, 'dashboard');

    sleep(1);
  });
}
