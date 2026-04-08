import { useState, useEffect } from 'react';
import { api, apiPost } from '../../../api';

const KNOWLEDGE_CATEGORIES = ['사회', '과학', '역사', '지리', '법', '경제', '윤리', '문화', '정치', '기술'];

export default function KnowledgeTab() {
  const [categories, setCategories] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiCategory, setAiCategory] = useState('사회');
  const [aiCount, setAiCount] = useState(10);

  const load = () => {
    api('/gamification/knowledge/categories').then(setCategories).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const handleReseed = async () => {
    if (!confirm('⚠️ 기존 지식 퀴즈 문제를 모두 삭제하고 최신 시드 데이터로 교체합니다.\n계속하시겠습니까?')) return;
    setLoading(true);
    try {
      const result = await apiPost('/gamification/admin/knowledge/reseed', {});
      setMsg({ type: 'success', text: result.message });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const result = await apiPost('/gamification/admin/knowledge/generate-ai', { category: aiCategory, count: aiCount });
      setMsg({ type: 'success', text: result.message });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🧠 지식 퀴즈 문제</h3>
        <button onClick={handleReseed} disabled={loading}
          style={{ padding: 'var(--space-2) 14px', borderRadius: 'var(--radius)', border: '1px solid var(--warning)', background: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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
      <div className="card" style={{ padding: 14, background: 'var(--info-light)', border: '1px solid oklch(85% 0.06 230)', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>🤖 AI 문제 자동 생성</div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <select value={aiCategory} onChange={e => setAiCategory(e.target.value)}
            style={{ flex: '1 1 120px', padding: 'var(--space-2) 10px', border: '1px solid oklch(85% 0.06 230)', borderRadius: 'var(--radius)', fontSize: 13 }}>
            {KNOWLEDGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={aiCount} onChange={e => setAiCount(Number(e.target.value))}
            style={{ flex: '0 0 80px', padding: 'var(--space-2) 10px', border: '1px solid oklch(85% 0.06 230)', borderRadius: 'var(--radius)', fontSize: 13 }}>
            <option value={5}>5개</option>
            <option value={10}>10개</option>
            <option value={15}>15개</option>
            <option value={20}>20개</option>
          </select>
          <button onClick={handleGenerate} disabled={loading}
            style={{ flex: '0 0 auto', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius)', border: 'none', background: loading ? 'var(--muted-foreground)' : 'oklch(62% 0.16 230)', color: 'white', fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '생성 중...' : '✨ 생성'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 6 }}>카테고리를 선택하면 AI가 해당 분야 문제를 자동 생성해서 DB에 추가합니다.</div>
      </div>

      {/* 카테고리별 현황 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {categories.map(c => (
          <div key={c.category} style={{
            padding: '10px var(--space-4)', borderRadius: 10, background: 'var(--info-light)', border: '1px solid oklch(85% 0.06 230)',
            fontSize: 13, fontWeight: 600, color: 'var(--primary)'
          }}>
            {c.category} <span style={{ fontWeight: 800, color: 'var(--primary)' }}>({c.count}문제)</span>
          </div>
        ))}
        {categories.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>카테고리를 불러오는 중...</div>
        )}
      </div>
    </div>
  );
}
