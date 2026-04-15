import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LegalFooter from '../../components/LegalFooter';

export default function BusinessInfo() {
  const [legal, setLegal] = useState({});
  useEffect(() => {
    fetch('/api/legal-info').then(r => r.ok ? r.json() : {}).then(setLegal).catch(() => {});
  }, []);

  const Row = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</div>
      <div className="col-span-2 text-sm text-slate-700">{value || '-'}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold text-[#102044] tracking-tight">나만의 조교</Link>
          <Link to="/" className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-[#004bf0]">홈으로</Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold text-[#102044] tracking-tight mb-2">사업자 정보</h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">전자상거래법 고지사항</p>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
          <Row label="상호" value={legal.company_name} />
          <Row label="대표자" value={legal.ceo_name} />
          <Row label="사업자등록번호" value={legal.business_number} />
          <Row label="통신판매업 신고번호" value={legal.ecommerce_number} />
          <Row label="주소" value={legal.address} />
          <Row label="전화" value={legal.phone} />
          <Row label="이메일" value={legal.email} />
          <Row label="개인정보보호책임자" value={legal.privacy_officer} />
          <Row label="보호책임자 연락처" value={legal.privacy_officer_email} />
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
