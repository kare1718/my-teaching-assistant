import { useState, useRef, useEffect } from 'react';

const CHOICE_SYMBOLS = ['', '①', '②', '③', '④', '⑤'];
const FONT_D = "var(--font-display, 'Paperlogy', 'KoPub Dotum', sans-serif)";
const FONT_B = "var(--font-body, 'KoPub Dotum', 'Paperlogy', sans-serif)";

const PALETTE = {
  navy: '#102044',
  ink: '#141D30',
  navySub: '#1E3159',
  surface: '#F8F9FB',
  headerBg: '#F4F6FA',
  white: '#FFFFFF',
  border: '#DCE2EC',
  borderSoft: '#EAEFF5',
  text: '#1E293B',
  muted: '#64748B',
  mutedLight: '#94A3B8',
  sageText: '#335B48',
  sageFill: '#3D6854',
  sageBg: '#F1F6F3',
  sageBorder: '#CADAD1',
  brickText: '#913E43',
  brickBg: '#FAF3F3',
  brickBorder: '#E0C8CA',
  sandText: '#7F5C24',
  sandBg: '#FAF6EE',
  sandBorder: '#E3D5BA',
};

function formatChoice(val) {
  if (val === undefined || val === null || val === '') return '-';
  const num = Number(val);
  return CHOICE_SYMBOLS[num] || String(val);
}

/**
 * 학생 OMR 채점 결과 카드
 * - 상단: 점수 요약
 * - 중단: 빠른 정답 (문항별 O/X·정답 요약, 문항 클릭 시 하단 해설로 부드럽게 이동)
 * - 하단: 정답과 해설 (전체 / 틀린 문항 / 해설 있음 필터 + 빠른 정답으로 복귀 버튼)
 * - 재제출 대기 중(canRevealAnswers=false)에는 정답 번호와 해설을 서버·UI 모두 비공개 유지
 */
