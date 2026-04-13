const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }
    req.user = user;
    req.academyId = user.academy_id || null;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'assistant') {
    return next();
  }
  return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
}

// 관리자 전용 (조교/선생님 불가 — 위험한 작업용)
function requireAdminOnly(req, res, next) {
  if (req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: '관리자만 접근 가능합니다.' });
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ error: '플랫폼 관리자 권한이 필요합니다.' });
}

module.exports = { authenticateToken, requireAdmin, requireAdminOnly, requireSuperAdmin, JWT_SECRET };
