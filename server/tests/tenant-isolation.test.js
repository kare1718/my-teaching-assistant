#!/usr/bin/env node
/**
 * 멀티테넌시 데이터 격리 통합 테스트
 *
 * 시나리오:
 *   1. 학원 A, B 생성 후 관리자 토큰 발급
 *   2. 학원 A에 15개 리소스별로 한 건씩 데이터 삽입
 *   3. 학원 B 토큰으로 각 리소스의 목록/상세 API 호출
 *      → 목록에 학원 A 데이터가 포함되면 FAIL
 *      → 상세 접근 시 200 응답이면 FAIL (404/403 기대)
 *
 * 실행:
 *   JWT_SECRET=... DATABASE_URL=... TEST_BASE_URL=http://localhost:3002 \
 *     node tests/tenant-isolation.test.js
 *
 * 주의:
 *   - 실제 DB에 테스트 데이터를 쓰고 마지막에 롤백한다.
 *   - 서버가 기동 중이어야 한다(TEST_BASE_URL).
 *   - CI에서는 별도 테스트 DB 사용을 권장.
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');
const { pool, runQuery, runInsert, getOne } = require('../db/database');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET 환경변수 필요');
  process.exit(1);
}

// Node 18+ fetch 사용
const fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

// ── 검증 대상 리소스 ────────────────────────────────────────────
// 각 항목:
//   key: 표시용 이름
//   list: GET 목록 엔드포인트 (학원 스코프여야 함)
//   detail: (id) => GET 단건 엔드포인트
//   seed: async (academyId) => 테이블에 한 건 INSERT 후 id 반환
//   idField: 응답 JSON의 PK 필드명(기본 id)
const RESOURCES = [
  {
    key: 'students',
    list: '/api/students',
    detail: (id) => `/api/students/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO students (academy_id, name, grade) VALUES (?, ?, ?) RETURNING id`,
        [aid, `격리테스트_${aid}`, '중1']
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'parents',
    list: '/api/parents',
    detail: (id) => `/api/parents/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO parents (academy_id, name, phone) VALUES (?, ?, ?) RETURNING id`,
        [aid, `부모_${aid}`, '01000000000']
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'classes',
    list: '/api/classes',
    detail: (id) => `/api/classes/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO classes (academy_id, name) VALUES (?, ?) RETURNING id`,
        [aid, `반_${aid}`]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'tuition_records',
    list: '/api/tuition/records',
    detail: (id) => `/api/tuition/records/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO tuition_records (academy_id, student_id, amount, status)
         VALUES (?, NULL, ?, 'pending') RETURNING id`,
        [aid, 100000]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'consultation_logs',
    list: '/api/consultation/logs',
    detail: (id) => `/api/consultation/logs/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO consultation_logs (academy_id, student_id, content)
         VALUES (?, NULL, ?) RETURNING id`,
        [aid, '격리테스트 상담']
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'leads',
    list: '/api/leads',
    detail: (id) => `/api/leads/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO leads (academy_id, name, phone, status)
         VALUES (?, ?, ?, 'new') RETURNING id`,
        [aid, `리드_${aid}`, '01011112222']
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'attendance',
    list: '/api/attendance',
    detail: (id) => `/api/attendance/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO attendance (academy_id, student_id, status, date)
         VALUES (?, NULL, 'present', CURRENT_DATE) RETURNING id`,
        [aid]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'class_sessions',
    list: '/api/classes/sessions',
    detail: (id) => `/api/classes/sessions/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO class_sessions (academy_id, class_id, starts_at)
         VALUES (?, NULL, NOW()) RETURNING id`,
        [aid]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'notices',
    list: '/api/admin/notices',
    detail: (id) => `/api/admin/notices/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO notices (academy_id, title, content)
         VALUES (?, ?, ?) RETURNING id`,
        [aid, `공지_${aid}`, '격리테스트']
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'exams',
    list: '/api/admin/exams',
    detail: (id) => `/api/admin/exams/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO exams (academy_id, title) VALUES (?, ?) RETURNING id`,
        [aid, `시험_${aid}`]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'scores',
    list: '/api/scores',
    detail: (id) => `/api/scores/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO scores (academy_id, student_id, score)
         VALUES (?, NULL, 90) RETURNING id`,
        [aid]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'automation_rules',
    list: '/api/automation/rules',
    detail: (id) => `/api/automation/rules/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO automation_rules (academy_id, name, trigger_type, is_active)
         VALUES (?, ?, 'attendance_absent', true) RETURNING id`,
        [aid, `규칙_${aid}`]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'task_queue',
    list: '/api/automation/tasks',
    detail: (id) => `/api/automation/tasks/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO task_queue (academy_id, task_type, payload, status)
         VALUES (?, 'sms', '{}', 'pending') RETURNING id`,
        [aid]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'portfolios',
    list: '/api/portfolio',
    detail: (id) => `/api/portfolio/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO portfolios (academy_id, student_id, title)
         VALUES (?, NULL, ?) RETURNING id`,
        [aid, `포트폴리오_${aid}`]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
  {
    key: 'student_events',
    list: '/api/timeline/events',
    detail: (id) => `/api/timeline/events/${id}`,
    seed: async (aid) => {
      const r = await runInsert(
        `INSERT INTO student_events (academy_id, student_id, event_type, payload)
         VALUES (?, NULL, 'note', '{}') RETURNING id`,
        [aid]
      );
      return r.rows?.[0]?.id || r.lastID;
    },
  },
];

// ── 유틸 ───────────────────────────────────────────────────────
function makeToken(academyId, role = 'admin') {
  return jwt.sign(
    { id: 99990 + academyId, username: `tester_${academyId}`, role, academy_id: academyId },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function apiGet(pathname, token) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function seedAcademy(name) {
  const r = await runInsert(
    `INSERT INTO academies (name, plan, is_active)
     VALUES (?, 'pro', true) RETURNING id`,
    [name]
  );
  return r.rows?.[0]?.id || r.lastID;
}

async function cleanupAcademy(aid) {
  // FK cascade가 없을 수 있으므로 주요 테이블 개별 DELETE
  const tables = RESOURCES.map(r => r.key);
  for (const t of tables) {
    try { await runQuery(`DELETE FROM ${t} WHERE academy_id = ?`, [aid]); } catch {}
  }
  try { await runQuery(`DELETE FROM academies WHERE id = ?`, [aid]); } catch {}
}

// ── 메인 ───────────────────────────────────────────────────────
(async function main() {
  const results = [];
  let aidA, aidB;

  try {
    aidA = await seedAcademy('격리테스트_A');
    aidB = await seedAcademy('격리테스트_B');
    const tokenA = makeToken(aidA);
    const tokenB = makeToken(aidB);

    console.log(`\n[tenant-isolation] 학원 A=${aidA}, 학원 B=${aidB}`);

    for (const res of RESOURCES) {
      const label = res.key.padEnd(20);
      let seededId = null;
      try {
        seededId = await res.seed(aidA);
      } catch (e) {
        results.push({ key: res.key, phase: 'seed', pass: false, msg: e.message });
        console.log(`  SKIP ${label} (seed 실패: ${e.message})`);
        continue;
      }

      // 1) 학원 B 토큰으로 목록 조회 — A 데이터가 포함되면 FAIL
      const listRes = await apiGet(res.list, tokenB);
      const items = Array.isArray(listRes.body)
        ? listRes.body
        : (listRes.body && Array.isArray(listRes.body.items) ? listRes.body.items : []);
      const leaked = items.some(row => Number(row?.id) === Number(seededId));
      const listOk = listRes.status === 200 && !leaked;

      // 2) 학원 B 토큰으로 상세 조회 — 200이면 FAIL (404/403 기대)
      const detRes = await apiGet(res.detail(seededId), tokenB);
      const detailOk = detRes.status === 404 || detRes.status === 403;

      const pass = listOk && detailOk;
      results.push({
        key: res.key,
        pass,
        listStatus: listRes.status,
        leaked,
        detailStatus: detRes.status,
      });
      console.log(
        `  ${pass ? 'PASS' : 'FAIL'} ${label} list=${listRes.status}${leaked ? '(leak!)' : ''} detail=${detRes.status}`
      );
    }
  } finally {
    if (aidA) await cleanupAcademy(aidA);
    if (aidB) await cleanupAcademy(aidB);
    await pool.end().catch(() => {});
  }

  const failed = results.filter(r => !r.pass);
  console.log(`\n[tenant-isolation] 총 ${results.length}개 중 통과 ${results.length - failed.length}, 실패 ${failed.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch(err => {
  console.error('[tenant-isolation] 치명적 오류:', err);
  process.exit(2);
});
