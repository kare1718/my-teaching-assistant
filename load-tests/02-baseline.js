// 02-baseline.js — 평상시 트래픽 (현실 1,000 사용자 중 ~5% 동시접속)
// 시나리오: 로그인 → 대시보드 → 학생목록 → 출결조회 → 성적조회 → 로그아웃
import http from 'k6/http';
import { sleep, group } from 'k6';
import { BASE_URL, pickAccount, login, authHeaders, checkOk } from './lib/helpers.js';

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // warm-up
    { duration: '3m', target: 20 },   // 평상시 유지
    { duration: '1m', target: 0 },    // cool-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.005'],       // 에러 0.5% 미만
    'http_req_duration{name:dashboard}': ['p(95)<400'],
    'http_req_duration{name:students_list}': ['p(95)<500'],
    'http_req_duration{name:attendance_list}': ['p(95)<500'],
    'http_req_duration{name:auth_login}': ['p(95)<600'],
    checks: ['rate>0.995'],
  },
};

export default function () {
  const account = pickAccount();
  let token;

  group('login', () => {
    const session = login(account);
    token = session.token;
  });
  if (!token) return;

  const headers = authHeaders(token);

  group('dashboard', () => {
    const r = http.get(`${BASE_URL}/api/dashboard`, { headers, tags: { name: 'dashboard' } });
    checkOk(r, 'dashboard');
    sleep(2);
  });

  group('students', () => {
    const r = http.get(`${BASE_URL}/api/students`, { headers, tags: { name: 'students_list' } });
    checkOk(r, 'students_list');
    sleep(3);
  });

  group('attendance', () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = http.get(`${BASE_URL}/api/attendance?date=${today}`, {
      headers,
      tags: { name: 'attendance_list' },
    });
    checkOk(r, 'attendance_list');
    sleep(2);
  });

  group('classes', () => {
    const r = http.get(`${BASE_URL}/api/classes`, { headers, tags: { name: 'classes_list' } });
    checkOk(r, 'classes_list');
    sleep(2);
  });

  group('scores', () => {
    const r = http.get(`${BASE_URL}/api/scores`, { headers, tags: { name: 'scores_list' } });
    checkOk(r, 'scores_list');
    sleep(3);
  });
}
