import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const TIER_LABELS = {
  free: { text: 'Free', bg: '#f3f4f6', color: '#6b7280' },
  starter: { text: 'Starter', bg: '#dbeafe', color: '#2563eb' },
  pro: { text: 'Pro', bg: '#ede9fe', color: '#7c3aed' },
  first_class: { text: 'First Class', bg: '#fef3c7', color: '#d97706' },
  // 레거시 호환
  trial: { text: 'Free (체험)', bg: '#fef3c7', color: '#92400e' },
  basic: { text: 'Starter', bg: '#dbeafe', color: '#2563eb' },
  standard: { text: 'Pro', bg: '#ede9fe', color: '#7c3aed' },
  growth: { text: 'Pro', bg: '#ede9fe', color: '#7c3aed' },
  premium: { text: 'First Class', bg: '#fef3c7', color: '#d97706' },
  enterprise: { text: 'First Class', bg: '#fef3c7', color: '#d97706' },
};

const ACTION_LABELS = {
  promotion_create: { icon: '🎁', label: '프로모션 생성' },
  promotion_grant: { icon: '🎁', label: '프로모션 지급' },
  promotion_grant_bulk: { icon: '🎁', label: '일괄 지급' },
  academy_create: { icon: '🏫', label: '학원 생성' },
  tier_change: { icon: '⬆️', label: '티어 변경' },
  status_change: { icon: '🔄', label: '상태 변경' },
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [activity, setActivity] = useState([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/superadmin/stats'),
      api('/superadmin/academies'),
      api('/superadmin/activity').catch(() => []),
    ]).then(([s, a, act]) => {
      setStats(s);
      setAcademies(a);
      setActivity(act);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = academies.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.slug?.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'all' || a.subscription_tier === tierFilter;
    const isActive = a.is_active !== false && a.is_active !== 0;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? isActive : !isActive);
    return matchSearch && matchTier && matchStatus;
  });

  const formatNum = (n) => Number(n || 0).toLocaleString();

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT, color: 'var(--muted-foreground)' }}>로딩 중...</div>;

  const cardStyle = {
    background: 'var(--card)', borderRadius: 16, padding: '24px 28px',
    border: '1px solid var(--border)', flex: 1, minWidth: 180,
  };

  const maxRevenue = Math.max(...(stats?.revenueTrend || []).map(r => r.total), 1);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1280, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>플랫폼 관리</h1>
          <p style={{ color: 'var(--muted-foreground)', margin: '4px 0 0', fontSize: 14 }}>나만의 조교 전체 현황</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/superadmin/promotions')}
            style={{
              padding: '12px 20px', background: 'var(--muted)', color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: FONT,
            }}>🎁 프로모션</button>
          <button onClick={() => navigate('/superadmin/academy/new')}
            style={{
              padding: '12px 24px', background: 'var(--primary)', color: 'var(--card)',
              border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT,
            }}>+ 학원 생성</button>
        </div>
      </div>

      {/* 핵심 지표 카드 */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: '총 학원', value: stats.totalAcademies, color: 'var(--foreground)' },
            { label: '총 학생', value: stats.totalStudents, color: 'var(--foreground)' },
            { label: 'MRR', value: `${formatNum(stats.mrr)}원`, color: 'var(--primary)' },
            { label: '이번 달 매출', value: `${formatNum(stats.monthlyRevenue)}원`, color: '#059669' },
            { label: '신규 학원', value: `${stats.newThisMonth || 0}개`, color: '#2563eb' },
            { label: '결제 실패', value: `${stats.failedPayments || 0}건`, color: stats.failedPayments > 0 ? '#dc2626' : 'var(--foreground)' },
          ].map((c, i) => (
            <div key={i} style={{ background: 'var(--card)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 매출 트렌드 + 알림 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* 미니 트렌드 차트 */}
        {stats?.revenueTrend?.length > 0 && (
          <div style={{ ...cardStyle, flex: 'none', cursor: 'pointer' }} onClick={() => navigate('/superadmin/revenue')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>매출 트렌드</span>
              <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>상세 보기 →</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 }}>
              {stats.revenueTrend.map((r, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', maxWidth: 40, height: Math.max((r.total / maxRevenue) * 80, 4),
                    borderRadius: 6, background: 'var(--primary)', opacity: 0.7 + (i / stats.revenueTrend.length) * 0.3,
                  }} />
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{r.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 알림/주의 */}
        <div style={{ ...cardStyle, flex: 'none' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: 12 }}>⚠️ 주의 사항</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats?.failedPayments > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fee2e2', fontSize: 13, color: '#dc2626', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => navigate('/superadmin/revenue')}>
                결제 실패 {stats.failedPayments}건 → 확인하기
              </div>
            )}
            {stats?.expiringTrials?.length > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef3c7', fontSize: 13, color: '#d97706', fontWeight: 600 }}>
                체험 만료 임박 {stats.expiringTrials.length}개 학원
                <div style={{ fontWeight: 400, marginTop: 4, fontSize: 12 }}>
                  {stats.expiringTrials.slice(0, 3).map(t => t.name).join(', ')}
                </div>
              </div>
            )}
            {(!stats?.failedPayments && !stats?.expiringTrials?.length) && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#d1fae5', fontSize: 13, color: '#059669', fontWeight: 600 }}>
                현재 특이사항이 없습니다 ✅
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 티어 분포 + 최근 활동 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {stats?.tierDistribution?.length > 0 && (
          <div style={{ ...cardStyle, flex: 'none' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16 }}>티어 분포</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {stats.tierDistribution.map(t => {
                const tier = TIER_LABELS[t.subscription_tier] || { text: t.subscription_tier, bg: '#f3f4f6', color: '#6b7280' };
                return (
                  <div key={t.subscription_tier} style={{
                    padding: '8px 16px', borderRadius: 10, background: tier.bg,
                    color: tier.color, fontWeight: 700, fontSize: 14,
                  }}>
                    {tier.text} {t.count}개
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 최근 활동 */}
        <div style={{ ...cardStyle, flex: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>최근 활동</div>
          {activity.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>활동 내역이 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.slice(0, 8).map(a => {
                const info = ACTION_LABELS[a.action] || { icon: '📋', label: a.action };
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span>{info.icon}</span>
                    <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{info.label}</span>
                    <span style={{ color: 'var(--muted-foreground)', flex: 1 }}>{a.actor_name || ''}</span>
                    <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('ko-KR') : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 상태 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'all', label: '전체', count: academies.length },
          { key: 'active', label: '활성', count: academies.filter(a => a.is_active !== false && a.is_active !== 0).length },
          { key: 'inactive', label: '비활성', count: academies.filter(a => a.is_active === false || a.is_active === 0).length },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: statusFilter === f.key ? 'var(--primary)' : 'var(--card)',
              color: statusFilter === f.key ? '#fff' : 'var(--muted-foreground)',
              border: '1px solid var(--border)', fontFamily: FONT, transition: 'all 0.15s',
            }}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* 검색/필터 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="학원 검색..." value={search} onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '12px 16px', border: '1.5px solid var(--border)',
            borderRadius: 12, fontSize: 14, fontFamily: FONT, outline: 'none',
            background: 'var(--card)', color: 'var(--foreground)',
          }} />
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
          style={{
            padding: '12px 16px', border: '1.5px solid var(--border)',
            borderRadius: 12, fontSize: 14, fontFamily: FONT, background: 'var(--card)',
            color: 'var(--foreground)', cursor: 'pointer',
          }}>
          <option value="all">전체 티어</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="first_class">First Class</option>
        </select>
      </div>

      {/* 학원 목록 */}
      <div style={{ background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)', padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 720 }}>
          <thead>
            <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              {['학원명', '슬러그', '학생 수', '사용자 수', '티어', '상태', '생성일'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--muted-foreground)', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)' }}>학원이 없습니다</td></tr>
            ) : filtered.map(a => {
              const tier = TIER_LABELS[a.subscription_tier] || { text: a.subscription_tier, bg: '#f3f4f6', color: '#6b7280' };
              return (
                <tr key={a.id} onClick={() => navigate(`/superadmin/academy/${a.id}`)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--muted)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--foreground)' }}>{a.name}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 13 }}>{a.slug}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--foreground)' }}>{a.student_count || 0}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--foreground)' }}>{a.user_count || 0}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 8, background: tier.bg, color: tier.color, fontWeight: 600, fontSize: 12 }}>
                      {tier.text}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {(a.is_active !== false && a.is_active !== 0) ? (
                      <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#d1fae5', color: '#059669' }}>활성</span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#fee2e2', color: '#dc2626' }}>비활성</span>
                        {a.updated_at && <span style={{ color: '#ef4444', fontSize: 11 }}>({Math.floor((Date.now() - new Date(a.updated_at).getTime()) / 86400000)}일)</span>}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--muted-foreground)', fontSize: 13 }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
