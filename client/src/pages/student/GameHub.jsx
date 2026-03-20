import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut } from '../../api';
import AvatarSVG from '../../components/AvatarSVG';
import { getLevelInfo, getStageInfo, getXpPercent, getAllStages } from '../../utils/gamification';
import BottomTabBar from '../../components/BottomTabBar';
import { getUser } from '../../api';

export default function GameHub() {
  const navigate = useNavigate();
  const [charData, setCharData] = useState(null);
  const [myTitles, setMyTitles] = useState([]);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState(null);
  const [todayKnowledge, setTodayKnowledge] = useState(0);
  const [todayReading, setTodayReading] = useState(0);
  const [showTitleSelect, setShowTitleSelect] = useState(false);
  const [showStages, setShowStages] = useState(false);
  const [showAllTitles, setShowAllTitles] = useState(false);
  const [allTitles, setAllTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bonusMsg, setBonusMsg] = useState(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameMsg, setNicknameMsg] = useState(null);
  const [levelUpInfo, setLevelUpInfo] = useState(null);

  const load = () => {
    Promise.all([
      api('/gamification/my-character'),
      api('/gamification/my-titles'),
    ]).then(([c, titles]) => {
      setCharData(c);
      setMyTitles(titles);
      setLoading(false);
    }).catch(() => setLoading(false));
    api('/gamification/knowledge/today-count').then(d => setTodayKnowledge(d.count || 0)).catch(() => {});
    api('/gamification/reading/today-count').then(d => setTodayReading(d.count || 0)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleDailyBonus = async () => {
    setBonusMsg(null);
    try {
      const result = await apiPost('/gamification/daily-bonus', {});
      setBonusMsg({ type: 'success', text: `🎁 +${result.xpEarned} XP 출석 보상 획득!` });
      if (result.leveledUp) setLevelUpInfo({ level: result.newLevel });
      load();
    } catch (e) {
      setBonusMsg({ type: 'error', text: e.message });
    }
  };

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setCodeMsg(null);
    try {
      const result = await apiPost('/gamification/redeem', { code: code.trim().toUpperCase() });
      setCodeMsg({ type: 'success', text: `+${result.xpEarned} XP 획득! (레벨 ${result.newLevel})` });
      setCode('');
      if (result.leveledUp) setLevelUpInfo({ level: result.newLevel });
      load();
    } catch (e) {
      setCodeMsg({ type: 'error', text: e.message });
    }
  };

  const handleNickname = async () => {
    if (!nicknameInput.trim()) return;
    setNicknameMsg(null);
    try {
      await apiPut('/gamification/my-nickname', { nickname: nicknameInput.trim() });
      setNicknameMsg({ type: 'success', text: '닉네임이 변경되었습니다!' });
      setEditingNickname(false);
      load();
    } catch (e) {
      setNicknameMsg({ type: 'error', text: e.message });
    }
  };

  const handleTitleChange = async (titleId) => {
    try {
      await apiPut('/gamification/my-title', { titleId });
      setShowTitleSelect(false);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="content" style={{ textAlign: 'center', padding: 40 }}>로딩 중...</div>;
  if (!charData) return <div className="content" style={{ textAlign: 'center', padding: 40 }}>캐릭터 정보를 불러올 수 없습니다.</div>;

  const levelInfo = charData.levelInfo || getLevelInfo(charData.xp);
  const autoStage = getStageInfo(levelInfo.level);
  // 선택한 단계가 있으면 해당 단계 표시, 없으면 자동
  const selectedStageName = charData.selectedStage || '';
  const allStagesList = getAllStages();
  const selectedStageObj = selectedStageName ? allStagesList.find(s => s.stage === selectedStageName) : null;
  const stage = selectedStageObj ? { stage: selectedStageObj.stage, color: selectedStageObj.color, glow: 'star', label: selectedStageObj.label } : autoStage;
  const xpPct = getXpPercent(levelInfo);

  return (
    <div className="content" style={{ paddingBottom: 80 }}>
      {/* 캐릭터 카드 */}
      <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <div onClick={() => navigate('/student/avatar')} style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
          <AvatarSVG config={charData.avatarConfig || {}} size={90} />
          <div style={{
            position: 'absolute', bottom: -2, right: -2, zIndex: 10,
            background: 'var(--primary)', color: 'white', fontSize: 9,
            fontWeight: 700, padding: '2px 6px', borderRadius: 8
          }}>✏️ 꾸미기</div>
        </div>
        <div style={{ marginTop: 12 }}>
          {editingNickname ? (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
              <input
                value={nicknameInput}
                onChange={e => setNicknameInput(e.target.value)}
                placeholder="닉네임 (10자 이내)"
                maxLength={10}
                style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, width: 140, textAlign: 'center' }}
                onKeyDown={e => e.key === 'Enter' && handleNickname()}
                autoFocus
              />
              <button className="btn btn-primary" onClick={handleNickname} style={{ fontSize: 12, padding: '6px 10px' }}>확인</button>
              <button className="btn btn-outline" onClick={() => setEditingNickname(false)} style={{ fontSize: 12, padding: '6px 10px' }}>취소</button>
            </div>
          ) : (
            <div
              onClick={() => { setNicknameInput(charData.nickname || ''); setEditingNickname(true); setNicknameMsg(null); }}
              style={{ fontSize: 18, fontWeight: 700, cursor: 'pointer' }}
              title="클릭하여 닉네임 변경"
            >
              {charData.nickname || getUser()?.name || '닉네임 설정하기'}
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 4 }}>✏️</span>
            </div>
          )}
          {nicknameMsg && (
            <div style={{
              fontSize: 12, marginTop: 4, padding: '4px 10px', borderRadius: 6,
              background: nicknameMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: nicknameMsg.type === 'success' ? '#166534' : '#991b1b'
            }}>{nicknameMsg.text}</div>
          )}
          {!editingNickname && charData.nickname && (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {getUser()?.name}
            </div>
          )}
          {charData.titleName && (
            <div style={{
              display: 'inline-block', marginTop: 4,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              color: '#78350f', fontSize: 11, fontWeight: 600,
              padding: '2px 10px', borderRadius: 12
            }}>
              {charData.titleName}
            </div>
          )}
          <div
            onClick={(e) => { e.stopPropagation(); setShowStages(true); }}
            style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4, cursor: 'pointer', textDecoration: 'underline dotted' }}
          >
            {stage.label} 단계 ▸
          </div>
        </div>

        {/* XP 바 */}
        <div style={{ margin: '16px auto', maxWidth: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            <span>Lv.{levelInfo.level}</span>
            <span>{levelInfo.currentXp} / {levelInfo.xpForNext} XP</span>
          </div>
          <div style={{ height: 10, background: 'var(--muted)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${xpPct}%`,
              background: `linear-gradient(90deg, ${stage.color}, ${stage.color}cc)`,
              borderRadius: 5, transition: 'width 0.5s ease'
            }} />
          </div>
        </div>

        {/* 포인트 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{charData.xp.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>총 XP</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{charData.points.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>포인트</div>
          </div>
        </div>
      </div>

      {/* 주말 출석 보너스 */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>🎁 수업 출석 보너스</h3>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {!charData.isWeekend
                ? '📅 토/일 수업 시간에만 출석 가능!'
                : charData.dailyBonusClaimed
                  ? '✅ 이번 주말 출석 완료!'
                  : '수업에 출석하고 +20 XP를 받으세요!'}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleDailyBonus}
            disabled={charData.dailyBonusClaimed || !charData.isWeekend}
            style={{
              whiteSpace: 'nowrap', fontSize: 13,
              opacity: (charData.dailyBonusClaimed || !charData.isWeekend) ? 0.5 : 1
            }}
          >
            {charData.dailyBonusClaimed ? '출석 완료 ✓' : !charData.isWeekend ? '평일' : '출석'}
          </button>
        </div>
        {bonusMsg && (
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 13,
            background: bonusMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: bonusMsg.type === 'success' ? '#166534' : '#991b1b'
          }}>
            {bonusMsg.text}
          </div>
        )}
      </div>

      {/* 히든 코드 입력 */}
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>🔑 히든 코드 입력</h3>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10 }}>
          과제 제출, 성적 상승, 수업 참여 등으로 선생님에게 코드를 받을 수 있어요!
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="코드를 입력하세요"
            maxLength={10}
            style={{
              flex: 1, padding: '10px 12px', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 14, letterSpacing: 2, textAlign: 'center',
              fontWeight: 600, textTransform: 'uppercase'
            }}
            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
          />
          <button className="btn btn-primary" onClick={handleRedeem} style={{ whiteSpace: 'nowrap' }}>
            확인
          </button>
        </div>
        {codeMsg && (
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 13,
            background: codeMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: codeMsg.type === 'success' ? '#166534' : '#991b1b'
          }}>
            {codeMsg.text}
          </div>
        )}
      </div>

      {/* 메뉴 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button
          className="card"
          onClick={() => navigate('/student/quiz')}
          style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: 'none' }}
        >
          <div style={{ fontSize: 32 }}>📝</div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>어휘 퀴즈</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            오늘 {charData.todayQuizCount || 0}/{charData.dailyQuizLimit || 50}문제
          </div>
        </button>
        <button
          className="card"
          onClick={() => navigate('/student/knowledge-quiz')}
          style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: 'none' }}
        >
          <div style={{ fontSize: 32 }}>🧠</div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>지식 퀴즈</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            오늘 {todayKnowledge}/50문제
          </div>
        </button>
        <button
          className="card"
          onClick={() => navigate('/student/reading-quiz')}
          style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: 'none' }}
        >
          <div style={{ fontSize: 32 }}>📖</div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>비문학 독해</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            오늘 {todayReading}/5지문
          </div>
        </button>
        <button
          className="card"
          onClick={() => navigate('/student/rankings')}
          style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: 'none' }}
        >
          <div style={{ fontSize: 32 }}>🏆</div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>랭킹</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>전체 순위 확인!</div>
        </button>
        <button
          className="card"
          onClick={() => navigate('/student/shop')}
          style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: 'none' }}
        >
          <div style={{ fontSize: 32 }}>🛒</div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>상점</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>포인트로 구매!</div>
        </button>
        <button
          className="card"
          onClick={() => {
            api('/gamification/all-titles').then(setAllTitles).catch(() => {});
            setShowAllTitles(true);
          }}
          style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: 'none' }}
        >
          <div style={{ fontSize: 32 }}>🎖️</div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>칭호</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {myTitles.length > 0 ? `${myTitles.length}개 보유` : '조건 달성 시 획득'}
          </div>
        </button>
      </div>

      {/* 칭호 선택 모달 */}
      {showTitleSelect && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={() => setShowTitleSelect(false)}>
          <div className="card" style={{ maxWidth: 360, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 20 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>🎖️ 칭호 선택</h3>
            {myTitles.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 20 }}>
                아직 획득한 칭호가 없습니다.<br />퀴즈와 코드 입력으로 칭호를 획득하세요!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => handleTitleChange(null)}
                  style={{
                    padding: '10px 14px', border: !charData.selected_title_id ? '2px solid var(--primary)' : '1px solid var(--border)',
                    borderRadius: 10, background: 'var(--card)', cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>칭호 없음</span>
                </button>
                {myTitles.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTitleChange(t.id)}
                    style={{
                      padding: '10px 14px',
                      border: charData.selected_title_id === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: 10, background: 'var(--card)', cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{t.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{t.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button className="btn btn-outline" onClick={() => setShowTitleSelect(false)}
              style={{ width: '100%', marginTop: 12 }}>닫기</button>
          </div>
        </div>
      )}

      {/* 단계 정보 모달 */}
      {showStages && (() => {
        const stages = getAllStages();
        const currentAutoStage = getStageInfo(levelInfo.level);
        const displayedStage = stage; // 현재 표시 중인 단계
        const handleSelectStage = async (stageName) => {
          try {
            await apiPut('/gamification/my-stage', { stage: stageName });
            setCharData(prev => ({ ...prev, selectedStage: stageName }));
          } catch (e) { alert(e.message); }
        };
        const handleAutoStage = async () => {
          try {
            await apiPut('/gamification/my-stage', { stage: '' });
            setCharData(prev => ({ ...prev, selectedStage: '' }));
          } catch (e) { alert(e.message); }
        };
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }} onClick={() => setShowStages(false)}>
            <div className="card" style={{ maxWidth: 360, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 20 }}
              onClick={e => e.stopPropagation()}>
              <h3 style={{ marginBottom: 4 }}>📊 성장 단계</h3>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                실제 레벨: Lv.{levelInfo.level} ({currentAutoStage.label})
              </p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 14 }}>
                달성한 단계 중 원하는 단계를 선택하세요!
              </p>
              {/* 자동 선택 버튼 */}
              <div
                onClick={handleAutoStage}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                  border: !selectedStageName ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: !selectedStageName ? 'var(--primary)10' : 'var(--card)',
                }}>
                <div style={{ fontSize: 20, minWidth: 28, textAlign: 'center' }}>🔄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: !selectedStageName ? 'var(--primary)' : 'inherit' }}>자동 (레벨에 맞게)</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>레벨업 시 자동으로 변경</div>
                </div>
                {!selectedStageName && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'white', background: 'var(--primary)', padding: '2px 8px', borderRadius: 8 }}>선택됨</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stages.map((s, i) => {
                  const isSelected = selectedStageName === s.stage;
                  const isAutoMatch = !selectedStageName && currentAutoStage.stage === s.stage;
                  const isLocked = levelInfo.level < s.level;
                  return (
                    <div key={i}
                      onClick={() => !isLocked && handleSelectStage(s.stage)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 10,
                        border: (isSelected || isAutoMatch) ? `2px solid ${s.color}` : '1px solid var(--border)',
                        background: (isSelected || isAutoMatch) ? `${s.color}15` : 'var(--card)',
                        opacity: isLocked ? 0.5 : 1,
                        cursor: isLocked ? 'not-allowed' : 'pointer'
                      }}>
                      <div style={{ fontSize: 20, minWidth: 28, textAlign: 'center' }}>
                        {s.label.split(' ')[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: (isSelected || isAutoMatch) ? s.color : 'inherit' }}>
                          {s.stage}
                        </div>
                        {s.desc && !isLocked && (
                          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 1, lineHeight: 1.3 }}>{s.desc}</div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{s.range}</div>
                      </div>
                      {isSelected && (
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: 'white',
                          background: s.color, padding: '2px 8px', borderRadius: 8
                        }}>선택됨</div>
                      )}
                      {isAutoMatch && (
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: 'white',
                          background: s.color, padding: '2px 8px', borderRadius: 8
                        }}>현재</div>
                      )}
                      {isLocked && (
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>🔒</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-outline" onClick={() => setShowStages(false)}
                style={{ width: '100%', marginTop: 12 }}>닫기</button>
            </div>
          </div>
        );
      })()}

      {/* 전체 칭호 정보 모달 */}
      {showAllTitles && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={() => setShowAllTitles(false)}>
          <div className="card" style={{ maxWidth: 400, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 20 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>🎖️ 전체 칭호</h3>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14 }}>
              획득한 칭호: {myTitles.length}개
            </p>
            {/* 일반 칭호 */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>일반 칭호</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {allTitles.filter(t => !t.is_hidden).map(t => {
                const condLabel = t.condition_type === 'xp_total' ? `총 XP ${t.condition_value.toLocaleString()} 이상`
                  : t.condition_type === 'quiz_count' ? `퀴즈 ${t.condition_value}회 이상`
                  : t.condition_type === 'code_count' ? `코드 ${t.condition_value}회 사용`
                  : t.condition_type === 'level' ? `레벨 ${t.condition_value} 달성`
                  : t.condition_type === 'manual' ? '특별 부여'
                  : t.condition_type;
                return (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 10,
                    border: t.earned ? '2px solid #f59e0b' : '1px solid var(--border)',
                    background: t.earned ? '#fef3c720' : 'var(--card)',
                    opacity: t.earned ? 1 : 0.6
                  }}>
                    <div style={{ fontSize: 22, minWidth: 30, textAlign: 'center' }}>
                      {t.earned ? t.icon : '🔒'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{t.description}</div>
                      <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>📋 {condLabel}</div>
                    </div>
                    {t.earned && (
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: '#78350f',
                        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                        padding: '2px 8px', borderRadius: 8
                      }}>획득</div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* 히든 칭호 */}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9333ea', marginBottom: 6 }}>🔮 히든 칭호</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allTitles.filter(t => t.is_hidden).map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10,
                  border: t.earned ? '2px solid #9333ea' : '1px dashed #9333ea44',
                  background: t.earned ? '#9333ea10' : 'var(--card)',
                  opacity: t.earned ? 1 : 0.5
                }}>
                  <div style={{ fontSize: 22, minWidth: 30, textAlign: 'center' }}>
                    {t.earned ? t.icon : '❓'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {t.earned ? t.name : t.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                      {t.earned ? t.description : '조건: ???'}
                    </div>
                    {t.earned && t.condition_type !== 'hidden' && (
                      <div style={{ fontSize: 10, color: '#9333ea', marginTop: 2 }}>
                        📋 {t.condition_type === 'xp_total' ? `총 XP ${t.condition_value.toLocaleString()} 이상`
                          : t.condition_type === 'quiz_count' ? `퀴즈 ${t.condition_value}회 이상`
                          : t.condition_type === 'code_count' ? `코드 ${t.condition_value}회 사용`
                          : t.condition_type === 'level' ? `레벨 ${t.condition_value} 달성`
                          : t.condition_type === 'manual' ? '특별 부여' : t.condition_type}
                      </div>
                    )}
                  </div>
                  {t.earned && (
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: 'white',
                      background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
                      padding: '2px 8px', borderRadius: 8
                    }}>획득</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => { setShowAllTitles(false); setShowTitleSelect(true); }}
                style={{ flex: 1 }}>칭호 변경</button>
              <button className="btn btn-outline" onClick={() => setShowAllTitles(false)}
                style={{ flex: 1 }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 레벨업 축하 모달 */}
      {levelUpInfo && (() => {
        const newStage = getStageInfo(levelUpInfo.level);
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }} onClick={() => setLevelUpInfo(null)}>
            <div style={{
              background: 'white', borderRadius: 20, padding: '36px 28px', textAlign: 'center',
              maxWidth: 340, width: '100%', position: 'relative', overflow: 'hidden',
              animation: 'levelUpBounce 0.5s ease-out'
            }} onClick={e => e.stopPropagation()}>
              {/* 빵빠레 장식 */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)` }} />
              <div className="confetti-container">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="confetti-piece" style={{
                    '--x': `${Math.random() * 100}%`,
                    '--delay': `${Math.random() * 0.5}s`,
                    '--color': ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'][i % 6],
                    '--rot': `${Math.random() * 360}deg`,
                    '--dur': `${1 + Math.random() * 1}s`
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 48, marginBottom: 8, animation: 'levelUpSpin 1s ease-out' }}>🎉</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: newStage.color, marginBottom: 4 }}>
                LEVEL UP!
              </div>
              <div style={{
                fontSize: 48, fontWeight: 900, color: newStage.color,
                textShadow: `0 0 20px ${newStage.color}40`,
                animation: 'levelUpPulse 1.5s ease-in-out infinite'
              }}>
                Lv.{levelUpInfo.level}
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 8, marginBottom: 4 }}>
                {newStage.label}
              </div>
              <div style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 600 }}>
                축하합니다! 레벨 {levelUpInfo.level}에 도달했습니다!
              </div>
              <button className="btn btn-primary" onClick={() => setLevelUpInfo(null)}
                style={{ marginTop: 20, width: '100%', fontSize: 15, padding: '12px 0' }}>
                확인
              </button>
            </div>
          </div>
        );
      })()}
      <style>{`
        @keyframes levelUpBounce {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes levelUpSpin {
          0% { transform: rotate(0deg) scale(0.5); }
          50% { transform: rotate(360deg) scale(1.2); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes levelUpPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .confetti-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; }
        .confetti-piece {
          position: absolute; top: -10px; left: var(--x); width: 8px; height: 8px;
          background: var(--color); border-radius: 2px;
          animation: confettiFall var(--dur) ease-out var(--delay) forwards;
          transform: rotate(var(--rot));
        }
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      <BottomTabBar />
    </div>
  );
}
