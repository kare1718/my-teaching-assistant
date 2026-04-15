import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LegalFooter from '../../components/LegalFooter';

export default function Privacy() {
  const [legal, setLegal] = useState({});
  useEffect(() => {
    fetch('/api/legal-info').then(r => r.ok ? r.json() : {}).then(setLegal).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold text-[#102044] tracking-tight">나만의 조교</Link>
          <Link to="/" className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-[#004bf0]">홈으로</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold text-[#102044] tracking-tight mb-2">개인정보처리방침</h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">시행일: 2026년 4월 15일</p>

        <article className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 space-y-8 text-sm leading-7 text-slate-700">
          <p>나만의 조교(이하 "회사")는 개인정보보호법 등 관련 법령을 준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.</p>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">1. 개인정보 수집 항목 및 수집 방법</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원가입 시: 이름, 이메일, 연락처, 소속 학원명, 비밀번호</li>
              <li>학생/보호자 관리 시: 학생 이름, 학년, 연락처, 학부모 연락처, 출결·성적 기록</li>
              <li>결제 시: 카드사명, 카드번호(마스킹), 결제 승인번호 (PG사 위탁)</li>
              <li>자동 수집: 접속 IP, 쿠키, 접속 로그, 기기정보, 브라우저 정보</li>
            </ul>
            <p className="mt-2">수집 방법: 홈페이지 회원가입, 서비스 이용 과정에서의 직접 입력, 자동 수집 도구.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">2. 개인정보 수집 및 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>서비스 제공 및 계약 이행, 요금 정산</li>
              <li>회원 식별, 본인 확인, 부정 이용 방지</li>
              <li>공지사항 전달, 고객 상담 및 불만 처리</li>
              <li>서비스 개선 및 신규 기능 개발을 위한 통계 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">3. 개인정보 보유 및 이용 기간</h2>
            <p>원칙적으로 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관련 법령에 의해 일정 기간 보존이 필요한 경우 다음과 같이 보관합니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
              <li>대금결제 및 재화 공급 기록: 5년</li>
              <li>소비자 불만 또는 분쟁처리 기록: 3년</li>
              <li>접속 로그: 3개월</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">4. 개인정보의 제3자 제공</h2>
            <p>회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 법령의 규정에 의하거나 수사기관의 적법한 요청이 있는 경우는 예외로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">5. 개인정보의 처리 위탁</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Supabase (데이터베이스 및 인프라)</li>
              <li>Render (서버 호스팅)</li>
              <li>PortOne (결제 대행)</li>
              <li>Solapi (SMS 발송)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">6. 정보주체의 권리</h2>
            <p>이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있으며, 고객센터를 통해 행사할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">7. 개인정보의 안전성 확보 조치</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>비밀번호 암호화 저장 (bcrypt)</li>
              <li>전송 구간 HTTPS 암호화</li>
              <li>학원별 데이터 논리적 격리 (멀티테넌시)</li>
              <li>접근 권한 관리 및 접속 기록 보관</li>
              <li>정기 백업 및 보안 패치</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">8. 개인정보 자동 수집 장치 (쿠키)</h2>
            <p>회사는 로그인 유지 및 서비스 품질 향상을 위해 쿠키를 사용합니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며, 거부 시 일부 서비스 이용이 제한될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">9. 개인정보보호책임자</h2>
            <p>개인정보보호책임자: {legal.privacy_officer || '-'}</p>
            <p>연락처: {legal.privacy_officer_email || '-'}</p>
          </section>
        </article>
      </main>

      <LegalFooter />
    </div>
  );
}
