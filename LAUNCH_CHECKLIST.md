# 5월 런칭 준비 체크리스트

## ✅ 완료된 인프라

### 1. 부하 테스트 (k6)
`load-tests/` 디렉토리에 시나리오 5개 + 시드/정리 SQL.
- `01-smoke.js` — 기본 동작 확인 (30초)
- `02-baseline.js` — 평상시 20 VU × 5분
- `03-peak-checkin.js` — **등하원 피크 200 VU × 10분** (가장 중요)
- `04-stress.js` — 500 VU까지 한계점 탐색
- `05-soak.js` — 1시간 지속 (메모리 누수 탐지)

**실행 전**:
```bash
# k6 설치 (Windows)
choco install k6

# 시드 데이터 생성
psql $DATABASE_URL -f load-tests/setup-test-data.sql

# 스모크 테스트
BASE_URL=http://localhost:3002 k6 run load-tests/01-smoke.js
```

**합격선**:
- baseline: p95 < 300ms, error < 0.1%
- peak: p95 < 800ms, error < 1%
- stress: 500 VU에서 graceful degradation (5xx 100건 미만)
- soak: 1시간 후 메모리 상승 < 20%

### 2. BullMQ SMS 큐
`server/services/queue.js` + `server/services/smsQueue.js`
- **Redis 있으면**: 비동기 큐 (초당 20건 rate limit, 재시도 3회 exponential backoff)
- **Redis 없으면**: 인라인 폴백 (개발 환경)
- 통합 위치:
  - `services/notification.js` - 보호자 SMS → 큐
  - `routes/phoneVerification.js` - 인증번호 → 큐
  - `routes/auth.js` - 임시비번 SMS → 큐

**Redis 설정 (무료)**:
1. https://upstash.com 가입
2. Redis DB 생성 (서울 리전 권장)
3. `REDIS_URL` 환경변수에 복사

### 3. DB 인덱스 보강
`server/db/migrations/029_hotpath_indexes.sql` 자동 적용
- `students.user_id` — **매 로그인 seq scan 제거** (가장 큰 효과)
- `users.phone` / `users.academy_id, role`
- `scores.student_id`, `scores.academy_id, student_id`
- `homework.academy_id, school, grade`
- `notices.academy_id, created_at DESC`
- `subscriptions.expires_at` (active만)
- `payments.status, created_at DESC`
- 기타 13개 인덱스

### 4. Sentry 통합
`server/services/sentry.js`
- 미처리 에러 자동 캡처
- 트랜잭션 추적 (p95 모니터링)
- **민감 정보 자동 마스킹** (비밀번호, 토큰, SMS 코드)
- 4xx 에러는 노이즈로 무시, 5xx만 보고
- `SENTRY_DSN` 없으면 비활성 (개발 환경)

**Sentry 설정**:
1. https://sentry.io 무료 계정 (5,000 events/월)
2. 프로젝트 생성 → DSN 복사
3. `SENTRY_DSN` 환경변수

---

## 🔴 런칭 전 필수 액션 (D-14)

### 환경변수 (production)
```bash
NODE_ENV=production
APP_VERSION=1.0.0                  # git sha 권장
REDIS_URL=rediss://...upstash.io:6379
SENTRY_DSN=https://xxx@sentry.io/...
CORS_ORIGIN=https://najogyo.com,https://www.najogyo.com
```

### 부하 테스트 실행
```bash
# 로컬 (먼저 통과해야 함)
BASE_URL=http://localhost:3002 k6 run load-tests/03-peak-checkin.js

# 스테이징 (런칭 예비 환경)
BASE_URL=https://staging.najogyo.com k6 run load-tests/03-peak-checkin.js

# soak (24시간 전)
BASE_URL=https://staging.najogyo.com k6 run load-tests/05-soak.js
```

### 백업 복원 리허설 (한 번 이상 필수)
Supabase Dashboard → Database → Backups → 최근 백업을 별도 프로젝트로 복원 → 데이터 검증.
"백업이 됩니다"와 "실제로 복원했다"는 완전히 다름.

### 롤백 플랜
- Render: 이전 배포로 원클릭 롤백
- DB 마이그레이션: 각 `migrations/*.sql`에 down 스크립트 작성 권장 (현재는 없음)
- 롤백 트리거: 에러율 > 5% 또는 p95 > 2s 지속 5분

### 모니터링 알림 설정
- Sentry: 에러율 급증 시 이메일/Slack
- Better Uptime: 서버 down 30초 내 알림 (무료)
- Supabase: DB 커넥션 80% 넘으면 경고

---

## 🟡 런칭 후 1주일 모니터 포인트

- **DB 커넥션**: `SELECT count(*) FROM pg_stat_activity` < 40
- **SMS 큐 적체**: BullMQ Dashboard 또는 Redis `LLEN bull:sms:waiting` < 100
- **메모리**: Render metrics, Node heap < 80%
- **에러율**: Sentry 5xx < 0.5%
- **p95 응답시간**: < 500ms

## 🟢 런칭 후 2주 내 추가 작업

- BullMQ Dashboard UI 또는 Bull Board 연결
- 일일 DB 백업 스크립트 (Supabase 자동 외 추가 레이어)
- 로그 aggregation (Logtail/Axiom 등)
- 비용 알림 (Supabase/Render 모니터링)
