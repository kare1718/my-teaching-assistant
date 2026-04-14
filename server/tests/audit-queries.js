#!/usr/bin/env node
/**
 * SQL 쿼리 감사 — routes/*.js 에서 academy_id 필터가 누락된 쿼리 탐지
 *
 * 탐지 규칙:
 *   - getOne / getAll / runQuery / runInsert 호출의 첫 인자 템플릿 문자열을 추출
 *   - SELECT 또는 UPDATE/DELETE/INSERT 중 다음이 동시에 성립하면 경고:
 *       1) FROM 또는 UPDATE/INTO 대상 테이블이 테넌트 스코프 테이블일 것
 *       2) 쿼리 본문에 'academy_id' 토큰이 없을 것
 *
 * 화이트리스트(글로벌 리소스 또는 테넌트 스코프 아님):
 *   users(일부), sms_pricing, characters, titles, vocab_words, reading_passages,
 *   knowledge_quiz_*, plans, academies, subscription_plans, audit_logs,
 *   information_schema.*, pg_catalog.*
 *
 * 실행: node tests/audit-queries.js
 * 종료 코드: 경고 0건=0, 1건 이상=1
 */

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

const GLOBAL_TABLES = new Set([
  'sms_pricing',
  'characters',
  'titles',
  'vocab_words',
  'reading_passages',
  'knowledge_quiz_questions',
  'knowledge_quiz_categories',
  'plans',
  'academies',
  'subscription_plans',
  'audit_logs',
  'platform_notices',
  'migrations',
  'pg_stat_activity',
  // 플랫폼/슈퍼관리자 전용 테이블 (academy_id 컬럼 없음)
  'legal_info',
  'promotions',
  'platform_activity_logs',
  'webhook_events',
  // 개발 초기에 academy_id 도입 전 생성된 레거시 테이블 (게이미피케이션 - 학원 단일)
  'xp_logs',
  'homework_records',
  'notifications',
  'notice_reads',
]);

// users 테이블은 academy_id 스코프지만 auth 플로우에서 academy_id 없이 조회가 많아
// 경고를 '의심' 레벨로 분리한다.
// SOFT: 부모 테이블이 academy_id를 가지고 있고, 라우트에서 부모를 먼저 lookup하여
// 테넌시를 검증하는 패턴이 관용적으로 쓰이는 child 테이블들.
// 감사 스크립트는 부모 lookup을 정적으로 판별할 수 없으므로 soft로 분리하여
// 수동 리뷰 대상임을 표시한다.
const SOFT_TABLES = new Set([
  'users',
  // class_* — 부모는 classes(academy_id 있음)
  'class_students',
  'class_schedules_recurring',
  'class_waitlist',
  'teacher_assignments',
  // attendance_logs — 부모는 attendance(academy_id 있음)
  'attendance_logs',
  // lead_activities — 부모는 leads(academy_id 있음)
  'lead_activities',
  // student_parents — 부모는 students(academy_id 있음)
  'student_parents',
]);

// 정규식 — SQL 문자열 리터럴을 가장한 것까지 잡기 위해 백틱/싱글쿼트 모두 허용
const CALL_RE = /\b(getOne|getAll|runQuery|runInsert)\s*\(\s*([`'"])([\s\S]*?)\2/g;

function extractTable(sql) {
  const s = sql.replace(/\s+/g, ' ').trim();
  let m;
  m = /FROM\s+([a-zA-Z_][a-zA-Z0-9_.]*)/i.exec(s);
  if (m) return m[1].toLowerCase();
  m = /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_.]*)/i.exec(s);
  if (m) return m[1].toLowerCase();
  m = /INTO\s+([a-zA-Z_][a-zA-Z0-9_.]*)/i.exec(s);
  if (m) return m[1].toLowerCase();
  m = /DELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_.]*)/i.exec(s);
  if (m) return m[1].toLowerCase();
  return null;
}

function isTenantScoped(table) {
  if (!table) return false;
  if (GLOBAL_TABLES.has(table)) return false;
  if (table.startsWith('pg_') || table.startsWith('information_schema')) return false;
  return true;
}

function lineNumberOf(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

// superadmin.js는 플랫폼 최고관리자 전용 (requireSuperAdmin) — 의도적으로 크로스테넌트
// webhook.js는 결제 webhook 엔드포인트 (인증 없음) — portone_payment_id로 lookup되며 PortOne가 발급하는 글로벌 유니크 ID
const IGNORE_FILES = new Set([
  'superadmin.js',
  'webhook.js',
]);

function auditFile(file) {
  const base = path.basename(file);
  if (IGNORE_FILES.has(base)) return [];
  const src = fs.readFileSync(file, 'utf8');
  const warnings = [];
  let m;
  CALL_RE.lastIndex = 0;
  while ((m = CALL_RE.exec(src)) !== null) {
    const fnName = m[1];
    const sql = m[3];
    const table = extractTable(sql);
    if (!isTenantScoped(table)) continue;
    const hasAcademy = /academy_id/i.test(sql);
    if (hasAcademy) continue;

    const soft = SOFT_TABLES.has(table);
    const line = lineNumberOf(src, m.index);
    warnings.push({
      file: path.relative(path.join(__dirname, '..'), file),
      line,
      fn: fnName,
      table,
      soft,
      snippet: sql.replace(/\s+/g, ' ').slice(0, 120),
    });
  }
  return warnings;
}

function main() {
  if (!fs.existsSync(ROUTES_DIR)) {
    console.error(`routes 디렉토리 없음: ${ROUTES_DIR}`);
    process.exit(2);
  }
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && p.endsWith('.js')) files.push(p);
    }
  })(ROUTES_DIR);

  const all = [];
  for (const f of files) {
    all.push(...auditFile(f));
  }

  const hard = all.filter(w => !w.soft);
  const soft = all.filter(w => w.soft);

  if (hard.length === 0 && soft.length === 0) {
    console.log('[audit-queries] OK — academy_id 누락 쿼리 없음');
    process.exit(0);
  }

  if (hard.length > 0) {
    console.log(`\n[audit-queries] ⚠ academy_id 누락 (hard) ${hard.length}건\n`);
    for (const w of hard) {
      console.log(`  ${w.file}:${w.line}  ${w.fn}  table=${w.table}`);
      console.log(`    ${w.snippet}`);
    }
  }
  if (soft.length > 0) {
    console.log(`\n[audit-queries] ℹ users 등 soft 테이블 ${soft.length}건 (검토 권장)\n`);
    for (const w of soft) {
      console.log(`  ${w.file}:${w.line}  ${w.fn}  table=${w.table}`);
    }
  }
  console.log('');
  process.exit(hard.length > 0 ? 1 : 0);
}

main();
