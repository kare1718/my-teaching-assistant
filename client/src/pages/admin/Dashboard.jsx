import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPut } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import { useAuthStore } from '../../stores/useAuthStore';
import useMediaQuery from '../../hooks/useMediaQuery';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// ════════════════════════════════════════
// 공통 유틸
// ════════════════════════════════════════
const fmt = (n) => {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000) return n.toLocaleString();
  return String(n);
};

const fmtWon = (n) => {
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
  if (n >= 10000) return (n / 10000).toFixed(0) + '만';
  return n.toLocaleString();
};

const severityColor = {
  high: { bg: 'var(--destructive-light)', border: 'oklch(85% 0.08 25)', text: 'var(--destructive)' },
  medium: { bg: 'var(--warning-light)', border: 'oklch(88% 0.06 75)', text: 'oklch(35% 0.12 75)' },
  low: { bg: 'var(--info-light)', border: 'oklch(88% 0.06 260)', text: 'oklch(32% 0.12 260)' },
};

const priorityStyle = {
  urgent: { label: '긴급', bg: '#fee2e2', text: '#b91c1c' },
  high:   { label: '높음', bg: '#fef3c7', text: '#b45309' },
  normal: { label: '보통', bg: '#f1f5f9', text: '#475569' },
  low:    { label: '낮음', bg: '#f1f5f9', text: '#64748b' },
};

