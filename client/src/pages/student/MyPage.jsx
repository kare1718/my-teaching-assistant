import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, getUser } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import BottomTabBar from '../../components/BottomTabBar';
import InstallBanner from '../../components/InstallBanner';
import { quotes } from '../../data/quotes';
import AvatarSVG from '../../components/AvatarSVG';
import { getLevelInfo, getStageInfo, getXpPercent, getAllStages } from '../../utils/gamification';

export default function MyPage() {
  const { config } = useTenantConfig();
  const schools = config.schools || [];
  const getAllGrades = (schoolName) => {
    const s = (config.schools || []).find(sc => sc.name === schoolName);
    return s ? s.grades : [];
  };
  const navigate = useNavigate();
  const user = getUser();
  const [info, setInfo] = useState(null);
  const [notices, setNotices] = useState([]);
  const [scores, setScores] = useState([]);
  const [bestReviews, setBestReviews] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editRequests, setEditRequests] = useState([]);
  const [msg, setMsg] = useState('');
  const [currentReview, setCurrentReview] = useState(0);
  const [reviewTransition, setReviewTransition] = useState(true);
  const [currentBg, setCurrentBg] = useState(0);
  const [currentQuote, setCurrentQuote] = useState(0);
  const [charData, setCharData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [upcomingClinics, setUpcomingClinics] = useState([]);
  const [hallOfFame, setHallOfFame] = useState([]);
  const [currentHof, setCurrentHof] = useState(0);
  const [hofTransition, setHofTransition] = useState(true);
  const [homeworkRecords, setHomeworkRecords] = useState([]);
  const bgImages = ['/uploads/bg1.jpg', '/uploads/bg2.jpg', '/uploads/bg3.jpg', '/uploads/bg4.jpg', '/uploads/bg5.jpg', '/uploads/bg6.jpg', '/uploads/bg7.jpg', '/uploads/bg8.jpg'];

  // 배경 이미지 슬라이드
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg(prev => (prev + 1) % bgImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 명언 롤링 (시작 시 랜덤, 이후 10초마다 변경)
  useEffect(() => {
    setCurrentQuote(Math.floor(Math.random() * quotes.length));
    const interval = setInterval(() => {
      setCurrentQuote(prev => (prev + 1) % quotes.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const load = () => {
    api('/students/my-info').then((data) => {
      setInfo(data);
      setEditForm({
        name: data.name || '', phone: data.phone || '',
        school: data.school || '', grade: data.grade || '',
        parent_name: data.parent_name || '', parent_phone: data.parent_phone || ''
      });
    }).catch(console.error);
    api('/students/my-notices').then((n) => setNotices(n.slice(0, 3))).catch(console.error);
    api('/scores/my-scores').then((s) => setScores(s.slice(-3))).catch(console.error);
    api('/students/my-edit-requests').then(setEditRequests).catch(console.error);
    api('/students/reviews').then((r) => setBestReviews(r.filter(rv => rv.is_best))).catch(console.error);
    api('/gamification/my-character').then(setCharData).catch(() => {});
    api('/auth/notifications').then(data => {
      const unread = (data || []).filter(n => !n.is_read);
      setNotifications(unread);
    }).catch(() => {});
    api('/clinic/my/upcoming').then(setUpcomingClinics).catch(() => {});
    api('/hall-of-fame').then(setHallOfFame).catch(() => {});
    api('/homework/my').then(data => setHomeworkRecords(data.records || [])).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  // 화면 크기 감지 (넓으면 후기 2개씩)
  const [isWide, setIsWide] = useState(window.innerWidth >= 640);
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const reviewsPerSlide = isWide ? 2 : 1;

  // 후기를 슬라이드 단위로 그룹핑
  const reviewSlides = [];
  for (let i = 0; i < bestReviews.length; i += reviewsPerSlide) {
    reviewSlides.push(bestReviews.slice(i, i + reviewsPerSlide));
  }
  const displaySlides = reviewSlides.length > 1
    ? [...reviewSlides, reviewSlides[0]]  // 무한 루프용 복제
    : reviewSlides;

  useEffect(() => {
    if (reviewSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentReview(prev => prev + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, [reviewSlides.length]);

  // 복제된 마지막에 도달하면 → 트랜지션 없이 0으로 리셋
  useEffect(() => {
    if (reviewSlides.length <= 1) return;
    if (currentReview === reviewSlides.length) {
      const timer = setTimeout(() => {
        setReviewTransition(false);
        setCurrentReview(0);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setReviewTransition(true);
          });
        });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentReview, reviewSlides.length]);

  // 명예의 전당 롤링
  const hofPerSlide = isWide ? 2 : 1;
  const hofSlides = [];
  for (let i = 0; i < hallOfFame.length; i += hofPerSlide) {
    hofSlides.push(hallOfFame.slice(i, i + hofPerSlide));
  }
  const displayHofSlides = hofSlides.length > 1
    ? [...hofSlides, hofSlides[0]]
    : hofSlides;

  useEffect(() => {
    if (hofSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentHof(prev => prev + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, [hofSlides.length]);

  useEffect(() => {
    if (hofSlides.length <= 1) return;
    if (currentHof === hofSlides.length) {
      const timer = setTimeout(() => {
        setHofTransition(false);
        setCurrentHof(0);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHofTransition(true);
          });
        });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentHof, hofSlides.length]);

  const getCategoryEmoji = (cat) => {
    switch (cat) {
      case '1등급 달성': return '🥇';
      case '성적 향상': return '📈';
      case '모의고사 우수': return '📊';
      case '수능 우수': return '💯';
      default: return '⭐';
    }
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case '1등급 달성': return { bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', border: 'var(--warning)' };
      case '성적 향상': return { bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)', border: 'var(--success)' };
      case '모의고사 우수': return { bg: 'var(--info-light)', color: 'oklch(32% 0.12 260)', border: 'var(--info)' };
      case '수능 우수': return { bg: 'oklch(92% 0.04 340)', color: 'oklch(30% 0.15 340)', border: 'oklch(60% 0.20 340)' };
      default: return { bg: 'var(--neutral-100)', color: 'var(--neutral-700)', border: 'var(--neutral-400)' };
    }
  };

  const submitEditRequest = async () => {
    const changes = [];
    for (const [field, value] of Object.entries(editForm)) {
      const oldVal = info[field] || '';
      if (value !== oldVal) changes.push({ field, value });
    }
    if (changes.length === 0) { setMsg('변경된 정보가 없습니다.'); setTimeout(() => setMsg(''), 2000); return; }
    try {
      await apiPost('/students/edit-request', { changes });
      setMsg('수정 요청이 제출되었습니다. 관리자 승인 후 반영됩니다.');
      setEditing(false); load(); setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); setTimeout(() => setMsg(''), 3000); }
  };

  const hasPendingRequest = editRequests.some(r => r.status === 'pending');
  const grades = editForm.school ? getAllGrades(editForm.school) : [];

  if (!info) return <div className="content"><p style={{ color: 'var(--muted-foreground)' }}>로딩 중...</p></div>;

  return (
    <div className="content" style={{ position: 'relative', overflowX: 'hidden', maxWidth: '100vw' }}>
      {/* 배경 이미지 그리드 */}
      <div style={{ position: 'fixed', top: 56, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '8px',
          gridTemplateRows: 'repeat(2, 1fr)',
        }}>
          {bgImages.map((img, idx) => (
            <div key={idx} style={{
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover',
              backgroundPosition: idx === 1 ? 'right center' : 'center top',
              borderRadius: '12px',
              filter: 'blur(1.5px) brightness(0.55)',
              opacity: 0.3,
              minHeight: 0,
            }} />
          ))}
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(98% 0.01 260 / 0.7)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
      {notifications.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {notifications.map(n => (
            <div key={n.id} style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 4,
              background: 'linear-gradient(135deg, var(--info-light), var(--info-light))',
              border: '1px solid oklch(72% 0.10 260)', display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span style={{ fontSize: 18 }}>🔔</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{n.message}</div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--neutral-400)' }}
                onClick={() => {
                  apiPut('/auth/notifications/' + n.id + '/read').catch(() => {});
                  setNotifications(prev => prev.filter(x => x.id !== n.id));
                }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <InstallBanner />
      <div className="greeting-card" style={{ position: 'relative', overflow: 'hidden', minHeight: 160 }}>
        {/* greeting card 배경 - 슬라이드 */}
        {bgImages.map((img, idx) => (
          <div
            key={`gc-${idx}`}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: 'blur(2px) brightness(0.4)',
              opacity: idx === currentBg ? 1 : 0,
              transition: 'opacity 1.5s ease-in-out',
              transform: 'scale(1.08)',
            }}
          />
        ))}
        {/* 텍스트 콘텐츠 */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 8, lineHeight: 1.6 }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>나만의 조교</span>
          </div>
          <h2 style={{ fontWeight: 800, marginBottom: 6 }}>{info.name}님 안녕하세요!</h2>
          <p>언제나 강인쌤이 응원합니다. 👍</p>
        </div>
      </div>

      {/* 명언 카드 */}
      <div className="card floating-card" style={{
        textAlign: 'center', padding: '20px 24px',
        background: 'linear-gradient(135deg, var(--card) 0%, var(--muted) 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative' }}>
          {quotes.map((q, idx) => (
            <div key={idx} style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              opacity: idx === currentQuote ? 1 : 0,
              transition: 'opacity 1.5s ease-in-out',
              pointerEvents: idx === currentQuote ? 'auto' : 'none',
            }}>
              <p style={{
                fontSize: 14, fontWeight: 500, lineHeight: 1.7,
                color: 'var(--foreground)', margin: 0, fontStyle: 'italic'
              }}>
                "{q.text}"
              </p>
              <p style={{
                fontSize: 12, color: 'var(--muted-foreground)',
                marginTop: 6, marginBottom: 0
              }}>
                — {q.author}
              </p>
            </div>
          ))}
          {/* 높이 유지용 (현재 명언) */}
          <div style={{ visibility: 'hidden' }}>
            <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.7, margin: 0 }}>
              "{quotes[currentQuote]?.text}"
            </p>
            <p style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
              — {quotes[currentQuote]?.author}
            </p>
          </div>
        </div>
      </div>

      {/* 캐릭터 미니 위젯 */}
      {charData && (() => {
        const lvl = charData.levelInfo || getLevelInfo(charData.xp);
        const autoStage = getStageInfo(lvl.level);
        const selName = charData.selectedStage || '';
        const selObj = selName ? getAllStages().find(s => s.stage === selName) : null;
        const stage = selObj ? { stage: selObj.stage, color: selObj.color, label: selObj.label } : autoStage;
        const pct = getXpPercent(lvl);
        return (
          <div className="card floating-card" onClick={() => navigate('/student/game')}
            style={{ cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <AvatarSVG config={charData.avatarConfig || {}} size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{charData.nickname || user?.name || charData.char_name}</span>
                {charData.titleName && (
                  <span style={{ fontSize: 10, background: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', padding: '1px 6px', borderRadius: 8 }}>
                    {charData.titleName}
                  </span>
                )}
              </div>
              <div style={{ height: 6, background: 'var(--muted)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: stage.color, borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3 }}>
                <span>Lv.{lvl.level} {stage.label}</span>
                <span>{charData.points?.toLocaleString()}P</span>
              </div>
            </div>
            <span style={{ fontSize: 18, color: 'var(--muted-foreground)' }}>›</span>
          </div>
        );
      })()}

      {/* 클리닉 일정 */}
      {upcomingClinics.length > 0 && (
        <div className="card floating-card" style={{
          background: 'linear-gradient(135deg, var(--success-light), var(--success-light))',
          border: '1px solid oklch(78% 0.12 150)'
        }}>
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            📋 다가오는 클리닉
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/clinic')}>전체 보기 &gt;</button>
          </h2>
          {upcomingClinics.map(c => {
            const d = new Date(c.appointment_date + 'T00:00:00');
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            return (
              <div key={c.id} style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 6,
                background: 'var(--card)', border: '1px solid oklch(90% 0.06 145)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {d.getMonth() + 1}/{d.getDate()}({dayNames[d.getDay()]}) {c.time_slot}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{c.topic}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'oklch(30% 0.12 145)', background: 'var(--success-light)', padding: '2px 8px', borderRadius: 8 }}>승인됨</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 클리닉 신청 바로가기 */}
      <div className="card floating-card" onClick={() => navigate('/student/clinic')}
        style={{ cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg, var(--info-light), var(--info-light))', border: '1px solid oklch(72% 0.10 260)' }}>
        <span style={{ fontSize: 28 }}>📝</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>개별 클리닉 신청</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>1:1 맞춤 수업을 신청하세요</div>
        </div>
        <span style={{ fontSize: 18, color: 'var(--muted-foreground)' }}>›</span>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="card floating-card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          📋 내 정보
          {!editing && !hasPendingRequest && (
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>정보 수정 요청</button>
          )}
          {hasPendingRequest && <span className="badge badge-warning">수정 요청 대기 중</span>}
        </h2>

        {editing ? (
          <div>
            <div className="form-row">
              <div className="form-group"><label>이름</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div className="form-group"><label>연락처</label><input value={editForm.phone} maxLength={13} onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                let f = raw;
                if (raw.length <= 3) f = raw;
                else if (raw.length <= 7) f = raw.slice(0,3)+'-'+raw.slice(3);
                else f = raw.slice(0,3)+'-'+raw.slice(3,7)+'-'+raw.slice(7,11);
                setEditForm({ ...editForm, phone: f });
              }} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>학교</label>
                <select value={editForm.school} onChange={(e) => setEditForm({ ...editForm, school: e.target.value, grade: '' })}>
                  {schools.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>학년</label>
                <select value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}>
                  <option value="">선택하세요</option>
                  {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>학부모 이름</label><input value={editForm.parent_name} onChange={(e) => setEditForm({ ...editForm, parent_name: e.target.value })} /></div>
              <div className="form-group"><label>학부모 연락처</label><input value={editForm.parent_phone} maxLength={13} onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                let f = raw;
                if (raw.length <= 3) f = raw;
                else if (raw.length <= 7) f = raw.slice(0,3)+'-'+raw.slice(3);
                else f = raw.slice(0,3)+'-'+raw.slice(3,7)+'-'+raw.slice(7,11);
                setEditForm({ ...editForm, parent_phone: f });
              }} /></div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>※ 수정 요청 후 관리자 승인이 필요합니다.</p>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={submitEditRequest}>수정 요청</button>
              <button className="btn btn-secondary" onClick={() => { setEditing(false); setEditForm({ name: info.name||'', phone: info.phone||'', school: info.school||'', grade: info.grade||'', parent_name: info.parent_name||'', parent_phone: info.parent_phone||'' }); }}>취소</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="stat-card floating-card"><span className="stat-label">이름</span><span className="stat-value" style={{ fontSize: 16 }}>{info.name}</span></div>
            <div className="stat-card floating-card"><span className="stat-label">학교</span><span className="stat-value" style={{ fontSize: 16 }}>{info.school}</span></div>
            <div className="stat-card floating-card"><span className="stat-label">학년</span><span className="stat-value" style={{ fontSize: 16 }}>{info.grade}</span></div>
            <div className="stat-card floating-card"><span className="stat-label">연락처</span><span className="stat-value" style={{ fontSize: 14 }}>{info.phone || '-'}</span></div>
            <div className="stat-card floating-card"><span className="stat-label">학부모</span><span className="stat-value" style={{ fontSize: 14 }}>{info.parent_name || '-'}</span></div>
          </div>
        )}
      </div>

      <div className="card floating-card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          🏆 수업 후기
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/reviews')}>
            {bestReviews.length > 0 ? '전체 보기 >' : '후기 작성 >'}
          </button>
        </h2>
        {bestReviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginBottom: 12 }}>아직 등록된 베스트 후기가 없습니다.</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/student/reviews')}>후기 작성하기</button>
          </div>
        ) : (
          <>
            <div className="review-rolling-container">
              <div
                className="review-rolling-track"
                style={{
                  transform: `translateY(calc(-${currentReview} * var(--review-item-h)))`,
                  transition: reviewTransition ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                }}
              >
                {displaySlides.map((slide, idx) => (
                  <div key={idx} className="review-rolling-item">
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: slide.length > 1 ? '1fr 1fr' : '1fr',
                      gap: 10,
                      width: '100%', height: '100%',
                    }}>
                      {slide.map((r, rIdx) => (
                        <div key={rIdx} className="review-card best" style={{
                          marginBottom: 0, width: '100%', height: '100%',
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                          boxSizing: 'border-box',
                        }}>
                          <div className="review-content" style={{
                            fontSize: 14, lineHeight: 1.6, overflow: 'hidden',
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                            flex: 1,
                          }}>{r.content}</div>
                          <div className="review-meta" style={{ marginTop: 6 }}>
                            <span>{r.display_name}</span>
                            <span className="best-badge">BEST</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {reviewSlides.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                {reviewSlides.map((_, i) => (
                  <span
                    key={i}
                    onClick={() => { setReviewTransition(true); setCurrentReview(i); }}
                    style={{
                      width: 6, height: 6, borderRadius: '50%', cursor: 'pointer', transition: 'all 0.3s',
                      background: i === (currentReview % reviewSlides.length) ? 'var(--primary)' : 'var(--border)',
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 과제 현황 */}
      {homeworkRecords.length > 0 && (
        <div className="card floating-card">
          <h2>📋 과제 현황</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {homeworkRecords.slice(0, 5).map((r, i) => {
              const sb = r.submission_status === 'O' ? { bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)' }
                       : r.submission_status === 'X' ? { bg: 'oklch(88% 0.06 25)', color: 'oklch(35% 0.15 25)' }
                       : { bg: 'var(--secondary)', color: 'var(--muted-foreground)' };
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--background)' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 60 }}>{r.date}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{r.class_name}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: sb.bg, color: sb.color, fontWeight: 700 }}>
                    과제 {r.submission_status || '-'}
                  </span>
                  {r.memo && <span style={{ fontSize: 11, color: 'var(--muted-foreground)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.memo}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 명예의 전당 */}
      {hallOfFame.length > 0 && (() => {
        const currentStudents = hallOfFame.filter(h => (h.student_status || '재학생') === '재학생');
        const graduates = hallOfFame.filter(h => (h.student_status || '재학생') === '졸업생');

        const renderHofSection = (sectionItems, label, emoji) => {
          if (sectionItems.length === 0) return null;
          const sPerSlide = isWide ? 2 : 1;
          const sSlides = [];
          for (let i = 0; i < sectionItems.length; i += sPerSlide) {
            sSlides.push(sectionItems.slice(i, i + sPerSlide));
          }
          const displaySlides = sSlides.length > 1 ? [...sSlides, sSlides[0]] : sSlides;

          return (
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                padding: '6px 10px', borderRadius: 8,
                background: label === '재학생' ? 'var(--success-light)' : 'var(--info-light)',
              }}>
                <span style={{ fontSize: 14 }}>{emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: label === '재학생' ? 'oklch(30% 0.12 145)' : 'oklch(32% 0.12 260)' }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>({sectionItems.length}명)</span>
              </div>
              <div className="review-rolling-container">
                <div
                  className="review-rolling-track"
                  style={{
                    transform: `translateY(calc(-${currentHof % (sSlides.length || 1)} * var(--review-item-h)))`,
                    transition: hofTransition ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                  }}
                >
                  {displaySlides.map((slide, idx) => (
                    <div key={idx} className="review-rolling-item">
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: slide.length > 1 ? '1fr 1fr' : '1fr',
                        gap: 10, width: '100%', height: '100%',
                      }}>
                        {slide.map((item, iIdx) => {
                          const catColor = getCategoryColor(item.category);
                          return (
                            <div key={iIdx} style={{
                              borderRadius: 12, padding: 14,
                              background: `linear-gradient(135deg, ${catColor.bg}, white)`,
                              border: `1px solid ${catColor.border}30`,
                              display: 'flex', flexDirection: 'column', justifyContent: 'center',
                              height: '100%', boxSizing: 'border-box',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                  background: catColor.bg, color: catColor.color, border: `1px solid ${catColor.border}40`,
                                }}>
                                  {getCategoryEmoji(item.category)} {item.category}
                                </span>
                              </div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--foreground)' }}>
                                {item.student_name}
                                {item.school && (
                                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginLeft: 6 }}>
                                    {item.school} {item.grade}
                                  </span>
                                )}
                              </div>
                              {item.achievement && (
                                <div style={{ fontSize: 13, color: catColor.color, fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
                                  {item.achievement}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {sSlides.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                  {sSlides.map((_, i) => (
                    <span
                      key={i}
                      onClick={() => { setHofTransition(true); setCurrentHof(i); }}
                      style={{
                        width: 6, height: 6, borderRadius: '50%', cursor: 'pointer', transition: 'all 0.3s',
                        background: i === (currentHof % sSlides.length) ? 'var(--primary)' : 'var(--border)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="card floating-card">
            <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              🏆 명예의 전당
            </h2>
            {renderHofSection(currentStudents, '재학생', '🎒')}
            {renderHofSection(graduates, '졸업생', '🎓')}
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 12 }}>
        <div className="card floating-card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            📢 최근 안내사항
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/notices')}>전체 보기 &gt;</button>
          </h2>
          {notices.length === 0 ? <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>안내사항이 없습니다.</p> :
            notices.map((n) => (<div key={n.id} className="notice-card"><div className="notice-title">{n.title}</div><div className="notice-date">{n.created_at}</div></div>))}
        </div>
        <div className="card floating-card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            📊 최근 성적
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/scores')}>전체 보기 &gt;</button>
          </h2>
          {scores.length === 0 ? <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>등록된 성적이 없습니다.</p> : (
            <table><thead><tr><th>시험</th><th>점수</th></tr></thead><tbody>
              {scores.map((s, i) => (<tr key={i}><td>{s.exam_name}</td><td style={{ fontWeight: 600 }}>{s.score}점</td></tr>))}
            </tbody></table>
          )}
        </div>
      </div>

      <BottomTabBar />
      </div>
    </div>
  );
}
