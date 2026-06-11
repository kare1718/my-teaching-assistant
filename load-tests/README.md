# 나만의 조교 - 부하 테스트 (k6)

5월 런칭 전 병목 색출용. **실제 사용자 패턴 = 등하원 피크시 체크인/대시보드 조회**.

## 설치
```bash
# Windows (chocolatey)
choco install k6

# macOS
brew install k6

# 또는 docker
docker pull grafana/k6
```

## 시나리오 요약
| 파일 | 목적 | 지속 | VU |
|---|---|---|---|
| `01-smoke.js` | 기본 헬스체크 (코드 정상여부) | 30초 | 1 |
| `02-baseline.js` | 평상시 트래픽 시뮬레이션 | 5분 | 20 |
| `03-peak-checkin.js` | 등하원 피크 (출결 체크인 폭발) | 10분 | 100→200 |
| `04-stress.js` | 한계점 탐색 | 15분 | 10→500 |
| `05-soak.js` | 메모리 누수 탐지 (24h는 CI에서만) | 1시간 | 30 |

## 실행
```bash
# 로컬 서버
BASE_URL=http://localhost:3002 k6 run 01-smoke.js

# 스테이징
BASE_URL=https://staging.najogyo.com k6 run 03-peak-checkin.js

# 결과 저장
k6 run --summary-export=results/peak-$(date +%Y%m%d-%H%M).json 03-peak-checkin.js
```

## 합격선 (런칭 게이트)
- **02-baseline**: p95 < 300ms, error rate < 0.1%
- **03-peak**: p95 < 800ms, error rate < 1%
- **04-stress**: 500 VU에서 **크래시 없이** graceful degradation
- **05-soak**: 1시간 후 메모리 상승 < 20%

## 테스트 계정 준비
`setup-test-data.sql` 실행해서 학원 10개 × 학생 30명씩 시드 데이터 생성 후 테스트.
