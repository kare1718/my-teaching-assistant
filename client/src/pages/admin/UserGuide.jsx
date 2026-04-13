import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ─── Guide section data ─────────────────────────────────────────── */
const GUIDE_SECTIONS = [
  {
    id: 'getting-started',
    icon: '🚀',
    title: '시작하기',
    subtitle: '처음 사용하시나요? 여기서부터 시작하세요',
    color: 'oklch(55% 0.18 275)',
    items: [
      {
        q: '나만의 조교란 무엇인가요?',
        a: '나만의 조교는 학원 운영에 필요한 모든 기능을 한곳에서 관리할 수 있는 스마트 학원 관리 플랫폼입니다. 학생 관리, 출결, 성적, 게이미피케이션, 문자 발송, AI 어시스턴트까지 — 학원 운영의 모든 것을 편리하게 도와드립니다.',
      },
      {
        q: '학원 초기 설정은 어떻게 하나요?',
        a: '사이드바 하단의 [학원 설정]에서 학원명, 학교/학년 구성, 시험 유형, 브랜딩(로고, 색상) 등을 설정할 수 있습니다. 처음 가입 후 이 설정을 완료하면 학원에 맞는 맞춤형 환경이 만들어집니다.',
        link: '/admin/settings',
        linkLabel: '학원 설정으로 이동',
      },
      {
        q: '학생은 어떻게 가입하나요?',
        a: '학생이 회원가입 페이지에서 가입 신청을 하면, 관리자 페이지의 [가입 승인]에서 승인/거절 처리를 할 수 있습니다. 또한 [사전등록] 기능을 활용하면 학생 가입 전에 미리 학생 정보를 등록해둘 수 있어 더 빠른 관리가 가능합니다.',
        link: '/admin/pending',
        linkLabel: '가입 승인으로 이동',
      },
      {
        q: '조교/선생님 계정은 어떻게 만드나요?',
        a: '학생 가입과 동일하게 회원가입 후, 관리자가 [가입 승인]에서 해당 사용자의 학교를 "조교" 또는 "선생님"으로 설정해주면 됩니다. 조교 계정은 관리자와 유사한 권한으로 관리 페이지에 접근할 수 있습니다.',
      },
    ],
  },
  {
    id: 'student-mgmt',
    icon: '👥',
    title: '학생 관리',
    subtitle: '출결, 가입 승인, 상담까지 한 번에',
    color: 'oklch(55% 0.15 160)',
    items: [
      {
        q: '출결 관리는 어떻게 하나요?',
        a: '학생이 [출석 체크] 페이지에서 직접 출석 버튼을 누르면 자동으로 기록됩니다. 관리자는 [출결 관리]에서 날짜별/학생별 출결 현황을 확인하고, 결석/지각 등을 수동으로 수정할 수도 있습니다.',
        link: '/admin/attendance',
        linkLabel: '출결 관리로 이동',
      },
      {
        q: '학생 정보를 수정하려면?',
        a: '학생이 앱에서 정보 수정을 요청하면 [정보 수정 요청]에 알림이 뜹니다. 관리자가 검토 후 승인하면 학생 정보가 업데이트됩니다. 관리자가 직접 학생 상세 페이지에서 수정하는 것도 가능합니다.',
        link: '/admin/edit-requests',
        linkLabel: '정보 수정 요청 확인',
      },
      {
        q: '상담 일지는 어떻게 기록하나요?',
        a: '[상담 일지]에서 학생/학부모 상담 내용을 기록하고 관리할 수 있습니다. 상담 유형, 날짜, 내용, 후속 조치 등을 체계적으로 관리하여 학생별 상담 이력을 추적할 수 있습니다.',
        link: '/admin/consultations',
        linkLabel: '상담 일지로 이동',
      },
    ],
  },
  {
    id: 'class-ops',
    icon: '📚',
    title: '수업 및 운영',
    subtitle: '일정, 시험, 성적, 과제 관리',
    color: 'oklch(55% 0.15 50)',
    items: [
      {
        q: '수업 일정은 어떻게 관리하나요?',
        a: '[수업 일정 관리]에서 세 가지 탭을 활용할 수 있습니다:\n• 수업 일정: 정규 수업 시간표 등록/관리\n• 시험 일정: 시험 날짜 및 정보 등록\n• 특별 일정: 휴원, 보충수업 등 특별 이벤트 관리',
        link: '/admin/schedules',
        linkLabel: '수업 일정으로 이동',
      },
      {
        q: '시험 성적은 어떻게 입력하나요?',
        a: '[시험 성적 관리]에서 시험을 등록하고 성적을 입력할 수 있습니다:\n• 시험 성적: 시험 등록 및 점수 직접 입력\n• 정답 입력: 정답지를 먼저 등록하고 학생 답안 입력\n• OMR 입력: OMR 카드 방식으로 빠르게 채점\n\n입력된 성적은 학생 앱에서 바로 확인 가능합니다.',
        link: '/admin/scores',
        linkLabel: '성적 관리로 이동',
      },
      {
        q: '과제 관리는 어떻게 하나요?',
        a: '[과제 관리]에서 과제를 출제하고, 학생들의 제출 현황을 확인하며, 채점할 수 있습니다. 학생은 앱에서 과제를 확인하고 제출합니다.',
        link: '/admin/homework',
        linkLabel: '과제 관리로 이동',
      },
      {
        q: '클리닉은 어떻게 운영하나요?',
        a: '학생이 앱에서 클리닉(보충수업)을 신청하면, [클리닉 관리]에서 신청 현황을 확인하고 승인/거절 처리할 수 있습니다. 시간대별 정원을 설정하여 체계적으로 운영할 수 있습니다.',
        link: '/admin/clinic',
        linkLabel: '클리닉 관리로 이동',
      },
      {
        q: '조교 근무표는 어떻게 관리하나요?',
        a: '[조교 근무표]에서 세 가지 기능을 제공합니다:\n• 근무 기록: 조교별 출근/퇴근 시간 기록 및 근무시간 집계\n• 월간 근무표: 요일/시간대별 정규 근무 스케줄 배정\n• 조교 명단: 조교 인원 관리 및 연락처 관리',
        link: '/admin/ta-schedule',
        linkLabel: '근무표로 이동',
      },
      {
        q: '수업 레포트란?',
        a: '[수업 레포트]에서 각 수업의 진행 내용, 학생 참여도, 특이사항 등을 기록할 수 있습니다. 수업별 기록을 남겨두면 학부모 상담이나 수업 개선에 활용할 수 있습니다.',
        link: '/admin/reports',
        linkLabel: '수업 레포트로 이동',
      },
    ],
  },
  {
    id: 'communication',
    icon: '💬',
    title: '소통',
    subtitle: '질문, 문자, 공지사항 관리',
    color: 'oklch(55% 0.18 220)',
    items: [
      {
        q: '학생 질문에 어떻게 답변하나요?',
        a: '학생이 앱에서 질문을 작성하면 [질문 관리]에서 확인할 수 있습니다. 사진 첨부 질문도 지원하며, 관리자가 직접 답변을 달 수 있습니다. 새 질문이 오면 사이드바에 알림 배지가 표시됩니다.',
        link: '/admin/qna',
        linkLabel: '질문 관리로 이동',
      },
      {
        q: '문자는 어떻게 보내나요?',
        a: '[문자 발송]에서 개별 학생 또는 학교/학년별로 단체 문자를 보낼 수 있습니다. 자주 사용하는 내용은 템플릿으로 저장하여 빠르게 발송할 수 있습니다. SMS 크레딧은 [SMS 충전]에서 충전 가능합니다.',
        link: '/admin/sms',
        linkLabel: '문자 발송으로 이동',
      },
      {
        q: '공지사항은 어떻게 작성하나요?',
        a: '[안내사항 관리]에서 공지를 작성하면 학생 앱에 즉시 노출됩니다. 전체 공지 또는 특정 학교/학년만 대상으로 할 수 있으며, 고정 공지 기능으로 중요한 안내를 상단에 노출시킬 수 있습니다.',
        link: '/admin/notices',
        linkLabel: '공지 관리로 이동',
      },
    ],
  },
  {
    id: 'gamification',
    icon: '🎮',
    title: '게이미피케이션',
    subtitle: 'XP, 포인트, 퀴즈, 상점으로 학습 동기 부여',
    color: 'oklch(55% 0.18 330)',
    items: [
      {
        q: '게이미피케이션이란?',
        a: '학생들의 학습 동기를 높이기 위한 게임 요소입니다. 학생들은 퀴즈, 출석, 활동을 통해 XP(경험치)와 포인트를 획득하고, 랭킹에 오르며, 상점에서 보상을 교환할 수 있습니다.',
      },
      {
        q: 'XP와 포인트는 어떻게 관리하나요?',
        a: '[게임 관리 > 학생관리]에서 확인할 수 있습니다:\n• 랭킹: 학생들의 XP 순위 실시간 확인\n• XP 조정: 관리자가 직접 XP/포인트를 추가하거나 차감\n• 칭호: 학생별 특별 칭호 부여\n• 활동로그: 모든 게임 활동 이력 확인',
        link: '/admin/gamification',
        linkLabel: '게임 관리로 이동',
      },
      {
        q: '퀴즈는 어떻게 관리하나요?',
        a: '[게임 관리 > 퀴즈관리]에서 세 종류의 퀴즈를 관리할 수 있습니다:\n• 어휘 퀴즈: 단어/뜻 매칭 문제\n• 지식 퀴즈: 교과 관련 OX/객관식 문제\n• 비문학 퀴즈: 지문 읽기 + 문제풀이\n\n각 퀴즈마다 문제를 등록하고, 난이도와 보상 XP를 설정할 수 있습니다.',
      },
      {
        q: '히든코드란 무엇인가요?',
        a: '히든코드는 학생들에게 특별한 보상을 제공하는 비밀 코드입니다. 관리자가 코드와 XP 보상, 사용 횟수 제한, 유효기간을 설정하여 생성하면, 학생들이 코드를 입력해 XP를 받을 수 있습니다. 이벤트나 보너스 보상에 활용하세요!',
      },
      {
        q: '상점과 보상은 어떻게 설정하나요?',
        a: '[게임 관리 > 상점/보상]에서 학생들이 포인트로 교환할 수 있는 상품을 등록하고 관리할 수 있습니다. 상품의 가격(포인트), 재고, 이미지를 설정하고, 학생의 교환 요청을 승인/거절할 수 있습니다.',
      },
    ],
  },
  {
    id: 'content',
    icon: '📋',
    title: '콘텐츠 관리',
    subtitle: '후기, 명예의 전당, 포트폴리오, 프로필',
    color: 'oklch(55% 0.12 90)',
    items: [
      {
        q: '후기는 어떻게 관리하나요?',
        a: '학생이 앱에서 후기를 작성하면 [후기 관리]에서 검토할 수 있습니다. 적절한 후기는 승인하여 공개하고, 부적절한 후기는 반려할 수 있습니다. 승인된 후기는 랜딩페이지에 노출됩니다.',
        link: '/admin/reviews',
        linkLabel: '후기 관리로 이동',
      },
      {
        q: '명예의 전당은 무엇인가요?',
        a: '[명예의 전당]에서 우수한 성적을 거둔 학생을 등록하고 공개할 수 있습니다. 학생의 성취를 인정하고, 다른 학생들에게 동기부여가 됩니다.',
        link: '/admin/hall-of-fame',
        linkLabel: '명예의 전당으로 이동',
      },
      {
        q: '강사 프로필 설정은 어디서 하나요?',
        a: '[프로필 관리]에서 강사의 자기소개, 경력, 프로필 사진 등을 설정할 수 있습니다. 이 정보는 학원 소개 페이지에 표시됩니다.',
        link: '/admin/profile',
        linkLabel: '프로필 관리로 이동',
      },
    ],
  },
  {
    id: 'ai-assistant',
    icon: '🤖',
    title: 'AI 어시스턴트',
    subtitle: '자연어로 학원을 관리하세요',
    color: 'oklch(50% 0.20 275)',
    items: [
      {
        q: 'AI 어시스턴트란?',
        a: '자연어(일상 대화)로 학원 관리 작업을 수행할 수 있는 AI 비서입니다. "오늘 학원 현황 알려줘", "3월 학력평가 등록해줘" 등 말하듯이 입력하면 AI가 명령을 이해하고 실행합니다.',
        link: '/admin/ai',
        linkLabel: 'AI 어시스턴트 열기',
      },
      {
        q: 'AI 어시스턴트로 무엇을 할 수 있나요?',
        a: '다양한 학원 관리 작업을 수행할 수 있습니다:\n• 현황 조회: "학생 몇 명이야?", "이번 주 일정 알려줘"\n• 시험 관리: "3월 모의고사 등록해줘, 만점 100점"\n• 성적 입력: "김민준 85점, 이서윤 92점 입력"\n• 히든코드: "히든코드 SPRING 만들어줘 200XP"\n• XP 조정: "김민준 XP 50 추가해줘"\n• 공지 작성: "공지사항 등록: 내일 휴원합니다"\n• 데이터 조회: "최근 시험 성적 조회"',
      },
      {
        q: '실행 전에 확인을 받나요?',
        a: '네, 안전합니다! AI가 명령을 분석하면 실행 전에 반드시 미리보기 카드가 표시됩니다. 내용을 확인한 후 [실행하기] 또는 [취소] 버튼을 눌러 최종 결정할 수 있습니다.',
      },
    ],
  },
  {
    id: 'billing',
    icon: '💳',
    title: '운영 및 결제',
    subtitle: '수납, SMS 충전, 구독 관리',
    color: 'oklch(50% 0.15 145)',
    items: [
      {
        q: '수납 관리는 어떻게 하나요?',
        a: '[수납 관리]에서 학생별 수업료 수납 현황을 관리할 수 있습니다. 결제 요청 링크를 학부모에게 전송하여 편리하게 수납할 수 있으며, 미납/완납 현황을 한눈에 파악할 수 있습니다.',
        link: '/admin/tuition',
        linkLabel: '수납 관리로 이동',
      },
      {
        q: 'SMS 크레딧은 어떻게 충전하나요?',
        a: '[SMS 충전]에서 문자 발송에 필요한 크레딧을 충전할 수 있습니다. 잔여 크레딧과 사용 내역도 확인 가능합니다.',
        link: '/admin/sms-credits',
        linkLabel: 'SMS 충전으로 이동',
      },
      {
        q: '구독 플랜은 어떤 것들이 있나요?',
        a: '[구독 관리]에서 현재 구독 상태를 확인하고 플랜을 변경할 수 있습니다. 무료 체험(Trial)부터 Basic, Standard, Pro, Enterprise까지 학원 규모에 맞는 플랜을 선택할 수 있습니다. 상위 플랜일수록 더 많은 학생 수와 고급 기능을 사용할 수 있습니다.',
        link: '/admin/subscription',
        linkLabel: '구독 관리로 이동',
      },
    ],
  },
  {
    id: 'backup',
    icon: '🔒',
    title: '백업 및 보안',
    subtitle: '소중한 데이터를 안전하게',
    color: 'oklch(45% 0.12 30)',
    items: [
      {
        q: '데이터 백업은 어떻게 하나요?',
        a: '[백업 관리]에서 학원 데이터를 백업할 수 있습니다. 학생 정보, 성적, 출결 등 모든 데이터를 안전하게 백업하고 필요시 복원할 수 있습니다.',
        link: '/admin/backup',
        linkLabel: '백업 관리로 이동',
      },
    ],
  },
];

