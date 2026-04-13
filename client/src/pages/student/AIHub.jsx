import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';

const DAILY_TIPS = [
  '비문학 지문을 읽을 때는 문단별 핵심 키워드를 메모해보세요.',
  '수능 국어는 시간 배분이 핵심! 문학 20분, 비문학 40분을 목표로 연습하세요.',
  '어휘력은 하루 10개씩 꾸준히 외우는 것이 가장 효과적입니다.',
  '문학 작품을 읽을 때 화자의 정서와 태도를 먼저 파악하세요.',
  '비문학 선지 판단 시 "항상", "반드시", "모든" 같은 극단적 표현에 주의하세요.',
  '고전 문학은 현대어 해석을 먼저 읽고 원문을 보면 이해가 빨라요.',
  '국어 문법은 개념 암기보다 실전 문제로 적용력을 키우세요.',
  '시를 분석할 때는 시적 화자, 대상, 정서, 표현법 순서로 접근하세요.',
  '논설문의 핵심은 주장과 근거를 구분하는 것입니다.',
  '오답 노트를 만들 때 "왜 틀렸는지"를 반드시 적어두세요.',
  '매체 문제는 정보 전달 방식의 차이에 집중하세요.',
  '독서 지문은 첫 문장과 마지막 문장에 핵심이 있는 경우가 많아요.',
  '화법과 작문은 실생활 예시를 떠올리며 풀면 쉬워집니다.',
  '수능 국어 1등급의 비결은 "매일 지문 2개 이상 읽기"입니다.',
  '비문학에서 인과관계를 놓치면 오답을 고르기 쉬워요.',
  '현대시 감상은 이미지와 분위기를 먼저 느끼고 분석하세요.',
  '문법 문제는 음운, 형태, 통사, 의미 영역을 골고루 학습하세요.',
  '소설에서 서술 시점은 문제의 핵심 출제 포인트입니다.',
  '어휘 문제는 문맥 속에서 의미를 추론하는 연습을 하세요.',
  '비문학 과학 지문은 실험 설계와 변인 통제에 집중하세요.',
  '문학사 흐름을 알면 시대별 작품의 특징을 쉽게 파악할 수 있어요.',
  '독해력을 키우려면 글을 읽고 한 문장으로 요약하는 연습을 하세요.',
  '수능 국어 80분은 금방 지나갑니다. 타이머 켜고 연습하세요!',
  '고전 소설은 인물 관계도를 그리면 이해가 훨씬 쉬워져요.',
  '국어 공부는 양보다 질! 하루 1시간이면 충분합니다.',
  '쓰기 영역은 개요 작성 능력이 핵심입니다.',
  '비문학 예술 지문은 대비되는 개념 쌍을 찾아보세요.',
  '문학 감상 시 작가의 시대적 배경을 알면 깊이가 달라집니다.',
  '어법 문제는 틀린 부분을 찾기보다 올바른 규칙을 먼저 떠올리세요.',
  '매일 꾸준히 읽는 습관이 국어 실력의 기본입니다.',
];

export default function AIHub() {
  const navigate = useNavigate();
  const [oxLogs, setOxLogs] = useState([]);

  useEffect(() => {
    api('/ox-quiz/my-logs').then(setOxLogs).catch(() => {});
  }, []);

  const todayTip = DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];
  const recentOx = oxLogs.length > 0 ? oxLogs[0] : null;

  return (
    <div className="content s-page">
      <div className="breadcrumb">
        <Link to="/student">홈</Link> &gt; <span>AI 허브</span>
      </div>

      {/* 히어로 */}
      <div className="s-card" style={{
        textAlign: 'center', padding: 'var(--space-5)',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
        color: 'white', borderRadius: 16,
      }}>
        <div style={{ fontSize: 36 }}>🤖</div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, marginTop: 4 }}>AI 선생님</div>
        <p style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>AI와 함께 실력을 키워보세요</p>
      </div>

      {/* 오늘의 학습 팁 */}
      <div className="s-card" style={{ padding: '14px 16px', marginTop: 'var(--space-2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
          💡 오늘의 학습 팁
        </div>
        <div style={{ fontSize: 13, color: 'var(--warm-700)', lineHeight: 1.6 }}>
          {todayTip}
        </div>
      </div>

      {/* 최근 활동 */}
      {recentOx && (
        <div className="s-card" style={{ padding: '12px 16px', marginTop: 'var(--space-2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warm-500)', marginBottom: 4 }}>
            📊 최근 O/X 퀴즈
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {recentOx.correct_count}/{recentOx.total_count} 정답
            <span style={{ fontSize: 12, color: 'var(--warm-500)', marginLeft: 8 }}>
              {new Date(recentOx.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      )}

      {/* AI 기능 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 'var(--space-2)' }}>
        <div className="s-card" onClick={() => navigate('/student/qna')}
          style={{ cursor: 'pointer', padding: 'var(--space-5)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="s-icon-box" style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--soft-info-bg)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--soft-info-fg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--warm-800)' }}>질문하기</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warm-500)', marginTop: 2 }}>AI 선생님에게<br/>질문하기</div>
          </div>
        </div>

        <div className="s-card" onClick={() => navigate('/student/ox-quiz')}
          style={{ cursor: 'pointer', padding: 'var(--space-5)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="s-icon-box" style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--soft-success-bg)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--soft-success-fg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--warm-800)' }}>O/X 퀴즈</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warm-500)', marginTop: 2 }}>AI가 만든<br/>맞춤형 퀴즈</div>
          </div>
        </div>
      </div>

      {/* 추가 기능 */}
      <div className="s-card s-list-item" onClick={() => navigate('/student/timer')}
        style={{ marginTop: 'var(--space-2)', cursor: 'pointer' }}>
        <div className="s-icon-box" style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--soft-warning-bg)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--soft-warning-fg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--warm-800)' }}>공부 타이머</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warm-500)', marginTop: 2 }}>시간을 설정하고 집중하세요!</div>
        </div>
        <span style={{ fontSize: 'var(--text-lg)', color: 'var(--warm-300)' }}>›</span>
      </div>

      <div className="s-card s-list-item" onClick={() => navigate('/student/study-rankings')}
        style={{ marginTop: 'var(--space-2)', cursor: 'pointer' }}>
        <div className="s-icon-box" style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--soft-info-bg)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--soft-info-fg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--warm-800)' }}>공부 랭킹</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warm-500)', marginTop: 2 }}>다른 학생들과 공부 시간을 비교해보세요</div>
        </div>
        <span style={{ fontSize: 'var(--text-lg)', color: 'var(--warm-300)' }}>›</span>
      </div>

      {/* 더 많은 퀴즈 */}
      <div className="s-card" style={{ marginTop: 'var(--space-2)', padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warm-800)', marginBottom: 10 }}>
          🎮 더 많은 퀴즈 (XP 획득 가능!)
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: '어휘', path: '/student/quiz', emoji: '📝' },
            { label: '지식', path: '/student/knowledge-quiz', emoji: '🧠' },
            { label: '독해', path: '/student/reading-quiz', emoji: '📖' },
          ].map(q => (
            <button key={q.path} onClick={() => navigate(q.path)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, border: '1px solid var(--student-border)',
                background: 'var(--card)', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
              <span style={{ fontSize: 20 }}>{q.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-700)' }}>{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
