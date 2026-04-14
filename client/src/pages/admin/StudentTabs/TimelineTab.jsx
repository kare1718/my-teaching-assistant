import { useState, useEffect, useCallback } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../../api';
import { Icon } from './_shared';

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

export default function TimelineTab({ studentId, showNoteForm, setShowNoteForm }) {
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
    } catch (e) { alert(e.message); }
  };

  const handleTogglePin = async (eventId) => {
    try { await apiPut(`/timeline/events/${eventId}/pin`); fetchEvents(); }
    catch (e) { alert(e.message); }
  };

  const handleDeleteNote = async (eventId) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    try { await apiDelete(`/timeline/events/${eventId}`); fetchEvents(); }
    catch (e) { alert(e.message); }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_GROUPS.map(fg => (
            <button
              key={fg.key}
              onClick={() => setFilter(fg.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                filter === fg.key ? 'bg-[#102044] text-white' : 'bg-[#f3f4f5] text-slate-500 hover:bg-slate-200'
              }`}
            >
              {fg.label}
            </button>
          ))}
        </div>
      </div>

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
            <button onClick={handleAddNote} className="px-6 py-2.5 bg-[#102044] text-white font-bold rounded-lg text-sm hover:bg-[#1a2d5a] transition-colors">저장</button>
            <button onClick={() => { setShowNoteForm(false); setNoteTitle(''); setNoteDesc(''); }} className="px-6 py-2.5 border border-slate-200 text-[#102044] font-bold rounded-lg text-sm hover:bg-slate-50 transition-colors">취소</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">로딩 중...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Icon name="event_note" className="text-5xl opacity-50 mb-2" />
          <div className="text-sm font-semibold">이벤트가 없습니다</div>
        </div>
      ) : (
        <div className="relative pl-8 space-y-10">
          <div className="absolute left-3.5 top-0 bottom-0 w-[2px] bg-[#e7e8e9]" />
          {Object.entries(groupedEvents).map(([dateKey, dateEvents]) => (
            <div key={dateKey}>
              <div className="text-xs font-bold text-slate-400 mb-3 pl-1">{formatDateGroup(dateEvents[0]?.event_date)}</div>
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
                      <div className={`absolute -left-[27px] w-4 h-4 rounded-full ${cfg.dotColor} ring-4 ring-[#f8f9fa]`} />
                      <div className={`${cardClasses} max-w-2xl`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-slate-400">{formatDate(evt.event_date)}</span>
                            </div>
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-[#102044]">{evt.title}</h4>
                              {evt.is_pinned && <Icon name="push_pin" className="text-sm text-amber-600" filled />}
                            </div>
                            {evt.description && (
                              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {evt.description.length > 150 ? evt.description.slice(0, 150) + '...' : evt.description}
                              </p>
                            )}
                            {evt.created_by_name && (
                              <div className="text-xs text-slate-400 font-semibold mt-2">by {evt.created_by_name}</div>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleTogglePin(evt.id)}
                              title={evt.is_pinned ? '핀 해제' : '중요 표시'}
                              className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors ${evt.is_pinned ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}
                            >
                              <Icon name="push_pin" className="text-base" filled={evt.is_pinned} />
                            </button>
                            {evt.event_type === 'note' && (
                              <button onClick={() => handleDeleteNote(evt.id)} title="삭제" className="w-8 h-8 flex items-center justify-center rounded-md opacity-30 hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all">
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
