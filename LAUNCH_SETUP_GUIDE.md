# 런칭 세팅 가이드 — 남은 사용자 액션 3가지

실제로 아무도 못 대신해줄 외부 계정 가입과 로컬 설치 단계입니다.
각 10~15분이면 끝납니다.

---

## 1️⃣ Upstash Redis 무료 생성 (~10분)

**왜 필요한가**: BullMQ SMS 큐가 Redis를 사용. 없으면 SMS 발송이 HTTP 요청 내 동기로 실행되어 등하원 피크 시 응답 지연.

### 단계
1. https://upstash.com 접속 → Sign Up (GitHub/Google OAuth 추천)
2. 대시보드 → **Create Database**
3. 설정:
   - Name: `najogyo-prod`
   - Type: **Regional** (Free tier)
   - Region: **ap-northeast-2 (Seoul)** ← 중요 (한국 서버 지연 최소화)
   - Eviction: `noeviction` (기본값)
4. 생성 후 **Connect** 탭 → **Node.js** → `rediss://...upstash.io:6379` 형식 URL 복사

### 서버에 적용
`.env` 파일 수정:
```bash
REDIS_URL=rediss://default:AbCdEf_your_password@apn2-eg-12345.upstash.io:6379
```

### 검증
서버 재시작 후 로그에 아래 메시지 뜨면 성공:
```
[queue] BullMQ 활성 — Redis 연결: rediss://***@apn2-...upstash.io:6379
```

### 무료 플랜 한도
- 10,000 commands/day
- 256MB storage
- 등하원 피크 기준 학원 500개까지도 충분 (초과 시 pay-as-you-go로 자동 전환)

---

## 2️⃣ Sentry 무료 계정 (~8분)

**왜 필요한가**: 프로덕션 에러를 알 수 있는 유일한 방법. 없으면 "새벽에 서비스가 죽어있었다"를 다음 날 알게 됨.

### 단계
1. https://sentry.io/signup/ (GitHub/Google OAuth)
2. Organization 생성 → "나만의 조교"
3. Project 생성:
   - **Platform**: Node.js
   - **Alert frequency**: Default
   - **Project name**: `najogyo-server`
4. 생성 후 표시되는 **DSN** 복사 (형식: `https://xxxxxx@o123456.ingest.sentry.io/7890123`)

### 서버에 적용
`.env` 파일 수정:
```bash
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxx@o123456.ingest.sentry.io/7890123
APP_VERSION=1.0.0
NODE_ENV=production  # ← production으로 바꿀 것 (트랜잭션 샘플링 10%로 절약)
```

### 프론트엔드에도 적용 (선택)
`client/index.html`의 `<head>` 에 추가:
```html
<script src="https://browser.sentry-cdn.com/8.55.0/bundle.min.js" crossorigin="anonymous"></script>
<script>
  if (window.Sentry) {
    window.Sentry.init({
      dsn: 'https://xxxxx@o123456.ingest.sentry.io/7890123',
      environment: '%MODE%',
      tracesSampleRate: 0.1,
    });
  }
</script>
```
프론트 errorReporter.js가 자동으로 window.Sentry를 사용.

### 검증
서버 재시작 후 로그:
```
[Sentry] 활성 (env=production, profiling=false)
```

일부러 에러 한 번 발생시켜 테스트:
```bash
curl http://localhost:3002/api/test-sentry-error
# Sentry 대시보드에 1분 내 이벤트 표시됨
```

### 무료 플랜 한도
- 5,000 errors/month
- 10,000 transactions/month  
- 현재 샘플링 10%로 설정해뒀으니 월 10만 트랜잭션 처리 가능
- 민감정보(비밀번호, 토큰, SMS 코드)는 `scrubSensitive`로 자동 마스킹됨

---

## 3️⃣ k6 설치 + 첫 smoke 실행 (~5분)

**왜 필요한가**: 런칭 전 "몇 명까지 버티나"를 실제 숫자로 알아야 자신감 있게 출시 가능.

### 설치 (Windows)
```powershell
# 관리자 PowerShell
choco install k6

# 또는 scoop
scoop install k6

# 또는 바이너리 다운로드
# https://github.com/grafana/k6/releases → k6-v0.53-windows-amd64.zip
```

### 설치 (macOS)
```bash
brew install k6
```

### 실행 순서
```bash
# 서버가 로컬에서 실행 중이어야 함
cd my-teaching-assistant

# 1. 간단 smoke (30초) — 기본 동작 확인
BASE_URL=http://localhost:3002 k6 run load-tests/01-smoke.js

# 2. 평상시 트래픽 (5분) — 20 VU
BASE_URL=http://localhost:3002 k6 run load-tests/02-baseline.js

# 3. 피크 시뮬레이션 (10분) — 200 VU 등하원 체크인 폭발
# ⚠️ 시드 데이터 먼저 필요 (load-tests/setup-test-data.sql)
BASE_URL=http://localhost:3002 k6 run load-tests/03-peak-checkin.js
```

### k6 설치 전 대체 — Node.js smoke 이미 있음
```bash
node load-tests/node-smoke.mjs http://127.0.0.1:3002
```
k6보다 훨씬 가볍고, 단일 순차 호출이지만 핵심 엔드포인트 동작 검증 가능.

### 합격선
| 테스트 | p95 | 에러율 |
|---|---|---|
| smoke | <500ms | 0% |
| baseline | <300ms | <0.1% |
| peak | <800ms | <1% |
| stress (500 VU) | graceful degradation | <10% (5xx < 100건) |

실패 시 첫 의심 지점:
1. DB 커넥션 풀 고갈 → `database.js`의 `max: 5`를 `max: 20`으로
2. Slow query → 로그의 `[DB Slow]` 찾아서 인덱스 추가
3. 메모리 누수 → cron/setInterval의 클로저 점검

---

## 4️⃣ (선택) 백업 복원 리허설

Supabase Dashboard → Database → Backups → 최근 일일 백업 → Restore to new project.
복원한 임시 프로젝트에서 `SELECT COUNT(*) FROM students` 등으로 데이터 검증 후 삭제.

**이걸 한 번도 안 해봤다면, 진짜 장애 때는 100% 복원 실패합니다.**

---

## 완료 체크리스트

- [ ] Upstash Redis DB 생성 + `REDIS_URL` 설정
- [ ] 서버 재시작 → `[queue] BullMQ 활성` 로그 확인
- [ ] Sentry 프로젝트 생성 + `SENTRY_DSN` 설정
- [ ] 서버 재시작 → `[Sentry] 활성` 로그 확인
- [ ] k6 설치 (또는 node-smoke.mjs 실행)
- [ ] smoke 테스트 합격 (/api/health, /api/auth/login 200 OK)
- [ ] Supabase 백업 복원 리허설 1회

위 4개가 끝나면 **5월 런칭 가능 상태**입니다.
