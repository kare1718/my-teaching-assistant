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
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))`,
      gap: 12,
      marginBottom: isLg ? 18 : 14,
    }}>
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={() => navigate(a.url)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: isLg ? '16px 12px' : '12px 10px',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,75,240,0.3)'; e.currentTarget.style.background = '#f8fafc'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
        >
          {a.icon && (
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--cta)', marginBottom: 6 }}>{a.icon}</span>
          )}
          <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 700, color: 'var(--primary)' }}>{a.label}</span>
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
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9',
      padding: isLg ? 24 : 18, marginBottom: isLg ? 18 : 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 16 : 12 }}>
        <h2 style={{ margin: 0, fontSize: isLg ? 18 : 15, fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.01em' }}>
          오늘 처리할 일
          {count > 0 && (
            <span style={{
              marginLeft: 10, fontSize: isLg ? 13 : 11, fontWeight: 700,
              padding: '2px 10px', borderRadius: 999, background: '#fee2e2', color: '#b91c1c',
            }}>{count}건</span>
          )}
        </h2>
      </div>
      {displayTasks.length === 0 ? (
        <p style={{ fontSize: isLg ? 14 : 12, color: '#64748b', textAlign: 'center', padding: '24px 0', margin: 0 }}>
          {emptyText}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayTasks.map(task => {
            const pri = priorityStyle[task.priority] || priorityStyle.normal;
            return (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: isLg ? '12px 14px' : '10px 12px',
                borderRadius: 10, background: '#f8fafc', border: '1px solid #f1f5f9',
              }}>
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                  padding: '3px 10px', borderRadius: 999,
                  background: pri.bg, color: pri.text,
                }}>{pri.label}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: isLg ? 14 : 12, fontWeight: 700, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p style={{ margin: '2px 0 0', fontSize: isLg ? 12 : 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => navigate(task.action_url)}
                  style={{
                    flexShrink: 0, background: 'var(--primary)', color: '#fff',
                    padding: isLg ? '8px 14px' : '6px 10px', borderRadius: 8,
                    fontSize: isLg ? 12 : 11, fontWeight: 700, border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >{task.action_label || '처리'}</button>
              </div>
            );
          })}
          {count > displayTasks.length && (
            <button
              onClick={() => navigate('/admin/automation')}
              style={{
                marginTop: 4, background: 'none', border: 'none',
                color: 'var(--cta)', fontSize: isLg ? 13 : 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', padding: 6, textAlign: 'right',
              }}
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
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', margin: 0 }}>{title}</p>
      {description && (
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, margin: '4px 0 0' }}>{description}</p>
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

  // 카드 공통 스타일
  const cardStyle = {
    background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };

  return (
    <div style={{ width: '100%' }}>
      {/* ═══ A. 환영 헤더 ═══ */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: isLg ? 26 : 22, fontWeight: 800, color: 'var(--primary)', margin: 0, letterSpacing: '-0.02em' }}>
          안녕하세요, {user?.name || '원장'}님!
        </h1>
        <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4, margin: '4px 0 0' }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* ═══ A2. 빠른 액션 6개 ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMd ? 'repeat(6, 1fr)' : 'repeat(3, 1fr)',
        gap: 10, marginBottom: 20,
      }}>
        {(quick_actions || []).map((a, i) => (
          <button
            key={i}
            onClick={() => navigate(a.url)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: isLg ? '16px 8px' : '12px 6px', gap: 6,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cta)'; e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
          >
            {a.icon && (
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--cta)' }}>{a.icon}</span>
            )}
            <span style={{ fontSize: isLg ? 13 : 11, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* 빈 학원 배너 */}
      {showEmptyBanner && (
        <div style={{
          marginBottom: 16, padding: '20px 24px', borderRadius: 12,
          background: '#f0f4ff', border: '1px solid rgba(0,75,240,0.15)',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 32 }}>🏫</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontWeight: 700, color: 'var(--primary)', margin: 0 }}>첫 학생을 등록해 운영을 시작해보세요</p>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>학생을 추가하면 출결, 수납, 리포트가 활성화됩니다</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/admin/students')}
              style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 13 }}>
              학생 추가
            </button>
            <button onClick={() => navigate('/admin/data-import')}
              style={{ padding: '10px 18px', background: 'var(--cta)', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 13 }}>
              엑셀 Import
            </button>
          </div>
        </div>
      )}

      {/* ═══ B. KPI 4카드 (전체 폭) ═══ */}
      {dc.show_kpi !== false && (
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMd ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
        gap: 12, marginBottom: 20,
      }}>
        {kpiItems.map((kpi, i) => (
          <div key={i} onClick={() => navigate(kpi.path)} style={{
            ...cardStyle, padding: isLg ? '20px 22px' : '16px 18px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            minHeight: isLg ? 120 : 100, transition: 'all 0.15s', overflow: 'hidden',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cta)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,75,240,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
          >
            <p style={{
              margin: 0, fontSize: isLg ? 12 : 11, fontWeight: 600, color: '#94a3b8',
              letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {kpi.label}
            </p>
            <div style={{
              marginTop: 8, fontSize: isLg ? 34 : 28, fontWeight: 800, color: kpi.color,
              lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {kpi.value}
              <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 600, color: '#94a3b8', marginLeft: 3 }}>{kpi.unit}</span>
            </div>
            {kpi.trend && (
              <p style={{
                margin: '8px 0 0', fontSize: isLg ? 12 : 10, fontWeight: 700, color: kpi.trendColor,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {kpi.trend}
              </p>
            )}
          </div>
        ))}
      </div>
      )}

      {/* ═══ C. 오늘의 할일 + 이번 주 수업 (2열) ═══ */}
      {(dc.show_tasks !== false || dc.show_schedule !== false) && (
      <div style={{
        display: 'grid',
        gridTemplateColumns: (dc.show_tasks !== false && dc.show_schedule !== false && isLg) ? '1fr 1fr' : '1fr',
        gap: 16, marginBottom: 20,
      }}>
        {/* 오늘의 할일 */}
        {dc.show_tasks !== false && (
        <div style={{ ...cardStyle, padding: isLg ? 24 : 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: isLg ? 17 : 15, fontWeight: 800, color: 'var(--primary)' }}>
              오늘의 할일
              {today_tasks_total > 0 && (
                <span style={{
                  marginLeft: 10, fontSize: 12, fontWeight: 700,
                  padding: '2px 10px', borderRadius: 999, background: '#fee2e2', color: '#b91c1c',
                }}>{today_tasks_total}건</span>
              )}
            </h2>
          </div>
          {(today_tasks || []).length === 0 ? (
            <EmptyState icon="✅" title="오늘 처리할 일이 없습니다" description="모든 업무가 정리되었습니다" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(today_tasks || []).slice(0, 6).map(task => {
                const pri = priorityStyle[task.priority] || priorityStyle.normal;
                return (
                  <div key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #f1f5f9',
                  }}>
                    <span style={{
                      flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                      padding: '3px 10px', borderRadius: 999, background: pri.bg, color: pri.text,
                    }}>{pri.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: isLg ? 13 : 12, fontWeight: 700, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(task.action_url)}
                      style={{
                        flexShrink: 0, background: 'var(--primary)', color: '#fff',
                        padding: '6px 12px', borderRadius: 8,
                        fontSize: 11, fontWeight: 700, border: 'none',
                        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}
                    >{task.action_label || '처리'}</button>
                  </div>
                );
              })}
              {today_tasks_total > 6 && (
                <button
                  onClick={() => navigate('/admin/automation')}
                  style={{
                    marginTop: 4, background: 'none', border: 'none',
                    color: 'var(--cta)', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', padding: 4, textAlign: 'right',
                  }}
                >전체 {today_tasks_total}건 보기 →</button>
              )}
            </div>
          )}
        </div>
        )}

        {/* 이번 주 수업 일정 */}
        {dc.show_schedule !== false && (
        <div style={{ ...cardStyle, padding: isLg ? 24 : 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: isLg ? 17 : 15, fontWeight: 800, color: 'var(--primary)' }}>
              이번 주 수업
            </h2>
            <span onClick={() => navigate('/admin/classes')} style={{ fontSize: 12, color: 'var(--cta)', cursor: 'pointer', fontWeight: 700 }}>수업 관리 →</span>
          </div>
          {weeklyDays.length === 0 ? (
            <EmptyState icon="📅" title="등록된 수업이 없습니다" description="수업을 등록하면 일정이 표시됩니다" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {weeklyDays.map(day => {
                const isToday = day.date.toDateString() === new Date().toDateString();
                return (
                  <div key={day.date.toISOString()}>
                    <div style={{
                      fontSize: 12, fontWeight: 800, color: isToday ? 'var(--cta)' : '#64748b',
                      marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span>{day.dayName}요일</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                        {day.date.getMonth() + 1}/{day.date.getDate()}
                      </span>
                      {isToday && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 999,
                          background: '#dbeafe', color: 'var(--cta)',
                        }}>오늘</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {day.items.map((cls, j) => (
                        <div key={j} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9',
                        }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700, color: 'var(--cta)', fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap', minWidth: 44,
                          }}>
                            {(cls.start_time || '').slice(0, 5)}
                          </span>
                          <span style={{
                            fontSize: 13, fontWeight: 600, color: 'var(--primary)', flex: 1, minWidth: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {cls.class_name}
                          </span>
                          {cls.class_type && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                              background: '#f1f5f9', color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: (dc.show_revenue !== false && dc.show_attendance !== false && isLg) ? '1fr 1fr' : '1fr',
        gap: 16, marginBottom: 20,
      }}>
        {/* 매출 추이 (최근 6개월) */}
        {dc.show_revenue !== false && (
        <div style={{ ...cardStyle, padding: isLg ? 24 : 18 }}>
          <h2 style={{ margin: 0, fontSize: isLg ? 17 : 15, fontWeight: 800, color: 'var(--primary)', marginBottom: 16 }}>
            매출 추이
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginLeft: 8 }}>최근 6개월</span>
          </h2>
          {revenueData.length === 0 ? (
            <EmptyState icon="📊" title="아직 데이터가 없습니다" description="수납 데이터가 쌓이면 추이를 확인할 수 있습니다" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {revenueData.map((m, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 40, fontSize: 12, color: '#94a3b8', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {m.month}
                  </span>
                  <div style={{ flex: 1, height: 24, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max((m.amount / maxRevenue) * 100, 0)}%`,
                      height: '100%', background: 'var(--cta)', borderRadius: 6,
                      minWidth: m.amount > 0 ? 2 : 0, transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ width: 64, fontSize: 12, fontWeight: 700, color: 'var(--primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
        <div style={{ ...cardStyle, padding: isLg ? 24 : 18 }}>
          <h2 style={{ margin: 0, fontSize: isLg ? 17 : 15, fontWeight: 800, color: 'var(--primary)', marginBottom: 16 }}>
            오늘의 출결 현황
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
            {[
              { label: '출석', value: att.present || 0, bg: '#d1fae5', color: '#059669' },
              { label: '지각', value: att.late || 0, bg: '#fef3c7', color: '#b45309' },
              { label: '결석', value: att.absent || 0, bg: '#fee2e2', color: '#b91c1c' },
              { label: '인정', value: att.excused || 0, bg: '#dbeafe', color: '#1d4ed8' },
              { label: '미체크', value: att.not_checked || 0, bg: '#f1f5f9', color: '#475569' },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 8, padding: '10px 4px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: isLg ? 18 : 15, fontWeight: 800, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</p>
              </div>
            ))}
          </div>
          {/* 수납 진행률 미니 */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>이번달 수납 진행률</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{collectionRate}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 4, transition: 'width 0.3s',
                width: `${Math.min(collectionRate, 100)}%`,
                background: collectionRate >= 80 ? '#059669' : collectionRate >= 50 ? '#d97706' : '#dc2626',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#64748b' }}>청구 <b style={{ color: 'var(--primary)' }}>{fmtWon(tui.this_month_billed || 0)}</b></span>
              <span style={{ color: '#64748b' }}>수납 <b style={{ color: '#059669' }}>{fmtWon(tui.this_month_collected || 0)}</b></span>
              <span style={{ color: '#64748b' }}>미수 <b style={{ color: '#dc2626' }}>{fmtWon(tui.outstanding_total || 0)}</b></span>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* ═══ E. 위험 알림 + 최근 활동 (2열) ═══ */}
      {(dc.show_risks !== false || dc.show_activity !== false) && (
      <div style={{
        display: 'grid',
        gridTemplateColumns: (dc.show_risks !== false && dc.show_activity !== false && isLg) ? '1fr 1fr' : '1fr',
        gap: 16, marginBottom: 20,
      }}>
        {/* 위험 알림 */}
        {dc.show_risks !== false && (
        <div style={{ ...cardStyle, padding: isLg ? 24 : 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: isLg ? 17 : 15, fontWeight: 800, color: 'var(--primary)' }}>
              위험 알림
            </h2>
            <span style={{ fontSize: 12, fontWeight: 700, color: risk_alerts.length > 0 ? '#dc2626' : '#059669' }}>
              {risk_alerts.length > 0 ? `${risk_alerts.length}건` : '없음'}
            </span>
          </div>
          {risk_alerts.length === 0 ? (
            <EmptyState icon="🎉" title="위험 알림이 없습니다" description="모든 학생의 출결과 수납이 정상입니다" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {risk_alerts.slice(0, 8).map((alert, i) => {
                const sev = severityColor[alert.severity] || severityColor.medium;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8,
                    background: sev.bg, border: `1px solid ${sev.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                        onClick={() => navigate(`/admin/student/${alert.student_id}`)}
                      >
                        {alert.student_name}
                      </span>
                      <span style={{ fontSize: 12, color: sev.text, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {alert.message}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: sev.border, color: sev.text, whiteSpace: 'nowrap', flexShrink: 0 }}>
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
        <div style={{ ...cardStyle, padding: isLg ? 24 : 18 }}>
          <h2 style={{ margin: 0, fontSize: isLg ? 17 : 15, fontWeight: 800, color: 'var(--primary)', marginBottom: 14 }}>
            최근 활동
          </h2>
          {recent_events.length === 0 ? (
            <EmptyState icon="🕐" title="아직 활동 기록이 없습니다" description="학생 등록, 출결, 수납 등의 활동이 기록됩니다" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recent_events.map(ev => {
                const d = new Date(ev.event_date);
                const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                return (
                  <div key={ev.id} style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid #f1f5f9',
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.title}>{ev.title}</p>
                      {ev.student_name && (
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{ev.student_name}</p>
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
      <div className="dash-kpi-row" style={{ marginBottom: isLg ? 18 : 14 }}>
        {[
          { label: '오늘 수업', value: today_classes.length, unit: '건', color: 'var(--primary)' },
          { label: '출결 미입력', value: attendance_pending, unit: '명', color: attendance_pending > 0 ? 'var(--destructive)' : 'var(--success)' },
          { label: '학생 특이사항', value: student_alerts.length, unit: '건', color: student_alerts.length > 0 ? 'var(--warning)' : 'var(--success)' },
        ].map((kpi, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div className="card" style={{ margin: 0, padding: isLg ? '18px 22px' : '14px 16px', height: '100%', boxSizing: 'border-box' }}>
              <p style={{ fontSize: isLg ? 12 : 10, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: isLg ? 6 : 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</p>
              <div style={{ fontSize: isLg ? 30 : 24, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>
                {kpi.value}<span style={{ fontSize: isLg ? 14 : 12, fontWeight: 500, color: 'var(--muted-foreground)', marginLeft: 2 }}>{kpi.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 오늘 수업 목록 */}
      <div className="card" style={{ marginBottom: isLg ? 14 : 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 14 : 10 }}>
          <h2 style={{ margin: 0, fontSize: isLg ? 16 : 14, fontWeight: 700 }}>오늘 수업</h2>
          <span onClick={() => navigate('/admin/attendance')} style={{ fontSize: isLg ? 13 : 11, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>출결 입력 &rarr;</span>
        </div>
        {today_classes.length === 0 ? (
          <p style={{ fontSize: isLg ? 14 : 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '16px 0' }}>오늘 예정된 수업이 없습니다</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {today_classes.map(cls => (
              <div key={cls.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: isLg ? '12px 16px' : '10px 12px', borderRadius: 8,
                background: 'var(--neutral-50)', border: '1px solid var(--border)',
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: isLg ? 14 : 12, fontWeight: 700, margin: 0, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cls.name}>{cls.name}</p>
                  <p style={{ fontSize: isLg ? 12 : 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                    {cls.start_time?.slice(0, 5)}~{cls.end_time?.slice(0, 5)} {cls.room ? `| ${cls.room}` : ''}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: isLg ? 13 : 11, fontWeight: 600, color: 'var(--primary)' }}>{cls.student_count || 0}명</span>
                  {cls.subject && <p style={{ fontSize: isLg ? 11 : 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{cls.subject}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 학생 특이사항 */}
      {student_alerts.length > 0 && (
        <div className="card">
          <h2 style={{ margin: 0, fontSize: isLg ? 16 : 14, fontWeight: 700, marginBottom: isLg ? 14 : 10 }}>학생 특이사항</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {student_alerts.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: isLg ? '10px 14px' : '8px 12px', borderRadius: 8,
                background: 'var(--warning-light)', border: '1px solid oklch(88% 0.06 75)',
              }}>
                <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/student/${a.student_id}`)}
                >{a.student_name}</span>
                <span style={{ fontSize: isLg ? 13 : 11, color: 'oklch(35% 0.12 75)', fontWeight: 600 }}>{a.message}</span>
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
      <div className="dash-kpi-row" style={{ marginBottom: isLg ? 18 : 14 }}>
        {[
          { label: '오늘 상담', value: today_consultations.length, unit: '건', color: 'var(--primary)' },
          { label: '후속조치 필요', value: follow_up_due.length, unit: '건', color: follow_up_due.length > 0 ? 'var(--warning)' : 'var(--success)' },
          { label: '신규 문의', value: new_inquiries.length, unit: '건', color: new_inquiries.length > 0 ? 'var(--primary)' : 'var(--muted-foreground)' },
          { label: '전환율', value: cs.conversion_rate, unit: '%', color: cs.conversion_rate >= 30 ? 'var(--success)' : 'var(--warning)' },
        ].map((kpi, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div className="card" style={{ margin: 0, padding: isLg ? '18px 22px' : '14px 16px', height: '100%', boxSizing: 'border-box' }}>
              <p style={{ fontSize: isLg ? 12 : 10, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: isLg ? 6 : 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</p>
              <div style={{ fontSize: isLg ? 30 : 24, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>
                {kpi.value}<span style={{ fontSize: isLg ? 14 : 12, fontWeight: 500, color: 'var(--muted-foreground)', marginLeft: 2 }}>{kpi.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-mid-grid" style={{ marginBottom: isLg ? 14 : 10 }}>
        {/* 오늘 상담 / 후속조치 */}
        <div className="card" style={{ margin: 0, flex: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 14 : 10 }}>
            <h2 style={{ margin: 0, fontSize: isLg ? 16 : 14, fontWeight: 700 }}>오늘 상담 / 후속조치</h2>
            <span onClick={() => navigate('/admin/consultation')} style={{ fontSize: isLg ? 13 : 11, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>전체 보기 &rarr;</span>
          </div>
          {today_consultations.length === 0 && follow_up_due.length === 0 ? (
            <p style={{ fontSize: isLg ? 14 : 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '16px 0' }}>오늘 예정된 상담/후속조치가 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {follow_up_due.map(c => (
                <div key={`fu-${c.id}`} style={{
                  padding: isLg ? '10px 14px' : '8px 12px', borderRadius: 8,
                  background: 'var(--warning-light)', border: '1px solid oklch(88% 0.06 75)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 700 }}>{c.student_name || '미배정'}</span>
                    <span style={{ fontSize: isLg ? 12 : 10, color: 'var(--muted-foreground)', marginLeft: 8 }}>{c.consultation_type}</span>
                  </div>
                  <span style={{ fontSize: isLg ? 11 : 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'oklch(88% 0.06 75)', color: 'oklch(35% 0.12 75)' }}>후속조치</span>
                </div>
              ))}
              {today_consultations.map(c => (
                <div key={`tc-${c.id}`} style={{
                  padding: isLg ? '10px 14px' : '8px 12px', borderRadius: 8,
                  background: 'var(--info-light)', border: '1px solid oklch(88% 0.06 260)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 700 }}>{c.student_name || '미배정'}</span>
                    <span style={{ fontSize: isLg ? 12 : 10, color: 'var(--muted-foreground)', marginLeft: 8 }}>{c.consultation_type}</span>
                  </div>
                  <span style={{ fontSize: isLg ? 11 : 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'oklch(88% 0.06 260)', color: 'oklch(32% 0.12 260)' }}>오늘 상담</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 신규 문의 */}
        <div className="card" style={{ margin: 0, flex: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 14 : 10 }}>
            <h2 style={{ margin: 0, fontSize: isLg ? 16 : 14, fontWeight: 700 }}>신규 문의</h2>
            <span onClick={() => navigate('/admin/leads')} style={{ fontSize: isLg ? 13 : 11, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>전체 보기 &rarr;</span>
          </div>
          {new_inquiries.length === 0 ? (
            <p style={{ fontSize: isLg ? 14 : 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '16px 0' }}>신규 문의가 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {new_inquiries.slice(0, 8).map(lead => (
                <div key={lead.id} style={{
                  padding: isLg ? '10px 14px' : '8px 12px', borderRadius: 8,
                  background: 'var(--neutral-50)', border: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 700 }}>{lead.student_name}</span>
                    {lead.school && <span style={{ fontSize: isLg ? 12 : 10, color: 'var(--muted-foreground)', marginLeft: 8 }}>{lead.school} {lead.grade}</span>}
                  </div>
                  {lead.source && <span style={{ fontSize: isLg ? 11 : 10, color: 'var(--muted-foreground)' }}>{lead.source}</span>}
                </div>
              ))}
            </div>
          )}
          {/* 전환 통계 */}
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--neutral-50)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: isLg ? 12 : 10, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>이번달 전환 통계</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: isLg ? 13 : 11 }}>문의 <strong>{cs.this_month_inquiries}</strong></span>
              <span style={{ fontSize: isLg ? 13 : 11 }}>등록 <strong>{cs.this_month_enrolled}</strong></span>
              <span style={{ fontSize: isLg ? 13 : 11 }}>전환율 <strong style={{ color: 'var(--primary)' }}>{cs.conversion_rate}%</strong></span>
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

      <div className="dash-kpi-row" style={{ marginBottom: isLg ? 18 : 14 }}>
        {[
          { label: '오늘 납부기한', value: tt.due_today, unit: '건', color: tt.due_today > 0 ? 'var(--warning)' : 'var(--success)' },
          { label: '수납 확인 대기', value: tt.pending_confirmation, unit: '건', color: 'var(--primary)' },
          { label: '미납 독촉 대상', value: overdue_list.length, unit: '건', color: overdue_list.length > 0 ? 'var(--destructive)' : 'var(--success)' },
          { label: 'SMS 잔액', value: fmt(sms_balance.balance), unit: '건', color: 'var(--primary)' },
        ].map((kpi, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div className="card" style={{ margin: 0, padding: isLg ? '18px 22px' : '14px 16px', height: '100%', boxSizing: 'border-box' }}>
              <p style={{ fontSize: isLg ? 12 : 10, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: isLg ? 6 : 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</p>
              <div style={{ fontSize: isLg ? 30 : 24, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>
                {kpi.value}<span style={{ fontSize: isLg ? 14 : 12, fontWeight: 500, color: 'var(--muted-foreground)', marginLeft: 2 }}>{kpi.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 14 : 10 }}>
          <h2 style={{ margin: 0, fontSize: isLg ? 16 : 14, fontWeight: 700 }}>미납 독촉 대상 TOP {overdue_list.length}</h2>
          <span onClick={() => navigate('/admin/tuition')} style={{ fontSize: isLg ? 13 : 11, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>전체 보기 &rarr;</span>
        </div>
        {overdue_list.length === 0 ? (
          <p style={{ fontSize: isLg ? 14 : 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '16px 0' }}>미납 건이 없습니다</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overdue_list.map(t => (
              <div key={t.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: isLg ? '10px 14px' : '8px 12px', borderRadius: 8,
                background: 'var(--destructive-light)', border: '1px solid oklch(85% 0.08 25)',
              }}>
                <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/student-view/${t.student_id}`)}
                >{t.student_name}</span>
                <span style={{ fontSize: isLg ? 13 : 11, color: 'var(--destructive)', fontWeight: 600 }}>
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>데이터를 불러오는 중...</div>
    </div>
  );
}

function ErrorState() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 14, color: 'var(--destructive)' }}>데이터를 불러오지 못했습니다. 새로고침해 주세요.</div>
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
        <div style={{ marginBottom: isLg ? 18 : 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isLg ? 8 : 6 }}>
            {actionItems.map((item, i) => (
              <button key={i} onClick={() => navigate(item.path)} style={{
                display: 'flex', alignItems: 'center', gap: isLg ? 10 : 8,
                padding: isLg ? '10px 18px' : '8px 14px', borderRadius: 8,
                border: `1px solid ${item.urgent ? 'oklch(90% 0.06 25)' : 'var(--border)'}`,
                background: item.urgent ? 'var(--destructive-light)' : 'var(--card)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span style={{ fontSize: isLg ? 20 : 16, fontWeight: 800, color: item.urgent ? 'var(--destructive)' : 'var(--primary)', lineHeight: 1 }}>{item.count}</span>
                <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 600, color: 'var(--foreground)' }}>{item.label}</span>
                <span style={{ fontSize: isLg ? 15 : 13, color: 'var(--muted-foreground)', marginLeft: 2 }}>&rarr;</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="dash-kpi-row" style={{ marginBottom: isLg ? 18 : 14 }}>
        {[
          { label: '재원생', value: totalStudents, unit: '명', sub: '재학 중', color: 'var(--primary)' },
          { label: '오늘 클리닉', value: todayClinic, unit: '건', sub: todayClinic === 0 ? '일정 없음' : '오늘 진행', color: todayClinic > 0 ? 'oklch(48% 0.22 295)' : 'var(--muted-foreground)' },
          { label: '이번 주 수업', value: upcomingClasses.length, unit: '회', sub: '남은 수업', color: 'var(--success)' },
          { label: '다음 시험', value: nextExam ? `D-${daysUntil(nextExam.exam_date)}` : '-', unit: '', sub: nextExam ? nextExam.name : '예정 없음', color: nextExam && daysUntil(nextExam.exam_date) <= 7 ? 'var(--warning)' : 'var(--foreground)' },
        ].map((kpi, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div className="card" style={{ margin: 0, padding: isLg ? '18px 22px' : '14px 16px', height: '100%', boxSizing: 'border-box' }}>
              <p style={{ fontSize: isLg ? 12 : 10, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: isLg ? 6 : 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</p>
              <div style={{ fontSize: isLg ? 30 : 24, fontWeight: 800, color: kpi.color, lineHeight: 1, marginBottom: isLg ? 5 : 3 }}>
                {kpi.value}
                {kpi.unit && <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 500, color: 'var(--muted-foreground)', marginLeft: 2 }}>{kpi.unit}</span>}
              </div>
              <p style={{ fontSize: isLg ? 13 : 11, color: 'var(--muted-foreground)', margin: 0 }}>{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Student counts */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 14 : 10 }}>
          <h2 style={{ margin: 0, fontSize: isLg ? 16 : 13, fontWeight: 700 }}>학교별 현황</h2>
          <span style={{ fontSize: isLg ? 16 : 13, fontWeight: 800, color: 'var(--primary)' }}>{totalStudents}명</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SCHOOLS.filter(s => !['조교', '선생님'].includes(s.name)).map(s => (
            <div key={s.name}>
              <div onClick={() => navigate(`/admin/school/${encodeURIComponent(s.name)}`)} style={{
                padding: isLg ? '9px 12px' : '7px 10px', borderRadius: 7, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--neutral-50)', border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 600, color: 'var(--foreground)' }}>{s.name}</span>
                <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 700, color: 'var(--primary)' }}>{schoolCounts[s.name] || 0}명</span>
              </div>
              {gradeDetails[s.name]?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3, paddingLeft: 8 }}>
                  {gradeDetails[s.name].map(g => (
                    <span key={g.grade} style={{ fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--neutral-100)', padding: '1px 6px', borderRadius: 4 }}>
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
    <div className="content max-w-7xl mx-auto">

      {/* Password Modal */}
      {showPwModal && (
        <div onClick={() => setShowPwModal(false)} style={{
          position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.45)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 340, maxWidth: '90vw', padding: 24, margin: 0 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>비밀번호 변경</h3>
            {pwMsg && (
              <div className={`alert ${pwMsg.includes('변경') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>{pwMsg}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="password" placeholder="현재 비밀번호" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
              <input type="password" placeholder="새 비밀번호 (4자 이상)" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} />
              <input type="password" placeholder="새 비밀번호 확인" value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleChangePassword}>변경</button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowPwModal(false)}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Header (owner role has its own greeting inside OwnerDashboard) */}
      {role !== 'admin' && (
        <div style={{ marginBottom: isLg ? 20 : 16, paddingBottom: isLg ? 16 : 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{ fontSize: isLg ? 24 : 20, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.03em', margin: 0 }}>
              대시보드
            </h1>
            {roleLabel && (
              <span style={{ fontSize: isLg ? 12 : 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--primary-light)', color: 'var(--primary)' }}>
                {roleLabel}
              </span>
            )}
            <p style={{ fontSize: isLg ? 14 : 12, color: 'var(--muted-foreground)', margin: 0 }}>
              {today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일 ({DAY_NAMES[today.getDay()]})
            </p>
          </div>
        </div>
      )}

      {/* 초대 코드 (admin만) */}
      {role === 'admin' && inviteCode && (
        <div style={{
          marginBottom: 14, padding: '16px 18px', borderRadius: 14,
          background: 'var(--card)', border: '1.5px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: isLg ? 16 : 14, fontWeight: 700, color: 'var(--foreground)' }}>학생 초대</span>
            {academyName && <span style={{ fontSize: isLg ? 14 : 12, color: 'var(--muted-foreground)' }}>({academyName})</span>}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
            padding: '10px 14px', borderRadius: 10, background: 'var(--muted)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, whiteSpace: 'nowrap' }}>초대 코드</span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, fontFamily: 'monospace', color: 'var(--primary)', flex: 1 }}>{inviteCode}</span>
            <button onClick={() => { navigator.clipboard.writeText(inviteCode); setCopiedType('code'); setTimeout(() => setCopiedType(''), 2000); }}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: copiedType === 'code' ? 'var(--success-light)' : 'var(--card)',
                color: copiedType === 'code' ? 'var(--success)' : 'var(--foreground)',
                cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>{copiedType === 'code' ? '복사됨' : '코드 복사'}</button>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10, background: 'var(--muted)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, whiteSpace: 'nowrap' }}>가입 링크</span>
            <span style={{ fontSize: 12, color: 'var(--foreground)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {window.location.origin}/register?academy={inviteCode}
            </span>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register?academy=${inviteCode}`); setCopiedType('link'); setTimeout(() => setCopiedType(''), 2000); }}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                background: copiedType === 'link' ? 'var(--success-light)' : 'var(--card)',
                color: copiedType === 'link' ? 'var(--success)' : 'var(--foreground)',
                cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>{copiedType === 'link' ? '복사됨' : '링크 복사'}</button>
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
          .dash-mid-grid > .card { flex: 1 !important; }
        }
        @media (max-width: 600px) {
          .dash-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
        }
      `}</style>
    </div>
  );
}
