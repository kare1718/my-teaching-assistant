import { useState, useEffect } from 'react';
import { api } from '../../../api';

export default function StudyTimerStatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api('/study-timer/admin/study-stats')
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatHM = (sec) => {
    if (!sec || sec <= 0) return '0분';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0 && m > 0) return `${h}시간 ${m}분`;
    if (h > 0) return `${h}시간`;
    return `${m}분`;
  };

  if (loading) return <p style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>로딩 중...</p>;
  if (!stats) return <p style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>데이터를 불러올 수 없습니다.</p>;

  return (
    <div>
      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={{ padding: 16, borderRadius: 12, background: 'var(--success-light)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--success)', marginBottom: 4 }}>현재 활성</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--success)' }}>{stats.active_sessions}명</div>
        </div>
        <div style={{ padding: 16, borderRadius: 12, background: 'var(--info-light)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--info)', marginBottom: 4 }}>주간 총 공부</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--info)' }}>{formatHM(stats.week_total)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{stats.week_students}명 참여</div>
        </div>
        <div style={{ padding: 16, borderRadius: 12, background: 'var(--warning-light)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--warning)', marginBottom: 4 }}>월간 총 공부</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)' }}>{formatHM(stats.month_total)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{stats.month_students}명 참여</div>
        </div>
      </div>

      {/* 오늘 학생별 공부시간 */}
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>오늘 학생별 공부시간</h3>
      {stats.today && stats.today.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>순위</th>
                <th>학생</th>
                <th>학교</th>
                <th>공부 시간</th>
                <th>세션 수</th>
              </tr>
            </thead>
            <tbody>
              {stats.today.map((s, i) => (
                <tr key={s.user_id}>
                  <td style={{ fontWeight: 700, textAlign: 'center' }}>
                    {i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}위`}
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.nickname || s.name}</td>
                  <td>{s.school} {s.grade}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatHM(s.total_seconds)}</td>
                  <td>{s.sessions}회</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted-foreground)', fontSize: 13 }}>
          오늘 공부 기록이 없습니다
        </div>
      )}
    </div>
  );
}
