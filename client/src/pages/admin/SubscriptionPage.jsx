import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, getUser } from '../../api';
import { requestBillingKey } from '../../utils/payment';

const PLANS = [
  { id: 'free', name: 'Free', price: 0, yearlyPrice: 0, maxStudents: '10명', features: ['학생 10명', '성적 관리', '게이미피케이션', '기본 기능'], desc: '소규모 수업에 딱' },
  { id: 'basic', name: 'Basic', price: 79000, yearlyPrice: 67000, maxStudents: '50명', features: ['학생 50명', '성적 관리', '게이미피케이션', '랭킹/상점', '안내사항/자료'], desc: '성장하는 학원을 위한' },
  { id: 'standard', name: 'Standard', price: 159000, yearlyPrice: 135000, maxStudents: '100명', features: ['학생 100명', 'Basic 전체 포함', 'AI 리포트', 'SMS 발송', '클리닉/숙제', '출결 알림'], desc: '가장 인기 있는 플랜', popular: true },
  { id: 'pro', name: 'Pro', price: 0, yearlyPrice: 0, maxStudents: '100명 이상', features: ['학생 무제한', 'Standard 전체 포함', '조교 관리', '수납 관리', 'API 내보내기', '전담 매니저'], desc: '대형 학원 맞춤', inquiry: true },
];

const TIER_ORDER = ['free', 'trial', 'basic', 'standard', 'pro'];

