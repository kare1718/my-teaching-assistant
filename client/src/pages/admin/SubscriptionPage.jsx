import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, apiPost, apiPut, getUser } from '../../api';
import { requestBillingKey } from '../../utils/payment';

// 요금제 4단 — server/middleware/subscription.js 와 동기화 (모든 가격 VAT 별도)
const PLANS = [
  { id: 'free', name: 'Free', price: 0, yearlyPrice: 0, maxStudents: '15명', features: ['학생 15명', '성적 관리', '출결', '공지', '수업 자료', 'Q&A'], desc: '1인 과외·소규모 체험' },
  { id: 'starter', name: 'Starter', price: 49000, yearlyPrice: 41650, maxStudents: '50명', features: ['학생 50명', 'Free 기능 전체', '학생 관리 고급', '수납 기본', 'SMS 발송', '보호자 앱', '기본 상담 메모'], desc: '소형 학원 운영 기본팩', popular: true },
  { id: 'pro', name: 'Pro', price: 129000, yearlyPrice: 109650, maxStudents: '100명', features: ['학생 100명', 'Starter 기능 전체', '자동화 엔진', '상담 CRM + 리드', '수납 예외 처리', '고급 리포트', 'AI 리포트'], desc: '성장 학원' },
  { id: 'first_class', name: 'First Class', price: 0, yearlyPrice: 0, maxStudents: '무제한', features: ['학생 무제한', 'Pro 기능 전체', '게이미피케이션', '아바타/상점', 'AI 문제 생성', '브랜딩', '전담 지원'], desc: '관리형/입시형 학원', inquiry: true },
];

const TIER_ORDER = ['free', 'starter', 'pro', 'first_class'];

// 레거시 tier → 현행 4단 매핑 (기존 DB 데이터 호환)
const LEGACY_TIER_MAP = {
  trial: 'free',
  basic: 'starter',
  standard: 'pro',
  growth: 'pro',
  premium: 'first_class',
};
const normalizeTier = (t) => LEGACY_TIER_MAP[t] || t || 'free';

const STATUS_MAP = {
  trial: { label: '무료 체험', cls: 'bg-amber-100 text-amber-700' },
  active: { label: '활성', cls: 'bg-emerald-100 text-emerald-700' },
  past_due: { label: '결제 실패', cls: 'bg-red-100 text-red-600' },
  canceled: { label: '해지됨', cls: 'bg-slate-100 text-slate-500' },
  suspended: { label: '정지됨', cls: 'bg-red-100 text-red-600' },
};

