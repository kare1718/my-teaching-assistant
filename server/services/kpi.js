/**
 * KPI 계산 서비스 (SuperAdmin 전용)
 *
 * 마누스 "학원 운영 SaaS KPI 및 운영 지표 프레임워크" 기반
 * - 북극성 지표: 활성 운영 학원 수 / 첫 가치 도달 시간 / 학생 단위 운영 완결률
 * - 8단계 퍼널: visitors → signups → activated → first_value → trials → paid → retained_7d → retained_30d
 * - 기능 사용률 / 플랜 분포 / 경고 지표 / 코호트
 */

const { getAll, getOne } = require('../db/database');

function toRange(from, to) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ─────────────────────────────────────────────
// 1. 북극성 지표
// ─────────────────────────────────────────────
async function getNorthStarMetrics(from, to) {
  const { start, end } = toRange(from, to);

  // 활성 운영 학원: 최근 7일 내 코어 기능(attendance/tuition/sms/consultation) 이벤트가 2개 이상
  const activeAcademies = await getOne(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT academy_id
       FROM analytics_events
       WHERE created_at >= NOW() - INTERVAL '7 days'
         AND academy_id IS NOT NULL
         AND event_type IN ('first_attendance','first_notice_sent','first_tuition_billed','feature_used')
       GROUP BY academy_id
       HAVING COUNT(DISTINCT event_type) >= 2
     ) t`,
    []
  );

  // 첫 가치 도달 시간(시간): signup → first_student_added 평균 (최근 기간)
  const ttfv = await getOne(
    `SELECT AVG(EXTRACT(EPOCH FROM (fsa.created_at - su.created_at)) / 3600.0) AS hours
     FROM analytics_events su
     JOIN analytics_events fsa
       ON fsa.academy_id = su.academy_id
      AND fsa.event_type = 'first_student_added'
     WHERE su.event_type = 'signup'
       AND su.created_at >= ? AND su.created_at <= ?
       AND fsa.created_at >= su.created_at`,
    [start, end]
  );

  // 학생 단위 운영 완결률(%): 최근 30일 — 학생당 출결/수납/공지가 모두 찍힌 비율 (근사)
  const completion = await getOne(
    `WITH active_students AS (
       SELECT s.id, s.academy_id
       FROM students s
       WHERE (s.status IS NULL OR s.status = 'active')
     ),
     att AS (
       SELECT DISTINCT student_id FROM attendance
       WHERE date >= (CURRENT_DATE - INTERVAL '30 days')::date
     ),
     tu AS (
       SELECT DISTINCT student_id FROM tuition_records
       WHERE created_at >= NOW() - INTERVAL '30 days'
     )
     SELECT
       COALESCE(
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(100.0 * SUM(CASE WHEN a.student_id IS NOT NULL AND t.student_id IS NOT NULL THEN 1 ELSE 0 END)::numeric / COUNT(*), 1)
         END, 0) AS pct
     FROM active_students s
     LEFT JOIN att a ON a.student_id = s.id
     LEFT JOIN tu t ON t.student_id = s.id`,
    []
  );

  return {
    active_academies: activeAcademies?.n || 0,
    ttfv_hours: ttfv?.hours ? Number(Number(ttfv.hours).toFixed(1)) : null,
    completion_pct: completion?.pct ? Number(completion.pct) : 0,
    range: { start, end },
  };
}

// ─────────────────────────────────────────────
// 2. 퍼널
// ─────────────────────────────────────────────
async function getFunnel(from, to) {
  const { start, end } = toRange(from, to);

  const countEvent = async (type) => {
    const r = await getOne(
      `SELECT COUNT(DISTINCT academy_id)::int AS n
       FROM analytics_events
       WHERE event_type = ? AND created_at >= ? AND created_at <= ?`,
      [type, start, end]
    );
    return r?.n || 0;
  };

  const signups = await countEvent('signup');
  const activated = await countEvent('first_student_added');
  const firstAttendance = await countEvent('first_attendance');
  const firstNotice = await countEvent('first_notice_sent');
  const trials = await countEvent('trial_started');
  const paid = await countEvent('payment_success');

  // first_value = first_attendance OR first_notice_sent 을 경험한 학원 수
  const firstValue = await getOne(
    `SELECT COUNT(DISTINCT academy_id)::int AS n
     FROM analytics_events
     WHERE event_type IN ('first_attendance','first_notice_sent')
       AND created_at >= ? AND created_at <= ?`,
    [start, end]
  );

  // 잔존: 가입 후 7일/30일 시점에 이벤트가 있는 학원 비율
  const retained = async (days) => {
    const r = await getOne(
      `WITH signers AS (
         SELECT academy_id, MIN(created_at) AS signed_at
         FROM analytics_events
         WHERE event_type = 'signup' AND created_at >= ? AND created_at <= ?
         GROUP BY academy_id
       )
       SELECT COUNT(DISTINCT s.academy_id)::int AS n
       FROM signers s
       JOIN analytics_events e ON e.academy_id = s.academy_id
       WHERE e.created_at >= s.signed_at + (INTERVAL '1 day' * ?)
         AND e.created_at <  s.signed_at + (INTERVAL '1 day' * (? + 1))`,
      [start, end, days, days]
    );
    return r?.n || 0;
  };

  return {
    visitors: null, // 랜딩 방문(GA 연동 후 채움)
    signups,
    activated,
    first_value: firstValue?.n || 0,
    trials,
    paid,
    retained_7d: await retained(7),
    retained_30d: await retained(30),
    _debug: { firstAttendance, firstNotice },
    range: { start, end },
  };
}

// ─────────────────────────────────────────────
// 3. 기능 사용률 (최근 30일)
// ─────────────────────────────────────────────
async function getFeatureUsage() {
  const rows = await getAll(
    `SELECT
       COALESCE(properties->>'feature', event_type) AS feature,
       COUNT(DISTINCT academy_id)::int AS academies,
       COUNT(*)::int AS events
     FROM analytics_events
     WHERE created_at >= NOW() - INTERVAL '30 days'
       AND (event_type = 'feature_used' OR event_type LIKE 'first_%')
     GROUP BY feature
     ORDER BY academies DESC
     LIMIT 20`,
    []
  );
  return rows || [];
}

// ─────────────────────────────────────────────
// 4. 경고 지표
// ─────────────────────────────────────────────
async function getWarnings() {
  const warnings = [];

  // (1) 가입 많은데 첫 학생 등록 낮음
  const act = await getOne(
    `SELECT
       SUM(CASE WHEN event_type='signup' THEN 1 ELSE 0 END)::int AS signups,
       COUNT(DISTINCT CASE WHEN event_type='first_student_added' THEN academy_id END)::int AS activated
     FROM analytics_events
     WHERE created_at >= NOW() - INTERVAL '14 days'`,
    []
  );
  if (act?.signups >= 5 && act.signups > 0) {
    const rate = act.activated / act.signups;
    if (rate < 0.5) {
      warnings.push({
        severity: 'high',
        code: 'low_activation',
        title: '활성화율 저조',
        detail: `최근 14일 가입 ${act.signups}건 중 첫 학생 등록은 ${act.activated}건 (${Math.round(rate * 100)}%). 온보딩 개선 필요.`,
      });
    }
  }

  // (2) Trial 이탈률 높음
  const conv = await getOne(
    `SELECT
       SUM(CASE WHEN event_type='trial_started' THEN 1 ELSE 0 END)::int AS trials,
       SUM(CASE WHEN event_type='payment_success' THEN 1 ELSE 0 END)::int AS paid
     FROM analytics_events
     WHERE created_at >= NOW() - INTERVAL '30 days'`,
    []
  );
  if (conv?.trials >= 5) {
    const rate = (conv.paid || 0) / conv.trials;
    if (rate < 0.15) {
      warnings.push({
        severity: 'medium',
        code: 'low_trial_conversion',
        title: 'Trial→유료 전환 저조',
        detail: `최근 30일 Trial ${conv.trials}건 중 결제 ${conv.paid}건 (${Math.round(rate * 100)}%).`,
      });
    }
  }

  // (3) 최근 7일간 이벤트 0건인 학원(휴면)
  const dormant = await getOne(
    `SELECT COUNT(*)::int AS n FROM academies a
     WHERE NOT EXISTS (
       SELECT 1 FROM analytics_events e
       WHERE e.academy_id = a.id AND e.created_at >= NOW() - INTERVAL '7 days'
     )`,
    []
  );
  if (dormant?.n > 0) {
    warnings.push({
      severity: 'low',
      code: 'dormant_academies',
      title: '휴면 학원 감지',
      detail: `최근 7일간 활동 없는 학원 ${dormant.n}곳. 리텐션 캠페인 필요.`,
    });
  }

  return warnings;
}

// ─────────────────────────────────────────────
// 5. 플랜별 분포 / 전환
// ─────────────────────────────────────────────
async function getPlansDistribution() {
  const rows = await getAll(
    `SELECT COALESCE(subscription_tier, 'free') AS plan,
            COUNT(*)::int AS count
     FROM academies
     GROUP BY COALESCE(subscription_tier, 'free')
     ORDER BY count DESC`,
    []
  );
  return rows || [];
}

// ─────────────────────────────────────────────
// 6. 월별 코호트 (가입월 기준)
// ─────────────────────────────────────────────
async function getCohort(month) {
  const base = month ? new Date(month + '-01') : new Date();
  const y = base.getFullYear();
  const m = base.getMonth();
  const start = new Date(y, m, 1).toISOString();
  const end = new Date(y, m + 1, 1).toISOString();

  const rows = await getAll(
    `WITH signers AS (
       SELECT DISTINCT academy_id, MIN(created_at) AS signed_at
       FROM analytics_events
       WHERE event_type = 'signup' AND created_at >= ? AND created_at < ?
       GROUP BY academy_id
     )
     SELECT
       COUNT(*)::int AS cohort_size,
       COUNT(DISTINCT CASE WHEN EXISTS (
         SELECT 1 FROM analytics_events e
         WHERE e.academy_id = s.academy_id
           AND e.created_at BETWEEN s.signed_at AND s.signed_at + INTERVAL '7 days'
           AND e.event_type = 'first_student_added'
       ) THEN s.academy_id END)::int AS activated_w1,
       COUNT(DISTINCT CASE WHEN EXISTS (
         SELECT 1 FROM analytics_events e
         WHERE e.academy_id = s.academy_id
           AND e.created_at BETWEEN s.signed_at + INTERVAL '6 days' AND s.signed_at + INTERVAL '8 days'
       ) THEN s.academy_id END)::int AS retained_w1,
       COUNT(DISTINCT CASE WHEN EXISTS (
         SELECT 1 FROM analytics_events e
         WHERE e.academy_id = s.academy_id
           AND e.created_at BETWEEN s.signed_at + INTERVAL '29 days' AND s.signed_at + INTERVAL '31 days'
       ) THEN s.academy_id END)::int AS retained_m1
     FROM signers s`,
    [start, end]
  );
  return { month: `${y}-${String(m + 1).padStart(2, '0')}`, ...(rows?.[0] || {}) };
}

// ─────────────────────────────────────────────
// 7. 최근 이벤트 스트림
// ─────────────────────────────────────────────
async function getRecentEvents(limit = 10) {
  const rows = await getAll(
    `SELECT e.id, e.event_type, e.event_category, e.properties, e.created_at,
            a.name AS academy_name, u.name AS user_name
     FROM analytics_events e
     LEFT JOIN academies a ON a.id = e.academy_id
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows || [];
}

module.exports = {
  getNorthStarMetrics,
  getFunnel,
  getFeatureUsage,
  getWarnings,
  getPlansDistribution,
  getCohort,
  getRecentEvents,
};
