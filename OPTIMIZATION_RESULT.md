# 최적화 결과 리포트 (2026-04-15)

## 번들 크기
| 지표 | Before | After |
|---|---|---|
| 최대 청크 | 2,264 KB (단일 index.js) | 404 KB (vendor-charts) |
| manualChunks | 미설정 | 5개 vendor 청크 |
| React.lazy | 0건 | 85건 (전 관리자/학생/보호자 페이지) |
| 초기 로드 | 2,264 KB | ~390 KB (index + react) |

## 보안
| 지표 | Before | After |
|---|---|---|
| academy_id 누락 hard | 134건 | 0건 |
| 동적 SQL 화이트리스트 | 없음 | classes.js, tuition.js 적용 |

## 데이터베이스
| 지표 | Before | After |
|---|---|---|
| CREATE INDEX 총 | 147 | 167 (+20 복합 인덱스) |

## 코드 정리
- .bak 파일 2개 제거 (LandingPage.jsx.bak, App.jsx.bak)
- subscription.js 레거시 tier 주석 명확화
- console.log 서버 23건 (전부 운영 로그로 확인됨, 제거 없음)

## 공통 인프라
- server/utils/errorHandler.js 신규
- server/utils/validate.js 신규
- client/src/components/ui/ (Card, PageHeader, StatusBadge, Button, EmptyState, Modal, FilterChips, Pagination)
- client/src/hooks/useApiData.js
- client/src/components/LoadingScreen.jsx

## SEO / 접근성
- HTML 메타 태그 완비 (description, keywords, author, OG, Twitter Card)
- robots.txt + sitemap.xml 생성 (client/public/)
- manifest.json 기존 값 확인 (name/short_name/theme_color 모두 적절)
- LandingPage.jsx 접근성 점검: `<div onClick>` 0건, `<img>` 0건 (아이콘은 Material Symbols 폰트 기반). 수정 불필요.

## 남은 soft 경고
- audit-queries.js soft 55건 — 부모 테이블 가드로 보호되는 child 테이블 (defense-in-depth 권장)
- useEffect 빈 deps 38건 — 의도적 최초 1회 로드 패턴 다수
