import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, getUser } from '../../api';
import { requestBillingKey } from '../../utils/payment';

const PLANS = [
  { id: 'free', name: 'Free', price: 0, yearlyPrice: 0, maxStudents: '5명', features: ['학생 5명', '기본 기능'] },
  { id: 'basic', name: 'Basic', price: 49000, yearlyPrice: 39000, maxStudents: '50명', features: ['학생 50명', 'SMS 발송', 'AI 리포트'] },
  { id: 'standard', name: 'Standard', price: 99000, yearlyPrice: 79000, maxStudents: '150명', features: ['학생 150명', '모든 Basic 기능', '수납 관리', '포트폴리오'] },
  { id: 'pro', name: 'Pro', price: 199000, yearlyPrice: 159000, maxStudents: '무제한', features: ['학생 무제한', '모든 Standard 기능', 'API 연동', '우선 지원'] },
];

const TIER_ORDER = ['free', 'trial', 'basic', 'standard', 'pro'];

const STATUS_MAP = {
  trial: { label: '무료 체험', bg: 'var(--warning-light)', color: 'oklch(55% 0.14 75)' },
  active: { label: '활성', bg: 'var(--success-light)', color: 'oklch(52% 0.14 160)' },
  past_due: { label: '결제 실패', bg: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)' },
  canceled: { label: '해지됨', bg: 'var(--secondary)', color: 'var(--muted-foreground)' },
  suspended: { label: '정지됨', bg: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)' },
};

