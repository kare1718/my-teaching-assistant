import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';

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
    if (!window.confirm('이 상담 일지를 삭제하시겠습니까?')) return;
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

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 20 }}>상담 일지</h2>

      {msg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--success-light)', color: 'oklch(52% 0.14 160)', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* 필터 + 추가 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedTag('')} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            background: !selectedTag ? 'var(--primary)' : 'var(--muted)', color: !selectedTag ? 'white' : 'var(--foreground)',
          }}>전체</button>
          {TAGS.map(t => (
            <button key={t} onClick={() => setSelectedTag(selectedTag === t ? '' : t)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              background: selectedTag === t ? 'var(--primary)' : 'var(--muted)', color: selectedTag === t ? 'white' : 'var(--foreground)',
            }}>{t}</button>
          ))}
        </div>
        <button onClick={() => { setShowForm(true); setEditingLog(null); setForm({ student_id: '', date: new Date().toISOString().slice(0, 10), tags: [], content: '' }); }}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13 }}>
          + 상담 기록
        </button>
      </div>

      {/* 학생 검색 */}
      <input placeholder="학생 이름 검색..." value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box' }} />

      {/* 일지 목록 */}
      {logs.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-500)', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          상담 기록이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {logs.map(log => (
            <div key={log.id} style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{log.student_name || `학생 #${log.student_id}`}</span>
                  <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--neutral-500)' }}>{log.date ? new Date(log.date).toLocaleDateString('ko-KR') : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(log)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 12, fontFamily: 'inherit' }}>수정</button>
                  <button onClick={() => handleDelete(log.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', fontSize: 12, fontFamily: 'inherit' }}>삭제</button>
                </div>
              </div>
              {log.tags && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                  {(typeof log.tags === 'string' ? log.tags.split(',') : log.tags).map(t => (
                    <span key={t} style={{ padding: '2px 10px', borderRadius: 12, background: 'var(--info-light)', color: 'oklch(48% 0.18 260)', fontSize: 12, fontWeight: 600 }}>{t}</span>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 14, color: 'var(--foreground)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{log.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* 상담 폼 모달 */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowForm(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{editingLog ? '상담 일지 수정' : '상담 기록 추가'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }}>
                <option value="">학생 선택</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school})</option>)}
              </select>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>태그</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TAGS.map(t => (
                    <button key={t} onClick={() => toggleTag(t)} style={{
                      padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                      background: form.tags.includes(t) ? 'oklch(48% 0.18 260)' : 'var(--secondary)', color: form.tags.includes(t) ? 'white' : 'var(--neutral-700)',
                    }}>{t}</button>
                  ))}
                </div>
              </div>
              <textarea placeholder="상담 내용" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                rows={6} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 14, fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleSave}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14 }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
