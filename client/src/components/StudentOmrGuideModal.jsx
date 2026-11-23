import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser } from '../api';

const GUIDE_VERSION = 'v1_2026_11';

export function getOmrGuideStorageKey(user) {
  const uid = user?.id || user?.username || 'student';
  return `student_omr_update_guide_${GUIDE_VERSION}_${uid}`;
}

const P = {
  navy: '#102044',
  navySoft: '#1E3159',
  navyTint: '#F4F6FA',
  ink: '#141D30',
  border: '#DCE2EC',
  borderSoft: '#EAEFF5',
  muted: '#64748B',
  sageBg: '#F1F6F3',
  sageBorder: '#CADAD1',
  sageText: '#335B48',
  brickBg: '#FAF3F3',
  brickBorder: '#E0C8CA',
  brickText: '#913E43',
  sandBg: '#FAF6EE',
  sandBorder: '#E3D5BA',
  sandText: '#7F5C24',
};

const FONT_DISPLAY = "var(--font-display, 'Paperlogy', 'KoPub Dotum', sans-serif)";
const FONT_BODY = "var(--font-body, 'KoPub Dotum', 'Paperlogy', sans-serif)";

const GUIDE_STEPS = [
  {
    badge: 'UPDATE · 01',
    title: '이제 앱에서 직접 OMR 카드를 입력해요',
    subtitle: '홈 화면 또는 하단 [성적·OMR] 탭에서 바로 응시할 수 있습니다.',
    points: [
      '선생님이 시험을 열면 홈 화면 상단에 진행 중인 OMR 시험 카드가 자동으로 표시됩니다.',
      '하단 [성적·OMR] 메뉴에서도 언제든 응시 가능한 시험과 성적을 함께 확인할 수 있습니다.',
      '5문항 단위로 구분된 세로 타원형 답안지로 밀려 쓰기 없이 차분하게 마킹할 수 있습니다.',
    ],
    visual: (
      <div style={{
        borderRadius: 10, background: '#FFFFFF', overflow: 'hidden',
        border: `1px solid ${P.border}`, fontSize: 12, textAlign: 'left', fontFamily: FONT_BODY
      }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 12px', background: P.navyTint, borderBottom: `1px solid ${P.border}`, color: P.navySoft
        }}>
          <span style={{ fontWeight: 600 }}>주간 모의고사 1회 · OMR 답안지</span>
          <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 4, background: P.sageBg, color: P.sageText, border: `1px solid ${P.sageBorder}`, fontWeight: 600 }}>
            응시 가능
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 3.5, height: 11, borderRadius: 1, background: P.ink }} />
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, color: P.navySoft, background: P.navyTint, padding: '2px 7px', borderRadius: 4 }}>1</span>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} style={{
                fontFamily: FONT_DISPLAY,
                width: 26, height: 32, borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600, fontSize: 12,
                background: n === 3 ? P.ink : '#FFFFFF',
                color: n === 3 ? '#FFFFFF' : '#475569',
                border: n === 3 ? `1.5px solid ${P.ink}` : '1.5px solid #BCC6D6',
              }}>{n}</span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    badge: 'STEP 01 · 응시 타이머',
    title: '제한 시간 타이머 & 실시간 자동 저장',
    subtitle: '새로고침해도 남은 시간과 마킹 답안이 유지됩니다.',
    points: [
      '[OMR 시험 시작]을 누르면 설정된 시험 제한 시간(예: 45분) 카운트다운이 시작됩니다.',
      '번호를 누를 때마다 자동 임시 저장되어 화면이 꺼지거나 새로고침해도 마킹이 사라지지 않습니다.',
      '제한 시간이 00:00이 되면 그 시점까지 마킹한 답안으로 안전하게 자동 제출됩니다.',
    ],
    visual: (
      <div style={{
        padding: '10px 14px', borderRadius: 10, background: '#FFFFFF',
        border: `1px solid ${P.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 11.5, fontWeight: 600, color: P.navy }}>1차 OMR 응시 중</div>
          <div style={{ fontSize: 12, color: P.muted }}>자동 임시저장 · 18 / 25 마킹</div>
        </div>
        <div style={{
          fontFamily: FONT_DISPLAY,
          padding: '5px 12px', borderRadius: 7, background: P.navy,
          color: '#F8FAFC', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums'
        }}>
          42:18
        </div>
      </div>
    ),
  },
  {
    badge: 'STEP 02 · 1차 결과 & 쿨타임',
    title: '1차 제출 후 오답 확인 & 재제출 대기',
    subtitle: '재제출 전에는 점수·O/X만 공개되고 정답 번호는 비공개입니다.',
    points: [
      '1차 제출 즉시 내 점수와 문항별 정오(O/X)를 바로 확인할 수 있습니다.',
      '재제출 기회가 남아 있는 동안에는 실제 정답 번호가 비공개로 가려집니다.',
      '설정된 재제출 대기 시간(쿨타임) 동안 틀린 문제를 다시 풀어본 뒤 재도전하세요.',
    ],
    visual: (
      <div style={{
        padding: '10px 12px', borderRadius: 10, background: '#FFFFFF',
        border: `1px solid ${P.border}`, fontSize: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, color: P.navy }}>1차 점수 <strong>75점</strong> (오답 5문항)</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 600, color: P.sandText, background: P.sandBg, border: `1px solid ${P.sandBorder}`, padding: '2px 7px', borderRadius: 5 }}>
            24:15 대기
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {[
            { num: 1, ans: '③', ok: true },
            { num: 2, ans: '②', ok: false },
            { num: 3, ans: '④', ok: true },
          ].map(item => (
            <div key={item.num} style={{
              flex: 1, padding: '6px 4px', borderRadius: 7, textAlign: 'center',
              background: item.ok ? P.sageBg : P.brickBg,
              border: `1px solid ${item.ok ? P.sageBorder : P.brickBorder}`,
            }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 10.5, color: P.muted }}>{item.num}번 ({item.ok ? 'O' : 'X'})</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, color: item.ok ? P.sageText : P.brickText }}>{item.ans}</div>
              {!item.ok && <div style={{ fontSize: 10, color: P.sandText, fontWeight: 600 }}>재제출 후 공개</div>}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    badge: 'STEP 03 · 오답 재도전',
    title: '틀린 문제만 재마킹 & 1차·재제출 모두 기록',
    subtitle: '맞힌 문제는 잠금 유지 · 성적표에 두 점수가 모두 기록됩니다.',
    points: [
      '대기 시간이 끝나면 [틀린 문항 재도전] 버튼이 활성화됩니다.',
      '1차에서 맞힌 문항은 정답 잠금으로 고정되고, 1차에 골랐던 오답 번호는 취소선으로 표시됩니다.',
      '성적표에는 [1차 75점 → 재제출 90점]처럼 두 점수가 모두 남으며 최종 완료 후 정답이 공개됩니다.',
    ],
    visual: (
      <div style={{
        padding: '10px 12px', borderRadius: 10, background: '#FFFFFF',
        border: `1px solid ${P.border}`, fontSize: 12, textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 600, color: P.sageText }}>1번 · 정답 잠금</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 600, color: P.brickText }}>2번 · 재도전 (1차 ②)</span>
        </div>
        <div style={{
          fontFamily: FONT_DISPLAY,
          padding: '7px 10px', borderRadius: 7, background: P.navyTint, border: `1px solid ${P.border}`,
          textAlign: 'center', fontWeight: 600, color: P.navy
        }}>
          성적표 기록 · 1차 75점 &rarr; 재제출 90점 (+15점)
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
        position: 'fixed', inset: 0, background: 'rgba(16, 32, 68, 0.45)',
        zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          fontFamily: FONT_BODY,
          background: '#FFFFFF', borderRadius: 16, padding: '22px 20px 18px',
          maxWidth: 420, width: '100%', boxShadow: '0 18px 40px rgba(16, 32, 68, 0.16)',
          border: `1px solid ${P.border}`, position: 'relative',
        }}
      >
        {/* 상단 배지 & 닫기 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5,
            background: P.navyTint, color: P.navy, border: `1px solid ${P.border}`,
            letterSpacing: '0.02em',
          }}>
            {current.badge} · {step + 1}/{GUIDE_STEPS.length}
          </span>
          <button
            type="button"
            onClick={markSeenAndClose}
            style={{
              background: P.navyTint, border: 'none', borderRadius: '50%',
              width: 28, height: 28, cursor: 'pointer', fontSize: 12, color: P.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="닫기"
          >
            ✕
          </button>
        </div>

        {/* 타이틀 */}
        <div style={{ marginBottom: 14 }}>
          <h3 style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 17.5, fontWeight: 700, margin: '0 0 5px', color: P.navy,
            letterSpacing: '-0.02em', lineHeight: 1.35,
          }}>
            {current.title}
          </h3>
          <div style={{ fontSize: 12.5, color: P.muted, lineHeight: 1.5 }}>
            {current.subtitle}
          </div>
        </div>

        {/* 시각적 예시 박스 */}
        <div style={{ marginBottom: 14 }}>
          {current.visual}
        </div>

        {/* 핵심 사용법 포인트 */}
        <div style={{
          background: '#F8F9FB', borderRadius: 10, padding: '12px 14px',
          border: `1px solid ${P.borderSoft}`,
          marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 9
        }}>
          {current.points.map((pt, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12.5, lineHeight: 1.55, color: '#1E293B' }}>
              <span style={{
                fontFamily: FONT_DISPLAY,
                width: 18, height: 18, borderRadius: '50%', background: P.navy,
                color: '#FFFFFF', fontSize: 10, fontWeight: 600, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 2
              }}>
                {idx + 1}
              </span>
              <span>{pt}</span>
            </div>
          ))}
        </div>

        {/* 스텝 인디케이터 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
          {GUIDE_STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 4, border: 'none',
                background: i === step ? P.navy : '#CBD5E1',
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
                fontFamily: FONT_DISPLAY,
                padding: '10px 14px', borderRadius: 8, border: `1px solid ${P.border}`,
                background: '#FFFFFF', color: P.navy,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              이전
            </button>
          ) : (
            <button
              type="button"
              onClick={markSeenAndClose}
              style={{
                fontFamily: FONT_DISPLAY,
                padding: '10px 14px', borderRadius: 8, border: `1px solid ${P.border}`,
                background: '#FFFFFF', color: P.muted,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
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
                fontFamily: FONT_DISPLAY,
                flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
                background: P.navy, color: '#FFFFFF',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              다음 안내 &rarr;
            </button>
          ) : (
            <div style={{ flex: 1, display: 'flex', gap: 6 }}>
              {location.pathname !== '/student/scores' && (
                <button
                  type="button"
                  onClick={handleGoToOmr}
                  style={{
                    fontFamily: FONT_DISPLAY,
                    flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${P.navy}`,
                    background: '#FFFFFF', color: P.navy,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  OMR 이동
                </button>
              )}
              <button
                type="button"
                onClick={markSeenAndClose}
                style={{
                  fontFamily: FONT_DISPLAY,
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: P.navy, color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
