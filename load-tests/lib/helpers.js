// 공용 헬퍼 — 인증, 토큰 캐시, 공통 체크
import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';

// 테스트 계정 풀 (setup-test-data.sql로 시드된 계정)
// 학원별로 admin / student 계정을 여러 개 두고 VU마다 분산 사용
export const TEST_ACCOUNTS = [
  { username: 'loadtest_admin_1', password: 'loadtest1234', role: 'admin' },
  { username: 'loadtest_admin_2', password: 'loadtest1234', role: 'admin' },
  { username: 'loadtest_admin_3', password: 'loadtest1234', role: 'admin' },
  { username: 'loadtest_admin_4', password: 'loadtest1234', role: 'admin' },
  { username: 'loadtest_admin_5', password: 'loadtest1234', role: 'admin' },
];

export function pickAccount() {
  // VU 인덱스 기준 순환 — 동일 VU는 동일 계정 사용 (캐시 효과 확인용)
  const idx = (__VU - 1) % TEST_ACCOUNTS.length;
  return TEST_ACCOUNTS[idx];
}

export function login(account) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: account.username, password: account.password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } }
  );
  const ok = check(res, {
    'login 200': (r) => r.status === 200,
    'token exists': (r) => r.json('token') !== undefined,
  });
  if (!ok) {
    fail(`로그인 실패 (${account.username}): ${res.status} ${res.body?.slice(0, 200)}`);
  }
  return {
    token: res.json('token'),
    user: res.json('user'),
  };
}

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function checkOk(res, name) {
  return check(res, {
    [`${name} status < 400`]: (r) => r.status >= 200 && r.status < 400,
    [`${name} has body`]: (r) => r.body && r.body.length > 0,
  });
}
