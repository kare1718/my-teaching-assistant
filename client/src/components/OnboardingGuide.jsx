import { useState } from 'react';

const STORAGE_KEY = 'onboarding-completed';

const steps = [
  {
    emoji: '🎮',
    title: '캐릭터를 선택하세요!',
    desc: '아바타를 꾸미고, 레벨업하며 성장해보세요. 게임 탭에서 시작할 수 있어요.',
  },
  {
    emoji: '📝',
    title: '어휘 퀴즈에 도전!',
    desc: '사자성어, 맞춤법, 문법 등 704개 문제를 7초 안에 풀어보세요. XP와 포인트를 획득할 수 있어요.',
  },
  {
    emoji: '🛒',
    title: '포인트로 보상 받기',
    desc: '퀴즈, 후기 작성, 출석 등으로 모은 포인트로 상점에서 아이템을 구매하세요.',
  },
];

export default function OnboardingGuide() {
  const [show, setShow] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [step, setStep] = useState(0);

  if (!show) return null;

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 16, padding: 28,
        maxWidth: 340, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{steps[step].emoji}</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{steps[step].title}</h3>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6, marginBottom: 24 }}>
          {steps[step].desc}
        </p>

        {/* 진행 도트 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === step ? 'var(--primary)' : 'var(--border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={complete} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--card)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
            color: 'var(--muted-foreground)',
          }}>
            건너뛰기
          </button>
          <button onClick={() => step < steps.length - 1 ? setStep(step + 1) : complete()} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: 'var(--primary)', color: 'white', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
          }}>
            {step < steps.length - 1 ? '다음' : '시작하기!'}
          </button>
        </div>
      </div>
    </div>
  );
}
