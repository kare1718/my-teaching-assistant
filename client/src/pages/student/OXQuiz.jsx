import { useState, useEffect, useRef } from 'react';
import { api, apiPost, apiUpload } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';

export default function OXQuiz() {
  const [phase, setPhase] = useState('select'); // select, quiz, result
  const [quizMode, setQuizMode] = useState('literature'); // literature, nonfiction
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 문학 입력
  const [author, setAuthor] = useState('');
  const [work, setWork] = useState('');

  // 비문학 입력
  const [inputMethod, setInputMethod] = useState('text'); // text, image
  const [nfText, setNfText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileRef = useRef(null);

  // 퀴즈 데이터
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // [{selected, correct}]
  const [showAnswer, setShowAnswer] = useState(false);
  const [extractedText, setExtractedText] = useState('');

  // 기록
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api('/ox-quiz/my-logs').then(setLogs).catch(() => {});
  }, []);

  // 이미지 선택
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  // 문제 생성
  const generateQuiz = async () => {
    setLoading(true);
    setError('');

    try {
      let data;

      if (quizMode === 'literature') {
        if (!author.trim() || !work.trim()) { setError('작가명과 작품명을 모두 입력해주세요.'); setLoading(false); return; }
        data = await apiPost('/ox-quiz/generate', { author: author.trim(), work: work.trim() });
      } else {
        if (inputMethod === 'text') {
          if (nfText.trim().length < 50) { setError('지문은 50자 이상 입력해주세요.'); setLoading(false); return; }
          data = await apiPost('/ox-quiz/generate-text', { text: nfText.trim() });
        } else {
          if (!imageFile) { setError('이미지를 선택해주세요.'); setLoading(false); return; }
          const formData = new FormData();
          formData.append('image', imageFile);
          data = await apiUpload('/ox-quiz/generate-image', formData);
        }
      }

      if (data.extractedText) setExtractedText(data.extractedText);
      setQuestions(data.questions);
      setAnswers([]);
      setCurrentIdx(0);
      setShowAnswer(false);
      setPhase('quiz');
    } catch (e) {
      setError(e.message || '문제 생성에 실패했습니다.');
    }
    setLoading(false);
  };

  // 답 선택
  const selectAnswer = (ans) => {
    if (showAnswer) return;
    const q = questions[currentIdx];
    const correct = q.answer === ans;
    setAnswers(prev => [...prev, { selected: ans, correct }]);
    setShowAnswer(true);
  };

  // 다음 문제
  const nextQuestion = () => {
    if (currentIdx + 1 >= questions.length) {
      // 결과 화면으로
      setPhase('result');
      // 결과 저장
      const correctCount = [...answers].filter(a => a.correct).length;
      const inputData = quizMode === 'literature' ? { author, work } : { text: nfText.slice(0, 100) + '...' };
      apiPost('/ox-quiz/save-result', {
        quizType: quizMode,
        inputData,
        totalQuestions: questions.length,
        correctCount,
        questionsJson: questions.map((q, i) => ({ ...q, userAnswer: answers[i]?.selected })),
      }).catch(() => {});
      return;
    }
    setCurrentIdx(prev => prev + 1);
    setShowAnswer(false);
  };

  // 처음으로
  const goHome = () => {
    setPhase('select');
    setQuestions([]);
    setAnswers([]);
    setCurrentIdx(0);
    setShowAnswer(false);
    setExtractedText('');
    setError('');
    api('/ox-quiz/my-logs').then(setLogs).catch(() => {});
  };

  const correctCount = answers.filter(a => a.correct).length;
  const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  // === SELECT PHASE ===
  if (phase === 'select') {
    return (
      <div className="content">
        {/* 헤더 */}
        <div style={{
          padding: '18px 16px', textAlign: 'center', borderRadius: 14,
          background: 'white', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 2 }}>O/X 퀴즈</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>AI가 수능 스타일 O/X 문제를 생성합니다</div>
        </div>

        {/* 모드 선택 탭 */}
        <div style={{ display: 'flex', gap: 0, marginTop: 10, marginBottom: 10, background: 'var(--muted)', borderRadius: 10, padding: 3 }}>
          {[
            { id: 'literature', label: '문학', icon: '📚' },
            { id: 'nonfiction', label: '비문학', icon: '📖' },
          ].map(m => (
            <button key={m.id} onClick={() => { setQuizMode(m.id); setError(''); }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: quizMode === m.id ? 'white' : 'transparent',
                color: quizMode === m.id ? '#1e293b' : '#94a3b8',
                fontWeight: 700, fontSize: 14,
                boxShadow: quizMode === m.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* 입력 영역 */}
        <div className="card" style={{ padding: 16 }}>
          {quizMode === 'literature' ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>작품 정보</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="작가명"
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                <input value={work} onChange={e => setWork(e.target.value)} placeholder="작품명"
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                예) 윤동주 / 서시, 김소월 / 진달래꽃
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 0, marginBottom: 10, background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
                {[
                  { id: 'text', label: '✍️ 텍스트' },
                  { id: 'image', label: '📷 사진' },
                ].map(m => (
                  <button key={m.id} onClick={() => setInputMethod(m.id)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: inputMethod === m.id ? 'white' : 'transparent',
                    color: inputMethod === m.id ? '#1e293b' : '#94a3b8',
                    fontWeight: 600, fontSize: 12,
                    boxShadow: inputMethod === m.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}>{m.label}</button>
                ))}
              </div>

              {inputMethod === 'text' ? (
                <>
                  <textarea value={nfText} onChange={e => setNfText(e.target.value)}
                    placeholder="비문학 지문을 여기에 붙여넣으세요..."
                    rows={6}
                    style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7 }} />
                  <div style={{ fontSize: 11, color: nfText.length < 50 ? '#ef4444' : '#22c55e', marginTop: 4, textAlign: 'right' }}>
                    {nfText.length}자 {nfText.length < 50 ? '(50자 이상)' : '✓'}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  {imagePreview ? (
                    <div>
                      <img src={imagePreview} alt="" style={{ maxWidth: '100%', maxHeight: 250, borderRadius: 8, border: '1px solid var(--border)' }} />
                      <button onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                        style={{ display: 'block', margin: '8px auto', fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: '#ef4444' }}>
                        제거
                      </button>
                    </div>
                  ) : (
                    <div onClick={() => fileRef.current?.click()} style={{
                      padding: '30px 20px', border: '2px dashed #d1d5db', borderRadius: 10,
                      cursor: 'pointer', color: '#94a3b8',
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>사진 선택</div>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImageChange}
                    style={{ display: 'none' }} />
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button onClick={generateQuiz} disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 4 }}>
          {loading ? '생성 중...' : '문제 생성하기'}
        </button>

        {/* 풀이 기록 */}
        {logs.length > 0 && (
          <div className="card" style={{ padding: 14, marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#374151' }}>최근 기록</div>
            {logs.slice(0, 5).map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>
                  {l.quiz_type === 'literature' ? '📚' : '📖'} {l.quiz_type === 'literature' ? `${l.input_data?.author || ''} - ${l.input_data?.work || ''}` : '비문학'}
                </span>
                <span style={{ fontWeight: 700, color: l.correct_count >= 7 ? '#22c55e' : l.correct_count >= 5 ? '#f59e0b' : '#ef4444' }}>
                  {l.correct_count}/{l.total_questions}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 로딩 오버레이 */}
        {loading && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 999,
          }}>
            <div style={{ background: 'white', borderRadius: 16, padding: '32px 40px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>문제 생성 중</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>약 5~10초 소요...</div>
            </div>
          </div>
        )}

        <BottomTabBar />
      </div>
    );
  }

  // === QUIZ PHASE ===
  if (phase === 'quiz') {
    const q = questions[currentIdx];
    const currentAnswer = answers[currentIdx];
    const progress = ((currentIdx + (showAnswer ? 1 : 0)) / questions.length) * 100;

    return (
      <div className="content">
        {/* 진행바 */}
        <div style={{ background: 'var(--muted)', borderRadius: 20, height: 8, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(90deg, #2563eb, #06b6d4)', height: '100%', width: `${progress}%`, transition: 'width 0.3s', borderRadius: 20 }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 12, fontWeight: 600 }}>
          {currentIdx + 1} / {questions.length}
        </div>

        {/* 진술문 카드 */}
        <div className="card" style={{
          padding: '24px 20px', marginBottom: 16, borderRadius: 16,
          background: showAnswer
            ? (currentAnswer?.correct ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : 'linear-gradient(135deg, #fef2f2, #fee2e2)')
            : 'white',
          border: showAnswer
            ? `2px solid ${currentAnswer?.correct ? '#22c55e' : '#ef4444'}`
            : '1px solid var(--border)',
          transition: 'all 0.3s',
        }}>
          <div style={{ fontSize: 15, lineHeight: 1.8, fontWeight: 500, color: '#1e293b' }}>
            {q?.statement}
          </div>
        </div>

        {/* O/X 버튼 */}
        {!showAnswer && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginBottom: 20 }}>
            <button onClick={() => selectAnswer(true)} style={{
              width: 110, height: 110, borderRadius: '50%', border: '4px solid #3b82f6',
              background: '#eff6ff', color: '#3b82f6', fontSize: 44, fontWeight: 900,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.15s', boxShadow: '0 4px 12px rgba(59,130,246,0.2)',
            }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
               onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
              O
            </button>
            <button onClick={() => selectAnswer(false)} style={{
              width: 110, height: 110, borderRadius: '50%', border: '4px solid #ef4444',
              background: '#fef2f2', color: '#ef4444', fontSize: 44, fontWeight: 900,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.15s', boxShadow: '0 4px 12px rgba(239,68,68,0.2)',
            }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
               onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
              X
            </button>
          </div>
        )}

        {/* 정답/해설 */}
        {showAnswer && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              textAlign: 'center', fontSize: 24, fontWeight: 900, marginBottom: 8,
              color: currentAnswer?.correct ? '#22c55e' : '#ef4444',
            }}>
              {currentAnswer?.correct ? '🎉 정답!' : '😢 오답'}
            </div>

            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: q?.answer ? '#eff6ff' : '#fef2f2',
              border: `1px solid ${q?.answer ? '#bfdbfe' : '#fecaca'}`,
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: q?.answer ? '#2563eb' : '#dc2626' }}>
                정답: {q?.answer ? 'O (참)' : 'X (거짓)'}
              </div>
              {q?.explanation && (
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                  💡 {q.explanation}
                </div>
              )}
            </div>

            <button onClick={nextQuestion} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: 'var(--primary)', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              {currentIdx + 1 >= questions.length ? '📊 결과 보기' : '다음 문제 →'}
            </button>
          </div>
        )}

        <BottomTabBar />
      </div>
    );
  }

  // === RESULT PHASE ===
  return (
    <div className="content">
      {/* 점수 카드 */}
      <div style={{
        background: percentage >= 70 ? 'linear-gradient(135deg, #059669, #10b981)' : percentage >= 50 ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'linear-gradient(135deg, #dc2626, #ef4444)',
        borderRadius: 16, padding: '28px 20px', textAlign: 'center', color: 'white', marginBottom: 12,
      }}>
        <div style={{ fontSize: 50, marginBottom: 8 }}>
          {percentage >= 90 ? '🎉' : percentage >= 70 ? '👍' : percentage >= 50 ? '💪' : '🔥'}
        </div>
        <div style={{ fontSize: 44, fontWeight: 900 }}>{correctCount}/{questions.length}</div>
        <div style={{ fontSize: 16, fontWeight: 600, opacity: 0.9, marginTop: 4 }}>정답률 {percentage}%</div>
        <div style={{ fontSize: 14, marginTop: 6, opacity: 0.8 }}>
          {percentage >= 90 ? '대단해요! 완벽에 가까워요!' : percentage >= 70 ? '잘했어요! 조금만 더 화이팅!' : percentage >= 50 ? '조금만 더 노력하면 됩니다!' : '다시 도전해봐요!'}
        </div>
      </div>

      {/* 상세 결과 */}
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📝 문제별 결과</h3>
        {questions.map((q, i) => {
          const ans = answers[i];
          return (
            <div key={i} style={{
              padding: '10px 12px', marginBottom: 8, borderRadius: 10,
              background: ans?.correct ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${ans?.correct ? '#bbf7d0' : '#fecaca'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)' }}>Q{i + 1}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: ans?.correct ? '#22c55e' : '#ef4444', color: 'white',
                }}>{ans?.correct ? '정답' : '오답'}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>{q.statement}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                내 답: <strong>{ans?.selected ? 'O' : 'X'}</strong> · 정답: <strong>{q.answer ? 'O' : 'X'}</strong>
              </div>
              {q.explanation && (
                <div style={{ fontSize: 12, color: '#374151', marginTop: 4, padding: '6px 8px', background: '#f8fafc', borderRadius: 6, lineHeight: 1.6 }}>
                  💡 {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => { setPhase('quiz'); setCurrentIdx(0); setAnswers([]); setShowAnswer(false); }}
          className="btn btn-outline" style={{ flex: 1, padding: 14 }}>
          🔄 다시 도전
        </button>
        <button onClick={goHome} className="btn btn-primary" style={{ flex: 1, padding: 14 }}>
          🏠 처음으로
        </button>
      </div>

      <BottomTabBar />
    </div>
  );
}
