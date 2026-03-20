import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';

const DAILY_LIMIT = 5;

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
  const [todayCount, setTodayCount] = useState(0);
  const [logId, setLogId] = useState(null);

  useEffect(() => {
    api('/gamification/reading/today-count').then(d => setTodayCount(d.count || 0)).catch(() => {});
  }, []);

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
      setTodayCount(prev => prev + 1); // 시작 즉시 횟수 차감
      setPhase('reading');
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const handleSelect = (option) => { if (!showAnswer) setSelected(option); };

  const handleConfirmAnswer = () => {
    if (showAnswer || !selected) return;
    setShowAnswer(true);
    const q = questions[currentQIdx];
    setAnswers(prev => [...prev, { questionId: q.id, selectedAnswer: selected }]);
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

  // ===== SELECT 화면 =====
  if (phase === 'select') {
    return (
      <div className="content" style={{ paddingBottom: 80 }}>
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>📖 비문학 독해</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>수능형 비문학 지문을 읽고 문제를 풀어보세요!</p>
          <div style={{
            display: 'inline-block', marginTop: 8, padding: '4px 14px',
            background: todayCount >= DAILY_LIMIT ? '#fee2e2' : '#dcfce7',
            color: todayCount >= DAILY_LIMIT ? '#991b1b' : '#166534',
            borderRadius: 12, fontSize: 12, fontWeight: 600
          }}>
            오늘 {todayCount}/{DAILY_LIMIT}지문
          </div>
        </div>

        {/* 안내 */}
        <div className="card" style={{ padding: 16, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.7 }}>
            💡 <strong>비문학 독해</strong>는 짧은 지문을 읽고 내용일치·추론 문제를 푸는 수능형 게임입니다.<br />
            ⏰ 시간 제한 없이 천천히 읽고 풀 수 있습니다.<br />
            🎯 지문당 2~3문제, 난이도별 XP를 획득합니다. (쉬움 10 / 보통 15 / 어려움 20 XP)<br />
            ⚡ <strong>시작 버튼을 누르는 순간 오늘 횟수가 차감됩니다.</strong>
          </div>
        </div>

        <button className="btn btn-primary" onClick={startReading} disabled={loading || todayCount >= DAILY_LIMIT}
          style={{ width: '100%', padding: 14, fontSize: 16, fontWeight: 700, marginTop: 8, background: todayCount >= DAILY_LIMIT ? '#d1d5db' : 'linear-gradient(135deg, #059669, #0d9488)' }}>
          {loading ? '로딩 중...' : todayCount >= DAILY_LIMIT ? '오늘 제한 도달' : '지문 시작!'}
        </button>

        <button className="btn btn-outline" onClick={() => navigate('/student/game')}
          style={{ width: '100%', padding: 12, fontSize: 14, marginTop: 8 }}>← 게임 홈</button>

        <BottomTabBar />
      </div>
    );
  }

  // ===== READING 화면 =====
  if (phase === 'reading' && passage) {
    const q = questions[currentQIdx];

    return (
      <div className="content" style={{ paddingBottom: 80 }}>
        {/* 상단 정보 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
              background: '#dcfce7', color: '#166534'
            }}>{CATEGORY_EMOJIS[passage.category]} {passage.category}</span>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{DIFF_LABELS[passage.difficulty]}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
            문제 {currentQIdx + 1}/{questions.length}
          </span>
        </div>

        {/* 진행 바 */}
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(currentQIdx / questions.length) * 100}%`, background: '#059669', transition: 'width 0.3s', borderRadius: 2 }} />
        </div>

        {/* 지문 */}
        <div className="card" style={{
          padding: 18, marginBottom: 12,
          background: '#fefce8', border: '1px solid #fde68a',
          maxHeight: 280, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
            📄 {passage.title}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.9, color: '#1c1917', wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>
            {passage.content}
          </div>
        </div>

        {/* 문제 */}
        <div className="card" style={{ padding: 16, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginBottom: 4 }}>
            [{q?.type}]
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, wordBreak: 'keep-all' }}>
            {q?.questionText}
          </div>
        </div>

        {/* 선택지 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q?.options.map((opt, i) => {
            let bg = '#f8fafc';
            let border = '1px solid var(--border)';
            let color = 'var(--foreground)';
            if (selected === opt && !showAnswer) {
              bg = '#dcfce7'; border = '2px solid #16a34a'; color = '#166534';
            }
            if (showAnswer && selected === opt) {
              bg = '#dbeafe'; border = '2px solid #3b82f6'; color = '#1d4ed8';
            }

            return (
              <button key={i} onClick={() => handleSelect(opt)} disabled={showAnswer}
                style={{
                  padding: '12px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                  textAlign: 'left', cursor: showAnswer ? 'default' : 'pointer',
                  background: bg, border, color, transition: 'all 0.15s',
                  lineHeight: 1.6, wordBreak: 'keep-all',
                }}>
                <span style={{ fontWeight: 700, marginRight: 8, color: '#059669' }}>
                  {['①', '②', '③', '④'][i]}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {!showAnswer ? (
          <button className="btn btn-primary" onClick={handleConfirmAnswer} disabled={!selected}
            style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 700, marginTop: 12, background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
            확인
          </button>
        ) : (
          <button className="btn btn-primary" onClick={nextQuestion}
            style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 700, marginTop: 12, background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
            {currentQIdx + 1 < questions.length ? '다음 문제 →' : '결과 보기'}
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
    const gradeColor = { S: '#eab308', A: '#22c55e', B: '#3b82f6', C: '#ef4444' }[grade];

    return (
      <div className="content" style={{ paddingBottom: 80 }}>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: gradeColor }}>{grade}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', marginTop: 4 }}>
            {result.passageTitle || '비문학 독해'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 4 }}>
            {result.correct}/{result.total} 정답 ({pct}%)
          </div>
          <div style={{
            display: 'inline-block', marginTop: 12, padding: '8px 20px',
            background: 'linear-gradient(135deg, #059669, #0d9488)',
            color: 'white', borderRadius: 20, fontSize: 16, fontWeight: 700
          }}>
            +{result.xpEarned} XP
          </div>
          {result.leveledUp && (
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#eab308' }}>
              🎉 레벨 업! Lv.{result.newLevel}
            </div>
          )}
        </div>

        {/* 문제별 결과 */}
        <div className="card" style={{ padding: 16, marginTop: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📋 문제별 결과</h3>
          {result.details.map((d, i) => (
            <div key={i} style={{
              padding: '10px 12px', marginBottom: 6, borderRadius: 8,
              background: d.correct ? '#f0fdf4' : '#fef2f2',
              border: d.correct ? '1px solid #bbf7d0' : '1px solid #fecaca',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {d.correct ? '✅' : '❌'} 문제 {i + 1}
                </span>
              </div>
              {!d.correct && d.correctAnswer && (
                <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>정답: {d.correctAnswer}</div>
              )}
              {d.explanation && (
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>💡 {d.explanation}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={() => { setPhase('select'); setResult(null); setPassage(null); setLogId(null); }}
            style={{ flex: 1, padding: 14, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
            다음 지문!</button>
          <button className="btn btn-outline" onClick={() => navigate('/student/game')}
            style={{ flex: 1, padding: 14, fontSize: 14 }}>게임 홈</button>
        </div>

        <BottomTabBar />
      </div>
    );
  }

  return null;
}
