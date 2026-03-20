// 테넌트(학원) 미들웨어 — JWT에서 academy_id 추출
function tenantMiddleware(req, res, next) {
  if (req.user && req.user.academy_id) {
    req.academyId = req.user.academy_id;
  } else {
    req.academyId = null;
  }
  next();
}

module.exports = { tenantMiddleware };
