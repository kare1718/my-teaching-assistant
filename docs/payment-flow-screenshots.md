# 결제 경로 PPT 제작 가이드

토스페이먼츠 심사에 제출할 "결제 경로" PPT를 빠르게 만들기 위한 체크리스트.

## 필요한 슬라이드 6장

| # | 제목 | URL | 강조 포인트 |
|---|---|---|---|
| 1 | 서비스 진입 | https://najogyo.com | 랜딩 히어로 섹션 + CTA 버튼 |
| 2 | 요금제 확인 | https://najogyo.com (하단 스크롤) | Starter/Pro 플랜 카드 + 가격 명시 |
| 3 | 회원가입/로그인 | https://najogyo.com/onboarding | 관리자 계정 생성 플로우 |
| 4 | 구독 페이지 | https://najogyo.com/admin/subscription | 현재 플랜 + 업그레이드 CTA |
| 5 | 결제창 호출 | (결제 팝업) | 토스페이먼츠 빌링 결제창 캡처 |
| 6 | 결제 완료 | https://najogyo.com/admin/subscription?success=1 | 구독 활성 상태 표시 |

## 촬영 준비

각 슬라이드당 준비사항:

### 슬라이드 1~2: 랜딩/요금제
- 배포 URL(najogyo.com) 접속
- Chrome 창 1440×900 고정
- **F12 DevTools 닫기** 상태로 캡처
- 가격 ("49,000원 / 월") 가 정확히 보이는 영역 포함

### 슬라이드 3: 온보딩
- `/onboarding` 접근
- Step 2 (관리자 계정) 캡처 — 휴대폰 인증 UI 포함

### 슬라이드 4: 구독 페이지
- 관리자 계정으로 로그인
- `/admin/subscription` 접근
- "현재: Free" + "Pro로 업그레이드" 버튼 노출 확인

### 슬라이드 5: 결제창
- **MID 발급 후** 실제 토스페이먼츠 빌링 결제창 캡처
- 테스트 카드번호 입력 화면이면 충분
- 카드번호는 마스킹하지 않아도 됨 (토스 측에서 어차피 테스트 번호 사용)

### 슬라이드 6: 결제 완료
- 결제 성공 리다이렉트 페이지
- "구독이 시작되었습니다" 메시지 + 다음 결제일 표시

## PPT 구성 템플릿

```
[슬라이드 1]
제목: "서비스 홈페이지 진입"
본문: 고객은 najogyo.com 에 접속해 서비스를 확인합니다.
하단: URL - https://najogyo.com
이미지: (홈페이지 스크린샷 전체)

[슬라이드 2]
제목: "요금제 선택"
본문: 홈페이지 하단 요금제 섹션에서 Pro 플랜을 선택합니다.
하단: URL - https://najogyo.com#pricing
이미지: (요금제 카드 4개 스크린샷, Pro 강조)

... (이하 동일 포맷)
```

## 자동 캡처 대안 — Playwright 스크립트

수동 캡처가 번거로우면 아래 스크립트로 일괄 자동 캡처:

```bash
npm install -D playwright
npx playwright install chromium

# 아래 스크립트 실행
node docs/auto-capture-payment-flow.mjs
```

스크립트는 6개 URL을 자동 방문하여 `docs/screenshots/payment-flow-{1..6}.png` 로 저장.
PPT에 이미지만 드래그하면 됨.

## 주의사항

- 캡처본에 **사업자 정보 footer**가 보이도록 스크롤
- 주소 표시줄(URL)이 보이는 브라우저 창으로 캡처
- 날짜/시간 정보는 크게 상관없으나 일관되게 유지
- **민감한 개인정보 (실명/전화번호) 캡처 시 마스킹**
