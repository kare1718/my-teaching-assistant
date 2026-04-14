# 최적화 베이스라인 (2026-04-15)

측정 전용 리포트. 코드 변경 없음.

## 1. 프론트엔드 번들

- 빌드 도구: Vite 7.3.1, React 19.2
- 빌드 시간: 4.96s, 865 modules transformed
- 총 dist/assets 크기: 약 **2.37 MB** (gzip 기준 약 635 KB)
- 최대 청크: `dist/assets/index-BOWuJAeo.js` = **2,264.76 kB** (gzip 603.73 kB) — 전체의 약 95%
- CSS: `index-DDnfmZ2e.css` 42.83 kB (gzip 8.05 kB)
- **500 KB 이상 청크: 1개** (`index-*.js` 2.26 MB). Vite가 경고 발생.
- **manualChunks 설정: 미설정** (`client/vite.config.js`에 `build.rollupOptions` 없음)
- 기존 동적 청크: 15개 (ShopTab, VocabTab, BackupTab, CodesTab, Rankings/Rewards/Titles/XpLog 등 전부 < 15 kB) — 탭 레벨 lazy는 있으나 페이지 레벨은 없음

### dependencies (client/package.json)

| 라이브러리 | 버전 | 비고 |
|---|---|---|
| recharts | ^3.8.0 | 대형, 차트 전용 — 독립 청크 후보 |
| xlsx | ^0.18.5 | 대형 (약 400 KB+), DataImport에서만 사용 — 동적 import 후보 |
| react-router-dom | ^7.13.1 | |
| @tanstack/react-query | ^5.96.2 | |
| zustand | ^5.0.12 | |
| react / react-dom / react-is | ^19.2 | vendor 청크 후보 |

### 관찰
- `client/src/App.jsx` 286줄, `<Route>` **85개**, React.lazy 사용 **0건**. 모든 페이지가 최상위에서 static import → 단일 index 청크에 전부 번들됨.
- Top 페이지 파일이 1,000줄 이상 다수(ScoreInput 1,389, SmsManage 1,317, ClinicManage 1,064 등). 페이지 단위 code splitting 효과 큼.
- public/fonts/Paperlogy-*.woff2 5건 "didn't resolve at build time" 경고 — 자산 경로 확인 필요 (단, 런타임에서는 동작).

## 2. 백엔드 라우트

- 파일 수: **40개**, 총 **18,080 줄**
- 총 엔드포인트: `router.(get|post|put|delete|patch)` = **537개**

### Top 10 큰 라우트 파일

| # | 파일 | 줄 수 |
|---|---|---|
| 1 | routes/tuition.js | 1,151 |
| 2 | routes/admin.js | 1,019 |
| 3 | routes/scores.js | 933 |
| 4 | routes/gamification/admin.js | 788 |
| 5 | routes/aiAssistant.js | 756 |
| 6 | routes/studyTimer.js | 695 |
| 7 | routes/gamification/quizzes.js | 691 |
| 8 | routes/classes.js | 687 |
| 9 | routes/sms.js | 683 |
| 10 | routes/superadmin.js | 625 |

1,000줄 넘는 파일 2개(tuition, admin)는 도메인별 분리 리팩토링 후보.

## 3. DB 인덱스

- 마이그레이션 파일: **23개** (001 ~ 023)
- CREATE TABLE: **95회** (중복 IF NOT EXISTS 포함)
- CREATE INDEX: **147회**
- ADD COLUMN academy_id: **38회**
- academy_id 포함 인덱스: **70개** (대부분 `(academy_id)` 또는 `(academy_id, ...)` 복합)

대체로 academy_id 인덱스 커버리지는 양호해 보이나, audit-queries가 보고한 134건의 "academy_id 누락 쿼리"는 대부분 자식 테이블(`class_students`, `class_sessions`, `attendance_logs` 등)을 `id`/`class_id` 키로 조회 중 — RLS/인덱스가 아닌 **애플리케이션 레벨 테넌시 필터 누락**이 핵심 이슈 (BUG_REPORT 참조).

## 4. 데드 코드

- `server/.sync-backup/`: **없음** (이미 정리됨)
- `client/src/pages/LandingPage.jsx.bak`: **존재** (삭제 후보)
- TODO/FIXME/XXX: **46건** (server/ + client/src/)
- console.log: server/routes **23건**, client/src/pages **0건**
- `server/routes/subscription.js`의 레거시 tier 키:
  - `'trial'` (2회, 필터/상태 체크)
  - `'basic'`, `'standard'` (여러 곳) — 현행 요금제(Free/Starter/Pro/First Class)와 불일치
  - 58줄 `.filter(([key]) => key !== 'trial')` 로 숨기는 중이나, 76/180/342/343줄에서 여전히 활성 키로 사용 → **요금제 통합 리팩토링 필요**

## 5. 프론트엔드 품질

- pages 최상위 파일: 7개 (LandingPage.jsx 포함) + 5개 하위 디렉토리
- 전체 페이지 파일(.jsx/.js, 재귀): **104개**
- components 파일: **20개**
- App.jsx: 286줄, 85 routes
- **React.lazy 사용: 0건** — 코드 스플리팅 최대 기회

## 6. 최적화 우선순위 Top 10

투자 대비 효과가 큰 순서:

1. **페이지 레벨 `React.lazy` + `Suspense` 도입** — index 청크 2.26 MB → 추정 500~800 KB. 초기 로딩 체감 2~3배 개선. 1일 작업.
2. **`vite.config.js`의 `rollupOptions.output.manualChunks`** 설정 — react/recharts/xlsx/@tanstack 분리. 캐시 적중률 상승.
3. **`xlsx` 동적 import** — DataImport 페이지에서만 사용, 약 400 KB 절약. 30분 작업.
4. **`recharts` 지연 로딩** — Dashboard/Reports에만 필요. `React.lazy` 또는 dynamic import.
5. **academy_id 누락 쿼리 134건 수정** — 멀티테넌시 취약점 (BUG_REPORT Critical). 보안 필수.
6. **서브스크립션 tier 정리** — `basic/standard/premium/growth/trial` 레거시 제거, 현행 요금제(Free/Starter/Pro/First Class)로 통합.
7. **대형 라우트 파일 분리** — `tuition.js` 1,151줄 → 도메인 분리(records/plans/refunds/settlements). 유지보수성.
8. **대형 페이지 컴포넌트 분해** — ScoreInput(1,389), SmsManage(1,317), ClinicManage(1,064) → 서브 컴포넌트 추출, React.lazy 효과 극대화.
9. **`LandingPage.jsx.bak` 등 데드 파일 제거**, server 23건 `console.log` → 구조적 logger 전환.
10. **`client/public/fonts/Paperlogy-*.woff2` 경로 경고 해소** — build time에 resolve 실패, 런타임 404 위험 확인.

## 참고 수치 한눈에

| 항목 | 값 |
|---|---|
| 프론트 번들 index.js | 2.26 MB (gzip 603 KB) |
| 백엔드 총 LOC (routes) | 18,080 |
| 백엔드 엔드포인트 | 537 |
| DB 마이그레이션 | 23 |
| DB 테이블 | 95 |
| DB 인덱스 | 147 |
| academy_id 인덱스 | 70 |
| 페이지 파일 | 104 |
| React.lazy | 0 |
| 라우트 모듈 로드 테스트 | 40/40 통과 |
