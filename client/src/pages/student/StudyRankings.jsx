import { useState, useEffect } from 'react';
import { api, getUser } from '../../api';
import AvatarSVG from '../../components/AvatarSVG';
import BottomTabBar from '../../components/BottomTabBar';
import { SkeletonPage, EmptyState } from '../../components/StudentStates';

const TABS = [
  { key: 'today', label: '오늘' },
  { key: 'weekly', label: '이번 주' },
  { key: 'monthly', label: '이번 달' },
];

const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return '0분';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
};

const formatTimeShort = (seconds) => {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const MEDAL_COLORS = ['oklch(85% 0.16 90)', 'oklch(80% 0.01 250)', 'oklch(60% 0.10 55)'];
const PODIUM_BG = [
  'linear-gradient(135deg, oklch(80% 0.12 85) 0%, oklch(90% 0.08 85) 100%)',
  'linear-gradient(135deg, oklch(78% 0.01 250) 0%, oklch(90% 0.005 250) 100%)',
  'linear-gradient(135deg, oklch(65% 0.10 55) 0%, oklch(78% 0.08 55) 100%)',
];

export default function StudyRankings() {
  const user = getUser();
  const [tab, setTab] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStudents, setActiveStudents] = useState([]);

  useEffect(() => {
    setLoading(true);
    api(`/study-timer/rankings?type=${tab}`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tab]);

  // 활성 학생 폴링
  useEffect(() => {
    const fetchActive = () => {
      api('/study-timer/sessions/active').then(d => setActiveStudents(d.sessions || [])).catch(() => {});
    };
    fetchActive();
    const interval = setInterval(fetchActive, 20000);
    return () => clearInterval(interval);
  }, []);

  const rankings = data?.rankings || [];
  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);
  const myRank = data?.myRank;
  const myInfo = data?.myInfo;

  return (
    <div className="content s-page">
      <div className="s-section-title" style={{ fontSize: 18 }}>공부 랭킹</div>

      {/* 현재 공부 중 섹션 */}
      {activeStudents.length > 0 && (
        <div style={{
          marginBottom: 'var(--space-4)', padding: 14, borderRadius: 14,
          background: 'var(--card)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--foreground)' }}>
            🟢 현재 공부 중 <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{activeStudents.length}명</span>
          </div>
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            paddingBottom: 4, WebkitOverflowScrolling: 'touch',
          }}>
            {activeStudents.map(s => {
              const isMe = s.user_id === user?.id;
              const studyHours = (s.today_total_seconds || 0) / 3600;
              return (
                <div key={s.id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  minWidth: 72, padding: '8px 6px', borderRadius: 10,
                  background: isMe ? 'var(--accent-lighter)' : 'var(--neutral-50)',
                  border: isMe ? '2px solid var(--accent)' : '1px solid transparent',
                  flexShrink: 0,
                }}>
                  <AvatarSVG
                    config={s.avatar_config || {}}
                    size={38}
                    studyStatus={s.is_paused ? 'paused' : 'active'}
                    studyHours={studyHours}
                  />
                  <div style={{
                    fontSize: 10, fontWeight: 700, marginTop: 4,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: 68, textAlign: 'center', color: 'var(--warm-800)',
                  }}>
                    {s.nickname || s.name}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 800, marginTop: 2,
                    color: s.is_paused ? 'var(--muted-foreground)' : 'var(--accent)',
                    fontFamily: 'monospace',
                  }}>
                    {formatTimeShort(s.today_total_seconds)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="s-tab-pills" style={{ marginBottom: 'var(--space-4)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`s-tab-pill${tab === t.key ? ' active' : ''}`}
            style={{ flex: 1, textAlign: 'center' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonPage />}

      {!loading && rankings.length === 0 && (
        <EmptyState message="아직 공부 기록이 없어요. 타이머로 공부를 시작해보세요!" />
      )}

      {!loading && rankings.length > 0 && (
        <>
          {/* 시상대 Top 3 */}
          {top3.length >= 2 && (
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              gap: 8, marginBottom: 'var(--space-4)', padding: 'var(--space-3) 0',
            }}>
              {[1, 0, 2].map(idx => {
                const r = top3[idx];
                if (!r) return <div key={idx} style={{ width: 90 }} />;
                const isFirst = idx === 0;
                const podiumH = isFirst ? 90 : idx === 1 ? 70 : 55;
                // 활성 학생인지 확인
                const activeInfo = activeStudents.find(a => a.user_id === r.user_id);
                const studyStatus = activeInfo ? (activeInfo.is_paused ? 'paused' : 'active') : null;
                const studyHours = activeInfo ? (activeInfo.today_total_seconds || 0) / 3600 : 0;
                return (
                  <div key={r.user_id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: isFirst ? 100 : 85 }}>
                    <div style={{ position: 'relative', marginBottom: 6 }}>
                      <AvatarSVG
                        config={r.avatar_config || {}}
                        size={isFirst ? 52 : 40}
                        studyStatus={studyStatus}
                        studyHours={studyHours}
                      />
                      <div style={{
                        position: 'absolute', bottom: -4, right: -4,
                        width: 20, height: 20, borderRadius: '50%',
                        background: MEDAL_COLORS[idx], color: 'white',
                        fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'var(--shadow-warm-xs)',
                      }}>{r.rank}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', color: 'var(--warm-800)' }}>
                      {r.nickname || r.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--warm-500)' }}>{r.school}</div>
                    <div style={{
                      width: '100%', height: podiumH,
                      background: PODIUM_BG[idx], borderRadius: 'var(--radius-card) var(--radius-card) 0 0',
                      marginTop: 6, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', padding: 'var(--space-2)',
                    }}>
                      <div style={{ fontSize: isFirst ? 16 : 14, fontWeight: 800, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                        {formatTimeShort(r.total_seconds)}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{r.sessions}회</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 내 순위 카드 */}
          {myRank && myInfo && (
            <div className="s-hero" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-3)',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, minWidth: 36, textAlign: 'center' }}>
                {myRank <= 3 ? ['🥇','🥈','🥉'][myRank-1] : `${myRank}위`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>내 공부시간</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{myInfo.sessions}회 공부</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {formatTime(myInfo.total_seconds)}
              </div>
            </div>
          )}

          {/* 4위~ 리스트 */}
          {rest.length > 0 && (
            <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
              {rest.map((r, i) => {
                const isMe = r.user_id === user?.id;
                const activeInfo = activeStudents.find(a => a.user_id === r.user_id);
                const studyStatus = activeInfo ? (activeInfo.is_paused ? 'paused' : 'active') : null;
                const studyHours = activeInfo ? (activeInfo.today_total_seconds || 0) / 3600 : 0;
                return (
                  <div key={r.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px var(--space-4)',
                    background: isMe ? 'var(--accent-lighter)' : (i % 2 === 0 ? 'transparent' : 'var(--warm-50)'),
                    borderBottom: i < rest.length - 1 ? '1px solid var(--warm-100)' : 'none',
                  }}>
                    <div style={{ width: 28, fontWeight: 700, fontSize: 13, textAlign: 'center', color: 'var(--warm-400)' }}>
                      {r.rank}
                    </div>
                    <AvatarSVG
                      config={r.avatar_config || {}}
                      size={30}
                      studyStatus={studyStatus}
                      studyHours={studyHours}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--warm-800)' }}>
                        {r.nickname || r.name}
                        {activeInfo && (
                          <span style={{
                            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                            background: activeInfo.is_paused ? 'var(--neutral-400)' : 'var(--success)',
                            marginLeft: 4, verticalAlign: 'middle',
                          }} />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--warm-500)' }}>{r.school} {r.grade}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{formatTime(r.total_seconds)}</div>
                      <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>{r.sessions}회</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <BottomTabBar />
    </div>
  );
}
