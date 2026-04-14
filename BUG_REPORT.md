# 버그/오류 점검 리포트 (2026-04-15)

진단 전용. 코드 변경 없음.

## 요약

| 단계 | 건수 |
|---|---|
| 치명적 (Critical) | 3군 (총 134+ 쿼리) |
| 경고 (Warning) | 7 |
| 개선 제안 (Info) | 6 |
| 서버 모듈 로드 | 40/40 성공 |
| 빌드 경고 | 6 (청크 크기 1 + 폰트 경로 5) |

---

## 🔴 치명적 (즉시 수정)

### C1. 멀티테넌시 academy_id 필터 누락 — 134건 (hard)
`server/tests/audit-queries.js` 실행 결과:
```
[audit-queries] ⚠ academy_id 누락 (hard) 134건
[audit-queries] ℹ users 등 soft 테이블 9건 (검토 권장)
```
자식 테이블을 parent id만 가지고 조회/변경하면서 academy_id 검증을 생략 → 크로스-테넌시 공격 시 다른 학원의 데이터를 조작/조회 가능.

대표 케이스(일부):
- `routes/classes.js:56,84,95,101,203,213,219,229,234,269,277,282,289,291,306,312,368,388,433,451,496,518,552,569` — class_students, class_sessions, teacher_assignments, class_schedules_recurring, class_waitlist 전반
- `routes/attendance.js:330,436` — attendance_logs
- `routes/auth.js:266,279,289` — notifications (user_id만 필터)
- `routes/tuition.js` 다수 — tuition_records, tuition_refunds, tuition_settlements
- `routes/webhook.js:59,68,159,166,200,226,232,251,279,316` — payments, subscriptions, webhook_events (webhook은 서버→서버라 일부는 의도적일 수 있으나 검토 필요)

**조치**: 각 쿼리에 `AND academy_id = ?` 추가 또는 parent를 먼저 academy_id로 검증 후 child 조작. 가장 일반적인 패턴은 `JOIN classes c ON c.id = class_students.class_id WHERE c.academy_id = ?`.

### C2. subscription.js의 레거시 tier 혼용 (요금제 정합성 붕괴)
`server/routes/subscription.js`:
- L58: `.filter(([key]) => key !== 'trial')` — trial이 TIER_LIMITS에 존재한다는 뜻
- L61: `key === 'free' ? 'Free' : key === 'basic' ? 'Basic' : key === 'standard' ? 'Standard' : 'Pro'` — basic/standard가 실제 플랜에 없는데 UI에 노출
- L76: `!['basic', 'standard', 'pro'].includes(planType)` — 결제 생성 시 허용 목록에 free/first_class 없음 → Free 유지 요청 및 First Class 업그레이드 실패 가능
- L109, 357: `status IN ('active', 'trial')` — trial 상태 전제 코드 잔존
- L180, 342, 343: `tierOrder = { free, basic, standard, pro }`, fallback `TIER_LIMITS.basic` — 현행 Free/Starter/Pro/First Class와 불일치

**조치**: TIER_LIMITS와 허용 목록을 `free/starter/pro/first_class`로 통일. trial 완전 제거. 혼용 중이라면 DB 마이그레이션으로 기존 `basic→starter`, `standard→pro` 맵핑.

### C3. `LandingPage.jsx.bak` 배포 번들 포함 위험
`client/src/pages/LandingPage.jsx.bak` 존재. Vite는 `.bak`을 import하지 않지만, `.jsx.bak`은 정적 자산 스캔에 걸릴 가능성 있음 + 실수로 import하면 타입 에러. **삭제 권장.**

---

## 🟡 경고 (수정 권장)

### W1. 동적 SQL 조립 (`classes.js`)
`routes/classes.js:433,552`:
```js
UPDATE class_sessions SET ${fields.join(', ')} WHERE id = ?
UPDATE class_schedules_recurring SET ${fields.join(', ')} WHERE id = ?
```
`fields`가 내부 whitelist에서 만들어지면 안전하나, 정규 표현만으로 검증된 상태는 아님. 허용 컬럼 whitelist로 명시 필요. 또한 C1과 동일하게 academy_id 검증 누락.

### W2. `vite.config.js`에 `manualChunks` 없음 + `chunkSizeWarningLimit` 미설정
초기 로드 2.26 MB 단일 청크. `OPTIMIZATION_BASELINE.md` Top 1~4 참조.

### W3. 빌드 시 폰트 경로 resolve 실패 (5건)
```
/fonts/Paperlogy-3Light.woff2 ... didn't resolve at build time
Paperlogy-4Regular/5Medium/6SemiBold/7Bold 동일
```
`client/public/fonts/`에 실제 파일이 없거나, CSS에서 절대 경로 `/fonts/...`를 사용 중. 런타임 404 시 폴백 폰트로 대체됨. public 디렉토리 확인 필요.

