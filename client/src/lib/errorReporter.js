// 클라이언트 에러 리포터
//
// Sentry 브라우저 SDK를 직접 import 하지 않고, 글로벌 window.Sentry 가
// 로드되어 있으면 사용하고 없으면 no-op. 의존성 추가 없이 런칭 시
// public/index.html 에 CDN 스크립트만 추가하면 자동 활성화.
//
//   <script src="https://browser.sentry-cdn.com/8.55.0/bundle.min.js" crossorigin="anonymous"></script>
//   <script>
//     if (window.Sentry && import.meta.env.VITE_SENTRY_DSN) {
//       window.Sentry.init({
//         dsn: import.meta.env.VITE_SENTRY_DSN,
//         environment: import.meta.env.MODE,
//         tracesSampleRate: 0.1,
//       });
//     }
//   </script>
//
// 사용:
//   import { reportError, reportMessage } from '../lib/errorReporter';
//   .catch(err => reportError(err, { context: 'dashboard/notices' }))
//
// 장점: Sentry 미설정/미로드 상태에서도 앱이 전혀 영향받지 않음.

const SENSITIVE_KEYS = ['password', 'token', 'code', 'authorization', 'cookie'];

function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = scrub(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isSentryActive() {
  return typeof window !== 'undefined' && !!(window.Sentry && window.Sentry.captureException);
}

/**
 * 에러를 Sentry로 보고. Sentry 미로드 시 console.error 폴백.
 * 4xx (의도된 사용자 에러)은 Sentry로 보내지 않음.
 */
export function reportError(err, context = {}) {
  if (!err) return;

  // 의도된 사용자 에러 필터 (401/403/404는 시스템 버그 아님)
  const status = err?.status || err?.response?.status;
  const message = (err?.message || '').toLowerCase();
  const isClientError =
    (status >= 400 && status < 500) ||
    message.includes('unauthorized') ||
    message.includes('not found') ||
    message.includes('forbidden');

  if (isClientError) {
    // 개발 환경에서는 콘솔에만 남김
    if (import.meta.env.DEV) console.debug('[client-err]', err.message, context);
    return;
  }

  const cleanContext = scrub(context);

  if (isSentryActive()) {
    try {
      window.Sentry.captureException(err, { extra: cleanContext });
      return;
    } catch {
      // fallthrough
    }
  }

  // 폴백: 콘솔
  console.error('[reportError]', err, cleanContext);
}

/**
 * 에러가 아닌 단순 경고/정보 메시지
 */
export function reportMessage(msg, level = 'info', context = {}) {
  if (isSentryActive()) {
    try {
      window.Sentry.captureMessage(msg, { level, extra: scrub(context) });
      return;
    } catch {}
  }
  if (level === 'error' || level === 'warning') {
    console.warn('[reportMessage]', msg, context);
  }
}

/**
 * 사용자 컨텍스트 설정 (로그인 직후 호출)
 */
export function setErrorUser(user) {
  if (!user) return;
  if (isSentryActive()) {
    try {
      window.Sentry.setUser({
        id: user.id,
        role: user.role,
        academy_id: user.academy_id,
      });
    } catch {}
  }
}

export function clearErrorUser() {
  if (isSentryActive()) {
    try { window.Sentry.setUser(null); } catch {}
  }
}
