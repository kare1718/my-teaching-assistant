import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isLoggedIn, getUser } from '../api';

const C = {
  accent: 'var(--primary)', accentLight: 'var(--primary-light)', accentBg: 'oklch(55% 0.15 250 / 0.05)',
  textPrimary: 'var(--foreground)', textSecondary: 'var(--muted-foreground)', textTertiary: 'var(--neutral-400)',
  surfaceCard: 'var(--muted)', border: 'var(--border)', white: 'var(--card)',
};

function useScrolled() {
  const [s, setS] = useState(false);
  useEffect(() => {
    const h = () => setS(window.scrollY > 10);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return s;
}

function useReveal() {
  const refs = useRef([]);
  const [visible, setVisible] = useState(new Set());
  const addRef = useCallback((el) => { if (el && !refs.current.includes(el)) refs.current.push(el); }, []);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setVisible(prev => new Set(prev).add(e.target));
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    refs.current.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return { addRef, isVisible: (el) => visible.has(el) };
}

function useCountUp(target, decimals = 0, suffix = '', duration = 2000) {
  const [value, setValue] = useState('0' + suffix);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      const st = performance.now();
      function anim(now) {
        const p = Math.min((now - st) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const c = eased * target;
        if (p < 1) {
          setValue(decimals > 0 ? c.toFixed(decimals) + suffix : Math.floor(c).toLocaleString() + suffix);
          requestAnimationFrame(anim);
        } else {
          setValue(decimals > 0 ? target.toFixed(decimals) + suffix : target.toLocaleString() + '+' + suffix);
        }
      }
      requestAnimationFrame(anim);
      obs.unobserve(ref.current);
    }, { threshold: 0.5 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, value };
}

// SVG Icons
const ArrowRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
const Shield = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>;
const Check = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>;
const ChevronDown = ({ open }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.3s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}><path d="M6 9l6 6 6-6"/></svg>;
const Clock = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
const Heart = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const Menu = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>;
const X = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>;

// Phone Mockup wrapper
function PhoneMockup({ headerColor, headerTitle, headerSub, children }) {
  return (
    <div style={{ background: 'oklch(13% 0.02 250)', borderRadius: '2.5rem', padding: 12, boxShadow: '0 25px 60px -15px oklch(0% 0 0 / 0.15), 0 0 0 1px oklch(0% 0 0 / 0.05)', width: 280, maxWidth: '100%' }}>
      <div style={{ background: C.white, borderRadius: '2rem', overflow: 'hidden' }}>
        <div style={{ background: headerColor, padding: '12px 20px 16px', color: C.white }}>
          <p style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>{headerSub}</p>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{headerTitle}</p>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--muted)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function MockCard({ children, style }) {
  return <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid var(--neutral-100)`, ...style }}>{children}</div>;
}

// Data
const problems = [
  { icon: '💬', title: '학부모·학생 소통', time: '하루 1시간+ / 한 달 30시간+', desc: '단체방 공지, 개별 문의, 숙제 독촉, 상담 일정 조율까지. 퇴근 후에도 카톡 알림이 울리고, 내 번호가 온 동네에 퍼져 있습니다.', color: 'var(--destructive)', bg: 'var(--destructive-light)' },
  { icon: '📋', title: '출결·수납', time: '하루 40분 / 한 달 20시간', desc: '매일 수기로 출석 체크. 엑셀 장부에 수납을 기록하다 미납 학생을 놓치고, 한 달 뒤에야 발견. 누락률 12~18%.', color: 'oklch(60% 0.18 50)', bg: 'oklch(95% 0.03 75)' },
  { icon: '👥', title: '조교 관리', time: '하루 30분 / 한 달 15시간', desc: '업무 지시, 클리닉 스케줄, 숙제 배정, 시간표, 대타 배정까지. 체계 없이 구두로 돌아가다 보니 빠지는 학생이 생깁니다.', color: 'oklch(55% 0.20 290)', bg: 'oklch(94% 0.04 300)' },
  { icon: '📊', title: '성적·상담 준비', time: '하루 30분 / 한 달 15시간', desc: '상담인데 보여줄 자료가 없습니다. 기억에 의존하면 학부모는 "감으로 가르치나?" 라고 느끼고, 숙제 동기부여 방법도 없습니다.', color: 'var(--warning)', bg: 'var(--warning-light)' },
];

const testimonials1 = [
  { text: '수납 누락이 0건이 됐습니다. 자동 청구 알림 세팅하고 3개월째 미납 0건. 연간 수백만 원 차이예요.', who: '김○진 · 국어학원 원장 · 학생 35명 · 경기 분당' },
  { text: '학부모 카톡이 80% 줄었어요. 밤 10시 카톡이 안 오니까 퇴근이 생겼습니다.', who: '박○현 · 영어학원 원장 · 학생 28명 · 서울 목동' },
  { text: '학생들이 먼저 포인트 확인해요. "선생님 오늘 퀴즈 없어요?" 라고 먼저 물어보는 게 신기합니다.', who: '이○수 · 입시국어 강사 · 학생 22명 · 인천 부평' },
  { text: '상담할 때 자신감이 생겼습니다. 성적 추이 그래프를 보여주면서 설명하니까 학부모 반응이 확 달라요.', who: '최○영 · 수학학원 원장 · 학생 40명 · 대전 둔산' },
  { text: '엑셀 10개 파일이 앱 하나로. 학생 현황 파악이 10분에서 1분으로 줄었습니다.', who: '한○미 · 과학학원 원장 · 학생 18명 · 대구 수성' },
  { text: '조교 관리가 제일 큰 변화예요. 앱에서 배정하면 체크리스트로 확인하니까 빠지는 학생이 없어졌습니다.', who: '정○혁 · 종합학원 원장 · 학생 60명 · 서울 대치' },
  { text: '클리닉 예약부터 출결까지 한 번에 보여서, 보충이 진짜 보충이 됩니다.', who: '서○은 · 수학학원 강사 · 학생 45명 · 경기 일산' },
  { text: '하루에 2시간은 벌었어요, 진짜로. 그 시간에 교재 연구를 합니다.', who: '윤○라 · 국어학원 강사 · 학생 32명 · 부산 해운대' },
];

const testimonials2 = [
  { text: '결석 알림이 바로 오니까 학부모한테 먼저 연락할 수 있어요. 신뢰가 확 올라갑니다.', who: '강○희 · 영어학원 강사 · 학생 20명 · 서울 강남' },
  { text: '게이미피케이션 도입 후 숙제 이행률이 2배가 됐어요. 애들이 포인트 모으려고 난리입니다.', who: '오○준 · 수학학원 원장 · 학생 55명 · 경기 수원' },
  { text: '수납 문자 자동 발송 덕분에 어색한 독촉 전화를 안 해도 됩니다. 학부모 관계도 좋아졌어요.', who: '문○정 · 국어학원 원장 · 학생 25명 · 충남 천안' },
  { text: 'AI 문항 출제가 대박이에요. 시험지 만드는 데 주말을 쓰고 있었는데, 이제 10분이면 끝나요.', who: '임○호 · 입시국어 강사 · 학생 30명 · 서울 노원' },
  { text: '조교가 4명인데, 이전에는 누가 뭘 하는지 파악이 안 됐어요. 지금은 한 화면에서 다 보입니다.', who: '배○진 · 종합학원 원장 · 학생 80명 · 대구 달서' },
  { text: '학부모 전용 페이지 보내드리면 "이런 학원 처음이에요"라고 하십니다. 학원 이미지가 올라가요.', who: '양○서 · 영어학원 원장 · 학생 38명 · 경기 용인' },
  { text: '성적 분석 대시보드 보여주면서 상담하면 학부모가 재등록 고민을 안 합니다. 데이터의 힘이에요.', who: '조○현 · 수학학원 원장 · 학생 42명 · 광주 남구' },
];

const plans = [
  { id: 'free', name: 'Free', price: 0, yearlyPrice: 0, students: '10명', features: ['학생 10명', '성적 관리', '게이미피케이션', '기본 기능'], desc: '소규모 수업에 딱' },
  { id: 'basic', name: 'Basic', price: 79000, yearlyPrice: 67000, students: '50명', features: ['학생 50명', '성적 관리', '게이미피케이션', '랭킹/상점', '안내사항/자료'], desc: '성장하는 학원을 위한' },
  { id: 'standard', name: 'Standard', price: 159000, yearlyPrice: 135000, students: '100명', features: ['학생 100명', 'Basic 전체 포함', 'AI 리포트', 'SMS 발송', '클리닉/숙제', '출결 알림'], desc: '가장 인기 있는 플랜', popular: true },
  { id: 'pro', name: 'Pro', price: 0, yearlyPrice: 0, students: '100명 이상', features: ['학생 무제한', 'Standard 전체 포함', '조교 관리', '수납 관리', 'API 내보내기', '전담 매니저'], desc: '대형 학원 맞춤', inquiry: true },
];

const comparisonRows = [
  ['만든 사람', '개발사', '현직 강사가 매일 쓰면서 고쳐나간 결과물'],
  ['조교 관리', '없음', '업무 배정 · 클리닉 · 스케줄 · 대타'],
  ['게이미피케이션', '없음', '포인트 · 레벨 · 아바타 · 퀴즈'],
  ['AI 문항 출제', '없음', '수능형 맞춤 문항 자동 생성'],
  ['성적 분석', '단순 점수 기록', '영역별 취약점 · 추이 자동 분석'],
  ['학부모 페이지', '일방향 알림', '출결 · 성적 · 숙제 실시간 확인'],
];

const faqCategories = [
  { label: '출결 / 수납', items: [
    { q: '출결 체크는 어떤 방식으로 하나요?', a: 'QR 체크인, 태블릿 터치, 강사 수동 체크 세 가지를 지원합니다. 어떤 방식이든 체크 즉시 학부모에게 출석 알림이 자동 발송됩니다.' },
    { q: '수납 자동 청구는 구체적으로 어떻게 작동하나요?', a: '학생 등록 시 수납일을 설정하면 D-3일 납부 안내, D-Day 리마인드, D+1일 연체 표시까지 자동 처리됩니다. 도입 학원의 미납률이 평균 12%에서 2% 이하로 떨어졌습니다.' },
    { q: '학부모가 카드 결제나 계좌이체로 바로 납부할 수 있나요?', a: '네. 안내 문자의 결제 링크를 통해 카드 결제, 계좌이체, 네이버페이, 카카오페이 등으로 바로 납부 가능합니다.' },
  ]},
  { label: '조교 관리', items: [
    { q: '조교에게 어떤 업무를 배정할 수 있나요?', a: '클리닉(보충수업) 진행, 숙제 확인/채점, 학생 관리 등 모든 업무를 체크리스트로 배정합니다. 완료 체크하면 결과가 선생님에게 자동 보고됩니다.' },
    { q: '조교 시간표 관리와 대타 배정은 어떻게 하나요?', a: '조교별 주간 시간표를 등록하면 스케줄 충돌 시 자동 알림이 표시됩니다. 결근 시 대타 가능한 조교 목록을 확인하고 한 번에 배정할 수 있어요.' },
    { q: '조교도 별도 앱을 설치해야 하나요?', a: '웹 브라우저에서 바로 접속할 수 있어서 별도 앱 설치가 필요 없습니다. 조교 계정에서는 자신에게 배정된 업무만 보입니다.' },
  ]},
  { label: '학부모 소통', items: [
    { q: '학부모 전용 페이지에서 뭘 볼 수 있나요?', a: '출결 현황, 성적 추이, 숙제 현황, 수납 내역, 상담 예약까지 한 페이지에서 다 확인할 수 있습니다.' },
    { q: '학부모도 앱을 설치해야 하나요?', a: '아닙니다. 카카오톡이나 문자로 링크를 보내드리면, 터치 한 번으로 바로 볼 수 있습니다. 앱 설치 허들을 완전히 없앴습니다.' },
    { q: '선생님 개인 전화번호가 학부모에게 노출되나요?', a: '아닙니다. 모든 문자는 시스템 발신번호로 발송됩니다. 퇴근 후 개인 카톡으로 학부모 연락이 오는 문제를 원천적으로 해결합니다.' },
  ]},
  { label: '성적 / 게이미피케이션', items: [
    { q: '성적 분석 대시보드에서 구체적으로 뭘 볼 수 있나요?', a: '시험별 점수 추이, 영역별 취약점 분석, 반 내 위치, 목표 달성률을 자동 생성합니다.' },
    { q: '게이미피케이션이 실제로 효과가 있나요?', a: '포인트, 레벨, 아바타 커스터마이징으로 학생이 자발적으로 참여합니다. 도입 학원 평균 숙제 이행률 40% 상승, 6개월 이상 사용 학원에서도 효과 유지 중입니다.' },
    { q: 'AI 문항 출제는 어떤 과목을 지원하나요?', a: '현재 국어(수능형)을 가장 깊이 지원합니다. 학생별 취약 영역 맞춤 출제, 난이도 자동 조절이 가능해요. 다른 과목도 순차 확대 중입니다.' },
  ]},
  { label: '요금 / 시작하기', items: [
    { q: '무료 체험 후 자동 결제되나요?', a: '절대 아닙니다. 카드 정보를 받지 않기 때문에 자동 결제가 불가능합니다. 30일 체험이 끝나면 Free 플랜(학생 5명)으로 자동 전환됩니다.' },
    { q: '초기 세팅이 복잡하지 않나요?', a: '5분이면 끝납니다. 학원 이름 + 수업 시간 + 학생 이름만 입력하면 바로 사용 가능. 기존 엑셀 일괄 업로드도 지원합니다.' },
    { q: '국어 전용 앱인가요?', a: '모든 과목에서 사용 가능합니다. AI 문항 출제만 현재 국어 중심이고 다른 과목도 순차 확대 중입니다.' },
    { q: '학생 5명 이하면 정말 평생 무료인가요?', a: '네, 진짜 평생 무료입니다. 기간 제한 없고, 출결·수납·학부모 페이지까지 모두 포함이에요.' },
    { q: '기존 엑셀 데이터를 옮길 수 있나요?', a: '네. 학생 명단, 연락처, 성적 데이터를 엑셀로 일괄 업로드할 수 있습니다.' },
  ]},
];

export default function LandingPage() {
  const navigate = useNavigate();
  const user = getUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);
  const [landingYearly, setLandingYearly] = useState(true);
  const scrolled = useScrolled();
  const { addRef, isVisible } = useReveal();

  const m1 = useCountUp(2847, 0, '');
  const m2 = useCountUp(98.7, 1, '%');
  const m3 = useCountUp(4.87, 2, '/5.0');
  const m4 = useCountUp(90, 0, '%');

  useEffect(() => {
    if (isLoggedIn() && user) {
      const isAssistant = user.school === '조교';
      navigate((user.role === 'admin' || isAssistant) ? '/admin' : '/student', { replace: true });
    }
  }, [user, navigate]);

  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const revealStyle = (el) => ({
    opacity: isVisible(el) ? 1 : 0,
    transform: isVisible(el) ? 'translateY(0)' : 'translateY(24px)',
    transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
  });

  const navLinks = [
    { label: '이야기', id: 'problem' },
    { label: '기능', id: 'features' },
    { label: '후기', id: 'testimonials' },
    { label: '가격', id: 'pricing' },
    { label: 'FAQ', id: 'faq' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.white, fontFamily: "'Paperlogy', system-ui, sans-serif", color: C.textPrimary }}>
      <style>{`
        @keyframes lp-scrollLeft { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes lp-scrollRight { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
        .lp-marquee-1 { animation: lp-scrollLeft 60s linear infinite; }
        .lp-marquee-1:hover { animation-play-state: paused; }
        .lp-marquee-2 { animation: lp-scrollRight 65s linear infinite; }
        .lp-marquee-2:hover { animation-play-state: paused; }
        @media (max-width: 768px) {
          .lp-hero-grid { grid-template-columns: 1fr !important; }
          .lp-feature-grid { grid-template-columns: 1fr !important; }
          .lp-feature-reverse { direction: ltr !important; }
          .lp-metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-nav-links { display: none !important; }
          .lp-mobile-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .lp-mobile-menu { display: none !important; }
          .lp-mobile-btn { display: none !important; }
        }
      `}</style>

      {/* === NAV === */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: scrolled ? 'oklch(100% 0 0 / 0.8)' : 'oklch(100% 0 0 / 0.8)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`, transition: 'all 0.2s',
      }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="#" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, textDecoration: 'none' }}>나만의 조교</a>
          <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 14, color: C.textSecondary }}>
            {navLinks.map(l => (
              <a key={l.id} href={`#${l.id}`} onClick={e => { e.preventDefault(); scrollTo(l.id); }} style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.color = C.textPrimary} onMouseOut={e => e.currentTarget.style.color = C.textSecondary}>{l.label}</a>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/login')} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
              background: 'transparent', color: C.textSecondary, border: `1px solid ${C.border}`, transition: 'all 0.2s',
            }} onMouseOver={e => { e.currentTarget.style.background = C.surfaceCard; }} onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>로그인</button>
            <button onClick={() => navigate('/onboarding')} style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: 'pointer',
              background: C.accent, color: C.white, border: 'none', transition: 'all 0.2s',
            }} onMouseOver={e => { e.currentTarget.style.background = C.accentLight; }} onMouseOut={e => { e.currentTarget.style.background = C.accent; }}>무료 체험</button>
            <button className="lp-mobile-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
              display: 'none', width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
            }}>{mobileMenuOpen ? <X /> : <Menu />}</button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="lp-mobile-menu" style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: 16 }}>
            {navLinks.map(l => (
              <a key={l.id} href={`#${l.id}`} onClick={e => { e.preventDefault(); scrollTo(l.id); }} style={{
                display: 'block', padding: '12px 16px', borderRadius: 12, fontSize: 14, color: C.textSecondary,
                textDecoration: 'none', transition: 'background 0.2s',
              }} onMouseOver={e => { e.currentTarget.style.background = C.surfaceCard; }} onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>{l.label}</a>
            ))}
          </div>
        )}
      </nav>

      {/* === HERO === */}
      <section style={{ paddingTop: 128, paddingBottom: 80 }}>
        <div className="lp-hero-grid" style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div>
            <div ref={addRef} style={{ opacity: 1, transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500, background: C.accentBg, color: C.accent, marginBottom: 24 }}>
                <Shield /> 현재 2,800명+ 학생이 사용 중
              </span>
            </div>
            <h1 ref={addRef} style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2, color: C.textPrimary, marginBottom: 24 }}>
              저는 하루 3시간을<br/>돌려받았습니다.
            </h1>
            <p ref={addRef} style={{ fontSize: 18, color: C.textSecondary, lineHeight: 1.7, maxWidth: '48ch', marginBottom: 16 }}>
              학부모 카톡 1시간, 출결·수납 40분, 조교 관리 30분, 성적 정리 30분. 매일 3시간씩, 수업이 아니라 잡무를 하고 있었습니다.
            </p>
            <p ref={addRef} style={{ fontSize: 14, color: C.textTertiary, marginBottom: 32 }}>
              학원 관리 앱 3개를 써봤지만, 불편하고 안 되는 게 너무 많았습니다. 그래서 직접 만들었습니다.
            </p>
            <div ref={addRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <button onClick={() => navigate('/onboarding')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, background: C.accent, color: C.white,
                fontWeight: 700, fontSize: 16, padding: '16px 28px', borderRadius: 16, border: 'none', cursor: 'pointer',
                transition: 'all 0.2s', boxShadow: '0 4px 12px oklch(55% 0.15 250 / 0.2)',
              }} onMouseOver={e => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.boxShadow = '0 8px 24px oklch(55% 0.15 250 / 0.25)'; }}
                 onMouseOut={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.boxShadow = '0 4px 12px oklch(55% 0.15 250 / 0.2)'; }}>
                30일 무료 체험 시작하기 <ArrowRight />
              </button>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.textTertiary }}>
                <Shield /> 카드 등록 없이 · 30일 전체 기능 체험
              </span>
            </div>
          </div>
          <div ref={addRef} style={{ display: 'flex', justifyContent: 'center' }}>
            <PhoneMockup headerColor={C.accent} headerTitle="대시보드" headerSub="나만의 조교">
              {/* 초대코드 */}
              <MockCard style={{ padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--muted)' }}>
                <div>
                  <p style={{ fontSize: 9, color: C.textTertiary }}>학원 초대 코드</p>
                  <p style={{ fontSize: 16, fontWeight: 800, letterSpacing: 3, color: C.accent, fontFamily: 'monospace' }}>A7K2M9</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.accent, padding: '4px 10px', borderRadius: 6, background: C.accentBg, cursor: 'pointer' }}>복사</span>
              </MockCard>
              {/* 조치 필요 */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[{ label: '가입 승인', val: 2, c: 'var(--destructive)', bg: 'var(--destructive-light)' }, { label: '미납', val: 3, c: 'var(--warning)', bg: 'var(--warning-light)' }, { label: '수정 요청', val: 1, c: C.accent, bg: C.accentBg }].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, background: item.bg, border: `1px solid ${item.c}20` }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: item.c }}>{item.val}</span>
                    <span style={{ fontSize: 9, color: item.c, fontWeight: 600 }}>{item.label}</span>
                  </div>
                ))}
              </div>
              {/* KPI 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[{ label: '재원생', val: '47', unit: '명', c: C.accent }, { label: '오늘 클리닉', val: '3', unit: '건', c: 'oklch(55% 0.20 290)' }, { label: '이번 주 수업', val: '12', unit: '회', c: 'var(--success)' }, { label: '다음 시험', val: 'D-5', unit: '', c: 'var(--warning)' }].map((item, i) => (
                  <MockCard key={i} style={{ padding: 10 }}>
                    <p style={{ fontSize: 8, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', marginBottom: 2 }}>{item.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: item.c }}>{item.val}<span style={{ fontSize: 10, fontWeight: 500, color: C.textTertiary }}>{item.unit}</span></p>
                  </MockCard>
                ))}
              </div>
              {/* 학교별 현황 */}
              <MockCard style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary }}>학교별 현황</span>
                  <span style={{ fontSize: 10, color: C.accent, fontWeight: 700 }}>47명</span>
                </div>
                {[['A고등학교', 15], ['B고등학교', 12], ['C고등학교', 10], ['중3', 10]].map(([name, cnt], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 6, background: i === 0 ? C.accentBg : 'transparent', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: C.textSecondary }}>{name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.accent }}>{cnt}명</span>
                  </div>
                ))}
              </MockCard>
            </PhoneMockup>
          </div>
        </div>
      </section>

      {/* === METRICS === */}
      <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '48px 0' }}>
        <div className="lp-metrics-grid" style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, textAlign: 'center' }}>
          {[m1, m2, m3, m4].map((m, i) => (
            <div key={i} ref={m.ref}>
              <p style={{ fontSize: 30, fontWeight: 700, color: C.textPrimary }}>{m.value}</p>
              <p style={{ fontSize: 14, color: C.textTertiary, marginTop: 4 }}>
                {['학생이 매일 사용 중', '수납을 놓치지 않습니다', '선생님 만족도', '학부모 카톡이 줄었습니다'][i]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* === PROBLEM === */}
      <section id="problem" style={{ padding: '96px 0' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
          <div ref={addRef} style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 12 }}>저도 그랬습니다</p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.3 }}>
              수업은 2시간, 잡무는 3시간. 매일 이랬습니다.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {problems.map((p, i) => (
              <div key={i} ref={addRef} style={{
                background: C.surfaceCard, borderRadius: 16, padding: 28, border: `1px solid ${C.border}`,
                transition: 'box-shadow 0.2s, border-color 0.2s',
              }} onMouseOver={e => { e.currentTarget.style.boxShadow = '0 4px 16px oklch(0% 0 0 / 0.06)'; e.currentTarget.style.borderColor = 'oklch(92% 0.01 260 / 0.6)'; }}
                 onMouseOut={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = C.border; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{p.icon}</div>
                  <div>
                    <h3 style={{ fontWeight: 700, color: C.textPrimary, fontSize: 15 }}>{p.title}</h3>
                    <p style={{ fontSize: 12, color: p.color, fontWeight: 500 }}>{p.time}</p>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7 }}>{p.desc}</p>
              </div>
            ))}
          </div>
          <div ref={addRef} style={{ marginTop: 32, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--destructive-light)', color: 'var(--destructive)', fontWeight: 700, fontSize: 16, padding: '16px 32px', borderRadius: 16 }}>
              <Clock /> 하루 3시간, 한 달 90시간. 수업 준비를 할 수가 없었습니다.
            </div>
          </div>
        </div>
      </section>

      {/* === FEATURES === */}
      <section id="features" style={{ padding: '96px 0', background: C.surfaceCard }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
          <div ref={addRef} style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 12 }}>그래서 이렇게 만들었습니다</p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.3 }}>직접 써보면서 필요했던 것들</h2>
          </div>

          {/* Feature 1: Parent Page */}
          <div className="lp-feature-grid" ref={addRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', marginBottom: 96 }}>
            <div>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 20 }}>👨‍👩‍👧</div>
              <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>학부모 전용 페이지</h3>
              <p style={{ color: C.accent, fontWeight: 500, fontSize: 14, marginBottom: 16 }}>카톡 90% 감소</p>
              <p style={{ color: C.textSecondary, lineHeight: 1.7, marginBottom: 24 }}>출결, 성적, 숙제 현황을 학부모가 직접 확인합니다. 선생님 개인번호 대신 시스템이 소통하니까, 퇴근 후 카톡이 사라집니다.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['출결 현황', '성적 추이', '포트폴리오', '수납 / 결제'].map((t, i) => (
                  <span key={i} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, background: i === 0 ? C.accentBg : 'var(--neutral-100)', color: i === 0 ? C.accent : C.textSecondary, fontWeight: 500 }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PhoneMockup headerColor={C.accent} headerTitle="김하윤 학생" headerSub="학부모 페이지">
                {/* 출결 현황 - 캘린더 스타일 */}
                <MockCard>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 8 }}>4월 출결 현황</p>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    {['월','화','수','목','금'].map((d, i) => (
                      <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: C.textTertiary, fontWeight: 600 }}>{d}</span>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                    {[1,1,1,1,1, 1,1,0,1,1].map((v, i) => (
                      <span key={i} style={{ height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, background: v ? C.accent : 'var(--destructive-light)', color: v ? C.white : 'var(--destructive)' }}>{v ? '✓' : '결'}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 9, color: C.accent, fontWeight: 600, marginTop: 6, textAlign: 'right' }}>출석률 90% (9/10회)</p>
                </MockCard>
                {/* 성적 추이 - 실제 시험명 포함 */}
                <MockCard>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 8 }}>성적 추이</p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 52 }}>
                    {[{ h: 45, label: '1차', score: '62' }, { h: 58, label: '2차', score: '71' }, { h: 52, label: '3차', score: '68' }, { h: 72, label: '4차', score: '80' }, { h: 88, label: '5차', score: '92' }].map((d, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, color: i === 4 ? C.accent : C.textTertiary }}>{d.score}</span>
                        <div style={{ width: '100%', height: `${d.h}%`, borderRadius: '4px 4px 0 0', background: i === 4 ? C.accent : i === 3 ? 'oklch(55% 0.15 250 / 0.3)' : 'var(--neutral-200)', transition: 'height 0.3s' }} />
                        <span style={{ fontSize: 7, color: i === 4 ? C.accent : C.textTertiary, fontWeight: i === 4 ? 700 : 400 }}>{d.label}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 9, color: 'var(--destructive)', marginTop: 6 }}>⚠️ 오답률 높은 영역: 비문학 추론</p>
                </MockCard>
                {/* 과제 현황 - 진행률 바 추가 */}
                <MockCard>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary }}>과제 현황</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--success)', padding: '2px 6px', background: 'var(--success-light)', borderRadius: 4 }}>2/3 완료</span>
                  </div>
                  {[['독서록 제출', '완료', C.accent], ['어휘 테스트 복습', '진행중', 'var(--warning)'], ['비문학 풀이 5지문', '미제출', C.textTertiary]].map(([t, s, c], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < 2 ? '1px solid var(--neutral-100)' : 'none' }}>
                      <span style={{ fontSize: 10, color: C.textSecondary }}>{t}</span>
                      <span style={{ fontSize: 9, color: c, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: i === 0 ? C.accentBg : i === 1 ? 'var(--warning-light)' : 'var(--neutral-100)' }}>{s}</span>
                    </div>
                  ))}
                </MockCard>
                {/* 포트폴리오 */}
                <MockCard style={{ padding: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>포트폴리오</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: C.textSecondary }}>누적 포트폴리오</span>
                    <span style={{ fontSize: 10, color: C.accent, fontWeight: 700 }}>3건</span>
                  </div>
                  <div style={{ padding: '6px 10px', borderRadius: 6, background: C.accentBg, textAlign: 'center', fontSize: 10, color: C.accent, fontWeight: 600, cursor: 'pointer' }}>포트폴리오 열람 →</div>
                </MockCard>
              </PhoneMockup>
            </div>
          </div>

          {/* Feature 2: TA Management */}
          <div className="lp-feature-grid lp-feature-reverse" ref={addRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', marginBottom: 96, direction: 'rtl' }}>
            <div style={{ direction: 'ltr' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'oklch(94% 0.04 300)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 20 }}>📋</div>
              <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>조교 관리 시스템</h3>
              <p style={{ color: 'oklch(55% 0.20 290)', fontWeight: 500, fontSize: 14, marginBottom: 16 }}>카톡 지시 대신 체크리스트로</p>
              <p style={{ color: C.textSecondary, lineHeight: 1.7, marginBottom: 24 }}>조교별 업무 배정, 클리닉 스케줄, 숙제 추적, 시간표와 대타 배정까지 한 화면에서. 빠지는 학생 없이, 조교도 명확하게.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['업무 배정', '클리닉 관리', '숙제 추적', '대타 배정'].map((t, i) => (
                  <span key={i} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, background: i === 0 ? 'oklch(94% 0.04 300)' : 'var(--neutral-100)', color: i === 0 ? 'oklch(55% 0.20 290)' : C.textSecondary, fontWeight: 500 }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', direction: 'ltr' }}>
              <PhoneMockup headerColor="oklch(48% 0.22 295)" headerTitle="조교 근무표" headerSub="수업 및 운영">
                {/* 이번 주 근무 현황 */}
                <MockCard style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary }}>이번 주 근무</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'oklch(48% 0.22 295)' }}>4월 2주차</span>
                  </div>
                  {[{ name: '박지은 조교', hours: '12/20h', pct: 60, color: 'oklch(48% 0.22 295)' }, { name: '김현수 조교', hours: '16/20h', pct: 80, color: C.accent }, { name: '이수아 조교', hours: '8/15h', pct: 53, color: 'var(--success)' }].map((ta, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 500 }}>{ta.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: ta.color }}>{ta.hours}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--neutral-100)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${ta.pct}%`, background: ta.color, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  ))}
                </MockCard>
                {/* 오늘 클리닉 일정 */}
                <MockCard style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary }}>오늘 클리닉</span>
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'var(--info-light)', color: 'var(--info)', fontWeight: 600 }}>3건</span>
                  </div>
                  {[{ name: '김하윤', topic: '비문학 추론', time: '15:00', status: '승인', sc: 'var(--success)' }, { name: '박도현', topic: '문학 감상', time: '16:00', status: '승인', sc: 'var(--success)' }, { name: '이서윤', topic: '어휘', time: '17:30', status: '대기', sc: 'var(--warning)' }].map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: i === 0 ? 'var(--info-light)' : 'transparent', marginBottom: 4, border: i === 0 ? '1px solid var(--info)20' : '1px solid transparent' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'oklch(94% 0.04 300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, flexShrink: 0 }}>👤</div>
                      <div style={{ flex: 1, marginLeft: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary }}>{c.name}</span>
                        <span style={{ fontSize: 9, color: C.textTertiary, marginLeft: 4 }}>{c.topic}</span>
                      </div>
                      <span style={{ fontSize: 9, color: C.textTertiary, marginRight: 6 }}>{c.time}</span>
                      <span style={{ fontSize: 8, fontWeight: 600, color: c.sc, padding: '1px 6px', borderRadius: 4, background: c.sc === 'var(--success)' ? 'var(--success-light)' : 'var(--warning-light)' }}>{c.status}</span>
                    </div>
                  ))}
                </MockCard>
                {/* 과제 관리 요약 */}
                <MockCard style={{ padding: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 8 }}>과제 채점 현황</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>28</p>
                        <p style={{ fontSize: 8, color: C.textTertiary }}>채점 완료</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--warning)' }}>7</p>
                        <p style={{ fontSize: 8, color: C.textTertiary }}>채점 대기</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--destructive)' }}>3</p>
                        <p style={{ fontSize: 8, color: C.textTertiary }}>미제출</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--neutral-100)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: '74%', background: 'var(--success)', borderRadius: '3px 0 0 3px' }} />
                    <div style={{ height: '100%', width: '18%', background: 'var(--warning)' }} />
                    <div style={{ height: '100%', width: '8%', background: 'var(--destructive)', borderRadius: '0 3px 3px 0' }} />
                  </div>
                </MockCard>
              </PhoneMockup>
            </div>
          </div>

          {/* Feature 3: Gamification */}
          <div className="lp-feature-grid" ref={addRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', marginBottom: 64 }}>
            <div>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--warning-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 20 }}>🎮</div>
              <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>게이미피케이션 시스템</h3>
              <p style={{ color: 'oklch(55% 0.14 70)', fontWeight: 500, fontSize: 14, marginBottom: 16 }}>숙제 이행률 40% 상승</p>
              <p style={{ color: C.textSecondary, lineHeight: 1.7, marginBottom: 24 }}>XP와 레벨 100단계, 아바타 커스터마이징, 퀴즈 4종(3,000+ 문제), 포인트 상점, 올림픽 시상대 랭킹까지. 학생이 스스로 경쟁하고 성장하는 구조를 만듭니다.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['XP / 레벨', '아바타', '퀴즈 4종', '포인트 상점'].map((t, i) => (
                  <span key={i} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, background: i === 0 ? 'var(--warning-light)' : 'var(--neutral-100)', color: i === 0 ? 'oklch(55% 0.14 70)' : C.textSecondary, fontWeight: 500 }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PhoneMockup headerColor="var(--warning)" headerTitle="게임 홈" headerSub="게이미피케이션">
                {/* 캐릭터 카드 - 실제 GameHub 반영 */}
                <MockCard style={{ textAlign: 'center', padding: 16 }}>
                  {/* 아바타 */}
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--warning), oklch(55% 0.20 35))', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontSize: 22, fontWeight: 700, boxShadow: '0 4px 12px oklch(55% 0.20 70 / 0.3)' }}>🧙</div>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>별빛마법사</p>
                  <p style={{ fontSize: 10, color: C.textTertiary }}>김하윤</p>
                  <div style={{ display: 'inline-block', background: 'linear-gradient(135deg, var(--warning-light), var(--warning))', padding: '2px 10px', borderRadius: 12, fontSize: 9, fontWeight: 600, color: 'oklch(35% 0.12 75)', marginTop: 4 }}>🔮 어휘 마스터</div>
                  {/* XP 프로그레스 바 */}
                  <div style={{ margin: '12px auto 0', maxWidth: 200 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)' }}>Lv.12</span>
                      <span style={{ fontSize: 9, color: C.textTertiary }}>320 / 500 XP</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--neutral-100)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '64%', background: 'linear-gradient(90deg, var(--warning), oklch(65% 0.18 60))', borderRadius: 4 }} />
                    </div>
                  </div>
                  {/* XP & 포인트 */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>4,230</p>
                      <p style={{ fontSize: 9, color: C.textTertiary }}>누적 XP</p>
                    </div>
                    <div style={{ width: 1, background: 'var(--neutral-200)' }} />
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--warning)' }}>1,250</p>
                      <p style={{ fontSize: 9, color: C.textTertiary }}>보유 포인트</p>
                    </div>
                  </div>
                </MockCard>
                {/* 메뉴 그리드 - 실제 GameHub 2x3 그리드 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[{ icon: '📝', label: '어휘', sub: '퀴즈' }, { icon: '🧠', label: '지식', sub: '퀴즈' }, { icon: '📖', label: '비문학', sub: '독해' }, { icon: '🏆', label: '랭킹', sub: '' }, { icon: '🛒', label: '상점', sub: '' }, { icon: '🎖️', label: '칭호', sub: '' }].map((m, i) => (
                    <MockCard key={i} style={{ padding: 10, textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
                      <p style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary }}>{m.label}</p>
                      {m.sub && <p style={{ fontSize: 8, color: C.textTertiary }}>{m.sub}</p>}
                    </MockCard>
                  ))}
                </div>
                {/* 출석 보너스 */}
                <MockCard style={{ padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600 }}>🎁 수업 출석 보너스</p>
                    <p style={{ fontSize: 8, color: C.textTertiary }}>오늘 출석 시 +50 XP</p>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.white, padding: '4px 10px', borderRadius: 6, background: C.accent }}>받기</span>
                </MockCard>
              </PhoneMockup>
            </div>
          </div>
        </div>
      </section>

      {/* === COMPARISON === */}
      <section style={{ padding: '96px 0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          <div ref={addRef} style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 12 }}>직접 써봤기 때문에</p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.3 }}>다른 앱은 왜 불편했을까요?</h2>
          </div>
          <div ref={addRef} style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '16px', borderBottom: `2px solid ${C.border}`, color: C.textTertiary, fontWeight: 500, width: '33%' }}></th>
                  <th style={{ textAlign: 'center', padding: '16px', borderBottom: `2px solid ${C.border}`, color: C.textTertiary, fontWeight: 500, width: '33%' }}>일반 학원 관리 앱</th>
                  <th style={{ textAlign: 'center', padding: '16px', borderBottom: `2px solid ${C.accent}`, background: C.accentBg, color: C.accent, fontWeight: 700, width: '33%', borderRadius: '12px 12px 0 0' }}>나만의 조교</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([label, other, ours], i) => (
                  <tr key={i} style={{ borderBottom: i < comparisonRows.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: 16, fontWeight: 500, color: C.textPrimary }}>{label}</td>
                    <td style={{ padding: 16, textAlign: 'center', color: other === '없음' ? C.textTertiary : C.textSecondary }}>{other}</td>
                    <td style={{ padding: 16, textAlign: 'center', background: C.accentBg, color: C.accent, fontWeight: 500 }}>{ours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* === TESTIMONIALS === */}
      <section id="testimonials" style={{ padding: '96px 0', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px', marginBottom: 48 }}>
          <div ref={addRef} style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 12 }}>같은 고민을 했던 선생님들</p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.3 }}>쓰고 나서 달라진 것들</h2>
          </div>
        </div>
        {[testimonials1, testimonials2].map((row, ri) => (
          <div key={ri} style={{ overflow: 'hidden', marginBottom: ri === 0 ? 20 : 0 }}>
            <div className={ri === 0 ? 'lp-marquee-1' : 'lp-marquee-2'} style={{ display: 'flex', gap: 20, width: 'max-content' }}>
              {[...row, ...row].map((t, i) => (
                <div key={i} style={{ width: 340, flexShrink: 0, background: C.surfaceCard, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7, marginBottom: 12 }}>"{t.text}"</p>
                  <p style={{ fontSize: 12, color: C.textTertiary }}>{t.who}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* === PRICING === */}
      <section id="pricing" style={{ padding: '96px 0', background: C.surfaceCard }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div ref={addRef} style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 12 }}>30일 무료 체험으로 시작</p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.3, marginBottom: 12 }}>합리적인 요금제</h2>
            <p style={{ color: C.textTertiary, marginBottom: 24 }}>카드 등록 없이 30일간 전체 기능을 써보세요.</p>
            {/* 월간/연간 토글 */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0, background: C.white, borderRadius: 12, padding: 4, border: `1px solid ${C.border}` }}>
              <button onClick={() => setLandingYearly(false)} style={{
                padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                background: !landingYearly ? C.accent : 'transparent', color: !landingYearly ? C.white : C.textTertiary,
              }}>월간 결제</button>
              <button onClick={() => setLandingYearly(true)} style={{
                padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s', position: 'relative',
                background: landingYearly ? C.accent : 'transparent', color: landingYearly ? C.white : C.textTertiary,
              }}>연간 결제
                <span style={{ position: 'absolute', top: -10, right: -10, background: 'oklch(55% 0.18 25)', color: 'white', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>15% OFF</span>
              </button>
            </div>
          </div>

          {landingYearly && (
            <p ref={addRef} style={{ textAlign: 'center', marginBottom: 24, padding: '8px 20px', background: 'oklch(95% 0.04 140)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'oklch(45% 0.14 140)', maxWidth: 500, margin: '0 auto 24px' }}>
              연간 결제 시 매달 15% 할인된 가격으로 이용하세요
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
            {plans.map((p, i) => {
              const price = landingYearly ? p.yearlyPrice : p.price;
              const showDiscount = landingYearly && p.price > 0 && !p.inquiry;
              const yearlySaving = p.price > 0 ? (p.price - p.yearlyPrice) * 12 : 0;
              return (
                <div key={i} ref={addRef} style={{
                  padding: 28, borderRadius: 16, background: C.white,
                  border: p.popular ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                  position: 'relative', textAlign: 'center', display: 'flex', flexDirection: 'column',
                }}>
                  {p.popular && (
                    <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: C.accent, color: C.white, padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>가장 많이 선택</span>
                  )}
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, marginBottom: 4, marginTop: p.popular ? 8 : 0 }}>{p.name}</h3>
                  <p style={{ fontSize: 12, color: C.textTertiary, marginBottom: 16 }}>{p.desc}</p>

                  {/* 가격 */}
                  <div style={{ minHeight: 64, marginBottom: 8 }}>
                    {p.inquiry ? (
                      <p style={{ fontSize: 26, fontWeight: 900, color: C.textPrimary }}>별도 문의</p>
                    ) : price === 0 ? (
                      <p style={{ fontSize: 30, fontWeight: 900, color: C.textPrimary }}>무료</p>
                    ) : (
                      <>
                        {showDiscount && (
                          <p style={{ fontSize: 13, color: C.textTertiary, textDecoration: 'line-through', marginBottom: 2 }}>{p.price.toLocaleString()}원</p>
                        )}
                        <p style={{ fontSize: 28, fontWeight: 900, color: C.textPrimary, lineHeight: 1.1 }}>
                          {price.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 600 }}>원</span>
                        </p>
                        <p style={{ fontSize: 12, color: C.textTertiary, marginTop: 4 }}>/월 (부가세 포함)</p>
                      </>
                    )}
                  </div>

                  {showDiscount && yearlySaving > 0 && (
                    <div style={{ margin: '0 0 8px', padding: '4px 10px', borderRadius: 8, background: 'oklch(95% 0.05 25)', fontSize: 11, fontWeight: 700, color: 'oklch(50% 0.18 25)' }}>
                      연 {yearlySaving.toLocaleString()}원 절약
                    </div>
                  )}

                  <p style={{ fontSize: 13, color: C.textTertiary, fontWeight: 700, marginBottom: 12 }}>최대 {p.students}</p>

                  <div style={{ height: 1, background: C.border, margin: '0 0 12px' }} />

                  <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', flex: 1 }}>
                    {p.features.map((f, j) => (
                      <li key={j} style={{ padding: '5px 0', fontSize: 14, color: C.textSecondary, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Check /> {f}
                      </li>
                    ))}
                  </ul>

                  <button onClick={() => navigate('/onboarding')} style={{
                    marginTop: 16, width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 600, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                    background: p.popular ? C.accent : p.inquiry ? 'linear-gradient(135deg, oklch(55% 0.14 75), oklch(50% 0.14 55))' : 'transparent',
                    color: p.popular || p.inquiry ? C.white : C.textSecondary,
                    border: !p.popular && !p.inquiry ? `1px solid ${C.border}` : 'none',
                    boxShadow: p.popular ? '0 2px 8px oklch(48% 0.18 260 / 0.3)' : 'none',
                  }} onMouseOver={e => { if (!p.inquiry) e.currentTarget.style.opacity = '0.85'; }}
                     onMouseOut={e => { e.currentTarget.style.opacity = '1'; }}>
                    {p.popular ? '30일 무료 체험' : p.inquiry ? '도입 문의' : '시작하기'}
                  </button>
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: 'center', marginTop: 24, color: C.textTertiary, fontSize: 13 }}>모든 요금은 부가세(VAT) 포함 가격입니다 · 언제든 해지 가능</p>
        </div>
      </section>

      {/* === FAQ === */}
      <section id="faq" style={{ padding: '96px 0' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 24px' }}>
          <div ref={addRef} style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 12 }}>궁금하신 점이 있으신가요?</h2>
            <p style={{ color: C.textTertiary }}>시작하기 전에 선생님들이 가장 많이 물어보신 것들입니다.</p>
          </div>
          {faqCategories.map((cat, ci) => (
            <div key={ci} style={{ marginBottom: 40 }}>
              <span style={{ display: 'inline-flex', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 500, background: C.surfaceCard, color: C.textTertiary, border: `1px solid ${C.border}`, marginBottom: 16 }}>{cat.label}</span>
              {cat.items.map((item, ii) => {
                const faqKey = `${ci}-${ii}`;
                const isOpen = activeFaq === faqKey;
                return (
                  <div key={ii} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <button onClick={() => setActiveFaq(isOpen ? null : faqKey)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '20px 0', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, paddingRight: 16 }}>{item.q}</span>
                      <ChevronDown open={isOpen} />
                    </button>
                    <div style={{
                      maxHeight: isOpen ? 600 : 0, overflow: 'hidden',
                      transition: 'max-height 0.4s cubic-bezier(0.16,1,0.3,1)',
                    }}>
                      <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7, paddingBottom: 20 }}>{item.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* === CTA === */}
      <section id="cta" style={{ padding: '96px 0', background: C.surfaceCard }}>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <p ref={addRef} style={{ fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 16 }}>5분이면 시작할 수 있습니다</p>
          <h2 ref={addRef} style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.3, marginBottom: 20 }}>
            저처럼 3시간을<br/>돌려받으세요.
          </h2>
          <p ref={addRef} style={{ fontSize: 18, color: C.textSecondary, lineHeight: 1.7, marginBottom: 32 }}>
            카드 등록 없이 30일간 전체 기능을 써보세요.<br/>5명 이하라면 체험 후에도 평생 무료로 계속 쓸 수 있습니다.
          </p>
          <div ref={addRef}>
            <button onClick={() => navigate('/onboarding')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, background: C.accent, color: C.white,
              fontWeight: 700, fontSize: 18, padding: '20px 40px', borderRadius: 16, border: 'none', cursor: 'pointer',
              transition: 'all 0.2s', boxShadow: '0 4px 12px oklch(55% 0.15 250 / 0.2)',
            }} onMouseOver={e => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.boxShadow = '0 8px 24px oklch(55% 0.15 250 / 0.25)'; }}
               onMouseOut={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.boxShadow = '0 4px 12px oklch(55% 0.15 250 / 0.2)'; }}>
              무료 체험 시작하기 <ArrowRight />
            </button>
          </div>
          <div ref={addRef} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 24, fontSize: 14, color: C.textTertiary, marginTop: 24 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield /> 카드 등록 없음</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock /> 5분 세팅</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Heart /> 5명 이하 평생 무료</span>
          </div>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '48px 0' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <div>
              <p style={{ fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>나만의 조교</p>
              <p style={{ fontSize: 14, color: C.textTertiary }}>현직 강사가 학원 운영하면서 직접 만든 관리 솔루션.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 14, color: C.textTertiary }}>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = C.textPrimary} onMouseOut={e => e.currentTarget.style.color = C.textTertiary}>이용약관</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = C.textPrimary} onMouseOut={e => e.currentTarget.style.color = C.textTertiary}>개인정보처리방침</a>
              <a href="#" style={{ textDecoration: 'none', color: 'inherit', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = C.textPrimary} onMouseOut={e => e.currentTarget.style.color = C.textTertiary}>문의하기</a>
            </div>
          </div>
          <div style={{ marginTop: 32, paddingTop: 32, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.textTertiary }}>&copy; 2026 나만의 조교. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