// ════════════════════════════════════════
// 공용: "오늘 처리할 일" 카드 + 빠른 작업 버튼
// ════════════════════════════════════════
function QuickActionsBar({ actions, isLg }) {
  const navigate = useNavigate();
  if (!actions || actions.length === 0) return null;
  return (
    <div
      className={`grid gap-3 ${isLg ? 'mb-[18px]' : 'mb-3.5'}`}
      style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
    >
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={() => navigate(a.url)}
          className={`flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl cursor-pointer transition-all ${isLg ? 'px-3 py-4' : 'px-2.5 py-3'}`}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,75,240,0.3)'; e.currentTarget.style.background = '#f8fafc'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
        >
          {a.icon && (
            <span className="material-symbols-outlined text-2xl text-[var(--cta)] mb-1.5">{a.icon}</span>
          )}
          <span className={`${isLg ? 'text-sm' : 'text-xs'} font-bold text-[var(--primary)]`}>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

function TodayTasksCard({ tasks, total, isLg, emptyText = '오늘 처리할 일이 없습니다 ✅' }) {
  const navigate = useNavigate();
  const displayTasks = (tasks || []).slice(0, 5);
  const count = total ?? (tasks?.length || 0);
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${isLg ? 'p-6 mb-[18px]' : 'p-[18px] mb-3.5'}`}>
      <div className={`flex justify-between items-center ${isLg ? 'mb-4' : 'mb-3'}`}>
        <h2 className={`m-0 ${isLg ? 'text-lg' : 'text-[15px]'} font-extrabold text-[var(--primary)] tracking-tight`}>
          오늘 처리할 일
          {count > 0 && (
            <span className={`ml-2.5 ${isLg ? 'text-[13px]' : 'text-[11px]'} rounded-full px-2.5 py-0.5 font-bold bg-red-100 text-red-700`}>{count}건</span>
          )}
        </h2>
      </div>
      {displayTasks.length === 0 ? (
        <p className={`${isLg ? 'text-sm' : 'text-xs'} text-slate-500 text-center py-6 m-0`}>
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {displayTasks.map(task => {
            const pri = priorityStyle[task.priority] || priorityStyle.normal;
            return (
              <div key={task.id} className={`flex items-center gap-3 rounded-[10px] bg-slate-50 border border-slate-100 ${isLg ? 'px-3.5 py-3' : 'px-3 py-2.5'}`}>
                <span
                  className="flex-shrink-0 text-[10px] font-extrabold tracking-wider px-2.5 py-[3px] rounded-full"
                  style={{ background: pri.bg, color: pri.text }}
                >{pri.label}</span>
                <div className="flex-1 min-w-0">
                  <p className={`m-0 ${isLg ? 'text-sm' : 'text-xs'} font-bold text-[var(--primary)] truncate`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className={`mt-0.5 mb-0 ${isLg ? 'text-xs' : 'text-[10px]'} text-slate-500 truncate`}>
                      {task.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => navigate(task.action_url)}
                  className={`flex-shrink-0 bg-[var(--primary)] text-white rounded-lg font-bold whitespace-nowrap cursor-pointer hover:opacity-90 ${isLg ? 'px-3.5 py-2 text-xs' : 'px-2.5 py-1.5 text-[11px]'}`}
                >{task.action_label || '처리'}</button>
              </div>
            );
          })}
          {count > displayTasks.length && (
            <button
              onClick={() => navigate('/admin/automation')}
              className={`mt-1 bg-transparent border-none text-[var(--cta)] ${isLg ? 'text-[13px]' : 'text-[11px]'} font-bold cursor-pointer p-1.5 text-right`}
            >전체 보기 →</button>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════
// 빈 상태 표시 헬퍼
// ════════════════════════════════════════
function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center px-4 py-8">
      <div className="text-[40px] mb-3">{icon}</div>
      <p className="text-sm font-semibold text-[var(--primary)] m-0">{title}</p>
      {description && (
        <p className="text-xs text-slate-400 mt-1 mb-0">{description}</p>
      )}
    </div>
  );
}

// ════════════════════════════════════════
// 원장(admin) 대시보드
// ════════════════════════════════════════
function OwnerDashboard({ isLg, user }) {
  const navigate = useNavigate();
  const isMd = useMediaQuery('(min-width: 768px)');
  const { config } = useTenantConfig();
  const dc = config?.dashboard_config || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/dashboard/owner')
      .then(d => setData(d || {}))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const {
    today_summary: ts = {}, attendance_today: att = {}, tuition_summary: tui = {},
    risk_alerts = [], tasks_summary: tasks = {}, recent_events = [], class_occupancy = [],
    today_tasks = [], today_tasks_total = 0, quick_actions = [], quick_stats = {},
    attendance_trend: attTrend = {},
    weekly_classes = [], revenue_trend = [],
  } = data || {};

  // 빈 학원 상태 배너 (학생 0명이어도 대시보드는 표시)
  const showEmptyBanner = !ts.total_students;

  const attTotal = (att.present || 0) + (att.absent || 0) + (att.late || 0) + (att.excused || 0);
  const attRate = (quick_stats?.attendance_rate_today ?? (attTotal > 0 ? Math.round((((att.present || 0) + (att.late || 0)) / attTotal) * 100) : 0));

  const netNew = (ts.new_this_month || 0) - (ts.withdrawn_this_month || 0);
  const attDelta = attRate - (attTrend.last7_rate || 0);
  const collectionRate = tui.collection_rate || 0;

  // KPI 카드 데이터
  const kpiItems = [
    {
      icon: 'school', label: '재원생', value: fmt(ts.total_students), unit: '명', color: 'var(--primary)', bg: '#eef2ff', path: '/admin/students',
      trend: netNew === 0 ? `신규 ${ts.new_this_month || 0} / 퇴원 ${ts.withdrawn_this_month || 0}` : `${netNew > 0 ? '+' : ''}${netNew} 이번달`,
      trendColor: netNew > 0 ? '#059669' : netNew < 0 ? '#dc2626' : '#64748b',
    },
    {
      icon: 'how_to_reg', label: '오늘 출석률', value: `${attRate}`, unit: '%',
      color: attRate >= 90 ? '#059669' : attRate >= 70 ? '#d97706' : '#dc2626',
      bg: attRate >= 90 ? '#ecfdf5' : attRate >= 70 ? '#fffbeb' : '#fef2f2',
      path: '/admin/attendance',
      trend: attTrend.last7_rate != null ? `7일 평균 대비 ${attDelta >= 0 ? '+' : ''}${attDelta}%p` : null,
      trendColor: attDelta >= 0 ? '#059669' : '#dc2626',
    },
    {
      icon: 'payments', label: '이번달 수납', value: fmtWon(tui.this_month_collected), unit: '원', color: 'var(--primary)', bg: '#f0fdf4', path: '/admin/tuition',
      trend: `목표 대비 ${collectionRate}%`,
      trendColor: collectionRate >= 80 ? '#059669' : collectionRate >= 50 ? '#d97706' : '#dc2626',
    },
    {
      icon: 'warning', label: '미납', value: tui.overdue_count > 0 ? `${tui.overdue_count}` : '0', unit: '건',
      color: tui.overdue_count > 0 ? '#dc2626' : '#059669',
      bg: tui.overdue_count > 0 ? '#fef2f2' : '#ecfdf5',
      path: '/admin/tuition',
      trend: tui.overdue_count > 0 ? fmtWon(tui.outstanding_total) + '원' : '미납 없음',
      trendColor: tui.overdue_count > 0 ? '#dc2626' : '#059669',
    },
  ];

  // 이번 주 수업 그룹화 (요일별)
  const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const groupedWeekly = {};
  (weekly_classes || []).forEach(cls => {
    const d = new Date(cls.session_date + 'T00:00:00');
    const key = cls.session_date;
    if (!groupedWeekly[key]) groupedWeekly[key] = { date: d, dayName: weekDayNames[d.getDay()], items: [] };
    groupedWeekly[key].items.push(cls);
  });
  const weeklyDays = Object.values(groupedWeekly).sort((a, b) => a.date - b.date);

  // 매출 추이: max값 계산
  const revenueData = revenue_trend || [];
  const maxRevenue = Math.max(...revenueData.map(r => r.amount || 0), 1);

  return (
    <div className="w-full">
      {/* ═══ A. 환영 헤더 ═══ */}
      <div className="mb-5">
        <h1 className={`${isLg ? 'text-[26px]' : 'text-[22px]'} font-extrabold text-[var(--primary)] m-0 tracking-tight`}>
          안녕하세요, {user?.name || ''} {
            (() => {
              const titleMap = { owner: '원장님', instructor: '선생님', staff: '담당님', counselor: '상담사님' };
              if (user?.admin_type && titleMap[user.admin_type]) return titleMap[user.admin_type];
              if (user?.role === 'teacher') return '선생님';
              if (user?.role === 'counselor') return '상담사님';
              return '원장님';
            })()
          }!
        </h1>
        <p className="text-sm text-slate-400 mt-1 mb-0">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* ═══ A2. 빠른 액션 6개 ═══ */}
      <div className={`grid gap-2.5 mb-5 ${isMd ? 'grid-cols-6' : 'grid-cols-3'}`}>
        {(quick_actions || []).map((a, i) => (
          <button
            key={i}
            onClick={() => navigate(a.url)}
            className={`flex flex-col items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-xl cursor-pointer transition-all ${isLg ? 'px-2 py-4' : 'px-1.5 py-3'}`}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cta)'; e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
          >
            {a.icon && (
              <span className="material-symbols-outlined text-[22px] text-[var(--cta)]">{a.icon}</span>
            )}
            <span className={`${isLg ? 'text-[13px]' : 'text-[11px]'} font-bold text-[var(--primary)] whitespace-nowrap`}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* 빈 학원 배너 */}
      {showEmptyBanner && (
        <div className="mb-4 px-6 py-5 rounded-xl bg-[#f0f4ff] border border-[rgba(0,75,240,0.15)] flex items-center gap-4 flex-wrap">
          <span className="text-[32px]">🏫</span>
          <div className="flex-1 min-w-[200px]">
            <p className="font-bold text-[var(--primary)] m-0">첫 학생을 등록해 운영을 시작해보세요</p>
            <p className="text-[13px] text-slate-500 mt-1 mb-0">학생을 추가하면 출결, 수납, 리포트가 활성화됩니다</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/admin/students')}
              className="px-[18px] py-2.5 bg-[var(--primary)] text-white rounded-lg font-bold text-[13px] cursor-pointer hover:opacity-90 font-display">
              학생 추가
            </button>
            <button onClick={() => navigate('/admin/data-import')}
              className="px-[18px] py-2.5 bg-[var(--cta)] text-white rounded-lg font-bold text-[13px] cursor-pointer hover:opacity-90 font-display">
              엑셀 Import
            </button>
          </div>
        </div>
      )}

      {/* ═══ B. KPI 4카드 (전체 폭) ═══ */}
      {dc.show_kpi !== false && (
      <div className={`grid gap-3 mb-5 ${isMd ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {kpiItems.map((kpi, i) => (
          <div key={i} onClick={() => navigate(kpi.path)}
            className={`bg-white rounded-xl border border-slate-200 shadow-sm cursor-pointer flex flex-col justify-center overflow-hidden transition-all ${isLg ? 'px-[22px] py-5 min-h-[120px]' : 'px-[18px] py-4 min-h-[100px]'}`}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cta)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,75,240,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
          >
            <p className={`m-0 ${isLg ? 'text-xs' : 'text-[11px]'} font-semibold text-slate-400 tracking-wide truncate`}>
              {kpi.label}
            </p>
            <div
              className={`mt-2 ${isLg ? 'text-[34px]' : 'text-[28px]'} font-display font-bold leading-none tabular-nums truncate`}
              style={{ color: kpi.color }}
            >
              {kpi.value}
              <span className={`${isLg ? 'text-sm' : 'text-xs'} font-semibold text-slate-400 ml-[3px]`}>{kpi.unit}</span>
            </div>
            {kpi.trend && (
              <p className={`mt-2 mb-0 ${isLg ? 'text-xs' : 'text-[10px]'} font-bold truncate`} style={{ color: kpi.trendColor }}>
                {kpi.trend}
              </p>
            )}
          </div>
        ))}
      </div>
      )}

      {/* ═══ C. 오늘의 할일 + 이번 주 수업 (2열) ═══ */}
      {(dc.show_tasks !== false || dc.show_schedule !== false) && (
      <div className={`grid gap-4 mb-5 ${(dc.show_tasks !== false && dc.show_schedule !== false && isLg) ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* 오늘의 할일 */}
        {dc.show_tasks !== false && (
        <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${isLg ? 'p-6' : 'p-[18px]'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`m-0 ${isLg ? 'text-[17px]' : 'text-[15px]'} font-extrabold text-[var(--primary)]`}>
              오늘의 할일
              {today_tasks_total > 0 && (
                <span className="ml-2.5 text-xs rounded-full px-2.5 py-0.5 font-bold bg-red-100 text-red-700">{today_tasks_total}건</span>
              )}
            </h2>
          </div>
          {(today_tasks || []).length === 0 ? (
            <EmptyState icon="✅" title="오늘 처리할 일이 없습니다" description="모든 업무가 정리되었습니다" />
          ) : (
            <div className="flex flex-col gap-2">
              {(today_tasks || []).slice(0, 6).map(task => {
                const pri = priorityStyle[task.priority] || priorityStyle.normal;
                return (
                  <div key={task.id} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] bg-slate-50 border border-slate-100">
                    <span
                      className="flex-shrink-0 text-[10px] font-extrabold tracking-wider px-2.5 py-[3px] rounded-full"
                      style={{ background: pri.bg, color: pri.text }}
                    >{pri.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`m-0 ${isLg ? 'text-[13px]' : 'text-xs'} font-bold text-[var(--primary)] truncate`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-0.5 mb-0 text-[11px] text-slate-500 truncate">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(task.action_url)}
                      className="flex-shrink-0 bg-[var(--primary)] text-white px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer hover:opacity-90"
                    >{task.action_label || '처리'}</button>
                  </div>
                );
              })}
              {today_tasks_total > 6 && (
                <button
                  onClick={() => navigate('/admin/automation')}
                  className="mt-1 bg-transparent border-none text-[var(--cta)] text-xs font-bold cursor-pointer p-1 text-right"
                >전체 {today_tasks_total}건 보기 →</button>
              )}
            </div>
          )}
        </div>
        )}

        {/* 이번 주 수업 일정 */}
        {dc.show_schedule !== false && (
        <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${isLg ? 'p-6' : 'p-[18px]'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`m-0 ${isLg ? 'text-[17px]' : 'text-[15px]'} font-extrabold text-[var(--primary)]`}>
              이번 주 수업
            </h2>
            <span onClick={() => navigate('/admin/classes')} className="text-xs text-[var(--cta)] cursor-pointer font-bold">수업 관리 →</span>
          </div>
          {weeklyDays.length === 0 ? (
            <EmptyState icon="📅" title="등록된 수업이 없습니다" description="수업을 등록하면 일정이 표시됩니다" />
          ) : (
            <div className="flex flex-col gap-3">
              {weeklyDays.map(day => {
                const isToday = day.date.toDateString() === new Date().toDateString();
                return (
                  <div key={day.date.toISOString()}>
                    <div className={`text-xs font-extrabold ${isToday ? 'text-[var(--cta)]' : 'text-slate-500'} mb-1.5 flex items-center gap-1.5`}>
                      <span>{day.dayName}요일</span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {day.date.getMonth() + 1}/{day.date.getDate()}
                      </span>
                      {isToday && (
                        <span className="text-[10px] font-bold px-2 py-px rounded-full bg-blue-100 text-[var(--cta)]">오늘</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {day.items.map((cls, j) => (
                        <div key={j} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-xs font-bold text-[var(--cta)] tabular-nums whitespace-nowrap min-w-[44px]">
                            {(cls.start_time || '').slice(0, 5)}
                          </span>
                          <span className="text-[13px] font-semibold text-[var(--primary)] flex-1 min-w-0 truncate">
                            {cls.class_name}
                          </span>
                          {cls.class_type && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap flex-shrink-0">
                              {cls.class_type}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>
      )}

      {/* ═══ D. 매출 추이 + 원생 추이 (2열) ═══ */}
      {(dc.show_revenue !== false || dc.show_attendance !== false) && (
      <div className={`grid gap-4 mb-5 ${(dc.show_revenue !== false && dc.show_attendance !== false && isLg) ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* 매출 추이 (최근 6개월) */}
        {dc.show_revenue !== false && (
        <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${isLg ? 'p-6' : 'p-[18px]'}`}>
          <h2 className={`mt-0 mx-0 ${isLg ? 'text-[17px]' : 'text-[15px]'} font-extrabold text-[var(--primary)] mb-4`}>
            매출 추이
            <span className="text-xs font-semibold text-slate-400 ml-2">최근 6개월</span>
          </h2>
          {revenueData.length === 0 ? (
            <EmptyState icon="📊" title="아직 데이터가 없습니다" description="수납 데이터가 쌓이면 추이를 확인할 수 있습니다" />
          ) : (
            <div className="flex flex-col gap-2">
              {revenueData.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-10 text-xs text-slate-400 text-right font-semibold whitespace-nowrap flex-shrink-0">
                    {m.month}
                  </span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                    <div className="h-full bg-[var(--cta)] rounded-md transition-[width] duration-300" style={{
                      width: `${Math.max((m.amount / maxRevenue) * 100, 0)}%`,
                      minWidth: m.amount > 0 ? 2 : 0,
                    }} />
                  </div>
                  <span className="w-16 text-xs font-display font-bold text-[var(--primary)] text-right tabular-nums whitespace-nowrap flex-shrink-0">
                    {fmtWon(m.amount || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* 출결 현황 + 수납 진행률 (컴팩트) */}
        {dc.show_attendance !== false && (
        <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${isLg ? 'p-6' : 'p-[18px]'}`}>
          <h2 className={`mt-0 mx-0 ${isLg ? 'text-[17px]' : 'text-[15px]'} font-extrabold text-[var(--primary)] mb-4`}>
            오늘의 출결 현황
          </h2>
          <div className="grid grid-cols-5 gap-1.5 mb-3.5">
            {[
              { label: '출석', value: att.present || 0, bg: '#d1fae5', color: '#059669' },
              { label: '지각', value: att.late || 0, bg: '#fef3c7', color: '#b45309' },
              { label: '결석', value: att.absent || 0, bg: '#fee2e2', color: '#b91c1c' },
              { label: '인정', value: att.excused || 0, bg: '#dbeafe', color: '#1d4ed8' },
              { label: '미체크', value: att.not_checked || 0, bg: '#f1f5f9', color: '#475569' },
            ].map((s, i) => (
              <div key={i} className="rounded-lg px-1 py-2.5 text-center" style={{ background: s.bg }}>
                <p className={`m-0 ${isLg ? 'text-lg' : 'text-[15px]'} font-display font-bold leading-none tabular-nums`} style={{ color: s.color }}>{s.value}</p>
                <p className="mt-1 mb-0 text-[10px] font-bold whitespace-nowrap" style={{ color: s.color }}>{s.label}</p>
              </div>
            ))}
          </div>
          {/* 수납 진행률 미니 */}
          <div className="border-t border-slate-100 pt-3.5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] font-bold text-[var(--primary)]">이번달 수납 진행률</span>
              <span className="text-sm font-display font-bold text-[var(--primary)] tabular-nums">{collectionRate}%</span>
            </div>
            <div className="h-2 rounded bg-slate-100 overflow-hidden mb-2">
              <div className="h-full rounded transition-[width] duration-300" style={{
                width: `${Math.min(collectionRate, 100)}%`,
                background: collectionRate >= 80 ? '#059669' : collectionRate >= 50 ? '#d97706' : '#dc2626',
              }} />
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">청구 <b className="text-[var(--primary)]">{fmtWon(tui.this_month_billed || 0)}</b></span>
              <span className="text-slate-500">수납 <b className="text-emerald-600">{fmtWon(tui.this_month_collected || 0)}</b></span>
              <span className="text-slate-500">미수 <b className="text-red-600">{fmtWon(tui.outstanding_total || 0)}</b></span>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* ═══ E. 위험 알림 + 최근 활동 (2열) ═══ */}
      {(dc.show_risks !== false || dc.show_activity !== false) && (
      <div className={`grid gap-4 mb-5 ${(dc.show_risks !== false && dc.show_activity !== false && isLg) ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* 위험 알림 */}
        {dc.show_risks !== false && (
        <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${isLg ? 'p-6' : 'p-[18px]'}`}>
          <div className="flex justify-between items-center mb-3.5">
            <h2 className={`m-0 ${isLg ? 'text-[17px]' : 'text-[15px]'} font-extrabold text-[var(--primary)]`}>
              위험 알림
            </h2>
            <span className={`text-xs font-bold ${risk_alerts.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {risk_alerts.length > 0 ? `${risk_alerts.length}건` : '없음'}
            </span>
          </div>
          {risk_alerts.length === 0 ? (
            <EmptyState icon="🎉" title="위험 알림이 없습니다" description="모든 학생의 출결과 수납이 정상입니다" />
          ) : (
            <div className="flex flex-col gap-1.5">
              {risk_alerts.slice(0, 8).map((alert, i) => {
                const sev = severityColor[alert.severity] || severityColor.medium;
                return (
                  <div key={i} className="flex items-center justify-between px-3.5 py-2.5 rounded-lg" style={{
                    background: sev.bg, border: `1px solid ${sev.border}`,
                  }}>
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className="text-[13px] font-bold text-[var(--primary)] cursor-pointer whitespace-nowrap flex-shrink-0"
                        onClick={() => navigate(`/admin/student/${alert.student_id}`)}
                      >
                        {alert.student_name}
                      </span>
                      <span className="text-xs font-semibold min-w-0 truncate" style={{ color: sev.text }}>
                        {alert.message}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0" style={{ background: sev.border, color: sev.text }}>
                      {alert.type === 'consecutive_absence' ? '연속 결석' : '수납 연체'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* 최근 활동 */}
        {dc.show_activity !== false && (
        <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${isLg ? 'p-6' : 'p-[18px]'}`}>
          <h2 className={`mt-0 mx-0 ${isLg ? 'text-[17px]' : 'text-[15px]'} font-extrabold text-[var(--primary)] mb-3.5`}>
            최근 활동
          </h2>
          {recent_events.length === 0 ? (
            <EmptyState icon="🕐" title="아직 활동 기록이 없습니다" description="학생 등록, 출결, 수납 등의 활동이 기록됩니다" />
          ) : (
            <div className="flex flex-col gap-1">
              {recent_events.map(ev => {
                const d = new Date(ev.event_date);
                const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                return (
                  <div key={ev.id} className="flex gap-2.5 items-center py-2 border-b border-slate-100">
                    <span className="text-[11px] text-slate-400 whitespace-nowrap min-w-[36px] tabular-nums">{dateStr}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold m-0 text-[var(--primary)] truncate" title={ev.title}>{ev.title}</p>
                      {ev.student_name && (
                        <p className="text-[11px] text-slate-400 mt-0.5 mb-0">{ev.student_name}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════
// 강사(teacher/assistant) 대시보드
// ════════════════════════════════════════
function TeacherDashboard({ isLg }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/dashboard/teacher')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <ErrorState />;

  const { today_classes = [], attendance_pending = 0, student_alerts = [], today_tasks = [], today_tasks_total = 0 } = data || {};

  return (
    <>
      {/* 오늘 처리할 일 (최상단) */}
      <TodayTasksCard tasks={today_tasks} total={today_tasks_total} isLg={isLg} emptyText="오늘 할 일이 모두 정리되었습니다 ✅" />

      {/* KPI */}
      <div className={`dash-kpi-row ${isLg ? 'mb-[18px]' : 'mb-3.5'}`}>
        {[
          { label: '오늘 수업', value: today_classes.length, unit: '건', color: 'var(--primary)' },
          { label: '출결 미입력', value: attendance_pending, unit: '명', color: attendance_pending > 0 ? 'var(--destructive)' : 'var(--success)' },
          { label: '학생 특이사항', value: student_alerts.length, unit: '건', color: student_alerts.length > 0 ? 'var(--warning)' : 'var(--success)' },
        ].map((kpi, i) => (
          <div key={i} className="flex-1 min-w-0">
            <div className={`bg-white rounded-xl border border-slate-100 shadow-sm m-0 h-full box-border ${isLg ? 'px-[22px] py-[18px]' : 'px-4 py-3.5'}`}>
              <p className={`${isLg ? 'text-xs mb-1.5' : 'text-[10px] mb-1'} mt-0 font-bold text-slate-400 uppercase tracking-widest`}>{kpi.label}</p>
              <div className={`${isLg ? 'text-3xl' : 'text-2xl'} font-display font-bold leading-none`} style={{ color: kpi.color }}>
                {kpi.value}<span className={`${isLg ? 'text-sm' : 'text-xs'} font-medium text-slate-400 ml-0.5`}>{kpi.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 오늘 수업 목록 */}
      <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-5 ${isLg ? 'mb-3.5' : 'mb-2.5'}`}>
        <div className={`flex justify-between items-center ${isLg ? 'mb-3.5' : 'mb-2.5'}`}>
          <h2 className={`m-0 ${isLg ? 'text-base' : 'text-sm'} font-extrabold text-[var(--primary)]`}>오늘 수업</h2>
          <span onClick={() => navigate('/admin/attendance')} className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-[var(--cta)] cursor-pointer font-bold`}>출결 입력 &rarr;</span>
        </div>
        {today_classes.length === 0 ? (
          <p className={`${isLg ? 'text-sm' : 'text-xs'} text-slate-500 text-center py-4 m-0`}>오늘 예정된 수업이 없습니다</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {today_classes.map(cls => (
              <div key={cls.id} className={`flex justify-between items-center rounded-lg bg-slate-50 border border-slate-100 ${isLg ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                <div className="min-w-0 flex-1">
                  <p className={`${isLg ? 'text-sm' : 'text-xs'} font-bold m-0 text-[var(--primary)] truncate`} title={cls.name}>{cls.name}</p>
                  <p className={`${isLg ? 'text-xs' : 'text-[10px]'} text-slate-500 mt-0.5 mb-0`}>
                    {cls.start_time?.slice(0, 5)}~{cls.end_time?.slice(0, 5)} {cls.room ? `| ${cls.room}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`${isLg ? 'text-[13px]' : 'text-[11px]'} font-semibold text-[var(--primary)]`}>{cls.student_count || 0}명</span>
                  {cls.subject && <p className={`${isLg ? 'text-[11px]' : 'text-[10px]'} text-slate-500 mt-0.5 mb-0`}>{cls.subject}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 학생 특이사항 */}
      {student_alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className={`mt-0 mx-0 ${isLg ? 'text-base mb-3.5' : 'text-sm mb-2.5'} font-extrabold text-[var(--primary)]`}>학생 특이사항</h2>
          <div className="flex flex-col gap-1.5">
            {student_alerts.map((a, i) => (
              <div key={i} className={`flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 ${isLg ? 'px-3.5 py-2.5' : 'px-3 py-2'}`}>
                <span className={`${isLg ? 'text-sm' : 'text-xs'} font-bold text-[var(--primary)] cursor-pointer`}
                  onClick={() => navigate(`/admin/student/${a.student_id}`)}
                >{a.student_name}</span>
                <span className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-amber-700 font-semibold`}>{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════
// 상담사(counselor) 대시보드
// ════════════════════════════════════════
function CounselorDashboard({ isLg }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/dashboard/counselor')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <ErrorState />;

  const { today_consultations = [], follow_up_due = [], new_inquiries = [], conversion_stats: cs = {}, today_tasks = [], today_tasks_total = 0 } = data || {};

  return (
    <>
      {/* 오늘 처리할 일 (최상단) */}
      <TodayTasksCard tasks={today_tasks} total={today_tasks_total} isLg={isLg} emptyText="오늘 처리할 상담/후속조치가 없습니다 ✅" />

      {/* KPI */}
      <div className={`dash-kpi-row ${isLg ? 'mb-[18px]' : 'mb-3.5'}`}>
        {[
          { label: '오늘 상담', value: today_consultations.length, unit: '건', color: 'var(--primary)' },
          { label: '후속조치 필요', value: follow_up_due.length, unit: '건', color: follow_up_due.length > 0 ? 'var(--warning)' : 'var(--success)' },
          { label: '신규 문의', value: new_inquiries.length, unit: '건', color: new_inquiries.length > 0 ? 'var(--primary)' : 'var(--muted-foreground)' },
          { label: '전환율', value: cs.conversion_rate, unit: '%', color: cs.conversion_rate >= 30 ? 'var(--success)' : 'var(--warning)' },
        ].map((kpi, i) => (
          <div key={i} className="flex-1 min-w-0">
            <div className={`bg-white rounded-xl border border-slate-100 shadow-sm m-0 h-full box-border ${isLg ? 'px-[22px] py-[18px]' : 'px-4 py-3.5'}`}>
              <p className={`${isLg ? 'text-xs mb-1.5' : 'text-[10px] mb-1'} mt-0 font-bold text-slate-400 uppercase tracking-widest`}>{kpi.label}</p>
              <div className={`${isLg ? 'text-3xl' : 'text-2xl'} font-display font-bold leading-none`} style={{ color: kpi.color }}>
                {kpi.value}<span className={`${isLg ? 'text-sm' : 'text-xs'} font-medium text-slate-400 ml-0.5`}>{kpi.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`dash-mid-grid ${isLg ? 'mb-3.5' : 'mb-2.5'}`}>
        {/* 오늘 상담 / 후속조치 */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 m-0 min-w-0 flex-[3]">
          <div className={`flex justify-between items-center ${isLg ? 'mb-3.5' : 'mb-2.5'}`}>
            <h2 className={`m-0 ${isLg ? 'text-base' : 'text-sm'} font-extrabold text-[var(--primary)]`}>오늘 상담 / 후속조치</h2>
            <span onClick={() => navigate('/admin/consultation')} className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-[var(--cta)] cursor-pointer font-bold`}>전체 보기 &rarr;</span>
          </div>
          {today_consultations.length === 0 && follow_up_due.length === 0 ? (
            <p className={`${isLg ? 'text-sm' : 'text-xs'} text-slate-500 text-center py-4 m-0`}>오늘 예정된 상담/후속조치가 없습니다</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {follow_up_due.map(c => (
                <div key={`fu-${c.id}`} className={`${isLg ? 'px-3.5 py-2.5' : 'px-3 py-2'} rounded-lg bg-amber-50 border border-amber-200 flex justify-between items-center`}>
                  <div>
                    <span className={`${isLg ? 'text-sm' : 'text-xs'} font-bold text-[var(--primary)]`}>{c.student_name || '미배정'}</span>
                    <span className={`${isLg ? 'text-xs' : 'text-[10px]'} text-slate-500 ml-2`}>{c.consultation_type}</span>
                  </div>
                  <span className={`${isLg ? 'text-[11px]' : 'text-[10px]'} font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700`}>후속조치</span>
                </div>
              ))}
              {today_consultations.map(c => (
                <div key={`tc-${c.id}`} className={`${isLg ? 'px-3.5 py-2.5' : 'px-3 py-2'} rounded-lg bg-blue-50 border border-blue-200 flex justify-between items-center`}>
                  <div>
                    <span className={`${isLg ? 'text-sm' : 'text-xs'} font-bold text-[var(--primary)]`}>{c.student_name || '미배정'}</span>
                    <span className={`${isLg ? 'text-xs' : 'text-[10px]'} text-slate-500 ml-2`}>{c.consultation_type}</span>
                  </div>
                  <span className={`${isLg ? 'text-[11px]' : 'text-[10px]'} font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700`}>오늘 상담</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 신규 문의 */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 m-0 min-w-0 flex-[2]">
          <div className={`flex justify-between items-center ${isLg ? 'mb-3.5' : 'mb-2.5'}`}>
            <h2 className={`m-0 ${isLg ? 'text-base' : 'text-sm'} font-extrabold text-[var(--primary)]`}>신규 문의</h2>
            <span onClick={() => navigate('/admin/leads')} className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-[var(--cta)] cursor-pointer font-bold`}>전체 보기 &rarr;</span>
          </div>
          {new_inquiries.length === 0 ? (
            <p className={`${isLg ? 'text-sm' : 'text-xs'} text-slate-500 text-center py-4 m-0`}>신규 문의가 없습니다</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {new_inquiries.slice(0, 8).map(lead => (
                <div key={lead.id} className={`${isLg ? 'px-3.5 py-2.5' : 'px-3 py-2'} rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center`}>
                  <div>
                    <span className={`${isLg ? 'text-sm' : 'text-xs'} font-bold text-[var(--primary)]`}>{lead.student_name}</span>
                    {lead.school && <span className={`${isLg ? 'text-xs' : 'text-[10px]'} text-slate-500 ml-2`}>{lead.school} {lead.grade}</span>}
                  </div>
                  {lead.source && <span className={`${isLg ? 'text-[11px]' : 'text-[10px]'} text-slate-500`}>{lead.source}</span>}
                </div>
              ))}
            </div>
          )}
          {/* 전환 통계 */}
          <div className="mt-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <p className={`${isLg ? 'text-xs' : 'text-[10px]'} font-bold text-slate-400 uppercase tracking-widest mt-0 mb-1`}>이번달 전환 통계</p>
            <div className="flex gap-3">
              <span className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-slate-600`}>문의 <strong className="text-[var(--primary)]">{cs.this_month_inquiries}</strong></span>
              <span className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-slate-600`}>등록 <strong className="text-[var(--primary)]">{cs.this_month_enrolled}</strong></span>
              <span className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-slate-600`}>전환율 <strong className="text-[var(--cta)]">{cs.conversion_rate}%</strong></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════
// 행정(staff) 대시보드
// ════════════════════════════════════════
function StaffDashboard({ isLg }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/dashboard/staff')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <ErrorState />;

  const { tuition_today: tt = {}, overdue_list = [], sms_balance = {}, today_tasks = [], today_tasks_total = 0 } = data || {};

  return (
    <>
      <TodayTasksCard tasks={today_tasks} total={today_tasks_total} isLg={isLg} emptyText="오늘 수납 처리 대상이 없습니다 ✅" />

      <div className={`dash-kpi-row ${isLg ? 'mb-[18px]' : 'mb-3.5'}`}>
        {[
          { label: '오늘 납부기한', value: tt.due_today, unit: '건', color: tt.due_today > 0 ? 'var(--warning)' : 'var(--success)' },
          { label: '수납 확인 대기', value: tt.pending_confirmation, unit: '건', color: 'var(--primary)' },
          { label: '미납 독촉 대상', value: overdue_list.length, unit: '건', color: overdue_list.length > 0 ? 'var(--destructive)' : 'var(--success)' },
          { label: 'SMS 잔액', value: fmt(sms_balance.balance), unit: '건', color: 'var(--primary)' },
        ].map((kpi, i) => (
          <div key={i} className="flex-1 min-w-0">
            <div className={`bg-white rounded-xl border border-slate-100 shadow-sm m-0 h-full box-border ${isLg ? 'px-[22px] py-[18px]' : 'px-4 py-3.5'}`}>
              <p className={`${isLg ? 'text-xs mb-1.5' : 'text-[10px] mb-1'} mt-0 font-bold text-slate-400 uppercase tracking-widest`}>{kpi.label}</p>
              <div className={`${isLg ? 'text-3xl' : 'text-2xl'} font-display font-bold leading-none`} style={{ color: kpi.color }}>
                {kpi.value}<span className={`${isLg ? 'text-sm' : 'text-xs'} font-medium text-slate-400 ml-0.5`}>{kpi.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className={`flex justify-between items-center ${isLg ? 'mb-3.5' : 'mb-2.5'}`}>
          <h2 className={`m-0 ${isLg ? 'text-base' : 'text-sm'} font-extrabold text-[var(--primary)]`}>미납 독촉 대상 TOP {overdue_list.length}</h2>
          <span onClick={() => navigate('/admin/tuition')} className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-[var(--cta)] cursor-pointer font-bold`}>전체 보기 &rarr;</span>
        </div>
        {overdue_list.length === 0 ? (
          <p className={`${isLg ? 'text-sm' : 'text-xs'} text-slate-500 text-center py-4 m-0`}>미납 건이 없습니다</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {overdue_list.map(t => (
              <div key={t.id} className={`flex justify-between items-center rounded-lg bg-red-50 border border-red-200 ${isLg ? 'px-3.5 py-2.5' : 'px-3 py-2'}`}>
                <span className={`${isLg ? 'text-sm' : 'text-xs'} font-bold text-[var(--primary)] cursor-pointer`}
                  onClick={() => navigate(`/admin/student-view/${t.student_id}`)}
                >{t.student_name}</span>
                <span className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-[#ba1a1a] font-semibold`}>
                  {parseInt(t.amount || 0).toLocaleString()}원 · 기한 {t.due_date}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════
// 공통 컴포넌트
// ════════════════════════════════════════
function LoadingState() {
  return (
    <div className="flex justify-center items-center py-[60px]">
      <div className="text-sm text-slate-400">데이터를 불러오는 중...</div>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex justify-center items-center py-[60px]">
      <div className="text-sm text-[#ba1a1a]">데이터를 불러오지 못했습니다. 새로고침해 주세요.</div>
    </div>
  );
}

// ════════════════════════════════════════
// 기존 Legacy 대시보드 (fallback)
// ════════════════════════════════════════
function LegacyDashboard({ isLg }) {
  const navigate = useNavigate();
  const { config } = useTenantConfig();
  const SCHOOLS = config.schools || [];
  const [schoolCounts, setSchoolCounts] = useState({});
  const [gradeDetails, setGradeDetails] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [editRequestCount, setEditRequestCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [qnaCount, setQnaCount] = useState(0);
  const [clinicCount, setClinicCount] = useState(0);
  const [upcomingClinic, setUpcomingClinic] = useState([]);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [upcomingClasses, setUpcomingClasses] = useState([]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const STATUS_LABEL = {
    pending: { text: '대기', bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)' },
    approved: { text: '승인', bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)' },
    completed: { text: '완료', bg: 'var(--info-light)', color: 'oklch(32% 0.12 260)' },
  };

  useEffect(() => {
    api('/admin/schools').then(data => {
      const counts = {};
      data.forEach(s => { counts[s.school] = s.student_count; });
      setSchoolCounts(counts);
      const excludeSchools = ['조교', '선생님'];
      data.filter(s => !excludeSchools.includes(s.school)).forEach(s => {
        api(`/admin/schools/${encodeURIComponent(s.school)}/grades`).then(grades => {
          setGradeDetails(prev => ({ ...prev, [s.school]: grades }));
        }).catch(() => {});
      });
    }).catch(console.error);

    api('/admin/badge-counts').then(c => {
      setPendingCount(c.pending_users || 0);
      setEditRequestCount(c.edit_requests || 0);
      setClinicCount(c.pending_clinic || 0);
      setQnaCount(c.pending_questions || 0);
      setReviewCount(c.pending_reviews || 0);
    }).catch(() => {});

    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const fetchClinic = (y, m) =>
      api(`/clinic/admin/all?year=${y}&month=${m}`).then(data => {
        return data
          .filter(a => a.appointment_date >= todayStr && (a.status === 'approved' || a.status === 'pending'))
          .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.time_slot.localeCompare(b.time_slot));
      }).catch(() => []);

    Promise.all([
      fetchClinic(year, month),
      fetchClinic(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1),
    ]).then(([cur, next]) => {
      const merged = [...cur, ...next]
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.time_slot.localeCompare(b.time_slot))
        .slice(0, 10);
      setUpcomingClinic(merged);
    });

    api('/scores/exams').then(data => {
      const upcoming = data
        .filter(e => e.exam_date && e.exam_date >= todayStr)
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
      setUpcomingExams(upcoming.slice(0, 5));
    }).catch(console.error);

    api('/schedules/week').then(data => setUpcomingClasses(data.schedules || [])).catch(console.error);
  }, []);

  const formatDate = (d) => { const x = new Date(d + 'T00:00:00'); return `${x.getMonth() + 1}/${x.getDate()}(${DAY_NAMES[x.getDay()]})`; };
  const isToday = (d) => d === todayStr;
  const daysUntil = (d) => Math.ceil((new Date(d + 'T00:00:00') - today) / 86400000);

  const totalStudents = SCHOOLS
    .filter(s => !['조교', '선생님'].includes(s.name))
    .reduce((sum, s) => sum + (schoolCounts[s.name] || 0), 0);

  const todayClinic = upcomingClinic.filter(a => isToday(a.appointment_date)).length;
  const nextExam = upcomingExams[0];

  const actionItems = [
    pendingCount > 0 && { path: '/admin/pending', label: '가입 승인 대기', count: pendingCount, urgent: true },
    qnaCount > 0 && { path: '/admin/qna', label: '미답변 질문', count: qnaCount, urgent: true },
    clinicCount > 0 && { path: '/admin/clinic', label: '클리닉 승인 대기', count: clinicCount, urgent: false },
    editRequestCount > 0 && { path: '/admin/edit-requests', label: '정보 수정 요청', count: editRequestCount, urgent: false },
    reviewCount > 0 && { path: '/admin/reviews', label: '후기 검토 대기', count: reviewCount, urgent: false },
  ].filter(Boolean);

  const groupedClasses = (() => {
    const g = {};
    upcomingClasses.forEach(s => { if (!g[s.schedule_date]) g[s.schedule_date] = []; g[s.schedule_date].push(s); });
    return g;
  })();

  return (
    <>
      {/* Action Required */}
      {actionItems.length > 0 && (
        <div className={isLg ? 'mb-[18px]' : 'mb-3.5'}>
          <div className={`flex flex-wrap ${isLg ? 'gap-2' : 'gap-1.5'}`}>
            {actionItems.map((item, i) => (
              <button key={i} onClick={() => navigate(item.path)}
                className={`flex items-center rounded-lg border cursor-pointer ${isLg ? 'gap-2.5 px-[18px] py-2.5' : 'gap-2 px-3.5 py-2'} ${item.urgent ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <span className={`${isLg ? 'text-xl' : 'text-base'} font-display font-bold leading-none ${item.urgent ? 'text-[#ba1a1a]' : 'text-[var(--primary)]'}`}>{item.count}</span>
                <span className={`${isLg ? 'text-sm' : 'text-xs'} font-semibold text-slate-600`}>{item.label}</span>
                <span className={`${isLg ? 'text-[15px]' : 'text-[13px]'} text-slate-400 ml-0.5`}>&rarr;</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className={`dash-kpi-row ${isLg ? 'mb-[18px]' : 'mb-3.5'}`}>
        {[
          { label: '재원생', value: totalStudents, unit: '명', sub: '재학 중', color: 'var(--primary)' },
          { label: '오늘 클리닉', value: todayClinic, unit: '건', sub: todayClinic === 0 ? '일정 없음' : '오늘 진행', color: todayClinic > 0 ? 'oklch(48% 0.22 295)' : 'var(--muted-foreground)' },
          { label: '이번 주 수업', value: upcomingClasses.length, unit: '회', sub: '남은 수업', color: 'var(--success)' },
          { label: '다음 시험', value: nextExam ? `D-${daysUntil(nextExam.exam_date)}` : '-', unit: '', sub: nextExam ? nextExam.name : '예정 없음', color: nextExam && daysUntil(nextExam.exam_date) <= 7 ? 'var(--warning)' : 'var(--foreground)' },
        ].map((kpi, i) => (
          <div key={i} className="flex-1 min-w-0">
            <div className={`bg-white rounded-xl border border-slate-100 shadow-sm m-0 h-full box-border ${isLg ? 'px-[22px] py-[18px]' : 'px-4 py-3.5'}`}>
              <p className={`${isLg ? 'text-xs mb-1.5' : 'text-[10px] mb-1'} mt-0 font-bold text-slate-400 uppercase tracking-widest`}>{kpi.label}</p>
              <div className={`${isLg ? 'text-3xl mb-[5px]' : 'text-2xl mb-[3px]'} font-display font-bold leading-none`} style={{ color: kpi.color }}>
                {kpi.value}
                {kpi.unit && <span className={`${isLg ? 'text-sm' : 'text-xs'} font-medium text-slate-400 ml-0.5`}>{kpi.unit}</span>}
              </div>
              <p className={`${isLg ? 'text-[13px]' : 'text-[11px]'} text-slate-500 m-0`}>{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Student counts */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className={`flex justify-between items-center ${isLg ? 'mb-3.5' : 'mb-2.5'}`}>
          <h2 className={`m-0 ${isLg ? 'text-base' : 'text-[13px]'} font-extrabold text-[var(--primary)]`}>학교별 현황</h2>
          <span className={`${isLg ? 'text-base' : 'text-[13px]'} font-display font-bold text-[var(--primary)]`}>{totalStudents}명</span>
        </div>
        <div className="flex flex-col gap-1">
          {SCHOOLS.filter(s => !['조교', '선생님'].includes(s.name)).map(s => (
            <div key={s.name}>
              <div onClick={() => navigate(`/admin/school/${encodeURIComponent(s.name)}`)}
                className={`${isLg ? 'px-3 py-[9px]' : 'px-2.5 py-[7px]'} rounded-lg cursor-pointer flex justify-between items-center bg-slate-50 border border-slate-100 hover:bg-slate-100`}>
                <span className={`${isLg ? 'text-sm' : 'text-xs'} font-semibold text-slate-600`}>{s.name}</span>
                <span className={`${isLg ? 'text-sm' : 'text-xs'} font-bold text-[var(--primary)]`}>{schoolCounts[s.name] || 0}명</span>
              </div>
              {gradeDetails[s.name]?.length > 0 && (
                <div className="flex flex-wrap gap-[3px] mt-[3px] pl-2">
                  {gradeDetails[s.name].map(g => (
                    <span key={g.grade} className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-px rounded">
                      {g.grade} {g.student_count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════
// 메인 대시보드 (role 분기)
// ════════════════════════════════════════
export default function AdminDashboard() {
  const navigate = useNavigate();
  const isLg = useMediaQuery('(min-width: 1600px)');
  const user = useAuthStore(s => s.user);
  const role = user?.role;

  const today = new Date();
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [academyName, setAcademyName] = useState('');
  const [copiedType, setCopiedType] = useState('');

  useEffect(() => {
    if (role === 'admin') {
      api('/auth/my-invite-code').then(data => {
        if (data.inviteCode) setInviteCode(data.inviteCode);
        if (data.academyName) setAcademyName(data.academyName);
      }).catch(() => {});
    }
  }, [role]);

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) { setPwMsg('모든 항목을 입력해주세요.'); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    if (pwForm.newPassword.length < 4) { setPwMsg('비밀번호는 최소 4자 이상이어야 합니다.'); return; }
    try {
      await apiPut('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg('비밀번호가 변경되었습니다!');
      setTimeout(() => { setShowPwModal(false); setPwMsg(''); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }, 1500);
    } catch (e) { setPwMsg(e.message); }
  };

  const roleLabel = role === 'admin' ? '원장' : role === 'teacher' ? '강사' : role === 'assistant' ? '조교' : role === 'counselor' ? '상담' : '';

  return (
    <div className="main-content max-w-7xl mx-auto">

      {/* Password Modal */}
      {showPwModal && (
        <div onClick={() => setShowPwModal(false)} className="fixed inset-0 bg-black/45 z-[10000] flex items-center justify-center">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl border border-slate-100 shadow-lg w-[340px] max-w-[90vw] p-6 m-0">
            <h3 className="mb-4 mt-0 text-base font-extrabold text-[var(--primary)]">비밀번호 변경</h3>
            {pwMsg && (
              <div className={`mb-3 px-3 py-2 rounded-lg text-sm font-semibold ${pwMsg.includes('변경') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-[#ba1a1a]'}`}>{pwMsg}</div>
            )}
            <div className="flex flex-col gap-2.5">
              <input type="password" className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" placeholder="현재 비밀번호" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
              <input type="password" className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" placeholder="새 비밀번호 (4자 이상)" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} />
              <input type="password" className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" placeholder="새 비밀번호 확인" value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} />
              <div className="flex gap-2">
                <button className="flex-1 bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display" onClick={handleChangePassword}>변경</button>
                <button className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50" onClick={() => setShowPwModal(false)}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header (owner role has its own greeting inside OwnerDashboard) */}
      {role !== 'admin' && (
        <div className={`${isLg ? 'mb-5 pb-4' : 'mb-4 pb-3'} border-b border-slate-100`}>
          <div className="flex items-baseline gap-2.5">
            <h1 className={`${isLg ? 'text-2xl' : 'text-xl'} font-extrabold text-[var(--primary)] tracking-tight m-0`}>
              대시보드
            </h1>
            {roleLabel && (
              <span className={`${isLg ? 'text-xs' : 'text-[10px]'} rounded-full px-3 py-0.5 font-bold bg-blue-50 text-[var(--primary)]`}>
                {roleLabel}
              </span>
            )}
            <p className={`${isLg ? 'text-sm' : 'text-xs'} text-slate-400 m-0`}>
              {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일 ({DAY_NAMES[today.getDay()]})
            </p>
          </div>
        </div>
      )}

      {/* 초대 코드 (admin만) */}
      {role === 'admin' && inviteCode && (
        <div className="mb-3.5 px-[18px] py-4 rounded-xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className={`${isLg ? 'text-base' : 'text-sm'} font-bold text-[var(--primary)]`}>학생 초대</span>
            {academyName && <span className={`${isLg ? 'text-sm' : 'text-xs'} text-slate-500`}>({academyName})</span>}
          </div>
          <div className="flex items-center gap-2.5 mb-2.5 px-3.5 py-2.5 rounded-[10px] bg-slate-50">
            <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">초대 코드</span>
            <span className="text-lg font-extrabold tracking-[3px] font-mono text-[var(--primary)] flex-1">{inviteCode}</span>
            <button onClick={() => { navigator.clipboard.writeText(inviteCode); setCopiedType('code'); setTimeout(() => setCopiedType(''), 2000); }}
              className={`px-3 py-[5px] rounded-md border text-[11px] font-semibold whitespace-nowrap cursor-pointer ${copiedType === 'code' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >{copiedType === 'code' ? '복사됨' : '코드 복사'}</button>
          </div>
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] bg-slate-50">
            <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">가입 링크</span>
            <span className="text-xs text-slate-600 font-mono flex-1 truncate">
              {window.location.origin}/register?academy={inviteCode}
            </span>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register?academy=${inviteCode}`); setCopiedType('link'); setTimeout(() => setCopiedType(''), 2000); }}
              className={`px-3 py-[5px] rounded-md border text-[11px] font-semibold whitespace-nowrap cursor-pointer ${copiedType === 'link' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >{copiedType === 'link' ? '복사됨' : '링크 복사'}</button>
          </div>
        </div>
      )}

      {/* Role 분기 렌더링 */}
      {(role === 'admin' || role === 'assistant' || !role)
        ? <OwnerDashboard isLg={isLg} user={user} />
        : role === 'teacher'
          ? <TeacherDashboard isLg={isLg} />
          : role === 'counselor'
            ? <CounselorDashboard isLg={isLg} />
            : role === 'staff'
              ? <StaffDashboard isLg={isLg} />
              : <OwnerDashboard isLg={isLg} user={user} />
      }

      {/* Responsive styles */}
      <style>{`
        .dash-kpi-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          align-items: stretch;
          width: 100%;
        }
        .dash-mid-grid {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        @media (max-width: 900px) {
          .dash-mid-grid { flex-direction: column; gap: 10px; }
          .dash-mid-grid > div { flex: 1 !important; width: 100%; }
        }
        @media (max-width: 600px) {
          .dash-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
        }
      `}</style>
    </div>
  );
}