export default function SubscriptionPage() {
  const [subInfo, setSubInfo] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [billingCycle, setBillingCycle] = useState('monthly');

  const loadData = () => {
    Promise.all([
      api('/subscription').catch(() => null),
      api('/subscription/payments').catch(() => []),
    ]).then(([info, pays]) => {
      setSubInfo(info);
      setPayments(pays || []);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const currentTier = subInfo?.academy?.subscription_tier || 'trial';
  const subscription = subInfo?.subscription;
  const status = subscription?.status || (currentTier === 'trial' ? 'trial' : 'active');

  const trialDaysLeft = () => {
    if (!subscription?.trial_ends_at) return null;
    const diff = Math.ceil((new Date(subscription.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const handleSubscribe = async (planId) => {
    if (planId === 'free') return;
    setActionLoading(true);
    try {
      const user = getUser();
      const { billingKey } = await requestBillingKey(user?.name || '관리자');
      const res = await apiPost('/subscription/subscribe', {
        planType: planId,
        billingCycle,
        billingKey,
      });
      showMsg(res.message || '구독이 시작되었습니다.');
      loadData();
    } catch (e) {
      showMsg(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async (planId) => {
    if (!window.confirm(`플랜을 ${planId.toUpperCase()}로 변경하시겠습니까?`)) return;
    setActionLoading(true);
    try {
      const res = await apiPut('/subscription/change-plan', { planType: planId });
      showMsg(res.message || '플랜이 변경되었습니다.');
      loadData();
    } catch (e) {
      showMsg(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('구독을 해지하시겠습니까?\n현재 결제 주기가 끝날 때까지 계속 사용하실 수 있습니다.')) return;
    setActionLoading(true);
    try {
      const res = await apiPost('/subscription/cancel');
      showMsg(res.message || '구독이 해지되었습니다.');
      loadData();
    } catch (e) {
      showMsg(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    setActionLoading(true);
    try {
      const res = await apiPost('/subscription/retry-payment');
      showMsg(res.message || '결제가 성공했습니다.');
      loadData();
    } catch (e) {
      showMsg(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePayment = async () => {
    setActionLoading(true);
    try {
      const user = getUser();
      const { billingKey } = await requestBillingKey(user?.name || '관리자');
      const res = await apiPut('/subscription/payment-method', { billingKey });
      showMsg(res.message || '결제 수단이 변경되었습니다.');
    } catch (e) {
      showMsg(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getPlanAction = (plan) => {
    const currentIdx = TIER_ORDER.indexOf(currentTier === 'trial' ? 'free' : currentTier);
    const planIdx = TIER_ORDER.indexOf(plan.id);

    if (plan.id === currentTier || (currentTier === 'trial' && plan.id === 'free')) {
      return { label: '현재 플랜', disabled: true, style: 'current' };
    }
    if (plan.id === 'free') {
      return { label: '다운그레이드', disabled: false, style: 'downgrade' };
    }
    if (!subscription || status === 'trial' || status === 'canceled') {
      return { label: '구독 시작', disabled: false, style: 'upgrade', action: () => handleSubscribe(plan.id) };
    }
    if (planIdx > currentIdx) {
      return { label: '업그레이드', disabled: false, style: 'upgrade', action: () => handleChangePlan(plan.id) };
    }
    return { label: '다운그레이드', disabled: false, style: 'downgrade', action: () => handleChangePlan(plan.id) };
  };

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;

  const statusInfo = STATUS_MAP[status] || STATUS_MAP.trial;
  const daysLeft = trialDaysLeft();

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 24 }}>구독 관리</h2>

      {msg.text && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600,
          background: msg.type === 'error' ? 'var(--destructive-light)' : 'var(--success-light)',
          color: msg.type === 'error' ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)',
        }}>{msg.text}</div>
      )}

      {/* 현재 플랜 + 상태 */}
      <section style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, oklch(48% 0.18 260) 100%)',
        borderRadius: 16, padding: 24, color: 'white', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <p style={{ fontSize: 14, opacity: 0.8 }}>현재 플랜</p>
              <span style={{
                padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                background: statusInfo.bg, color: statusInfo.color,
              }}>{statusInfo.label}</span>
            </div>
            <h3 style={{ fontSize: 28, fontWeight: 900 }}>
              {currentTier === 'trial' ? '무료 체험' : PLANS.find(p => p.id === currentTier)?.name || currentTier}
            </h3>
            {daysLeft !== null && status === 'trial' && (
              <p style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>
                체험 기간 {daysLeft}일 남음
              </p>
            )}
            {subscription?.current_period_end && status === 'active' && (
              <p style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
                다음 결제일: {new Date(subscription.current_period_end).toLocaleDateString('ko-KR')}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 14, opacity: 0.8 }}>학생 수</p>
            <p style={{ fontSize: 24, fontWeight: 700 }}>
              {subInfo?.currentStudents || 0} / {subInfo?.academy?.max_students || 0}
            </p>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {status === 'past_due' && (
            <button onClick={handleRetry} disabled={actionLoading}
              style={{
                padding: '8px 20px', borderRadius: 8, border: '2px solid oklch(80% 0.14 85)', cursor: 'pointer',
                background: 'oklch(80% 0.14 85)', color: 'var(--primary)', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
              }}>결제 재시도</button>
          )}
          {subscription && status !== 'canceled' && status !== 'trial' && (
            <>
              <button onClick={handleUpdatePayment} disabled={actionLoading}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: '2px solid oklch(100% 0 0 / 0.3)',
                  cursor: 'pointer', background: 'oklch(100% 0 0 / 0.15)', color: 'white',
                  fontWeight: 600, fontSize: 13, fontFamily: 'inherit', backdropFilter: 'blur(4px)',
                }}>결제 수단 변경</button>
              <button onClick={handleCancel} disabled={actionLoading}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: '2px solid oklch(100% 0 0 / 0.2)',
                  cursor: 'pointer', background: 'transparent', color: 'oklch(100% 0 0 / 0.7)',
                  fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                }}>구독 해지</button>
            </>
          )}
        </div>
      </section>

      {/* 월/연 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setBillingCycle('monthly')} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: billingCycle === 'monthly' ? 700 : 500,
          background: billingCycle === 'monthly' ? 'var(--primary)' : 'var(--muted)',
          color: billingCycle === 'monthly' ? 'white' : 'var(--foreground)',
        }}>월간 결제</button>
        <button onClick={() => setBillingCycle('yearly')} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: billingCycle === 'yearly' ? 700 : 500,
          background: billingCycle === 'yearly' ? 'var(--primary)' : 'var(--muted)',
          color: billingCycle === 'yearly' ? 'white' : 'var(--foreground)',
        }}>
          연간 결제 <span style={{ fontSize: 12, color: billingCycle === 'yearly' ? 'oklch(80% 0.14 85)' : 'var(--neutral-500)' }}>20% 할인</span>
        </button>
      </div>

      {/* 플랜 카드 */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentTier || (currentTier === 'trial' && plan.id === 'free');
            const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
            const action = getPlanAction(plan);

            return (
              <div key={plan.id} style={{
                background: 'var(--card)', borderRadius: 14, padding: 20, textAlign: 'center',
                border: isCurrent ? '2px solid oklch(48% 0.18 260)' : '1px solid var(--border)',
                position: 'relative', display: 'flex', flexDirection: 'column',
              }}>
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    background: 'oklch(48% 0.18 260)', color: 'white', padding: '2px 14px', borderRadius: 10,
                    fontSize: 11, fontWeight: 700,
                  }}>현재 플랜</div>
                )}
                <h4 style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, marginTop: isCurrent ? 8 : 0 }}>{plan.name}</h4>
                <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)' }}>
                  {price === 0 ? '무료' : `${price.toLocaleString()}원`}
                </p>
                {price > 0 && <p style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 2 }}>/월</p>}
                <p style={{ fontSize: 14, color: 'var(--neutral-500)', marginTop: 8, fontWeight: 600 }}>최대 {plan.maxStudents}</p>

                <ul style={{ textAlign: 'left', margin: '14px 0', padding: '0 0 0 16px', fontSize: 13, color: 'var(--neutral-600)', flex: 1 }}>
                  {plan.features.map((f, i) => <li key={i} style={{ marginBottom: 4 }}>{f}</li>)}
                </ul>

                <button
                  onClick={action.action || undefined}
                  disabled={action.disabled || actionLoading}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 8, cursor: action.disabled ? 'default' : 'pointer',
                    fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                    background: action.style === 'upgrade' ? 'var(--primary)' : action.style === 'current' ? 'var(--border)' : 'white',
                    color: action.style === 'upgrade' ? 'white' : action.style === 'current' ? 'var(--muted-foreground)' : 'var(--primary)',
                    border: action.style === 'downgrade' ? '1px solid var(--border)' : 'none',
                    opacity: actionLoading ? 0.6 : 1,
                  }}
                >{action.label}</button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 결제 내역 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>결제 내역</h3>
        {payments.length === 0 ? (
          <p style={{ color: 'var(--neutral-500)', fontSize: 14 }}>결제 내역이 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--muted)' }}>
                  <th style={{ textAlign: 'left', padding: 10 }}>날짜</th>
                  <th style={{ textAlign: 'right', padding: 10 }}>금액</th>
                  <th style={{ textAlign: 'center', padding: 10 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 10 }}>{new Date(p.paid_at || p.created_at).toLocaleDateString('ko-KR')}</td>
                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>{p.amount?.toLocaleString()}원</td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                        background: p.status === 'paid' ? 'var(--success-light)' : 'var(--destructive-light)',
                        color: p.status === 'paid' ? 'oklch(52% 0.14 160)' : 'oklch(48% 0.20 25)',
                      }}>{p.status === 'paid' ? '결제완료' : p.status === 'failed' ? '실패' : p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
