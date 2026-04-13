import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';

export default function QnAManage() {
  const [questions, setQuestions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedQ, setSelectedQ] = useState(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [msg, setMsg] = useState('');

  // 답변 기준
  const [guidelines, setGuidelines] = useState([]);
  const [showGuides, setShowGuides] = useState(false);
  const [editingGuide, setEditingGuide] = useState(null);
  const [guideForm, setGuideForm] = useState({ title: '', content: '' });

  // 학생별 보기
  const [viewMode, setViewMode] = useState('questions'); // 'questions' | 'students'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentQuestions, setStudentQuestions] = useState([]);

  const loadQuestions = () => api('/questions/all').then(setQuestions).catch(console.error);
  const loadSummary = () => api('/questions/summary').then(setSummary).catch(console.error);
  const loadGuidelines = () => api('/questions/guidelines').then(setGuidelines).catch(console.error);

  const loadStudentQuestions = (studentId, studentName) => {
    api(`/questions/student/${studentId}`).then((data) => {
      setStudentQuestions(data);
      setSelectedStudent({ id: studentId, name: studentName });
    }).catch(console.error);
  };

  useEffect(() => { loadQuestions(); loadSummary(); loadGuidelines(); }, []);

  const submitAnswer = async (id) => {
    if (!editAnswer.trim()) return;
    try {
      await apiPut(`/questions/${id}/answer`, { answer: editAnswer.trim() });
      setMsg('답변이 등록되었습니다.');
      setEditAnswer('');
      loadQuestions();
      if (selectedQ?.id === id) setSelectedQ(prev => ({ ...prev, answer: editAnswer.trim(), status: 'answered' }));
      if (selectedStudent) loadStudentQuestions(selectedStudent.id, selectedStudent.name);
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm('이 질문을 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/questions/${id}`);
      setMsg('질문이 삭제되었습니다.');
      if (selectedQ?.id === id) setSelectedQ(null);
      loadQuestions(); loadSummary();
      if (selectedStudent) loadStudentQuestions(selectedStudent.id, selectedStudent.name);
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const filtered = filter === 'all' ? questions :
    filter === 'answered' ? questions.filter(q => q.status === 'answered') :
    questions.filter(q => q.status === 'pending');

  const pendingCount = questions.filter(q => q.status === 'pending').length;
  const answeredCount = questions.filter(q => q.status === 'answered').length;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 질문 리스트에서 표시할 목록 (학생별 모드일 때 분기)
  const displayQuestions = viewMode === 'students' && selectedStudent ? studentQuestions : filtered;

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>질문 관리</span>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 'var(--space-2)' }}>{msg}</div>}

      {/* 가로 2열: 왼쪽 질문목록 | 오른쪽 답변패널 */}
      <div className="qna-layout" style={{ display: 'grid', gridTemplateColumns: '1fr min(400px, 40vw)', gap: 14, alignItems: 'start' }}>

        {/* 왼쪽: 질문 목록 */}
        <div>
          {/* 뷰 전환 + 필터 */}
          <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className={`btn btn-sm ${viewMode === 'questions' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setViewMode('questions'); setSelectedStudent(null); }}>💬 전체 질문</button>
            <button className={`btn btn-sm ${viewMode === 'students' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setViewMode('students'); setSelectedStudent(null); setSelectedQ(null); }}>📊 학생별</button>
            <span style={{ borderLeft: '1px solid var(--border)', margin: '0 2px' }} />
            {viewMode === 'questions' && (
              <>
                <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>
                  전체 ({questions.length})
                </button>
                <button className={`btn btn-sm ${filter === 'pending' ? 'btn-warning' : 'btn-outline'}`} onClick={() => setFilter('pending')}>
                  미답변 ({pendingCount})
                </button>
                <button className={`btn btn-sm ${filter === 'answered' ? 'btn-success' : 'btn-outline'}`} onClick={() => setFilter('answered')}>
                  답변완료 ({answeredCount})
                </button>
              </>
            )}
            <button className={`btn btn-sm ${showGuides ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowGuides(!showGuides)} style={{ marginLeft: 'auto' }}>
              📋 답변 기준
            </button>
          </div>

          {/* 학생별 모드: 학생 목록 or 학생 질문 */}
          {viewMode === 'students' && !selectedStudent && (
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-3)' }}>📊 학생별 질문 현황</h3>
              {summary.length === 0 ? (
                <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30, fontSize: 13 }}>질문 데이터가 없습니다.</p>
              ) : (
                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                  {summary.map(s => (
                    <div key={s.student_id} onClick={() => loadStudentQuestions(s.student_id, s.student_name)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                        marginBottom: 'var(--space-1)', cursor: 'pointer', transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{s.student_name}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 6 }}>{s.school} {s.grade}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>{s.total_questions}건</span>
                        {s.total_questions - s.answered_count > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--warning-light)', color: 'oklch(35% 0.12 75)' }}>
                            미답변 {s.total_questions - s.answered_count}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 학생별 모드: 선택된 학생 질문 or 전체 질문 */}
          {(viewMode === 'questions' || (viewMode === 'students' && selectedStudent)) && (
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  {selectedStudent ? `📋 ${selectedStudent.name}님의 질문` : '💬 질문 목록'}
                </h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>{displayQuestions.length}건</span>
                  {selectedStudent && (
                    <button className="btn btn-outline btn-sm" onClick={() => setSelectedStudent(null)}>← 목록</button>
                  )}
                </div>
              </div>

              {displayQuestions.length === 0 ? (
                <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30, fontSize: 13 }}>질문이 없습니다.</p>
              ) : (
                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                  {displayQuestions.map(q => (
                    <div key={q.id} onClick={() => { setSelectedQ(q); setEditAnswer(q.answer || ''); }}
                      style={{
                        padding: 'var(--space-3) var(--space-3)', borderBottom: '1px solid var(--neutral-50)', cursor: 'pointer',
                        borderLeft: q.status === 'pending' ? '3px solid var(--warning)' : '3px solid var(--success)',
                        background: selectedQ?.id === q.id ? 'var(--info-light)' : 'transparent',
                        transition: 'background 0.15s',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{q.student_name || selectedStudent?.name}</span>
                          {q.school && <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>{q.school} {q.grade}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{formatDate(q.created_at)}</span>
                          <span className={`badge ${q.status === 'answered' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                            {q.status === 'answered' ? '답변완료' : '미답변'}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5 }}>
                        {(q.question || '(이미지 질문)').length > 80
                          ? (q.question || '(이미지 질문)').slice(0, 80) + '...'
                          : (q.question || '(이미지 질문)')}
                      </div>
                      {q.image && <span style={{ fontSize: 11, color: 'var(--primary)' }}>📷 이미지 첨부</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 오른쪽: 답변 패널 + 답변 기준 */}
        <div>
          {/* 선택된 질문 상세 + 답변 */}
          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: showGuides ? 10 : 0 }}>
            {!selectedQ ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)' }}>
                <div style={{ fontSize: 32, marginBottom: 'var(--space-2)' }}>💬</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>질문을 선택하세요</div>
                <div style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>왼쪽 목록에서 질문을 클릭하면 여기에 표시됩니다</div>
              </div>
            ) : (
              <>
                {/* 질문 내용 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedQ.student_name}</span>
                    {selectedQ.school && <span style={{ color: 'var(--muted-foreground)', fontSize: 12, marginLeft: 6 }}>{selectedQ.school} {selectedQ.grade}</span>}
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{formatDate(selectedQ.created_at)}</div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteQuestion(selectedQ.id)} style={{ fontSize: 10, padding: '2px 6px' }}>삭제</button>
                </div>

                <div style={{ background: 'var(--muted)', padding: 'var(--space-3) var(--space-3)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                  <strong>Q.</strong> {selectedQ.question || '(이미지 질문)'}
                  {selectedQ.image && (
                    <img src={selectedQ.image} alt="첨부" style={{ display: 'block', maxWidth: '100%', maxHeight: 300, borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-2)', cursor: 'pointer' }}
                      onClick={() => window.open(selectedQ.image, '_blank')} />
                  )}
                </div>

                {/* 기존 답변 표시 */}
                {selectedQ.answer && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, lineHeight: 1.6, border: '1px solid var(--border)', marginBottom: 'var(--space-3)', whiteSpace: 'pre-wrap' }}>
                    <strong style={{ color: 'var(--primary)' }}>A. 선생님</strong>
                    {selectedQ.answered_at && <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 'var(--space-2)' }}>{formatDate(selectedQ.answered_at)}</span>}
                    <div style={{ marginTop: 'var(--space-1)' }}>{selectedQ.answer}</div>
                  </div>
                )}

                {/* 답변 입력 */}
                <div>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>
                    {selectedQ.answer ? '답변 수정' : '답변 작성'}
                  </label>
                  <textarea
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    placeholder="답변을 입력하세요..."
                    rows={4}
                    style={{ width: '100%', padding: 'var(--space-2) 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <button className="btn btn-primary" onClick={() => submitAnswer(selectedQ.id)} disabled={!editAnswer.trim()}
                    style={{ width: '100%', marginTop: 'var(--space-1)' }}>
                    {selectedQ.answer ? '답변 수정' : '답변 등록'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 답변 기준 (토글) */}
          {showGuides && (
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 10 }}>📋 답변 기준</h3>

              {/* 기준 추가 폼 */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>{editingGuide ? '기준 수정' : '새 기준 추가'}</div>
                <input placeholder="기준 제목" value={guideForm.title}
                  onChange={e => setGuideForm({ ...guideForm, title: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, marginBottom: 'var(--space-1)', boxSizing: 'border-box' }} />
                <textarea placeholder="답변 기준 내용" value={guideForm.content}
                  onChange={e => setGuideForm({ ...guideForm, content: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                  <button className="btn btn-primary btn-sm" onClick={async () => {
                    if (!guideForm.title.trim() || !guideForm.content.trim()) { setMsg('제목과 내용을 입력해주세요.'); return; }
                    try {
                      if (editingGuide) { await apiPut(`/questions/guidelines/${editingGuide}`, guideForm); }
                      else { await apiPost('/questions/guidelines', guideForm); }
                      setGuideForm({ title: '', content: '' });
                      setEditingGuide(null);
                      setMsg(editingGuide ? '기준이 수정되었습니다.' : '기준이 추가되었습니다.');
                      loadGuidelines();
                      setTimeout(() => setMsg(''), 2000);
                    } catch (e) { setMsg(e.message); }
                  }}>{editingGuide ? '수정' : '추가'}</button>
                  {editingGuide && (
                    <button className="btn btn-outline btn-sm" onClick={() => { setEditingGuide(null); setGuideForm({ title: '', content: '' }); }}>취소</button>
                  )}
                </div>
              </div>

              {/* 기준 목록 */}
              {guidelines.length === 0 ? (
                <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 'var(--space-4)', fontSize: 13 }}>등록된 답변 기준이 없습니다.</p>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {guidelines.map(g => (
                    <div key={g.id} style={{
                      border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 10, marginBottom: 'var(--space-1)',
                      borderLeft: '3px solid var(--primary)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-1)' }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{g.title}</h4>
                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => {
                            setEditingGuide(g.id);
                            setGuideForm({ title: g.title, content: g.content });
                          }} style={{ fontSize: 10, padding: '1px 6px' }}>수정</button>
                          <button className="btn btn-danger btn-sm" onClick={async () => {
                            if (!window.confirm('이 기준을 삭제하시겠습니까?')) return;
                            await apiDelete(`/questions/guidelines/${g.id}`);
                            setMsg('삭제되었습니다.');
                            loadGuidelines();
                            setTimeout(() => setMsg(''), 2000);
                          }} style={{ fontSize: 10, padding: '1px 6px' }}>삭제</button>
                        </div>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--foreground)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {g.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .qna-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
