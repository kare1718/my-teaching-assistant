import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../../api';

export default function CodesTab() {
  const [codes, setCodes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [quickXp, setQuickXp] = useState('');
  const [quickMsg, setQuickMsg] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ xpAmount: '', description: '', maxUses: '', codeType: 'general' });
  const [form, setForm] = useState({ code: '', codeType: 'general', xpAmount: 10, description: '', maxUses: '' });

  const load = () => api('/gamification/admin/codes').then(setCodes).catch(console.error);
  useEffect(() => { load(); }, []);

  // 빠른 코드 생성
  const handleQuickCreate = async (xp) => {
    try {
      const result = await apiPost('/gamification/admin/codes', {
        xpAmount: xp, codeType: 'general', description: `히든코드 ${xp}XP`, maxUses: null
      });
      setQuickMsg({ type: 'success', text: `✅ 코드 생성: ${result.code} (${xp} XP)`, code: result.code });
      setQuickXp('');
      load();
    } catch (e) { setQuickMsg({ type: 'error', text: e.message }); }
    setTimeout(() => setQuickMsg(null), 8000);
  };

  const handleCreate = async () => {
    try {
      await apiPost('/gamification/admin/codes', {
        ...form,
        xpAmount: parseInt(form.xpAmount) || 10,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null
      });
      setShowForm(false);
      setForm({ code: '', codeType: 'general', xpAmount: 10, description: '', maxUses: '' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 코드를 삭제하시겠습니까?')) return;
    await apiDelete(`/gamification/admin/codes/${id}`);
    load();
  };

  const handleToggle = async (code) => {
    await apiPut(`/gamification/admin/codes/${code.id}`, { isActive: code.is_active ? 0 : 1 });
    load();
  };

  const startEditCode = (c) => {
    setEditingId(c.id);
    setEditForm({
      xpAmount: String(c.xp_amount),
      description: c.description || '',
      maxUses: c.max_uses ? String(c.max_uses) : '',
      codeType: c.code_type || 'general',
    });
  };

  const handleEditCode = async () => {
    try {
      await apiPut(`/gamification/admin/codes/${editingId}`, {
        xpAmount: parseInt(editForm.xpAmount) || 10,
        description: editForm.description,
        maxUses: editForm.maxUses ? parseInt(editForm.maxUses) : null,
        codeType: editForm.codeType,
      });
      setEditingId(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setQuickMsg({ type: 'success', text: `📋 코드 복사됨: ${text}`, code: text });
      setTimeout(() => setQuickMsg(null), 3000);
    });
  };

  return (
    <>
      {/* 빠른 코드 생성 */}
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>⚡ 빠른 히든코드 생성</h4>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[50, 100, 200, 500].map(xp => (
            <button key={xp} onClick={() => handleQuickCreate(xp)} style={{
              flex: 1, minWidth: 60, padding: '10px var(--space-1)', borderRadius: 'var(--radius)', border: '1px solid var(--primary)',
              background: 'var(--card)', color: 'var(--primary)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer'
            }}>
              {xp} XP
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input type="number" placeholder="직접 입력 (XP)" value={quickXp}
            onChange={e => setQuickXp(e.target.value)}
            style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 'var(--text-sm)' }}
            onKeyDown={e => e.key === 'Enter' && quickXp && handleQuickCreate(parseInt(quickXp))}
          />
          <button className="btn btn-primary" onClick={() => quickXp && handleQuickCreate(parseInt(quickXp))}
            disabled={!quickXp} style={{ whiteSpace: 'nowrap' }}>
            생성
          </button>
        </div>
        {quickMsg && (
          <div style={{
            marginTop: 10, padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 'var(--text-sm)',
            background: quickMsg.type === 'success' ? 'var(--success-light)' : 'var(--destructive-light)',
            color: quickMsg.type === 'success' ? 'var(--success)' : 'var(--destructive)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 600 }}>{quickMsg.text}</span>
            {quickMsg.code && (
              <button onClick={() => copyToClipboard(quickMsg.code)} style={{
                padding: 'var(--space-1) 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success)',
                background: 'var(--success-light)', color: 'var(--success)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer'
              }}>복사</button>
            )}
          </div>
        )}
      </div>

      {/* 상세 코드 생성 */}
      <button onClick={() => setShowForm(!showForm)} style={{
        width: '100%', marginBottom: 'var(--space-2)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        background: 'var(--card)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: 13, cursor: 'pointer'
      }}>
        {showForm ? '접기 ▲' : '상세 설정으로 코드 생성 ▼'}
      </button>

      {showForm && (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <input placeholder="코드 (비우면 자동생성)" value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
            <select value={form.codeType} onChange={e => setForm({ ...form, codeType: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <option value="general">일반</option>
              <option value="attendance">출석</option>
              <option value="homework">과제</option>
              <option value="event">이벤트</option>
            </select>
            <input type="number" placeholder="XP 보상" value={form.xpAmount}
              onChange={e => setForm({ ...form, xpAmount: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
            <input placeholder="설명" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
            <input type="number" placeholder="최대 사용 횟수 (비우면 무제한)" value={form.maxUses}
              onChange={e => setForm({ ...form, maxUses: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
            <button className="btn btn-primary" onClick={handleCreate}>생성</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {codes.map((c, i) => (
          <div key={c.id} style={{
            borderBottom: i < codes.length - 1 ? '1px solid var(--border)' : 'none',
            opacity: c.is_active ? 1 : 0.5
          }}>
            {editingId === c.id ? (
              <div style={{ padding: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>✏️ 코드 수정: {c.code}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={editForm.codeType} onChange={e => setEditForm({ ...editForm, codeType: e.target.value })}
                      style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                      <option value="general">일반</option>
                      <option value="attendance">출석</option>
                      <option value="homework">과제</option>
                      <option value="event">이벤트</option>
                    </select>
                    <input type="number" placeholder="XP 보상" value={editForm.xpAmount}
                      onChange={e => setEditForm({ ...editForm, xpAmount: e.target.value })}
                      style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                  </div>
                  <input placeholder="설명" value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                  <input type="number" placeholder="최대 사용 횟수 (비우면 무제한)" value={editForm.maxUses}
                    onChange={e => setEditForm({ ...editForm, maxUses: e.target.value })}
                    style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary" onClick={handleEditCode} style={{ flex: 1 }}>저장</button>
                    <button className="btn btn-outline" onClick={() => setEditingId(null)} style={{ flex: 1 }}>취소</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 15 }}>{c.code}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                    {c.code_type} · {c.xp_amount}XP · 사용 {c.current_uses}/{c.max_uses || '∞'}
                    {c.description && ` · ${c.description}`}
                  </div>
                </div>
                <button onClick={() => startEditCode(c)} style={{
                  padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--primary)', cursor: 'pointer'
                }}>수정</button>
                <button onClick={() => handleToggle(c)} style={{
                  padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--card)', cursor: 'pointer'
                }}>{c.is_active ? '비활성' : '활성'}</button>
                <button onClick={() => handleDelete(c.id)} style={{
                  padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--destructive)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
                }}>삭제</button>
              </div>
            )}
          </div>
        ))}
        {codes.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>코드가 없습니다.</div>}
      </div>
    </>
  );
}
