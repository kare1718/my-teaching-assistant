import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';

const OverviewTab = lazy(() => import('./StudentTabs/OverviewTab'));
const TimelineTab = lazy(() => import('./StudentTabs/TimelineTab'));
const ClassesTab = lazy(() => import('./StudentTabs/ClassesTab'));
const ConsultationTab = lazy(() => import('./StudentTabs/ConsultationTab'));
const TuitionTab = lazy(() => import('./StudentTabs/TuitionTab'));
const StudyTab = lazy(() => import('./StudentTabs/StudyTab'));
const ParentsTab = lazy(() => import('./StudentTabs/ParentsTab'));
const RewardTab = lazy(() => import('./StudentTabs/RewardTab'));

const TabFallback = () => <div className="text-sm text-slate-400 py-8 text-center">로딩 중...</div>;

/* ─── StatusBadge ─── */
function StatusBadge({ status }) {
  const isActive = status === 'active' || !status;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold ${
      isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {isActive ? '재원' : '퇴원'}
    </span>
  );
}

/* ─── Material Icon helper ─── */
function Icon({ name, className = '', filled = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Sidebar Cards (실데이터)                                   */
/* ═══════════════════════════════════════════════════════════ */
function SidebarNextSchedule({ studentId }) {
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    let cancel = false;
    api(`/admin/students/${studentId}/next-schedule`)
      .then(d => { if (!cancel) setSessions(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancel) setSessions([]); });
    return () => { cancel = true; };
  }, [studentId]);

  const fmt = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    return {
      month: dt.toLocaleDateString('ko-KR', { month: 'short' }),
      day: dt.getDate(),
    };
  };

  return (
    <section className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-[#102044]">다음 일정</h4>
        <Icon name="event" className="text-slate-400 text-sm" />
      </div>
      {sessions === null ? (
        <div className="text-xs text-slate-400 py-3">로딩 중...</div>
      ) : sessions.length === 0 ? (
        <div className="text-xs text-slate-400 py-3 text-center">예정된 일정이 없습니다</div>
      ) : (
        <div className="space-y-4">
          {sessions.slice(0, 3).map((s, i) => {
            const d = fmt(s.date);
            return (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center justify-center w-12 h-12 bg-[#f3f4f5] rounded-lg flex-shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{d?.month}</span>
                  <span className="text-lg font-extrabold text-[#102044] leading-none">{d?.day}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#102044] truncate">{s.class_name || '수업'}</p>
                  <p className="text-xs text-slate-500">{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SidebarOpenTasks({ studentId }) {
  const [tasks, setTasks] = useState(null);

  useEffect(() => {
    let cancel = false;
    api(`/admin/students/${studentId}/open-tasks`)
      .then(d => { if (!cancel) setTasks(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancel) setTasks([]); });
    return () => { cancel = true; };
  }, [studentId]);

  const priorityCls = (p) => {
    if (p === 'urgent') return 'bg-red-100 text-red-700';
    if (p === 'high') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-200 text-slate-600';
  };

  return (
    <section className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
      <h4 className="font-bold text-[#102044] mb-4">미해결 업무</h4>
      {tasks === null ? (
        <div className="text-xs text-slate-400 py-3">로딩 중...</div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
            <Icon name="check_circle" className="text-2xl" filled />
          </div>
          <p className="text-sm font-bold text-slate-600">미해결 업무 없음</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.slice(0, 5).map(t => (
            <div key={t.id} className="p-3 rounded-lg bg-[#f8f9fa] border border-slate-100">
              <div className="flex justify-between items-start gap-2">
                <div className="text-xs font-bold text-[#102044] flex-1 min-w-0 truncate">{t.title}</div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityCls(t.priority)}`}>
                  {t.priority === 'urgent' ? '긴급' : t.priority === 'high' ? '높음' : '보통'}
                </span>
              </div>
              {t.due_date && (
                <div className="text-[10px] text-slate-400 font-semibold mt-1">
                  마감 {new Date(t.due_date).toLocaleDateString('ko-KR')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SidebarAlerts({ student = {}, overview }) {
  const alerts = [];
  if (student?.status === 'inactive') alerts.push({ text: '퇴원 상태입니다', severity: 'high' });
  if (student?.blocked) alerts.push({ text: '접속이 차단된 상태입니다', severity: 'high' });
  if (overview?.consecutiveAbsent >= 2) alerts.push({ text: `${overview.consecutiveAbsent}회 연속 결석`, severity: 'high' });
  if (overview?.tuition?.overdueCount > 0) alerts.push({ text: `${overview.tuition.overdueCount}건 미납`, severity: 'high' });

  if (alerts.length === 0) return null;

  return (
    <section className="bg-white rounded-xl p-6 border-2 border-amber-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="warning" className="text-amber-500" filled />
        <h4 className="font-bold text-amber-900">위험 알림</h4>
      </div>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-amber-800">{a.text}</p>
            <span className="bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full text-[10px] font-black flex-shrink-0">
              확인 필요
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Main Component                                            */
/* ═══════════════════════════════════════════════════════════ */
export default function AdminStudentView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showNoteForm, setShowNoteForm] = useState(false);

  let hasFeature;
  try { hasFeature = useTenantConfig()?.hasFeature; } catch { hasFeature = undefined; }

  useEffect(() => {
    api(`/admin/students/${id}/view-data`).then(setData).catch(console.error);
    api(`/admin/students/${id}/overview`).then(setOverview).catch(() => setOverview(null));
  }, [id]);

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400 text-sm">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-[#e7e8e9] border-t-[#102044] rounded-full animate-spin mx-auto mb-3" />
          로딩 중...
        </div>
      </div>
    );
  }

  const { student = {} } = data || {};
  if (!id) return null;

  const tabs = [
    { key: 'overview', label: '개요' },
    { key: 'timeline', label: '타임라인' },
    { key: 'classes', label: '수업' },
    { key: 'consultation', label: '상담' },
    { key: 'tuition', label: '수납' },
    { key: 'study', label: '학습' },
    { key: 'parents', label: '보호자' },
    { key: 'reward', label: '리워드' },
  ];

  const att = overview?.attendance;
  const attRate = att?.rate != null ? `${att.rate}%` : '-';
  const overdue = overview?.tuition?.overdueCount || 0;
  const lastConsultText = overview?.lastConsultation?.created_at
    ? new Date(overview.lastConsultation.created_at).toLocaleDateString('ko-KR')
    : '-';

  return (
    <div className="bg-[#f8f9fa] min-h-screen p-4 md:p-8 pb-20 max-w-7xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-6 font-medium">
        <Link to="/admin" className="text-slate-400 hover:text-[#102044] transition-colors no-underline">대시보드</Link>
        <span className="opacity-50">/</span>
        <Link to={`/admin/student/${id}`} className="text-slate-400 hover:text-[#102044] transition-colors no-underline">{student.name} 관리</Link>
        <span className="opacity-50">/</span>
        <span className="text-[#102044] font-semibold">학생 상세</span>
      </div>

      {/* 12-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column (col-span-8) ── */}
        <div className="lg:col-span-8 space-y-6 min-w-0">

          {/* 1. Summary Card */}
          <section className="bg-white rounded-xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex gap-6">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-[#102044] to-[#004bf0] flex items-center justify-center text-white text-3xl font-extrabold flex-shrink-0">
                  {student.name?.charAt(0) || '?'}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-extrabold text-[#102044] tracking-tight">{student.name}</h3>
                    <StatusBadge status={student.status} />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">{student.school || '-'} {student.grade || ''}</p>
                  <div className="flex gap-4 mt-2">
                    <div className="text-sm">
                      <span className="text-slate-400">출석:</span>{' '}
                      <span className="font-semibold text-[#004bf0]">{attRate}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-400">미납:</span>{' '}
                      <span className={`font-semibold ${overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {overdue > 0 ? `${overdue}건` : '없음'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">마지막 상담</span>
                <p className="text-lg font-bold text-[#102044]">{lastConsultText}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
              <button className="flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-200 text-[#102044] font-bold hover:bg-[#f3f4f5] transition-colors">
                <Icon name="how_to_reg" className="text-[20px]" />
                <span className="text-sm">출결 입력</span>
              </button>
              <button className="flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-200 text-[#102044] font-bold hover:bg-[#f3f4f5] transition-colors">
                <Icon name="send_to_mobile" className="text-[20px]" />
                <span className="text-sm">메시지 발송</span>
              </button>
              <button className="flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-200 text-[#102044] font-bold hover:bg-[#f3f4f5] transition-colors">
                <Icon name="edit_note" className="text-[20px]" />
                <span className="text-sm">상담 기록</span>
              </button>
              <button className="flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-200 text-[#102044] font-bold hover:bg-[#f3f4f5] transition-colors">
                <Icon name="credit_score" className="text-[20px]" />
                <span className="text-sm">수납 처리</span>
              </button>
            </div>
          </section>

          {/* 2. Tab Navigation */}
          <div className="sticky top-16 bg-[#f8f9fa] z-30 pt-2">
            <div className="flex gap-8 border-b border-[#e7e8e9] overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`pb-4 text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.key
                      ? 'text-[#102044] font-bold border-b-2 border-[#102044]'
                      : 'text-slate-500 font-medium hover:text-[#102044]'
                  }`}
                  style={{ marginBottom: -1 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Tab Content */}
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'overview' && <OverviewTab studentId={id} />}
            {activeTab === 'timeline' && (
              <TimelineTab studentId={id} showNoteForm={showNoteForm} setShowNoteForm={setShowNoteForm} />
            )}
            {activeTab === 'classes' && <ClassesTab studentId={id} />}
            {activeTab === 'consultation' && <ConsultationTab studentId={id} />}
            {activeTab === 'tuition' && <TuitionTab studentId={id} />}
            {activeTab === 'study' && <StudyTab studentId={id} />}
            {activeTab === 'parents' && <ParentsTab studentId={id} student={student} />}
            {activeTab === 'reward' && <RewardTab studentId={id} hasFeature={hasFeature} />}
          </Suspense>
        </div>

        {/* ── Right Sidebar (col-span-4) ── */}
        <aside className="lg:col-span-4 min-w-0">
          <div className="sticky top-24 space-y-6">
            <SidebarNextSchedule studentId={id} />
            <SidebarOpenTasks studentId={id} />
            <SidebarAlerts student={student} overview={overview} />
          </div>
        </aside>
      </div>

      {/* FAB - Add Note */}
      <button
        onClick={() => {
          setActiveTab('timeline');
          setShowNoteForm(true);
          window.scrollTo({ top: 400, behavior: 'smooth' });
        }}
        className="fixed bottom-10 right-10 flex items-center gap-3 bg-[#102044] text-white px-6 py-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all z-50 font-bold"
      >
        <Icon name="add" />
        <span>메모 추가</span>
      </button>
    </div>
  );
}
