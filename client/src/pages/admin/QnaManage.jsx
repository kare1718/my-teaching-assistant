import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';

export default function QnAManage() {
  const [questions, setQuestions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('all'); // 'all' | 'summary' | 'guidelines'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentQuestions, setStudentQuestions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [msg, setMsg] = useState('');
  // 답변 기준
  const [guidelines, setGuidelines] = useState([]);
  const [editingGuide, setEditingGuide] = useState(null);
  const [guideForm, setGuideForm] = useState({ title: '', content: '' });

  const loadQuestions = () => {
    api('/questions/all').then(setQuestions).catch(console.error);
  };

  const loadSummary = () => {
    api('/questions/summary').then(setSummary).catch(console.error);
  };

  const loadStudentQuestions = (studentId, studentName) => {
    api(`/questions/student/${studentId}`).then((data) => {
      setStudentQuestions(data);
      setSelectedStudent({ id: studentId, name: studentName });
    }).catch(console.error);
  };

  const loadGuidelines = () => {
    api('/questions/guidelines').then(setGuidelines).catch(console.error);
  };

  useEffect(() => { loadQuestions(); loadSummary(); loadGuidelines(); }, []);

  const submitAnswer = async (id) => {
    if (!editAnswer.trim()) return;
    try {
      await apiPut(`/questions/${id}/answer`, { answer: editAnswer.trim() });
      setMsg('답변이 등록되었습니다.');
      setEditingId(null);
      setEditAnswer('');
      loadQuestions();
      if (selectedStudent) loadStudentQuestions(selectedStudent.id, selectedStudent.name);
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm('이 질문을 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/questions/${id}`);
      setMsg('질문이 삭제되었습니다.');
      loadQuestions();
      loadSummary();
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

  const renderQuestionItem = (q) => (
    <div key={q.id} style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: 16, marginBottom: 12,
      borderLeft: q.status === 'pending' ? '4px solid #f59e0b' : '4px solid #22c55e'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <span style={{ fontWeight: 600 }}>{q.student_name || selectedStudent?.name}</span>
          {q.school && <span style={{ color: 'var(--muted-foreground)', fontSize: 12, marginLeft: 8 }}>{q.school} {q.grade}</span>}
          <span style={{ color: 'var(--muted-foreground)', fontSize: 11, marginLeft: 8 }}>{formatDate(q.created_at)}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <span className={`badge ${q.status === 'answered' ? 'badge-success' : 'badge-warning'}`}>
            {q.status === 'answered' ? '답변완료' : '미답변'}
          </span>
          <button className="btn btn-danger btn-sm" onClick={() => deleteQuestion(q.id)} style={{ fontSize: 10, padding: '2px 6px' }}>삭제</button>
        </div>
      </div>

      <div style={{ background: 'var(--muted)', padding: '10px 14px', borderRadius: 8, marginBottom: 10, fontSize: 14, lineHeight: 1.6 }}>
        <strong>Q.</strong> {q.question || '(이미지 질문)'}
        {q.image && (
          <img src={q.image} alt="첨부" style={{ display: 'block', maxWidth: '100%', maxHeight: 200, borderRadius: 6, marginTop: 8 }} />
        )}
      </div>

      {q.answer && editingId !== q.id && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 14, lineHeight: 1.6, border: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
          <strong style={{ color: 'var(--primary)' }}>A. 강인쌤</strong>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 8 }}>{formatDate(q.answered_at)}</span>
          <div style={{ marginTop: 6 }}>{q.answer}</div>
        </div>
      )}

      {editingId === q.id ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={editAnswer}
            onChange={(e) => setEditAnswer(e.target.value)}
            placeholder="답변을 입력하세요..."
            style={{ width: '100%', minHeight: 80, fontSize: 14 }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={() => submitAnswer(q.id)}>저장</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditingId(null); setEditAnswer(''); }}>취소</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => { setEditingId(q.id); setEditAnswer(q.answer || ''); }}>
            {q.answer ? '답변 수정' : '직접 답변하기'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>질문 관리</span>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {/* 뷰 전환 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          className={`btn ${view === 'all' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setView('all'); setSelectedStudent(null); }}
        >💬 전체 질문</button>
        <button
          className={`btn ${view === 'summary' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setView('summary'); setSelectedStudent(null); }}
        >📊 학생별 누적</button>
        <button
          className={`btn ${view === 'guidelines' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setView('guidelines'); setSelectedStudent(null); }}
        >📋 답변 기준</button>
      </div>

      {/* 학생별 누적 보기 */}
      {view === 'summary' && !selectedStudent && (
        <div className="card">
          <h2>📊 학생별 질문 누적 현황</h2>
          {summary.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30 }}>질문 데이터가 없습니다.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>학생</th>
                  <th>학교/학년</th>
                  <th>총 질문</th>
                  <th>답변 완료</th>
                  <th>최근 질문</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.student_id}>
                    <td style={{ fontWeight: 600 }}>{s.student_name}</td>
                    <td style={{ fontSize: 13 }}>{s.school} {s.grade}</td>
                    <td style={{ fontWeight: 600 }}>{s.total_questions}건</td>
                    <td>{s.answered_count}건</td>
                    <td style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{formatDate(s.last_question_at)}</td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => loadStudentQuestions(s.student_id, s.student_name)}
                      >상세보기</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 학생 개별 질문 상세 */}
      {view === 'summary' && selectedStudent && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>📋 {selectedStudent.name}님의 질문 ({studentQuestions.length}건)</h2>
            <button className="btn btn-outline btn-sm" onClick={() => setSelectedStudent(null)}>← 목록으로</button>
          </div>
          {studentQuestions.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30 }}>질문이 없습니다.</p>
          ) : (
            studentQuestions.map((q) => renderQuestionItem(q))
          )}
        </div>
      )}

      {/* 전체 질문 보기 */}
      {view === 'all' && (
        <div className="card">
          <h2>💬 학생 질문 관리</h2>
          <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>
              전체 ({questions.length})
            </button>
            <button className={`btn btn-sm ${filter === 'pending' ? 'btn-warning' : 'btn-outline'}`} onClick={() => setFilter('pending')}>
              미답변 ({pendingCount})
            </button>
            <button className={`btn btn-sm ${filter === 'answered' ? 'btn-success' : 'btn-outline'}`} onClick={() => setFilter('answered')}>
              답변완료 ({answeredCount})
            </button>
          </div>

          {filtered.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30 }}>질문이 없습니다.</p>
          ) : (
            filtered.map((q) => renderQuestionItem(q))
          )}
        </div>
      )}

      {/* 답변 기준 관리 */}
      {view === 'guidelines' && (
        <div className="card">
          <h2>📋 답변 기준 관리</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 16 }}>
            학생 질문에 답변할 때 참고할 기준을 등록하세요. 답변 시 기준을 확인할 수 있습니다.
          </p>

          {/* 추가/수정 폼 */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              {editingGuide ? '기준 수정' : '새 기준 추가'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                placeholder="기준 제목 (예: 수업 관련 질문)"
                value={guideForm.title}
                onChange={e => setGuideForm({ ...guideForm, title: e.target.value })}
              />
              <textarea
                placeholder="답변 기준 내용을 입력하세요..."
                value={guideForm.content}
                onChange={e => setGuideForm({ ...guideForm, content: e.target.value })}
                style={{ minHeight: 100, fontSize: 14 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  if (!guideForm.title.trim() || !guideForm.content.trim()) { setMsg('제목과 내용을 입력해주세요.'); return; }
                  try {
                    if (editingGuide) {
                      await apiPut(`/questions/guidelines/${editingGuide}`, guideForm);
                    } else {
                      await apiPost('/questions/guidelines', guideForm);
                    }
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
          </div>

          {/* 기준 목록 */}
          {guidelines.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30 }}>등록된 답변 기준이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {guidelines.map(g => (
                <div key={g.id} style={{
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  padding: 14, borderLeft: '4px solid var(--primary)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{g.title}</h4>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => {
                        setEditingGuide(g.id);
                        setGuideForm({ title: g.title, content: g.content });
                      }} style={{ fontSize: 11 }}>수정</button>
                      <button className="btn btn-danger btn-sm" onClick={async () => {
                        if (!window.confirm('이 기준을 삭제하시겠습니까?')) return;
                        await apiDelete(`/questions/guidelines/${g.id}`);
                        setMsg('삭제되었습니다.');
                        loadGuidelines();
                        setTimeout(() => setMsg(''), 2000);
                      }} style={{ fontSize: 11 }}>삭제</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {g.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
