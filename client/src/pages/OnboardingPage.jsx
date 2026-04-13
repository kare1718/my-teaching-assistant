import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../api';

const stepLabels = ['학원 정보', '관리자 계정', '설정 완료'];

const getPasswordStrength = (pw) => {
  if (!pw || pw.length < 4) return null;
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  if (pw.length >= 8 && hasLetter && hasNumber && hasSpecial) return { label: '강함', color: 'text-emerald-600', bg: 'bg-emerald-500', width: 'w-full' };
  if (pw.length >= 8 && ((hasLetter && hasNumber) || (hasLetter && hasSpecial) || (hasNumber && hasSpecial))) return { label: '보통', color: 'text-amber-500', bg: 'bg-amber-500', width: 'w-2/3' };
  return { label: '약함', color: 'text-[#ba1a1a]', bg: 'bg-[#ba1a1a]', width: 'w-1/3' };
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
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

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
    if (!agreePrivacy) {
      setError('개인정보 수집 및 이용에 동의해주세요.');
      return;
    }
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

  const progressWidth = step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full';

  const renderStepIndicator = () => (
    <div className="w-full mb-12">
      <div className="flex justify-between items-center mb-6">
        {stepLabels.map((label, i) => {
          const s = i + 1;
          const isActive = s === step || (step === 4 && s === 3);
          const isDone = s < step || step === 4;
          return (
            <div key={s} className="contents">
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  isDone
                    ? 'bg-[#102044] text-white'
                    : isActive
                    ? 'bg-[#004bf0] text-white ring-4 ring-[#dde1ff]'
                    : 'bg-[#e1e3e4] text-[#45464e]'
                }`}>
                  {isDone && !isActive ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : s}
                </div>
                <span className={`text-xs font-bold tracking-widest uppercase ${
                  isActive ? 'text-[#102044]' : isDone ? 'text-[#102044]' : 'text-[#75777f]'
                }`}>Step {s}</span>
              </div>
              {s < 3 && (
                <div className={`flex-grow h-px mx-4 ${isDone ? 'bg-[#102044]' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="w-full h-1.5 bg-[#e7e8e9] rounded-full overflow-hidden">
        <div className={`h-full bg-[#004bf0] transition-all duration-700 ease-out ${progressWidth}`} />
      </div>
    </div>
  );

  return (
    <div className="bg-[#f8f9fa] text-[#191c1d] min-h-screen flex flex-col">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 w-full px-8 py-6 flex items-center justify-between pointer-events-none z-10">
        <span className="text-[#102044] font-extrabold text-2xl tracking-tight">나만의 조교</span>
        <span className="text-[#45464e] text-sm font-medium">Help Center</span>
      </header>

      <main className="flex-grow flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[640px] flex flex-col items-center">

          {/* Step Indicator (steps 1-3, also shown on step 4 as all-done) */}
          {renderStepIndicator()}

          {/* Step Title */}
          {step <= 3 && (
            <div className="w-full mb-8 flex justify-between items-end">
              <h1 className="text-3xl font-bold tracking-tight text-[#102044]">
                {step === 1 && '학원 정보를 입력해주세요'}
                {step === 2 && '관리자 계정'}
                {step === 3 && '설정 확인'}
              </h1>
              <p className="text-sm text-[#45464e] mb-1">
                {step === 1 && '학원 운영을 위한 기본적인 정보를 설정합니다.'}
                {step === 2 && '시스템을 총괄할 계정 정보를 입력하세요.'}
                {step === 3 && '입력한 정보를 확인하고 학원을 등록합니다.'}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="w-full mb-6 px-5 py-4 bg-[#ffdad6] text-[#ba1a1a] rounded-lg text-sm font-medium flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}

          {/* Step 1: 학원 정보 */}
          {step === 1 && (
            <div className="w-full bg-white rounded-xl p-10 shadow-sm border border-slate-100">
              <form className="flex flex-col gap-6" onSubmit={e => e.preventDefault()}>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#45464e] uppercase tracking-widest ml-1">학원명</label>
                  <input
                    className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 transition-all text-[#191c1d] placeholder:text-[#75777f]/50 font-medium"
                    value={form.academyName}
                    onChange={update('academyName')}
                    placeholder="학원 이름을 입력하세요"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#45464e] uppercase tracking-widest ml-1">학원 접속 주소 (URL)</label>
                  <div className="relative flex items-center">
                    <input
                      className="w-full pl-5 pr-36 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 transition-all text-[#191c1d] font-medium"
                      value={form.slug}
                      onChange={update('slug')}
                      onBlur={checkSlug}
                      placeholder="my-academy"
                    />
                    <div className="absolute right-4 flex items-center gap-2">
                      <span className="text-[#45464e] font-medium text-sm">.namanui.com</span>
                      {slugAvailable === true && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-1">
                    {slugAvailable === true && (
                      <p className="text-xs text-emerald-600 font-semibold">사용 가능한 주소입니다</p>
                    )}
                    {slugAvailable === false && (
                      <p className="text-xs text-[#ba1a1a] font-semibold">이미 사용 중인 주소입니다</p>
                    )}
                    {form.slug && /[가-힣]/.test(form.slug) && (
                      <p className="text-xs text-amber-500 font-semibold">영문, 숫자, 하이픈(-)만 사용 가능합니다</p>
                    )}
                    <button
                      type="button"
                      onClick={autoSlug}
                      className="text-xs text-[#004bf0] font-bold hover:underline ml-auto"
                    >
                      자동 생성
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#45464e] uppercase tracking-widest ml-1">
                    주요 과목 <span className="font-normal text-[#75777f]">(선택)</span>
                  </label>
                  <input
                    className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 transition-all text-[#191c1d] placeholder:text-[#75777f]/50 font-medium"
                    value={form.subject}
                    onChange={update('subject')}
                    placeholder="예: 국어, 수학, 영어"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    className="w-full py-5 bg-[#102044] hover:bg-[#004bf0] text-white font-extrabold rounded-lg shadow-lg shadow-[#102044]/10 transition-all active:scale-[0.98] text-lg flex items-center justify-center gap-2"
                    onClick={() => {
                      if (!form.academyName || !form.slug) { setError('학원 이름과 주소를 입력해주세요.'); return; }
                      setError(''); setStep(2);
                    }}
                  >
                    다음 단계로 이동
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: 관리자 계정 */}
          {step === 2 && (
            <div className="w-full bg-white rounded-xl p-10 shadow-sm border border-slate-100">
              <form className="flex flex-col gap-6" onSubmit={e => e.preventDefault()}>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#45464e] uppercase tracking-widest ml-1">이름</label>
                  <input
                    className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 transition-all text-[#191c1d] placeholder:text-[#75777f]/50 font-medium"
                    value={form.adminName}
                    onChange={update('adminName')}
                    placeholder="성함을 입력하세요"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#45464e] uppercase tracking-widest ml-1">아이디</label>
                  <input
                    className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 transition-all text-[#191c1d] placeholder:text-[#75777f]/50 font-medium"
                    value={form.adminUsername}
                    onChange={update('adminUsername')}
                    placeholder="관리자 아이디"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#45464e] uppercase tracking-widest ml-1">휴대폰 번호</label>
                  <div className="flex gap-3">
                    <input
                      className="flex-grow px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 transition-all text-[#191c1d] placeholder:text-[#75777f]/50 font-medium"
                      value={form.adminPhone}
                      onChange={update('adminPhone')}
                      placeholder="010-0000-0000"
                      type="tel"
                    />
                    <button
                      type="button"
                      className="px-6 py-4 bg-[#e7e8e9] hover:bg-[#e1e3e4] text-[#102044] font-bold text-sm rounded-lg transition-colors shrink-0"
                    >
                      인증번호 발송
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#45464e] uppercase tracking-widest ml-1">비밀번호</label>
                    <input
                      className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 transition-all text-[#191c1d] font-medium"
                      type="password"
                      value={form.adminPassword}
                      onChange={update('adminPassword')}
                      placeholder="••••••••"
                    />
                    {pwStrength && (
                      <div className="mt-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs font-semibold ${pwStrength.color}`}>{pwStrength.label}</span>
                        </div>
                        <div className="h-1 rounded-full bg-[#e7e8e9]">
                          <div className={`h-full rounded-full ${pwStrength.bg} ${pwStrength.width} transition-all duration-300`} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#45464e] uppercase tracking-widest ml-1">비밀번호 확인</label>
                    <input
                      className={`w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 transition-all text-[#191c1d] font-medium ${
                        form.adminPasswordConfirm && form.adminPassword !== form.adminPasswordConfirm ? 'ring-2 ring-[#ba1a1a]/30' : ''
                      }`}
                      type="password"
                      value={form.adminPasswordConfirm}
                      onChange={update('adminPasswordConfirm')}
                      placeholder="••••••••"
                    />
                    {form.adminPasswordConfirm && form.adminPassword !== form.adminPasswordConfirm && (
                      <span className="text-xs text-[#ba1a1a] font-medium">비밀번호가 일치하지 않습니다</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#45464e] uppercase tracking-widest ml-1">계정 권한</label>
                  <div className="w-full px-5 py-4 bg-[#f3f4f5] rounded-lg border border-[#c5c6cf]/20 flex items-center justify-between">
                    <span className="text-[#191c1d] font-semibold">원장</span>
                    <span className="text-[10px] bg-[#102044] text-white px-2 py-0.5 rounded-full uppercase font-black tracking-tighter">Default Admin</span>
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button
                    type="button"
                    className="flex-1 py-5 border border-slate-200 text-[#102044] font-bold rounded-lg hover:bg-slate-50 transition-all active:scale-[0.98] text-lg"
                    onClick={() => setStep(1)}
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    className="flex-[2] py-5 bg-[#102044] hover:bg-[#004bf0] text-white font-extrabold rounded-lg shadow-lg shadow-[#102044]/10 transition-all active:scale-[0.98] text-lg flex items-center justify-center gap-2"
                    onClick={() => {
                      if (!form.adminName || !form.adminUsername || !form.adminPassword) { setError('필수 항목을 입력해주세요.'); return; }
                      if (form.adminPassword.length < 4) { setError('비밀번호는 최소 4자 이상이어야 합니다.'); return; }
                      if (form.adminPassword !== form.adminPasswordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
                      setError(''); setStep(3);
                    }}
                  >
                    다음 단계로 이동
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 3: 확인 */}
          {step === 3 && (
            <div className="w-full bg-white rounded-xl p-10 shadow-sm border border-slate-100">
              <div className="flex flex-col gap-6">
                {/* Summary */}
                <div className="bg-[#f3f4f5] rounded-xl p-6 flex flex-col gap-4">
                  <div className="text-xs font-bold text-[#75777f] uppercase tracking-widest mb-1">학원 정보</div>
                  <div className="flex justify-between items-center border-b border-[#c5c6cf]/20 pb-3">
                    <span className="text-sm font-medium text-[#45464e]">학원명</span>
                    <span className="text-base font-bold text-[#102044]">{form.academyName}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#c5c6cf]/20 pb-3">
                    <span className="text-sm font-medium text-[#45464e]">URL</span>
                    <span className="text-base font-medium text-[#004bf0] underline underline-offset-4">{form.slug}.namanui.com</span>
                  </div>
                  {form.subject && (
                    <div className="flex justify-between items-center border-b border-[#c5c6cf]/20 pb-3">
                      <span className="text-sm font-medium text-[#45464e]">과목</span>
                      <span className="text-base text-[#191c1d]">{form.subject}</span>
                    </div>
                  )}
                  <div className="text-xs font-bold text-[#75777f] uppercase tracking-widest mt-2 mb-1">관리자</div>
                  <div className="flex justify-between items-center border-b border-[#c5c6cf]/20 pb-3">
                    <span className="text-sm font-medium text-[#45464e]">이름 (아이디)</span>
                    <span className="text-base font-bold text-[#102044]">{form.adminName} ({form.adminUsername})</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-[#45464e]">대표 연락처</span>
                    <span className="text-base text-[#191c1d]">{form.adminPhone || '000-0000-0000'}</span>
                  </div>
                  {form.adminPhone2 && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-medium text-[#45464e]">보조 연락처</span>
                      <span className="text-base text-[#191c1d]">{form.adminPhone2}</span>
                    </div>
                  )}
                </div>

                {/* 14일 무료 안내 */}
                <div className="bg-emerald-50 rounded-xl p-5 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg>
                  </div>
                  <div>
                    <p className="font-bold text-emerald-700 text-sm mb-0.5">14일 무료 체험으로 시작!</p>
                    <p className="text-slate-600 text-sm">전체 기능을 무료로 체험해보세요. 카드 등록 없이 바로 시작합니다.</p>
                  </div>
                </div>

                {/* 개인정보 동의 */}
                <div className="bg-[#f3f4f5] rounded-xl p-5">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-200 mb-4">
                    <input
                      type="checkbox"
                      checked={agreePrivacy && agreeMarketing}
                      onChange={(e) => { setAgreePrivacy(e.target.checked); setAgreeMarketing(e.target.checked); }}
                      id="obAgreeAll"
                      className="w-5 h-5 cursor-pointer accent-[#004bf0] rounded"
                    />
                    <label htmlFor="obAgreeAll" className="cursor-pointer text-sm font-bold text-[#191c1d]">
                      전체 동의하기
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)}
                      id="obAgreePrivacy"
                      className="mt-0.5 w-[18px] h-[18px] cursor-pointer accent-[#004bf0] rounded"
                    />
                    <label htmlFor="obAgreePrivacy" className="cursor-pointer text-sm text-[#191c1d] leading-relaxed">
                      <b>[필수]</b> 개인정보 수집 및 이용에 동의합니다.
                    </label>
                  </div>
                  <button type="button" onClick={() => setShowPrivacy(!showPrivacy)}
                    className="text-xs text-[#004bf0] font-semibold mt-1.5 ml-8 hover:underline">
                    {showPrivacy ? '접기' : '내용 보기'}
                  </button>
                  {showPrivacy && (
                    <div className="mt-3 ml-8 p-4 bg-white rounded-lg text-xs leading-relaxed text-slate-500 max-h-[200px] overflow-auto border border-slate-200">
                      <p>'나만의 조교' 서비스 제공을 위해 아래와 같이 개인정보를 수집 및 이용합니다.</p>
                      <p className="mt-2 font-bold text-slate-600">수집 항목</p>
                      <p>- 성명, 휴대전화 번호</p>
                      <p className="mt-2 font-bold text-slate-600">수집 및 이용 목적</p>
                      <p>- 서비스 이용에 따른 본인 확인, 학습 관리 서비스 제공, 원활한 상담 및 주요 공지사항 전달</p>
                      <p className="mt-2 font-bold text-slate-600">보유 및 이용 기간</p>
                      <p>- 서비스 탈퇴 시 또는 이용 목적 달성 시까지</p>
                      <p>- 단, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관</p>
                    </div>
                  )}

                  <div className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-200">
                    <input
                      type="checkbox" checked={agreeMarketing} onChange={(e) => setAgreeMarketing(e.target.checked)}
                      id="obAgreeMarketing"
                      className="mt-0.5 w-[18px] h-[18px] cursor-pointer accent-[#004bf0] rounded"
                    />
                    <div>
                      <label htmlFor="obAgreeMarketing" className="cursor-pointer text-sm text-[#191c1d] leading-relaxed">
                        <span className="text-[#75777f]">[선택]</span> 마케팅 정보 수신 및 광고 활용에 동의합니다.
                      </label>
                      <div className="text-xs text-[#75777f] mt-1 leading-relaxed">
                        <p>신규 강의 및 커리큘럼 안내, 신규 교재 출시 정보 제공, 이벤트 및 홍보성 메시지 발송</p>
                        <p className="mt-0.5">동의하지 않아도 서비스 이용에 제한이 없습니다. 동의 후 언제든 철회할 수 있습니다.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    className="flex-1 py-5 border border-slate-200 text-[#102044] font-bold rounded-lg hover:bg-slate-50 transition-all active:scale-[0.98] text-lg"
                    onClick={() => setStep(2)}
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    className={`flex-[2] py-5 bg-[#102044] text-white font-extrabold rounded-lg shadow-lg shadow-[#102044]/10 transition-all active:scale-[0.98] text-lg ${
                      !agreePrivacy || loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#004bf0]'
                    }`}
                    onClick={handleSubmit}
                    disabled={loading || !agreePrivacy}
                  >
                    {loading ? '생성 중...' : '학원 만들기'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: 성공 화면 */}
          {step === 4 && (
            <div className="w-full bg-white rounded-xl p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col items-center text-center">
              {/* Success Icon */}
              <div className="mb-6 w-20 h-20 rounded-full bg-[#dde1ff] flex items-center justify-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0037b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>
              </div>

              <h1 className="text-[32px] font-bold tracking-tight text-[#102044] mb-2">모든 설정이 완료되었습니다!</h1>
              <p className="text-[#45464e] mb-10">나만의 조교의 스마트한 관리 시스템이 준비되었습니다.</p>

              {/* Summary Card */}
              <div className="w-full bg-[#f3f4f5] rounded-xl p-6 text-left flex flex-col gap-4 mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#c5c6cf]/20 pb-3">
                  <span className="text-sm font-medium text-[#45464e]">학원명</span>
                  <span className="text-base font-bold text-[#102044]">{form.academyName}</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#c5c6cf]/20 pb-3">
                  <span className="text-sm font-medium text-[#45464e]">URL</span>
                  <span className="text-base font-medium text-[#004bf0] underline underline-offset-4">{form.slug}.namanui.com</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between">
                  <span className="text-sm font-medium text-[#45464e]">관리자</span>
                  <span className="text-base font-semibold text-[#102044]">{form.adminName} (원장)</span>
                </div>
              </div>

              {/* Checklist */}
              <div className="w-full flex flex-col gap-3 mb-8">
                {['학원 등록 완료', '관리자 계정 생성', '14일 무료 체험 시작'].map((text, i) => (
                  <div key={i} className="flex items-center gap-3 px-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#102044" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    <span className="text-[#191c1d] font-medium">{text}</span>
                  </div>
                ))}
              </div>

              {/* Invite Link */}
              <div className="w-full mb-6">
                <div className="text-xs font-bold text-[#45464e] uppercase tracking-widest mb-3 text-left ml-1">학생 초대 링크</div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 px-4 py-3 bg-[#f3f4f5] rounded-lg text-sm text-[#45464e] overflow-hidden text-ellipsis whitespace-nowrap font-mono">
                    {window.location.origin}/register?academy={form.slug}
                  </div>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className={`px-5 py-3 rounded-lg text-sm font-bold transition-all shrink-0 ${
                      copied ? 'bg-emerald-500 text-white' : 'bg-[#004bf0] text-white hover:bg-[#0037b8]'
                    }`}
                  >
                    {copied ? '복사됨!' : '복사'}
                  </button>
                </div>
              </div>

              {/* CTA */}
              <button
                className="w-full py-4 px-6 bg-[#102044] text-white rounded-xl font-bold text-lg hover:bg-[#004bf0] transition-all active:scale-[0.98] focus:ring-4 focus:ring-[#102044]/20"
                onClick={() => navigate(`/login?academy=${form.slug}`)}
              >
                시작하기
              </button>
            </div>
          )}

          {/* Footer */}
          <p className="mt-8 text-[#45464e] text-sm text-center">
            문제가 발생하셨나요?{' '}
            <button className="text-[#004bf0] font-bold hover:underline">고객 센터</button>에 문의하세요.
          </p>
        </div>
      </main>

      {/* Decorative Background */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-50">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#c2d1fe] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-[#dde1ff] blur-[100px] rounded-full" />
      </div>
    </div>
  );
}
