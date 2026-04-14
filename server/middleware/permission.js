// server/middleware/permission.js
// 리소스 × 액션 단위 권한 체크 미들웨어
//
// 사용법:
//   const { requirePermission } = require('../middleware/permission');
//   router.delete('/:id', requirePermission('students', 'delete'), handler);
//
// - admin / superadmin 은 무조건 통과
// - 그 외 역할은 permissions 테이블에서 allowed=true 행이 있어야 통과
// - academy_id 가 없는 요청은 거부

const { getOne } = require('../db/database');

function requirePermission(resource, action) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }

      const role = req.user.role;
      if (role === 'admin' || role === 'superadmin') {
        return next();
      }

      if (!req.academyId) {
        return res.status(403).json({ error: '학원 정보가 없습니다.' });
      }

      const perm = await getOne(
        `SELECT allowed FROM permissions
         WHERE academy_id = ? AND role = ? AND resource = ? AND action = ?`,
        [req.academyId, role, resource, action]
      );

      if (!perm?.allowed) {
        return res.status(403).json({
          error: '권한이 없습니다.',
          required: `${resource}:${action}`,
        });
      }

      next();
    } catch (err) {
      console.error('[requirePermission] 오류:', err.message);
      res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
    }
  };
}

module.exports = { requirePermission };
