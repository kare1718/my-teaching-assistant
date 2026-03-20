# 나만의 조교 - 학원 관리 SaaS 플랫폼

## 프로젝트 개요
학원 관리 SaaS 플랫폼 (멀티테넌트)
- 서버: `server/server.js` (Express, Port 3001)
- 클라이언트: `client/` (React + Vite)
- DB: PostgreSQL (Supabase)
- 슬로건: "나만의 조교로 학원 운영을 더욱 편리하게"

## 기술 스택
- Backend: Express.js, pg (PostgreSQL), bcryptjs, jsonwebtoken
- Frontend: React, Vite, React Router
- DB: Supabase (PostgreSQL)
- 배포: Render (서버) + Supabase (DB)

## 멀티테넌시 구조
- 모든 테이블에 `academy_id` 컬럼
- JWT에 `academy_id` 포함
- 학원별 독립 데이터 격리
- 구독 티어: trial, basic, standard, pro, enterprise

## 주요 파일
- `server/db/database.js` — pg Pool, ?→$N 자동 변환
- `server/db/migrations/` — SQL 마이그레이션 파일
- `server/middleware/` — auth, tenant, usage, subscription
- `server/routes/` — 14개 기존 + 4개 SaaS 전용 라우트
- `client/src/contexts/TenantContext.jsx` — 학원별 동적 설정
- `client/src/pages/LandingPage.jsx` — 플랫폼 소개
- `client/src/pages/OnboardingPage.jsx` — 학원 등록 마법사

## 빌드 & 실행
```bash
cd client && npm run build
cd server && node server.js
```
