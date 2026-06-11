// 03-peak-checkin.js — 등하원 피크 시뮬레이션 (가장 중요한 테스트)
// 오후 4~5시 한 시간에 학원 수십~수백 곳에서 체크인이 동시 폭발
// → 단일 트랜잭션 쓰기 + SMS 발송 큐 적재 + 학부모 알림
import http from 'k6/http';
import { sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, pickAccount, login, authHeaders, checkOk } from './lib/helpers.js';

const checkinLatency = new Trend('checkin_latency_ms');

export const options = {
  stages: [
    { duration: '2m', target: 50 },    // 등원 시작
    { duration: '3m', target: 150 },   // 피크 진입
    { duration: '3m', target: 200 },   // 최고점
    { duration: '2m', target: 0 },     // 하원 후
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],                       // 2% 미만
    'http_req_duration{name:checkin}': ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{name:dashboard}': ['p(95)<1000'],
    checks: ['rate>0.98'],
  },
};

// 시드 데이터에서 학생 ID 풀 (academy별로 30명씩 존재 가정)
// 실제 환경에서는 setup 훅에서 조회해야 함
export function setup() {
  const account = pickAccount();
  const { token, user } = login(account);
  const headers = authHeaders(token);

  // 소속 학원 학생 ID 미리 로드
  const r = http.get(`${BASE_URL}/api/students?limit=50`, { headers });
  const students = r.status === 200 ? r.json() : [];
  const studentIds = (Array.isArray(students) ? students : students?.data || [])
    .map((s) => s.id)
    .filter(Boolean);

  return { studentIds };
}

export default function (data) {
  const account = pickAccount();
  const { token } = login(account);
  if (!token) return;
  const headers = authHeaders(token);

  // 피크시 학원 admin이 대시보드를 보고 있음 (페이지 오픈 유지)
  group('dashboard_open', () => {
    const r = http.get(`${BASE_URL}/api/dashboard`, { headers, tags: { name: 'dashboard' } });
    checkOk(r, 'dashboard');
    sleep(1);
  });

  // 체크인 폭발 (한 학생당 한 번)
  const studentIds = data?.studentIds || [];
  if (studentIds.length === 0) {
    sleep(2);
    return;
  }

  for (let i = 0; i < 5; i++) {
    const studentId = studentIds[Math.floor(Math.random() * studentIds.length)];
    const start = Date.now();
    const r = http.post(
      `${BASE_URL}/api/attendance`,
      JSON.stringify({
        student_id: studentId,
        date: new Date().toISOString().slice(0, 10),
        status: 'present',
        checked_in_at: new Date().toISOString(),
      }),
      { headers, tags: { name: 'checkin' } }
    );
    checkinLatency.add(Date.now() - start);
    checkOk(r, 'checkin');

    // 체크인 간격 (실제로는 2~10초)
    sleep(0.3 + Math.random() * 0.7);
  }

  // 확인용 출결 조회
  group('attendance_verify', () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = http.get(`${BASE_URL}/api/attendance?date=${today}`, {
      headers,
      tags: { name: 'attendance_list' },
    });
    checkOk(r, 'attendance_list');
  });

  sleep(2);
}
