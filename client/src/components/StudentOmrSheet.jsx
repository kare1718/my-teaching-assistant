import { useMemo, useRef } from 'react';

const CHOICE_LABELS = ['', '①', '②', '③', '④', '⑤'];

// 깔끔한 화이트 & 딥 네이비 + 저채도 종이 팔레트 (형광색 배제)
const P = {
  navy: '#102044',
  navySoft: '#1E3159',
  navyTint: '#F4F6FA',
  paper: '#FFFFFF',
  paperSub: '#F8F9FB',
  border: '#DCE2EC',
  borderSoft: '#EAEFF5',
  ink: '#141D30',
  text: '#1E293B',
  muted: '#64748B',
  bubbleBorder: '#BCC6D6',
  bubbleText: '#475569',
  // 저채도 상태색 (세이지 / 브릭 / 샌드)
  sageBg: '#F1F6F3',
  sageBorder: '#CADAD1',
  sageText: '#335B48',
  sageFill: '#3D6854',
  brickBg: '#FAF3F3',
  brickBorder: '#E0C8CA',
  brickText: '#913E43',
  sandBg: '#FAF6EE',
  sandBorder: '#E3D5BA',
  sandText: '#7F5C24',
};

const FONT_DISPLAY = "var(--font-display, 'Paperlogy', 'KoPub Dotum', sans-serif)";
const FONT_BODY = "var(--font-body, 'KoPub Dotum', 'Paperlogy', sans-serif)";

