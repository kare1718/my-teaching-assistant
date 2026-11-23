import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser } from '../api';

const GUIDE_VERSION = 'v1_2026_11';

export function getOmrGuideStorageKey(user) {
  const uid = user?.id || user?.username || 'student';
  return `student_omr_update_guide_${GUIDE_VERSION}_${uid}`;
}

const GUIDE_STEPS = [
  {
    badge: '✨ NEW 업데이트 안내',
    emoji: '📝',
    title: '이제 앱에서 직접 OMR 카드를 입력해요!',
    subtitle: '홈 화면 또는 하단 [성적·OMR] 탭에서 바로 응시',
    points: [
      '선생님이 오픈한 시험이 있으면 홈 화면 상단에 [📝 진행 중인 OMR 시험] 알림 카드가 자동으로 나타나요.',
      '하단 탭바의 [성적·OMR] 메뉴에서도 언제든 응시 가능한 시험과 내 성적을 확인할 수 있어요.',
      '모바일에 최적화된 5문항 단위 OMR 버블로 실수 없이 빠르게 마킹할 수 있습니다.',
    ],
    visual: (
      <div style={{
        padding: '12px 14px', borderRadius: 12, background: 'var(--warm-50, #f8fafc)',
        border: '1px solid var(--warm-200, #e2e8f0)', fontSize: 12, textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 800, color: 'var(--foreground)' }}>📝 주간 모의고사 1회</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'oklch(0.93 0.08 155)', color: 'oklch(0.35 0.14 155)', fontWeight: 700 }}>
            응시 가능
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800 }}>1.</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 12,
                background: n === 3 ? 'var(--accent, #2563eb)' : 'white',
                color: n === 3 ? 'white' : 'var(--foreground)',
                border: n === 3 ? '2px solid var(--accent, #2563eb)' : '1.5px solid #cbd5e1',
              }}>{n}</span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    badge: 'STEP 1 · 시험 응시 & 타이머',
    emoji: '⏱️',
    title: '제한 시간 타이머 & 실시간 자동 저장',
    subtitle: '새로고침해도 남은 시간과 마킹 답안이 유지돼요',
    points: [
      '[✏️ OMR 시험 시작하기]를 누르면 선생님이 설정한 시험 제한 시간(예: 45분) 카운트다운이 시작됩니다.',
      '번호를 누를 때마다 자동 임시 저장되어 화면이 꺼지거나 새로고침해도 마킹한 답안이 사라지지 않아요.',
      '제한 시간이 00:00이 되면 그 시점까지 마킹한 답안으로 안전하게 자동 제출됩니다.',
    ],
    visual: (
      <div style={{
        padding: '10px 14px', borderRadius: 12, background: 'var(--warm-50, #f8fafc)',
        border: '1px solid var(--warm-200, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent, #2563eb)' }}>1차 OMR 응시 중</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>자동 임시저장 완료 · 18/25 마킹</div>
        </div>
        <div style={{
          padding: '6px 12px', borderRadius: 10, background: '#fff7ed',
          border: '1px solid #fed7aa', color: '#ea580c', fontWeight: 900, fontSize: 15
        }}>
          ⏱ 42:18
        </div>
      </div>
    ),
  },
  {
    badge: 'STEP 2 · 1차 결과 & 재제출 대기 시간',
    emoji: '⏳',
    title: '1차 제출 후 오답 확인 & 재제출 쿨타임',
    subtitle: '재제출 전에는 점수·O/X만 공개되고 정답 번호는 비밀!',
    points: [
      '1차 제출 즉시 내 점수와 몇 번 문제를 틀렸는지(O/X)를 바로 확인할 수 있어요.',
      '단, 재제출 기회가 남아 있는 동안에는 실제 정답 번호가 🔒 비공개로 가려집니다.',
      '선생님이 설정한 재제출 대기 시간(쿨타임, 예: 30분) 동안 틀린 문제를 다시 풀어본 뒤 재도전하세요!',
    ],
    visual: (
      <div style={{
        padding: '10px 14px', borderRadius: 12, background: 'var(--warm-50, #f8fafc)',
        border: '1px solid var(--warm-200, #e2e8f0)', fontSize: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 800 }}>1차 점수: <strong style={{ color: 'var(--accent, #2563eb)' }}>75점</strong> (오답 5문항)</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#d97706' }}>⏳ 24:15 후 재제출 가능</span>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {[
            { num: 1, ans: '③', ok: true },
            { num: 2, ans: '②', ok: false },
            { num: 3, ans: '④', ok: true },
          ].map(item => (
            <div key={item.num} style={{
              flex: 1, padding: '6px 4px', borderRadius: 8, textAlign: 'center',
              background: item.ok ? 'oklch(0.95 0.05 160)' : 'oklch(0.95 0.05 25)',
              border: `1px solid ${item.ok ? 'oklch(0.8 0.1 160)' : 'oklch(0.8 0.1 25)'}`,
            }}>
              <div style={{ fontSize: 10, color: '#64748b' }}>{item.num}번 ({item.ok ? 'O' : 'X'})</div>
              <div style={{ fontWeight: 800 }}>{item.ans}</div>
              {!item.ok && <div style={{ fontSize: 9, color: '#d97706', fontWeight: 700 }}>🔒 재제출 후 정답공개</div>}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    badge: 'STEP 3 · 오답 재도전 & 성적 기록',
    emoji: '🔄',
    title: '틀린 문제만 다시 마킹 & 1차·재제출 모두 기록',
    subtitle: '맞힌 문제는 안전하게 잠금! 틀린 문제만 고쳐 제출해요',
    points: [
      '대기 시간이 끝나면 [🔄 틀린 문항 재도전하기] 버튼이 활성화됩니다.',
      '1차에서 맞힌 문항은 [⭕ 정답 잠금]으로 고정되고, 내가 1차에 골랐던 오답 번호도 표시되어 실수를 줄여줘요.',
      '성적표에는 [1차 75점 → 재제출 90점 (+15점)]처럼 두 점수가 모두 기록되며, 최종 완료 후 전체 정답이 공개됩니다!',
    ],
    visual: (
      <div style={{
        padding: '10px 14px', borderRadius: 12, background: 'var(--warm-50, #f8fafc)',
        border: '1px solid var(--warm-200, #e2e8f0)', fontSize: 12, textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.35 0.14 155)' }}>1번 · ⭕ 1차 정답 잠금</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.45 0.15 25)' }}>2번 · ❌ 오답 재도전 (1차 오답: ②)</span>
        </div>
        <div style={{
          padding: '6px 10px', borderRadius: 8, background: 'white', border: '1px solid #e2e8f0',
          textAlign: 'center', fontWeight: 800, color: 'var(--accent, #2563eb)'
        }}>
          📊 성적표 기록: 1차 75점 &rarr; 재제출 90점 (+15점 상승!)
        </div>
      </div>
    ),
  },
];

