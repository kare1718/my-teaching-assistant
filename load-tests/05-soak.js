// 05-soak.js — 장시간 지속 부하 (메모리 누수 / 커넥션 릭 탐지)
// 1시간 동안 일정 부하 유지 후 메모리/DB 커넥션이 꾸준히 상승하는지 확인
// 프로덕션 전 최소 1회 필수
import http from 'k6/http';
import { sleep } from 'k6';
import { BASE_URL, pickAccount, login, authHeaders, checkOk } from './lib/helpers.js';

export const options = {
  stages: [
    { duration: '5m', target: 30 },
    { duration: '50m', target: 30 },   // 50분 유지
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const account = pickAccount();
  const { token } = login(account);
  if (!token) return;
  const headers = authHeaders(token);

  const endpoints = [
    '/api/dashboard',
    '/api/students',
    '/api/classes',
    `/api/attendance?date=${new Date().toISOString().slice(0, 10)}`,
    '/api/scores',
    '/api/auth/me',
  ];

  for (const path of endpoints) {
    const r = http.get(`${BASE_URL}${path}`, { headers });
    checkOk(r, path);
    sleep(1 + Math.random() * 2);
  }
}
