import { useState, useEffect } from 'react';
import { api, apiPost, getUser } from '../../api';
import { requestPayment } from '../../utils/payment';

const CHARGE_AMOUNTS = [5000, 10000, 30000, 50000, 100000];

export default function SmsCredits() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [charging, setCharging] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const loadData = () => {
    Promise.all([
      api('/sms-credits/balance').catch(() => ({ balance: 0 })),
      api('/sms-credits/transactions').catch(() => ({ transactions: [] })),
      api('/sms-credits/pricing').catch(() => ({ pricing: [] })),
    ]).then(([bal, txns, price]) => {
      setBalance(bal?.balance || 0);
      setTransactions(txns?.transactions || (Array.isArray(txns) ? txns : []));
      setPricing(price?.pricing || (Array.isArray(price) ? price : []));
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const handleCharge = async () => {
    if (!selectedAmount) { showMsg('충전 금액을 선택하세요.', 'error'); return; }
    setCharging(true);
    try {
      const user = getUser();
      const { paymentId } = await requestPayment(selectedAmount, 'SMS 크레딧 충전', user?.name || '관리자');
      const res = await apiPost('/sms-credits/charge', { amount: selectedAmount, payment_id: paymentId });
      showMsg(res.message || '충전이 완료되었습니다.');
      setSelectedAmount(null);
      loadData();
    } catch (e) {
      showMsg(e.message, 'error');
    } finally {
      setCharging(false);
    }
  };

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;

  const typeMap = {
    charge: { label: '충전', bg: 'var(--success-light)', color: 'oklch(52% 0.14 160)', sign: '+' },
    use: { label: '사용', bg: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', sign: '-' },
    refund: { label: '환불', bg: 'oklch(97% 0.02 60)', color: 'oklch(52% 0.18 45)', sign: '+' },
  };

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 20 }}>SMS 크레딧</h2>

      {msg.text && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600,
          background: msg.type === 'error' ? 'var(--destructive-light)' : 'var(--success-light)',
          color: msg.type === 'error' ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)',
        }}>{msg.text}</div>
      )}

      {/* 잔액 카드 */}
      <section style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, oklch(48% 0.18 260) 100%)',
        borderRadius: 16, padding: 28, color: 'white', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <p style={{ fontSize: 14, opacity: 0.8 }}>SMS 잔여 크레딧</p>
          <p style={{ fontSize: 42, fontWeight: 900, marginTop: 4 }}>{balance.toLocaleString()}<span style={{ fontSize: 18, fontWeight: 600, opacity: 0.8 }}>원</span></p>
        </div>
      </section>

      {/* 충전 금액 선택 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>충전하기</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          {CHARGE_AMOUNTS.map(amount => (
            <button key={amount} onClick={() => setSelectedAmount(amount)}
              style={{
                padding: '16px 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 16, fontWeight: 700, textAlign: 'center',
                border: selectedAmount === amount ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: selectedAmount === amount ? 'var(--info-light)' : 'white',
                color: selectedAmount === amount ? 'var(--primary)' : 'var(--foreground)',
              }}>
              {amount.toLocaleString()}원
            </button>
          ))}
        </div>
        <button onClick={handleCharge} disabled={charging || !selectedAmount}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: selectedAmount ? 'var(--primary)' : 'var(--border)', color: selectedAmount ? 'white' : 'var(--neutral-400)',
            fontWeight: 700, fontSize: 15, fontFamily: 'inherit', opacity: charging ? 0.6 : 1,
          }}>
          {charging ? '결제 진행 중...' : selectedAmount ? `${selectedAmount.toLocaleString()}원 충전하기` : '금액을 선택하세요'}
        </button>
      </section>

      {/* 단가 안내 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>발송 단가</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {pricing.length > 0 ? pricing.map((p, i) => (
            <div key={i} style={{ padding: 14, borderRadius: 8, background: 'var(--muted)', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{p.type}</p>
              <p style={{ fontSize: 13, color: 'var(--neutral-500)', marginTop: 2 }}>{p.description}</p>
              <p style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{p.unitPrice}원<span style={{ fontSize: 12, fontWeight: 500 }}>/건</span></p>
            </div>
          )) : (
            <>
              <div style={{ padding: 14, borderRadius: 8, background: 'var(--muted)', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>SMS</p>
                <p style={{ fontSize: 13, color: 'var(--neutral-500)' }}>단문 (90자 이내)</p>
                <p style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>9.9원<span style={{ fontSize: 12, fontWeight: 500 }}>/건</span></p>
              </div>
              <div style={{ padding: 14, borderRadius: 8, background: 'var(--muted)', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>LMS</p>
                <p style={{ fontSize: 13, color: 'var(--neutral-500)' }}>장문 (2000자 이내)</p>
                <p style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>30원<span style={{ fontSize: 12, fontWeight: 500 }}>/건</span></p>
              </div>
              <div style={{ padding: 14, borderRadius: 8, background: 'var(--muted)', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>알림톡</p>
                <p style={{ fontSize: 13, color: 'var(--neutral-500)' }}>카카오 알림톡</p>
                <p style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>7.5원<span style={{ fontSize: 12, fontWeight: 500 }}>/건</span></p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 사용 내역 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>사용 내역</h3>
        {transactions.length === 0 ? (
          <p style={{ color: 'var(--neutral-500)', fontSize: 14 }}>사용 내역이 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--muted)' }}>
                  <th style={{ padding: 10, textAlign: 'left' }}>날짜</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>유형</th>
                  <th style={{ padding: 10, textAlign: 'right' }}>금액</th>
                  <th style={{ padding: 10, textAlign: 'right' }}>잔액</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>비고</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => {
                  const info = typeMap[t.type] || typeMap.use;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 10 }}>{t.created_at ? new Date(t.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                      <td style={{ padding: 10 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                          background: info.bg, color: info.color,
                        }}>{info.label}</span>
                      </td>
                      <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, color: info.color }}>
                        {info.sign}{Math.abs(t.amount || 0).toLocaleString()}원
                      </td>
                      <td style={{ padding: 10, textAlign: 'right', color: 'var(--neutral-500)' }}>
                        {t.balance_after != null ? `${t.balance_after.toLocaleString()}원` : '-'}
                      </td>
                      <td style={{ padding: 10, color: 'var(--neutral-500)' }}>{t.description || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
