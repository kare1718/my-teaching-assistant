// 프로덕션 환경변수 검증
// 서버 시작 시 NODE_ENV=production 이면 필수 변수가 없을 때 즉시 실패 (fail fast)
// 개발 환경은 경고만 출력.

const REQUIRED_PRODUCTION = [
  { key: 'DATABASE_URL', desc: 'PostgreSQL 연결 문자열' },
  { key: 'JWT_SECRET', desc: 'JWT 서명 시크릿 (32자 이상 권장)', validate: (v) => v && v.length >= 32 },
  { key: 'CORS_ORIGIN', desc: '허용된 도메인 (콤마 구분)' },
];

const RECOMMENDED_PRODUCTION = [
  { key: 'SOLAPI_API_KEY', desc: 'Solapi SMS API 키' },
  { key: 'SOLAPI_API_SECRET', desc: 'Solapi SMS API 시크릿' },
  { key: 'SOLAPI_SENDER', desc: 'Solapi 발신번호' },
  { key: 'REDIS_URL', desc: 'Redis/Upstash URL (BullMQ 큐 활성화용)' },
  { key: 'SENTRY_DSN', desc: 'Sentry DSN (에러 모니터링)' },
  { key: 'APP_VERSION', desc: '배포 버전 (Sentry release 태깅)' },
  { key: 'PORTONE_API_SECRET', desc: 'PortOne 결제 API 시크릿' },
];

function check() {
  const env = process.env.NODE_ENV || 'development';
  const isProd = env === 'production';

  const missing = [];
  const invalid = [];
  const warnings = [];

  for (const { key, desc, validate } of REQUIRED_PRODUCTION) {
    const val = process.env[key];
    if (!val) {
      missing.push({ key, desc });
    } else if (validate && !validate(val)) {
      invalid.push({ key, desc });
    }
  }

  for (const { key, desc } of RECOMMENDED_PRODUCTION) {
    if (!process.env[key]) {
      warnings.push({ key, desc });
    }
  }

  if (missing.length || invalid.length) {
    console.error('\n❌ 환경변수 검증 실패:');
    for (const m of missing) console.error(`   누락: ${m.key} — ${m.desc}`);
    for (const i of invalid) console.error(`   유효X: ${i.key} — ${i.desc}`);

    if (isProd) {
      console.error('\n프로덕션 환경에서는 필수 변수 누락 시 시작 중단합니다.\n');
      process.exit(1);
    } else {
      console.warn('\n⚠ 개발 환경이라 진행하지만, 프로덕션 배포 전 반드시 설정하세요.\n');
    }
  }

  if (warnings.length && isProd) {
    console.warn('\n⚠ 권장 환경변수 누락 (기능 일부 비활성):');
    for (const w of warnings) console.warn(`   - ${w.key} — ${w.desc}`);
    console.warn('');
  }

  console.log(`[env] ${env} 환경 — 필수 ${REQUIRED_PRODUCTION.length - missing.length - invalid.length}/${REQUIRED_PRODUCTION.length}, 권장 ${RECOMMENDED_PRODUCTION.length - warnings.length}/${RECOMMENDED_PRODUCTION.length}`);
}

module.exports = { check };
