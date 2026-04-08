import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';
import LevelUpNotification from '../../components/LevelUpNotification';
import { ErrorState } from '../../components/StudentStates';

const DAILY_LIMIT = 5;
// 문제별 제한 시간: 첫 문제 50초 (지문 읽기 포함), 이후 30초
const FIRST_Q_TIME = 50;
const NEXT_Q_TIME = 30;

const CATEGORY_EMOJIS = {
  '인문': '📚', '예술': '🎨', '법': '⚖️', '경제': '📈',
  '사회': '🏛️', '과학': '🔬', '기술': '💻'
};

const DIFF_LABELS = { 1: '⭐ 쉬움', 2: '⭐⭐ 보통', 3: '⭐⭐⭐ 어려움' };

export default function ReadingQuiz() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('select'); // select, reading, result
  const [passage, setPassage] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [logId, setLogId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(FIRST_Q_TIME);
  const startTimeRef = useRef(null);
  const animFrameRef = useRef(null);
  const currentQIdxRef = useRef(currentQIdx);
  const submittingRef = useRef(false);

  const loadInitialData = useCallback(() => {
    setLoadError('');
    setLoading(true);
    api('/gamification/reading/today-count').then(d => {
      setTodayCount(d.count || 0);
      setLoading(false);
    }).catch(err => {
      setLoading(false);
      setLoadError(err.message || '데이터를 불러올 수 없습니다.');
    });
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  currentQIdxRef.current = currentQIdx;

  // 타이머 시간 초과 처리
  const handleTimeout = useCallback(() => {
    if (showAnswer) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setShowAnswer(true);
    setAnswers(prev => [...prev, { questionId: questions[currentQIdxRef.current]?.id, selectedAnswer: '__TIMEOUT__' }]);
    submittingRef.current = false;
  }, [showAnswer, questions]);

  // 타이머 애니메이션
  useEffect(() => {
    if (!timerActive) { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); return; }
    startTimeRef.current = performance.now();
    const tick = (now) => {
      const elapsed = (now - startTimeRef.current) / 1000;
      const remaining = timerSeconds - elapsed;
      if (remaining <= 0) { setTimeLeft(0); setTimerActive(false); handleTimeout(); return; }
      setTimeLeft(remaining);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [timerActive, handleTimeout, timerSeconds]);

  // 문제 전환 시 타이머 시작
  useEffect(() => {
    if (phase === 'reading' && !showAnswer) {
      const secs = currentQIdx === 0 ? FIRST_Q_TIME : NEXT_Q_TIME;
      setTimerSeconds(secs);
      setTimeLeft(secs);
      setTimerActive(true);
    }
  }, [currentQIdx, phase, showAnswer]);

  const startReading = async () => {
    setLoading(true);
    try {
      const data = await api('/gamification/reading/start');
      setPassage(data.passage);
      setQuestions(data.questions);
      setLogId(data.logId || null);
      setCurrentQIdx(0);
      setAnswers([]);
      setSelected(null);
      setShowAnswer(false);
      setTodayCount(prev => prev + 1);
      setPhase('reading');
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const handleSelect = (option) => { if (!showAnswer) setSelected(option); };

  const handleConfirmAnswer = () => {
    if (showAnswer || !selected) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setTimerActive(false);
    setShowAnswer(true);
    const q = questions[currentQIdx];
    setAnswers(prev => [...prev, { questionId: q.id, selectedAnswer: selected }]);
    submittingRef.current = false;
  };

  const nextQuestion = () => {
    setSelected(null);
    setShowAnswer(false);
    if (currentQIdx + 1 < questions.length) {
      setCurrentQIdx(currentQIdx + 1);
    } else {
      submitReading();
    }
  };

  const submitReading = async () => {
    setLoading(true);
    try {
      const r = await apiPost('/gamification/reading/submit', { passageId: passage.id, answers, logId });
      setResult(r);
      setPhase('result');
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  if (loadError) return (
    <div className="content s-page">
      <ErrorState message={loadError} onRetry={loadInitialData} />
      <BottomTabBar />
    </div>
  );

  // ===== SELECT 화면 =====
  if (phase === 'select') {
    return (
      <div className="content s-page">
        <div className="s-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
          <div className="section-header" style={{ justifyContent: 'center' }}><span className="section-title" style={{ fontSize: 'var(--text-lg)' }}>비문학 독해</span></div>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>수능형 비문학 지문을 읽고 문제를 풀어보세요!</p>
          <div style={{
            display: 'inline-block', marginTop: 'var(--space-2)', padding: '4px 14px',
            background: todayCount >= DAILY_LIMIT ? 'var(--destructive-light)' : 'var(--accent-lighter)',
            color: todayCount >= DAILY_LIMIT ? 'oklch(35% 0.15 25)' : 'var(--accent)',
            borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-xs)', fontWeight: 600
          }}>
            오늘 {todayCount}/{DAILY_LIMIT}지문
          </div>
        </div>

        {/* 안내 */}
        <div className="s-card" style={{ padding: 'var(--space-4)', background: 'var(--warning-light)', border: '1px solid oklch(92% 0.10 90)' }}>
          <div style={{ fontSize: 13, color: 'oklch(35% 0.12 75)', lineHeight: 1.7 }}>
            💡 <strong>비문학 독해</strong>는 짧은 지문을 읽고 내용일치·추론 문제를 푸는 수능형 게임입니다.<br />
            ⏰ 시간 제한 없이 천천히 읽고 풀 수 있습니다.<br />
            🎯 지문당 2~3문제, 난이도별 XP를 획득합니다. (쉬움 10 / 보통 15 / 어려움 20 XP)<br />
            ⏱️ 첫 문제 {FIRST_Q_TIME}초 (지문 읽기 포함), 이후 문제 {NEXT_Q_TIME}초 제한<br />
            ⚡ <strong>시작 버튼을 누르는 순간 오늘 횟수가 차감됩니다.</strong>
          </div>
        </div>

        <button className="s-btn s-btn-warm" onClick={startReading} disabled={loading || todayCount >= DAILY_LIMIT}
          style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 700, marginTop: 'var(--space-2)', background: todayCount >= DAILY_LIMIT ? 'var(--neutral-300)' : undefined }}>
          {loading ? '로딩 중...' : todayCount >= DAILY_LIMIT ? '오늘 제한 도달' : '지문 시작!'}
        </button>

        <button className="s-btn s-btn-warm-outline" onClick={() => navigate('/student/game')}
          style={{ width: '100%', padding: 'var(--space-3)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>← 게임 홈</button>

        <BottomTabBar />
      </div>
    );
  }

  // ===== READING 화면 =====
  if (phase === 'reading' && passage) {
    const q = questions[currentQIdx];
    if (!q) return null;

    return (
      <div className="content s-page">
        {/* 상단 정보 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              padding: '2px 10px', borderRadius: 'var(--radius-lg)', fontSize: 11, fontWeight: 700,
              background: 'var(--success-light)', color: 'oklch(30% 0.12 145)'
            }}>{CATEGORY_EMOJIS[passage.category]} {passage.category}</span>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{DIFF_LABELS[passage.difficulty]}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            문제 {currentQIdx + 1}/{questions.length}
          </span>
        </div>

        {/* 진행 바 */}
        <div style={{ height: 'var(--space-1)', background: 'var(--border)', borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(currentQIdx / questions.length) * 100}%`, background: 'var(--success)', transition: 'width 0.3s', borderRadius: 2 }} />
        </div>

        {/* 타이머 */}
        {(() => {
          const pct = timerSeconds > 0 ? timeLeft / timerSeconds : 0;
          const timerColor = pct > 0.5 ? 'var(--success)' : pct > 0.25 ? 'var(--warning)' : 'var(--destructive)';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 10 }}>
              <div style={{
                flex: 1, height: 'var(--space-2)', background: 'var(--neutral-50)', borderRadius: 'var(--space-1)', overflow: 'hidden',
                boxShadow: pct < 0.2 ? `0 0 8px ${timerColor}40` : 'none',
              }}>
                <div style={{
                  height: '100%', width: `${pct * 100}%`,
                  background: timerColor, borderRadius: 'var(--space-1)',
                }} />
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700, minWidth: 'var(--space-7)', textAlign: 'right',
                color: timerColor,
              }}>{Math.ceil(timeLeft)}초</span>
            </div>
          );
        })()}

        {/* 지문 */}
        <div className="s-card" style={{
          padding: 18, marginBottom: 'var(--space-3)',
          background: 'var(--warning-light)', border: '1px solid oklch(92% 0.10 90)',
          maxHeight: 280, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(35% 0.12 75)', marginBottom: 'var(--space-2)' }}>
            📄 {passage.title}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.9, color: 'var(--foreground)', wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>
            {passage.content}
          </div>
        </div>

        {/* 문제 */}
        <div className="s-card" style={{ padding: 'var(--space-4)', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(50% 0.20 280)', marginBottom: 'var(--space-1)' }}>
            [{q?.type}]
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, wordBreak: 'keep-all' }}>
            {q?.questionText}
          </div>
        </div>

        {/* 선택지 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {q?.options.map((opt, i) => {
            let bg = 'var(--neutral-50)';
            let border = '1px solid var(--border)';
            let color = 'var(--foreground)';
            if (selected === opt && !showAnswer) {
              bg = 'var(--success-light)'; border = '2px solid var(--success)'; color = 'oklch(30% 0.12 145)';
            }
            if (showAnswer && selected === opt) {
              bg = 'var(--accent-light)'; border = '2px solid var(--accent)'; color = 'var(--accent)';
            }

            return (
              <button key={i} onClick={() => handleSelect(opt)} disabled={showAnswer}
                style={{
                  padding: 'var(--space-3) var(--space-4)', borderRadius: 10, fontSize: 13, fontWeight: 500,
                  minHeight: 48, textAlign: 'left', cursor: showAnswer ? 'default' : 'pointer',
                  background: bg, border, color, transition: 'all 0.15s',
                  lineHeight: 1.6, wordBreak: 'keep-all',
                  boxShadow: selected === opt && !showAnswer ? '0 0 0 3px rgba(22,163,74,0.12)' : 'none',
                }}>
                <span style={{ fontWeight: 700, marginRight: 'var(--space-2)', color: 'var(--success)' }}>
                  {['①', '②', '③', '④'][i]}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {!showAnswer ? (
          <button className="s-btn s-btn-warm" onClick={handleConfirmAnswer} disabled={!selected}
            style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', fontSize: 15, fontWeight: 700, marginTop: 'var(--space-3)' }}>
            확인
          </button>
        ) : (
          <button className="s-btn s-btn-warm" onClick={nextQuestion}
            style={{ width: '100%', padding: 'var(--space-3) var(--space-4)', fontSize: 15, fontWeight: 700, marginTop: 'var(--space-3)' }}>
            {currentQIdx + 1 < questions.length ? '다음 문제 →' : '결과 보기'}
          </button>
        )}

        <BottomTabBar />
      </div>
    );
  }

  // ===== RESULT 화면 =====
  if (phase === 'result' && result) {
    const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
    const grade = pct >= 90 ? 'S' : pct >= 70 ? 'A' : pct >= 50 ? 'B' : 'C';
    const gradeColor = { S: 'var(--warning)', A: 'var(--success)', B: 'var(--accent)', C: 'var(--destructive)' }[grade];

    return (
      <div className="content s-page">
        <div className="s-card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: gradeColor }}>{grade}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', marginTop: 'var(--space-1)' }}>
            {result.passageTitle || '비문학 독해'}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)', marginTop: 'var(--space-1)' }}>
            {result.correct}/{result.total} 정답 ({pct}%)
          </div>
          <div style={{
            display: 'inline-block', marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-5)',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-dark, var(--accent)))',
            color: 'var(--card)', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-base)', fontWeight: 700
          }}>
            +{result.xpEarned} XP
          </div>
          {result.leveledUp && <LevelUpNotification level={result.newLevel} />}
        </div>

        {/* 문제별 결과 */}
        <div className="s-card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 10 }}>📋 문제별 결과</h3>
          {result.details && result.details.length > 0 ? result.details.map((d, i) => (
            <div key={i} style={{
              padding: '10px var(--space-3)', marginBottom: 6, borderRadius: 'var(--radius)',
              background: d.correct ? 'var(--success-light)' : 'var(--destructive-light)',
              border: d.correct ? '1px solid oklch(90% 0.06 145)' : '1px solid oklch(88% 0.06 25)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {d.correct ? '✅' : '❌'} 문제 {i + 1}
                </span>
              </div>
              {!d.correct && d.correctAnswer && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'oklch(30% 0.12 145)', marginTop: 'var(--space-1)' }}>정답: {d.correctAnswer}</div>
              )}
              {d.explanation && (
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>💡 {d.explanation}</div>
              )}
            </div>
          )) : (
            <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 'var(--space-4)' }}>상세 결과가 없습니다.</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <button className="s-btn s-btn-warm" onClick={() => { setPhase('select'); setResult(null); setPassage(null); setLogId(null); }}
            style={{ flex: 1, padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            다음 지문!</button>
          <button className="s-btn s-btn-warm-outline" onClick={() => navigate('/student/game')}
            style={{ flex: 1, padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)' }}>게임 홈</button>
        </div>

        <BottomTabBar />
      </div>
    );
  }

  return null;
}
