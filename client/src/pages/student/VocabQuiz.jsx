import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';

const DEFAULT_TIMER = 10;

export default function VocabQuiz() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('select'); // select, quiz, result
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [result, setResult] = useState(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(false);
  const [todayQuizCount, setTodayQuizCount] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TIMER);
  const [quizLogId, setQuizLogId] = useState(null);
  const dailyQuizLimit = 50;

  // 타이머 관련
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMER);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    api('/gamification/my-character').then(data => {
      setTodayQuizCount(data.todayQuizCount || 0);
    }).catch(console.error);
    // 게임 설정 로드 (타이머 시간)
    api('/gamification/game-settings').then(data => {
      if (data.timer_seconds) {
        setTimerSeconds(data.timer_seconds);
        setTimeLeft(data.timer_seconds);
      }
    }).catch(() => {});
  }, []);

  // 타이머 만료 시 자동으로 오답 처리
  const handleTimeout = useCallback(() => {
    if (showAnswer) return;
    setSelected(null);
    setShowAnswer(true);
    setTimerActive(false);
    const q = questions[currentIdx];
    // 시간 초과 = 오답 (빈 답안 제출)
    setAnswers(prev => [...prev, { wordId: q.id, selectedAnswer: '__TIMEOUT__' }]);
  }, [showAnswer, questions, currentIdx]);

  // requestAnimationFrame 기반 부드러운 타이머
  useEffect(() => {
    if (!timerActive) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = timerSeconds - elapsed;

      if (remaining <= 0) {
        setTimeLeft(0);
        setTimerActive(false);
        handleTimeout();
        return;
      }

      setTimeLeft(remaining);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [timerActive, handleTimeout]);

  // 문제가 바뀔 때마다 타이머 리셋
  useEffect(() => {
    if (phase === 'quiz' && !showAnswer) {
      setTimeLeft(timerSeconds);
      setTimerActive(true);
    }
  }, [currentIdx, phase]);

  const startQuiz = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ count: questionCount });
      const data = await api(`/gamification/vocab/start?${params}`);
      const qs = data.questions || data;
      if (!qs || qs.length === 0) {
        alert('문제가 없습니다. 관리자에게 문의하세요.');
        setLoading(false);
        return;
      }
      setQuizLogId(data.logId || null);
      setQuestions(qs);
      setCurrentIdx(0);
      setAnswers([]);
      setStreak(0);
      setTimeLeft(timerSeconds);
      setPhase('quiz');
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  };

  const handleSelect = (option) => {
    if (showAnswer) return;
    setSelected(option);
  };

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
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    setLoading(true);
    setTimerActive(false);
    try {
      const r = await apiPost('/gamification/vocab/submit', { answers, logId: quizLogId });
      setResult(r);
      setPhase('result');
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  };

  // 타이머 바 색상 계산
  const getTimerColor = () => {
    const pct = timeLeft / timerSeconds;
    if (pct > 0.5) return '#22c55e';  // 초록
    if (pct > 0.25) return '#f59e0b'; // 주황
    return '#ef4444';                  // 빨강
  };

  const getTimerGlow = () => {
    const pct = timeLeft / timerSeconds;
    if (pct > 0.5) return 'none';
    if (pct > 0.25) return '0 0 8px rgba(245, 158, 11, 0.5)';
    return '0 0 12px rgba(239, 68, 68, 0.6)';
  };

  // 카테고리 선택
  if (phase === 'select') {
    return (
      <div className="content" style={{ paddingBottom: 80 }}>
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>📝 어휘 퀴즈</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>카테고리를 선택하고 퀴즈를 시작하세요!</p>
          <div style={{
            display: 'inline-block', marginTop: 8, padding: '4px 14px',
            background: todayQuizCount >= dailyQuizLimit ? '#fee2e2' : '#dbeafe',
            color: todayQuizCount >= dailyQuizLimit ? '#991b1b' : '#1e40af',
            borderRadius: 12, fontSize: 12, fontWeight: 600
          }}>
            오늘 {todayQuizCount}/{dailyQuizLimit}문제 풀었음
            {todayQuizCount >= dailyQuizLimit && ' (일일 제한 도달)'}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>문제 수</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {[5, 10, 15, 20].map(n => (
              <button
                key={n}
                onClick={() => setQuestionCount(n)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                  border: questionCount === n ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: questionCount === n ? 'var(--primary)' : 'var(--card)',
                  color: questionCount === n ? 'white' : 'var(--foreground)',
                  fontWeight: 600, fontSize: 14
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={startQuiz}
          disabled={loading}
          style={{ width: '100%', padding: 14, fontSize: 16, marginTop: 8 }}
        >
          {loading ? '로딩 중...' : '퀴즈 시작!'}
        </button>

        <button
          className="btn btn-outline"
          onClick={() => navigate('/student/game')}
          style={{ width: '100%', marginTop: 8 }}
        >
          ← 돌아가기
        </button>
        <BottomTabBar />
      </div>
    );
  }

  // 퀴즈 진행
  if (phase === 'quiz') {
    const q = questions[currentIdx];
    const progress = ((currentIdx + 1) / questions.length) * 100;
    const timerPct = (timeLeft / timerSeconds) * 100;
    const timerColor = getTimerColor();
    const isUrgent = timeLeft <= 3 && timeLeft > 0 && !showAnswer;

    return (
      <div className="content" style={{ paddingBottom: 80 }}>
        {/* 진행 바 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            <span>{currentIdx + 1} / {questions.length}</span>
            <span>답변: {answers.length}</span>
          </div>
          <div style={{ height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* ⏱ 타이머 바 */}
        <div style={{
          position: 'relative', marginBottom: 12,
          background: 'var(--muted)', borderRadius: 6, overflow: 'hidden',
          height: showAnswer ? 8 : 14,
          boxShadow: getTimerGlow(),
          transition: 'height 0.3s, box-shadow 0.3s'
        }}>
          <div style={{
            height: '100%',
            width: `${showAnswer ? 0 : timerPct}%`,
            background: `linear-gradient(90deg, ${timerColor}, ${timerColor}dd)`,
            borderRadius: 6,
            transition: showAnswer ? 'width 0.3s' : 'none',
          }} />
          {/* 타이머 숫자 (바 위에 표시) */}
          {!showAnswer && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              letterSpacing: 0.5,
            }}>
              {timeLeft > 0 ? `${Math.ceil(timeLeft)}초` : '⏰ 시간 초과!'}
            </div>
          )}
        </div>

        {/* 시간 초과 경고 애니메이션 */}
        {showAnswer && selected === null && (
          <div style={{
            textAlign: 'center', padding: '8px 0', marginBottom: 4,
            color: '#ef4444', fontWeight: 700, fontSize: 14,
            animation: 'fadeIn 0.3s ease'
          }}>
            ⏰ 시간 초과! 오답 처리됩니다.
          </div>
        )}

        {/* 문제 카드 */}
        <div className="card" style={{
          padding: 24, textAlign: 'center', minHeight: 120,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: isUrgent ? '2px solid #ef4444' : undefined,
          animation: isUrgent ? 'urgentPulse 0.5s ease-in-out infinite' : undefined,
          transition: 'border 0.3s'
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.6 }}>
            {q.questionText}
          </div>
        </div>

        {/* 선택지 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {q.options.map((opt, i) => {
            let bg = 'var(--card)';
            let borderColor = 'var(--border)';

            if (selected === opt && !showAnswer) {
              bg = '#dbeafe';
              borderColor = '#3b82f6';
            }
            if (showAnswer && selected === opt) {
              bg = '#dbeafe';
              borderColor = '#3b82f6';
            }
            if (showAnswer && selected === null) {
              bg = 'var(--muted)';
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(opt)}
                disabled={showAnswer}
                style={{
                  padding: '14px 16px', borderRadius: 10,
                  cursor: showAnswer ? 'default' : 'pointer',
                  border: `2px solid ${borderColor}`, background: bg,
                  textAlign: 'left', fontSize: 15,
                  fontWeight: selected === opt ? 600 : 400,
                  opacity: showAnswer && selected === null ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ marginRight: 10, fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  {['A', 'B', 'C', 'D'][i]}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {/* 선택 후 제출 버튼 (답 확정 전) */}
        {!showAnswer && selected && (
          <button
            className="btn btn-primary"
            onClick={handleConfirmAnswer}
            style={{ width: '100%', padding: 14, fontSize: 16, marginTop: 12 }}
          >
            ✓ 답 제출
          </button>
        )}

        {showAnswer && (
          <button
            className="btn btn-primary"
            onClick={nextQuestion}
            style={{ width: '100%', padding: 14, fontSize: 16, marginTop: 12 }}
          >
            {currentIdx + 1 < questions.length ? '다음 문제 →' : '결과 보기'}
          </button>
        )}

        {/* CSS 애니메이션 */}
        <style>{`
          @keyframes urgentPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            50% { box-shadow: 0 0 16px 4px rgba(239, 68, 68, 0.3); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <BottomTabBar />
      </div>
    );
  }

  // 결과
  if (phase === 'result' && result) {
    const pct = Math.round((result.correct / result.total) * 100);
    let emoji = '😢';
    if (pct >= 90) emoji = '🎉';
    else if (pct >= 70) emoji = '😊';
    else if (pct >= 50) emoji = '🙂';

    return (
      <div className="content" style={{ paddingBottom: 80 }}>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{emoji}</div>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>퀴즈 완료!</h2>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)', margin: '12px 0' }}>
            {result.correct} / {result.total}
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 16 }}>
            정답률 {pct}%
          </div>
          <div style={{
            display: 'inline-block', padding: '8px 20px', borderRadius: 12,
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            color: '#78350f', fontWeight: 700, fontSize: 16
          }}>
            +{result.xpEarned} XP 획득!
          </div>
          {result.leveledUp && (
            <div style={{
              marginTop: 16, padding: '14px 20px', borderRadius: 14,
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              color: 'white', animation: 'levelUpBounce 0.5s ease-out'
            }}>
              <div style={{ fontSize: 24 }}>🎉🎊🎉</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>LEVEL UP!</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>Lv.{result.newLevel}</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>축하합니다! 레벨이 올랐습니다!</div>
            </div>
          )}
          <style>{`
            @keyframes levelUpBounce {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.05); }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>

        {/* 상세 결과 */}
        {result.details && (
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>📋 상세 결과</h3>
            {result.details.map((d, i) => (
              <div key={i} style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                background: d.correct ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${d.correct ? '#bbf7d0' : '#fecaca'}`,
                fontSize: 13
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{d.correct ? '✅' : '❌'}</span>
                  <span style={{ fontWeight: 600 }}>문제 {i + 1}</span>
                  {d.timeout && <span style={{ fontSize: 10, color: '#ef4444' }}>⏰ 시간초과</span>}
                </div>
                {!d.correct && d.correctAnswer && (
                  <div style={{ marginTop: 4, color: '#166534', fontSize: 12 }}>
                    정답: {d.correctAnswer}
                  </div>
                )}
                {d.explanation && (
                  <div style={{ marginTop: 2, color: 'var(--muted-foreground)', fontSize: 11 }}>
                    💡 {d.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={() => { setPhase('select'); setResult(null); }}
            style={{ flex: 1 }}>다시 도전</button>
          <button className="btn btn-outline" onClick={() => navigate('/student/game')}
            style={{ flex: 1 }}>게임 홈</button>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  return null;
}
