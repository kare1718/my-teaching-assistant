import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';

/* ─── Event Config ─── */
const EVENT_CONFIG = {
  attendance:      { icon: 'how_to_reg',    dotColor: 'bg-emerald-500', label: '출석' },
  absence:         { icon: 'cancel',        dotColor: 'bg-red-500',     label: '결석' },
  late:            { icon: 'schedule',       dotColor: 'bg-amber-500',   label: '지각' },
  consultation:    { icon: 'edit_note',      dotColor: 'bg-purple-500',  label: '상담' },
  tuition_billed:  { icon: 'receipt_long',   dotColor: 'bg-[#004bf0]',   label: '청구' },
  tuition_paid:    { icon: 'payments',       dotColor: 'bg-emerald-500', label: '납부' },
  tuition_overdue: { icon: 'warning',        dotColor: 'bg-red-500',     label: '미납' },
  exam_score:      { icon: 'analytics',      dotColor: 'bg-orange-500',  label: '성적' },
  note:            { icon: 'sticky_note_2',  dotColor: 'bg-slate-400',   label: '메모' },
  status_change:   { icon: 'swap_horiz',     dotColor: 'bg-indigo-500',  label: '상태' },
  class_enrolled:  { icon: 'menu_book',      dotColor: 'bg-sky-500',     label: '수강등록' },
  class_dropped:   { icon: 'block',          dotColor: 'bg-rose-500',    label: '수강취소' },
};