export default function StudentOmrResult({ data, maxScore = 100 }) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'wrong' | 'explained'
  const [highlightedQ, setHighlightedQ] = useState(null);
  const [hoveredQ, setHoveredQ] = useState(null);

  const quickAnswerRef = useRef(null);
  const lockedNoticeRef = useRef(null);
  const expRefs = useRef({});
  const highlightTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  if (!data || !Array.isArray(data.results) || data.results.length === 0) return null;

  const results = data.results;
  const questionCount = data.questionCount || results.length;
  const correctCount = data.correctCount ?? results.filter(r => r.isCorrect).length;
  const wrongCount = Math.max(0, results.length - correctCount);
  const percentage = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;
  const canReveal = Boolean(data.canRevealAnswers);
  const hasRetest = (data.attemptCount || 1) >= 2 && data.firstScore !== null && data.firstScore !== undefined;
  const explainedCount = results.filter(r => Boolean(r.hasExplanation || (r.explanation && r.explanation.trim()))).length;

  const visibleExplanations = results.filter(r => {
    if (filterMode === 'wrong') return !r.isCorrect;
    if (filterMode === 'explained') return Boolean(r.hasExplanation || (r.explanation && r.explanation.trim()));
    return true;
  });

  const scrollToExplanation = (qNum) => {
    if (!canReveal) {
      if (lockedNoticeRef.current) {
        lockedNoticeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setHighlightedQ(qNum);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightedQ(null), 1600);
      return;
    }

    const isCurrentlyVisible = visibleExplanations.some(r => (r.num || r.questionNum) === qNum);
    if (!isCurrentlyVisible) {
      setFilterMode('all');
    }

    const doScroll = () => {
      const el = expRefs.current[qNum];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setHighlightedQ(qNum);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightedQ(null), 2200);
    };

    if (!isCurrentlyVisible) {
      setTimeout(doScroll, 40);
    } else {
      doScroll();
    }
  };

  const scrollBackToQuickAnswer = () => {
    if (quickAnswerRef.current) {
      quickAnswerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={{
      fontFamily: FONT_B,
      marginTop: 'var(--space-3)',
      padding: 14,
      background: PALETTE.surface,
      borderRadius: 10,
      border: `1px solid ${PALETTE.border}`,
    }}>
      {/* 1. 점수 요약 헤더 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        marginBottom: 14, padding: '11px 14px',
        background: PALETTE.white, borderRadius: 8, border: `1px solid ${PALETTE.borderSoft}`,
      }}>
        <div>
          {hasRetest ? (
            <div style={{ fontFamily: FONT_D, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: PALETTE.muted }}>1차 <strong>{data.firstScore}점</strong></span>
              <span style={{ color: PALETTE.mutedLight }}>&rarr;</span>
              <span style={{ color: PALETTE.navy, fontSize: 15.5 }}>
                재제출 <strong>{data.score}점</strong> / {maxScore}점
              </span>
              {data.score - data.firstScore >= 0 && (
                <span style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: 4,
                  background: PALETTE.sageBg, color: PALETTE.sageText, border: `1px solid ${PALETTE.sageBorder}`, fontWeight: 600
                }}>
                  +{Math.round((data.score - data.firstScore) * 10) / 10}점
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontFamily: FONT_D, fontSize: 14.5, fontWeight: 600, color: PALETTE.navy }}>
              점수 <span style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{data.score ?? '-'}</span>
              <span style={{ color: PALETTE.muted, fontWeight: 500 }}> / {maxScore}점</span>
            </div>
          )}
          <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 3 }}>
            정답 <strong style={{ fontFamily: FONT_D, color: PALETTE.navy }}>{correctCount}</strong> / {questionCount}문항 ({percentage}%)
            {wrongCount > 0 && (
              <span style={{ marginLeft: 8, color: PALETTE.brickText }}>
                · 오답 <strong style={{ fontFamily: FONT_D }}>{wrongCount}문항</strong>
              </span>
            )}
            {!canReveal && (
              <span style={{ marginLeft: 8, color: PALETTE.sandText, fontWeight: 600 }}>
                · 정답과 해설은 재제출 완료 후 공개됩니다
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 92, height: 6, background: PALETTE.borderSoft, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              width: `${percentage}%`, height: '100%', borderRadius: 999,
              background: percentage >= 80 ? PALETTE.sageFill : percentage >= 50 ? '#9B7635' : PALETTE.brickText,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: PALETTE.navy, fontVariantNumeric: 'tabular-nums' }}>
            {percentage}%
          </span>
        </div>
      </div>

      {/* 2. 빠른 정답 섹션 */}
      <div
        ref={quickAnswerRef}
        style={{
          background: PALETTE.white,
          borderRadius: 9,
          border: `1px solid ${PALETTE.border}`,
          overflow: 'hidden',
          marginBottom: 14,
          scrollMarginTop: 16,
        }}
      >
        <div style={{
          padding: '9px 13px',
          background: PALETTE.headerBg,
          borderBottom: `1px solid ${PALETTE.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT_D, fontSize: 13.5, fontWeight: 700, color: PALETTE.navy }}>
              빠른 정답
            </span>
            <span style={{ fontSize: 11.5, color: PALETTE.muted }}>
              {canReveal
                ? '문항을 클릭하면 아래 정답과 해설로 이동합니다'
                : '재제출 전에는 내 답과 O/X만 표시됩니다'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT_D, fontSize: 11, color: PALETTE.muted }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: PALETTE.sageFill }} />
              정답 {correctCount}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: PALETTE.brickText }} />
              오답 {wrongCount}
            </span>
          </div>
        </div>

        {/* 빠른 정답 클릭 그리드 (5문항 단위 정돈된 표 형태) */}
        <div style={{
          padding: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(74px, 1fr))',
          gap: 6,
        }}>
          {results.map(r => {
            const qNum = r.num || r.questionNum;
            const changedOnRetry = r.firstStudent !== undefined && r.firstStudent !== '' && String(r.firstStudent) !== String(r.student);
            const hasExp = Boolean(r.hasExplanation || (r.explanation && r.explanation.trim()));
            const isHovered = hoveredQ === qNum;

            return (
              <button
                key={qNum}
                type="button"
                onClick={() => scrollToExplanation(qNum)}
                onMouseEnter={() => setHoveredQ(qNum)}
                onMouseLeave={() => setHoveredQ(null)}
                title={canReveal ? `${qNum}번 정답과 해설 보기` : `${qNum}번 결과`}
                style={{
                  textAlign: 'left',
                  padding: '7px 8px',
                  borderRadius: 7,
                  background: r.isCorrect ? PALETTE.sageBg : PALETTE.brickBg,
                  border: isHovered
                    ? `1.5px solid ${PALETTE.navy}`
                    : `1px solid ${r.isCorrect ? PALETTE.sageBorder : PALETTE.brickBorder}`,
                  cursor: 'pointer',
                  transition: 'border-color 0.12s ease, transform 0.1s ease, box-shadow 0.12s ease',
                  boxShadow: isHovered ? '0 2px 6px rgba(16, 32, 68, 0.08)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minHeight: 62,
                }}
              >
                {/* 상단: 문항 번호 + O/X */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{
                    fontFamily: FONT_D, fontSize: 11, fontWeight: 700,
                    color: PALETTE.navySub, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {String(qNum).padStart(2, '0')}
                  </span>
                  <span style={{
                    fontFamily: FONT_D, fontSize: 10.5, fontWeight: 700,
                    color: r.isCorrect ? PALETTE.sageText : PALETTE.brickText,
                  }}>
                    {r.isCorrect ? 'O' : 'X'}
                  </span>
                </div>

                {/* 중단: 빠른 정답 번호 / 내 답 */}
                {canReveal ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{
                      fontFamily: FONT_D, fontSize: 16, fontWeight: 700, lineHeight: 1.2,
                      color: r.isCorrect ? PALETTE.sageText : PALETTE.navy,
                    }}>
                      {formatChoice(r.correct)}
                    </span>
                    {!r.isCorrect && (
                      <span style={{
                        fontFamily: FONT_D, fontSize: 10.5, fontWeight: 600,
                        color: PALETTE.brickText, textDecoration: 'line-through',
                      }}>
                        {formatChoice(r.student)}
                      </span>
                    )}
                    {r.isCorrect && changedOnRetry && (
                      <span style={{ fontFamily: FONT_D, fontSize: 9.5, color: PALETTE.muted }}>
                        재도전
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{
                      fontFamily: FONT_D, fontSize: 15, fontWeight: 700, lineHeight: 1.2,
                      color: r.isCorrect ? PALETTE.sageText : PALETTE.brickText,
                    }}>
                      {formatChoice(r.student)}
                    </span>
                    {!r.isCorrect && (
                      <span style={{ fontFamily: FONT_D, fontSize: 9.5, fontWeight: 600, color: PALETTE.sandText }}>
                        비공개
                      </span>
                    )}
                  </div>
                )}

                {/* 하단: 해설 이동 힌트 */}
                {canReveal && (
                  <div style={{
                    fontFamily: FONT_D, fontSize: 9.5,
                    color: isHovered ? PALETTE.navy : PALETTE.muted,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 'auto',
                  }}>
                    <span>{hasExp ? '해설 보기' : '정답 보기'}</span>
                    <span>&darr;</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 정답과 해설 섹션 */}
      <div style={{
        background: PALETTE.white,
        borderRadius: 9,
        border: `1px solid ${PALETTE.border}`,
        overflow: 'hidden',
      }}>
        {/* 정답과 해설 헤더 + 필터 */}
        <div style={{
          padding: '10px 13px',
          background: PALETTE.headerBg,
          borderBottom: `1px solid ${PALETTE.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: FONT_D, fontSize: 13.5, fontWeight: 700, color: PALETTE.navy }}>
              정답과 해설
            </span>
            {canReveal && explainedCount > 0 && (
              <span style={{
                fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                padding: '2px 7px', borderRadius: 4,
                background: PALETTE.white, color: PALETTE.navySub, border: `1px solid ${PALETTE.border}`,
              }}>
                해설 {explainedCount}/{results.length}문항
              </span>
            )}
          </div>

          {canReveal && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: `전체 ${results.length}` },
                { key: 'wrong', label: `틀린 문항 ${wrongCount}` },
                ...(explainedCount > 0 && explainedCount < results.length
                  ? [{ key: 'explained', label: `해설 있음 ${explainedCount}` }]
                  : []),
              ].map(tab => {
                const active = filterMode === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilterMode(tab.key)}
                    style={{
                      fontFamily: FONT_D,
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: `1px solid ${active ? PALETTE.navy : PALETTE.border}`,
                      background: active ? PALETTE.navy : PALETTE.white,
                      color: active ? PALETTE.white : PALETTE.muted,
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 본문: 비공개 안내 또는 문항별 정답과 해설 카드 */}
        {!canReveal ? (
          <div
            ref={lockedNoticeRef}
            style={{
              margin: 12,
              padding: '16px 14px',
              borderRadius: 8,
              background: PALETTE.sandBg,
              border: highlightedQ ? `1.5px solid ${PALETTE.navy}` : `1px solid ${PALETTE.sandBorder}`,
              transition: 'border-color 0.2s ease',
            }}
          >
            <div style={{ fontFamily: FONT_D, fontSize: 13.5, fontWeight: 700, color: PALETTE.sandText, marginBottom: 4 }}>
              정답과 해설 비공개 (재제출 대기 중)
            </div>
            <div style={{ fontSize: 12.5, color: PALETTE.text, lineHeight: 1.65 }}>
              재제출 기회가 남아 있어 베끼기 방지를 위해 실제 정답 번호와 문항별 해설을 숨겨 두었습니다.
              오답 재도전을 마치거나 최종 확정하면 이 영역에 문항별 정답과 해설이 모두 열립니다.
            </div>
            {explainedCount > 0 && (
              <div style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 600, color: PALETTE.sandText, marginTop: 6 }}>
                · 등록된 문항 해설 {explainedCount}개 준비됨
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleExplanations.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12.5, color: PALETTE.muted }}>
                {filterMode === 'wrong'
                  ? '틀린 문항이 없습니다. 전체 문항을 모두 맞혔습니다.'
                  : '표시할 문항이 없습니다.'}
              </div>
            ) : (
              visibleExplanations.map(r => {
                const qNum = r.num || r.questionNum;
                const isHighlighted = highlightedQ === qNum;
                const changedOnRetry = r.firstStudent !== undefined && r.firstStudent !== '' && String(r.firstStudent) !== String(r.student);
                const expText = typeof r.explanation === 'string' ? r.explanation.trim() : '';

                return (
                  <div
                    key={qNum}
                    ref={el => { expRefs.current[qNum] = el; }}
                    style={{
                      borderRadius: 8,
                      border: isHighlighted ? `1.5px solid ${PALETTE.navy}` : `1px solid ${PALETTE.border}`,
                      borderLeft: `3.5px solid ${r.isCorrect ? PALETTE.sageFill : PALETTE.brickText}`,
                      background: PALETTE.white,
                      boxShadow: isHighlighted ? '0 0 0 3px rgba(16, 32, 68, 0.12)' : 'none',
                      transition: 'box-shadow 0.25s ease, border-color 0.25s ease, background-color 0.25s ease',
                      overflow: 'hidden',
                      scrollMarginTop: 20,
                    }}
                  >
                    {/* 문항 헤더 바 */}
                    <div style={{
                      padding: '8px 12px',
                      background: isHighlighted ? PALETTE.headerBg : PALETTE.surface,
                      borderBottom: `1px solid ${PALETTE.borderSoft}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: FONT_D, fontSize: 13, fontWeight: 700,
                          color: PALETTE.navy, fontVariantNumeric: 'tabular-nums',
                        }}>
                          {String(qNum).padStart(2, '0')}번
                        </span>
                        <span style={{
                          fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                          padding: '1px 7px', borderRadius: 4,
                          background: r.isCorrect ? PALETTE.sageBg : PALETTE.brickBg,
                          color: r.isCorrect ? PALETTE.sageText : PALETTE.brickText,
                          border: `1px solid ${r.isCorrect ? PALETTE.sageBorder : PALETTE.brickBorder}`,
                        }}>
                          {r.isCorrect ? '정답' : '오답'}
                        </span>
                        {r.maxPoints !== undefined && (
                          <span style={{ fontFamily: FONT_D, fontSize: 11, color: PALETTE.muted }}>
                            {r.maxPoints}점
                          </span>
                        )}
                        <span style={{ color: PALETTE.border }}>|</span>
                        <span style={{ fontFamily: FONT_D, fontSize: 12.5, fontWeight: 700, color: PALETTE.navy }}>
                          정답 {formatChoice(r.correct)}
                        </span>
                        <span style={{ fontFamily: FONT_D, fontSize: 12, color: r.isCorrect ? PALETTE.sageText : PALETTE.brickText }}>
                          {changedOnRetry
                            ? `1차 ${formatChoice(r.firstStudent)} → 재제출 ${formatChoice(r.student)}`
                            : `내 답 ${formatChoice(r.student)}`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={scrollBackToQuickAnswer}
                        style={{
                          fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 5,
                          border: `1px solid ${PALETTE.border}`,
                          background: PALETTE.white, color: PALETTE.muted,
                          cursor: 'pointer',
                        }}
                      >
                        &uarr; 빠른 정답
                      </button>
                    </div>

                    {/* 해설 본문 */}
                    <div style={{
                      padding: '11px 13px',
                      fontSize: 13.5,
                      lineHeight: 1.75,
                      color: expText ? PALETTE.text : PALETTE.mutedLight,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'keep-all',
                    }}>
                      {expText || '등록된 해설이 없습니다.'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
