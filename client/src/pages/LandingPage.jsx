import { useNavigate } from 'react-router-dom';
import { isLoggedIn, getUser } from '../api';

export default function LandingPage() {
  const navigate = useNavigate();
  const user = getUser();

  if (isLoggedIn() && user) {
    const isAssistant = user.school === '조교';
    navigate((user.role === 'admin' || isAssistant) ? '/admin' : '/student');
    return null;
  }

  const features = [
    { icon: '📊', title: '성적 관리', desc: '시험별 성적 입력, 등수 자동 계산, 성적 추이 그래프' },
    { icon: '🎮', title: '게이미피케이션', desc: '레벨/XP 시스템, 어휘 퀴즈, 랭킹, 포인트 상점' },
    { icon: '📱', title: '학생/학부모 앱', desc: '성적 확인, 안내사항, 수업 자료, Q&A 게시판' },
    { icon: '👨‍🏫', title: '관리자 대시보드', desc: '학생 관리, 승인, 학교/학년별 분류, 수업 후기' },
    { icon: '📋', title: '출결/숙제 관리', desc: '클리닉 예약, 숙제 관리, 조교 스케줄' },
    { icon: '💬', title: 'SMS 발송', desc: '학부모 문자 발송, 성적 알림 자동화' },
  ];

  const plans = [
    { name: 'Basic', price: '3만원', students: '30명', features: ['성적 관리', '게이미피케이션', '랭킹/상점', '안내사항/자료'], color: '#3b82f6' },
    { name: 'Standard', price: '5만원', students: '50명', features: ['Basic 전체', 'AI 리포트', '퀴즈 전체', 'OX/독해/지식 퀴즈'], color: '#8b5cf6', popular: true },
    { name: 'Pro', price: '8만원', students: '100명', features: ['Standard 전체', 'SMS 발송', '클리닉/숙제', '명예의 전당'], color: '#f59e0b' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc' }}>
      {/* Hero */}
      <section style={{
        padding: '80px 20px 60px', textAlign: 'center',
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        color: 'white'
      }}>
        <h1 style={{ fontSize: 'clamp(2em, 5vw, 3.5em)', fontWeight: 900, marginBottom: 16, lineHeight: 1.2 }}>
          나만의 조교
        </h1>
        <p style={{ fontSize: 'clamp(1em, 2.5vw, 1.3em)', opacity: 0.9, marginBottom: 8 }}>
          나만의 조교로 학원 운영을 더욱 편리하게
        </p>
        <p style={{ fontSize: '0.95em', opacity: 0.7, marginBottom: 40 }}>
          성적 관리부터 게이미피케이션까지, 학원에 필요한 모든 것
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/onboarding')} style={{
            padding: '14px 32px', fontSize: 16, fontWeight: 700, borderRadius: 12,
            background: 'white', color: '#1e3a5f', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'transform 0.2s'
          }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            무료로 시작하기
          </button>
          <button onClick={() => navigate('/login')} style={{
            padding: '14px 32px', fontSize: 16, fontWeight: 600, borderRadius: 12,
            background: 'transparent', color: 'white', border: '2px solid rgba(255,255,255,0.5)',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'transparent'; }}
          >
            로그인
          </button>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '60px 20px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8em', fontWeight: 800, marginBottom: 40 }}>
          학원 운영에 필요한 모든 기능
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              padding: 24, borderRadius: 16, background: 'white',
              border: '1px solid #e5e7eb', transition: 'all 0.2s'
            }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span style={{ fontSize: 32 }}>{f.icon}</span>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 8px' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '60px 20px', background: '#f3f4f6' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8em', fontWeight: 800, marginBottom: 40 }}>
          합리적인 요금제
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>
          {plans.map((p, i) => (
            <div key={i} style={{
              padding: 28, borderRadius: 16, background: 'white',
              border: p.popular ? `3px solid ${p.color}` : '1px solid #e5e7eb',
              position: 'relative', textAlign: 'center'
            }}>
              {p.popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: p.color, color: 'white', padding: '4px 16px', borderRadius: 20,
                  fontSize: 12, fontWeight: 700
                }}>인기</div>
              )}
              <h3 style={{ fontSize: 22, fontWeight: 800, color: p.color }}>{p.name}</h3>
              <p style={{ fontSize: 32, fontWeight: 900, margin: '12px 0 4px' }}>월 {p.price}</p>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>최대 {p.students}</p>
              <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left' }}>
                {p.features.map((f, j) => (
                  <li key={j} style={{ padding: '6px 0', fontSize: 14, color: '#374151' }}>
                    &#10003; {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: 24, color: '#6b7280', fontSize: 14 }}>
          모든 플랜 14일 무료 체험 가능
        </p>
      </section>

      {/* CTA */}
      <section style={{ padding: '60px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.6em', fontWeight: 800, marginBottom: 16 }}>
          지금 바로 시작하세요
        </h2>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>
          3분이면 학원 등록 완료! 무료 체험으로 시작해보세요.
        </p>
        <button onClick={() => navigate('/onboarding')} style={{
          padding: '16px 40px', fontSize: 18, fontWeight: 700, borderRadius: 12,
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
          color: 'white', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
        }}>
          무료로 시작하기
        </button>
      </section>

      {/* Footer */}
      <footer style={{ padding: '24px 20px', textAlign: 'center', borderTop: '1px solid #e5e7eb', color: '#9ca3af', fontSize: 13 }}>
        <p>나만의 조교 | 학원 관리 SaaS 플랫폼</p>
      </footer>
    </div>
  );
}
