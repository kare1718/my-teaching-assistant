import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { askConfirm } from '../../lib/feedback';
import { PageLoading, PageHeader, Card, EmptyState } from '../../components/ui';

const TAGS = ['학습상담', '진로상담', '학부모상담', '생활지도', '성적관리', '기타'];

export default function ConsultationLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [searchStudent, setSearchStudent] = useState('');

  // 폼
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [form, setForm] = useState({ student_id: '', date: new Date().toISOString().slice(0, 10), tags: [], content: '' });

  // 학생 목록 (검색용)
  const [students, setStudents] = useState([]);

  const loadLogs = () => {
    let url = '/consultation';
    const params = [];
    if (selectedTag) params.push(`tag=${encodeURIComponent(selectedTag)}`);
    if (searchStudent) params.push(`student=${encodeURIComponent(searchStudent)}`);
    if (params.length) url += '?' + params.join('&');
    api(url).then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); }).catch(() => { setLogs([]); setLoading(false); });
  };

  useEffect(() => { loadLogs(); }, [selectedTag, searchStudent]);
  useEffect(() => { api('/clinic/admin/students').then(setStudents).catch(() => []); }, []);

  const showMessage = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleSave = async () => {
    if (!form.student_id || !form.content) { showMessage('학생과 내용을 입력하세요.'); return; }
    try {
      const payload = { ...form, tags: form.tags.join(',') };
      if (editingLog) {
        await apiPut(`/consultation/${editingLog.id}`, payload);
        showMessage('상담 일지가 수정되었습니다.');
      } else {
        await apiPost('/consultation', payload);
        showMessage('상담 일지가 등록되었습니다.');
      }
      setShowForm(false);
      setEditingLog(null);
      setForm({ student_id: '', date: new Date().toISOString().slice(0, 10), tags: [], content: '' });
      loadLogs();
    } catch (e) { showMessage(e.message); }
  };

  const handleDelete = async (id) => {
    if (!await askConfirm('이 상담 일지를 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/consultation/${id}`);
      showMessage('삭제되었습니다.');
      loadLogs();
    } catch (e) { showMessage(e.message); }
  };

  const openEdit = (log) => {
    setEditingLog(log);
    setForm({
      student_id: log.student_id,
      date: log.date ? log.date.slice(0, 10) : '',
      tags: log.tags ? (typeof log.tags === 'string' ? log.tags.split(',') : log.tags) : [],
      content: log.content || '',
    });
    setShowForm(true);
  };

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };

  if (loading) return <PageLoading wrap="main-content" />;

  return (
    <div className="main-content p-5 max-w-[1100px] mx-auto">
      <PageHeader title="상담 일지" />

      {msg && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 mb-4 text-sm font-semibold">
          {msg}
        </div>
      )}

      {/* 필터 + 추가 */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setSelectedTag('')}
            className={`px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-colors ${
              !selectedTag ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>전체</button>
          {TAGS.map(t => (
            <button key={t} onClick={() => setSelectedTag(selectedTag === t ? '' : t)}
              className={`px-3.5 py-1.5 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-colors ${
                selectedTag === t ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{t}</button>
          ))}
        </div>
        <button onClick={() => { setShowForm(true); setEditingLog(null); setForm({ student_id: '', date: new Date().toISOString().slice(0, 10), tags: [], content: '' }); }}
          className="bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display border-none cursor-pointer">
          + 상담 기록
        </button>
      </div>

      {/* 학생 검색 */}
      <input placeholder="학생 이름 검색..." value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
        className="w-full box-border px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] mb-4" />

      {/* 일지 목록 */}
      {logs.length === 0 ? (
        <Card padding="p-0">
          <EmptyState icon="📋" title="상담 기록이 없습니다." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map(log => (
            <Card key={log.id} padding="p-5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-bold text-[15px] text-[var(--primary)]">{log.student_name || `학생 #${log.student_id}`}</span>
                  <span className="ml-2.5 text-[13px] text-slate-400">{log.date ? new Date(log.date).toLocaleDateString('ko-KR') : ''}</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(log)} className="px-2.5 py-1 rounded-md border border-slate-200 cursor-pointer bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors">수정</button>
                  <button onClick={() => handleDelete(log.id)} className="px-2.5 py-1 rounded-md border-none cursor-pointer bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">삭제</button>
                </div>
              </div>
              {log.tags && (
                <div className="flex gap-1 mb-2 flex-wrap">
                  {(typeof log.tags === 'string' ? log.tags.split(',') : log.tags).map(t => (
                    <span key={t} className="rounded-full px-3 py-0.5 text-xs font-bold bg-purple-100 text-purple-700">{t}</span>
                  ))}
                </div>
              )}
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{log.content}</p>
            </Card>
          ))}
        </div>
      )}

      {/* 상담 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-5"
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--primary)] mb-4">{editingLog ? '상담 일지 수정' : '상담 기록 추가'}</h3>
            <div className="flex flex-col gap-3">
              <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
                <option value="">학생 선택</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school})</option>)}
              </select>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">태그</p>
                <div className="flex gap-1.5 flex-wrap">
                  {TAGS.map(t => (
                    <button key={t} onClick={() => toggleTag(t)}
                      className={`px-3.5 py-1 rounded-full border-none cursor-pointer text-[13px] font-semibold transition-colors ${
                        form.tags.includes(t) ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>{t}</button>
                  ))}
                </div>
              </div>
              <textarea placeholder="상담 내용" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                rows={6} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] resize-y" />
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-lg border border-slate-200 cursor-pointer bg-white text-sm text-slate-600 hover:bg-slate-50 transition-colors">취소</button>
              <button onClick={handleSave}
                className="px-5 py-2 rounded-lg border-none cursor-pointer bg-[var(--cta)] text-white font-bold text-sm hover:opacity-90 font-display">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
