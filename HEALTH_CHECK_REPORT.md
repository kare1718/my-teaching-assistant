# 전수 점검 리포트 (2026-04-15)

## 요약
- 프론트엔드 라우트: **82개** (App.jsx, Parent sub-routes 5 포함)
- 백엔드 엔드포인트: **532개** (`routes/` 전체, 40개 라우트 파일)
- 프론트엔드 API 호출 (unique): **241개**
- 클라이언트 빌드: **성공** (3.64s, 경고 없음)
- 서버 라우트 로드: **40/40** 전부 성공
- 미들웨어/서비스/유틸 로드: **21/21** 전부 성공
- SQL 테넌시 audit: **hard 0건**, soft 55건
- 🔴 치명적 이슈: **4건**
- 🟡 경고: **4건**
- 🟢 정보: **2건**

---

## A. 프론트엔드 라우트 (82개)

### A-1. 파일 존재 확인 결과
`client/src/App.jsx`의 모든 `lazy(() => import(...))`를 수동 크로스체크한 결과:
- admin 38개 페이지, student 20개, parent 5개, superadmin 7개, legal 4개, public 4개 — **전부 실제 파일 존재**
- import 경로 대소문자 일치 (리눅스 배포 안전)

### A-2. 🔴 SideNav → App.jsx 라우트 매칭 실패
`client/src/components/SideNav.jsx` 관리자 메뉴에 정의된 `/admin/tasks` (업무 큐)가 `App.jsx`에 **라우트 미등록**.
- 클릭 시 → `NotFoundPage`로 떨어짐 → **404 🔴**
- 파일: `client/src/components/SideNav.jsx:95`
- 참고: `/admin/automation`(자동화 관리)만 등록되어 있고, 업무 큐 전용 페이지 컴포넌트가 존재하지 않음

### A-3. 나머지 SideNav 매칭
- admin 메뉴 29개 중 28개 OK
- superadmin 메뉴 7개 전부 OK (`/superadmin/kpi`, `/promotions`, `/revenue`, `/backup-security`, `/academy/new`, `/admin`, `/superadmin`)
- student SideNav 16개 전부 OK
- BottomTabBar(학생) 7개 전부 OK
- ParentBottomNav 5개 전부 OK (`/parent`, `/parent/attendance`, `/parent/tuition`, `/parent/notices`, `/parent/more`)

---

## B. 백엔드 API (40개 라우트 파일)

### B-1. server.js 라우트 등록
- 필수(`require`): 26개 — 전부 로드 성공
- 옵셔널(try-catch 로드): 14개 — 전부 로드 성공
- `/api/public` (tuition.js `publicRouter`) 로드 성공

### B-2. 🟡 `superadmin.js`에 선언은 있으나 미구현된 엔드포인트
다음 경로는 **서버에 존재하지 않음** (클라이언트는 호출):
- `POST /api/superadmin/backup` — 수동 백업 생성
- `PUT  /api/superadmin/users/:id/block` — 유저 차단
- `POST /api/superadmin/tenants/:id/suspend` / `unsuspend` — 학원 정지

호출처:
- `client/src/pages/admin/BackupSecurity.jsx:57,94,106`
- `client/src/pages/superadmin/BackupSecurity.jsx:57,94,106`

→ BackupSecurity 화면에서 "백업 생성 / 유저 차단 / 학원 정지" 버튼 누르면 **404 🔴**.

### B-3. 라우트 파일 구조
- 모든 40개 파일이 `module.exports = router` 보유 (로드 성공으로 입증)
- `routes/gamification/` 폴더는 `index.js`가 sub-router들을 `/admin` prefix로 마운트 — 정상

---

## C. API 매칭 결과 (241 FE calls × 532 BE endpoints)

### C-1. 🔴 FE 호출 / BE 없음 (실호출 404)
1. `POST /api/superadmin/backup` — BackupSecurity
2. `PUT  /api/superadmin/users/:id/block` — BackupSecurity
3. `POST /api/superadmin/tenants/:id/suspend|unsuspend` — BackupSecurity

(동일 화면이 `/admin/*`와 `/superadmin/*` 양쪽에 중복 존재. 사용자 클릭 시 4xx JSON)

### C-2. 🟢 BE 있음 / FE 미사용 (참고용)
- 매칭 스크립트 기준 약 300개가 "미사용"으로 잡혔으나, 대다수는 `api()` / `useApiData()` / fetch 템플릿 리터럴 등 다른 호출 방식을 쓰는 경로임 (apiGet/apiPost/apiPut/apiDelete 직접 호출만 수집한 한계). 실제 미사용 엔드포인트 집계는 별도 정밀 스캔 필요. 치명도 낮음.

