// server/routes/permissions.js
// RBAC 권한 매트릭스 조회/갱신 API

const express = require('express');
const { runQuery, getOne, getAll } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAction } = require('../services/audit');
const {
  RESOURCES,
  ACTIONS,
  ROLES,
  seedPermissionsForAcademy,
} = require('../db/seedPermissions');

const router = express.Router();
router.use(authenticateToken);

// ─────────────────────────────────────────────
// GET /check?resource=X&action=Y
//   현재 로그인한 사용자가 해당 권한을 가졌는지 확인
// ─────────────────────────────────────────────
router.get('/check', async (req, res) => {
  try {
    const { resource, action } = req.query;
    if (!resource || !action) {
      return res.status(400).json({ error: 'resource와 action은 필수입니다.' });
    }

    const role = req.user.role;
    if (role === 'admin' || role === 'superadmin') {
      return res.json({ allowed: true });
    }

    if (!req.academyId) {
      return res.json({ allowed: false });
    }

    const perm = await getOne(
      `SELECT allowed FROM permissions
       WHERE academy_id = ? AND role = ? AND resource = ? AND action = ?`,
      [req.academyId, role, resource, action]
    );

    res.json({ allowed: !!perm?.allowed });
  } catch (err) {
    console.error('[GET /permissions/check]', err.message);
    res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// GET /
//   현재 학원의 전체 권한 매트릭스 반환 (admin 전용)
// ─────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  try {
    if (!req.academyId) {
      return res.status(403).json({ error: '학원 정보가 없습니다.' });
    }

    // 행이 하나도 없으면 시드
    const count = await getOne(
      'SELECT COUNT(*)::int AS n FROM permissions WHERE academy_id = ?',
      [req.academyId]
    );
    if (!count || count.n === 0) {
      await seedPermissionsForAcademy(req.academyId);
    }

    const rows = await getAll(
      `SELECT role, resource, action, allowed
         FROM permissions
        WHERE academy_id = ?
        ORDER BY role, resource, action`,
      [req.academyId]
    );

    res.json({
      resources: RESOURCES,
      actions: ACTIONS,
      roles: ROLES,
      matrix: rows,
    });
  } catch (err) {
    console.error('[GET /permissions]', err.message);
    res.status(500).json({ error: '권한 매트릭스 조회 중 오류가 발생했습니다.' });
  }
});

// ─────────────────────────────────────────────
// PUT /
//   권한 매트릭스 일괄 업데이트 (admin 전용)
//   body: { updates: [{ role, resource, action, allowed }, ...] }
// ─────────────────────────────────────────────
router.put('/', requireAdmin, async (req, res) => {
  try {
    if (!req.academyId) {
      return res.status(403).json({ error: '학원 정보가 없습니다.' });
    }

    const { updates } = req.body || {};
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'updates 배열이 필요합니다.' });
    }

    // 변경 전 스냅샷 (감사 로그용)
    const beforeMatrix = await getAll(
      'SELECT role, resource, action, allowed FROM permissions WHERE academy_id = ?',
      [req.academyId]
    );

    let applied = 0;
    for (const u of updates) {
      const { role, resource, action, allowed } = u || {};
      if (!role || !resource || !action) continue;
      if (!ROLES.includes(role)) continue;
      if (!RESOURCES.includes(resource)) continue;
      if (!ACTIONS.includes(action)) continue;

      await runQuery(
        `INSERT INTO permissions (academy_id, role, resource, action, allowed)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (academy_id, role, resource, action)
         DO UPDATE SET allowed = EXCLUDED.allowed`,
        [req.academyId, role, resource, action, !!allowed]
      );
      applied++;
    }

    await logAction({
      req, action: 'permissions_update', resourceType: 'permissions',
      before: beforeMatrix, after: updates,
    });
    res.json({ ok: true, applied });
  } catch (err) {
    console.error('[PUT /permissions]', err.message);
    res.status(500).json({ error: '권한 매트릭스 업데이트 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
