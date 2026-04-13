import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';

// 이벤트 타입별 아이콘/색상/라벨
const EVENT_CONFIG = {
  attendance:     { icon: '\u2705', color: '#10B981', label: '출석' },
  absence:        { icon: '\u274C', color: '#EF4444', label: '결석' },
  late:           { icon: '\u23F0', color: '#F59E0B', label: '지각' },
  consultation:   { icon: '\uD83D\uDCAC', color: '#8B5CF6', label: '상담' },
  tuition_billed: { icon: '\uD83D\uDCCB', color: '#3B82F6', label: '청구' },
  tuition_paid:   { icon: '\uD83D\uDCB0', color: '#10B981', label: '납부' },
  tuition_overdue:{ icon: '\uD83D\uDD34', color: '#EF4444', label: '미납' },
  exam_score:     { icon: '\uD83D\uDCCA', color: '#F97316', label: '성적' },
  note:           { icon: '\uD83D\uDCDD', color: '#6B7280', label: '메모' },
  status_change:  { icon: '\uD83D\uDD04', color: '#6366F1', label: '상태' },
  class_enrolled: { icon: '\uD83D\uDCDA', color: '#0EA5E9', label: '수강등록' },
  class_dropped:  { icon: '\uD83D\uDEAB', color: '#F43F5E', label: '수강취소' },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_CONFIG);