---

## D. 빌드 + 모듈 로드

### D-1. 클라이언트 빌드
```
✓ built in 3.64s
```
- 경고/에러 **0건**
- 대형 번들: `vendor-charts-DSkcB6yG.js` 404.86 kB, `vendor-xlsx-DFH0qU2H.js` 332.70 kB, `index-zzFHdZ6U.js` 341.37 kB → 🟢 코드 스플리팅 추가 권장(비치명)

### D-2. 서버 라우트 로드 (`routes/**`)
```
Routes loaded: 40 / failed: 0
```

### D-3. 미들웨어/서비스/유틸 로드
```
OK: ./middleware/{auth, tenant, tenantGuard, subscription, usage, permission}
OK: ./services/{billing, notification, cronJobs, automation, timeline, audit, analytics, kpi, tuitionCalculator}
OK: ./utils/{errorHandler, validate, inviteCode, smsHelper, smsBilling, geminiHelper}
```
21/21 전부 로드 성공.

---

## E. DB 마이그레이션

- 파일: `001_initial_schema.sql` ~ `025_invite_codes.sql` (총 **25개**)
- 번호 순서 **연속**, 누락 없음
- 순차 실행 (`server.js > runMigrations()` → 파일명 `.sort()`)
- 외래키 선행 참조 구조도 이상 없음 (025까지 순차 적용 가정 하에)

---

## F. 테넌시/권한 (`tests/audit-queries.js`)

```
[audit-queries] ℹ users 등 soft 테이블 55건 (검토 권장)
```
- **hard 취약점: 0건** ✓
- soft 경고: 55건 (화이트리스트 테이블 대상 — `users`, `student_parents`, `class_students`, `class_waitlist`, `lead_activities` 등)
- 대부분 글로벌·조인 컨텍스트에서 academy_id 간접 필터를 사용하는 케이스 (검토 권장, 치명 아님)

---

## 🔴 치명적 이슈 Top 4

| # | 이슈 | 위치 | 영향 |
|---|---|---|---|
| 1 | SideNav `/admin/tasks` 라우트 미등록 | `SideNav.jsx:95` | 관리자가 "업무 큐" 클릭 시 404 페이지 |
| 2 | `POST /api/superadmin/backup` 없음 | `superadmin/BackupSecurity.jsx:57`, `admin/BackupSecurity.jsx:57` | "수동 백업" 버튼 404 |
| 3 | `PUT /api/superadmin/users/:id/block` 없음 | `BackupSecurity.jsx:94` (양쪽) | "유저 차단/해제" 버튼 404 |
| 4 | `POST /api/superadmin/tenants/:id/(un)suspend` 없음 | `BackupSecurity.jsx:106` (양쪽) | "학원 정지/해제" 버튼 404 |

## 🟡 경고 목록

- **BackupSecurity 중복**: `pages/admin/BackupSecurity.jsx`와 `pages/superadmin/BackupSecurity.jsx`가 거의 동일 — 유지보수 이원화 위험
- **`/admin/backup`과 `/admin/backup-security` 분리**: App.jsx에 둘 다 등록되어 있고 각각 다른 컴포넌트 사용(BackupManage vs BackupSecurity) — 사용자 혼선 가능
- **대형 vendor 번들**: `vendor-charts`, `vendor-xlsx` 합 700KB+ — 초기 로드 지연
- **audit-queries soft 55건**: 멀티테넌시 검증 정밀도 향상 필요(주로 `users`, `student_parents` 조인 쿼리)

## 🟢 개선 제안

- 매칭 스크립트가 `api()`/`useApiData()`/`fetch()` 템플릿 리터럴 호출은 커버하지 못함 → 정밀 dead-endpoint 분석은 별도 도구 필요
- `/api/superadmin/backup*`, `/users/:id/block`, `/tenants/:id/suspend` 엔드포인트를 구현하거나, BackupSecurity 화면에서 해당 버튼을 제거/disable 처리

---

## 최종 판정

**빌드/로드는 100% 정상**이고 라우트 구조 대부분이 건강하다. 다만 **사용자가 실제로 누를 수 있는 4개 경로(1 프론트 라우트 + 3 API 엔드포인트)가 확정 404**로 이어진다. 상용화 전 반드시 수정이 필요한 치명 이슈는 이 4건이며, 이외 영역은 배포 가능 수준.
