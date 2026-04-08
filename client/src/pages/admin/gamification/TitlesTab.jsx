import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../../api';

export default function TitlesTab() {
  const [titles, setTitles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', conditionType: 'manual', conditionValue: 0, icon: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '', conditionType: 'manual', conditionValue: 0, icon: '' });

  const load = () => api('/gamification/admin/titles').then(setTitles).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await apiPost('/gamification/admin/titles', {
        ...form, conditionValue: parseInt(form.conditionValue) || 0
      });
      setShowForm(false);
      setForm({ name: '', description: '', conditionType: 'manual', conditionValue: 0, icon: '' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 칭호를 삭제하시겠습니까?')) return;
    await apiDelete(`/gamification/admin/titles/${id}`);
    load();
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditForm({
      name: t.name || '',
      description: t.description || '',
      conditionType: t.condition_type || 'manual',
      conditionValue: t.condition_value || 0,
      icon: t.icon || '',
    });
    setShowForm(false);
  };

  const handleEditSave = async () => {
    try {
      await apiPut(`/gamification/admin/titles/${editingId}`, {
        name: editForm.name,
        description: editForm.description,
        conditionType: editForm.conditionType,
        conditionValue: parseInt(editForm.conditionValue) || 0,
        icon: editForm.icon,
      });
      setEditingId(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const inputStyle = { padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: '100%', boxSizing: 'border-box' };

  return (
    <>
      <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); }} style={{ width: '100%', marginBottom: 'var(--space-2)' }}>
        + 칭호 추가
      </button>

      {showForm && (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <input placeholder="칭호 이름" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            <input placeholder="아이콘 (이모지)" value={form.icon}
              onChange={e => setForm({ ...form, icon: e.target.value })} style={inputStyle} />
            <input placeholder="설명" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle} />
            <select value={form.conditionType} onChange={e => setForm({ ...form, conditionType: e.target.value })} style={inputStyle}>
              <option value="manual">수동 부여</option>
              <option value="xp_total">XP 달성</option>
              <option value="quiz_count">퀴즈 정답 수</option>
              <option value="code_count">코드 사용 수</option>
              <option value="level">레벨 달성</option>
            </select>
            {form.conditionType !== 'manual' && (
              <input type="number" placeholder="목표 수치" value={form.conditionValue}
                onChange={e => setForm({ ...form, conditionValue: e.target.value })} style={inputStyle} />
            )}
            <button className="btn btn-primary" onClick={handleCreate}>추가</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {titles.map((t, i) => (
          <div key={t.id} style={{
            borderBottom: i < titles.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            {editingId === t.id ? (
              <div style={{ padding: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>✏️ 칭호 수정</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input placeholder="아이콘" value={editForm.icon}
                      onChange={e => setEditForm({ ...editForm, icon: e.target.value })} style={{ ...inputStyle, flex: '0 0 80px' }} />
                    <input placeholder="칭호 이름" value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                  </div>
                  <input placeholder="설명" value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={inputStyle} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={editForm.conditionType} onChange={e => setEditForm({ ...editForm, conditionType: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                      <option value="manual">수동 부여</option>
                      <option value="xp_total">XP 달성</option>
                      <option value="quiz_count">퀴즈 정답 수</option>
                      <option value="code_count">코드 사용 수</option>
                      <option value="level">레벨 달성</option>
                    </select>
                    {editForm.conditionType !== 'manual' && (
                      <input type="number" placeholder="목표 수치" value={editForm.conditionValue}
                        onChange={e => setEditForm({ ...editForm, conditionValue: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary" onClick={handleEditSave} style={{ flex: 1 }}>저장</button>
                    <button className="btn btn-outline" onClick={() => setEditingId(null)} style={{ flex: 1 }}>취소</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{t.icon || '🏷️'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                    {t.condition_type === 'manual' ? '수동 부여' :
                      `${t.condition_type} ≥ ${t.condition_value}`}
                    {t.description && ` · ${t.description}`}
                  </div>
                </div>
                <button onClick={() => startEdit(t)} style={{
                  padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--primary)', cursor: 'pointer'
                }}>수정</button>
                <button onClick={() => handleDelete(t.id)} style={{
                  padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--destructive)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
                }}>삭제</button>
              </div>
            )}
          </div>
        ))}
        {titles.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>칭호가 없습니다.</div>}
      </div>
    </>
  );
}
