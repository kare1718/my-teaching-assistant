import { useMemo, useRef } from 'react';

const CHOICE_LABELS = ['', '①', '②', '③', '④', '⑤'];

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

  // 5문항 단위로 실제 OMR 블록 묶기
  const questionBlocks = useMemo(() => {
    const blocks = [];
    for (let i = 0; i < visibleQuestions.length; i += 5) {
      blocks.push(visibleQuestions.slice(i, i + 5));
    }
    return blocks;
  }, [visibleQuestions]);

  // 타이머 잔여 비율
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
        background: '#fcfbf9',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 'var(--space-4)',
        border: '1.5px solid #cbd5e1',
        boxShadow: '0 10px 30px rgba(16, 32, 68, 0.10)',
      }}
    >
      {/* ── 상단 Deep Navy 시험 헤더 (Sticky) ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: '#102044',
          color: '#ffffff',
          padding: '14px 16px 12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: isRetryWrongOnly ? '#7c3aed' : '#2563eb',
                  color: '#ffffff',
                }}
              >
                {exam.attemptNum}차 {isRetryWrongOnly ? '오답 재도전 OMR' : 'OMR 답안카드'}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>
                {numQ}문항 · {numC}지선다 · {exam.maxScore}점 만점
              </span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
              {exam.name}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 실시간 카운트다운 타이머 */}
            {remainingSeconds !== null && (
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: 10,
                  fontWeight: 900,
                  fontSize: 16,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.02em',
                  background: isUrgent
                    ? '#dc2626'
                    : isWarning
                      ? '#d97706'
                      : 'rgba(255,255,255,0.14)',
                  color: '#ffffff',
                  border: isUrgent
                    ? '1px solid #fca5a5'
                    : isWarning
                      ? '1px solid #fcd34d'
                      : '1px solid rgba(255,255,255,0.2)',
                  animation: isUrgent ? 'omrPulse 1s ease-in-out infinite' : 'none',
                }}
              >
                ⏱ {formatDurationMMSS(remainingSeconds)}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.9)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              접기
            </button>
          </div>
        </div>

        {/* 마킹 진행률 + 미마킹 점프 바 */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: progressPct === 100 ? '#34d399' : '#60a5fa',
                  borderRadius: 999,
                  transition: 'width 0.25s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {markedCount} / {numQ} 마킹 ({progressPct}%)
            </span>
          </div>

          {unmarkedQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToQuestion(unmarkedQuestions[0])}
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid rgba(252,165,165,0.55)',
                background: 'rgba(220,38,38,0.22)',
                color: '#fecaca',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              미마킹 {unmarkedQuestions.length}개 · {unmarkedQuestions[0]}번 이동 &darr;
            </button>
          )}
        </div>

        {/* 타이머 잔여 프로그레스 라인 */}
        {remainingSeconds !== null && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.1)' }}>
            <div
              style={{
                width: `${timerPct}%`,
                height: '100%',
                background: isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#38bdf8',
                transition: 'width 1s linear',
              }}
            />
          </div>
        )}
      </div>

      {/* ── 빠른 문항 점프 미니맵 스트립 ── */}
      <div
        style={{
          padding: '8px 14px',
          background: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', flexShrink: 0, marginRight: 4 }}>
          문항 이동
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
                minWidth: 24,
                height: 24,
                padding: '0 4px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                flexShrink: 0,
                border: isLocked
                  ? '1px solid #86efac'
                  : isMarked
                    ? '1px solid #141824'
                    : isPrevWrong
                      ? '1px solid #fca5a5'
                      : '1px solid #cbd5e1',
                background: isLocked
                  ? '#dcfce7'
                  : isMarked
                    ? '#141824'
                    : isPrevWrong
                      ? '#fef2f2'
                      : '#ffffff',
                color: isLocked
                  ? '#15803d'
                  : isMarked
                    ? '#ffffff'
                    : isPrevWrong
                      ? '#dc2626'
                      : '#64748b',
              }}
              title={`${qNum}번: ${isLocked ? '정답 잠금' : isMarked ? `${markingAnswers[qNum]}번 마킹됨` : '미마킹'}`}
            >
              {isLocked ? '✓' : qNum}
            </button>
          );
        })}
      </div>

      {/* ── 오답 재도전 전용 안내 바 ── */}
      {isRetryWrongOnly && (
        <div
          style={{
            padding: '10px 16px',
            background: '#f5f3ff',
            borderBottom: '1px solid #ddd6fe',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 12,
            color: '#4c1d95',
          }}
        >
          <span>
            🔒 1차에 맞힌 <strong>{lockedCount}문항은 정답 잠금</strong> 상태예요.{' '}
            <strong>틀린 {numQ - lockedCount}문항</strong>만 다시 마킹하세요!
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 800 }}>
            <input
              type="checkbox"
              checked={showWrongOnlyFilter}
              onChange={(e) => onToggleWrongOnlyFilter(e.target.checked)}
              style={{ accentColor: '#7c3aed' }}
            />
            틀린 문항만 모아보기
          </label>
        </div>
      )}

      {/* ── 실제 OMR 카드 용지 본문 (컴퓨터용 사인펜 마킹감 + 5문항 블록 + 타이밍 마크) ── */}
      <div style={{ padding: '14px 12px', maxHeight: '62vh', overflowY: 'auto' }}>
        <div className="omr-card-grid">
          {questionBlocks.map((block, bIdx) => {
            const firstQ = block[0];
            const lastQ = block[block.length - 1];
            return (
              <div
                key={bIdx}
                style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  border: '1.5px solid #e7b8be',
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                }}
              >
                {/* OMR 블록 헤더 (실제 답안지 인쇄 느낌의 코랄 레드 톤) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    background: '#fdf2f4',
                    borderBottom: '1.5px solid #e7b8be',
                    color: '#9f1239',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  <span style={{ letterSpacing: '0.04em' }}>
                    문번 {String(firstQ).padStart(2, '0')} ~ {String(lastQ).padStart(2, '0')}
                  </span>
                  <div style={{ display: 'flex', gap: 10, paddingRight: 4, fontSize: 11, opacity: 0.85 }}>
                    {Array.from({ length: numC }, (_, i) => i + 1).map((c) => (
                      <span key={c} style={{ width: 28, textAlign: 'center' }}>
                        {CHOICE_LABELS[c]}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 문항 행들 */}
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
                          padding: '7px 12px 7px 6px',
                          borderBottom: rowIdx < block.length - 1 ? '1px solid #f5dfe2' : 'none',
                          background: isLocked
                            ? '#f0fdf4'
                            : selectedChoice
                              ? '#f8fafc'
                              : rowIdx % 2 === 1
                                ? '#fffafb'
                                : '#ffffff',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* 좌측 타이밍 마크(▪) + 문항 번호 + 배점/상태 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          {/* 실제 OMR 스캔 타이밍 마크 */}
                          <span
                            aria-hidden="true"
                            style={{
                              width: 5,
                              height: 12,
                              borderRadius: 1,
                              background: selectedChoice ? '#141824' : '#cbd5e1',
                              flexShrink: 0,
                              transition: 'background 0.15s ease',
                            }}
                          />
                          <div
                            style={{
                              width: 30,
                              height: 26,
                              borderRadius: 6,
                              background: isLocked ? '#dcfce7' : prevWrongChoice ? '#fee2e2' : '#fdf2f4',
                              color: isLocked ? '#15803d' : prevWrongChoice ? '#b91c1c' : '#9f1239',
                              fontWeight: 800,
                              fontSize: 13,
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
                              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                                {qPoints}점
                              </span>
                            )}
                            {isLocked && (
                              <span style={{ fontSize: 10, color: '#15803d', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                ⭕ 정답 잠금
                              </span>
                            )}
                            {!isLocked && prevWrongChoice && (
                              <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                1차오답 {CHOICE_LABELS[prevWrongChoice]}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 세로 타원형 OMR 버블 (실제 컴퓨터용 사인펜 마킹 느낌) */}
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
                                  width: 30,
                                  height: 38,
                                  borderRadius: 999,
                                  border: isSelected
                                    ? `2px solid ${isLocked ? '#16a34a' : '#141824'}`
                                    : wasPrevWrong
                                      ? '1.5px dashed #ef4444'
                                      : '1.5px solid #df8c96',
                                  background: isSelected
                                    ? isLocked
                                      ? '#16a34a'
                                      : '#141824'
                                    : wasPrevWrong
                                      ? '#fef2f2'
                                      : '#ffffff',
                                  color: isSelected
                                    ? '#ffffff'
                                    : wasPrevWrong
                                      ? '#dc2626'
                                      : '#be123c',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  cursor: isLocked ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  boxShadow: isSelected
                                    ? 'inset 0 2px 4px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.12)'
                                    : 'none',
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
          padding: '12px 16px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 12, color: '#475569' }}>
          <span style={{ fontWeight: 700, color: '#102044' }}>💾 자동 임시저장 중</span>
          <span style={{ marginLeft: 8 }}>
            미마킹:{' '}
            <strong style={{ color: unmarkedQuestions.length > 0 ? '#dc2626' : '#16a34a' }}>
              {unmarkedQuestions.length}문항
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          style={{
            padding: '11px 24px',
            borderRadius: 10,
            border: 'none',
            background: '#102044',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 32, 68, 0.22)',
            opacity: isSubmitting ? 0.65 : 1,
          }}
        >
          {isSubmitting ? '채점 및 제출 중...' : `✒️ ${exam.attemptNum}차 OMR 답안 제출하기`}
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
          transform: scale(0.9);
        }
        .omr-oval-btn:not(:disabled):hover {
          border-color: #102044 !important;
        }
        @keyframes omrPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.72; }
        }
      `}</style>
    </div>
  );
}
