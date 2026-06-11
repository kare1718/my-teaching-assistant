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
          <Link to="/" className="text-xl font-extrabold text-[var(--primary)] tracking-tight">나만의 조교</Link>
          <Link to="/" className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-[var(--cta)]">홈으로</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold text-[var(--primary)] tracking-tight mb-2">개인정보처리방침</h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">최종 개정일: 2026년 6월 12일 · 최초 시행일: 2026년 4월 15일</p>

        <article className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 space-y-8 text-sm leading-7 text-slate-700">
          <p>나만의 조교(이하 "회사")는 개인정보보호법 등 관련 법령을 준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.</p>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">1. 적용 범위 및 학원 데이터의 처리 구조</h2>
            <p>본 서비스는 학원을 위한 관리 플랫폼입니다. 서비스 내 데이터는 다음 두 가지로 구분되어 처리됩니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><b>회원(학원 운영자) 정보</b>: 회사가 개인정보처리자로서 직접 수집·이용합니다.</li>
              <li><b>학원이 등록·관리하는 학생/보호자 정보</b>: 해당 정보의 개인정보처리자는 <b>각 학원</b>이며, 회사는 개인정보보호법 제26조에 따라 학원으로부터 처리를 위탁받은 <b>수탁자</b>로서 서비스 제공 목적 범위 내에서만 처리합니다. 학원은 학생·보호자로부터 적법한 동의를 받을 책임이 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">2. 개인정보 수집 항목 및 수집 방법</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원가입 시: 이름, 이메일, 연락처(휴대폰 본인 인증 포함), 소속 학원명, 비밀번호</li>
              <li>학생/보호자 관리 시: 학생 이름, 학년, 연락처, 학부모 연락처, 출결·성적·과제·상담 기록</li>
              <li>결제 시: 카드사명, 카드번호(마스킹), 결제 승인번호 (PG사 위탁)</li>
              <li>자동 수집: 접속 IP, 쿠키, 접속 로그, 기기정보, 브라우저 정보</li>
            </ul>
            <p className="mt-2">수집 방법: 홈페이지 회원가입, 서비스 이용 과정에서의 직접 입력, 자동 수집 도구.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">3. 개인정보 수집 및 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>서비스 제공 및 계약 이행, 요금 정산</li>
              <li>회원 식별, 본인 확인, 부정 이용 방지</li>
              <li>공지사항 전달, 고객 상담 및 불만 처리</li>
              <li>서비스 개선 및 신규 기능 개발을 위한 통계 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">4. 개인정보 보유 및 이용 기간</h2>
            <p>원칙적으로 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관련 법령에 의해 일정 기간 보존이 필요한 경우 다음과 같이 보관합니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
              <li>대금결제 및 재화 공급 기록: 5년</li>
              <li>소비자 불만 또는 분쟁처리 기록: 3년</li>
              <li>접속 로그: 3개월</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">5. 개인정보의 파기 절차 및 방법</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>파기 절차</b>: 보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 내부 방침에 따라 지체 없이 파기 대상으로 선정되어 파기됩니다. 학원이 학생을 삭제하거나 회원이 탈퇴하는 경우 관련 데이터는 법정 보존 의무가 있는 항목을 제외하고 파기됩니다.</li>
              <li><b>파기 방법</b>: 전자적 파일 형태의 정보는 복구할 수 없는 기술적 방법으로 영구 삭제하며, 출력물은 분쇄 또는 소각합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">6. 개인정보의 제3자 제공</h2>
            <p>회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 법령의 규정에 의하거나 수사기관의 적법한 요청이 있는 경우는 예외로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">7. 개인정보의 처리 위탁</h2>
            <p>회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하고 있으며, 위탁 계약 시 개인정보 보호 관련 법규 준수를 명확히 규정하고 관리·감독합니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><b>Supabase</b> — 데이터베이스 및 인프라 운영</li>
              <li><b>Render</b> — 서버 호스팅</li>
              <li><b>PortOne</b> — 결제 대행</li>
              <li><b>Solapi</b> — SMS(문자) 발송</li>
              <li><b>Google (Gemini API)</b> — AI 기능(AI 보조, 퀴즈 생성, AI 리포트 등) 처리</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">8. 개인정보의 국외 이전</h2>
            <p>회사는 안정적인 서비스 제공을 위해 국외 사업자가 운영하는 클라우드 인프라를 이용하며, 이 과정에서 개인정보가 국외에서 보관·처리될 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><b>Supabase Inc. / Render Inc.</b> (미국 등) — 데이터 보관 및 서버 운영. 서비스 이용 기간 동안 네트워크를 통해 수시 이전·보관됩니다.</li>
              <li><b>Google LLC</b> (미국 등) — AI 기능 이용 시 처리에 필요한 데이터(질문 내용, 관련 학습 데이터 등)가 API를 통해 일시 전송·처리됩니다. API로 전송된 데이터는 Google의 API 정책에 따라 AI 모델 학습에 사용되지 않습니다.</li>
            </ul>
            <p className="mt-2">이용자는 국외 이전을 거부할 수 있으나, 이 경우 서비스 이용이 제한될 수 있습니다. 거부는 고객센터를 통해 요청할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">9. 만 14세 미만 아동의 개인정보</h2>
            <p>학원이 만 14세 미만 학생의 정보를 등록·관리하는 경우, 해당 학원은 개인정보보호법 제22조의2에 따라 법정대리인의 동의를 받아야 합니다. 회사는 수탁자로서 학원이 등록한 정보를 서비스 제공 목적으로만 처리하며, 학생 본인이 직접 회원가입하는 경우 만 14세 미만은 법정대리인 동의 확인 절차를 거칩니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">10. 정보주체의 권리와 행사 방법</h2>
            <p>이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있으며, 고객센터를 통해 행사할 수 있습니다. 회사는 요청을 받은 날부터 10일 이내에 조치 결과를 통지합니다. 학원이 등록한 학생/보호자 정보에 대한 권리 행사는 1차적으로 해당 학원에 요청할 수 있으며, 회사에 직접 요청하는 경우 회사는 해당 학원에 지체 없이 전달하여 처리되도록 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">11. 개인정보의 안전성 확보 조치</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>비밀번호 암호화 저장 (bcrypt)</li>
              <li>전송 구간 HTTPS 암호화</li>
              <li>학원별 데이터 논리적 격리 (멀티테넌시)</li>
              <li>역할 기반 접근 권한 관리 및 감사 로그(접속·처리 기록) 보관</li>
              <li>정기 백업 및 보안 패치</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">12. 개인정보 자동 수집 장치 (쿠키)</h2>
            <p>회사는 로그인 유지 및 서비스 품질 향상을 위해 쿠키를 사용합니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며, 거부 시 일부 서비스 이용이 제한될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">13. 개인정보보호책임자 및 권익침해 구제 방법</h2>
            <p>개인정보보호책임자: {legal.privacy_officer || '-'}</p>
            <p>연락처: {legal.privacy_officer_email || '-'}</p>
            <p className="mt-2">개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의할 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>개인정보침해 신고센터 (한국인터넷진흥원): 국번 없이 118 / privacy.kisa.or.kr</li>
              <li>개인정보 분쟁조정위원회: 1833-6972 / kopico.go.kr</li>
              <li>대검찰청 사이버수사과: 국번 없이 1301 / spo.go.kr</li>
              <li>경찰청 사이버수사국: 국번 없이 182 / ecrm.police.go.kr</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">14. 개정 이력</h2>
            <p>본 방침이 변경되는 경우 시행 7일 전(중요한 변경은 30일 전)부터 서비스 내 공지사항을 통해 고지합니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>2026년 6월 12일 개정: 처리 위탁(AI 포함)·국외 이전·만 14세 미만 아동·파기 절차·권익침해 구제 방법 명시</li>
              <li>2026년 4월 15일 최초 시행</li>
            </ul>
          </section>
        </article>
      </main>

      <LegalFooter />
    </div>
  );
}
