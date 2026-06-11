// Sentry 통합 — 서버 에러/성능 모니터링
//
// 활성 조건: SENTRY_DSN 환경변수 설정 시에만 활성화.
// 미설정 시: no-op (개발/테스트 환경 간섭 없음)
//
// 기능:
//   - 미처리 에러 자동 캡처 (Express 에러 핸들러)
//   - 트랜잭션 추적 (p95 응답시간 모니터링)
//   - 프로파일링 (CPU hot spot 탐지)
//   - 민감 정보 필터링 (비밀번호, 토큰, SMS 코드 등)
//
// 사용:
//   const sentry = require('./services/sentry');
//   sentry.init(app);     // Express 앱 초기화 전 호출
//   sentry.setupHandler(app);  // 라우트 등록 후 호출 (에러 핸들러)
//   sentry.captureException(err, context); // 수동 에러 보고

let Sentry;
let initialized = false;
let profilingEnabled = false;

const SENTRY_DSN = process.env.SENTRY_DSN || '';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.APP_VERSION || 'dev';

// 민감 정보 필드 (요청 본문/응답에서 마스킹)
const SENSITIVE_KEYS = [
  'password', 'currentPassword', 'newPassword', 'adminPassword', 'tempPassword',
  'token', 'authorization', 'cookie', 'Cookie', 'Authorization',
  'phoneVerificationToken', 'code', // 인증번호
  'credit_card', 'cardNumber', 'cvc',
];

function scrubSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const scrubbed = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((key) => k.toLowerCase().includes(key.toLowerCase()))) {
      scrubbed[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      scrubbed[k] = scrubSensitive(v);
    } else {
      scrubbed[k] = v;
    }
  }
  return scrubbed;
}

function init() {
  if (!SENTRY_DSN) {
    console.log('[Sentry] DSN 미설정 — 비활성 (SENTRY_DSN 환경변수로 활성화)');
    return;
  }

  try {
    Sentry = require('@sentry/node');
    const integrations = [];

    // 프로파일링 (선택) — production 에서만
    try {
      const { nodeProfilingIntegration } = require('@sentry/profiling-node');
      integrations.push(nodeProfilingIntegration());
      profilingEnabled = true;
    } catch (e) {
      console.warn('[Sentry] profiling 미사용:', e.message);
    }

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      release: RELEASE,
      integrations,
      // 트랜잭션 샘플링 — 프로덕션 10%, 스테이징 100%
      tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
      profilesSampleRate: profilingEnabled ? (ENVIRONMENT === 'production' ? 0.1 : 1.0) : 0,
      // 민감 정보 필터링
      beforeSend(event, hint) {
        if (event.request) {
          if (event.request.data) event.request.data = scrubSensitive(event.request.data);
          if (event.request.headers) event.request.headers = scrubSensitive(event.request.headers);
          if (event.request.query_string && typeof event.request.query_string === 'string') {
            // 쿼리스트링에 token 등 있으면 잘라냄
            event.request.query_string = event.request.query_string.replace(
              /(token|code|password)=[^&]+/gi,
              '$1=[REDACTED]'
            );
          }
        }
        // 예상 가능한 401/404 에러는 무시 (노이즈)
        const status = event.contexts?.response?.status_code || hint?.originalException?.status;
        if (status === 401 || status === 404) return null;
        return event;
      },
      ignoreErrors: [
        // 사용자 입력 오류는 무시
        'ValidationError',
        'aborted',
        // 봇/스크래퍼로 인한 노이즈
        /favicon\.ico/i,
      ],
    });

    initialized = true;
    console.log(`[Sentry] 활성 (env=${ENVIRONMENT}, profiling=${profilingEnabled})`);
  } catch (err) {
    console.error('[Sentry] 초기화 실패:', err.message);
  }
}

// Express 에러 핸들러 설정 (라우트 등록 후 호출)
function setupHandler(app) {
  if (!initialized || !Sentry) return;
  // Sentry v8: setupExpressErrorHandler
  if (Sentry.setupExpressErrorHandler) {
    Sentry.setupExpressErrorHandler(app);
  }
}

// Express 요청 핸들러 (app 초기화 직후 호출)
function requestHandler() {
  if (!initialized || !Sentry) return (req, res, next) => next();
  // Sentry v8은 자동으로 http integration으로 request 추적 — 별도 미들웨어 불필요
  return (req, res, next) => {
    Sentry.getCurrentScope().setUser(req.user ? {
      id: req.user.id,
      role: req.user.role,
      academy_id: req.user.academy_id,
    } : null);
    next();
  };
}

function captureException(err, context = {}) {
  if (!initialized || !Sentry) {
    console.error('[captureException]', err.message, context);
    return;
  }
  Sentry.captureException(err, { extra: scrubSensitive(context) });
}

function captureMessage(msg, level = 'info', context = {}) {
  if (!initialized || !Sentry) return;
  Sentry.captureMessage(msg, { level, extra: scrubSensitive(context) });
}

function setUser(user) {
  if (!initialized || !Sentry) return;
  Sentry.getCurrentScope().setUser(user);
}

function addBreadcrumb(crumb) {
  if (!initialized || !Sentry) return;
  Sentry.addBreadcrumb(crumb);
}

async function flush(timeout = 2000) {
  if (!initialized || !Sentry) return;
  try { await Sentry.close(timeout); } catch {}
}

module.exports = {
  init,
  setupHandler,
  requestHandler,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  flush,
  get isActive() { return initialized; },
};