### W4. useEffect 빈 의존성 배열 다수 (38건)
클라 페이지에서 `useEffect(..., [])` 38건. 일부는 의도적(mount 시 1회) 이나, 외부 상태를 참조하는 stale closure 버그 후보. 헤유리스틱 결과이므로 수동 리뷰 필요(특히 `StudyTimer.jsx`, `ScoreInput.jsx`).

### W5. 서버 `console.log` 23건 (routes/)
프로덕션 로그 잡음 + 잠재적 민감정보 유출. 구조화 logger(pino/winston) + 레벨 기반 필터 권장.

### W6. `subscription.js` status enum 불일치
status에 `active`, `trial`, `canceled`, `past_due`가 혼재 (L109, 251 등). DB CHECK 제약과 코드 상수가 한 곳에서 관리되지 않음 → 상태 누락 시 silent bug.

### W7. webhook.js 서명 검증 여부 불확실
`routes/webhook.js`에서 payment_id/event_type으로만 idempotency 관리. PortOne webhook signature 검증 로직이 파일 상단에 있는지 확인 필요 (본 진단에서는 grep만 수행). 없다면 C1보다 상위 Critical.

---

## 🟢 개선 제안

- **I1**: TODO/FIXME 46건 — 이슈 트래커로 이전 후 주석 정리
- **I2**: 페이지 파일 104개, App.jsx 85 routes, React.lazy 0건 → 페이지 레벨 lazy 도입 (OPTIMIZATION Top 1)
- **I3**: Top 페이지 1,000줄+ (ScoreInput/SmsManage/ClinicManage/StudyTimer/ScheduleManage/Dashboard/LandingPage) — 컴포넌트 분해
- **I4**: `routes/tuition.js` 1,151줄, `routes/admin.js` 1,019줄 — 도메인 분리
- **I5**: `xlsx`, `recharts` 동적 import
- **I6**: `audit-queries.js`를 CI에 추가하여 academy_id 누락 회귀 방지

---

## 서버 모듈 로드 결과

```
Routes loaded: 40/40
```
스크립트에서 지정한 40개 라우트 모두 로드 성공 (`auth, admin, students, scores, questions, sms, clinic, schedules, hallOfFame, taSchedule, homework, oxQuiz, reports, studyTimer, aiAssistant, academies, subscription, superadmin, notifications, onboarding, webhook, attendance, tuition, consultation, portfolio, sms-credits, gamification, parents, classes, leads, automation, timeline, dashboard, parentApp, legalInfo, permissions, auditLogs, dataImport, sampleData, kpi`). 모듈 레벨 import/문법 오류는 없음.

실제 폴더에는 위 40개 외 추가 파일 없음 — 라우트 파일 개수도 정확히 40 + gamification 서브디렉토리(admin/quizzes/rankings/student 등).

---

## 빌드 경고 목록

1. `(!) Some chunks are larger than 500 kB after minification` — `index-BOWuJAeo.js` 2,264 KB (Critical perf, W2 참조)
2. `/fonts/Paperlogy-3Light.woff2 ... didn't resolve at build time` (W3)
3. `/fonts/Paperlogy-4Regular.woff2 ... didn't resolve at build time`
4. `/fonts/Paperlogy-5Medium.woff2 ... didn't resolve at build time`
5. `/fonts/Paperlogy-6SemiBold.woff2 ... didn't resolve at build time`
6. `/fonts/Paperlogy-7Bold.woff2 ... didn't resolve at build time`

ESLint / 타입체크는 `npm run build`에 포함되지 않음 — 별도 `npm run lint` 실행 권장.

---

## 본 진단에서 **수동 검증이 필요한** 항목 (heuristic만 수행)

- B-1 임포트 오류 / 대소문자 불일치: 모듈 로드 40/40 성공 — 주요 라우트에 한정. 클라이언트 빌드 성공 = 865 modules. **임포트 오류 없음으로 판정**.
- B-2 Hook 규칙 위반: ESLint 미실행 상태 (react-hooks 플러그인 설치됨). `npm run lint`로 재확인 권장.
- B-3 try-catch 없는 async: 528개 async 핸들러 중 catch 여부는 파일 단위 AST 분석 필요. 본 진단은 범위 외.
- B-4 SQL 템플릿 인젝션: C1, W1 외 별도 `${...}` 직접 삽입 패턴은 탐지되지 않음 (대부분 parameterized `?` 사용).
- B-5 마이그레이션 순서: 001~023 숫자 순 적용 시 019(permissions) → 020(audit_logs) → 021(legal_info) → 022(tuition_exceptions) → 023(analytics_events) 문제 없음. 003 multi-tenant 이후 academy_id ADD COLUMN이 004~이후에 나오는 패턴도 정상.
