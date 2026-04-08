import { useState, useEffect } from 'react';
import { api, apiPut } from '../../../api';

export default function XpTab() {
  const [overview, setOverview] = useState([]);
  const [adjustForm, setAdjustForm] = useState(null);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');

  const load = () => api('/gamification/admin/xp-overview').then(setOverview).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleAdjust = async (studentId) => {
    if (!amount) return;
    try {
      await apiPut('/gamification/admin/adjust-xp', {
        studentId, amount: parseInt(amount), description: desc
      });
      setAdjustForm(null);
      setAmount('');
      setDesc('');
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {overview.map((s, i) => (
        <div key={s.student_id} style={{
          padding: '10px 14px', borderBottom: i < overview.length - 1 ? '1px solid var(--border)' : 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{s.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name} <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.school} {s.grade}</span></div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                Lv.{s.level} · XP: {s.xp} · 포인트: {s.points}
              </div>
            </div>
            <button onClick={() => setAdjustForm(adjustForm === s.student_id ? null : s.student_id)}
              className="btn btn-outline" style={{ fontSize: 11, padding: '4px 8px' }}>조정</button>
          </div>
          {adjustForm === s.student_id && (
            <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input type="number" placeholder="XP 수량 (+/-)" value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ flex: 1, minWidth: 80, padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }} />
              <input placeholder="사유" value={desc}
                onChange={e => setDesc(e.target.value)}
                style={{ flex: 2, minWidth: 100, padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }} />
              <button className="btn btn-primary" onClick={() => handleAdjust(s.student_id)}
                style={{ fontSize: 'var(--text-xs)', padding: '6px var(--space-3)' }}>적용</button>
            </div>
          )}
        </div>
      ))}
      {overview.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>학생 데이터가 없습니다.</div>}
    </div>
  );
}
