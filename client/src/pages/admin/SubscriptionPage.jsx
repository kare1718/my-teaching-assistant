import { useState, useEffect } from 'react';
import { api } from '../../api';

export default function SubscriptionPage() {
  const [subInfo, setSubInfo] = useState(null);
  const [usage, setUsage] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/subscription').catch(() => null),
      api('/subscription/usage').catch(() => []),
      api('/subscription/payments').catch(() => []),
    ]).then(([info, usage, payments]) => {
      setSubInfo(info);
      setUsage(usage || []);
      setPayments(payments || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;

  const tierNames = { trial: '무료 체험', basic: 'Basic', standard: 'Standard', pro: 'Pro', enterprise: 'Enterprise' };
  const currentTier = subInfo?.academy?.subscription_tier || 'trial';

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 24 }}>구독 관리</h2>

      {/* 현재 플랜 */}
      <section style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        borderRadius: 16, padding: 24, color: 'white', marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 14, opacity: 0.8 }}>현재 플랜</p>
            <h3 style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{tierNames[currentTier]}</h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 14, opacity: 0.8 }}>학생 수</p>
            <p style={{ fontSize: 24, fontWeight: 700 }}>
              {subInfo?.currentStudents || 0} / {subInfo?.academy?.max_students || 0}
            </p>
          </div>
        </div>
      </section>

      {/* 사용량 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>이번 달 사용량</h3>
        {usage.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>사용 내역이 없습니다.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {usage.map((u, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 8, background: 'var(--muted)', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#6b7280' }}>{u.usage_type}</p>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{u.total}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 플랜 비교 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>플랜 비교</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {Object.entries(subInfo?.tierLimits || {}).filter(([k]) => k !== 'enterprise').map(([key, val]) => (
            <div key={key} style={{
              padding: 16, borderRadius: 10, textAlign: 'center',
              border: key === currentTier ? '2px solid #2563eb' : '1px solid var(--border)',
              background: key === currentTier ? '#eff6ff' : 'var(--card)'
            }}>
              <h4 style={{ fontWeight: 700 }}>{tierNames[key]}</h4>
              <p style={{ fontSize: 20, fontWeight: 900, margin: '8px 0' }}>
                {val.price ? `${(val.price / 10000).toFixed(0)}만원` : '무료'}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>최대 {val.maxStudents}명</p>
              {key === currentTier && <p style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, marginTop: 4 }}>현재 플랜</p>}
            </div>
          ))}
        </div>
      </section>

      {/* 결제 내역 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>결제 내역</h3>
        {payments.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>결제 내역이 없습니다.</p>
        ) : (
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>날짜</th>
                <th style={{ textAlign: 'right', padding: 8 }}>금액</th>
                <th style={{ textAlign: 'center', padding: 8 }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>{new Date(p.paid_at || p.created_at).toLocaleDateString('ko-KR')}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{p.amount?.toLocaleString()}원</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12,
                      background: p.status === 'paid' ? '#f0fdf4' : '#fef2f2',
                      color: p.status === 'paid' ? '#16a34a' : '#dc2626'
                    }}>{p.status === 'paid' ? '결제완료' : p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
