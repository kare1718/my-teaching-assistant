import { useState, useEffect } from 'react';
import { api, apiPost } from '../../../api';

const READING_CATEGORIES = ['인문', '사회', '과학', '기술', '경제', '법', '예술', '환경', '의학', '역사'];

export default function ReadingTab() {
  const [passages, setPassages] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiCategory, setAiCategory] = useState('인문');
  const [aiCount, setAiCount] = useState(3);

  const load = () => {
    api('/gamification/reading/categories').then(setPassages).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const handleReseed = async () => {
    if (!confirm('⚠️ 기존 비문학 지문과 문제를 모두 삭제하고 최신 시드 데이터로 교체합니다.\n(학생들의 독해 기록은 초기화됩니다)\n\n계속하시겠습니까?')) return;
    setLoading(true);
    try {
      const result = await apiPost('/gamification/admin/reading/reseed', {});
      setMsg({ type: 'success', text: result.message });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const result = await apiPost('/gamification/admin/reading/generate-ai', { category: aiCategory, count: aiCount });
      setMsg({ type: 'success', text: result.message });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📖 비문학 독해 지문</h3>
        <button onClick={handleReseed} disabled={loading}
          style={{ padding: 'var(--space-2) 14px', borderRadius: 'var(--radius)', border: '1px solid oklch(55% 0.20 290)', background: 'oklch(96% 0.02 300)', color: 'oklch(30% 0.15 300)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          🔄 시드 리셋
        </button>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 10, fontSize: 13, fontWeight: 600,
          background: msg.type === 'success' ? 'var(--success-light)' : 'var(--destructive-light)',
          color: msg.type === 'success' ? 'var(--success)' : 'var(--destructive)',
          border: `1px solid ${msg.type === 'success' ? 'oklch(90% 0.06 145)' : 'oklch(88% 0.06 25)'}`
        }}>{msg.text}</div>
      )}

      {/* AI 생성 */}
      <div className="card" style={{ padding: 14, background: 'oklch(96% 0.02 300)', border: '1px solid oklch(88% 0.06 295)', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(30% 0.15 300)', marginBottom: 10 }}>🤖 AI 지문 자동 생성</div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <select value={aiCategory} onChange={e => setAiCategory(e.target.value)}
            style={{ flex: '1 1 120px', padding: 'var(--space-2) 10px', border: '1px solid oklch(88% 0.06 295)', borderRadius: 'var(--radius)', fontSize: 13 }}>
            {READING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={aiCount} onChange={e => setAiCount(Number(e.target.value))}
            style={{ flex: '0 0 80px', padding: 'var(--space-2) 10px', border: '1px solid oklch(88% 0.06 295)', borderRadius: 'var(--radius)', fontSize: 13 }}>
            <option value={1}>1지문</option>
            <option value={2}>2지문</option>
            <option value={3}>3지문</option>
            <option value={5}>5지문</option>
          </select>
          <button onClick={handleGenerate} disabled={loading}
            style={{ flex: '0 0 auto', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', border: 'none', background: loading ? 'var(--muted-foreground)' : 'oklch(55% 0.20 290)', color: 'white', fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '생성 중...' : '✨ 생성'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6 }}>카테고리를 선택하면 AI가 지문 + 문제 3개를 자동 생성해서 DB에 추가합니다.</div>
      </div>

      {/* 카테고리별 현황 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {passages.map(c => (
          <div key={c.category} style={{
            padding: '10px var(--space-4)', borderRadius: 10, background: 'oklch(96% 0.02 300)', border: '1px solid oklch(88% 0.06 295)',
            fontSize: 13, fontWeight: 600, color: 'oklch(30% 0.15 300)'
          }}>
            {c.category} <span style={{ fontWeight: 800, color: 'oklch(45% 0.22 290)' }}>({c.count}지문)</span>
          </div>
        ))}
        {passages.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>카테고리를 불러오는 중...</div>
        )}
      </div>
    </div>
  );
}
