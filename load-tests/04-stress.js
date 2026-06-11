// 04-stress.js — 한계점 탐색 (서버가 몇 명까지 버티나)
// 500 VU까지 끌어올려서 어디서 무너지는지 확인
// 크래시가 아니라 "graceful degradation" 만 보장되면 통과
import http from 'k6/http';
import { sleep } from 'k6';
import { BASE_URL, pickAccount, login, authHeaders, checkOk } from './lib/helpers.js';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '3m', target: 200 },
    { duration: '3m', target: 300 },
    { duration: '3m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    // 스트레스 테스트: 에러율 10%까지 허용 (대신 5xx는 금지)
    http_req_failed: ['rate<0.1'],
    'http_reqs{status:500}': ['count<100'],   // 5xx 100건 미만
    'http_reqs{status:502}': ['count<10'],    // bad gateway 10건 미만
  },
};

export default function () {
  const account = pickAccount();
  const { token } = login(account);
  if (!token) { sleep(1); return; }
  const headers = authHeaders(token);

  // 가장 자주 불리는 엔드포인트 3개 난사
  const endpoints = [
    { path: '/api/dashboard', name: 'dashboard' },
    { path: '/api/students', name: 'students' },
    { path: `/api/attendance?date=${new Date().toISOString().slice(0, 10)}`, name: 'attendance' },
  ];

  const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
  const r = http.get(`${BASE_URL}${ep.path}`, { headers, tags: { name: ep.name } });
  checkOk(r, ep.name);

  sleep(0.5 + Math.random() * 1.5);
}
