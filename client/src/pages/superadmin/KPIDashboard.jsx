import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const PLAN_COLORS = {
  free: '#94a3b8',
  trial: '#94a3b8',
  starter: '#3b82f6',
  basic: '#3b82f6',
  pro: '#7c3aed',
  standard: '#7c3aed',
  first_class: '#f59e0b',
  enterprise: '#f59e0b',
};

const PLAN_LABELS = {
  free: 'Free', trial: 'Free',
  starter: 'Starter', basic: 'Starter',
  pro: 'Pro', standard: 'Pro',
  first_class: 'First Class', enterprise: 'First Class',
};

const EVENT_LABELS = {
  signup: '회원가입',
  onboarding_completed: '온보딩 완료',
  first_student_added: '첫 학생 등록',
  first_attendance: '첫 출결',
  first_notice_sent: '첫 공지',
  first_tuition_billed: '첫 청구',
  login: '로그인',
  feature_used: '기능 사용',
  trial_started: 'Trial 시작',
  payment_success: '결제 성공',
  plan_upgraded: '업그레이드',
  plan_downgraded: '다운그레이드',
  subscription_canceled: '해지',
};

const SEVERITY_STYLE = {
  high: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  medium: { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c' },
  low: { bg: '#fefce8', border: '#fde68a', color: '#a16207' },
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export default function KPIDashboard() {
  const [range, setRange] = useState(30);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [northStar, setNorthStar] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [featureUsage, setFeatureUsage] = useState([]);
  const [plans, setPlans] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { from, to } = useMemo(() => {
    if (range === 'custom' && customFrom && customTo) {
      return { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() };
    }
    return { from: daysAgo(Number(range)), to: new Date().toISOString() };
  }, [range, customFrom, customTo]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const [ns, fn, fu, pl, wn, rc] = await Promise.all([
        api(`/kpi/north-star${qs}`),
        api(`/kpi/funnel${qs}`),
        api('/kpi/feature-usage').catch(() => []),
        api('/kpi/plans').catch(() => []),
        api('/kpi/warnings').catch(() => []),
        api('/kpi/recent?limit=10').catch(() => []),
      ]);
      setNorthStar(ns);
      setFunnel(fn);
      setFeatureUsage(Array.isArray(fu) ? fu : []);
      setPlans(Array.isArray(pl) ? pl : []);
      setWarnings(Array.isArray(wn) ? wn : []);
      setRecent(Array.isArray(rc) ? rc : []);
    } catch (e) {
      setError(e.message || 'KPI 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const cardBase = 'bg-white rounded-xl border border-slate-100 shadow-sm';
  const labelCls = 'text-xs font-bold text-slate-400 uppercase tracking-widest';
  const titleCls = 'text-2xl font-extrabold text-[var(--primary)] tracking-tight';

  const plansTotal = plans.reduce((a, b) => a + (b.count || 0), 0) || 1;

  // 퍼널 단계
  const funnelSteps = funnel ? [
    { key: 'visitors', label: '방문', value: funnel.visitors ?? '—' },
    { key: 'signups', label: '가입', value: funnel.signups },
    { key: 'activated', label: '활성화 (첫 학생)', value: funnel.activated },
    { key: 'first_value', label: '첫 가치 경험', value: funnel.first_value },
    { key: 'trials', label: 'Trial', value: funnel.trials },
    { key: 'paid', label: '결제', value: funnel.paid },
    { key: 'retained_7d', label: '7일 잔존', value: funnel.retained_7d },
    { key: 'retained_30d', label: '30일 잔존', value: funnel.retained_30d },
  ] : [];

  const maxFunnel = Math.max(1, ...funnelSteps.map(s => typeof s.value === 'number' ? s.value : 0));
  const maxFeature = Math.max(1, ...featureUsage.map(f => f.academies || 0));

  return (
    <div className="p-4 md:p-8 min-h-screen" style={{ fontFamily: FONT, background: '#f8f9fa' }}>
      <div className="max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className={labelCls}>SUPERADMIN · ANALYTICS</div>
          <h1 className={titleCls + ' mt-1'}>KPI 대시보드</h1>
          <p className="text-sm text-slate-500 mt-1">플랫폼 전체 건강 지표 · 베타 운영 실시간 측정</p>
        </div>

        {/* 기간 필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setRange(d)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                range === d ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}>
              {d}일
            </button>
          ))}
          <button onClick={() => setRange('custom')}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
              range === 'custom' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white text-slate-600 border-slate-200'
            }`}>
            커스텀
          </button>
          {range === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-slate-200" />
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-slate-200" />
            </>
          )}
          <button onClick={load} className="ml-2 rounded-full px-3 py-1.5 text-xs font-bold bg-[var(--cta)] text-white">
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {loading && !northStar ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : (
        <>
          {/* 북극성 지표 */}
          <div className={labelCls + ' mb-3'}>NORTH STAR</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className={cardBase + ' p-6'}>
              <div className={labelCls}>활성 운영 학원</div>
              <div className="text-4xl font-extrabold text-[var(--primary)] mt-2">{northStar?.active_academies ?? 0}</div>
              <div className="text-xs text-slate-500 mt-1">최근 7일 코어 기능 2개 이상 사용</div>
            </div>
            <div className={cardBase + ' p-6'}>
              <div className={labelCls}>첫 가치 도달 시간</div>
              <div className="text-4xl font-extrabold text-[var(--primary)] mt-2">
                {northStar?.ttfv_hours != null ? `${northStar.ttfv_hours}h` : '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">가입 → 첫 학생 등록 평균</div>
            </div>
            <div className={cardBase + ' p-6'}>
              <div className={labelCls}>학생 단위 운영 완결률</div>
              <div className="text-4xl font-extrabold text-[var(--primary)] mt-2">{northStar?.completion_pct ?? 0}%</div>
              <div className="text-xs text-slate-500 mt-1">최근 30일 · 출결+수납 모두 기록된 학생 비율</div>
            </div>
          </div>

          {/* 퍼널 */}
          <div className={labelCls + ' mb-3'}>FUNNEL</div>
          <div className={cardBase + ' p-6 mb-8'}>
            <div className="space-y-2">
              {funnelSteps.map((s, i) => {
                const prev = i > 0 ? funnelSteps[i - 1].value : null;
                const conv = (typeof s.value === 'number' && typeof prev === 'number' && prev > 0)
                  ? Math.round((s.value / prev) * 100) : null;
                const width = typeof s.value === 'number' ? Math.max(4, (s.value / maxFunnel) * 100) : 4;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <div className="w-36 text-sm font-semibold text-slate-700">{s.label}</div>
                    <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-[var(--cta)] to-[var(--primary)] rounded-lg transition-all"
                        style={{ width: `${width}%` }} />
                      <div className="absolute inset-0 flex items-center px-3 text-xs font-bold text-white drop-shadow">
                        {s.value ?? '—'}
                      </div>
                    </div>
                    <div className="w-16 text-right text-xs font-bold text-slate-500">
                      {conv != null ? `${conv}%` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            {/* 기능 사용률 */}
            <div className={cardBase + ' p-6 lg:col-span-2'}>
              <div className={labelCls + ' mb-3'}>기능 사용률 (최근 30일)</div>
              {featureUsage.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">아직 이벤트 데이터가 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {featureUsage.slice(0, 10).map(f => (
                    <div key={f.feature} className="flex items-center gap-3">
                      <div className="w-40 text-xs font-semibold text-slate-700 truncate" title={f.feature}>{f.feature}</div>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.max(6, (f.academies / maxFeature) * 100)}%` }} />
                      </div>
                      <div className="w-20 text-right text-xs font-bold text-slate-600">
                        {f.academies}곳 / {f.events}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 플랜 분포 */}
            <div className={cardBase + ' p-6'}>
              <div className={labelCls + ' mb-3'}>플랜 분포</div>
              {plans.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">데이터 없음</div>
              ) : (
                <div className="space-y-3">
                  {plans.map(p => {
                    const pct = Math.round(((p.count || 0) / plansTotal) * 100);
                    const color = PLAN_COLORS[p.plan] || '#64748b';
                    return (
                      <div key={p.plan}>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-slate-700">{PLAN_LABELS[p.plan] || p.plan}</span>
                          <span className="text-slate-500">{p.count}곳 · {pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 경고 지표 */}
          {warnings.length > 0 && (
            <>
              <div className={labelCls + ' mb-3'}>WARNINGS</div>
              <div className="space-y-2 mb-8">
                {warnings.map((w, i) => {
                  const s = SEVERITY_STYLE[w.severity] || SEVERITY_STYLE.low;
                  return (
                    <div key={i} className="rounded-xl p-4 border"
                      style={{ background: s.bg, borderColor: s.border, color: s.color }}>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: s.color, color: '#fff' }}>
                          {w.severity}
                        </span>
                        <div className="font-bold">{w.title}</div>
                      </div>
                      <div className="text-sm mt-1">{w.detail}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 최근 이벤트 스트림 */}
          <div className={labelCls + ' mb-3'}>RECENT EVENTS</div>
          <div className={cardBase + ' p-6'}>
            {recent.length === 0 ? (
              <div className="text-sm text-slate-400 py-6 text-center">이벤트가 없습니다.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recent.map(e => (
                  <div key={e.id} className="flex items-center gap-3 py-2">
                    <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-slate-100 text-slate-700">
                      {EVENT_LABELS[e.event_type] || e.event_type}
                    </span>
                    <div className="flex-1 text-sm text-slate-700 truncate">
                      {e.academy_name || '플랫폼'}
                      {e.user_name ? ` · ${e.user_name}` : ''}
                    </div>
                    <div className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
