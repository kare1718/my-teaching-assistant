import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPut } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import useResizableGrid from '../../hooks/useResizableGrid';
import { GridResizeHandle } from '../../components/ResizeHandle';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const STATUS_LABEL = {
  pending:   { text: '대기',  bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)' },
  approved:  { text: '승인',  bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)' },
  completed: { text: '완료',  bg: 'var(--info-light)', color: 'oklch(32% 0.12 260)' },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { config } = useTenantConfig();
  const SCHOOLS = config.schools || [];
  const [schoolCounts, setSchoolCounts]       = useState({});
  const [gradeDetails, setGradeDetails]       = useState({});
  const [pendingCount, setPendingCount]       = useState(0);
  const [editRequestCount, setEditRequestCount] = useState(0);
  const [reviewCount, setReviewCount]         = useState(0);
  const [qnaCount, setQnaCount]               = useState(0);
  const [clinicCount, setClinicCount]         = useState(0);
  const [upcomingClinic, setUpcomingClinic]   = useState([]);
  const [upcomingExams, setUpcomingExams]     = useState([]);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [showPwModal, setShowPwModal]         = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [academyName, setAcademyName] = useState('');

  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

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

    api('/auth/my-invite-code').then(data => {
      if (data.inviteCode) setInviteCode(data.inviteCode);
      if (data.academyName) setAcademyName(data.academyName);
    }).catch(() => {});

    api('/admin/badge-counts').then(c => {
      setPendingCount(c.pending_users || 0);
      setEditRequestCount(c.edit_requests || 0);
      setClinicCount(c.pending_clinic || 0);
      setQnaCount(c.pending_questions || 0);
      setReviewCount(c.pending_reviews || 0);
    }).catch(() => {});

    const month = today.getMonth() + 1;
    const year  = today.getFullYear();
    const fetchClinic = (y, m) =>
      api(`/clinic/admin/all?year=${y}&month=${m}`).then(data => {
        return data
          .filter(a => a.appointment_date >= todayStr && (a.status === 'approved' || a.status === 'pending'))
          .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.time_slot.localeCompare(b.time_slot));
      }).catch(() => []);

    Promise.all([
      fetchClinic(year, month),
      fetchClinic(month === 12 ? year+1 : year, month === 12 ? 1 : month+1),
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

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) { setPwMsg('모든 항목을 입력해주세요.'); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword)  { setPwMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    if (pwForm.newPassword.length < 4)                  { setPwMsg('비밀번호는 최소 4자 이상이어야 합니다.'); return; }
    try {
      await apiPut('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg('비밀번호가 변경되었습니다!');
      setTimeout(() => { setShowPwModal(false); setPwMsg(''); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }, 1500);
    } catch (e) { setPwMsg(e.message); }
  };

  const formatDate  = (d) => { const x = new Date(d + 'T00:00:00'); return `${x.getMonth()+1}/${x.getDate()}(${DAY_NAMES[x.getDay()]})`; };
  const isToday     = (d) => d === todayStr;
  const daysUntil   = (d) => Math.ceil((new Date(d + 'T00:00:00') - today) / 86400000);

  const totalStudents = SCHOOLS
    .filter(s => !['조교', '선생님', '중학생'].includes(s.name))
    .reduce((sum, s) => sum + (schoolCounts[s.name] || 0), 0);

  const todayClinic = upcomingClinic.filter(a => isToday(a.appointment_date)).length;
  const nextExam    = upcomingExams[0];

  const actionItems = [
    pendingCount     > 0 && { path: '/admin/pending',       label: '가입 승인 대기',   count: pendingCount,     urgent: true },
    qnaCount         > 0 && { path: '/admin/qna',           label: '미답변 질문',      count: qnaCount,         urgent: true },
    clinicCount      > 0 && { path: '/admin/clinic',        label: '클리닉 승인 대기', count: clinicCount,      urgent: false },
    editRequestCount > 0 && { path: '/admin/edit-requests', label: '정보 수정 요청',   count: editRequestCount, urgent: false },
    reviewCount      > 0 && { path: '/admin/reviews',       label: '후기 검토 대기',   count: reviewCount,      urgent: false },
  ].filter(Boolean);

  /* ─── grouped schedule helpers ─── */
  const groupedClasses = (() => {
    const g = {};
    upcomingClasses.forEach(s => { if (!g[s.schedule_date]) g[s.schedule_date] = []; g[s.schedule_date].push(s); });
    return g;
  })();

  /* ─── resizable grid hooks ─── */
  const kpiResize = useResizableGrid('admin-dashboard-kpi', [1, 1, 1, 1]);
  const mainResize = useResizableGrid('admin-dashboard-main', [2, 1]);
  const scheduleResize = useResizableGrid('admin-dashboard-schedule', [1, 1]);

  const hasCustomLayout = kpiResize.sizes.some((s, i) => Math.abs(s - [1,1,1,1][i]) > 0.01) ||
    mainResize.sizes.some((s, i) => Math.abs(s - [2,1][i]) > 0.01) ||
    scheduleResize.sizes.some((s, i) => Math.abs(s - [1,1][i]) > 0.01);

  const resetAllLayouts = () => {
    kpiResize.resetSizes();
    mainResize.resetSizes();
    scheduleResize.resetSizes();
  };

  return (
    <div className="content">

      {/* ── Password Modal ─────────────────── */}
      {showPwModal && (
        <div onClick={() => setShowPwModal(false)} style={{
          position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.45)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{
            width: 340, maxWidth: '90vw', padding: 24, margin: 0,
          }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>비밀번호 변경</h3>
            {pwMsg && (
              <div className={`alert ${pwMsg.includes('변경') ? 'alert-success' : 'alert-error'}`}
                style={{ marginBottom: 12 }}>{pwMsg}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="password" placeholder="현재 비밀번호"
                value={pwForm.currentPassword}
                onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
              <input type="password" placeholder="새 비밀번호 (4자 이상)"
                value={pwForm.newPassword}
                onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} />
              <input type="password" placeholder="새 비밀번호 확인"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleChangePassword}>변경</button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowPwModal(false)}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ────────────────────── */}
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.03em', margin: 0 }}>
            대시보드
          </h1>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
            {today.getFullYear()}년 {today.getMonth()+1}월 {today.getDate()}일 ({DAY_NAMES[today.getDay()]})
          </p>
        </div>
        {actionItems.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 4, fontWeight: 500 }}>
            처리가 필요한 항목이 {actionItems.length}개 있습니다
          </p>
        )}
      </div>

      {/* ── 학생 초대 코드 ─────────────────── */}
      {inviteCode && (
        <div style={{
          marginBottom: 14, padding: '10px 16px', borderRadius: 10,
          background: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 12,
          border: '1px solid var(--border)'
        }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {academyName ? `${academyName} ` : ''}초대 코드
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, fontFamily: 'monospace', color: 'var(--primary)' }}>
              {inviteCode}
            </div>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(inviteCode); alert('초대 코드가 복사되었습니다!'); }}
            style={{
              padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--card)', cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}
          >
            복사
          </button>
        </div>
      )}

      {/* ── Action Required ─────────────────── */}
      {actionItems.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {actionItems.map((item, i) => (
              <button key={i} onClick={() => navigate(item.path)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 8,
                border: `1px solid ${item.urgent ? 'oklch(90% 0.06 25)' : 'var(--border)'}`,
                background: item.urgent ? 'var(--destructive-light)' : 'var(--card)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ fontSize: 16, fontWeight: 800, color: item.urgent ? 'var(--destructive)' : 'var(--primary)', lineHeight: 1 }}>
                  {item.count}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{item.label}</span>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)', marginLeft: 2 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Row ─────────────────────────── */}
      {hasCustomLayout && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button onClick={resetAllLayouts} style={{
            fontSize: 11, color: 'var(--muted-foreground)', background: 'none', border: '1px solid var(--border)',
            borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit',
          }}>레이아웃 초기화</button>
        </div>
      )}
      <div className="dash-kpi-row" ref={kpiResize.containerRef} style={{ marginBottom: 14 }}>
        {[
          { label: '재원생', value: totalStudents, unit: '명', sub: '재학 중', color: 'var(--primary)' },
          { label: '오늘 클리닉', value: todayClinic, unit: '건', sub: todayClinic === 0 ? '일정 없음' : '오늘 진행', color: todayClinic > 0 ? 'oklch(48% 0.22 295)' : 'var(--muted-foreground)' },
          { label: '이번 주 수업', value: upcomingClasses.length, unit: '회', sub: '남은 수업', color: 'var(--success)' },
          { label: '다음 시험', value: nextExam ? `D-${daysUntil(nextExam.exam_date)}` : '—', unit: '', sub: nextExam ? nextExam.name : '예정 없음', color: nextExam && daysUntil(nextExam.exam_date) <= 7 ? 'var(--warning)' : 'var(--foreground)' },
        ].flatMap((kpi, i, arr) => [
          <div key={`kpi-${i}`} style={{ flex: kpiResize.sizes[i], minWidth: 0 }}>
            <div className="card" style={{ margin: 0, padding: '14px 16px', height: '100%', boxSizing: 'border-box' }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {kpi.label}
              </p>
              <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color, lineHeight: 1, marginBottom: 3 }}>
                {kpi.value}
                {kpi.unit && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginLeft: 2 }}>{kpi.unit}</span>}
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{kpi.sub}</p>
            </div>
          </div>,
          i < arr.length - 1 ? <GridResizeHandle key={`kpi-h-${i}`} onMouseDown={e => kpiResize.handleMouseDown(i, e)} /> : null,
        ]).filter(Boolean)}
      </div>

      {/* ── Main Grid ───────────────────────── */}
      <div className="dash-main-grid" ref={mainResize.containerRef}>

        {/* Left: Schedules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: mainResize.sizes[0], minWidth: 0 }}>

          {/* Clinic */}
          <div className="card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>클리닉 일정</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {clinicCount > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--warning-light)', color: 'oklch(35% 0.12 75)' }}>
                    승인 대기 {clinicCount}
                  </span>
                )}
                <span onClick={() => navigate('/admin/clinic')} style={{ fontSize: 12, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
                  관리 →
                </span>
              </div>
            </div>
            {upcomingClinic.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center', padding: '12px 0', margin: 0 }}>
                예정된 클리닉이 없습니다
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {upcomingClinic.map(a => {
                  const st     = STATUS_LABEL[a.status] || STATUS_LABEL.pending;
                  const isTod  = isToday(a.appointment_date);
                  return (
                    <div key={a.id} onClick={() => navigate('/admin/clinic')} style={{
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      background: isTod ? 'var(--info-light)' : 'var(--neutral-50)',
                      border: isTod ? '1px solid oklch(72% 0.10 260)' : '1px solid var(--border)',
                      transition: 'background 0.1s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isTod ? 'var(--primary)' : 'var(--foreground)' }}>
                            {isTod ? '오늘' : formatDate(a.appointment_date)} {a.time_slot}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{a.student_name}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{a.topic}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: st.bg, color: st.color }}>
                          {st.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Classes + Exams */}
          <div className="dash-schedule-row" ref={scheduleResize.containerRef}>

            {/* Classes */}
            <div className="card" style={{ margin: 0, flex: scheduleResize.sizes[0], minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>이번 주 수업</h2>
                <span onClick={() => navigate('/admin/schedules')} style={{ fontSize: 12, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>관리 →</span>
              </div>
              {Object.keys(groupedClasses).length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center', padding: '10px 0', margin: 0 }}>이번 주 수업이 없습니다</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.keys(groupedClasses).sort().map(date => {
                    const items     = groupedClasses[date];
                    const isTodDate = isToday(date);
                    return (
                      <div key={date}>
                        <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: isTodDate ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                          {isTodDate ? '오늘' : formatDate(date)}
                        </p>
                        {items.map(s => {
                          const cancelled = s.status === 'cancelled';
                          return (
                            <div key={s.id} onClick={() => navigate('/admin/schedules')} style={{
                              padding: '5px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                              borderLeft: `3px solid ${cancelled ? 'var(--neutral-300)' : (s.color || 'var(--primary-light)')}`,
                              background: cancelled ? 'var(--destructive-light)' : isTodDate ? 'var(--success-light)' : 'var(--neutral-50)',
                              opacity: cancelled ? 0.7 : 1, fontSize: 12,
                            }}>
                              {cancelled && <span style={{ color: 'var(--destructive)', fontWeight: 700, marginRight: 3 }}>휴강</span>}
                              <span style={{ fontWeight: 600 }}>{s.time_slot || ''}</span>
                              <span style={{ marginLeft: 4 }}>{s.title}</span>
                              {s.target_school && <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}> ({s.target_school})</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <GridResizeHandle onMouseDown={e => scheduleResize.handleMouseDown(0, e)} />

            {/* Exams */}
            <div className="card" style={{ margin: 0, flex: scheduleResize.sizes[1], minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>예정 시험</h2>
                <span onClick={() => navigate('/admin/scores')} style={{ fontSize: 12, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>관리 →</span>
              </div>
              {upcomingExams.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center', padding: '10px 0', margin: 0 }}>예정된 시험이 없습니다</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {upcomingExams.map(e => {
                    const dl = daysUntil(e.exam_date);
                    return (
                      <div key={e.id} onClick={() => navigate('/admin/scores')} style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        background: isToday(e.exam_date) ? 'var(--warning-light)' : 'var(--neutral-50)',
                        border: isToday(e.exam_date) ? '1px solid var(--warning)' : '1px solid var(--border)',
                        transition: 'background 0.1s',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {e.name}
                            </p>
                            {e.school && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{e.school}</p>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, margin: 0, color: dl <= 3 ? 'var(--destructive)' : dl <= 7 ? 'var(--warning)' : 'var(--muted-foreground)' }}>
                              {isToday(e.exam_date) ? '오늘' : `D-${dl}`}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{formatDate(e.exam_date)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <GridResizeHandle onMouseDown={e => mainResize.handleMouseDown(0, e)} />

        {/* Right: Student Overview + Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: mainResize.sizes[1], minWidth: 0 }}>

          {/* Student counts */}
          <div className="card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>학교별 현황</h2>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>{totalStudents}명</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SCHOOLS.filter(s => !['조교', '선생님', '중학생'].includes(s.name)).map(s => (
                <div key={s.name}>
                  <div onClick={() => navigate(`/admin/school/${encodeURIComponent(s.name)}`)} style={{
                    padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--neutral-50)', border: '1px solid var(--border)',
                    transition: 'border-color 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{s.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{schoolCounts[s.name] || 0}명</span>
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
              {['조교', '선생님'].some(r => (schoolCounts[r] || 0) > 0) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  {['조교', '선생님'].map(role => (schoolCounts[role] || 0) > 0 && (
                    <span key={role} onClick={() => navigate(`/admin/school/${encodeURIComponent(role)}`)}
                      style={{ fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                      {role} {schoolCounts[role]}명
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Responsive styles ───────────────── */}
      <style>{`
        .dash-kpi-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .dash-main-grid {
          display: flex;
          gap: 0;
          align-items: flex-start;
        }
        .dash-main-grid .card {
          padding: 14px 16px;
        }
        .dash-schedule-row {
          display: flex;
          gap: 0;
          align-items: stretch;
        }
        @media (max-width: 900px) {
          .dash-main-grid { flex-direction: column; gap: 10px; }
          .dash-main-grid > div { flex: 1 !important; }
          .dash-main-grid > .resize-handle { display: none !important; }
        }
        @media (max-width: 600px) {
          .dash-kpi-row { flex-wrap: wrap; gap: 6px; }
          .dash-kpi-row > div:not(.resize-handle) { flex: 0 0 calc(50% - 6px) !important; }
          .dash-kpi-row > .resize-handle { display: none !important; }
          .dash-schedule-row { flex-direction: column; gap: 8px; }
          .dash-schedule-row > .card { flex: 1 !important; }
          .dash-schedule-row > .resize-handle { display: none !important; }
        }
      `}</style>
    </div>
  );
}