const SETTINGS_TABS = [
  { label: '학원 정보', path: '/admin/settings' },
  { label: '구독 관리', path: '/admin/subscription' },
  { label: '역할·권한', path: null },
  { label: '출결 정책', path: null },
  { label: '수납 정책', path: null },
  { label: '알림 설정', path: null },
];

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const location = useLocation();

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

  const rawTier = subInfo?.academy?.subscription_tier || 'free';
  const currentTier = normalizeTier(rawTier);
  const subscription = subInfo?.subscription;
  const status = subscription?.status || (rawTier === 'trial' ? 'trial' : 'active');

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
      return { label: '도입 문의', disabled: false, style: 'inquiry', action: () => window.open('mailto:support@najogyo.com?subject=First Class 플랜 도입 문의', '_blank') };
    }
    const currentIdx = TIER_ORDER.indexOf(currentTier);
    const planIdx = TIER_ORDER.indexOf(plan.id);

    if (plan.id === currentTier) {
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

  if (loading) return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto">
      <p className="text-sm text-slate-500">로딩 중...</p>
    </div>
  );

  const statusInfo = STATUS_MAP[status] || STATUS_MAP.trial;
  const daysLeft = trialDaysLeft();
  const isYearly = billingCycle === 'yearly';
  const currentPlan = PLANS.find(p => p.id === currentTier);
  const currentStudents = subInfo?.currentStudents || 0;
  const maxStudents = subInfo?.academy?.max_students || 0;
  const usagePercent = maxStudents > 0 ? Math.min(100, Math.round((currentStudents / maxStudents) * 100)) : 0;

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
      {/* Settings Tabs */}
      <div className="flex gap-2 flex-wrap mb-2">
        {SETTINGS_TABS.map(tab => {
          const isCurrent = tab.path === location.pathname;
          const disabled = !tab.path;
          return (
            <button
              key={tab.label}
              onClick={() => tab.path && navigate(tab.path)}
              disabled={disabled}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                isCurrent
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : disabled
                    ? 'bg-white border border-slate-200 text-slate-300 cursor-default'
                    : 'bg-white border border-slate-200 text-slate-500 hover:text-[var(--primary)] hover:border-[var(--primary)]/30'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Message */}
      {msg.text && (
        <div className={`px-5 py-3 rounded-xl text-sm font-semibold ${
          msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Section 1: Current Plan + Quick Actions (Bento) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Current Plan Card */}
        <div className="col-span-12 lg:col-span-8 bg-white p-8 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-[var(--primary)]">
                  {(currentPlan?.name || currentTier)} 플랜
                </h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo.cls}`}>
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {status === 'past_due' && (
                  <button
                    onClick={handleRetry}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-[var(--cta)] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    결제 재시도
                  </button>
                )}
                {subscription && status !== 'canceled' && status !== 'trial' && (
                  <button
                    onClick={handleUpdatePayment}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg bg-[#e7e8e9] text-[var(--primary)] text-sm font-bold hover:bg-[#dfe0e1] transition-colors disabled:opacity-50"
                  >
                    결제 수단 변경
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="space-y-1">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  {status === 'trial' ? 'Trial Ends' : 'Next Payment Date'}
                </p>
                <p className="text-lg font-bold text-[#191c1d]">
                  {status === 'trial' && daysLeft !== null
                    ? `${daysLeft}일 남음`
                    : subscription?.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR')
                      : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Payment Method</p>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">credit_card</span>
                  <p className="text-lg font-bold text-[#191c1d]">
                    {subscription?.payment_method || '등록된 결제 수단 없음'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Current Usage (Students)</p>
              <p className="font-bold text-[var(--primary)]">
                {currentStudents} / <span className="text-slate-400">{maxStudents}</span>
              </p>
            </div>
            <div className="w-full bg-[#edeeef] rounded-full h-3 overflow-hidden">
              <div
                className="bg-[var(--cta)] h-full rounded-full transition-all duration-500"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {usagePercent >= 80 && (
              <p className="text-[11px] text-slate-500 italic">
                80%를 초과할 경우 플랜 업그레이드 권장이 알림으로 전송됩니다.
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-span-12 lg:col-span-4 bg-[#f3f4f5] p-8 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--primary)] mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {/* Coupon */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-slate-400 text-base">card_giftcard</span>
                  <span className="text-sm font-semibold text-slate-600">쿠폰 코드</span>
                </div>
                <div className="flex gap-2">
                  <input
                    placeholder="코드 입력"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleRedeemCoupon()}
                    className="flex-1 px-3 py-2 bg-[#edeeef] rounded-lg text-sm outline-none border border-transparent focus:border-[var(--cta)]/40 focus:bg-white focus:ring-4 focus:ring-[var(--cta)]/5"
                    style={{ fontFamily: 'monospace' }}
                  />
                  <button
                    onClick={handleRedeemCoupon}
                    disabled={!couponCode.trim() || couponLoading}
                    className="px-3 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    {couponLoading ? '...' : '적용'}
                  </button>
                </div>
              </div>
              <button className="w-full text-left px-4 py-3 bg-white rounded-lg flex items-center justify-between group hover:shadow-sm transition-all">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[var(--primary)] transition-colors">receipt_long</span>
                  <span className="text-sm font-semibold text-slate-600 group-hover:text-[var(--primary)]">지난 결제 내역 보기</span>
                </div>
                <span className="material-symbols-outlined text-slate-300 text-sm">chevron_right</span>
              </button>
              <button className="w-full text-left px-4 py-3 bg-white rounded-lg flex items-center justify-between group hover:shadow-sm transition-all">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[var(--primary)] transition-colors">help</span>
                  <span className="text-sm font-semibold text-slate-600 group-hover:text-[var(--primary)]">도움말 및 FAQ</span>
                </div>
                <span className="material-symbols-outlined text-slate-300 text-sm">chevron_right</span>
              </button>
            </div>
          </div>
          {subscription && status !== 'canceled' && status !== 'trial' && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="mt-8 text-sm font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">cancel</span>
              구독 취소 신청
            </button>
          )}
        </div>
      </div>

      {/* Section 2: Plan Comparison */}
      <div>
        <div className="mb-6">
          <h3 className="text-xl font-bold text-[var(--primary)]">플랜 요금제 비교</h3>
          <p className="text-sm text-slate-500">학원 규모와 필요한 기능에 맞는 최적의 플랜을 선택하세요.</p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-[#edeeef] rounded-xl p-1 relative">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !isYearly ? 'bg-white text-[var(--primary)] shadow-sm' : 'text-slate-500'
              }`}
            >
              월간 결제
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                isYearly ? 'bg-white text-[var(--primary)] shadow-sm' : 'text-slate-500'
              }`}
            >
              연간 결제
            </button>
            <span className="absolute -top-2.5 -right-3 bg-gradient-to-r from-red-500 to-red-600 text-white px-2 py-0.5 rounded-md text-[10px] font-extrabold shadow-md">
              15% OFF
            </span>
          </div>
        </div>

        {isYearly && (
          <div className="text-center mb-6 px-4 py-2 bg-emerald-50 rounded-xl text-sm font-semibold text-emerald-600 max-w-md mx-auto">
            연간 결제 시 매달 15% 할인된 가격으로 이용하세요
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentTier;
            const price = isYearly ? plan.yearlyPrice : plan.price;
            const originalPrice = plan.price;
            const action = getPlanAction(plan);
            const showDiscount = isYearly && plan.price > 0 && !plan.inquiry;
            const yearlySaving = plan.price > 0 ? (plan.price - plan.yearlyPrice) * 12 : 0;

            return (
              <div
                key={plan.id}
                className={`p-6 rounded-xl flex flex-col h-full transition-all ${
                  isCurrent
                    ? 'bg-white border-t-4 border-[var(--cta)] shadow-xl ring-2 ring-[var(--cta)]/5 transform scale-105 z-10'
                    : 'bg-[#f3f4f5] border-t-4 border-transparent hover:border-slate-200'
                }`}
              >
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-1">
                    <p className={`text-xs font-bold uppercase tracking-widest ${
                      isCurrent ? 'text-[var(--cta)]' : 'text-slate-400'
                    }`}>
                      {plan.name.toUpperCase()}
                    </p>
                    {isCurrent && (
                      <span className="bg-[var(--cta)] text-white text-[10px] font-black px-2 py-0.5 rounded">USED</span>
                    )}
                    {plan.popular && !isCurrent && (
                      <span className="bg-[var(--primary)] text-white text-[10px] font-black px-2 py-0.5 rounded">BEST</span>
                    )}
                  </div>
                  {plan.inquiry ? (
                    <h4 className="text-2xl font-black text-[var(--primary)]">별도 문의</h4>
                  ) : price === 0 ? (
                    <h4 className="text-2xl font-black text-[var(--primary)]">
                      ₩0 <span className="text-sm font-normal text-slate-500">/mo</span>
                    </h4>
                  ) : (
                    <div>
                      {showDiscount && (
                        <p className="text-sm text-slate-400 line-through">₩{originalPrice.toLocaleString()}</p>
                      )}
                      <h4 className="text-2xl font-black text-[var(--primary)]">
                        ₩{price.toLocaleString()} <span className="text-sm font-normal text-slate-500">/mo</span>
                      </h4>
                    </div>
                  )}
                </div>

                {showDiscount && yearlySaving > 0 && (
                  <div className="mb-4 px-3 py-1.5 rounded-lg bg-red-50 text-xs font-bold text-red-500 text-center">
                    연 {yearlySaving.toLocaleString()}원 절약
                  </div>
                )}

                <ul className="flex-1 space-y-4 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${
                      isCurrent ? 'text-[#191c1d] font-semibold' : 'text-slate-600'
                    }`}>
                      <span
                        className={`material-symbols-outlined text-sm mt-0.5 ${
                          isCurrent ? 'text-[var(--cta)]' : plan.id === 'free' && i > 0 ? 'text-slate-300' : 'text-[var(--cta)]'
                        }`}
                        style={isCurrent ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {plan.id === 'free' && i > 0 ? 'remove_circle' : 'check_circle'}
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={action.action || undefined}
                  disabled={action.disabled || actionLoading}
                  className={`w-full py-3 rounded-lg text-sm font-bold transition-all ${
                    action.style === 'upgrade'
                      ? 'bg-[var(--primary)] text-white hover:opacity-90'
                      : action.style === 'inquiry'
                        ? 'bg-[var(--primary)] text-white hover:opacity-90'
                        : action.style === 'current'
                          ? 'bg-[#f3f4f5] text-slate-400 cursor-default'
                          : 'bg-white border border-slate-200 text-[var(--primary)] hover:bg-slate-50'
                  } disabled:opacity-50`}
                >
                  {action.label}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-4">
          모든 요금은 부가세(VAT) 포함 가격입니다 &middot; 언제든 해지 가능
        </p>
      </div>

      {/* Section 3: Payment History */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold text-[var(--primary)]">결제 내역</h3>
            <p className="text-sm text-slate-500">최근 정기 결제 리스트입니다.</p>
          </div>
        </div>
        {payments.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">결제 내역이 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {payments.map((p, i) => {
              const isSuccess = p.status === 'paid';
              return (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      isSuccess ? 'bg-[#edeeef] text-[var(--primary)]' : 'bg-red-50 text-red-500'
                    }`}>
                      <span className="material-symbols-outlined">
                        {isSuccess ? 'receipt_long' : 'error_outline'}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-[var(--primary)]">
                        {new Date(p.paid_at || p.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 정기 구독
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(p.paid_at || p.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-[var(--primary)]">₩{p.amount?.toLocaleString()}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {isSuccess ? 'Success' : 'Fail'}
                      </span>
                    </div>
                    {isSuccess ? (
                      <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-[var(--primary)] hover:bg-[#edeeef] transition-all">
                        <span className="material-symbols-outlined text-xl">download</span>
                      </button>
                    ) : (
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300">
                        <span className="material-symbols-outlined text-xl">block</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
