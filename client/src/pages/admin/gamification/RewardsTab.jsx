import { useState, useEffect } from 'react';
import { api, apiPost } from '../../../api';

function GrantRewardButton({ type, label }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleGrant = async () => {
    if (!confirm(`${type === 'weekly' ? '주간' : '월간'} 랭킹 보상을 지급하시겠습니까?`)) return;
    setLoading(true);
    try {
      const res = await apiPost('/gamification/admin/ranking-rewards', { type });
      setResult({ success: true, data: res });
    } catch (e) {
      setResult({ success: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1 }}>
      <button className="btn btn-outline" onClick={handleGrant} disabled={loading}
        style={{ width: '100%', fontSize: 13, fontWeight: 700 }}>
        {loading ? '지급중...' : label}
      </button>
      {result && (
        <div style={{ marginTop: 6, fontSize: 11, padding: '6px var(--space-2)', borderRadius: 'var(--radius-sm)',
          background: result.success ? 'var(--success-light)' : 'var(--destructive-light)',
          color: result.success ? 'var(--success)' : 'var(--destructive)' }}>
          {result.success ? (
            result.data.rewarded?.length > 0
              ? result.data.rewarded.map((r, i) => <div key={i}>{r.rank}위 {r.name}: +{r.amount}P</div>)
              : '지급 대상이 없습니다.'
          ) : result.msg}
        </div>
      )}
    </div>
  );
}

export default function RewardsTab() {
  const [settings, setSettings] = useState({ weekly: {}, monthly: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/gamification/reward-settings').then(data => {
      const w = {}, m = {};
      data.forEach(s => {
        if (s.type === 'weekly') w[s.rank] = s.amount;
        else m[s.rank] = s.amount;
      });
      // 기본값 채우기
      for (let i = 1; i <= 10; i++) {
        if (!w[i]) w[i] = 0;
        if (!m[i]) m[i] = 0;
      }
      setSettings({ weekly: w, monthly: m });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const updateVal = (type, rank, val) => {
    setSettings(prev => ({
      ...prev,
      [type]: { ...prev[type], [rank]: parseInt(val) || 0 }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allSettings = [];
      Object.entries(settings.weekly).forEach(([rank, amount]) => {
        allSettings.push({ type: 'weekly', rank: parseInt(rank), amount });
      });
      Object.entries(settings.monthly).forEach(([rank, amount]) => {
        allSettings.push({ type: 'monthly', rank: parseInt(rank), amount });
      });
      await apiPost('/gamification/reward-settings', { settings: allSettings });
      setMsg('보상 설정이 저장되었습니다!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}>로딩중...</div>;

  const rankLabels = { 1: '🥇 1위', 2: '🥈 2위', 3: '🥉 3위' };

  return (
    <>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>🎁 랭킹 보상 포인트 설정</h3>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 'var(--space-4)' }}>
          주간/월간 랭킹 보상으로 지급되는 XP+포인트를 설정합니다.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          {/* 주간 */}
          <div>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--primary)' }}>📅 주간 보상</h4>
            {[1,2,3,4,5,6,7,8,9,10].map(rank => (
              <div key={rank} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 50 }}>
                  {rankLabels[rank] || `${rank}위`}
                </span>
                <input type="number" value={settings.weekly[rank] || 0}
                  onChange={e => updateVal('weekly', rank, e.target.value)}
                  style={{ flex: 1, padding: 'var(--space-1) var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, textAlign: 'right' }}
                />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>pt</span>
              </div>
            ))}
          </div>

          {/* 월간 */}
          <div>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--success)' }}>📆 월간 보상</h4>
            {[1,2,3,4,5,6,7,8,9,10].map(rank => (
              <div key={rank} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 50 }}>
                  {rankLabels[rank] || `${rank}위`}
                </span>
                <input type="number" value={settings.monthly[rank] || 0}
                  onChange={e => updateVal('monthly', rank, e.target.value)}
                  style={{ flex: 1, padding: 'var(--space-1) var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, textAlign: 'right' }}
                />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>pt</span>
              </div>
            ))}
          </div>
        </div>

        {msg && (
          <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius)',
            background: msg.includes('실패') ? 'var(--destructive-light)' : 'var(--success-light)',
            color: msg.includes('실패') ? 'var(--destructive)' : 'var(--success)', fontSize: 13, fontWeight: 600 }}>
            {msg}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}
          style={{ width: '100%', marginTop: 'var(--space-3)' }}>
          {saving ? '저장중...' : '💾 보상 설정 저장'}
        </button>
      </div>

      {/* 보상 지급 */}
      <div className="card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>🏆 랭킹 보상 지급</h3>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 'var(--space-3)' }}>
          현재 주간/월간 랭킹 기준으로 위 설정에 따른 보상을 즉시 지급합니다.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <GrantRewardButton type="weekly" label="📅 주간 보상 지급" />
          <GrantRewardButton type="monthly" label="📆 월간 보상 지급" />
        </div>
      </div>
    </>
  );
}