const TIPS = [
  { icon: '💡', text: '사이드바 하단의 📌 아이콘으로 메뉴를 고정할 수 있습니다' },
  { icon: '⌨️', text: 'AI 어시스턴트에서 Enter로 바로 전송, Shift+Enter로 줄바꿈' },
  { icon: '📱', text: '모바일에서도 모든 관리 기능을 사용할 수 있습니다' },
  { icon: '🔔', text: '사이드바 알림 배지로 미처리 항목을 한눈에 확인하세요' },
  { icon: '🌙', text: '다크모드를 지원합니다. 상단 네비게이션에서 테마를 전환하세요' },
  { icon: '🎮', text: '히든코드를 활용해 이벤트성 보상을 제공해보세요' },
];

/* ─── Accordion item ─────────────────────────────────────────────── */
function AccordionItem({ item, isOpen, onToggle, navigate }) {
  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${isOpen ? 'oklch(72% 0.10 260)' : 'var(--border)'}`,
      background: isOpen ? 'oklch(97% 0.01 260)' : 'var(--card)',
      overflow: 'hidden',
      transition: 'all 0.2s',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', border: 'none', background: 'transparent',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', color: isOpen ? 'var(--primary)' : 'var(--neutral-400)' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>{item.q}</span>
      </button>
      {isOpen && (
        <div style={{ padding: '0 16px 16px 44px' }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--foreground)', whiteSpace: 'pre-line' }}>
            {item.a}
          </div>
          {item.link && (
            <button onClick={() => navigate(item.link)} style={{
              marginTop: 12, padding: '8px 16px', borderRadius: 8,
              border: '1px solid var(--primary)', background: 'var(--primary-lighter)',
              color: 'var(--primary)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary-lighter)'; e.currentTarget.style.color = 'var(--primary)'; }}
            >
              {item.linkLabel}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Section card ───────────────────────────────────────────────── */
function SectionCard({ section, isActive, onSelect }) {
  return (
    <button onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', padding: '12px 14px', borderRadius: 12,
      border: isActive ? `2px solid ${section.color}` : '1px solid var(--border)',
      background: isActive ? `color-mix(in oklch, ${section.color} 8%, var(--card))` : 'var(--card)',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      transition: 'all 0.15s',
      boxShadow: isActive ? `0 2px 12px color-mix(in oklch, ${section.color} 20%, transparent)` : 'none',
    }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = section.color; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 10,
        background: `color-mix(in oklch, ${section.color} 12%, var(--card))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>{section.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? section.color : 'var(--foreground)' }}>{section.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.subtitle}</div>
      </div>
      {isActive && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={section.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      )}
    </button>
  );
}

