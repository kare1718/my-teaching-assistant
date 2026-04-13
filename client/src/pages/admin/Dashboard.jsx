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

// ════════════════════════════════════════
// 원장(admin) 대시보드
// ════════════════════════════════════════
function OwnerDashboard({ isLg }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/dashboard/owner')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <ErrorState />;

  const { today_summary: ts, attendance_today: att, tuition_summary: tui, risk_alerts, tasks_summary: tasks, recent_events, class_occupancy } = data;
  const attTotal = att.present + att.absent + att.late + att.excused;
  const attRate = attTotal > 0 ? Math.round(((att.present + att.late) / attTotal) * 100) : 0;

  return (
    <>
      {/* KPI 카드 4개 */}
      <div className="dash-kpi-row" style={{ marginBottom: isLg ? 18 : 14 }}>
        {[
          { label: '재원생', value: fmt(ts.total_students), unit: '명', sub: `신규 ${ts.new_this_month} / 퇴원 ${ts.withdrawn_this_month}`, color: 'var(--primary)', path: '/admin/students' },
          { label: '오늘 출결률', value: `${attRate}`, unit: '%', sub: `출석 ${att.present} / 결석 ${att.absent} / 지각 ${att.late}`, color: attRate >= 90 ? 'var(--success)' : attRate >= 70 ? 'var(--warning)' : 'var(--destructive)', path: '/admin/attendance' },
          { label: '이번달 수납', value: fmtWon(tui.this_month_collected), unit: '원', sub: `청구 ${fmtWon(tui.this_month_billed)}원`, color: 'var(--primary)', path: '/admin/tuition' },
          { label: '미납 건수', value: fmt(tui.overdue_count), unit: '건', sub: `미납액 ${fmtWon(tui.outstanding_total)}원`, color: tui.overdue_count > 0 ? 'var(--destructive)' : 'var(--success)', path: '/admin/tuition' },
        ].map((kpi, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div className="card" onClick={() => navigate(kpi.path)} style={{
              margin: 0, padding: isLg ? '18px 22px' : '14px 16px', cursor: 'pointer',
              height: '100%', boxSizing: 'border-box', transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <p style={{ fontSize: isLg ? 12 : 10, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: isLg ? 6 : 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {kpi.label}
              </p>
              <div style={{ fontSize: isLg ? 30 : 24, fontWeight: 800, color: kpi.color, lineHeight: 1, marginBottom: isLg ? 5 : 3 }}>
                {kpi.value}
                <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 500, color: 'var(--muted-foreground)', marginLeft: 2 }}>{kpi.unit}</span>
              </div>
              <p style={{ fontSize: isLg ? 13 : 11, color: 'var(--muted-foreground)', margin: 0 }}>{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 중단: 위험알림 + 업무 */}
      <div className="dash-mid-grid" style={{ marginBottom: isLg ? 18 : 14 }}>
        {/* 위험 알림 */}
        <div className="card" style={{ margin: 0, flex: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 14 : 10 }}>
            <h2 style={{ margin: 0, fontSize: isLg ? 16 : 14, fontWeight: 700 }}>위험 알림</h2>
            <span style={{ fontSize: isLg ? 13 : 11, fontWeight: 700, color: risk_alerts.length > 0 ? 'var(--destructive)' : 'var(--success)' }}>
              {risk_alerts.length > 0 ? `${risk_alerts.length}건` : '없음'}
            </span>
          </div>
          {risk_alerts.length === 0 ? (
            <p style={{ fontSize: isLg ? 14 : 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '16px 0' }}>
              위험 알림이 없습니다
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {risk_alerts.map((alert, i) => {
                const sev = severityColor[alert.severity] || severityColor.medium;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: isLg ? '10px 14px' : '8px 12px', borderRadius: 8,
                    background: sev.bg, border: `1px solid ${sev.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 700, color: 'var(--foreground)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.15s' }}
                        onClick={() => navigate(`/admin/student/${alert.student_id}`)}
                        onMouseEnter={e => e.currentTarget.style.textDecorationColor = 'var(--foreground)'}
                        onMouseLeave={e => e.currentTarget.style.textDecorationColor = 'transparent'}
                      >
                        {alert.student_name}
                      </span>
                      <span style={{ fontSize: isLg ? 13 : 11, color: sev.text, fontWeight: 600 }}>{alert.message}</span>
                    </div>
                    <span style={{ fontSize: isLg ? 11 : 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: sev.border, color: sev.text, whiteSpace: 'nowrap' }}>
                      {alert.type === 'consecutive_absence' ? '연속 결석' : '수납 연체'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 오늘의 업무 */}
        <div className="card" style={{ margin: 0, flex: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 14 : 10 }}>
            <h2 style={{ margin: 0, fontSize: isLg ? 16 : 14, fontWeight: 700 }}>업무 현황</h2>
            <span onClick={() => navigate('/admin/automation')} style={{ fontSize: isLg ? 13 : 11, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>전체 보기 &rarr;</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '대기 중', value: tasks.pending, color: 'var(--primary)' },
              { label: '긴급', value: tasks.urgent, color: 'var(--destructive)' },
              { label: '기한 초과', value: tasks.overdue, color: 'var(--warning)' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--neutral-50)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: isLg ? 14 : 12, fontWeight: 600 }}>{t.label}</span>
                <span style={{ fontSize: isLg ? 18 : 16, fontWeight: 800, color: t.value > 0 ? t.color : 'var(--muted-foreground)' }}>{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단: 반 충원율 + 최근 활동 */}
      <div className="dash-mid-grid">
        {/* 반 충원율 */}
        <div className="card" style={{ margin: 0, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isLg ? 14 : 10 }}>
            <h2 style={{ margin: 0, fontSize: isLg ? 16 : 14, fontWeight: 700 }}>반 충원율</h2>
            <span onClick={() => navigate('/admin/classes')} style={{ fontSize: isLg ? 13 : 11, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>관리 &rarr;</span>
          </div>
          {class_occupancy.length === 0 ? (
            <p style={{ fontSize: isLg ? 14 : 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '12px 0' }}>등록된 반이 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {class_occupancy.map(c => (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: isLg ? 13 : 11, fontWeight: 600 }}>{c.name}</span>
                    <span style={{ fontSize: isLg ? 12 : 10, color: 'var(--muted-foreground)' }}>
                      {c.current_count}/{c.capacity || '-'} ({c.rate}%)
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--neutral-100)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, transition: 'width 0.3s',
                      width: `${Math.min(c.rate, 100)}%`,
                      background: c.rate >= 90 ? 'var(--success)' : c.rate >= 70 ? 'var(--primary)' : 'var(--warning)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 활동 */}
        <div className="card" style={{ margin: 0, flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: isLg ? 16 : 14, fontWeight: 700, marginBottom: isLg ? 14 : 10 }}>최근 활동</h2>
          {recent_events.length === 0 ? (
            <p style={{ fontSize: isLg ? 14 : 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '12px 0' }}>최근 활동이 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent_events.map(ev => {
                const d = new Date(ev.event_date);
                const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                return (
                  <div key={ev.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: isLg ? 12 : 10, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', paddingTop: 2 }}>{dateStr}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: isLg ? 13 : 11, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>{ev.title}</p>
                      {ev.student_name && (
                        <p style={{ fontSize: isLg ? 12 : 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{ev.student_name}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
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

  const { today_classes, attendance_pending, student_alerts } = data;

  return (
    <>
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
                <div>
                  <p style={{ fontSize: isLg ? 14 : 12, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>{cls.name}</p>
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

  const { today_consultations, follow_up_due, new_inquiries, conversion_stats: cs } = data;

  return (
    <>
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
    <div className="content">

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

      {/* Page Header */}
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
      {role === 'admin'
        ? <OwnerDashboard isLg={isLg} />
        : (role === 'teacher' || role === 'assistant')
          ? <TeacherDashboard isLg={isLg} />
          : role === 'counselor'
            ? <CounselorDashboard isLg={isLg} />
            : <LegacyDashboard isLg={isLg} />
      }

      {/* Responsive styles */}
      <style>{`
        .dash-kpi-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
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
          .dash-kpi-row { flex-wrap: wrap; gap: 6px; }
          .dash-kpi-row > div { flex: 0 0 calc(50% - 4px) !important; }
        }
      `}</style>
    </div>
  );
}
