import { Link } from 'react-router-dom';
import LegalFooter from '../../components/LegalFooter';

export default function Refund() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold text-[#102044] tracking-tight">나만의 조교</Link>
          <Link to="/" className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-[#004bf0]">홈으로</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold text-[#102044] tracking-tight mb-2">환불정책</h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">시행일: 2026년 4월 15일</p>

        <article className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">1. 환불 원칙</h2>
            <p>나만의 조교는 이용자가 안심하고 서비스를 이용할 수 있도록 아래와 같이 환불정책을 운영합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">2. 무료 체험</h2>
            <p>Free 플랜은 무료로 제공되며 결제 및 환불이 발생하지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">3. 월간 구독 환불</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>결제일로부터 7일 이내이며 서비스를 실질적으로 사용하지 않은 경우: 전액 환불</li>
              <li>결제일로부터 7일이 경과하였거나 서비스를 사용한 경우: 잔여 기간에 대한 환불은 원칙적으로 불가하며, 다음 결제일부터 구독이 해지됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">4. 회사 귀책에 의한 환불</h2>
            <p>서비스 장애, 중대한 결함 등 회사의 귀책사유로 서비스를 정상적으로 이용할 수 없었던 경우, 해당 기간에 해당하는 금액을 일할 계산하여 환불하거나 이용 기간을 연장합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">5. 환불 신청 방법</h2>
            <p>환불을 원하는 이용자는 고객센터 이메일 또는 전화로 신청할 수 있으며, 회사는 영업일 기준 3일 이내에 처리합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#102044] mb-3">6. 환불 제외 사항</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>이용자가 약관을 위반하여 서비스 이용이 정지된 경우</li>
              <li>이용자의 단순 변심으로 인한 결제 후 7일 경과 요청</li>
              <li>First Class 플랜 등 별도 계약서에 명시된 환불 조항이 우선하는 경우</li>
            </ul>
          </section>
        </article>
      </main>

      <LegalFooter />
    </div>
  );
}