/* ─── Main page ──────────────────────────────────────────────────── */
export default function UserGuide() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('getting-started');
  const [openItems, setOpenItems] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const currentSection = GUIDE_SECTIONS.find(s => s.id === activeSection);

  const toggleItem = (sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Search filter
  const filteredSections = searchQuery.trim()
    ? GUIDE_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(section => section.items.length > 0)
    : null;

  return (
    <div className="content guide-content-wrapper" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 12px 40px' }}>
      {/* Hero Header */}
      <div style={{
        marginTop: 8, padding: '28px 24px', borderRadius: 16,
        background: 'linear-gradient(135deg, oklch(55% 0.18 275) 0%, oklch(45% 0.20 300) 50%, oklch(50% 0.15 220) 100%)',
        color: 'white', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 160, height: 160,
          borderRadius: '50%', background: 'oklch(100% 0 0 / 0.06)',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: '40%', width: 100, height: 100,
          borderRadius: '50%', background: 'oklch(100% 0 0 / 0.04)',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
            사용법 가이드
          </div>
          <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.6 }}>
            나만의 조교의 모든 기능을 쉽고 빠르게 알아보세요
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ margin: '16px 0', position: 'relative' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="궁금한 내용을 검색하세요... (예: 출결, 시험, 게임)"
          style={{
            width: '100%', padding: '13px 14px 13px 42px', borderRadius: 12,
            border: '2px solid var(--border)', background: 'var(--card)',
            fontSize: 14, fontFamily: 'inherit', outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px oklch(55% 0.18 260 / 0.1)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'var(--neutral-100)', border: 'none', borderRadius: '50%',
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 13, color: 'var(--muted-foreground)',
          }}>
            x
          </button>
        )}
      </div>

      {/* Search Results Mode */}
      {filteredSections && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {filteredSections.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 20px', color: 'var(--muted-foreground)',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>검색 결과가 없습니다</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>다른 키워드로 검색해보세요</div>
            </div>
          ) : (
            filteredSections.map(section => (
              <div key={section.id}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 10, padding: '0 4px',
                }}>
                  <span style={{ fontSize: 18 }}>{section.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: section.color }}>{section.title}</span>
                  <span style={{
                    fontSize: 11, background: 'var(--neutral-50)', padding: '2px 8px',
                    borderRadius: 10, color: 'var(--muted-foreground)', fontWeight: 600,
                  }}>{section.items.length}건</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {section.items.map((item, idx) => (
                    <AccordionItem
                      key={idx} item={item}
                      isOpen={openItems[`${section.id}-${idx}`]}
                      onToggle={() => toggleItem(section.id, idx)}
                      navigate={navigate}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Normal Browse Mode */}
      {!filteredSections && (
        <>
          {/* Tips Carousel */}
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 0 12px',
            scrollbarWidth: 'none',
          }}>
            {TIPS.map((tip, i) => (
              <div key={i} style={{
                flexShrink: 0, padding: '10px 16px', borderRadius: 10,
                background: 'var(--card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: 'var(--foreground)', minWidth: 200, maxWidth: 320,
              }}>
                <span style={{ fontSize: 16 }}>{tip.icon}</span>
                <span>{tip.text}</span>
              </div>
            ))}
          </div>

          {/* Two-column layout: nav + content */}
          <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
            {/* Left: Section Navigation */}
            <div style={{
              width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6,
              position: 'sticky', top: 8, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
            }}
              className="guide-nav-desktop"
            >
              {GUIDE_SECTIONS.map(section => (
                <SectionCard
                  key={section.id} section={section}
                  isActive={activeSection === section.id}
                  onSelect={() => setActiveSection(section.id)}
                />
              ))}
            </div>

            {/* Right: Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {currentSection && (
                <>
                  {/* Section header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    marginBottom: 16, padding: '0 2px',
                  }}>
                    <span style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: `color-mix(in oklch, ${currentSection.color} 12%, var(--card))`,
                      border: `1px solid color-mix(in oklch, ${currentSection.color} 20%, transparent)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26,
                    }}>{currentSection.icon}</span>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)' }}>{currentSection.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 }}>{currentSection.subtitle}</div>
                    </div>
                  </div>

                  {/* Accordion items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentSection.items.map((item, idx) => (
                      <AccordionItem
                        key={idx} item={item}
                        isOpen={openItems[`${currentSection.id}-${idx}`]}
                        onToggle={() => toggleItem(currentSection.id, idx)}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Section Selector (show only on small screens) */}
          <style>{`
            @media (max-width: 768px) {
              .guide-nav-desktop { display: none !important; }
              .guide-mobile-nav { display: flex !important; }
              .guide-content-wrapper { padding-bottom: 72px !important; }
            }
            @media (min-width: 769px) {
              .guide-mobile-nav { display: none !important; }
            }
          `}</style>
          <div className="guide-mobile-nav" style={{
            display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--card)', borderTop: '1px solid var(--border)',
            padding: '8px 12px', gap: 6, overflowX: 'auto', zIndex: 170,
            boxShadow: '0 -4px 16px oklch(0% 0 0 / 0.08)',
          }}>
            {GUIDE_SECTIONS.map(section => (
              <button key={section.id} onClick={() => setActiveSection(section.id)} style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: 20,
                border: activeSection === section.id ? `2px solid ${section.color}` : '1px solid var(--border)',
                background: activeSection === section.id ? `color-mix(in oklch, ${section.color} 10%, var(--card))` : 'var(--card)',
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 600,
                color: activeSection === section.id ? section.color : 'var(--foreground)',
                display: 'flex', alignItems: 'center', gap: 4,
                whiteSpace: 'nowrap',
              }}>
                <span>{section.icon}</span>
                {section.title}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
