import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../api';

const FONT = "'Paperlogy', sans-serif";
const C = { accent: 'var(--primary)', accentDark: 'var(--primary-light)', accentLight: 'var(--primary-light)', textPrimary: 'var(--foreground)', textSecondary: 'var(--muted-foreground)', textTertiary: 'var(--neutral-400)', surface: 'var(--muted)', border: 'var(--border)', white: 'var(--card)', error: 'var(--destructive)', errorBg: 'var(--destructive-light)', success: 'var(--success)', successBg: 'var(--success-light)' };

const ANIM_ID = '__onboardingPageKeyframes';
function injectKeyframes() {
  if (document.getElementById(ANIM_ID)) return;
  const s = document.createElement('style');
  s.id = ANIM_ID;
  s.textContent = `@keyframes fadeInUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(s);
}
const reveal = (delay = 0) => ({ opacity: 0, animation: `fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards` });

const inputBase = {
  width: '100%', padding: '13px 16px', border: `1.5px solid ${C.border}`,
  borderRadius: 12, fontSize: 15, fontFamily: FONT, outline: 'none',
  color: C.textPrimary, background: C.white, transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
};
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 6 };
const primaryBtn = {
  padding: '16px', background: C.accent, color: C.white, border: 'none',
  borderRadius: 12, fontSize: 16, fontWeight: 700, fontFamily: FONT,
  cursor: 'pointer', transition: 'background 0.2s, box-shadow 0.2s', flex: 1,
};
const outlineBtn = { ...primaryBtn, background: C.white, color: C.textPrimary, border: `1.5px solid ${C.border}` };

const focusHandler = (e) => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; };
const blurHandler = (e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; };

const stepLabels = ['학원 정보', '관리자 계정', '확인'];

const getPasswordStrength = (pw) => {
  if (!pw || pw.length < 4) return null;
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  if (pw.length >= 8 && hasLetter && hasNumber && hasSpecial) return { label: '강함', color: C.success, width: '100%' };
  if (pw.length >= 8 && ((hasLetter && hasNumber) || (hasLetter && hasSpecial) || (hasNumber && hasSpecial))) return { label: '보통', color: 'var(--warning)', width: '66%' };
  return { label: '약함', color: C.error, width: '33%' };
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    academyName: '', slug: '', subject: '',
    adminUsername: '', adminPassword: '', adminPasswordConfirm: '',
    adminName: '', adminPhone: '', adminPhone2: ''
  });
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { injectKeyframes(); }, []);

  const update = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (key === 'slug') setSlugAvailable(null);
  };

  const checkSlug = async () => {
    if (!form.slug || form.slug.length < 3) return;
    try {
      const res = await fetch(`/api/onboarding/check-slug?slug=${form.slug}`);
      const data = await res.json();
      setSlugAvailable(data.available);
    } catch {
      setSlugAvailable(null);
    }
  };

  const autoSlug = () => {
    const slug = form.academyName
      .replace(/[가-힣]/g, (c) => {
        const code = c.charCodeAt(0) - 0xAC00;
        const initial = Math.floor(code / 588);
        const initials = 'gknsddlmbsjjctkph';
        return initials[initial] || '';
      })
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    setForm({ ...form, slug });
    setSlugAvailable(null);
  };

  const handleSubmit = async () => {
    setError('');
    if (form.adminPassword !== form.adminPasswordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (form.adminPassword.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const submitForm = { ...form, adminPhone: form.adminPhone.trim() || '000-0000-0000' };
      await apiPost('/onboarding/create-academy', submitForm);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/register?academy=${form.slug}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const pwStrength = getPasswordStrength(form.adminPassword);

  return (
    <div style={{ minHeight: '100vh', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: FONT }}>
      <div style={{
        maxWidth: 560, width: '100%', background: C.white, borderRadius: 24,
        padding: '36px 32px', boxShadow: '0 8px 32px oklch(0% 0 0 / 0.06)',
        border: `1px solid ${C.border}`,
        ...reveal(0),
      }}>

        {step <= 3 && (
          <>
            {/* 헤더 */}
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                <img src="/logo.png" alt="나만의 조교" style={{ width: 44, height: 44 }}
                  onError={e => { e.target.style.display = 'none'; }} />
                <span style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, letterSpacing: '-0.02em' }}>나만의 조교</span>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>학원을 등록하세요</h1>
              <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6 }}>매일 반복되는 잡무를 자동화하고 수업에 집중하세요.</p>
            </div>

            {/* 혜택 배지 — 1단계만 */}
            {step === 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '16px 0 8px', flexWrap: 'wrap' }}>
                {[
                  { emoji: '\u{1F381}', text: '14일 무료' },
                  { emoji: '\u{1F464}', text: '학생 15명 무료' },
                  { emoji: '\u26A1', text: '5분 세팅' },
                ].map((b, i) => (
                  <div key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 10, background: `${C.accent}08`,
                    ...reveal(100 + i * 80),
                  }}>
                    <span style={{ fontSize: 14 }}>{b.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{b.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 스텝 인디케이터 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, margin: '24px 0 28px', padding: '0 8px' }}>
              {stepLabels.map((label, i) => {
                const s = i + 1;
                const isActive = s === step;
                const isDone = s < step;
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: isDone || isActive ? C.accent : C.surface,
                        color: isDone || isActive ? C.white : C.textTertiary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, transition: 'all 0.3s',
                        border: isDone || isActive ? 'none' : `2px solid ${C.border}`,
                      }}>
                        {isDone ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        ) : s}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? C.accent : C.textTertiary }}>{label}</span>
                    </div>
                    {s < 3 && (
                      <div style={{ width: 48, height: 2, background: isDone ? C.accent : C.border, margin: '0 8px', marginBottom: 20, transition: 'background 0.3s' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </>
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

        {/* Step 1: 학원 정보 */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...reveal(200) }}>
            <div>
              <label style={labelStyle}>학원 이름 *</label>
              <input style={inputBase} value={form.academyName} onChange={update('academyName')} placeholder="예: 나만의 학원" onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            <div>
              <label style={labelStyle}>학원 전용 URL *</label>
              <p style={{ fontSize: 12, color: C.textTertiary, marginBottom: 8 }}>학생들이 이 주소로 가입합니다</p>
              <div style={{ marginBottom: 8, padding: '10px 14px', background: C.surface, borderRadius: 10, fontSize: 13, color: C.textSecondary, fontFamily: 'monospace' }}>
                <span style={{ color: C.textTertiary }}>...myteachingassistant.com/register?academy=</span>
                <span style={{ fontWeight: 700, color: C.accent }}>{form.slug || 'my-academy'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputBase, flex: 1 }} value={form.slug} onChange={update('slug')} onBlur={checkSlug} placeholder="my-academy" onFocus={focusHandler} />
                <button type="button" onClick={autoSlug} style={{
                  padding: '0 16px', fontSize: 13, borderRadius: 12, border: `1.5px solid ${C.border}`,
                  background: C.white, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT, fontWeight: 600, color: C.textSecondary,
                  transition: 'all 0.2s',
                }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSecondary; }}
                >자동 생성</button>
              </div>
              {slugAvailable === true && (
                <p style={{ color: C.success, fontSize: 12, marginTop: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  사용 가능한 주소입니다
                </p>
              )}
              {slugAvailable === false && <p style={{ color: C.error, fontSize: 12, marginTop: 6 }}>이미 사용 중인 주소입니다</p>}
              {form.slug && /[가-힣]/.test(form.slug) && (
                <p style={{ color: 'var(--warning)', fontSize: 12, marginTop: 6 }}>영문, 숫자, 하이픈(-)만 사용 가능합니다</p>
              )}
            </div>
            <div>
              <label style={labelStyle}>주요 과목 <span style={{ fontWeight: 400, color: C.textTertiary }}>(선택)</span></label>
              <input style={inputBase} value={form.subject} onChange={update('subject')} placeholder="예: 국어, 수학, 영어" onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            <button style={{ ...primaryBtn, width: '100%' }} onClick={() => {
              if (!form.academyName || !form.slug) { setError('학원 이름과 주소를 입력해주세요.'); return; }
              setError(''); setStep(2);
            }}
              onMouseOver={e => { e.currentTarget.style.background = C.accentDark; e.currentTarget.style.boxShadow = '0 4px 12px oklch(55% 0.15 250 / 0.25)'; }}
              onMouseOut={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.boxShadow = 'none'; }}
            >다음</button>
          </div>
        )}

        {/* Step 2: 관리자 계정 */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...reveal(0) }}>
            <div style={{
              padding: '12px 16px', background: `${C.accent}08`, borderRadius: 12,
              fontSize: 13, color: C.accent, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
              이 계정으로 학원 관리자 페이지에 로그인합니다
            </div>
            <div>
              <label style={labelStyle}>관리자 이름 *</label>
              <input style={inputBase} value={form.adminName} onChange={update('adminName')} placeholder="이름" onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            <div>
              <label style={labelStyle}>아이디 *</label>
              <input style={inputBase} value={form.adminUsername} onChange={update('adminUsername')} placeholder="관리자 아이디" onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            <div>
              <label style={labelStyle}>비밀번호 *</label>
              <input style={inputBase} type="password" value={form.adminPassword} onChange={update('adminPassword')} placeholder="비밀번호 (4자 이상)" onFocus={focusHandler} onBlur={blurHandler} />
              {pwStrength && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: pwStrength.color, fontWeight: 600 }}>{pwStrength.label}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: C.border }}>
                    <div style={{ height: '100%', borderRadius: 2, background: pwStrength.color, width: pwStrength.width, transition: 'all 0.3s' }} />
                  </div>
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>비밀번호 확인 *</label>
              <input style={{
                ...inputBase,
                borderColor: form.adminPasswordConfirm && form.adminPassword !== form.adminPasswordConfirm ? C.error : C.border,
              }} type="password" value={form.adminPasswordConfirm} onChange={update('adminPasswordConfirm')} placeholder="비밀번호 확인" onFocus={focusHandler} onBlur={blurHandler} />
              {form.adminPasswordConfirm && form.adminPassword !== form.adminPasswordConfirm && (
                <span style={{ fontSize: 11, color: C.error, marginTop: 4, display: 'block' }}>비밀번호가 일치하지 않습니다</span>
              )}
            </div>
            <div>
              <label style={labelStyle}>대표 연락처 *</label>
              <p style={{ fontSize: 12, color: C.textTertiary, marginBottom: 8 }}>학부모·학생 문의 시 안내되는 번호입니다</p>
              <input style={inputBase} value={form.adminPhone} onChange={update('adminPhone')} placeholder="010-0000-0000" onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            <div>
              <label style={labelStyle}>보조 연락처 <span style={{ fontWeight: 400, color: C.textTertiary }}>(선택)</span></label>
              <input style={inputBase} value={form.adminPhone2} onChange={update('adminPhone2')} placeholder="학원 유선 번호 등" onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={outlineBtn} onClick={() => setStep(1)}
                onMouseOver={e => e.currentTarget.style.background = C.surface}
                onMouseOut={e => e.currentTarget.style.background = C.white}
              >이전</button>
              <button style={primaryBtn} onClick={() => {
                if (!form.adminName || !form.adminUsername || !form.adminPassword) { setError('필수 항목을 입력해주세요.'); return; }
                if (form.adminPassword.length < 4) { setError('비밀번호는 최소 4자 이상이어야 합니다.'); return; }
                if (form.adminPassword !== form.adminPasswordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
                setError(''); setStep(3);
              }}
                onMouseOver={e => { e.currentTarget.style.background = C.accentDark; e.currentTarget.style.boxShadow = '0 4px 12px oklch(55% 0.15 250 / 0.25)'; }}
                onMouseOut={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.boxShadow = 'none'; }}
              >다음</button>
            </div>
          </div>
        )}

        {/* Step 3: 확인 */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...reveal(0) }}>
            <div style={{ background: C.surface, borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textTertiary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>학원 정보</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: C.textSecondary }}>학원명</span>
                  <span style={{ fontWeight: 700, color: C.textPrimary }}>{form.academyName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: C.textSecondary }}>전용 URL</span>
                  <span style={{ fontWeight: 700, color: C.accent }}>{form.slug}</span>
                </div>
                {form.subject && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: C.textSecondary }}>과목</span>
                    <span style={{ color: C.textPrimary }}>{form.subject}</span>
                  </div>
                )}
              </div>
              <div style={{ height: 1, background: C.border, margin: '16px 0' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textTertiary, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>관리자</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: C.textSecondary }}>이름 (아이디)</span>
                  <span style={{ fontWeight: 700, color: C.textPrimary }}>{form.adminName} ({form.adminUsername})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: C.textSecondary }}>대표 연락처</span>
                  <span style={{ color: C.textPrimary }}>{form.adminPhone || '000-0000-0000'}</span>
                </div>
                {form.adminPhone2 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: C.textSecondary }}>보조 연락처</span>
                    <span style={{ color: C.textPrimary }}>{form.adminPhone2}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{
              background: C.successBg, borderRadius: 14, padding: '16px 20px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: 'oklch(63% 0.20 145 / 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg>
              </div>
              <div>
                <p style={{ fontWeight: 700, color: C.success, fontSize: 14, marginBottom: 2 }}>14일 무료 체험으로 시작!</p>
                <p style={{ color: C.textSecondary, fontSize: 13 }}>전체 기능을 무료로 체험해보세요. 카드 등록 없이 바로 시작합니다.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={outlineBtn} onClick={() => setStep(2)}
                onMouseOver={e => e.currentTarget.style.background = C.surface}
                onMouseOut={e => e.currentTarget.style.background = C.white}
              >이전</button>
              <button style={primaryBtn} onClick={handleSubmit} disabled={loading}
                onMouseOver={e => { if (!loading) { e.currentTarget.style.background = C.accentDark; e.currentTarget.style.boxShadow = '0 4px 12px oklch(55% 0.15 250 / 0.25)'; }}}
                onMouseOut={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.boxShadow = 'none'; }}
              >{loading ? '생성 중...' : '학원 만들기'}</button>
            </div>
          </div>
        )}

        {/* Step 4: 성공 화면 */}
        {step === 4 && (
          <div style={{ textAlign: 'center', ...reveal(0) }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: C.successBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>학원이 등록되었습니다!</h2>
            <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 28 }}>아래 링크를 학생들에게 공유하세요.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 24 }}>
              {/* 학생 초대 링크 */}
              <div style={{
                padding: '18px 20px', borderRadius: 16, border: `1.5px solid ${C.border}`, background: C.white,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: `${C.accent}0A`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.textPrimary }}>학생 초대 링크</div>
                    <div style={{ fontSize: 12, color: C.textTertiary }}>학생들에게 이 링크를 보내세요</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{
                    flex: 1, padding: '10px 14px', background: C.surface, borderRadius: 10,
                    fontSize: 13, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', fontFamily: 'monospace',
                  }}>
                    {window.location.origin}/register?academy={form.slug}
                  </div>
                  <button type="button" onClick={copyInviteLink} style={{
                    padding: '10px 18px', borderRadius: 10, border: 'none',
                    background: copied ? C.success : C.accent, color: C.white,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    whiteSpace: 'nowrap', transition: 'all 0.2s',
                  }}
                    onMouseOver={e => { if (!copied) e.currentTarget.style.background = C.accentDark; }}
                    onMouseOut={e => { if (!copied) e.currentTarget.style.background = C.accent; }}
                  >
                    {copied ? '복사됨!' : '복사'}
                  </button>
                </div>
              </div>

              {/* 안내 */}
              <div style={{
                padding: '14px 18px', borderRadius: 14, background: C.successBg,
                border: `1px solid oklch(90% 0.06 145)`, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="oklch(30% 0.12 145)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span style={{ fontSize: 13, color: 'oklch(30% 0.12 145)', fontWeight: 600 }}>
                  위에서 설정한 아이디와 비밀번호로 로그인해주세요.
                </span>
              </div>
            </div>

            <button style={{ ...primaryBtn, width: '100%' }} onClick={() => navigate(`/login?academy=${form.slug}`)}
              onMouseOver={e => { e.currentTarget.style.background = C.accentDark; e.currentTarget.style.boxShadow = '0 4px 12px oklch(55% 0.15 250 / 0.25)'; }}
              onMouseOut={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.boxShadow = 'none'; }}
            >로그인 페이지로 이동</button>
          </div>
        )}
      </div>
    </div>
  );
}
