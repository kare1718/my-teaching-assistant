import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPut } from '../../api';
import { SCHOOLS, SITE_TITLE, MAIN_TITLE } from '../../config';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const STATUS_STYLE = {
  pending: { text: '대기', bg: '#fef3c7', color: '#92400e' },
  approved: { text: '승인', bg: '#dcfce7', color: '#166534' },
  completed: { text: '완료', bg: '#e0e7ff', color: '#3730a3' },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [schoolCounts, setSchoolCounts] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [editRequestCount, setEditRequestCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [qnaCount, setQnaCount] = useState(0);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState('');

  // 일정 데이터
  const [upcomingClinic, setUpcomingClinic] = useState([]);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [clinicCount, setClinicCount] = useState(0);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    api('/admin/schools').then((data) => {
      const counts = {};
      data.forEach((s) => { counts[s.school] = s.student_count; });
      setSchoolCounts(counts);
    }).catch(console.error);

    api('/admin/pending-users').then((data) => setPendingCount(data.length)).catch(console.error);
    api('/admin/edit-requests').then((data) => setEditRequestCount(data.length)).catch(console.error);
    api('/admin/reviews').then((data) => setReviewCount(data.filter(r => r.status === 'pending').length)).catch(console.error);
    api('/questions/all').then((data) => setQnaCount(data.filter(q => q.status === 'pending').length)).catch(console.error);

    // 클리닉 일정 (이번 달 + 다음 달)
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    api(`/clinic/admin/all?year=${year}&month=${month}`).then(data => {
      const upcoming = data
        .filter(a => a.appointment_date >= todayStr && (a.status === 'approved' || a.status === 'pending'))
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.time_slot.localeCompare(b.time_slot));
      setUpcomingClinic(upcoming.slice(0, 8));
      setClinicCount(data.filter(a => a.status === 'pending').length);
    }).catch(console.error);

    // 다음 달도 가져오기
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    api(`/clinic/admin/all?year=${nextYear}&month=${nextMonth}`).then(data => {
      const upcoming = data
        .filter(a => a.appointment_date >= todayStr && (a.status === 'approved' || a.status === 'pending'))
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || a.time_slot.localeCompare(b.time_slot));
      setUpcomingClinic(prev => {
        const merged = [...prev, ...upcoming].sort((a, b) =>
          a.appointment_date.localeCompare(b.appointment_date) || a.time_slot.localeCompare(b.time_slot)
        );
        return merged.slice(0, 8);
      });
    }).catch(console.error);

    // 시험 일정
    api('/scores/exams').then(data => {
      const upcoming = data
        .filter(e => e.exam_date && e.exam_date >= todayStr)
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
      setUpcomingExams(upcoming.slice(0, 5));
    }).catch(console.error);

    // 수업 일정 (이번 주)
    api('/schedules/week').then(data => setUpcomingClasses(data.schedules || [])).catch(console.error);
  }, []);

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

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
  };

  const isToday = (dateStr) => dateStr === todayStr;

  // 일정 사이드 패널
  const renderSchedulePanel = () => (
    <div className="schedule-side-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 클리닉 일정 */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>🩺 클리닉 일정</h3>
          {clinicCount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: '#fef3c7', color: '#92400e'
            }}>대기 {clinicCount}</span>
          )}
        </div>
        {upcomingClinic.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '8px 0', margin: 0 }}>
            예정된 클리닉이 없습니다
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingClinic.map(a => {
              const st = STATUS_STYLE[a.status] || STATUS_STYLE.pending;
              return (
                <div key={a.id} onClick={() => navigate('/admin/clinic')} style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: isToday(a.appointment_date) ? '#eff6ff' : '#f8fafc',
                  border: isToday(a.appointment_date) ? '1px solid #93c5fd' : '1px solid var(--border)',
                  transition: 'background 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isToday(a.appointment_date) ? '#2563eb' : 'var(--foreground)' }}>
                      {isToday(a.appointment_date) ? '오늘' : formatDate(a.appointment_date)} {a.time_slot}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6,
                      background: st.bg, color: st.color
                    }}>{st.text}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--foreground)' }}>
                    <span style={{ fontWeight: 600 }}>{a.student_name}</span>
                    <span style={{ color: 'var(--muted-foreground)', marginLeft: 4, fontSize: 11 }}>{a.topic}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <span onClick={() => navigate('/admin/clinic')} style={{
            fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500,
          }}>관리 →</span>
        </div>
      </div>

      {/* 수업 일정 (이번 주) */}
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>📚 이번 주 수업</h3>
        {upcomingClasses.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '8px 0', margin: 0 }}>
            이번 주 수업이 없습니다
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(() => {
              const grouped = {};
              upcomingClasses.forEach(s => {
                if (!grouped[s.schedule_date]) grouped[s.schedule_date] = [];
                grouped[s.schedule_date].push(s);
              });
              return Object.keys(grouped).sort().map(date => {
                const items = grouped[date];
                const isTodayDate = isToday(date);
                return (
                  <div key={date}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 0',
                      color: isTodayDate ? '#2563eb' : 'var(--muted-foreground)',
                    }}>
                      {isTodayDate ? '오늘' : formatDate(date)}
                    </div>
                    {items.map(s => {
                      const cancelled = s.status === 'cancelled';
                      return (
                        <div key={s.id} onClick={() => navigate('/admin/schedules')} style={{
                          padding: '4px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                          borderLeft: `3px solid ${cancelled ? '#d1d5db' : (s.color || '#3b82f6')}`,
                          background: cancelled ? '#fef2f2' : isTodayDate ? '#f0fdf4' : '#f8fafc',
                          opacity: cancelled ? 0.6 : 1,
                        }}>
                          <div style={{ fontSize: 11 }}>
                            {cancelled && <span style={{ color: '#ef4444', fontWeight: 700, marginRight: 2 }}>휴강</span>}
                            <span style={{ fontWeight: 600, textDecoration: cancelled ? 'line-through' : 'none' }}>{s.time_slot || ''}</span>
                            <span style={{ marginLeft: 4, textDecoration: cancelled ? 'line-through' : 'none' }}>{s.title}</span>
                            {s.target_school && <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}> ({s.target_school})</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        )}
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <span onClick={() => navigate('/admin/schedules')} style={{
            fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500,
          }}>관리 →</span>
        </div>
      </div>

      {/* 시험 일정 */}
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>📝 시험 일정</h3>
        {upcomingExams.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '8px 0', margin: 0 }}>
            예정된 시험이 없습니다
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingExams.map(e => (
              <div key={e.id} onClick={() => navigate('/admin/scores')} style={{
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                background: isToday(e.exam_date) ? '#fef3c7' : '#f8fafc',
                border: isToday(e.exam_date) ? '1px solid #f59e0b' : '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday(e.exam_date) ? '#92400e' : 'var(--foreground)' }}>
                  {isToday(e.exam_date) ? '오늘' : formatDate(e.exam_date)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--foreground)', marginTop: 2 }}>
                  {e.name}
                  {e.school && <span style={{ color: 'var(--muted-foreground)', marginLeft: 4, fontSize: 11 }}>({e.school})</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <span onClick={() => navigate('/admin/scores')} style={{
            fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500,
          }}>관리 →</span>
        </div>
      </div>
    </div>
  );

  // 모바일 최상단 클리닉 카드
  const renderMobileClinicTop = () => (
    <div className="dashboard-clinic-mobile-top" style={{ display: 'none' }}>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>🩺 클리닉 일정</h3>
          {clinicCount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: '#fef3c7', color: '#92400e'
            }}>대기 {clinicCount}</span>
          )}
        </div>
        {upcomingClinic.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '8px 0', margin: 0 }}>
            예정된 클리닉이 없습니다
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingClinic.map(a => {
              const st = STATUS_STYLE[a.status] || STATUS_STYLE.pending;
              return (
                <div key={a.id} onClick={() => navigate('/admin/clinic')} style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: isToday(a.appointment_date) ? '#eff6ff' : '#f8fafc',
                  border: isToday(a.appointment_date) ? '1px solid #93c5fd' : '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isToday(a.appointment_date) ? '#2563eb' : 'var(--foreground)' }}>
                      {isToday(a.appointment_date) ? '오늘' : formatDate(a.appointment_date)} {a.time_slot}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6,
                      background: st.bg, color: st.color
                    }}>{st.text}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--foreground)' }}>
                    <span style={{ fontWeight: 600 }}>{a.student_name}</span>
                    <span style={{ color: 'var(--muted-foreground)', marginLeft: 4, fontSize: 11 }}>{a.topic}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <span onClick={() => navigate('/admin/clinic')} style={{
            fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500,
          }}>관리 →</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="content">
      {showPwModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowPwModal(false)}>
          <div className="card" style={{ width: 340, maxWidth: '90vw', padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>🔒 비밀번호 변경</h3>
            {pwMsg && <div className="alert" style={{ marginBottom: 12, padding: '8px 12px', background: pwMsg.includes('변경되었습니다') ? '#dcfce7' : '#fef2f2', borderRadius: 8, fontSize: 13 }}>{pwMsg}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="password" placeholder="현재 비밀번호" value={pwForm.currentPassword}
                onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} />
              <input type="password" placeholder="새 비밀번호 (4자 이상)" value={pwForm.newPassword}
                onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} />
              <input type="password" placeholder="새 비밀번호 확인" value={pwForm.confirmPassword}
                onChange={e => setPwForm({...pwForm, confirmPassword: e.target.value})} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleChangePassword}>변경</button>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowPwModal(false)}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4, letterSpacing: '-0.025em' }}>
          {MAIN_TITLE}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 0 }}>{SITE_TITLE}</p>
      </div>

      {/* 모바일: 클리닉 일정 최상단 */}
      {renderMobileClinicTop()}

      {/* 메인 레이아웃: 메뉴 70% + 일정 30% */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

        {/* 왼쪽: 메뉴 (70%) */}
        <div className="dashboard-menu-area" style={{ flex: '0 0 68%', minWidth: 0 }}>

          {/* 1. 메인 화면 - 전체 현황 */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>🏠</span> 전체 현황
            </h3>
            {/* 알림 배지 */}
            {(pendingCount > 0 || qnaCount > 0 || clinicCount > 0 || editRequestCount > 0 || reviewCount > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {pendingCount > 0 && (
                  <span onClick={() => navigate('/admin/pending')} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#fee2e2', color: '#991b1b' }}>
                    🔴 가입 대기 {pendingCount}건
                  </span>
                )}
                {qnaCount > 0 && (
                  <span onClick={() => navigate('/admin/qna')} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#fef3c7', color: '#92400e' }}>
                    🟡 미답변 질문 {qnaCount}건
                  </span>
                )}
                {clinicCount > 0 && (
                  <span onClick={() => navigate('/admin/clinic')} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#dbeafe', color: '#1d4ed8' }}>
                    🔵 클리닉 대기 {clinicCount}건
                  </span>
                )}
                {editRequestCount > 0 && (
                  <span onClick={() => navigate('/admin/edit-requests')} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#e0e7ff', color: '#3730a3' }}>
                    🟣 정보 수정 {editRequestCount}건
                  </span>
                )}
                {reviewCount > 0 && (
                  <span onClick={() => navigate('/admin/reviews')} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#dcfce7', color: '#166534' }}>
                    🟢 후기 대기 {reviewCount}건
                  </span>
                )}
              </div>
            )}
            {/* 총원 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'linear-gradient(135deg, #eff6ff, #dbeafe)' }}>
              <span style={{ fontSize: 15 }}>👥</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>총원 {Object.values(schoolCounts).reduce((a, b) => a + b, 0)}명</span>
            </div>
            {/* 학교별 현황 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
              {SCHOOLS.map((s) => (
                <div key={s.name} onClick={() => navigate(`/admin/school/${encodeURIComponent(s.name)}`)}
                  style={{
                    padding: '10px 8px', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                    background: '#f8fafc', border: '1px solid var(--border)', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{schoolCounts[s.name] || 0}명</div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. 수업 및 연구소 운영 */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>📚</span> 수업 및 연구소 운영
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => navigate('/admin/schedules')}>
                📅 수업 일정 관리
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/scores')}>
                📊 시험 성적 관리
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/clinic')} style={{ position: 'relative' }}>
                🩺 클리닉 관리
                {clinicCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    background: 'var(--destructive)', color: 'white',
                    borderRadius: '9999px', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600
                  }}>{clinicCount}</span>
                )}
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/ta-schedule')}>
                📋 조교 근무표
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/homework')}>
                📝 과제 관리
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/reports')}>
                📄 수업 레포트
              </button>
            </div>
          </div>

          {/* 3. 소통 및 승인 */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>💬</span> 소통 및 승인
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => navigate('/admin/pending')} style={{ position: 'relative' }}>
                ✅ 가입 승인
                {pendingCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    background: 'var(--destructive)', color: 'white',
                    borderRadius: '9999px', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600
                  }}>{pendingCount}</span>
                )}
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/qna')} style={{ position: 'relative' }}>
                ❓ 질문 관리
                {qnaCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    background: 'var(--destructive)', color: 'white',
                    borderRadius: '9999px', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600
                  }}>{qnaCount}</span>
                )}
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/sms')}>
                💬 문자 발송
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/edit-requests')} style={{ position: 'relative' }}>
                ✏️ 정보 수정 요청
                {editRequestCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    background: 'var(--destructive)', color: 'white',
                    borderRadius: '9999px', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600
                  }}>{editRequestCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* 4. 학습 및 콘텐츠 관리 */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>📖</span> 학습 및 콘텐츠 관리
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => navigate('/admin/notices')}>
                📢 안내사항 관리
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/reviews')} style={{ position: 'relative' }}>
                ⭐ 후기 관리
                {reviewCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    background: 'var(--destructive)', color: 'white',
                    borderRadius: '9999px', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600
                  }}>{reviewCount}</span>
                )}
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/hall-of-fame')}>
                🏆 '강인한 국어' 명예의 전당
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/admin/gamification')}>
                🎮 게임 관리
              </button>
            </div>
          </div>

          {/* 5. 시스템 설정 */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>⚙️</span> 시스템 설정
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => navigate('/student')}>
                👀 학생 페이지 보기
              </button>
              <button className="btn btn-outline" onClick={() => setShowPwModal(true)}>
                🔒 비밀번호 변경
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 일정 패널 (30%) - 데스크탑 */}
        <div className="dashboard-schedule-desktop" style={{ flex: '0 0 30%', position: 'sticky', top: 68 }}>
          {renderSchedulePanel()}
        </div>
      </div>

      {/* 모바일: 수업 일정 + 시험 일정 (클리닉은 최상단에 별도 표시) */}
      <div className="dashboard-schedule-mobile-bottom" style={{ display: 'none', flexDirection: 'column', gap: 12 }}>
        {/* 수업 일정 */}
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>📚 이번 주 수업</h3>
          {upcomingClasses.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '8px 0', margin: 0 }}>
              이번 주 수업이 없습니다
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(() => {
                const grouped = {};
                upcomingClasses.forEach(s => {
                  if (!grouped[s.schedule_date]) grouped[s.schedule_date] = [];
                  grouped[s.schedule_date].push(s);
                });
                return Object.keys(grouped).sort().map(date => {
                  const items = grouped[date];
                  const isTodayDate = isToday(date);
                  return (
                    <div key={date}>
                      <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 0', color: isTodayDate ? '#2563eb' : 'var(--muted-foreground)' }}>
                        {isTodayDate ? '오늘' : formatDate(date)}
                      </div>
                      {items.map(s => {
                        const cancelled = s.status === 'cancelled';
                        return (
                          <div key={s.id} onClick={() => navigate('/admin/schedules')} style={{
                            padding: '4px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                            borderLeft: `3px solid ${cancelled ? '#d1d5db' : (s.color || '#3b82f6')}`,
                            background: cancelled ? '#fef2f2' : isTodayDate ? '#f0fdf4' : '#f8fafc',
                            opacity: cancelled ? 0.6 : 1,
                          }}>
                            <div style={{ fontSize: 11 }}>
                              {cancelled && <span style={{ color: '#ef4444', fontWeight: 700, marginRight: 2 }}>휴강</span>}
                              <span style={{ fontWeight: 600, textDecoration: cancelled ? 'line-through' : 'none' }}>{s.time_slot || ''}</span>
                              <span style={{ marginLeft: 4, textDecoration: cancelled ? 'line-through' : 'none' }}>{s.title}</span>
                              {s.target_school && <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}> ({s.target_school})</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <span onClick={() => navigate('/admin/schedules')} style={{ fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>관리 →</span>
          </div>
        </div>
        {/* 시험 일정 */}
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>📝 시험 일정</h3>
          {upcomingExams.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '8px 0', margin: 0 }}>
              예정된 시험이 없습니다
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcomingExams.map(e => (
                <div key={e.id} onClick={() => navigate('/admin/scores')} style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: isToday(e.exam_date) ? '#fef3c7' : '#f8fafc',
                  border: isToday(e.exam_date) ? '1px solid #f59e0b' : '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isToday(e.exam_date) ? '#92400e' : 'var(--foreground)' }}>
                    {isToday(e.exam_date) ? '오늘' : formatDate(e.exam_date)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--foreground)', marginTop: 2 }}>
                    {e.name}
                    {e.school && <span style={{ color: 'var(--muted-foreground)', marginLeft: 4, fontSize: 11 }}>({e.school})</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <span onClick={() => navigate('/admin/scores')} style={{ fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 500 }}>관리 →</span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-menu-area { flex: 1 !important; }
          .dashboard-schedule-desktop { display: none !important; }
          .dashboard-clinic-mobile-top { display: block !important; }
          .dashboard-schedule-mobile-bottom { display: flex !important; }
        }
        .btn-outline {
          transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
        }
        .btn-outline:hover {
          background: var(--primary) !important;
          color: white !important;
          border-color: var(--primary) !important;
        }
        .btn-outline:active {
          background: #1d4ed8 !important;
          color: white !important;
          border-color: #1d4ed8 !important;
          transform: scale(0.97);
        }
      `}</style>
    </div>
  );
}
