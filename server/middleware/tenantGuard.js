// 테넌트 가드 — authenticateToken 이후에 사용
// req.academyId가 유효한 숫자가 아니면 요청을 차단한다.
// superadmin은 플랫폼 전체를 다루므로 academy_id가 없어도 통과시킨다.
function tenantGuard(req, res, next) {
  const role = req.user && req.user.role;
  if (role === 'superadmin') return next();

  const id = req.academyId;
  if (id === null || id === undefined || typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    return res.status(403).json({ error: '학원 정보가 확인되지 않습니다.' });
  }
  next();
}

module.exports = tenantGuard;
module.exports.tenantGuard = tenantGuard;
