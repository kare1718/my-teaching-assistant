const { runInsert } = require('../db/database');

async function logAction({ req, action, resourceType, resourceId, before = null, after = null }) {
  try {
    await runInsert(
      `INSERT INTO audit_logs (academy_id, user_id, user_name, user_role, action,
        resource_type, resource_id, before_data, after_data, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.academyId || null,
        req.user?.id || null,
        req.user?.name || null,
        req.user?.role || null,
        action,
        resourceType,
        resourceId || null,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        req.ip || req.headers['x-forwarded-for'] || null,
        req.headers['user-agent'] || null,
      ]
    );
  } catch (e) {
    // 감사 로그 실패가 메인 응답을 막지 않도록
    console.error('[audit] logAction 실패:', e.message);
  }
}

module.exports = { logAction };
