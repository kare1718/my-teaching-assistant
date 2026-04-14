// 공통 에러 핸들러 유틸
// - asyncHandler: async 라우트의 try-catch 자동 래핑
// - badRequest/notFound/forbidden/unauthorized: 표준 응답
// - serverError: 500 + 로그
// - globalErrorMiddleware: Express 글로벌 에러 미들웨어 (옵션)
//
// 주의: 기존 응답 JSON 구조({ error: '...' })와 호환되도록 설계됨.

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function badRequest(res, message = '잘못된 요청입니다.') {
  return res.status(400).json({ error: message });
}

function unauthorized(res, message = '로그인이 필요합니다.') {
  return res.status(401).json({ error: message });
}

function forbidden(res, message = '권한이 없습니다.') {
  return res.status(403).json({ error: message });
}

function notFound(res, resource = '리소스') {
  return res.status(404).json({ error: `${resource}를 찾을 수 없습니다.` });
}

function serverError(res, err, context = '') {
  console.error(`[serverError] ${context}:`, err?.message || err);
  return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
}

// Express 글로벌 에러 미들웨어 (server.js에 이미 존재하므로 선택적으로 사용)
function globalErrorMiddleware(err, req, res, next) {
  console.error('[글로벌 에러]', err && err.message, err && err.stack);
  if (res.headersSent) return next(err);

  // DB 연결 오류
  if (err && (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET')) {
    return res.status(503).json({ error: '데이터베이스 연결 실패. 잠시 후 다시 시도해주세요.' });
  }

  // JWT 오류
  if (err && err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }

  if (err && err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
  }

  return res.status(err && err.status ? err.status : 500).json({ error: '서버 오류가 발생했습니다.' });
}

module.exports = {
  asyncHandler,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  globalErrorMiddleware,
};
