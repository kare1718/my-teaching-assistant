import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

const STATUS_MAP = {
  pending: { label: '미납', color: '#f59e0b', bg: '#fef9c3' },
  overdue: { label: '연체', color: '#dc2626', bg: '#fee2e2' },
  paid: { label: '완납', color: '#15803d', bg: '#dcfce7' },
  partial: { label: '부분납부', color: '#ea580c', bg: '#fff7ed' },
  refunded: { label: '환불', color: '#6b7280', bg: '#f3f4f6' },
};

export default function ParentTuition() {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/parent/children').then((data) => {
      setChildren(data);
      if (data.length > 0) setSelectedChild(data[0]);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    setLoading(true);
    api(`/parent/children/${selectedChild.id}/tuition`)
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedChild]);

  const unpaid = records.filter(r => r.status === 'pending' || r.status === 'overdue');
  const paid = records.filter(r => r.status !== 'pending' && r.status !== 'overdue');

  const handlePay = (record) => {
    if (record.payment_token) {
      navigate(`/pay/${record.payment_token}`);
    }
  };

  if (loading && children.length === 0) {
    return <div style={styles.container}><p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>불러오는 중...</p></div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>수납 내역</h2>

      {children.length > 1 && (
        <select
          value={selectedChild?.id || ''}
          onChange={(e) => setSelectedChild(children.find(c => c.id === Number(e.target.value)))}
          style={styles.select}
        >
          {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {/* 미납 목록 */}
      {unpaid.length > 0 && (
        <>
          <h3 style={styles.sectionTitle}>
            미납 ({unpaid.length}건 / {unpaid.reduce((s, r) => s + (r.adjusted_amount || r.amount), 0).toLocaleString()}원)
          </h3>
          {unpaid.map(r => {
            const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
            return (
              <div key={r.id} style={{ ...styles.card, borderLeft: `4px solid ${st.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{r.plan_name || '수업료'}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                      납부 기한: {r.due_date ? new Date(r.due_date).toLocaleDateString('ko-KR') : '-'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                      {(r.adjusted_amount || r.amount || 0).toLocaleString()}원
                    </p>
                    <span style={{ ...styles.badge, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                </div>
                {r.payment_token && (
                  <button onClick={() => handlePay(r)} style={styles.payBtn}>결제하기</button>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* 결제 완료 이력 */}
      <h3 style={styles.sectionTitle}>결제 이력</h3>
      {paid.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 20, color: '#6b7280', fontSize: 14 }}>결제 이력이 없습니다.</p>
      ) : (
        paid.map(r => {
          const st = STATUS_MAP[r.status] || { label: r.status, color: '#6b7280', bg: '#f3f4f6' };
          return (
            <div key={r.id} style={styles.listItem}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{r.plan_name || '수업료'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                  {r.paid_at ? new Date(r.paid_at).toLocaleDateString('ko-KR') : r.due_date ? new Date(r.due_date).toLocaleDateString('ko-KR') : '-'}
                  {r.payment_method && ` (${r.payment_method})`}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  {(r.adjusted_amount || r.amount || 0).toLocaleString()}원
                </p>
                <span style={{ ...styles.badge, background: st.bg, color: st.color }}>{st.label}</span>
              </div>
            </div>
          );
        })
      )}

      <div style={{ height: 80 }} />
    </div>
  );
}

const styles = {
  container: { maxWidth: 480, margin: '0 auto', padding: '16px 16px 0' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 12 },
  select: {
    width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)', marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: 600, margin: '16px 0 8px',
    color: 'var(--text-primary, #111)',
  },
  card: {
    padding: 14, borderRadius: 10,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)', marginBottom: 8,
  },
  listItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border-color, #e5e7eb)', marginBottom: 6,
  },
  badge: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 12,
    fontSize: 11, fontWeight: 600, marginTop: 4,
  },
  payBtn: {
    marginTop: 10, width: '100%', padding: '10px 0', borderRadius: 8,
    border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    background: 'var(--primary-color, #4f46e5)', color: '#fff',
  },
};