const FILTER_GROUPS = [
  { key: '', label: '전체' },
  { key: 'attendance', label: '출결' },
  { key: 'consultation', label: '상담' },
  { key: 'tuition_billed', label: '수납' },
  { key: 'exam_score', label: '성적' },
  { key: 'note', label: '메모' },
];

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
/*  TimelineTab                                               */
/* ═══════════════════════════════════════════════════════════ */
function TimelineTab({ studentId, showNoteForm, setShowNoteForm }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDesc, setNoteDesc] = useState('');

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const qs = filter ? `&eventTypes=${filter}` : '';
      const data = await api(`/timeline/student/${studentId}?limit=50${qs}`);
      setEvents(data);
    } catch (e) {
      console.error('타임라인 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [studentId, filter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleAddNote = async () => {
    if (!noteTitle.trim()) return;
    try {
      await apiPost(`/timeline/student/${studentId}/note`, { title: noteTitle.trim(), description: noteDesc.trim() || null });
      setNoteTitle('');
      setNoteDesc('');
      setShowNoteForm(false);
      fetchEvents();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleTogglePin = async (eventId) => {
    try {
      await apiPut(`/timeline/events/${eventId}/pin`);
      fetchEvents();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteNote = async (eventId) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/timeline/events/${eventId}`);
      fetchEvents();
    } catch (e) {
      alert(e.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}월 ${day}일 ${hours}:${minutes}`;
  };

  const formatDateGroup = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  const groupedEvents = events.reduce((acc, evt) => {
    const dateKey = evt.event_date ? new Date(evt.event_date).toDateString() : 'unknown';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(evt);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Filters + Date Range */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_GROUPS.map(fg => (
            <button
              key={fg.key}
              onClick={() => setFilter(fg.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                filter === fg.key
                  ? 'bg-[#102044] text-white'
                  : 'bg-[#f3f4f5] text-slate-500 hover:bg-slate-200'
              }`}
            >
              {fg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Note Form */}
      {showNoteForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">새 메모 작성</div>
          <input
            type="text"
            placeholder="메모 제목"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 text-sm mb-3 outline-none"
          />
          <textarea
            placeholder="상세 내용 (선택)"
            value={noteDesc}
            onChange={(e) => setNoteDesc(e.target.value)}
            rows={3}
            className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 text-sm mb-4 resize-y outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={handleAddNote}
              className="px-6 py-2.5 bg-[#102044] text-white font-bold rounded-lg text-sm hover:bg-[#1a2d5a] transition-colors"
            >
              저장
            </button>
            <button
              onClick={() => { setShowNoteForm(false); setNoteTitle(''); setNoteDesc(''); }}
              className="px-6 py-2.5 border border-slate-200 text-[#102044] font-bold rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Timeline List */}
      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">로딩 중...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Icon name="event_note" className="text-5xl opacity-50 mb-2" />
          <div className="text-sm font-semibold">이벤트가 없습니다</div>
          <div className="text-sm mt-1">타임라인에 기록된 활동이 없습니다.</div>
        </div>
      ) : (
        <div className="relative pl-8 space-y-10">
          {/* Vertical Timeline Line */}
          <div className="absolute left-3.5 top-0 bottom-0 w-[2px] bg-[#e7e8e9]" />

          {Object.entries(groupedEvents).map(([dateKey, dateEvents]) => (
            <div key={dateKey}>
              {/* Date Group Label */}
              <div className="text-xs font-bold text-slate-400 mb-3 pl-1">
                {formatDateGroup(dateEvents[0]?.event_date)}
              </div>

              <div className="space-y-4">
                {dateEvents.map((evt) => {
                  const cfg = EVENT_CONFIG[evt.event_type] || { icon: 'info', dotColor: 'bg-slate-400', label: evt.event_type };
                  const isAbsence = evt.event_type === 'absence' || evt.event_type === 'tuition_overdue';
                  const isPinnedNote = evt.is_pinned && evt.event_type === 'note';

                  let cardClasses = 'bg-white rounded-xl p-5 border border-slate-100';
                  if (isAbsence) cardClasses = 'bg-red-50 rounded-xl p-5 border border-red-100';
                  if (isPinnedNote) cardClasses = 'bg-amber-50 rounded-xl p-5 border border-amber-200';

                  return (
                    <div key={evt.id} className="relative pl-6">
                      {/* Dot */}
                      <div className={`absolute -left-[27px] w-4 h-4 rounded-full ${cfg.dotColor} ring-4 ring-[#f8f9fa]`} />

                      {/* Event Card */}
                      <div className={`${cardClasses} max-w-2xl`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-slate-400">{formatDate(evt.event_date)}</span>
                            </div>
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-[#102044]">{evt.title}</h4>
                              {evt.is_pinned && (
                                <Icon name="push_pin" className="text-sm text-amber-600" filled />
                              )}
                            </div>
                            {evt.description && (
                              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {evt.description.length > 150 ? evt.description.slice(0, 150) + '...' : evt.description}
                              </p>
                            )}
                            {evt.created_by_name && (
                              <div className="text-xs text-slate-400 font-semibold mt-2">
                                by {evt.created_by_name}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleTogglePin(evt.id)}
                              title={evt.is_pinned ? '핀 해제' : '중요 표시'}
                              className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors ${
                                evt.is_pinned ? 'opacity-100' : 'opacity-30 hover:opacity-100'
                              }`}
                            >
                              <Icon name="push_pin" className="text-base" filled={evt.is_pinned} />
                            </button>
                            {evt.event_type === 'note' && (
                              <button
                                onClick={() => handleDeleteNote(evt.id)}
                                title="삭제"
                                className="w-8 h-8 flex items-center justify-center rounded-md opacity-30 hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                              >
                                <Icon name="delete" className="text-base" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  InfoTab                                                   */
/* ═══════════════════════════════════════════════════════════ */
function InfoTab({ student, notices, scores }) {
  const infoFields = [
    { label: '이름', value: student.name },
    { label: '학교', value: student.school || '-' },
    { label: '학년', value: student.grade || '-' },
    { label: '연락처', value: student.phone || '-' },
    { label: '학부모', value: student.parent_name || '-' },
    { label: '학부모 연락처', value: student.parent_phone || '-' },
  ];

  return (
    <div className="space-y-6">
      {/* Personal Info Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">기본 정보</div>
        <h3 className="text-lg font-extrabold text-[#102044] tracking-tight mt-1 mb-5">개인 정보</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {infoFields.map(f => (
            <div key={f.label} className="p-4 rounded-lg bg-[#f8f9fa]">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{f.label}</div>
              <div className="text-sm font-semibold text-[#102044]">{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notices & Scores Grid */}
      <div className="grid grid-cols-2 gap-5">
        {/* Notices */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">안내</div>
          <h3 className="text-lg font-extrabold text-[#102044] tracking-tight mt-1 mb-4">최근 안내사항</h3>
          {notices.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">안내사항이 없습니다.</div>
          ) : (
            <div className="space-y-2.5">
              {notices.map(n => (
                <div key={n.id} className="p-3 rounded-lg bg-[#f8f9fa] border border-slate-100">
                  <div className="text-sm font-semibold text-[#102044] mb-0.5">{n.title}</div>
                  <div className="text-xs text-slate-400 font-semibold">
                    {n.created_at ? new Date(n.created_at).toLocaleDateString('ko-KR') : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scores */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">성적</div>
          <h3 className="text-lg font-extrabold text-[#102044] tracking-tight mt-1 mb-4">최근 성적</h3>
          {scores.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">등록된 성적이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {scores.map((s, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-[#f8f9fa] border border-slate-100">
                  <span className="text-sm font-semibold text-[#102044]">{s.exam_name}</span>
                  <span className="text-sm font-extrabold text-[#004bf0] bg-[#004bf0]/10 px-2.5 py-0.5 rounded-full">
                    {s.score}점
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Sidebar Cards                                             */
/* ═══════════════════════════════════════════════════════════ */
function SidebarNextSchedule() {
  return (
    <section className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-[#102044]">다음 일정</h4>
        <Icon name="more_horiz" className="text-slate-400 text-sm" />
      </div>
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex flex-col items-center justify-center w-12 h-12 bg-[#f3f4f5] rounded-lg">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {new Date().toLocaleDateString('ko-KR', { month: 'short' })}
            </span>
            <span className="text-lg font-extrabold text-[#102044] leading-none">
              {new Date().getDate()}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#102044]">정규 수업</p>
            <p className="text-xs text-slate-500">오후 3:00 - 5:00</p>
          </div>
        </div>
      </div>
      <button className="w-full mt-6 py-2 bg-[#e7e8e9] rounded-lg text-xs font-bold text-[#102044] hover:bg-slate-200 transition-colors">
        전체 일정 보기
      </button>
    </section>
  );
}

function SidebarOpenTasks() {
  return (
    <section className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
      <h4 className="font-bold text-[#102044] mb-4">미해결 업무</h4>
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
          <Icon name="check_circle" className="text-2xl" filled />
        </div>
        <p className="text-sm font-bold text-slate-600">미해결 업무 없음</p>
      </div>
    </section>
  );
}

function SidebarAlerts({ student }) {
  const alerts = [];
  if (student.status === 'inactive') {
    alerts.push({ text: '퇴원 상태입니다', severity: 'high' });
  }
  if (student.blocked) {
    alerts.push({ text: '접속이 차단된 상태입니다', severity: 'high' });
  }

  if (alerts.length === 0) return null;

  return (
    <section className="bg-white rounded-xl p-6 border-2 border-amber-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="warning" className="text-amber-500" filled />
        <h4 className="font-bold text-amber-900">위험 알림</h4>
      </div>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-800">{a.text}</p>
            <span className="bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full text-[10px] font-black">
              ACTION NEEDED
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
  const [activeTab, setActiveTab] = useState('timeline');
  const [showNoteForm, setShowNoteForm] = useState(false);

  useEffect(() => {
    api(`/admin/students/${id}/view-data`).then(setData).catch(console.error);
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

  const { student, notices, scores } = data;

  const tabs = [
    { key: 'timeline', label: '타임라인' },
    { key: 'info', label: '기본정보' },
    { key: 'classes', label: '수업' },
    { key: 'attendance', label: '출결' },
    { key: 'consultation', label: '상담' },
    { key: 'tuition', label: '수납' },
    { key: 'scores', label: '성적' },
    { key: 'portfolio', label: '포트폴리오' },
  ];

  return (
    <div className="bg-[#f8f9fa] min-h-screen p-8 pb-20">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-6 font-medium">
        <Link to="/admin" className="text-slate-400 hover:text-[#102044] transition-colors no-underline">대시보드</Link>
        <span className="opacity-50">/</span>
        <Link to={`/admin/student/${id}`} className="text-slate-400 hover:text-[#102044] transition-colors no-underline">{student.name} 관리</Link>
        <span className="opacity-50">/</span>
        <span className="text-[#102044] font-semibold">학생 상세</span>
      </div>

      {/* 12-Column Grid Layout */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* ── Left Column (col-span-8) ── */}
        <div className="col-span-8 space-y-6">

          {/* 1. Summary Card */}
          <section className="bg-white rounded-xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex gap-6">
                {/* Avatar */}
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
                      <span className="text-slate-400">소속:</span>{' '}
                      <span className="font-semibold">-</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-400">출석:</span>{' '}
                      <span className="font-semibold text-[#004bf0]">-</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-400">수납:</span>{' '}
                      <span className="font-semibold text-emerald-600">-</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">마지막 상담</span>
                <p className="text-lg font-bold text-[#102044]">-</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-3 mt-8">
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
          {activeTab === 'timeline' && (
            <TimelineTab studentId={id} showNoteForm={showNoteForm} setShowNoteForm={setShowNoteForm} />
          )}

          {activeTab === 'info' && (
            <InfoTab student={student} notices={notices} scores={scores} />
          )}

          {/* Placeholder for future tabs */}
          {!['timeline', 'info'].includes(activeTab) && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
              <Icon name="construction" className="text-4xl mb-2 block" />
              <p className="text-sm font-semibold">준비 중입니다</p>
            </div>
          )}
        </div>

        {/* ── Right Sidebar (col-span-4) ── */}
        <aside className="col-span-4">
          <div className="sticky top-24 space-y-6">
            <SidebarNextSchedule />
            <SidebarOpenTasks />
            <SidebarAlerts student={student} />
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
