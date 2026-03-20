import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiDelete } from '../../api';
import { SCHOOLS, getAllGrades } from '../../config';

export default function NoticeCreate() {
  const [notices, setNotices] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    targetType: 'all', targetSchool: '', targetGrade: '', targetStudentId: '',
    title: '', content: ''
  });
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('list');

  const loadNotices = () => api('/admin/notices').then(setNotices).catch(console.error);

  useEffect(() => {
    loadNotices();
    api('/admin/students').then(setStudents).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiPost('/admin/notices', {
        targetType: form.targetType,
        targetSchool: form.targetSchool || null,
        targetGrade: form.targetGrade || null,
        targetStudentId: form.targetStudentId ? parseInt(form.targetStudentId) : null,
        title: form.title,
        content: form.content
      });
      setForm({ targetType: 'all', targetSchool: '', targetGrade: '', targetStudentId: '', title: '', content: '' });
      setMsg('안내사항이 등록되었습니다.');
      loadNotices();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 안내사항을 삭제하시겠습니까?')) return;
    await apiDelete(`/admin/notices/${id}`);
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

  const gradeOptions = form.targetSchool ? getAllGrades(form.targetSchool) : [];

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>안내사항 관리</span>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>안내사항 목록</button>
        <button className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>새 안내사항</button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {tab === 'list' && (
        <div className="card">
          <h2>안내사항 목록</h2>
          {notices.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: 30 }}>등록된 안내사항이 없습니다.</p>
          ) : (
            notices.map((n) => (
              <div key={n.id} className="notice-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="notice-title">{n.title}</div>
                  <div className="notice-date">
                    {n.created_at} | 대상: {targetLabel(n)}
                  </div>
                  <div className="notice-content">{n.content}</div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(n.id)}>삭제</button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'new' && (
        <div className="card">
          <h2>새 안내사항 작성</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>대상 범위</label>
              <select value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value, targetSchool: '', targetGrade: '', targetStudentId: '' })}>
                <option value="all">전체</option>
                <option value="school">학교별</option>
                <option value="grade">학년별</option>
                <option value="student">개별 학생</option>
              </select>
            </div>

            {form.targetType === 'school' && (
              <div className="form-group">
                <label>학교 선택</label>
                <select value={form.targetSchool} onChange={(e) => setForm({ ...form, targetSchool: e.target.value })} required>
                  <option value="">선택하세요</option>
                  {SCHOOLS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}

            {form.targetType === 'grade' && (
              <div className="form-row">
                <div className="form-group">
                  <label>학교 선택</label>
                  <select value={form.targetSchool} onChange={(e) => setForm({ ...form, targetSchool: e.target.value, targetGrade: '' })} required>
                    <option value="">선택하세요</option>
                    {SCHOOLS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>학년 선택</label>
                  <select value={form.targetGrade} onChange={(e) => setForm({ ...form, targetGrade: e.target.value })} required disabled={!form.targetSchool}>
                    <option value="">선택하세요</option>
                    {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            )}

            {form.targetType === 'student' && (
              <div className="form-group">
                <label>학생 선택</label>
                <select value={form.targetStudentId} onChange={(e) => setForm({ ...form, targetStudentId: e.target.value })} required>
                  <option value="">선택하세요</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.school} {s.grade})</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>제목 *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="안내사항 제목" required />
            </div>
            <div className="form-group">
              <label>내용 *</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="안내사항 내용을 입력하세요" required />
            </div>
            <button type="submit" className="btn btn-success">등록</button>
          </form>
        </div>
      )}
    </div>
  );
}
