/**
 * 이벤트 추적 서비스 (KPI 측정 인프라)
 *
 * 사용법:
 *   const { track } = require('../services/analytics');
 *   await track(req, 'first_student_added', { student_id: 123 });
 *
 * - 실패해도 요청을 막지 않음 (fire-and-forget)
 * - academy_id / user_id / session_id는 req에서 자동 추출
 */

const { runInsert } = require('../db/database');

const CATEGORY_MAP = {
  signup: 'acquisition',
  onboarding_completed: 'acquisition',
  demo_requested: 'acquisition',
  first_student_added: 'activation',
  first_attendance: 'activation',
  first_notice_sent: 'activation',
  first_tuition_billed: 'activation',
  sample_data_generated: 'activation',
  login: 'engagement',
  feature_used: 'engagement',
  trial_started: 'conversion',
  payment_success: 'conversion',
  plan_upgraded: 'conversion',
  plan_downgraded: 'conversion',
  subscription_canceled: 'conversion',
};

function getCategory(eventType) {
  return CATEGORY_MAP[eventType] || 'other';
}

/**
 * track(req, eventType, properties)
 * - req: Express req (academyId/user/sessionID 추출)
 * - eventType: string
 * - properties: 객체 (JSONB로 저장)
 */
async function track(req, eventType, properties = {}) {
  try {
    const academyId = req?.academyId ?? req?.user?.academy_id ?? null;
    const userId = req?.user?.id ?? null;
    const sessionId = req?.sessionID || req?.headers?.['x-session-id'] || null;

    await runInsert(
      `INSERT INTO analytics_events
         (academy_id, user_id, event_type, event_category, properties, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [academyId, userId, eventType, getCategory(eventType), JSON.stringify(properties || {}), sessionId]
    );
  } catch (e) {
    // KPI 이벤트 실패가 본 요청을 막지 않도록 로깅만 함
    console.error('[analytics]', eventType, e.message);
  }
}

/**
 * trackFirst(req, eventType, properties)
 * - 해당 academy에서 첫 발생일 때만 기록 (first_* 이벤트용)
 * - 중복 호출 안전: 이미 있으면 no-op
 */
async function trackFirst(req, eventType, properties = {}) {
  try {
    const academyId = req?.academyId ?? req?.user?.academy_id ?? null;
    if (!academyId) return;
    const { getOne } = require('../db/database');
    const existing = await getOne(
      `SELECT id FROM analytics_events WHERE academy_id = ? AND event_type = ? LIMIT 1`,
      [academyId, eventType]
    );
    if (existing) return;
    await track(req, eventType, properties);
  } catch (e) {
    console.error('[analytics.first]', eventType, e.message);
  }
}

module.exports = { track, trackFirst, getCategory };