export default function StudentOmrGuideModal({ forceOpen = false, onClose }) {
  const user = getUser();
  const navigate = useNavigate();
  const location = useLocation();
  const isStudent = user && user.role === 'student' && user.school !== '조교' && user.school !== '선생님';

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setOpen(true);
      return;
    }
    if (!isStudent) return;
    const key = getOmrGuideStorageKey(user);
    if (!localStorage.getItem(key)) {
      setOpen(true);
    }
  }, [forceOpen, isStudent, user?.id]);

  if (!open) return null;

  const markSeenAndClose = () => {
    if (user) {
      try { localStorage.setItem(getOmrGuideStorageKey(user), '1'); } catch {}
    }
    setOpen(false);
    if (onClose) onClose();
  };

  const handleGoToOmr = () => {
    markSeenAndClose();
    if (location.pathname !== '/student/scores') {
      navigate('/student/scores?focus=omr');
    }
  };

  const current = GUIDE_STEPS[step];
  const isLastStep = step === GUIDE_STEPS.length - 1;

  return (
    <div
      onClick={markSeenAndClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.62)',
        zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card, #ffffff)', borderRadius: 20, padding: '22px 20px 18px',
          maxWidth: 420, width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
          border: '1px solid var(--warm-200, #e2e8f0)', position: 'relative',
        }}
      >
        {/* 상단 배지 & 닫기 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20,
            background: 'oklch(0.93 0.06 260)', color: 'var(--accent, #1d4ed8)',
          }}>
            {current.badge} ({step + 1}/{GUIDE_STEPS.length})
          </span>
          <button
            type="button"
            onClick={markSeenAndClose}
            style={{
              background: 'var(--warm-100, #f1f5f9)', border: 'none', borderRadius: '50%',
              width: 28, height: 28, cursor: 'pointer', fontSize: 13, color: 'var(--muted-foreground)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="닫기"
          >
            ✕
          </button>
        </div>

        {/* 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>{current.emoji}</div>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px', color: 'var(--foreground)' }}>
            {current.title}
          </h3>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>
            {current.subtitle}
          </div>
        </div>

        {/* 시각적 예시 박스 */}
        <div style={{ marginBottom: 14 }}>
          {current.visual}
        </div>

        {/* 핵심 사용법 포인트 */}
        <div style={{
          background: 'var(--warm-50, #f8fafc)', borderRadius: 12, padding: '12px 14px',
          marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8
        }}>
          {current.points.map((pt, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.5, color: 'var(--foreground)' }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', background: 'var(--accent, #2563eb)',
                color: 'white', fontSize: 10, fontWeight: 800, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1
              }}>
                {idx + 1}
              </span>
              <span>{pt}</span>
            </div>
          ))}
        </div>

        {/* 스텝 인디케이터 도트 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
          {GUIDE_STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 22 : 8, height: 8, borderRadius: 4, border: 'none',
                background: i === step ? 'var(--accent, #2563eb)' : 'var(--warm-200, #cbd5e1)',
                cursor: 'pointer', transition: 'all 0.2s ease', padding: 0,
              }}
            />
          ))}
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              style={{
                padding: '10px 14px', borderRadius: 10, border: '1px solid var(--warm-200, #cbd5e1)',
                background: 'var(--card, #fff)', color: 'var(--foreground)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              이전
            </button>
          ) : (
            <button
              type="button"
              onClick={markSeenAndClose}
              style={{
                padding: '10px 14px', borderRadius: 10, border: '1px solid var(--warm-200, #cbd5e1)',
                background: 'var(--card, #fff)', color: 'var(--muted-foreground)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              건너뛰기
            </button>
          )}

          {!isLastStep ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                background: 'var(--accent, #2563eb)', color: 'white',
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
              }}
            >
              다음 안내 보기 &rarr;
            </button>
          ) : (
            <div style={{ flex: 1, display: 'flex', gap: 6 }}>
              {location.pathname !== '/student/scores' && (
                <button
                  type="button"
                  onClick={handleGoToOmr}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none',
                    background: 'var(--accent, #2563eb)', color: 'white',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  📝 OMR 화면 이동
                </button>
              )}
              <button
                type="button"
                onClick={markSeenAndClose}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none',
                  background: location.pathname === '/student/scores' ? 'var(--accent, #2563eb)' : 'var(--primary, #102044)',
                  color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                }}
              >
                확인했어요!
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
