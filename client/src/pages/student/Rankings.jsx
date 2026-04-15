import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { getUser } from '../../api';
import { getLevelInfo, getStageInfo } from '../../utils/gamification';
import AvatarSVG from '../../components/AvatarSVG';
import BottomTabBar from '../../components/BottomTabBar';
import { useTenantConfig } from '../../contexts/TenantContext';

const TABS = [
  { key: 'all', label: '🏆 전체', desc: '역대 누적 XP' },
  { key: 'weekly', label: '📅 주간', desc: '이번 주 획득 XP' },
  { key: 'monthly', label: '📆 월간', desc: '이번 달 획득 XP' },
  { key: 'school', label: '🏫 학교별', desc: '우리 학교 랭킹' },
];

export default function Rankings() {
  const navigate = useNavigate();
  const { config } = useTenantConfig();
  const subject = config.subject;
  const [tab, setTab] = useState('all');
  const [rankings, setRankings] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [myInfo, setMyInfo] = useState(null);
  const [extra, setExtra] = useState({});
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const user = getUser();
  const isAdmin = user?.role === 'admin';

  const fetchRankings = useCallback((type, school) => {
    setLoading(true);
    const schoolParam = type === 'school' && school ? `&school=${encodeURIComponent(school)}` : '';
    api(`/gamification/rankings?type=${type}${schoolParam}`).then(data => {
      setRankings((data.rankings || []).slice(0, 100));
      setMyRank(data.myRank);
      setMyInfo(data.myInfo || null);
      setExtra({ since: data.since, school: data.school, type: data.type });
      if (data.schools) setSchools(data.schools);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRankings(tab, selectedSchool); }, [tab, selectedSchool, fetchRankings]);

  const handleTab = (key) => { setTab(key); };

  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  const xpLabel = tab === 'all' ? 'XP' : tab === 'weekly' ? '주간 XP' : tab === 'monthly' ? '월간 XP' : '획득 XP';

  // 기간 표시 텍스트
  const getPeriodLabel = () => {
    if (!extra.since) return null;
    const d = new Date(extra.since);
    const now = new Date();
    const fmt = (d) => `${d.getMonth()+1}/${d.getDate()}`;
    if (tab === 'weekly') return `${fmt(d)}(금) ~ ${fmt(now)}(오늘)`;
    if (tab === 'monthly') return `${d.getMonth()+1}월 1일 ~ ${fmt(now)}(오늘)`;
    return null;
  };

  const RankRow = ({ r, highlight }) => {
    const totalXp = tab === 'all' ? r.xp : (r.totalXp || r.xp || 0);
    const lvl = getLevelInfo(totalXp);
    const stage = getStageInfo(lvl.level, subject);
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: highlight ? 'linear-gradient(135deg, var(--info-light), var(--info-light))' : 'transparent',
        borderRadius: highlight ? 10 : 0,
        border: highlight ? '2px solid var(--primary)' : 'none'
      }}>
        <div style={{
          width: 28, fontWeight: 700, fontSize: 14, textAlign: 'center',
          color: r.rank <= 3 ? 'var(--warning)' : 'var(--muted-foreground)'
        }}>
          {r.rank <= 3 ? getRankEmoji(r.rank) : r.rank}
        </div>
        <div style={{ fontSize: 24 }}>
          <AvatarSVG config={r.avatarConfig || {}} size={32} rankingBadge={r.rankingBadge} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{r.displayName || r.name}</span>
            <span style={{ color: stage.color, fontWeight: 700, fontSize: 11 }}>Lv.{lvl.level}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: stage.color, fontWeight: 600 }}>{stage.label}</span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
              {r.realName}{r.school ? `-${r.school}` : ''}{r.grade ? ` ${r.grade}` : ''}
            </span>
            {r.rankingBadge && r.rankingBadge.title && new Date(r.rankingBadge.expires) > new Date() && (
              <span style={{
                color: 'oklch(32% 0.12 260)', background: 'linear-gradient(135deg, var(--info-light), oklch(72% 0.10 260))',
                fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 6
              }}>{r.rankingBadge.medal === 'gold' ? '👑' : r.rankingBadge.medal === 'silver' ? '🥈' : '🥉'} {r.rankingBadge.title}</span>
            )}
            {r.title_name && (
              <span style={{
                color: 'oklch(30% 0.10 75)', background: 'linear-gradient(135deg, oklch(92% 0.10 90), oklch(80% 0.14 85))',
                fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 6
              }}>{r.title_icon} {r.title_name}</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
            {(r.xp || 0).toLocaleString()} XP
          </div>
          {tab !== 'all' && (
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>
              {tab === 'weekly' ? '이번 주' : '이번 달'} 획득
            </div>
          )}
        </div>
      </div>
    );
  };

  const tabInfo = TABS.find(t => t.key === tab);
  const myRankInList = myRank && myRank <= 100;

  // 보상 사이드 패널
  const RewardPanel = () => {
    if (tab !== 'weekly' && tab !== 'monthly') return null;
    const isWeekly = tab === 'weekly';
    return (
      <div style={{
        background: 'linear-gradient(180deg, var(--info-light), var(--info-light))', borderRadius: 'var(--radius)',
        border: '1px solid oklch(72% 0.10 260)', padding: 12, fontSize: 11, lineHeight: 1.9,
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 6, textAlign: 'center' }}>
          🎁 {isWeekly ? '주간' : '월간'} 보상
        </div>
        <div style={{ color: 'var(--foreground)' }}>
          {isWeekly ? (
            <>
              <div>🥇 <b>+500P</b></div>
              <div>🥈 <b>+300P</b></div>
              <div>🥉 <b>+200P</b></div>
              <div>4~10위 <b>+100P</b></div>
            </>
          ) : (
            <>
              <div>🥇 <b>+1000P</b></div>
              <div>🥈 <b>+600P</b></div>
              <div>🥉 <b>+400P</b></div>
              <div>4~10위 <b>+200P</b></div>
            </>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 6, textAlign: 'center' }}>
          💡 {isWeekly ? '매주 금요일' : '매달 1일'} 지급
        </div>
      </div>
    );
  };

  const showRewardPanel = tab === 'weekly' || tab === 'monthly';

  return (
    <div className="content s-page" style={{ paddingBottom: 96 }}>
      {/* 헤더 */}
      <div className="card" style={{ padding: 20, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>🏆 랭킹</h2>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{tabInfo?.desc}</p>
        {tab === 'school' && isAdmin && schools.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
              <option value="">학교 선택</option>
              {schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {extra.school && tab === 'school' && (
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
            🏫 {extra.school}
          </div>
        )}
        {/* 주간/월간 기간 표시 */}
        {getPeriodLabel() && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
            padding: '4px 12px', borderRadius: 10,
            background: tab === 'weekly' ? 'var(--info-light)' : 'var(--success-light)',
            border: `1px solid ${tab === 'weekly' ? 'oklch(72% 0.10 260)' : 'oklch(72% 0.12 155)'}`,
          }}>
            <span style={{ fontSize: 11, color: tab === 'weekly' ? 'oklch(38% 0.14 260)' : 'oklch(38% 0.10 150)', fontWeight: 700 }}>
              {tab === 'weekly' ? '📅 이번 주' : '📆 이번 달'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {getPeriodLabel()}
            </span>
          </div>
        )}
        {myRank && (
          <div style={{
            display: 'inline-block', marginTop: 8, padding: '6px 16px',
            background: 'linear-gradient(135deg, var(--info), oklch(48% 0.18 260))',
            color: 'white', borderRadius: 12, fontWeight: 600, fontSize: 14
          }}>
            내 순위: {myRank}위
          </div>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => handleTab(t.key)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 12,
            background: tab === t.key ? 'var(--primary)' : 'var(--muted)',
            color: tab === t.key ? 'white' : 'var(--foreground)',
            transition: 'all 0.2s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* 보상 안내 - 모바일: 탭 바로 아래 */}
      {showRewardPanel && (
        <div className="reward-mobile-panel" style={{ display: 'none', marginBottom: 8 }}>
          <RewardPanel />
        </div>
      )}

      {/* 메인 레이아웃: 랭킹 + 보상(데스크탑만) */}
      <div className="ranking-layout" style={{
        display: showRewardPanel ? 'flex' : 'block',
        gap: 12, alignItems: 'flex-start',
      }}>
        {/* 랭킹 영역 */}
        <div className="ranking-main" style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)' }}>로딩 중...</div>
          ) : (
            <>
              {/* Top 3 - 올림픽 시상대 */}
              {rankings.length >= 3 && (
                <div className="card" style={{ padding: '20px 12px 0', margin: '0 0 8px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 6, marginBottom: 0 }}>
                    {[1, 0, 2].map(idx => {
                      const r = rankings[idx];
                      if (!r) return null;
                      const totalXp = tab === 'all' ? r.xp : (r.totalXp || r.xp || 0);
                      const lvl = getLevelInfo(totalXp);
                      const stage = getStageInfo(lvl.level, subject);
                      const isFirst = idx === 0;
                      const isSecond = idx === 1;
                      const avatarSize = isFirst ? 60 : isSecond ? 46 : 38;
                      const emojiSize = isFirst ? 36 : isSecond ? 28 : 22;
                      const nameSize = isFirst ? 14 : isSecond ? 12 : 11;
                      return (
                        <div key={r.rank} style={{
                          flex: 1, textAlign: 'center', maxWidth: 130,
                          marginBottom: isFirst ? 8 : 0,
                        }}>
                          <div style={{
                            fontSize: emojiSize,
                            filter: isFirst ? 'drop-shadow(0 0 8px rgba(251,191,36,0.6))' : 'none',
                            animation: isFirst ? 'medalGlow 2s ease-in-out infinite' : 'none'
                          }}>
                            {getRankEmoji(r.rank)}
                          </div>
                          <div style={{
                            marginTop: 2,
                            animation: isFirst ? 'float 3s ease-in-out infinite' : 'none'
                          }}>
                            <AvatarSVG config={r.avatarConfig || {}} size={avatarSize} rankingBadge={r.rankingBadge} />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: nameSize, marginTop: 4 }}>{r.displayName || r.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>
                            {r.realName}{r.school ? `-${r.school}` : ''}{r.grade ? ` ${r.grade}` : ''}
                          </div>
                          {r.title_name && (
                            <div style={{
                              display: 'inline-block', fontSize: 8, color: 'oklch(30% 0.10 75)',
                              background: 'linear-gradient(135deg, oklch(92% 0.10 90), oklch(80% 0.14 85))',
                              padding: '1px 5px', borderRadius: 4, fontWeight: 600, marginTop: 2
                            }}>{r.title_icon} {r.title_name}</div>
                          )}
                          <div style={{ fontSize: 10, color: stage.color, fontWeight: 600, marginTop: 2 }}>
                            Lv.{lvl.level} {stage.label}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>
                            {(r.xp || 0).toLocaleString()} XP
                          </div>
                          {tab !== 'all' && (
                            <div style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>
                              {tab === 'weekly' ? '이번 주' : '이번 달'} 획득
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 시상대 단 */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 0, marginTop: 8 }}>
                    <div style={{
                      flex: 1, height: 55, maxWidth: 130,
                      background: 'linear-gradient(180deg, var(--border), oklch(80% 0.01 250))',
                      borderRadius: '8px 0 0 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: 22, color: 'var(--neutral-400)',
                      boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.1)',
                      borderTop: '3px solid oklch(80% 0.01 250)',
                    }}>2</div>
                    <div style={{
                      flex: 1, height: 90, maxWidth: 130,
                      background: 'linear-gradient(180deg, oklch(92% 0.10 90), oklch(80% 0.14 85), var(--warning))',
                      borderRadius: '8px 8px 0 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: 28, color: 'oklch(35% 0.12 75)',
                      boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.1), 0 -4px 12px rgba(251,191,36,0.3)',
                      borderTop: '3px solid oklch(80% 0.14 85)',
                    }}>1</div>
                    <div style={{
                      flex: 1, height: 38, maxWidth: 130,
                      background: 'linear-gradient(180deg, oklch(85% 0.08 55), oklch(65% 0.16 45))',
                      borderRadius: '0 8px 0 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: 18, color: 'oklch(38% 0.12 40)',
                      boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.1)',
                      borderTop: '3px solid oklch(60% 0.10 55)',
                    }}>3</div>
                  </div>
                </div>
              )}

              <style>{`
                @keyframes medalGlow {
                  0%, 100% { filter: drop-shadow(0 0 6px rgba(251,191,36,0.4)); }
                  50% { filter: drop-shadow(0 0 14px rgba(251,191,36,0.8)); }
                }
                @keyframes float {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-4px); }
                }
                @keyframes rankGlow {
                  0%, 100% { box-shadow: 0 0 8px rgba(251,191,36,0.4), inset 0 0 4px rgba(251,191,36,0.2); }
                  50% { box-shadow: 0 0 16px rgba(251,191,36,0.7), inset 0 0 8px rgba(251,191,36,0.4); }
                }
              `}</style>

              {/* 4~100위 리스트 */}
              {rankings.length > 3 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {rankings.slice(3).map((r, i) => (
                    <div key={r.rank} style={{
                      borderBottom: i < rankings.slice(3).length - 1 ? '1px solid var(--border)' : 'none'
                    }}>
                      <RankRow r={r} highlight={false} />
                    </div>
                  ))}
                </div>
              )}

              {rankings.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--muted-foreground)' }}>
                  {tab === 'weekly' ? '이번 주 아직 XP를 획득한 사람이 없습니다.' :
                   tab === 'monthly' ? '이번 달 아직 XP를 획득한 사람이 없습니다.' :
                   '아직 랭킹 데이터가 없습니다.'}
                </div>
              )}

              {/* 내 순위 */}
              {myInfo && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6, paddingLeft: 4 }}>
                    내 순위
                  </div>
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <RankRow r={myInfo} highlight={true} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 보상 사이드 패널 (데스크탑: 오른쪽) */}
        {showRewardPanel && (
          <div style={{ flex: '0 0 180px', position: 'sticky', top: 68 }} className="reward-side-panel">
            <RewardPanel />
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .reward-side-panel { display: none !important; }
          .reward-mobile-panel { display: block !important; }
          .ranking-layout { display: block !important; }
        }
      `}</style>

      <button className="btn btn-outline" onClick={() => navigate('/student/game')}
        style={{ width: '100%', marginTop: 8 }}>← 게임 홈</button>
      <BottomTabBar />
    </div>
  );
}
