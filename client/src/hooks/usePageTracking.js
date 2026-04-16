import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// 페이지 경로 -> 기능 이름 매핑
const FEATURE_MAP = {
  '/admin': '대시보드',
  '/admin/students': '학생 명단',
  '/admin/parents': '보호자 관리',
  '/admin/classes': '수업/시간표',
  '/admin/attendance': '출결 관리',
  '/admin/homework': '과제 관리',
  '/admin/scores': '성적 관리',
  '/admin/tuition': '수납 관리',
  '/admin/sms': '메시지',
  '/admin/consultations': '상담 일지',
  '/admin/leads': '상담 관리',
  '/admin/automation': '자동화',
  '/admin/reports': '리포트',
  '/admin/settings': '설정',
  '/admin/gamification': '게이미피케이션',
  '/student': '학생 홈',
  '/student/game': '게임',
  '/student/quiz': '퀴즈',
  '/student/rankings': '랭킹',
  '/student/shop': '상점',
  '/parent': '보호자 홈',
};

function getFeatureName(path) {
  if (FEATURE_MAP[path]) return FEATURE_MAP[path];
  for (const [prefix, name] of Object.entries(FEATURE_MAP)) {
    if (path.startsWith(prefix + '/')) return name;
  }
  return null;
}

// 세션 ID (브라우저 탭 당 1개)
const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function usePageTracking() {
  const location = useLocation();
  const startTime = useRef(Date.now());
  const lastPath = useRef(null);

  useEffect(() => {
    const now = Date.now();
    const token = localStorage.getItem('token') || '';
    if (!token) return; // 비로그인 상태면 트래킹 안 함

    // 이전 페이지의 체류 시간 전송
    if (lastPath.current) {
      const duration = Math.round((now - startTime.current) / 1000);
      if (duration > 1 && duration < 3600) {
        fetch('/api/analytics/page-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            page_path: lastPath.current,
            feature_name: getFeatureName(lastPath.current),
            duration_seconds: duration,
            session_id: sessionId,
          }),
        }).catch(() => {});
      }
    }

    // 새 페이지 시작 기록
    lastPath.current = location.pathname;
    startTime.current = now;

    // 페이지 방문 기록 (체류 시간 0)
    fetch('/api/analytics/page-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        page_path: location.pathname,
        feature_name: getFeatureName(location.pathname),
        duration_seconds: 0,
        session_id: sessionId,
      }),
    }).catch(() => {});

  }, [location.pathname]);
}
