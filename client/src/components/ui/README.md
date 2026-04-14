# UI 컴포넌트 라이브러리

## 사용 예시
```jsx
import { Card, PageHeader, StatusBadge, Button } from '../components/ui';

<PageHeader
  title="학생 관리"
  subtitle="총 127명 재원 중"
  action={<Button variant="primary">학생 추가</Button>}
/>

<Card>
  <StatusBadge variant="success">재원</StatusBadge>
  <p>김민준 학생의 정보</p>
</Card>
```

## 컴포넌트 목록
- Card — 기본 카드 래퍼
- PageHeader — 페이지 제목 + 액션
- StatusBadge — 상태 배지 (7가지 variant)
- Button — 버튼 (5 variant × 3 size)
- EmptyState — 빈 상태 안내
- Modal — 모달 다이얼로그
- FilterChips — 필터 칩 목록
- Pagination — 페이지네이션
