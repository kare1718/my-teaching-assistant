import { Link } from 'react-router-dom';
import LegalFooter from '../../components/LegalFooter';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold text-[var(--primary)] tracking-tight">나만의 조교</Link>
          <Link to="/" className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-[var(--cta)]">홈으로</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold text-[var(--primary)] tracking-tight mb-2">이용약관</h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">최종 개정일: 2026년 6월 12일 · 최초 시행일: 2026년 4월 15일</p>

        <article className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">제1조 (목적)</h2>
            <p>이 약관은 "나만의 조교"(이하 "회사")가 제공하는 학원 운영 SaaS 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">제2조 (정의)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>"서비스"란 회사가 제공하는 학원 운영 자동화 플랫폼 및 관련 제반 서비스를 의미합니다.</li>
              <li>"이용자"란 본 약관에 동의하고 서비스를 이용하는 학원 운영자, 강사, 보호자, 학생을 말합니다.</li>
              <li>"유료 서비스"란 회사가 유료로 제공하는 구독 플랜 및 부가 서비스를 말합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">제3조 (약관의 효력 및 변경)</h2>
            <p>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다. 회사는 필요한 경우 관련 법령을 위반하지 않는 범위에서 약관을 개정할 수 있으며, 개정된 약관은 적용일자 7일 전부터 공지합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">제4조 (서비스의 제공)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>회사는 학생 관리, 출결, 수납, 공지, 상담, 자동화, 리포트 등 학원 운영에 필요한 기능을 제공합니다.</li>
              <li>서비스는 연중무휴 24시간 제공을 원칙으로 하되, 시스템 점검·장애·불가항력 등으로 일시 중단될 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">제5조 (유료 서비스 및 결제)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>유료 서비스의 가격, 구성, 결제 방식은 서비스 내 요금제 페이지에 게시된 내용에 따릅니다.</li>
              <li>모든 가격은 부가가치세(VAT) 별도입니다.</li>
              <li>결제는 신용카드 자동결제 등 회사가 정한 방법으로 이루어집니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">제6조 (AI 기능의 이용)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>회사는 인공지능(AI)을 활용한 보조 기능(AI 보조, 퀴즈 생성, AI 리포트 등)을 제공할 수 있습니다.</li>
              <li>AI가 생성한 결과물은 참고용 자료이며, 회사는 그 정확성·완전성을 보증하지 않습니다. 이용자는 결과물을 검토한 후 활용하여야 하며, 이를 그대로 사용하여 발생한 결과에 대한 책임은 이용자에게 있습니다.</li>
              <li>AI 기능의 데이터 처리에 관한 사항은 개인정보처리방침에 따릅니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">제7조 (이용자의 의무 및 개인정보 보호)</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>이용자는 타인의 정보 도용, 서비스 운영 방해, 법령 위반 행위를 하여서는 안 됩니다.</li>
              <li>학원 운영자가 서비스에 등록하는 학생·보호자 정보의 개인정보처리자는 해당 학원이며, 학원 운영자는 정보주체로부터 적법한 동의(만 14세 미만 학생의 경우 법정대리인 동의)를 받는 등 개인정보보호법을 준수하여야 합니다.</li>
              <li>회사는 학원이 등록한 정보를 서비스 제공 목적 범위 내에서 수탁 처리하며, 자세한 사항은 개인정보처리방침에 따릅니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">제8조 (회사의 면책)</h2>
            <p>회사는 천재지변, 불가항력, 이용자의 귀책사유로 인한 서비스 중단·손해에 대하여 책임을 지지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--primary)] mb-3">제9조 (준거법 및 분쟁 해결)</h2>
            <p>본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련한 분쟁은 민사소송법상 관할 법원에 제소합니다.</p>
          </section>
        </article>
      </main>

      <LegalFooter />
    </div>
  );
}
