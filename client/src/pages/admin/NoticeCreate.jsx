import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';

export default function NoticeCreate() {
  const { config } = useTenantConfig();
  const [notices, setNotices] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    targetType: 'all', targetSchool: '', targetGrade: '', targetStudentId: '',
    title: '', content: ''
  });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState('');

  const loadNotices = () => api('/admin/notices').then(setNotices).catch(console.error);

  useEffect(() => {
    loadNotices();
    api('/admin/students').then(setStudents).catch(console.error);
  }, []);

  const resetForm = () => {
    setForm({ targetType: 'all', targetSchool: '', targetGrade: '', targetStudentId: '', title: '', content: '' });
    setEditId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        targetType: form.targetType,
        targetSchool: form.targetSchool || null,
        targetGrade: form.targetGrade || null,
        targetStudentId: form.targetStudentId ? parseInt(form.targetStudentId) : null,
        title: form.title, content: form.content
      };
      if (editId) {
        await apiPut(`/admin/notices/${editId}`, payload);
        setMsg('안내사항이 수정되었습니다.');
      } else {
        await apiPost('/admin/notices', payload);
        setMsg('안내사항이 등록되었습니다.');
      }
      resetForm();
      loadNotices();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const startEdit = (n) => {
    setForm({
      targetType: n.target_type || 'all',
      targetSchool: n.target_school || '',
      targetGrade: n.target_grade || '',
      targetStudentId: n.target_student_id ? String(n.target_student_id) : '',
      title: n.title, content: n.content
    });
    setEditId(n.id);
  };

  const handleDelete = async (id) => {
    if (!confirm('이 안내사항을 삭제하시겠습니까?')) return;
    await apiDelete(`/admin/notices/${id}`);
    if (editId === id) resetForm();
    loadNotices();
  };

  const targetLabel = (n) => {
    if (n.target_type === 'all') return '전체';
    if (n.target_type === 'school') return n.target_school;
    if (n.target_type === 'grade') return `${n.target_school} ${n.target_grade}`;
    if (n.target_type === 'student') {
      const s = students.find(st => st.id === n.target_student_id);
      return s ? `${s.name} (개별)` : '개별 학생';
    }
    return '-';
  };

  const schools = config.schools || [];
  const gradeOptions = form.targetSchool ? (schools.find(s => s.name === form.targetSchool)?.grades || []) : [];

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>안내사항 관리</span>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 'var(--space-3)' }}>{msg}</div>}

      <div className="notice-layout" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 14, alignItems: 'start' }}>

        {/* 왼쪽: 작성/수정 폼 */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', margin: '0 0 14px' }}>
            {editId ? '✏️ 안내사항 수정' : '📢 새 안내사항 작성'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>대상 범위</label>
              <select value={form.targetType} onChange={e => setForm({ ...form, targetType: e.target.value, targetSchool: '', targetGrade: '', targetStudentId: '' })}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                <option value="all">전체</option>
                <option value="school">학교별</option>
                <option value="grade">학년별</option>
                <option value="student">개별 학생</option>
              </select>
            </div>

            {form.targetType === 'school' && (
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>학교</label>
                <select value={form.targetSchool} onChange={e => setForm({ ...form, targetSchool: e.target.value })} required
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                  <option value="">선택하세요</option>
                  {schools.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}

            {form.targetType === 'grade' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <div>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>학교</label>
                  <select value={form.targetSchool} onChange={e => setForm({ ...form, targetSchool: e.target.value, targetGrade: '' })} required
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                    <option value="">선택</option>
                    {schools.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>학년</label>
                  <select value={form.targetGrade} onChange={e => setForm({ ...form, targetGrade: e.target.value })} required disabled={!form.targetSchool}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                    <option value="">선택</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            )}

            {form.targetType === 'student' && (
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>학생</label>
                <select value={form.targetStudentId} onChange={e => setForm({ ...form, targetStudentId: e.target.value })} required
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                  <option value="">선택하세요</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school} {s.grade})</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>제목 *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="안내사항 제목" required
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>내용 *</label>
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="안내사항 내용을 입력하세요" required
                rows={5} style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="submit" className="btn btn-success" style={{ flex: 1 }}>
                {editId ? '수정' : '등록'}
              </button>
              {editId && <button type="button" className="btn" onClick={resetForm} style={{ flex: 1 }}>취소</button>}
            </div>
          </form>
        </div>

        {/* 오른쪽: 목록 */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-base)' }}>📋 안내사항 목록</h3>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>{notices.length}건</span>
          </div>
          {notices.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30, fontSize: 13 }}>등록된 안내사항이 없습니다.</p>
          ) : (
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {notices.map(n => (
                <div key={n.id} style={{
                  padding: 'var(--space-3) var(--space-3)', borderBottom: '1px solid var(--neutral-50)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)',
                  background: editId === n.id ? 'var(--info-light)' : 'transparent'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 3 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 'var(--space-1)' }}>
                      {n.created_at?.slice(0, 10)} · 대상: <span style={{ fontWeight: 600 }}>{targetLabel(n)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--foreground)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {n.content.length > 100 ? n.content.slice(0, 100) + '...' : n.content}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                    <button className="btn btn-sm" onClick={() => startEdit(n)}
                      style={{ fontSize: 10, padding: '3px 8px' }}>수정</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(n.id)}
                      style={{ fontSize: 10, padding: '3px 8px' }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .notice-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