function TimelineTab({ studentId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDesc, setNoteDesc] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);

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
    return `${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <div>
      {/* 필터 칩 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        <button
          onClick={() => setFilter('')}
          style={{
            padding: '4px 12px', borderRadius: 16, border: '1px solid var(--border)',
            background: !filter ? 'var(--primary)' : 'var(--card)', color: !filter ? '#fff' : 'var(--foreground)',
            fontSize: 12, cursor: 'pointer', fontWeight: !filter ? 600 : 400,
          }}
        >
          전체
        </button>
        {ALL_EVENT_TYPES.map(type => {
          const cfg = EVENT_CONFIG[type];
          const isActive = filter === type;
          return (
            <button
              key={type}
              onClick={() => setFilter(isActive ? '' : type)}
              style={{
                padding: '4px 12px', borderRadius: 16, border: `1px solid ${isActive ? cfg.color : 'var(--border)'}`,
                background: isActive ? cfg.color : 'var(--card)', color: isActive ? '#fff' : 'var(--foreground)',
                fontSize: 12, cursor: 'pointer', fontWeight: isActive ? 600 : 400,
              }}
            >
              {cfg.icon} {cfg.label}
            </button>
          );
        })}
      </div>

      {/* 메모 추가 버튼 */}
      <div style={{ marginBottom: 16 }}>
        {!showNoteForm ? (
          <button
            onClick={() => setShowNoteForm(true)}
            className="btn btn-primary"
            style={{ fontSize: 13, padding: '6px 16px' }}
          >
            + 메모 추가
          </button>
        ) : (
          <div className="card" style={{ padding: 16 }}>
            <input
              type="text"
              placeholder="메모 제목"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              style={{ width: '100%', marginBottom: 8, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13 }}
            />
            <textarea
              placeholder="상세 내용 (선택)"
              value={noteDesc}
              onChange={(e) => setNoteDesc(e.target.value)}
              rows={3}
              style={{ width: '100%', marginBottom: 8, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAddNote} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 16px' }}>
                저장
              </button>
              <button onClick={() => { setShowNoteForm(false); setNoteTitle(''); setNoteDesc(''); }} className="btn" style={{ fontSize: 13, padding: '6px 16px' }}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 타임라인 리스트 */}
      {loading ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>로딩 중...</p>
      ) : events.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>이벤트가 없습니다.</p>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          {/* 타임라인 라인 */}
          <div style={{
            position: 'absolute', left: 11, top: 0, bottom: 0, width: 2,
            background: 'var(--border)', zIndex: 0,
          }} />

          {events.map((evt) => {
            const cfg = EVENT_CONFIG[evt.event_type] || { icon: '\u2139\uFE0F', color: '#9CA3AF', label: evt.event_type };
            return (
              <div
                key={evt.id}
                style={{
                  position: 'relative', marginBottom: 12, paddingLeft: 20,
                  opacity: evt.is_pinned ? 1 : 0.95,
                }}
              >
                {/* 점 */}
                <div style={{
                  position: 'absolute', left: -14, top: 6, width: 12, height: 12,
                  borderRadius: '50%', background: cfg.color, border: '2px solid var(--card)',
                  zIndex: 1,
                }} />

                <div
                  className="card"
                  style={{
                    padding: '10px 14px',
                    borderLeft: evt.is_pinned ? `3px solid ${cfg.color}` : 'none',
                    background: evt.is_pinned ? 'var(--accent)' : 'var(--card)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: cfg.color,
                          background: `${cfg.color}18`, padding: '1px 6px', borderRadius: 8,
                        }}>
                          {cfg.label}
                        </span>
                        {evt.is_pinned && (
                          <span style={{ fontSize: 10, color: 'var(--warning)' }}>\uD83D\uDCCC</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>
                          {formatDate(evt.event_date)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                        {evt.title}
                      </div>
                      {evt.description && (
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                          {evt.description.length > 100 ? evt.description.slice(0, 100) + '...' : evt.description}
                        </div>
                      )}
                      {evt.created_by_name && (
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                          by {evt.created_by_name}
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => handleTogglePin(evt.id)}
                        title={evt.is_pinned ? '핀 해제' : '중요 표시'}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                          opacity: evt.is_pinned ? 1 : 0.4, padding: 2,
                        }}
                      >
                        {'\uD83D\uDCCC'}
                      </button>
                      {evt.event_type === 'note' && (
                        <button
                          onClick={() => handleDeleteNote(evt.id)}
                          title="삭제"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                            opacity: 0.4, padding: 2,
                          }}
                        >
                          {'\uD83D\uDDD1\uFE0F'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminStudentView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');

  useEffect(() => {
    api(`/admin/students/${id}/view-data`).then(setData).catch(console.error);
  }, [id]);

  if (!data) return <div className="content"><p style={{ color: 'var(--muted-foreground)' }}>로딩 중...</p></div>;

  const { student, notices, scores } = data;

  const tabs = [
    { key: 'timeline', label: '\uD83D\uDCC5 타임라인' },
    { key: 'info', label: '\uD83D\uDC64 기본정보' },
  ];

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt;{' '}
        <Link to={`/admin/student/${id}`}>{student.name} 관리</Link> &gt;{' '}
        <span>학생 페이지 미리보기</span>
      </div>

      <div style={{
        background: 'var(--warning)', color: 'oklch(35% 0.12 75)', padding: '8px 16px',
        borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        {'\uD83D\uDC41\uFE0F'} 관리자 미리보기 모드 — 학생에게 보이는 화면입니다
      </div>

      <div className="greeting-card">
        <h2>{student.name}님 안녕하세요!</h2>
        <p>언제나 선생님이 응원합니다.</p>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? 'var(--card)' : 'transparent',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--muted-foreground)',
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontSize: 14,
              borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'timeline' && (
        <TimelineTab studentId={id} />
      )}

      {activeTab === 'info' && (
        <>
          <div className="card floating-card">
            <h2>내 정보</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div className="stat-card floating-card"><span className="stat-label">이름</span><span className="stat-value" style={{ fontSize: 16 }}>{student.name}</span></div>
              <div className="stat-card floating-card"><span className="stat-label">학교</span><span className="stat-value" style={{ fontSize: 16 }}>{student.school}</span></div>
              <div className="stat-card floating-card"><span className="stat-label">학년</span><span className="stat-value" style={{ fontSize: 16 }}>{student.grade}</span></div>
              <div className="stat-card floating-card"><span className="stat-label">연락처</span><span className="stat-value" style={{ fontSize: 14 }}>{student.phone || '-'}</span></div>
              <div className="stat-card floating-card"><span className="stat-label">학부모</span><span className="stat-value" style={{ fontSize: 14 }}>{student.parent_name || '-'}</span></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card floating-card">
              <h2>최근 안내사항</h2>
              {notices.length === 0 ? <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>안내사항이 없습니다.</p> :
                notices.map((n) => (
                  <div key={n.id} className="notice-card">
                    <div className="notice-title">{n.title}</div>
                    <div className="notice-date">{n.created_at}</div>
                  </div>
                ))}
            </div>
            <div className="card floating-card">
              <h2>최근 성적</h2>
              {scores.length === 0 ? <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>등록된 성적이 없습니다.</p> : (
                <table><thead><tr><th>시험</th><th>점수</th></tr></thead><tbody>
                  {scores.map((s, i) => (<tr key={i}><td>{s.exam_name}</td><td style={{ fontWeight: 600 }}>{s.score}점</td></tr>))}
                </tbody></table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
