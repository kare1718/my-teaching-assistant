import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete, authFileUrl } from '../../api';
import { askConfirm } from '../../lib/feedback';
import { Card, StatusBadge, EmptyState } from '../../components/ui';

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
    if (!await askConfirm('이 질문을 삭제하시겠습니까?')) return;
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
    <div className="main-content p-5 max-w-[1200px] mx-auto w-full">
      <div className="text-xs text-slate-400 mb-4">
        <Link to="/admin">대시보드</Link> &gt; <span>질문 관리</span>
      </div>

      {msg && <div className="px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 mb-4 text-sm font-semibold">{msg}</div>}

      {/* 가로 2열: 왼쪽 질문목록 | 오른쪽 답변패널 */}
      <div className="grid grid-cols-[1fr_min(400px,40vw)] max-md:grid-cols-1 gap-3.5 items-start">

        {/* 왼쪽: 질문 목록 */}
        <div>
          {/* 뷰 전환 + 필터 */}
          <div className="flex gap-1.5 mb-2 flex-wrap items-center">
            <button className={`px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-colors ${viewMode === 'questions' ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              onClick={() => { setViewMode('questions'); setSelectedStudent(null); }}>💬 전체 질문</button>
            <button className={`px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-colors ${viewMode === 'students' ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              onClick={() => { setViewMode('students'); setSelectedStudent(null); setSelectedQ(null); }}>📊 학생별</button>
            <span className="self-stretch border-l border-slate-200 mx-0.5" />
            {viewMode === 'questions' && (
              <>
                <button className={`px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-colors ${filter === 'all' ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} onClick={() => setFilter('all')}>
                  전체 ({questions.length})
                </button>
                <button className={`px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-colors ${filter === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} onClick={() => setFilter('pending')}>
                  미답변 ({pendingCount})
                </button>
                <button className={`px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-colors ${filter === 'answered' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} onClick={() => setFilter('answered')}>
                  답변완료 ({answeredCount})
                </button>
              </>
            )}
            <button className={`ml-auto px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-colors ${showGuides ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              onClick={() => setShowGuides(!showGuides)}>
              📋 답변 기준
            </button>
          </div>

          {/* 학생별 모드: 학생 목록 or 학생 질문 */}
          {viewMode === 'students' && !selectedStudent && (
            <Card padding="p-5">
              <h3 className="text-[15px] font-bold text-[var(--primary)] mb-3 mt-0">📊 학생별 질문 현황</h3>
              {summary.length === 0 ? (
                <EmptyState icon="📊" title="질문 데이터가 없습니다." />
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  {summary.map(s => (
                    <div key={s.student_id} onClick={() => loadStudentQuestions(s.student_id, s.student_name)}
                      className="flex justify-between items-center px-3.5 py-2.5 rounded-lg border border-slate-200 mb-1 cursor-pointer bg-white hover:bg-slate-50 transition-colors">
                      <div>
                        <span className="font-bold text-sm">{s.student_name}</span>
                        <span className="text-xs text-slate-400 ml-1.5">{s.school} {s.grade}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-slate-400">{s.total_questions}건</span>
                        {s.total_questions - s.answered_count > 0 && (
                          <StatusBadge variant="warning">미답변 {s.total_questions - s.answered_count}</StatusBadge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* 학생별 모드: 선택된 학생 질문 or 전체 질문 */}
          {(viewMode === 'questions' || (viewMode === 'students' && selectedStudent)) && (
            <Card padding="p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="m-0 text-[15px] font-bold text-[var(--primary)]">
                  {selectedStudent ? `📋 ${selectedStudent.name}님의 질문` : '💬 질문 목록'}
                </h3>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400">{displayQuestions.length}건</span>
                  {selectedStudent && (
                    <button className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors" onClick={() => setSelectedStudent(null)}>← 목록</button>
                  )}
                </div>
              </div>

              {displayQuestions.length === 0 ? (
                <EmptyState icon="💬" title="질문이 없습니다." />
              ) : selectedStudent ? (() => {
                // 질문 요약 뷰(학생별): 총건수·기간·답변현황 요약 헤더 + 날짜별(최신순) 연속 번호 목록.
                const items = [...displayQuestions].map(q => ({ ...q, _t: Date.parse(q.created_at) || 0 })).sort((a, b) => b._t - a._t);
                const total = items.length;
                const answered = items.filter(q => q.status === 'answered').length;
                const times = items.map(q => q._t).filter(Boolean);
                const fmtMD = (t) => { const d = new Date(t); return `${d.getMonth() + 1}.${d.getDate()}`; };
                const buckets = []; let n = 0;
                for (const q of items) {
                  const label = q._t ? (() => { const d = new Date(q._t); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`; })() : '날짜 미상';
                  let b = buckets.find(x => x.label === label);
                  if (!b) { b = { label, items: [] }; buckets.push(b); }
                  b.items.push({ q, no: ++n });
                }
                return (
                  <div className="max-h-[600px] overflow-y-auto">
                    {/* 요약 헤더 */}
                    <div className="p-3 bg-slate-50 rounded-lg mb-2.5 text-[13px] leading-relaxed">
                      <b>{selectedStudent.name}</b> 학생 — 총 <b>{total}건</b>
                      {times.length > 0 && <span className="text-slate-400"> ({fmtMD(Math.min(...times))} ~ {fmtMD(Math.max(...times))})</span>}
                      <span className="ml-2">· 답변완료 {answered} · 미답변 {total - answered}</span>
                    </div>
                    {/* 날짜별 번호 목록 (최신순, 전체 연속 번호) */}
                    {buckets.map(bucket => (
                      <div key={bucket.label} className="mb-2">
                        <div className="text-xs font-bold text-slate-400 px-0.5 py-1">🗓️ {bucket.label}</div>
                        {bucket.items.map(({ q, no }) => (
                          <div key={q.id} onClick={() => { setSelectedQ(q); setEditAnswer(q.answer || ''); }}
                            className={`flex gap-2 p-2.5 border-b border-slate-50 cursor-pointer border-l-[3px] transition-colors ${q.status === 'pending' ? 'border-l-amber-400' : 'border-l-emerald-500'} ${selectedQ?.id === q.id ? 'bg-blue-50' : 'bg-transparent'}`}>
                            <span className="font-bold text-slate-400 text-xs min-w-[22px] text-right shrink-0">{no}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] text-slate-400">{formatDate(q.created_at)}</span>
                                <StatusBadge variant={q.status === 'answered' ? 'success' : 'warning'}>
                                  {q.status === 'answered' ? '답변완료' : '미답변'}
                                </StatusBadge>
                              </div>
                              <div className="text-[13px] text-slate-600 leading-normal">
                                {(q.question || '(이미지 질문)').length > 80
                                  ? (q.question || '(이미지 질문)').slice(0, 80) + '...'
                                  : (q.question || '(이미지 질문)')}
                              </div>
                              {q.image && <span className="text-[11px] text-[var(--primary)]">📷 이미지 첨부</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })() : (
                <div className="max-h-[600px] overflow-y-auto">
                  {displayQuestions.map(q => (
                    <div key={q.id} onClick={() => { setSelectedQ(q); setEditAnswer(q.answer || ''); }}
                      className={`p-3 border-b border-slate-50 cursor-pointer border-l-[3px] transition-colors ${q.status === 'pending' ? 'border-l-amber-400' : 'border-l-emerald-500'} ${selectedQ?.id === q.id ? 'bg-blue-50' : 'bg-transparent'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[13px]">{q.student_name || selectedStudent?.name}</span>
                          {q.school && <span className="text-[11px] text-slate-400">{q.school} {q.grade}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400">{formatDate(q.created_at)}</span>
                          <StatusBadge variant={q.status === 'answered' ? 'success' : 'warning'}>
                            {q.status === 'answered' ? '답변완료' : '미답변'}
                          </StatusBadge>
                        </div>
                      </div>
                      <div className="text-[13px] text-slate-600 leading-normal">
                        {(q.question || '(이미지 질문)').length > 80
                          ? (q.question || '(이미지 질문)').slice(0, 80) + '...'
                          : (q.question || '(이미지 질문)')}
                      </div>
                      {q.image && <span className="text-[11px] text-[var(--primary)]">📷 이미지 첨부</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* 오른쪽: 답변 패널 + 답변 기준 */}
        <div>
          {/* 선택된 질문 상세 + 답변 */}
          <Card padding="p-5" className={showGuides ? 'mb-2.5' : 'mb-0'}>
            {!selectedQ ? (
              <EmptyState icon="💬" title="질문을 선택하세요" description="왼쪽 목록에서 질문을 클릭하면 여기에 표시됩니다" />
            ) : (
              <>
                {/* 질문 내용 */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-[15px] text-[var(--primary)]">{selectedQ.student_name}</span>
                    {selectedQ.school && <span className="text-xs text-slate-400 ml-1.5">{selectedQ.school} {selectedQ.grade}</span>}
                    <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(selectedQ.created_at)}</div>
                  </div>
                  <button className="px-1.5 py-0.5 rounded-md border-none cursor-pointer bg-red-50 text-red-600 text-[10px] font-semibold hover:bg-red-100 transition-colors" onClick={() => deleteQuestion(selectedQ.id)}>삭제</button>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg mb-3 text-sm leading-relaxed">
                  <strong>Q.</strong> {selectedQ.question || '(이미지 질문)'}
                  {selectedQ.image && (
                    <img src={authFileUrl(selectedQ.image)} alt="첨부" className="block max-w-full max-h-[300px] rounded-md mt-2 cursor-pointer"
                      onClick={() => window.open(authFileUrl(selectedQ.image), '_blank')} />
                  )}
                </div>

                {/* 기존 답변 표시 */}
                {selectedQ.answer && (
                  <div className="px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed border border-slate-200 mb-3 whitespace-pre-wrap">
                    <strong className="text-[var(--primary)]">A. 선생님</strong>
                    {selectedQ.answered_at && <span className="text-[11px] text-slate-400 ml-2">{formatDate(selectedQ.answered_at)}</span>}
                    <div className="mt-1">{selectedQ.answer}</div>
                  </div>
                )}

                {/* 답변 입력 */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    {selectedQ.answer ? '답변 수정' : '답변 작성'}
                  </label>
                  <textarea
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    placeholder="답변을 입력하세요..."
                    rows={4}
                    className="w-full box-border px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] resize-y font-[inherit]"
                  />
                  <button className="w-full mt-1 bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => submitAnswer(selectedQ.id)} disabled={!editAnswer.trim()}>
                    {selectedQ.answer ? '답변 수정' : '답변 등록'}
                  </button>
                </div>
              </>
            )}
          </Card>

          {/* 답변 기준 (토글) */}
          {showGuides && (
            <Card padding="p-5">
              <h3 className="text-sm font-bold text-[var(--primary)] mb-2.5 mt-0">📋 답변 기준</h3>

              {/* 기준 추가 폼 */}
              <div className="border border-slate-200 rounded-lg p-3 mb-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{editingGuide ? '기준 수정' : '새 기준 추가'}</div>
                <input placeholder="기준 제목" value={guideForm.title}
                  onChange={e => setGuideForm({ ...guideForm, title: e.target.value })}
                  className="w-full box-border px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] mb-1" />
                <textarea placeholder="답변 기준 내용" value={guideForm.content}
                  onChange={e => setGuideForm({ ...guideForm, content: e.target.value })}
                  rows={3}
                  className="w-full box-border px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] resize-y font-[inherit]" />
                <div className="flex gap-1.5 mt-1">
                  <button className="bg-[var(--cta)] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 font-display border-none cursor-pointer" onClick={async () => {
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
                    <button className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors" onClick={() => { setEditingGuide(null); setGuideForm({ title: '', content: '' }); }}>취소</button>
                  )}
                </div>
              </div>

              {/* 기준 목록 */}
              {guidelines.length === 0 ? (
                <EmptyState icon="📋" title="등록된 답변 기준이 없습니다." />
              ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  {guidelines.map(g => (
                    <div key={g.id} className="border border-slate-200 rounded-lg p-2.5 mb-1 border-l-[3px] border-l-[var(--primary)]">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-[13px] font-bold m-0">{g.title}</h4>
                        <div className="flex gap-1.5 shrink-0">
                          <button className="px-1.5 py-px rounded-md border border-slate-200 cursor-pointer bg-white text-[10px] text-slate-600 hover:bg-slate-50 transition-colors" onClick={() => {
                            setEditingGuide(g.id);
                            setGuideForm({ title: g.title, content: g.content });
                          }}>수정</button>
                          <button className="px-1.5 py-px rounded-md border-none cursor-pointer bg-red-50 text-red-600 text-[10px] font-semibold hover:bg-red-100 transition-colors" onClick={async () => {
                            if (!await askConfirm('이 기준을 삭제하시겠습니까?')) return;
                            await apiDelete(`/questions/guidelines/${g.id}`);
                            setMsg('삭제되었습니다.');
                            loadGuidelines();
                            setTimeout(() => setMsg(''), 2000);
                          }}>삭제</button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {g.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
