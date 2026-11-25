import { useState, useRef, useEffect } from 'react';
import { parseExplanationFileUrl } from '../lib/explanationFile';

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

function getRateColor(rate) {
  if (rate === null || rate === undefined) return PALETTE.muted;
  if (rate >= 70) return PALETTE.sageText;
  if (rate >= 40) return PALETTE.sandText;
  return PALETTE.brickText;
}

function getRateBarColor(rate) {
  if (rate === null || rate === undefined) return PALETTE.border;
  if (rate >= 70) return PALETTE.sageFill;
  if (rate >= 40) return '#9B7635';
  return PALETTE.brickText;
}

// 컴팩트 선지별 선택 비율 바 (①~⑤ 가로 비율 막대, 왼쪽 선 없는 균일 1px 테두리)
function ChoiceDistributionBar({ result, choiceCount = 5 }) {
  if (!result?.choiceRates) return null;
  const numC = Math.max(3, Math.min(5, Number(choiceCount) || 5));
  const correctNum = Number(result.correct);
  const studentNum = Number(result.student);
  const topWrongNum = result.topWrongChoice?.choice ? Number(result.topWrongChoice.choice) : null;

  return (
    <div style={{
      marginTop: 9,
      padding: '9px 11px',
      borderRadius: 7,
      background: PALETTE.white,
      border: `1px solid ${PALETTE.borderSoft}`,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6,
        marginBottom: 7,
      }}>
        <span style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: PALETTE.navySub }}>
          선지별 선택 비율
        </span>
        {result.topWrongChoice && (
          <span style={{ fontFamily: FONT_D, fontSize: 11, color: PALETTE.brickText, fontWeight: 600 }}>
            최다 오답 {formatChoice(result.topWrongChoice.choice)} ({result.topWrongChoice.rate}%)
            {studentNum === topWrongNum && !result.isCorrect ? ' · 내 선택' : ''}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numC}, minmax(0, 1fr))`, gap: 6 }}>
        {Array.from({ length: numC }, (_, idx) => idx + 1).map(c => {
          const pct = Number(result.choiceRates[String(c)] ?? 0);
          const isCorrectChoice = c === correctNum;
          const isMyChoice = c === studentNum;
          const isTopWrong = c === topWrongNum && !isCorrectChoice;

          let barColor = '#CBD5E1';
          let textColor = PALETTE.muted;
          let boxBg = PALETTE.surface;
          let boxBorder = PALETTE.borderSoft;

          if (isCorrectChoice) {
            barColor = PALETTE.sageFill;
            textColor = PALETTE.sageText;
            boxBg = PALETTE.sageBg;
            boxBorder = PALETTE.sageBorder;
          } else if (isMyChoice || isTopWrong) {
            barColor = PALETTE.brickText;
            textColor = PALETTE.brickText;
            boxBg = PALETTE.brickBg;
            boxBorder = PALETTE.brickBorder;
          }

          return (
            <div key={c} style={{
              padding: '6px 7px',
              borderRadius: 6,
              background: boxBg,
              border: `1px solid ${boxBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: textColor }}>
                  {CHOICE_SYMBOLS[c] || c}
                </span>
                <span style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: textColor, fontVariantNumeric: 'tabular-nums' }}>
                  {pct}%
                </span>
              </div>
              <div style={{ width: '100%', height: 4, borderRadius: 999, background: PALETTE.white, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: barColor,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontFamily: FONT_D, fontSize: 9.5, fontWeight: 600, color: textColor, minHeight: 13 }}>
                {isCorrectChoice && isMyChoice
                  ? '정답 · 내 답'
                  : isCorrectChoice
                    ? '정답'
                    : isMyChoice && isTopWrong
                      ? '내 답 · 함정'
                      : isMyChoice
                        ? '내 답'
                        : isTopWrong
                          ? '최다 오답'
                          : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 학생 OMR 채점 결과 카드
 * - 상단: 점수 요약 + 학습 인사이트 칩 (응시 인원·평균·실수 주의·고난도 정답)
 * - 중단: 빠른 정답 (문항별 O/X·정답·정답률·쪽수, 문항 클릭 시 하단 해설로 부드럽게 이동)
 * - 하단: 정답과 해설 (선택 문항 포커스 바 + 선지별 선택 비율 + Google Drive / 네이버 MYBOX 연동 뷰어 + 문항별 상세)
 * - 재제출 대기 중(canRevealAnswers=false)에는 정답·해설 링크·선지 분포를 서버·UI 모두 비공개 유지
 */
export default function StudentOmrResult({ data, maxScore = 100 }) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'wrong'
  const [insightFilter, setInsightFilter] = useState('all'); // 'all' | 'basic_miss' | 'hard_hit'
  const [selectedQ, setSelectedQ] = useState(null);
  const [highlightedQ, setHighlightedQ] = useState(null);
  const [hoveredQ, setHoveredQ] = useState(null);
  const [forceEmbedExternal, setForceEmbedExternal] = useState(false);

  const quickAnswerRef = useRef(null);
  const explanationSectionRef = useRef(null);
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
  const choiceCount = data.choiceCount || 5;
  const correctCount = data.correctCount ?? results.filter(r => r.isCorrect).length;
  const wrongCount = Math.max(0, results.length - correctCount);
  const percentage = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;
  const canReveal = Boolean(data.canRevealAnswers);
  const hasRetest = (data.attemptCount || 1) >= 2 && data.firstScore !== null && data.firstScore !== undefined;
  const statsSummary = data.statsSummary || null;
  const showRates = Boolean(statsSummary?.canShowRate) || results.some(r => r.correctRate !== null && r.correctRate !== undefined);

  // 개인 맞춤 인사이트 계산 (정답률 × 본인 정오)
  const basicMissQuestions = showRates
    ? results.filter(r => !r.isCorrect && r.correctRate !== null && r.correctRate !== undefined && r.correctRate >= 70)
    : [];
  const hardHitQuestions = showRates
    ? results.filter(r => r.isCorrect && r.correctRate !== null && r.correctRate !== undefined && r.correctRate < 40)
    : [];

  const rawExamFile = canReveal ? data.explanationFile : null;
  const activeResult = selectedQ !== null
    ? results.find(r => (r.num || r.questionNum) === selectedQ) || null
    : null;
  const activePage = activeResult?.explanationPage || null;
  const activeQuestionFile = canReveal && activeResult?.explanationUrl
    ? parseExplanationFileUrl(activeResult.explanationUrl, activePage)
    : null;
  const parsedExamFile = rawExamFile?.url
    ? parseExplanationFileUrl(rawExamFile.url, activePage)
    : null;

  const perQuestionDetailCount = results.filter(r => (
    (typeof r.explanation === 'string' && r.explanation.trim().length > 0) ||
    Boolean(r.explanationUrl)
  )).length;
  const hasAnyFile = Boolean(parsedExamFile) || Boolean(data.hasExplanationFile);

  const visibleExplanations = results.filter(r => {
    if (filterMode === 'wrong') return !r.isCorrect;
    return true;
  });

  const triggerHighlight = (qNum) => {
    setHighlightedQ(qNum);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedQ(null), 2200);
  };

  const scrollToExplanation = (qNum) => {
    setSelectedQ(qNum);

    if (!canReveal) {
      if (lockedNoticeRef.current) {
        lockedNoticeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      triggerHighlight(qNum);
      return;
    }

    const targetItem = results.find(r => (r.num || r.questionNum) === qNum);
    const hasCardForTarget = perQuestionDetailCount > 0 && (
      (typeof targetItem?.explanation === 'string' && targetItem.explanation.trim().length > 0) ||
      Boolean(targetItem?.explanationUrl) ||
      !parsedExamFile
    );

    if (parsedExamFile && !hasCardForTarget) {
      if (explanationSectionRef.current) {
        explanationSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      triggerHighlight(qNum);
      return;
    }

    const isCurrentlyVisible = visibleExplanations.some(r => (r.num || r.questionNum) === qNum);
    if (!isCurrentlyVisible) {
      setFilterMode('all');
    }

    const doScroll = () => {
      const el = expRefs.current[qNum] || explanationSectionRef.current;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: parsedExamFile ? 'start' : 'center' });
      }
      triggerHighlight(qNum);
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

  const stepSelectedQuestion = (delta) => {
    const nums = results.map(r => r.num || r.questionNum);
    if (nums.length === 0) return;
    const currentIdx = selectedQ !== null ? nums.indexOf(selectedQ) : -1;
    const nextIdx = currentIdx === -1
      ? 0
      : Math.max(0, Math.min(nums.length - 1, currentIdx + delta));
    setSelectedQ(nums[nextIdx]);
    triggerHighlight(nums[nextIdx]);
  };

  const displayFile = activeQuestionFile || parsedExamFile;
  const displayFileTitle = activeQuestionFile
    ? `${String(selectedQ).padStart(2, '0')}번 문항 해설 파일`
    : (rawExamFile?.title || `${displayFile?.providerLabel || '연동'} 정답 및 해설지`);

  return (
    <div style={{
      fontFamily: FONT_B,
      marginTop: 'var(--space-3)',
      padding: 14,
      background: PALETTE.surface,
      borderRadius: 10,
      border: `1px solid ${PALETTE.border}`,
    }}>
      {/* 1. 점수 요약 & 정답률 인사이트 헤더 */}
      <div style={{
        marginBottom: 14, padding: '11px 14px',
        background: PALETTE.white, borderRadius: 8, border: `1px solid ${PALETTE.borderSoft}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
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

        {/* 시험 전체 정답률 요약 & 학습 인사이트 필터 칩 */}
        {statsSummary?.enabled && (
          <div style={{
            marginTop: 10, paddingTop: 9, borderTop: `1px solid ${PALETTE.borderSoft}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          }}>
            {statsSummary.isReady && showRates ? (
              <>
                <div style={{ fontFamily: FONT_D, fontSize: 11.5, color: PALETTE.muted, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>응시 <strong style={{ color: PALETTE.navy }}>{statsSummary.totalRespondents}명</strong></span>
                  {statsSummary.averageScore !== null && statsSummary.averageScore !== undefined && (
                    <span>· 평균 <strong style={{ color: PALETTE.navy }}>{statsSummary.averageScore}점</strong></span>
                  )}
                  <span style={{ fontSize: 11, color: PALETTE.mutedLight }}>
                    ({statsSummary.basis === 'latest' ? '최종 제출 기준' : '1차 제출 기준'})
                  </span>
                </div>

                {(basicMissQuestions.length > 0 || hardHitQuestions.length > 0) && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {insightFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setInsightFilter('all')}
                        style={{
                          fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                          border: `1px solid ${PALETTE.border}`, background: PALETTE.white, color: PALETTE.muted,
                        }}
                      >
                        필터 해제
                      </button>
                    )}
                    {basicMissQuestions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setInsightFilter(prev => prev === 'basic_miss' ? 'all' : 'basic_miss')}
                        style={{
                          fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                          border: `1px solid ${insightFilter === 'basic_miss' ? PALETTE.navy : PALETTE.brickBorder}`,
                          background: insightFilter === 'basic_miss' ? PALETTE.navy : PALETTE.brickBg,
                          color: insightFilter === 'basic_miss' ? PALETTE.white : PALETTE.brickText,
                        }}
                      >
                        실수 주의(70%↑ 오답) {basicMissQuestions.length}
                      </button>
                    )}
                    {hardHitQuestions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setInsightFilter(prev => prev === 'hard_hit' ? 'all' : 'hard_hit')}
                        style={{
                          fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                          border: `1px solid ${insightFilter === 'hard_hit' ? PALETTE.navy : PALETTE.sageBorder}`,
                          background: insightFilter === 'hard_hit' ? PALETTE.navy : PALETTE.sageBg,
                          color: insightFilter === 'hard_hit' ? PALETTE.white : PALETTE.sageText,
                        }}
                      >
                        고난도 정답(&lt;40%) {hardHitQuestions.length}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 11.5, color: PALETTE.muted }}>
                {!statsSummary.isReady
                  ? `문항별 정답률 집계 중 (현재 ${statsSummary.totalRespondents}명 · ${statsSummary.minSample}명 이상 응시 시 공개)`
                  : '문항별 정답률과 선지 선택 비율은 최종 제출 완료 후 공개됩니다.'}
              </div>
            )}
          </div>
        )}
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
                ? '문항을 클릭하면 아래 선지 분포와 해설로 이동합니다'
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

        {/* 빠른 정답 클릭 그리드 (정답률 + 초슬림 게이지 바 포함) */}
        <div style={{
          padding: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
          gap: 6,
        }}>
          {results.map(r => {
            const qNum = r.num || r.questionNum;
            const changedOnRetry = r.firstStudent !== undefined && r.firstStudent !== '' && String(r.firstStudent) !== String(r.student);
            const isHovered = hoveredQ === qNum;
            const isSelected = selectedQ === qNum;
            const hasRate = r.correctRate !== null && r.correctRate !== undefined;
            const isBasicMiss = hasRate && !r.isCorrect && r.correctRate >= 70;
            const isHardHit = hasRate && r.isCorrect && r.correctRate < 40;

            const dimmedByInsight =
              (insightFilter === 'basic_miss' && !isBasicMiss) ||
              (insightFilter === 'hard_hit' && !isHardHit);

            return (
              <button
                key={qNum}
                type="button"
                onClick={() => scrollToExplanation(qNum)}
                onMouseEnter={() => setHoveredQ(qNum)}
                onMouseLeave={() => setHoveredQ(null)}
                title={canReveal ? `${qNum}번 정답률·선지 분포 및 해설 보기` : `${qNum}번 결과`}
                style={{
                  textAlign: 'left',
                  padding: '7px 8px',
                  borderRadius: 7,
                  background: r.isCorrect ? PALETTE.sageBg : PALETTE.brickBg,
                  border: isSelected || isHovered
                    ? `1.5px solid ${PALETTE.navy}`
                    : `1px solid ${r.isCorrect ? PALETTE.sageBorder : PALETTE.brickBorder}`,
                  cursor: 'pointer',
                  transition: 'border-color 0.12s ease, transform 0.1s ease, box-shadow 0.12s ease, opacity 0.15s ease',
                  boxShadow: isSelected || isHovered ? '0 2px 6px rgba(16, 32, 68, 0.08)' : 'none',
                  opacity: dimmedByInsight ? 0.35 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minHeight: hasRate ? 78 : 62,
                }}
              >
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

                {/* 문항별 정답률 & 3px 미니 게이지 바 */}
                {hasRate && (
                  <div style={{ width: '100%', marginTop: 1 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontFamily: FONT_D, fontSize: 9.5, fontWeight: 600,
                      color: getRateColor(r.correctRate), fontVariantNumeric: 'tabular-nums',
                      marginBottom: 2,
                    }}>
                      <span>{isBasicMiss ? '실수' : isHardHit ? '고난도' : '정답률'}</span>
                      <span>{r.correctRate}%</span>
                    </div>
                    <div style={{ width: '100%', height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.85)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(0, r.correctRate))}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: getRateBarColor(r.correctRate),
                      }} />
                    </div>
                  </div>
                )}

                {canReveal && (
                  <div style={{
                    fontFamily: FONT_D, fontSize: 9.5,
                    color: isSelected || isHovered ? PALETTE.navy : PALETTE.muted,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 'auto',
                  }}>
                    <span>{r.explanationPage ? `${r.explanationPage}쪽` : (r.category || '해설 보기')}</span>
                    <span>&darr;</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 정답과 해설 섹션 */}
      <div
        ref={explanationSectionRef}
        style={{
          background: PALETTE.white,
          borderRadius: 9,
          border: `1px solid ${PALETTE.border}`,
          overflow: 'hidden',
          scrollMarginTop: 16,
        }}
      >
        <div style={{
          padding: '10px 13px',
          background: PALETTE.headerBg,
          borderBottom: `1px solid ${PALETTE.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT_D, fontSize: 13.5, fontWeight: 700, color: PALETTE.navy }}>
              정답과 해설
            </span>
            {canReveal && displayFile && (
              <span style={{
                fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 4,
                background: PALETTE.white, color: PALETTE.navySub, border: `1px solid ${PALETTE.border}`,
              }}>
                {displayFile.providerLabel} 연동
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {canReveal && displayFile && (
              <a
                href={displayFile.openUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: FONT_D, fontSize: 11.5, fontWeight: 600,
                  padding: '4px 10px', borderRadius: 6,
                  border: `1px solid ${PALETTE.navy}`,
                  background: PALETTE.navy, color: PALETTE.white,
                  textDecoration: 'none',
                }}
              >
                새 창에서 열기 &#8599;
              </a>
            )}
            {canReveal && (!parsedExamFile || perQuestionDetailCount > 0) && (
              <>
                {[
                  { key: 'all', label: `전체 ${results.length}` },
                  { key: 'wrong', label: `틀린 문항 ${wrongCount}` },
                ].map(tab => {
                  const active = filterMode === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFilterMode(tab.key)}
                      style={{
                        fontFamily: FONT_D, fontSize: 11.5, fontWeight: 600,
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${active ? PALETTE.navy : PALETTE.border}`,
                        background: active ? PALETTE.navy : PALETTE.white,
                        color: active ? PALETTE.white : PALETTE.muted,
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>

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
              재제출 기회가 남아 있어 베끼기 방지를 위해 실제 정답 번호, 선지별 선택 비율, 연동된 해설 파일을 숨겨 두었습니다.
              오답 재도전을 마치거나 최종 확정하면 이 영역에 모두 열립니다.
            </div>
            {hasAnyFile && (
              <div style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 600, color: PALETTE.sandText, marginTop: 6 }}>
                · 연동된 해설지 파일이 준비되어 있습니다
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* A. 선택한 문항 포커스 바 + 선지별 선택 비율 */}
            {displayFile && activeResult && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: highlightedQ === selectedQ ? PALETTE.headerBg : PALETTE.surface,
                border: highlightedQ === selectedQ ? `1.5px solid ${PALETTE.navy}` : `1px solid ${PALETTE.border}`,
                boxShadow: highlightedQ === selectedQ ? '0 0 0 3px rgba(16, 32, 68, 0.10)' : 'none',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: FONT_D, fontSize: 13.5, fontWeight: 700, color: PALETTE.navy }}>
                      {String(activeResult.num || activeResult.questionNum).padStart(2, '0')}번
                    </span>
                    <span style={{
                      fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                      padding: '1px 7px', borderRadius: 4,
                      background: activeResult.isCorrect ? PALETTE.sageBg : PALETTE.brickBg,
                      color: activeResult.isCorrect ? PALETTE.sageText : PALETTE.brickText,
                      border: `1px solid ${activeResult.isCorrect ? PALETTE.sageBorder : PALETTE.brickBorder}`,
                    }}>
                      {activeResult.isCorrect ? '정답' : '오답'}
                    </span>
                    {activeResult.category && (
                      <span style={{
                        fontFamily: FONT_D, fontSize: 10.5, fontWeight: 600,
                        padding: '1px 6px', borderRadius: 4,
                        background: PALETTE.white, color: PALETTE.muted, border: `1px solid ${PALETTE.border}`,
                      }}>
                        {activeResult.category}
                      </span>
                    )}
                    <span style={{ fontFamily: FONT_D, fontSize: 12.5, fontWeight: 700, color: PALETTE.navy }}>
                      정답 {formatChoice(activeResult.correct)}
                    </span>
                    <span style={{ fontFamily: FONT_D, fontSize: 12, color: activeResult.isCorrect ? PALETTE.sageText : PALETTE.brickText }}>
                      내 답 {formatChoice(activeResult.student)}
                    </span>
                    {activeResult.correctRate !== null && activeResult.correctRate !== undefined && (
                      <span style={{
                        fontFamily: FONT_D, fontSize: 11, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 4,
                        background: PALETTE.white,
                        color: getRateColor(activeResult.correctRate),
                        border: `1px solid ${PALETTE.border}`,
                      }}>
                        정답률 {activeResult.correctRate}%
                      </span>
                    )}
                    {activePage && (
                      <span style={{
                        fontFamily: FONT_D, fontSize: 11, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 4,
                        background: PALETTE.white, color: PALETTE.navy, border: `1px solid ${PALETTE.border}`,
                      }}>
                        해설지 {activePage}쪽
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button type="button" onClick={() => stepSelectedQuestion(-1)}
                      style={{
                        fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 5,
                        border: `1px solid ${PALETTE.border}`, background: PALETTE.white,
                        color: PALETTE.text, cursor: 'pointer',
                      }}>
                      &larr; 이전
                    </button>
                    <button type="button" onClick={() => stepSelectedQuestion(1)}
                      style={{
                        fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 5,
                        border: `1px solid ${PALETTE.border}`, background: PALETTE.white,
                        color: PALETTE.text, cursor: 'pointer',
                      }}>
                      다음 &rarr;
                    </button>
                    <button type="button" onClick={scrollBackToQuickAnswer}
                      style={{
                        fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 5,
                        border: `1px solid ${PALETTE.border}`, background: PALETTE.white,
                        color: PALETTE.muted, cursor: 'pointer',
                      }}>
                      &uarr; 빠른 정답
                    </button>
                  </div>
                </div>

                {/* 선지별 선택 비율 바 */}
                <ChoiceDistributionBar result={activeResult} choiceCount={choiceCount} />

                {typeof activeResult.explanation === 'string' && activeResult.explanation.trim() && (
                  <div style={{
                    marginTop: 8, paddingTop: 8, borderTop: `1px solid ${PALETTE.borderSoft}`,
                    fontSize: 13, lineHeight: 1.7, color: PALETTE.text, whiteSpace: 'pre-wrap',
                  }}>
                    {activeResult.explanation.trim()}
                  </div>
                )}
              </div>
            )}

            {/* B. 연동된 구글 드라이브 / 네이버 MYBOX(N드라이브) / PDF 뷰어 */}
            {displayFile && (
              <div style={{
                borderRadius: 8,
                border: `1px solid ${PALETTE.border}`,
                background: PALETTE.surface,
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '9px 12px',
                  background: PALETTE.white,
                  borderBottom: `1px solid ${PALETTE.borderSoft}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: FONT_D, fontSize: 11, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 4,
                      background: PALETTE.headerBg, color: PALETTE.navy, border: `1px solid ${PALETTE.border}`,
                    }}>
                      {displayFile.providerLabel}
                    </span>
                    <span style={{ fontFamily: FONT_D, fontSize: 13, fontWeight: 600, color: PALETTE.navy }}>
                      {displayFileTitle}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {activeQuestionFile && parsedExamFile && (
                      <button type="button" onClick={() => setSelectedQ(null)}
                        style={{
                          fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                          padding: '4px 8px', borderRadius: 5,
                          border: `1px solid ${PALETTE.border}`, background: PALETTE.white,
                          color: PALETTE.muted, cursor: 'pointer',
                        }}>
                        전체 해설지로 돌아가기
                      </button>
                    )}
                    {!displayFile.canEmbed && (
                      <button type="button" onClick={() => setForceEmbedExternal(prev => !prev)}
                        style={{
                          fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                          padding: '4px 8px', borderRadius: 5,
                          border: `1px solid ${PALETTE.border}`, background: PALETTE.white,
                          color: PALETTE.muted, cursor: 'pointer',
                        }}>
                        {forceEmbedExternal ? '미리보기 닫기' : '화면 내 열기 시도'}
                      </button>
                    )}
                  </div>
                </div>

                {displayFile.embedType === 'image' ? (
                  <div style={{ padding: 12, textAlign: 'center', background: PALETTE.white }}>
                    <img
                      src={displayFile.embedUrl}
                      alt={displayFileTitle}
                      style={{ maxWidth: '100%', borderRadius: 6, border: `1px solid ${PALETTE.borderSoft}` }}
                    />
                  </div>
                ) : (displayFile.canEmbed || forceEmbedExternal) ? (
                  <div>
                    <iframe
                      key={displayFile.embedUrl}
                      src={displayFile.embedUrl}
                      title={displayFileTitle}
                      style={{
                        width: '100%',
                        height: 520,
                        border: 'none',
                        display: 'block',
                        background: PALETTE.white,
                      }}
                      allow="autoplay"
                    />
                    <div style={{
                      padding: '7px 12px',
                      background: PALETTE.white,
                      borderTop: `1px solid ${PALETTE.borderSoft}`,
                      fontSize: 11.5, color: PALETTE.muted,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6,
                    }}>
                      <span>화면이 보이지 않거나 글자가 작으면 오른쪽 버튼으로 크게 열어보세요.</span>
                      <a
                        href={displayFile.openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: FONT_D, fontWeight: 600, color: PALETTE.navy, textDecoration: 'underline' }}
                      >
                        원본 파일 열기 &#8599;
                      </a>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '18px 16px', background: PALETTE.white }}>
                    <div style={{ fontSize: 13, color: PALETTE.text, lineHeight: 1.65, marginBottom: 12 }}>
                      {displayFile.helperNote}
                      {activePage && (
                        <span style={{ display: 'block', marginTop: 4, fontFamily: FONT_D, fontWeight: 700, color: PALETTE.navy }}>
                          선택한 {String(selectedQ).padStart(2, '0')}번 문항은 해설지 {activePage}쪽에서 확인하세요.
                        </span>
                      )}
                    </div>
                    <a
                      href={displayFile.openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontFamily: FONT_D, fontSize: 13, fontWeight: 600,
                        padding: '9px 16px', borderRadius: 7,
                        background: PALETTE.navy, color: PALETTE.white,
                        textDecoration: 'none',
                      }}
                    >
                      {displayFile.providerLabel}에서 정답·해설 열기 &#8599;
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* C. 문항별 상세 카드 (왼쪽 선 없이 균일 1px 테두리) */}
            {(!parsedExamFile || perQuestionDetailCount > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {parsedExamFile && perQuestionDetailCount > 0 && (
                  <div style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: PALETTE.navySub, paddingTop: 4 }}>
                    문항별 상세 해설
                  </div>
                )}
                {visibleExplanations.length === 0 ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12.5, color: PALETTE.muted }}>
                    {filterMode === 'wrong'
                      ? '틀린 문항이 없습니다. 전체 문항을 모두 맞혔습니다.'
                      : '표시할 문항이 없습니다.'}
                  </div>
                ) : (
                  visibleExplanations
                    .filter(r => !parsedExamFile || (typeof r.explanation === 'string' && r.explanation.trim()) || Boolean(r.explanationUrl))
                    .map(r => {
                      const qNum = r.num || r.questionNum;
                      const isHighlighted = highlightedQ === qNum;
                      const changedOnRetry = r.firstStudent !== undefined && r.firstStudent !== '' && String(r.firstStudent) !== String(r.student);
                      const expText = typeof r.explanation === 'string' ? r.explanation.trim() : '';
                      const qFile = r.explanationUrl ? parseExplanationFileUrl(r.explanationUrl, r.explanationPage) : null;

                      return (
                        <div
                          key={qNum}
                          ref={el => { expRefs.current[qNum] = el; }}
                          style={{
                            borderRadius: 8,
                            border: isHighlighted ? `1.5px solid ${PALETTE.navy}` : `1px solid ${PALETTE.border}`,
                            background: PALETTE.white,
                            boxShadow: isHighlighted ? '0 0 0 3px rgba(16, 32, 68, 0.10)' : 'none',
                            transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
                            overflow: 'hidden',
                            scrollMarginTop: 20,
                          }}
                        >
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
                              {r.category && (
                                <span style={{
                                  fontFamily: FONT_D, fontSize: 10.5, fontWeight: 600,
                                  padding: '1px 6px', borderRadius: 4,
                                  background: PALETTE.white, color: PALETTE.muted, border: `1px solid ${PALETTE.border}`,
                                }}>
                                  {r.category}
                                </span>
                              )}
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
                              {r.correctRate !== null && r.correctRate !== undefined && (
                                <span style={{
                                  fontFamily: FONT_D, fontSize: 10.5, fontWeight: 700,
                                  padding: '1px 6px', borderRadius: 4,
                                  background: PALETTE.white, color: getRateColor(r.correctRate), border: `1px solid ${PALETTE.border}`,
                                }}>
                                  정답률 {r.correctRate}%
                                </span>
                              )}
                              {r.explanationPage && (
                                <span style={{
                                  fontFamily: FONT_D, fontSize: 10.5, fontWeight: 600,
                                  padding: '1px 6px', borderRadius: 4,
                                  background: PALETTE.white, color: PALETTE.navySub, border: `1px solid ${PALETTE.border}`,
                                }}>
                                  {r.explanationPage}쪽
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {qFile && (
                                <a
                                  href={qFile.openUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                                    padding: '3px 8px', borderRadius: 5,
                                    border: `1px solid ${PALETTE.navy}`,
                                    background: PALETTE.navy, color: PALETTE.white,
                                    textDecoration: 'none',
                                  }}
                                >
                                  {qFile.providerLabel} 열기 &#8599;
                                </a>
                              )}
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
                          </div>

                          <div style={{ padding: '11px 13px' }}>
                            {!displayFile && r.choiceRates && (
                              <div style={{ marginBottom: expText ? 10 : 0 }}>
                                <ChoiceDistributionBar result={r} choiceCount={choiceCount} />
                              </div>
                            )}
                            <div style={{
                              fontSize: 13.5,
                              lineHeight: 1.75,
                              color: expText ? PALETTE.text : PALETTE.mutedLight,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'keep-all',
                            }}>
                              {expText || (qFile ? `${qFile.providerLabel}에 연동된 문항 해설 파일에서 확인하세요.` : '등록된 해설이 없습니다.')}
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
