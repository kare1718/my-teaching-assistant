import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { apiPost, apiGet, saveAuth } from '../api';

const FONT = "'Paperlogy', sans-serif";
const C = { accent: 'var(--primary)', accentDark: 'var(--primary-light)', accentLight: 'var(--primary-light)', textPrimary: 'var(--foreground)', textSecondary: 'var(--muted-foreground)', textTertiary: 'var(--neutral-400)', surface: 'var(--muted)', border: 'var(--border)', white: 'var(--card)', error: 'var(--destructive)', errorBg: 'var(--destructive-light)', success: 'var(--success)', successBg: 'var(--success-light)' };

/* ── 인라인 keyframes 주입 ── */
const ANIM_ID = '__loginPageKeyframes';
function injectKeyframes() {
  if (document.getElementById(ANIM_ID)) return;
  const s = document.createElement('style');
  s.id = ANIM_ID;
  s.textContent = `
    @keyframes fadeInUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  `;
  document.head.appendChild(s);
}

const reveal = (delay = 0) => ({
  opacity: 0,
  animation: `fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards`,
});

const inputStyle = {
  width: '100%', padding: '14px 16px', border: `1.5px solid ${C.border}`,
  borderRadius: 12, fontSize: 15, fontFamily: FONT, outline: 'none',
  color: C.textPrimary, background: C.white, transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
};
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 6 };
const primaryBtn = {
  width: '100%', padding: '16px', background: C.accent, color: C.white,
  border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700,
  fontFamily: FONT, cursor: 'pointer', transition: 'background 0.2s, box-shadow 0.2s',
};
const outlineBtn = { ...primaryBtn, background: C.white, color: C.textPrimary, border: `1.5px solid ${C.border}` };

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const academySlug = searchParams.get('academy');
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [showFindPw, setShowFindPw] = useState(false);
  const [findForm, setFindForm] = useState({ username: '', name: '', phone: '' });
  const [findResult, setFindResult] = useState(null);
  const [findError, setFindError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [academyConfig, setAcademyConfig] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => { injectKeyframes(); }, []);

  useEffect(() => {
    if (academySlug) {
      apiGet(`/academies/config?slug=${academySlug}`)
        .then(data => setAcademyConfig(data))
        .catch(() => {});
    }
  }, [academySlug]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const siteTitle = academyConfig?.siteTitle || '나만의 조교';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await apiPost('/auth/login', { ...form, academySlug, rememberMe });
      saveAuth(data.token, data.user, rememberMe);
      if (data.user.role === 'superadmin') { navigate('/superadmin'); return; }
      const isAssistant = data.user.school === '조교';
      navigate((data.user.role === 'admin' || isAssistant) ? '/admin' : '/student');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFindPassword = async () => {
    setFindError('');
    setFindResult(null);
    if (!findForm.username || !findForm.name || !findForm.phone) {
      setFindError('모든 항목을 입력해주세요.');
      return;
    }
    try {
      const data = await apiPost('/auth/find-password', findForm);
      setFindResult(data.tempPassword);
    } catch (err) {
      setFindError(err.message);
    }
  };

  const features = [
    { emoji: '\u{1F4CB}', title: '출결 + 학부모 알림', desc: '체크인 즉시 학부모에게 자동 알림' },
    { emoji: '\u{1F3AE}', title: '게이미피케이션', desc: 'XP, 레벨, 아바타, 퀴즈로 스스로 공부' },
    { emoji: '\u{1F4CA}', title: '성적 분석', desc: '영역별 취약점 자동 분석, 학부모 상담' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '32px 16px' : '40px 24px' }}>
      {/* 비밀번호 찾기 모달 */}
      {showFindPw && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'oklch(0% 0 0 / 0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => { setShowFindPw(false); setFindResult(null); setFindError(''); }}>
          <div style={{
            background: C.white, borderRadius: 20, padding: 32, width: 400, maxWidth: '100%',
            boxShadow: '0 24px 48px -12px oklch(0% 0 0 / 0.18)',
            ...reveal(0),
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, textAlign: 'center', marginBottom: 24 }}>
              비밀번호 찾기
            </h3>
            {findError && (
              <div style={{ padding: '12px 16px', background: C.errorBg, color: C.error, borderRadius: 12, fontSize: 13, marginBottom: 16, fontWeight: 500 }}>
                {findError}
              </div>
            )}
            {findResult ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ padding: 24, background: C.successBg, borderRadius: 16, marginBottom: 20 }}>
                  <p style={{ fontSize: 13, color: C.textTertiary, marginBottom: 10 }}>임시 비밀번호가 발급되었습니다</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: C.accent, letterSpacing: 4 }}>{findResult}</p>
                  <p style={{ fontSize: 12, color: C.textTertiary, marginTop: 10 }}>로그인 후 비밀번호를 변경해주세요</p>
                </div>
                <button style={primaryBtn} onClick={() => { setShowFindPw(false); setFindResult(null); }}>확인</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>아이디</label>
                  <input style={inputStyle} placeholder="아이디" value={findForm.username}
                    onChange={e => setFindForm({...findForm, username: e.target.value})}
                    onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                    onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label style={labelStyle}>이름</label>
                  <input style={inputStyle} placeholder="이름" value={findForm.name}
                    onChange={e => setFindForm({...findForm, name: e.target.value})}
                    onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                    onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label style={labelStyle}>전화번호</label>
                  <input style={inputStyle} placeholder="가입 시 입력한 전화번호" value={findForm.phone}
                    onChange={e => setFindForm({...findForm, phone: e.target.value})}
                    onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                    onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button style={{ ...primaryBtn, flex: 1 }} onClick={handleFindPassword}
                    onMouseOver={e => e.currentTarget.style.background = C.accentDark}
                    onMouseOut={e => e.currentTarget.style.background = C.accent}>찾기</button>
                  <button style={{ ...outlineBtn, flex: 1 }} onClick={() => setShowFindPw(false)}
                    onMouseOver={e => e.currentTarget.style.borderColor = C.textTertiary}
                    onMouseOut={e => e.currentTarget.style.borderColor = C.border}>취소</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 메인 컨테이너 */}
      <div style={{
        maxWidth: 1100, width: '100%',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 24 : 48,
        alignItems: 'center',
      }}>

        {/* 좌측: 브랜드 영역 */}
        <div style={{ flex: 1, width: '100%', ...reveal(0) }}>
          <div style={{ marginBottom: isMobile ? 0 : 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 16 : 24 }}>
              <img src="/logo.png" alt={siteTitle}
                style={{ width: isMobile ? 40 : 48, height: isMobile ? 40 : 48 }}
                onError={e => { e.target.style.display = 'none'; }} />
              <span style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.02em' }}>
                {siteTitle}
              </span>
            </div>

            <h1 style={{
              fontSize: isMobile ? 26 : 36, fontWeight: 800, color: C.textPrimary,
              lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: 12,
              ...reveal(100),
            }}>
              하루 3시간,{isMobile ? ' ' : <br />}수업에 돌려드립니다.
            </h1>

            <p style={{ fontSize: isMobile ? 14 : 16, color: C.textSecondary, lineHeight: 1.7, marginBottom: isMobile ? 0 : 32, ...reveal(200) }}>
              학부모 카톡, 출결, 성적 정리 — 매일 반복되는 잡무를{isMobile ? ' ' : <br />}
              자동화하고 수업에 집중하세요.
            </p>
          </div>

          {/* 기능 카드 — 데스크탑만 */}
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {features.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px', borderRadius: 16,
                  background: C.white, border: `1px solid ${C.border}`,
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  ...reveal(300 + i * 100),
                }}
                  onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 12px oklch(0% 0 0 / 0.06)'; e.currentTarget.style.borderColor = C.accentLight; }}
                  onMouseOut={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = C.border; }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${C.accent}0A`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                  }}>
                    {f.emoji}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>{f.title}</div>
                    <div style={{ fontSize: 13, color: C.textTertiary }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우측: 로그인 폼 카드 */}
        <div style={{
          width: isMobile ? '100%' : 420, flexShrink: 0,
          background: C.white, borderRadius: 24,
          border: `1px solid ${C.border}`,
          boxShadow: '0 8px 32px oklch(0% 0 0 / 0.06)',
          padding: isMobile ? '28px 24px' : '36px 32px',
          ...reveal(isMobile ? 100 : 200),
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>로그인</h2>
          <p style={{ fontSize: 14, color: C.textTertiary, marginBottom: 24 }}>계정에 로그인하여 시작하세요</p>

          {/* 학원 정보 배지 */}
          {academyConfig && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8,
              background: `${C.accent}0A`, color: C.accent,
              fontSize: 13, fontWeight: 600, marginBottom: 20,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {academyConfig.siteTitle || academySlug}
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px 16px', background: C.errorBg, color: C.error,
              borderRadius: 12, fontSize: 13, fontWeight: 500, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>아이디</label>
              <input
                style={inputStyle}
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="아이디를 입력하세요"
                required
                onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>비밀번호</label>
              <input
                style={inputStyle}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="비밀번호를 입력하세요"
                required
                onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                onBlur={e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: C.accent, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, color: C.textSecondary, fontWeight: 500 }}>자동 로그인</span>
            </label>
            <button type="submit" style={primaryBtn}
              onMouseOver={e => { e.currentTarget.style.background = C.accentDark; e.currentTarget.style.boxShadow = '0 4px 12px oklch(55% 0.15 250 / 0.25)'; }}
              onMouseOut={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.boxShadow = 'none'; }}
            >로그인</button>
          </form>

          {/* 비밀번호 찾기 */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <span style={{ cursor: 'pointer', color: C.textTertiary, fontSize: 13, fontWeight: 500, transition: 'color 0.2s' }}
              onClick={() => setShowFindPw(true)}
              onMouseOver={e => e.currentTarget.style.color = C.accent}
              onMouseOut={e => e.currentTarget.style.color = C.textTertiary}
            >비밀번호를 잊으셨나요?</span>
          </div>

          {/* 구분선 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ fontSize: 12, color: C.textTertiary, flexShrink: 0 }}>또는</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          {/* 안내 링크들 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link to="/onboarding" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${C.border}`,
              background: C.white, textDecoration: 'none', transition: 'all 0.2s',
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = '0 2px 8px oklch(55% 0.15 250 / 0.08)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>학원이 없으신가요?</div>
                <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>무료 체험 시작하기 — 카드 등록 없이</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>

            <Link to={academySlug ? `/register?academy=${academySlug}` : '/register'} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${C.border}`,
              background: C.white, textDecoration: 'none', transition: 'all 0.2s',
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = '0 2px 8px oklch(55% 0.15 250 / 0.08)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>학생이신가요?</div>
                <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>학원 코드로 가입하기</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