const STATUS_MAP = {
  trial: { label: '무료 체험', bg: 'var(--warning-light)', color: 'oklch(55% 0.14 75)', icon: '🎁' },
  active: { label: '활성', bg: 'var(--success-light)', color: 'oklch(52% 0.14 160)', icon: '✓' },
  past_due: { label: '결제 실패', bg: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', icon: '!' },
  canceled: { label: '해지됨', bg: 'var(--secondary)', color: 'var(--muted-foreground)', icon: '—' },
  suspended: { label: '정지됨', bg: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', icon: '!' },
};

export default function SubscriptionPage() {
  const [subInfo, setSubInfo] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [billingCycle, setBillingCycle] = useState('yearly');

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

  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const result = await apiPost('/notifications/redeem-coupon', { code: couponCode.trim() });
      showMsg(result.message || '쿠폰이 적용되었습니다.');
      setCouponCode('');
      loadData();
    } catch (e) {
      showMsg(e.message, 'error');
    } finally {
      setCouponLoading(false);
    }
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
    if (plan.inquiry) {
      return { label: '도입 문의', disabled: false, style: 'inquiry', action: () => window.open('mailto:support@najogyo.com?subject=Pro 플랜 도입 문의', '_blank') };
    }
    const currentIdx = TIER_ORDER.indexOf(currentTier === 'trial' ? 'free' : currentTier);
    const planIdx = TIER_ORDER.indexOf(plan.id);

    if (plan.id === currentTier || (currentTier === 'trial' && plan.id === 'free')) {
      return { label: '현재 플랜', disabled: true, style: 'current' };
    }
    if (plan.id === 'free') {
      return { label: '무료로 전환', disabled: false, style: 'downgrade' };
    }
    if (!subscription || status === 'trial' || status === 'canceled') {
      return { label: '시작하기', disabled: false, style: 'upgrade', action: () => handleSubscribe(plan.id) };
    }
    if (planIdx > currentIdx) {
      return { label: '업그레이드', disabled: false, style: 'upgrade', action: () => handleChangePlan(plan.id) };
    }
    return { label: '변경하기', disabled: false, style: 'downgrade', action: () => handleChangePlan(plan.id) };
  };

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;

  const statusInfo = STATUS_MAP[status] || STATUS_MAP.trial;
  const daysLeft = trialDaysLeft();
  const isYearly = billingCycle === 'yearly';

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 24 }}>구독 관리</h2>

      {msg.text && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600,
          background: msg.type === 'error' ? 'var(--destructive-light)' : 'var(--success-light)',
          color: msg.type === 'error' ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)',
        }}>{msg.text}</div>
      )}

      {/* 쿠폰 코드 입력 */}
      <div style={{
        background: 'var(--card)', borderRadius: 12, padding: '16px 20px', marginBottom: 20,
        border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 18 }}>🎁</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>쿠폰 코드</span>
        <input
          placeholder="쿠폰 코드를 입력하세요"
          value={couponCode}
          onChange={e => setCouponCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleRedeemCoupon()}
          style={{
            flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10,
            fontSize: 14, fontFamily: 'monospace', outline: 'none',
            background: 'var(--background)', color: 'var(--foreground)',
          }}
        />
        <button
          onClick={handleRedeemCoupon}
          disabled={!couponCode.trim() || couponLoading}
          style={{
            padding: '10px 20px', background: 'var(--primary)', color: 'white',
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: couponCode.trim() && !couponLoading ? 'pointer' : 'default',
            opacity: couponCode.trim() && !couponLoading ? 1 : 0.5, whiteSpace: 'nowrap',
          }}
        >{couponLoading ? '적용 중...' : '적용'}</button>
      </div>

      {/* 2단 레이아웃: 좌측 현재구독 + 우측 플랜 */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>

        {/* 좌: 현재 플랜 카드 */}
        <section style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, oklch(48% 0.18 260) 100%)',
          borderRadius: 16, padding: 24, color: 'white', flex: '0 0 280px', minWidth: 260,
        }}>
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

          {/* 학생 수 프로그레스 */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <p style={{ fontSize: 14, opacity: 0.8 }}>학생 수</p>
              <p style={{ fontSize: 20, fontWeight: 700 }}>
                {subInfo?.currentStudents || 0}<span style={{ fontSize: 14, opacity: 0.6 }}> / {subInfo?.academy?.max_students || 0}</span>
              </p>
            </div>
            <div style={{ background: 'oklch(100% 0 0 / 0.2)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6, transition: 'width 0.5s ease',
                background: 'oklch(80% 0.14 85)',
                width: `${Math.min(100, ((subInfo?.currentStudents || 0) / (subInfo?.academy?.max_students || 1)) * 100)}%`,
              }} />
            </div>
          </div>

          {/* 액션 버튼들 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
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
                    padding: '8px 16px', borderRadius: 8, border: '2px solid oklch(100% 0 0 / 0.3)',
                    cursor: 'pointer', background: 'oklch(100% 0 0 / 0.15)', color: 'white',
                    fontWeight: 600, fontSize: 13, fontFamily: 'inherit', backdropFilter: 'blur(4px)',
                  }}>결제 수단 변경</button>
                <button onClick={handleCancel} disabled={actionLoading}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '2px solid oklch(100% 0 0 / 0.2)',
                    cursor: 'pointer', background: 'transparent', color: 'oklch(100% 0 0 / 0.7)',
                    fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                  }}>구독 해지</button>
              </>
            )}
          </div>
        </section>

        {/* 우: 플랜 선택 영역 */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* 월간/연간 탭 토글 — 마케팅 스타일 */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{
              display: 'inline-flex', background: 'var(--muted)', borderRadius: 12, padding: 3, position: 'relative',
            }}>
              <button onClick={() => setBillingCycle('monthly')} style={{
                padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                background: !isYearly ? 'var(--card)' : 'transparent',
                color: !isYearly ? 'var(--foreground)' : 'var(--neutral-500)',
                boxShadow: !isYearly ? '0 1px 3px oklch(0% 0 0 / 0.1)' : 'none',
              }}>월간 결제</button>
              <button onClick={() => setBillingCycle('yearly')} style={{
                padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 600, transition: 'all 0.2s', position: 'relative',
                background: isYearly ? 'var(--card)' : 'transparent',
                color: isYearly ? 'var(--foreground)' : 'var(--neutral-500)',
                boxShadow: isYearly ? '0 1px 3px oklch(0% 0 0 / 0.1)' : 'none',
              }}>
                연간 결제
              </button>
              {/* 할인 배지 */}
              <span style={{
                position: 'absolute', top: -10, right: -12,
                background: 'linear-gradient(135deg, oklch(60% 0.22 25), oklch(55% 0.20 15))',
                color: 'white', padding: '2px 8px', borderRadius: 8,
                fontSize: 11, fontWeight: 800, letterSpacing: '-0.02em',
                boxShadow: '0 2px 6px oklch(55% 0.20 25 / 0.3)',
              }}>15% OFF</span>
            </div>
          </div>

          {/* 연간 결제 절약 안내 */}
          {isYearly && (
            <div style={{
              textAlign: 'center', marginBottom: 16, padding: '8px 16px',
              background: 'oklch(95% 0.04 140)', borderRadius: 10, fontSize: 13, fontWeight: 600,
              color: 'oklch(45% 0.14 140)',
            }}>
              연간 결제 시 매달 15% 할인된 가격으로 이용하세요
            </div>
          )}

          {/* 플랜 카드 2x2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {PLANS.map(plan => {
              const isCurrent = plan.id === currentTier || (currentTier === 'trial' && plan.id === 'free');
              const price = isYearly ? plan.yearlyPrice : plan.price;
              const originalPrice = plan.price;
              const action = getPlanAction(plan);
              const showDiscount = isYearly && plan.price > 0 && !plan.inquiry;
              const yearlySaving = plan.price > 0 ? (plan.price - plan.yearlyPrice) * 12 : 0;

              return (
                <div key={plan.id} style={{
                  background: 'var(--card)', borderRadius: 16, padding: '28px 24px', textAlign: 'center',
                  border: plan.popular ? '2px solid var(--primary)' : isCurrent ? '2px solid oklch(48% 0.18 260)' : '1px solid var(--border)',
                  position: 'relative', display: 'flex', flexDirection: 'column',
                  boxShadow: plan.popular ? '0 4px 16px oklch(48% 0.18 260 / 0.15)' : 'none',
                }}>
                  {/* 인기 배지 */}
                  {plan.popular && !isCurrent && (
                    <div style={{
                      position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                      background: 'var(--primary)', color: 'white', padding: '4px 18px', borderRadius: 12,
                      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                    }}>BEST</div>
                  )}
                  {/* 현재 플랜 배지 */}
                  {isCurrent && (
                    <div style={{
                      position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                      background: 'oklch(48% 0.18 260)', color: 'white', padding: '4px 18px', borderRadius: 12,
                      fontSize: 12, fontWeight: 700,
                    }}>현재 플랜</div>
                  )}

                  <h4 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4, marginTop: (isCurrent || plan.popular) ? 10 : 0 }}>{plan.name}</h4>
                  <p style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 16 }}>{plan.desc}</p>

                  {/* 가격 영역 */}
                  <div style={{ minHeight: 64, marginBottom: 8 }}>
                    {plan.inquiry ? (
                      <p style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)' }}>별도 문의</p>
                    ) : price === 0 ? (
                      <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)' }}>무료</p>
                    ) : (
                      <>
                        {showDiscount && (
                          <p style={{
                            fontSize: 14, color: 'var(--neutral-400)', textDecoration: 'line-through',
                            fontWeight: 500, marginBottom: 4,
                          }}>{originalPrice.toLocaleString()}원</p>
                        )}
                        <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--primary)', lineHeight: 1.1 }}>
                          {price.toLocaleString()}<span style={{ fontSize: 15, fontWeight: 600 }}>원</span>
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 4 }}>/월 (부가세 포함)</p>
                      </>
                    )}
                  </div>

                  {/* 연간 절약액 */}
                  {showDiscount && yearlySaving > 0 && (
                    <div style={{
                      margin: '0 0 8px', padding: '5px 12px', borderRadius: 8,
                      background: 'oklch(95% 0.05 25)', fontSize: 12, fontWeight: 700,
                      color: 'oklch(50% 0.18 25)',
                    }}>
                      연 {yearlySaving.toLocaleString()}원 절약
                    </div>
                  )}

                  <p style={{ fontSize: 14, color: 'var(--neutral-500)', marginTop: 4, marginBottom: 12, fontWeight: 700 }}>최대 {plan.maxStudents}</p>

                  {/* 구분선 */}
                  <div style={{ height: 1, background: 'var(--border)', margin: '0 0 14px' }} />

                  <ul style={{ textAlign: 'left', margin: '0 0 16px', padding: '0 0 0 4px', fontSize: 13, color: 'var(--neutral-600)', flex: 1, listStyle: 'none' }}>
                    {plan.features.map((f, i) => (
                      <li key={i} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'oklch(55% 0.16 160)', fontSize: 14, flexShrink: 0 }}>&#10003;</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={action.action || undefined}
                    disabled={action.disabled || actionLoading}
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: 12, cursor: action.disabled ? 'default' : 'pointer',
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
                      background: action.style === 'upgrade' ? 'var(--primary)'
                        : action.style === 'inquiry' ? 'linear-gradient(135deg, oklch(55% 0.14 75), oklch(50% 0.14 55))'
                        : action.style === 'current' ? 'var(--muted)' : 'white',
                      color: action.style === 'upgrade' || action.style === 'inquiry' ? 'white'
                        : action.style === 'current' ? 'var(--muted-foreground)' : 'var(--primary)',
                      border: action.style === 'downgrade' ? '1px solid var(--border)' : 'none',
                      opacity: actionLoading ? 0.6 : 1,
                      boxShadow: action.style === 'upgrade' ? '0 2px 8px oklch(48% 0.18 260 / 0.3)' : 'none',
                    }}
                  >{action.label}</button>
                </div>
              );
            })}
          </div>

          {/* 하단 부가 안내 */}
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--neutral-400)', marginTop: 12 }}>
            모든 요금은 부가세(VAT) 포함 가격입니다 &middot; 언제든 해지 가능
          </p>
        </div>
      </div>

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
