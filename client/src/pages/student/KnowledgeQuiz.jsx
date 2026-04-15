import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';
import LevelUpNotification from '../../components/LevelUpNotification';

const DEFAULT_TIMER = 20;
const DAILY_LIMIT = 50;

export default function KnowledgeQuiz() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('select');
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [quizLogId, setQuizLogId] = useState(null);
  const [timerSeconds] = useState(DEFAULT_TIMER);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER);
  const [timerActive, setTimerActive] = useState(false);
  const startTimeRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    api('/gamification/knowledge/today-count').then(d => setTodayCount(d.count || 0)).catch(() => {});
  }, []);

  const handleTimeout = useCallback(() => {
    if (showAnswer) return;
    setSelected(null);
    setShowAnswer(true);
    setTimerActive(false);
    const q = questions[currentIdx];
    setAnswers(prev => [...prev, { wordId: q.id, selectedAnswer: '__TIMEOUT__' }]);
  }, [showAnswer, questions, currentIdx]);

  useEffect(() => {
    if (!timerActive) { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); return; }
    startTimeRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = timerSeconds - elapsed;
      if (remaining <= 0) { setTimeLeft(0); setTimerActive(false); handleTimeout(); return; }
      setTimeLeft(remaining);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [timerActive, handleTimeout]);

  useEffect(() => {
    if (phase === 'quiz' && !showAnswer) { setTimeLeft(timerSeconds); setTimerActive(true); }
  }, [currentIdx, phase]);

  const startQuiz = async () => {
    setLoading(true);
    try {
      const data = await api(`/gamification/knowledge/start?count=${questionCount}`);
      const qs = data.questions || data;
      if (!qs || qs.length === 0) { alert('출제할 문제가 없습니다.'); setLoading(false); return; }
      setQuizLogId(data.logId || null);
      setQuestions(qs);
      setCurrentIdx(0);
      setAnswers([]);
      setTimeLeft(timerSeconds);
      setPhase('quiz');
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const handleSelect = (option) => { if (!showAnswer) setSelected(option); };

  const handleConfirmAnswer = () => {
    if (showAnswer || !selected) return;
    setShowAnswer(true);
    setTimerActive(false);
    const q = questions[currentIdx];
    setAnswers(prev => [...prev, { wordId: q.id, selectedAnswer: selected }]);
  };

  const nextQuestion = () => {
    setSelected(null);
    setShowAnswer(false);
    if (currentIdx + 1 < questions.length) setCurrentIdx(currentIdx + 1);
    else submitQuiz();
  };

  const submitQuiz = async () => {
    setLoading(true);
    setTimerActive(false);
    try {
      const r = await apiPost('/gamification/knowledge/submit', { answers, logId: quizLogId });
      setResult(r);
      setPhase('result');
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const getTimerColor = () => {
    const pct = timeLeft / timerSeconds;
    if (pct > 0.5) return 'var(--success)';
    if (pct > 0.25) return 'var(--warning)';
    return 'var(--destructive)';
  };

  const getTimerGlow = () => {
    const pct = timeLeft / timerSeconds;
    if (pct > 0.5) return 'none';
    if (pct > 0.25) return '0 0 8px rgba(245,158,11,0.5)';
    return '0 0 12px rgba(239,68,68,0.6)';
  };

  // ===== SELECT 화면 =====
  if (phase === 'select') {
    return (
      <div className="content s-page s-page-wide" style={{ paddingBottom: 96 }}>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🧠</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>지식 퀴즈</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 12px', lineHeight: 1.6 }}>
            사회·과학·경제·역사 등 다양한 분야의<br />고등학교 수준 지식을 테스트해보세요!
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px',
            background: todayCount >= DAILY_LIMIT ? 'var(--destructive-light)' : 'var(--info-light)',
            color: todayCount >= DAILY_LIMIT ? 'oklch(35% 0.15 25)' : 'oklch(32% 0.12 260)',
            borderRadius: 20, fontSize: 13, fontWeight: 700
          }}>
            📅 오늘 {todayCount}/{DAILY_LIMIT}문제
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>📊 문제 수 선택</h3>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>⏱️ 문제당 {timerSeconds}초</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[5, 10, 15, 20].map(n => (
              <button key={n} onClick={() => setQuestionCount(n)}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 12, fontSize: 18, fontWeight: 800, cursor: 'pointer',
                  border: questionCount === n ? '2px solid var(--info)' : '1px solid var(--border)',
                  background: questionCount === n ? 'var(--info-light)' : 'var(--background)',
                  color: questionCount === n ? 'oklch(38% 0.14 260)' : 'var(--foreground)',
                  transition: 'all 0.15s',
                }}>{n}</button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>
            예상 소요 시간: 약 {Math.ceil(questionCount * timerSeconds / 60)}~{Math.ceil(questionCount * timerSeconds / 60) + 2}분
          </div>
        </div>

        <div className="card" style={{ padding: 14, background: 'var(--warning-light)', border: '1px solid oklch(92% 0.10 90)' }}>
          <div style={{ fontSize: 13, color: 'oklch(35% 0.12 75)', lineHeight: 1.7 }}>
            💡 <strong>퀴즈 안내</strong><br />
            • 틀린 문제는 7일 후 다시 출제됩니다<br />
            • 맞힌 문제는 다시 출제되지 않습니다<br />
            • 문제당 {timerSeconds}초 내에 답해야 합니다
          </div>
        </div>

        <button className="btn btn-primary" onClick={startQuiz} disabled={loading || todayCount >= DAILY_LIMIT}
          style={{ width: '100%', padding: 16, fontSize: 17, fontWeight: 800, marginTop: 4 }}>
          {loading ? '로딩 중...' : todayCount >= DAILY_LIMIT ? '오늘 제한 도달 (내일 다시!)' : '🚀 퀴즈 시작!'}
        </button>

        <button className="btn btn-outline" onClick={() => navigate('/student/game')}
          style={{ width: '100%', padding: 12, fontSize: 14, marginTop: 8 }}>← 게임 홈</button>

        <BottomTabBar />
      </div>
    );
  }

  // ===== QUIZ 화면 =====
  if (phase === 'quiz') {
    const q = questions[currentIdx];
    const lastAnswer = answers[answers.length - 1];
    const isTimeout = showAnswer && lastAnswer?.selectedAnswer === '__TIMEOUT__';
    const isCorrect = showAnswer && !isTimeout && selected === q?.correctAnswer;

    return (
      <div className="content s-page s-page-wide" style={{ paddingBottom: 96 }}>
        {/* 진행 상태 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
            {currentIdx + 1} / {questions.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {q?.category && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--info-light)', color: 'var(--info)', fontWeight: 600 }}>
                {q.category}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {q?.difficulty === 3 ? '⭐⭐⭐' : q?.difficulty === 2 ? '⭐⭐' : '⭐'}
            </span>
          </div>
        </div>

        {/* 진행 바 */}
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(currentIdx / questions.length) * 100}%`, background: 'var(--primary)', transition: 'width 0.3s', borderRadius: 2 }} />
        </div>

        {/* 타이머 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            flex: 1, height: 8, background: 'var(--secondary)', borderRadius: 4, overflow: 'hidden',
            boxShadow: getTimerGlow(),
          }}>
            <div style={{
              height: '100%', width: `${(timeLeft / timerSeconds) * 100}%`,
              background: getTimerColor(), transition: 'background 0.5s', borderRadius: 4,
            }} />
          </div>
          <span style={{
            fontSize: 13, fontWeight: 700, minWidth: 32, textAlign: 'right',
            color: getTimerColor(),
          }}>{Math.ceil(timeLeft)}초</span>
        </div>

        {/* 문제 */}
        <div className="card" style={{ padding: 20, marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.8, wordBreak: 'keep-all', color: 'var(--foreground)' }}>
            {q?.questionText}
          </div>
        </div>

        {/* 선택지 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q?.options.map((opt, i) => {
            let bg = 'var(--background)', border = '1px solid var(--border)', color = 'var(--foreground)';

            if (showAnswer) {
              if (opt === q.correctAnswer) {
                bg = 'var(--success-light)'; border = '2px solid var(--success)'; color = 'oklch(38% 0.10 150)';
              } else if (opt === selected) {
                bg = 'var(--destructive-light)'; border = '2px solid var(--destructive)'; color = 'oklch(48% 0.20 25)';
              }
            } else if (selected === opt) {
              bg = 'var(--info-light)'; border = '2px solid var(--info)'; color = 'oklch(38% 0.14 260)';
            }

            return (
              <button key={i} onClick={() => handleSelect(opt)} disabled={showAnswer}
                style={{
                  padding: '14px 16px', borderRadius: 12, fontSize: 14, fontWeight: 500,
                  textAlign: 'left', cursor: showAnswer ? 'default' : 'pointer',
                  background: bg, border, color, transition: 'all 0.15s',
                  lineHeight: 1.6, wordBreak: 'keep-all', display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                <span style={{ fontWeight: 800, fontSize: 15, flexShrink: 0, marginTop: 1 }}>
                  {showAnswer
                    ? (opt === q.correctAnswer ? '✅' : opt === selected ? '❌' : ['①','②','③','④'][i])
                    : ['①','②','③','④'][i]}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {/* 타임아웃 메시지 */}
        {isTimeout && (
          <div style={{ marginTop: 10, padding: '12px 16px', borderRadius: 12, background: 'var(--warning-light)', border: '1px solid oklch(92% 0.10 90)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'oklch(35% 0.12 75)', marginBottom: q?.explanation ? 6 : 0 }}>
              ⏰ 시간 초과! 정답: <strong>{q?.correctAnswer}</strong>
            </div>
            {q?.explanation && (
              <div style={{ fontSize: 13, color: 'var(--neutral-700)', lineHeight: 1.7 }}>
                💡 {q.explanation}
              </div>
            )}
          </div>
        )}

        {/* 정답/오답 즉시 표시 + 해설 */}
        {showAnswer && !isTimeout && (
          <div style={{
            marginTop: 10, padding: '12px 16px', borderRadius: 12,
            background: isCorrect ? 'var(--success-light)' : 'var(--destructive-light)',
            border: isCorrect ? '1px solid oklch(90% 0.06 145)' : '1px solid oklch(88% 0.06 25)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: isCorrect ? 'oklch(38% 0.10 150)' : 'oklch(48% 0.20 25)', marginBottom: q?.explanation ? 6 : 0 }}>
              {isCorrect ? '🎉 정답입니다!' : `❌ 오답! 정답: ${q?.correctAnswer}`}
            </div>
            {q?.explanation && (
              <div style={{ fontSize: 13, color: 'var(--neutral-700)', lineHeight: 1.7 }}>
                💡 {q.explanation}
              </div>
            )}
          </div>
        )}

        {!showAnswer ? (
          <button className="btn btn-primary" onClick={handleConfirmAnswer} disabled={!selected}
            style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 700, marginTop: 12 }}>
            확인
          </button>
        ) : (
          <button className="btn btn-primary" onClick={nextQuestion}
            style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 700, marginTop: 12 }}>
            {currentIdx + 1 < questions.length ? '다음 문제 →' : '결과 보기'}
          </button>
        )}

        <BottomTabBar />
      </div>
    );
  }

  // ===== RESULT 화면 =====
  if (phase === 'result' && result) {
    const pct = Math.round((result.correct / result.total) * 100);
    const grade = pct >= 90 ? 'S' : pct >= 70 ? 'A' : pct >= 50 ? 'B' : 'C';
    const gradeColor = { S: 'var(--warning)', A: 'var(--success)', B: 'var(--info)', C: 'var(--destructive)' }[grade];
    const gradeMsg = { S: '완벽해요! 🏆', A: '잘했어요! 👍', B: '괜찮아요 💪', C: '다시 도전! 🔥' }[grade];

    return (
      <div className="content s-page s-page-wide" style={{ paddingBottom: 96 }}>
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{grade}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: gradeColor, marginTop: 4 }}>{gradeMsg}</div>
          <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 8 }}>
            {result.correct}개 정답 / {result.total}문제 ({pct}%)
          </div>
          <div style={{
            display: 'inline-block', marginTop: 14, padding: '10px 24px',
            background: 'linear-gradient(135deg, oklch(55% 0.18 270), oklch(45% 0.18 310))',
            color: 'white', borderRadius: 20, fontSize: 18, fontWeight: 800
          }}>
            +{result.xpEarned} XP
          </div>
          {result.leveledUp && <LevelUpNotification level={result.newLevel} />}
        </div>

        {/* 문제별 결과 */}
        <div className="card" style={{ padding: 16, marginTop: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📋 문제별 해설</h3>
          {result.details.map((d, i) => (
            <div key={i} style={{
              padding: '12px 14px', marginBottom: 8, borderRadius: 10,
              background: d.correct ? 'var(--success-light)' : 'var(--destructive-light)',
              border: d.correct ? '1px solid oklch(90% 0.06 145)' : '1px solid oklch(88% 0.06 25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: d.explanation ? 6 : 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: d.correct ? 'oklch(38% 0.10 150)' : 'oklch(48% 0.20 25)' }}>
                  {d.correct ? '✅' : '❌'} 문제 {i + 1}
                </span>
                {!d.correct && d.correctAnswer && (
                  <span style={{ fontSize: 12, color: 'oklch(30% 0.12 145)', fontWeight: 600 }}>
                    → 정답: {d.correctAnswer}
                  </span>
                )}
              </div>
              {d.explanation && (
                <div style={{ fontSize: 12, color: 'var(--neutral-700)', lineHeight: 1.7, borderTop: '1px solid oklch(0% 0 0 / 0.06)', paddingTop: 6 }}>
                  💡 {d.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary"
            onClick={() => { setPhase('select'); setResult(null); setTodayCount(prev => prev + questions.length); }}
            style={{ flex: 1, padding: 14, fontSize: 14, fontWeight: 700 }}>한 번 더!</button>
          <button className="btn btn-outline" onClick={() => navigate('/student/game')}
            style={{ flex: 1, padding: 14, fontSize: 14 }}>게임 홈</button>
        </div>

        <BottomTabBar />
      </div>
    );
  }

  return null;
}
