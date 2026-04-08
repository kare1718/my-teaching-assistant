import { useState, useEffect } from 'react';
import { api, apiPost } from '../../../api';

export default function StudyTimerActiveTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api('/study-timer/admin/sessions')
      .then(d => { setSessions(d.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  const handleForceEnd = async (id) => {
    if (!confirm('이 세션을 강제 종료하시겠습니까?')) return;
    try {
      await apiPost(`/study-timer/admin/sessions/${id}/end`);
      load();
    } catch (e) { alert('실패: ' + (e.message || '오류')); }
  };

  const formatDuration = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>현재 활성 세션</h3>
        <button className="btn btn-outline btn-sm" onClick={load}>🔄 새로고침</button>
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>로딩 중...</p>}

      {!loading && sessions.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)' }}>
          현재 공부 중인 학생이 없습니다
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>학생</th>
                <th>학교</th>
                <th>과목</th>
                <th>모드</th>
                <th>공부 시간</th>
                <th>상태</th>
                <th>마지막 응답</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{
                  background: s.suspicious ? 'rgba(239,68,68,0.08)' : 'transparent',
                }}>
                  <td style={{ fontWeight: 600 }}>
                    {s.nickname || s.name}
                    {s.suspicious && <span style={{ color: 'var(--destructive)', fontSize: 11, marginLeft: 4 }}>⚠️</span>}
                  </td>
                  <td>{s.school} {s.grade}</td>
                  <td>{s.subject}</td>
                  <td>{s.timer_type === 'countdown' ? '⏰' : '⏱️'}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatDuration(s.current_seconds)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: s.is_paused ? 'var(--warning-light)' : 'var(--success-light)',
                      color: s.is_paused ? 'var(--warning)' : 'var(--success)',
                    }}>{s.is_paused ? '일시정지' : '공부 중'}</span>
                  </td>
                  <td style={{ fontSize: 11, color: s.last_heartbeat_ago > 60 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                    {s.last_heartbeat_ago}초 전
                  </td>
                  <td>
                    <button onClick={() => handleForceEnd(s.id)} className="btn btn-sm"
                      style={{ background: 'var(--destructive)', color: '#fff', fontSize: 11 }}>
                      강제 종료
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'var(--info-light)', fontSize: 12, color: 'var(--info)' }}>
        💡 ⚠️ 표시: 6시간 이상 연속 공부 (의심 세션). 하트비트 90초 초과 시 서버가 자동 종료합니다.
      </div>
    </div>
  );
}
