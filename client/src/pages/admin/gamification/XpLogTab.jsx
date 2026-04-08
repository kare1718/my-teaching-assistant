import { useState, useEffect } from 'react';
import { api } from '../../../api';

export default function XpLogTab() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState([]);
  const [days, setDays] = useState(7);
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('days', days);
      if (sourceFilter) params.set('source', sourceFilter);
      const data = await api(`/gamification/admin/xp-logs?${params}`);
      setLogs(data.logs || []);
      setSummary(data.summary || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [days, sourceFilter]);

  const sourceLabels = {
    vocab_quiz: '어휘 퀴즈', knowledge_quiz: '지식 퀴즈', reading_quiz: '비문학 독해',
    daily_login: '출석 보너스', code_redeem: '코드 사용', avatar_change: '아바타 변경',
    nickname_change: '닉네임 변경', admin_adjust: '관리자 조정', homework_bonus: '과제 보너스',
    ox_quiz: 'O/X 퀴즈',
  };
  const getSourceLabel = (s) => sourceLabels[s] || s;

  const filtered = search
    ? logs.filter(l => l.student_name?.includes(search) || l.source?.includes(search) || l.description?.includes(search))
    : logs;

  return (
    <div>
      {/* 요약 카드 */}
      <div className="card" style={{ padding: 14, marginBottom: 'var(--space-2)' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 10 }}>📊 소스별 XP 요약 (최근 {days}일)</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-outline'}`}>{d}일</button>
          ))}
        </div>
        {summary.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
            {summary.map(s => (
              <div key={s.source} onClick={() => setSourceFilter(sourceFilter === s.source ? '' : s.source)}
                style={{
                  padding: 'var(--space-2) 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
                  background: sourceFilter === s.source ? 'var(--info-light)' : 'var(--neutral-50)',
                  border: `1px solid ${sourceFilter === s.source ? 'var(--primary)' : 'var(--border)'}`,
                }}>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{getSourceLabel(s.source)}</div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--foreground)' }}>{s.total_amount?.toLocaleString()} XP</div>
                <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{s.count}건</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 'var(--space-5)', fontSize: 13 }}>데이터 없음</div>
        )}
      </div>

      {/* 로그 목록 */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>📋 활동 로그 ({filtered.length}건)</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름/소스 검색..."
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', width: 160 }} />
        </div>

        {sourceFilter && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--primary)', marginBottom: 'var(--space-2)' }}>
            필터: {getSourceLabel(sourceFilter)} <button onClick={() => setSourceFilter('')}
              style={{ background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>✕ 해제</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--muted-foreground)' }}>로딩 중...</div>
        ) : (
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {filtered.map(l => (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)',
                fontSize: 'var(--text-xs)', gap: 'var(--space-2)',
              }}>
                <span style={{ fontWeight: 600, minWidth: 50 }}>{l.student_name}</span>
                <span style={{ color: 'var(--muted-foreground)', fontSize: 11, minWidth: 50 }}>{l.school}</span>
                <span style={{
                  padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontSize: 10, fontWeight: 600,
                  background: l.amount > 0 ? 'var(--success-light)' : l.amount < 0 ? 'var(--destructive-light)' : 'var(--neutral-100)',
                  color: l.amount > 0 ? 'var(--success)' : l.amount < 0 ? 'var(--destructive)' : 'var(--muted-foreground)',
                }}>
                  {l.amount > 0 ? '+' : ''}{l.amount} XP
                </span>
                <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>{getSourceLabel(l.source)}</span>
                {l.description && <span style={{ color: 'var(--muted-foreground)', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</span>}
                <span style={{ color: 'var(--muted-foreground)', fontSize: 10, flexShrink: 0 }}>
                  {new Date(l.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--muted-foreground)', fontSize: 13 }}>로그가 없습니다.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
