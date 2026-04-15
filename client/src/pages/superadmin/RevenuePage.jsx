import { useState, useEffect } from 'react';
import { api } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const cardStyle = {
  background: 'var(--card)', borderRadius: 16, padding: '24px 28px',
  border: '1px solid var(--border)',
};

const STATUS_COLORS = {
  paid: { text: '결제완료', bg: '#d1fae5', color: '#059669' },
  pending: { text: '대기', bg: '#fef3c7', color: '#d97706' },
  failed: { text: '실패', bg: '#fee2e2', color: '#dc2626' },
  refunded: { text: '환불', bg: '#e0e7ff', color: '#4f46e5' },
};

export default function RevenuePage() {
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page });
    if (statusFilter) params.set('status', statusFilter);

    Promise.all([
      api('/superadmin/revenue/summary'),
      api(`/superadmin/revenue/payments?${params}`),
    ]).then(([s, p]) => {
      setSummary(s);
      setPayments(p.payments || []);
      setTotalPages(p.totalPages || 1);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const formatNum = (n) => Number(n || 0).toLocaleString();

  if (loading && !summary) return <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT, color: 'var(--muted-foreground)' }}>로딩 중...</div>;

  const maxRevenue = Math.max(...(summary?.revenueTrend || []).map(r => r.total), 1);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1280, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>매출 관리</h1>
        <p style={{ color: 'var(--muted-foreground)', margin: '4px 0 0', fontSize: 14 }}>결제 내역, MRR/ARR, 매출 트렌드</p>
      </div>

      {/* 매출 카드 */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'MRR', value: `${formatNum(summary.mrr)}원`, color: 'var(--primary)' },
            { label: 'ARR', value: `${formatNum(summary.arr)}원`, color: 'var(--foreground)' },
            { label: '이번 달 매출', value: `${formatNum(summary.monthlyRevenue)}원`, color: '#059669' },
            { label: '실패 건수', value: `${summary.failedCount}건`, color: summary.failedCount > 0 ? '#dc2626' : 'var(--foreground)' },
            { label: '환불 총액', value: `${formatNum(summary.refundedTotal)}원`, color: '#4f46e5' },
          ].map((c, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 6개월 트렌드 차트 */}
      {summary?.revenueTrend?.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: 'var(--foreground)' }}>6개월 매출 트렌드</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
            {summary.revenueTrend.map((r, i) => {
              const height = Math.max((r.total / maxRevenue) * 140, 4);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>{formatNum(r.total)}</span>
                  <div style={{
                    width: '100%', maxWidth: 60, height, borderRadius: 8,
                    background: 'var(--primary)', opacity: 0.8 + (i / summary.revenueTrend.length) * 0.2,
                  }} />
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 결제 내역 */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>결제 내역</h3>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: 10,
              fontSize: 13, fontFamily: FONT, background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer',
            }}>
            <option value="">전체 상태</option>
            {Object.entries(STATUS_COLORS).map(([k, v]) => (
              <option key={k} value={k}>{v.text}</option>
            ))}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 720 }}>
          <thead>
            <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              {['학원', '금액', '상태', '결제방법', '결제일', '생성일'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--muted-foreground)', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)' }}>결제 내역이 없습니다</td></tr>
            ) : payments.map(p => {
              const s = STATUS_COLORS[p.status] || STATUS_COLORS.pending;
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--foreground)' }}>
                    {p.academy_name || '-'} <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>{p.academy_slug}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--foreground)' }}>{formatNum(p.amount)}원</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>{s.text}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted-foreground)' }}>{p.payment_method || '-'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted-foreground)', fontSize: 13 }}>
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted-foreground)', fontSize: 13 }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* 페이징 */}
        {totalPages > 1 && (
          <div style={{ padding: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: page <= 1 ? 'default' : 'pointer', fontFamily: FONT, fontSize: 13 }}>이전</button>
            <span style={{ padding: '6px 12px', fontSize: 14, color: 'var(--foreground)' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: page >= totalPages ? 'default' : 'pointer', fontFamily: FONT, fontSize: 13 }}>다음</button>
          </div>
        )}
      </div>
    </div>
  );
}