function formatDurationMMSS(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function StudentOmrSheet({
  exam,
  markingAnswers,
  onSelectBubble,
  onSubmit,
  onClose,
  isSubmitting,
  remainingSeconds,
  showWrongOnlyFilter,
  onToggleWrongOnlyFilter,
}) {
  const rowRefs = useRef({});

  const numQ = exam.questionCount || 20;
  const numC = exam.choiceCount || 5;
  const locked = exam.lockedQuestions || {};
  const prevWrong = exam.previousWrongAnswers || {};
  const lockedCount = Object.keys(locked).length;
  const isRetryWrongOnly =
    (exam.attemptNum || 1) >= 2 &&
    exam.resubmitMode === 'wrong_only' &&
    lockedCount > 0;

  const pointsByNum = useMemo(() => {
    const map = {};
    (exam.questionMeta || []).forEach((q) => {
      map[q.num] = q.points;
    });
    return map;
  }, [exam.questionMeta]);

  const allQuestions = useMemo(
    () => Array.from({ length: numQ }, (_, i) => i + 1),
    [numQ]
  );

  const unmarkedQuestions = useMemo(
    () => allQuestions.filter((qNum) => locked[qNum] === undefined && !markingAnswers[qNum]),
    [allQuestions, locked, markingAnswers]
  );

  const markedCount = numQ - unmarkedQuestions.length;
  const progressPct = numQ > 0 ? Math.round((markedCount / numQ) * 100) : 0;

  const visibleQuestions = useMemo(
    () => allQuestions.filter((qNum) => !isRetryWrongOnly || !showWrongOnlyFilter || locked[qNum] === undefined),
    [allQuestions, isRetryWrongOnly, showWrongOnlyFilter, locked]
  );

  const questionBlocks = useMemo(() => {
    const blocks = [];
    for (let i = 0; i < visibleQuestions.length; i += 5) {
      blocks.push(visibleQuestions.slice(i, i + 5));
    }
    return blocks;
  }, [visibleQuestions]);

  const totalLimitSec = exam.timeLimitMinutes ? exam.timeLimitMinutes * 60 : null;
  const timerPct =
    totalLimitSec && remainingSeconds !== null
      ? Math.max(0, Math.min(100, (remainingSeconds / totalLimitSec) * 100))
      : 100;
  const isUrgent = remainingSeconds !== null && remainingSeconds <= 60;
  const isWarning = remainingSeconds !== null && remainingSeconds > 60 && remainingSeconds <= 300;

  const scrollToQuestion = (qNum) => {
    const el = rowRefs.current[qNum];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div
      className="omr-sheet-shell"
      style={{
        fontFamily: FONT_BODY,
        background: P.paperSub,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 'var(--space-4)',
        border: `1px solid ${P.border}`,
        boxShadow: '0 4px 16px rgba(16, 32, 68, 0.05)',
      }}
    >
      {/* ── 상단 Deep Navy 헤더 (Paperlogy 타이포그래피) ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: P.navy,
          color: '#FFFFFF',
          padding: '15px 18px 13px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#F1F5F9',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                }}
              >
                {exam.attemptNum}차 {isRetryWrongOnly ? '오답 재도전' : 'OMR 답안지'}
              </span>
              <span style={{ fontSize: 11.5, color: 'rgba(241, 245, 249, 0.68)', fontWeight: 500 }}>
                {numQ}문항 · {numC}지선다 · {exam.maxScore}점 만점
              </span>
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 16.5,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.35,
              }}
            >
              {exam.name}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {remainingSeconds !== null && (
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  padding: '5px 12px',
                  borderRadius: 7,
                  fontWeight: 700,
                  fontSize: 15,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.04em',
                  background: isUrgent
                    ? '#7F2F34'
                    : isWarning
                      ? '#725322'
                      : 'rgba(255, 255, 255, 0.10)',
                  color: '#F8FAFC',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                }}
              >
                {formatDurationMMSS(remainingSeconds)}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                fontFamily: FONT_DISPLAY,
                padding: '6px 11px',
                borderRadius: 7,
                border: '1px solid rgba(255, 255, 255, 0.22)',
                background: 'transparent',
                color: 'rgba(241, 245, 249, 0.85)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              접기
            </button>
          </div>
        </div>

        {/* 마킹 진행률 + 미마킹 이동 */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 160 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(255, 255, 255, 0.16)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: progressPct === 100 ? '#97BDA9' : '#CBD5E1',
                  borderRadius: 999,
                  transition: 'width 0.25s ease',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 12,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: 'rgba(241, 245, 249, 0.9)',
                whiteSpace: 'nowrap',
              }}
            >
              {markedCount} / {numQ} ({progressPct}%)
            </span>
          </div>

          {unmarkedQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToQuestion(unmarkedQuestions[0])}
              style={{
                fontFamily: FONT_DISPLAY,
                padding: '3px 10px',
                borderRadius: 5,
                border: '1px solid rgba(255, 255, 255, 0.22)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#E2E8F0',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              미마킹 {unmarkedQuestions.length} · {unmarkedQuestions[0]}번 이동 ↓
            </button>
          )}
        </div>

        {/* 잔여 시간 얇은 라인 */}
        {remainingSeconds !== null && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'rgba(255,255,255,0.08)' }}>
            <div
              style={{
                width: `${timerPct}%`,
                height: '100%',
                background: isUrgent ? '#C4797D' : isWarning ? '#CEAE78' : '#94A3B8',
                transition: 'width 1s linear',
              }}
            />
          </div>
        )}
      </div>

      {/* ── 빠른 문항 점프 미니맵 ── */}
      <div
        style={{
          padding: '9px 16px',
          background: P.paper,
          borderBottom: `1px solid ${P.borderSoft}`,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 600, color: P.muted, flexShrink: 0, marginRight: 4 }}>
          문항
        </span>
        {allQuestions.map((qNum) => {
          const isLocked = isRetryWrongOnly && locked[qNum] !== undefined;
          const isMarked = !isLocked && Boolean(markingAnswers[qNum]);
          const isPrevWrong = !isLocked && prevWrong[qNum] !== undefined;
          return (
            <button
              key={qNum}
              type="button"
              onClick={() => {
                if (isLocked && showWrongOnlyFilter) onToggleWrongOnlyFilter(false);
                setTimeout(() => scrollToQuestion(qNum), 30);
              }}
              style={{
                fontFamily: FONT_DISPLAY,
                minWidth: 24,
                height: 24,
                padding: '0 4px',
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                flexShrink: 0,
                border: isLocked
                  ? `1px solid ${P.sageBorder}`
                  : isMarked
                    ? `1px solid ${P.ink}`
                    : isPrevWrong
                      ? `1px solid ${P.brickBorder}`
                      : `1px solid ${P.border}`,
                background: isLocked
                  ? P.sageBg
                  : isMarked
                    ? P.ink
                    : isPrevWrong
                      ? P.brickBg
                      : P.paper,
                color: isLocked
                  ? P.sageText
                  : isMarked
                    ? '#FFFFFF'
                    : isPrevWrong
                      ? P.brickText
                      : P.muted,
              }}
              title={`${qNum}번: ${isLocked ? '정답 잠금' : isMarked ? `${markingAnswers[qNum]}번 마킹됨` : '미마킹'}`}
            >
              {isLocked ? '✓' : qNum}
            </button>
          );
        })}
      </div>

      {/* ── 오답 재도전 안내 바 ── */}
      {isRetryWrongOnly && (
        <div
          style={{
            padding: '10px 16px',
            background: P.navyTint,
            borderBottom: `1px solid ${P.borderSoft}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 12.5,
            color: P.navy,
          }}
        >
          <span>
            1차에 맞힌 <strong>{lockedCount}문항은 정답 잠금</strong> 상태이며,{' '}
            <strong>틀린 {numQ - lockedCount}문항</strong>만 다시 마킹합니다.
          </span>
          <label style={{ fontFamily: FONT_DISPLAY, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={showWrongOnlyFilter}
              onChange={(e) => onToggleWrongOnlyFilter(e.target.checked)}
              style={{ accentColor: P.navy }}
            />
            틀린 문항만 보기
          </label>
        </div>
      )}

      {/* ── 깔끔한 화이트 & 네이비 종이 OMR 카드 본문 ── */}
      <div style={{ padding: '14px 14px', maxHeight: '62vh', overflowY: 'auto' }}>
        <div className="omr-card-grid">
          {questionBlocks.map((block, bIdx) => {
            const firstQ = block[0];
            const lastQ = block[block.length - 1];
            return (
              <div
                key={bIdx}
                style={{
                  background: P.paper,
                  borderRadius: 10,
                  border: `1px solid ${P.border}`,
                  overflow: 'hidden',
                }}
              >
                {/* 블록 헤더 */}
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 12px',
                    background: P.navyTint,
                    borderBottom: `1px solid ${P.border}`,
                    color: P.navySoft,
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ letterSpacing: '0.02em' }}>
                    {String(firstQ).padStart(2, '0')} — {String(lastQ).padStart(2, '0')}
                  </span>
                  <div style={{ display: 'flex', gap: 8, paddingRight: 1, fontSize: 11, color: P.muted }}>
                    {Array.from({ length: numC }, (_, i) => i + 1).map((c) => (
                      <span key={c} style={{ width: 30, textAlign: 'center' }}>
                        {CHOICE_LABELS[c]}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 문항 행 */}
                <div>
                  {block.map((qNum, rowIdx) => {
                    const isLocked = isRetryWrongOnly && locked[qNum] !== undefined;
                    const selectedChoice = isLocked ? Number(locked[qNum]) : Number(markingAnswers[qNum] || 0);
                    const prevWrongChoice = prevWrong[qNum] !== undefined ? Number(prevWrong[qNum]) : null;
                    const qPoints = pointsByNum[qNum];

                    return (
                      <div
                        key={qNum}
                        ref={(el) => {
                          rowRefs.current[qNum] = el;
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 12px 7px 8px',
                          borderBottom: rowIdx < block.length - 1 ? `1px solid ${P.borderSoft}` : 'none',
                          background: isLocked
                            ? P.sageBg
                            : rowIdx % 2 === 1
                              ? '#FAFBFD'
                              : P.paper,
                          transition: 'background 0.12s ease',
                        }}
                      >
                        {/* 좌측 타이밍 마크 + 문번 + 상태 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span
                            aria-hidden="true"
                            style={{
                              width: 3.5,
                              height: 12,
                              borderRadius: 1,
                              background: selectedChoice ? P.ink : '#D6DDE8',
                              flexShrink: 0,
                              transition: 'background 0.15s ease',
                            }}
                          />
                          <div
                            style={{
                              fontFamily: FONT_DISPLAY,
                              width: 28,
                              height: 25,
                              borderRadius: 5,
                              background: isLocked
                                ? '#E2EDE7'
                                : prevWrongChoice
                                  ? P.brickBg
                                  : P.navyTint,
                              color: isLocked
                                ? P.sageText
                                : prevWrongChoice
                                  ? P.brickText
                                  : P.navySoft,
                              fontWeight: 700,
                              fontSize: 12.5,
                              fontVariantNumeric: 'tabular-nums',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {qNum}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                            {exam.scoringType === 'individual' && qPoints !== undefined && (
                              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10.5, color: P.muted, fontWeight: 500 }}>
                                {qPoints}점
                              </span>
                            )}
                            {isLocked && (
                              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10.5, color: P.sageText, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                정답 잠금
                              </span>
                            )}
                            {!isLocked && prevWrongChoice && (
                              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10.5, color: P.brickText, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                1차 {CHOICE_LABELS[prevWrongChoice]}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 세로 타원형 OMR 마킹 버블 */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {Array.from({ length: numC }, (_, i) => i + 1).map((choiceNum) => {
                            const isSelected = selectedChoice === choiceNum;
                            const wasPrevWrong = !isLocked && prevWrongChoice === choiceNum;
                            return (
                              <button
                                key={choiceNum}
                                type="button"
                                disabled={isLocked}
                                onClick={() => onSelectBubble(qNum, choiceNum)}
                                className="omr-oval-btn"
                                style={{
                                  fontFamily: FONT_DISPLAY,
                                  width: 30,
                                  height: 36,
                                  borderRadius: 999,
                                  border: isSelected
                                    ? `1.5px solid ${isLocked ? P.sageFill : P.ink}`
                                    : wasPrevWrong
                                      ? `1.5px dashed ${P.brickBorder}`
                                      : `1.5px solid ${P.bubbleBorder}`,
                                  background: isSelected
                                    ? isLocked
                                      ? P.sageFill
                                      : P.ink
                                    : wasPrevWrong
                                      ? P.brickBg
                                      : P.paper,
                                  color: isSelected
                                    ? '#FFFFFF'
                                    : wasPrevWrong
                                      ? P.brickText
                                      : P.bubbleText,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: isLocked ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  textDecoration: wasPrevWrong && !isSelected ? 'line-through' : 'none',
                                  transition: 'transform 0.1s ease, background 0.12s ease, border-color 0.12s ease',
                                }}
                                title={
                                  isLocked
                                    ? `${qNum}번: 1차 정답 확정 (${choiceNum}번)`
                                    : wasPrevWrong
                                      ? `1차에서 틀렸던 선택지 (${choiceNum}번)`
                                      : `${qNum}번 문항 ${choiceNum}번 마킹`
                                }
                              >
                                {choiceNum}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 하단 제출 푸터 ── */}
      <div
        style={{
          padding: '12px 18px',
          background: P.paper,
          borderTop: `1px solid ${P.borderSoft}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 12.5, color: P.muted }}>
          <span style={{ color: P.text, fontWeight: 500 }}>자동 임시저장 중</span>
          <span style={{ marginLeft: 10 }}>
            미마킹{' '}
            <strong style={{ fontFamily: FONT_DISPLAY, color: unmarkedQuestions.length > 0 ? P.brickText : P.sageText }}>
              {unmarkedQuestions.length}문항
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          style={{
            fontFamily: FONT_DISPLAY,
            padding: '10px 22px',
            borderRadius: 8,
            border: 'none',
            background: P.navy,
            color: '#FFFFFF',
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? '채점 및 제출 중...' : `${exam.attemptNum}차 OMR 답안 제출`}
        </button>
      </div>

      <style>{`
        .omr-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 780px) {
          .omr-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .omr-oval-btn:not(:disabled):active {
          transform: scale(0.92);
        }
        .omr-oval-btn:not(:disabled):hover {
          border-color: ${P.navy} !important;
        }
      `}</style>
    </div>
  );
}
