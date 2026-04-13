import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig, getAllGrades } from '../../contexts/TenantContext';

export default function PreRegistered() {
  const { config } = useTenantConfig();
  const SCHOOLS = config.schools || [];
  const [list, setList] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', school: '', grade: '', parentName: '', parentPhone: '', memo: '' });
  const [editId, setEditId] = useState(null);
  const [linkTarget, setLinkTarget] = useState(null); // { preRegId, studentId }
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [filter, setFilter] = useState('all'); // all | pending | linked

  const load = () => {
    api('/admin/pre-registered').then(setList).catch(console.error);
    api('/admin/students').then(setStudents).catch(console.error);
  };
  useEffect(load, []);

  const resetForm = () => {
    setForm({ name: '', phone: '', school: '', grade: '', parentName: '', parentPhone: '', memo: '' });
    setEditId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await apiPut(`/admin/pre-registered/${editId}`, form);
        setMsgType('success');
        setMsg('수정되었습니다.');
      } else {
        await apiPost('/admin/pre-registered', form);
        setMsgType('success');
        setMsg('사전등록이 완료되었습니다.');
      }
      resetForm();
      load();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsgType('error'); setMsg(err.message); }
  };

  const startEdit = (item) => {
    setForm({
      name: item.name, phone: item.phone || '', school: item.school,
      grade: item.grade, parentName: item.parent_name || '',
      parentPhone: item.parent_phone || '', memo: item.memo || ''
    });
    setEditId(item.id);
  };

  const handleDelete = async (id) => {
    if (!confirm('이 사전등록 정보를 삭제하시겠습니까?')) return;
    await apiDelete(`/admin/pre-registered/${id}`);
    load();
  };

  const handleLink = async (preRegId, studentId) => {
    if (!studentId) return;
    try {
      await apiPut(`/admin/pre-registered/${preRegId}/link`, { studentId: parseInt(studentId) });
      setMsg('연동 완료');
      setLinkTarget(null);
      load();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const handleUnlink = async (id) => {
    if (!confirm('연동을 해제하시겠습니까?')) return;
    await apiPut(`/admin/pre-registered/${id}/unlink`, {});
    load();
  };

  const gradeOptions = form.school ? getAllGrades(form.school) : [];
  const filtered = list.filter(i => filter === 'all' || i.status === filter);
  const pendingCount = list.filter(i => i.status === 'pending').length;
  const linkedCount = list.filter(i => i.status === 'linked').length;

  const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>학생 사전등록</span>
      </div>

      {msg && <div className={`alert ${msgType === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 'var(--space-3)' }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 14, alignItems: 'start' }}>
        {/* 왼쪽: 등록/수정 폼 */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', margin: '0 0 14px' }}>
            {editId ? '✏️ 사전등록 수정' : '➕ 학생 사전등록'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 3 }}>이름 *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={inputStyle} placeholder="학생 이름" />
            </div>
            <div style={{ marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 3 }}>연락처</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} placeholder="학생 또는 학부모 연락처" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 3 }}>학교 *</label>
                <select value={form.school} onChange={e => setForm({ ...form, school: e.target.value, grade: '' })} required style={inputStyle}>
                  <option value="">선택</option>
                  {SCHOOLS.filter(s => !['조교', '선생님'].includes(s.name)).map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 3 }}>학년 *</label>
                <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} required disabled={!form.school} style={inputStyle}>
                  <option value="">선택</option>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 3 }}>학부모 이름</label>
                <input value={form.parentName} onChange={e => setForm({ ...form, parentName: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 3 }}>학부모 연락처</label>
                <input value={form.parentPhone} onChange={e => setForm({ ...form, parentPhone: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 3 }}>메모</label>
              <textarea value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="특이사항 메모" />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-base)' }}>📋 사전등록 목록</h3>
            <div style={{ display: 'flex', gap: 'var(--space-1)', fontSize: 'var(--text-xs)' }}>
              <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : ''}`}
                onClick={() => setFilter('all')} style={{ padding: '3px 10px' }}>
                전체 ({list.length})
              </button>
              <button className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : ''}`}
                onClick={() => setFilter('pending')} style={{ padding: '3px 10px' }}>
                대기 ({pendingCount})
              </button>
              <button className={`btn btn-sm ${filter === 'linked' ? 'btn-primary' : ''}`}
                onClick={() => setFilter('linked')} style={{ padding: '3px 10px' }}>
                연동됨 ({linkedCount})
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 30, fontSize: 13 }}>
              {filter === 'all' ? '사전등록된 학생이 없습니다.' : `${filter === 'pending' ? '대기 중인' : '연동된'} 학생이 없습니다.`}
            </p>
          ) : (
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--neutral-50)', position: 'sticky', top: 0 }}>
                    <th style={{ padding: 'var(--space-2) var(--space-1)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>이름</th>
                    <th style={{ padding: 'var(--space-2) var(--space-1)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>학교/학년</th>
                    <th style={{ padding: 'var(--space-2) var(--space-1)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>연락처</th>
                    <th style={{ padding: 'var(--space-2) var(--space-1)', textAlign: 'center', borderBottom: '2px solid var(--border)' }}>상태</th>
                    <th style={{ padding: 'var(--space-2) var(--space-1)', textAlign: 'center', borderBottom: '2px solid var(--border)' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--neutral-50)' }}>
                      <td style={{ padding: 'var(--space-2) var(--space-1)', fontWeight: 600 }}>
                        {item.name}
                        {item.memo && <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400 }}>{item.memo}</div>}
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-1)' }}>{item.school} {item.grade}</td>
                      <td style={{ padding: 'var(--space-2) var(--space-1)', fontSize: 'var(--text-xs)' }}>
                        {item.phone || '-'}
                        {item.parent_phone && <div style={{ color: 'var(--muted-foreground)' }}>부모: {item.parent_phone}</div>}
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-1)', textAlign: 'center' }}>
                        {item.status === 'linked' ? (
                          <span style={{ background: 'var(--success-light)', color: 'oklch(30% 0.12 145)', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>연동됨</span>
                        ) : (
                          <span style={{ background: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', padding: '2px 8px', borderRadius: 10, fontSize: 11 }}>대기</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-1)', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {item.status === 'pending' && (
                            <>
                              <button className="btn btn-sm" onClick={() => startEdit(item)}
                                style={{ fontSize: 10, padding: '2px 6px' }}>수정</button>
                              <button className="btn btn-sm btn-primary"
                                onClick={() => setLinkTarget(linkTarget?.preRegId === item.id ? null : { preRegId: item.id, studentId: '' })}
                                style={{ fontSize: 10, padding: '2px 6px' }}>연동</button>
                            </>
                          )}
                          {item.status === 'linked' && (
                            <button className="btn btn-sm" onClick={() => handleUnlink(item.id)}
                              style={{ fontSize: 10, padding: '2px 6px' }}>연동해제</button>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}
                            style={{ fontSize: 10, padding: '2px 6px' }}>삭제</button>
                        </div>
                        {linkTarget?.preRegId === item.id && (
                          <div style={{ marginTop: 'var(--space-1)', display: 'flex', gap: 'var(--space-1)' }}>
                            <select value={linkTarget.studentId}
                              onChange={e => setLinkTarget({ ...linkTarget, studentId: e.target.value })}
                              style={{ flex: 1, padding: '3px 6px', fontSize: 11, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                              <option value="">학생 선택</option>
                              {students
                                .filter(s => s.school === item.school)
                                .map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
                            </select>
                            <button className="btn btn-sm btn-success"
                              onClick={() => handleLink(item.id, linkTarget.studentId)}
                              style={{ fontSize: 10, padding: '2px 6px' }}>확인</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .content > div:nth-child(3) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
