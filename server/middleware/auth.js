const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'my-teaching-assistant-secret-key-2024';

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
  if (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.school === '조교') {
    return next();
  }
  return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ error: '플랫폼 관리자 권한이 필요합니다.' });
}

module.exports = { authenticateToken, requireAdmin, requireSuperAdmin, JWT_SECRET };
