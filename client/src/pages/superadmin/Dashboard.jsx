import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const TIER_LABELS = {
  trial: { text: '체험', bg: '#f3f4f6', color: '#6b7280' },
  basic: { text: '베이직', bg: '#dbeafe', color: '#2563eb' },
  standard: { text: '스탠다드', bg: '#d1fae5', color: '#059669' },
  pro: { text: '프로', bg: '#ede9fe', color: '#7c3aed' },
  enterprise: { text: '엔터프라이즈', bg: '#fef3c7', color: '#d97706' },
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/superadmin/stats'),
      api('/superadmin/academies'),
    ]).then(([s, a]) => {
      setStats(s);
      setAcademies(a);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = academies.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.slug?.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'all' || a.subscription_tier === tierFilter;
    return matchSearch && matchTier;
  });

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT, color: 'var(--muted-foreground)' }}>로딩 중...</div>;

  const cardStyle = {
    background: 'var(--card)', borderRadius: 16, padding: '24px 28px',
    border: '1px solid var(--border)', flex: 1, minWidth: 180,
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>플랫폼 관리</h1>
          <p style={{ color: 'var(--muted-foreground)', margin: '4px 0 0', fontSize: 14 }}>나만의 조교 전체 현황</p>
        </div>
        <button
          onClick={() => navigate('/superadmin/academy/new')}
          style={{
            padding: '12px 24px', background: 'var(--primary)', color: 'var(--card)',
            border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: FONT,
          }}
        >
          + 학원 생성
        </button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>총 학원</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>{stats.totalAcademies}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>총 학생</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>{stats.totalStudents}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>총 사용자</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>{stats.totalUsers}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>이번 달 매출</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
              {Number(stats.monthlyRevenue).toLocaleString()}원
            </div>
          </div>
        </div>
      )}

      {/* 티어 분포 */}
      {stats?.tierDistribution?.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 28, flex: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16 }}>티어 분포</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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

      {/* 검색/필터 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="학원 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '12px 16px', border: '1.5px solid var(--border)',
            borderRadius: 12, fontSize: 14, fontFamily: FONT, outline: 'none',
            background: 'var(--card)', color: 'var(--foreground)',
          }}
        />
        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          style={{
            padding: '12px 16px', border: '1.5px solid var(--border)',
            borderRadius: 12, fontSize: 14, fontFamily: FONT, background: 'var(--card)',
            color: 'var(--foreground)', cursor: 'pointer',
          }}
        >
          <option value="all">전체 티어</option>
          {Object.entries(TIER_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.text}</option>
          ))}
        </select>
      </div>

      {/* 학원 목록 */}
      <div style={{ ...cardStyle, flex: 'none', padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
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
                <tr
                  key={a.id}
                  onClick={() => navigate(`/superadmin/academy/${a.id}`)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--muted)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
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
                    <span style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: a.is_active !== false && a.is_active !== 0 ? '#d1fae5' : '#fee2e2',
                      color: a.is_active !== false && a.is_active !== 0 ? '#059669' : '#dc2626',
                    }}>
                      {a.is_active !== false && a.is_active !== 0 ? '활성' : '비활성'}
                    </span>
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
  );
}
