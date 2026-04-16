import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function LegalFooter() {
  const [legal, setLegal] = useState({
    company_name: '나만의 조교',
    ceo_name: '',
    business_number: '',
    ecommerce_number: '',
    address: '',
    phone: '',
    email: 'support@najogyo.com',
    privacy_officer: '',
    privacy_officer_email: '',
  });

  useEffect(() => {
    let alive = true;
    fetch('/api/legal-info')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive && data) setLegal(prev => ({ ...prev, ...data })); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <footer className="bg-[var(--primary)] text-slate-400 py-10 px-8 mt-auto">
      <div className="max-w-6xl mx-auto">
        {/* 회사 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-white font-bold mb-3">나만의 조교</h3>
            <p className="text-xs">학원 운영 자동화 SaaS</p>
          </div>

          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-3">서비스</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/pricing" className="hover:text-white transition-colors">요금제</Link></li>
              <li><Link to="/features" className="hover:text-white transition-colors">기능 소개</Link></li>
              <li><Link to="/demo" className="hover:text-white transition-colors">데모 요청</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-3">정책</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/terms" className="hover:text-white transition-colors">이용약관</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">개인정보처리방침</Link></li>
              <li><Link to="/refund" className="hover:text-white transition-colors">환불정책</Link></li>
              <li><Link to="/business-info" className="hover:text-white transition-colors">사업자정보</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-widest mb-3">고객지원</h4>
            <ul className="space-y-2 text-xs">
              <li>이메일: {legal.email || '-'}</li>
              <li>전화: {legal.phone || '-'}</li>
              <li>운영시간: 평일 10-18시</li>
            </ul>
          </div>
        </div>

        {/* 사업자 정보 */}
        <div className="border-t border-white/10 pt-6 text-[11px] space-y-1">
          <p>{legal.company_name || '나만의 조교'} | 대표: {legal.ceo_name || '-'}</p>
          <p>사업자등록번호: {legal.business_number || '-'} | 통신판매업 신고번호: {legal.ecommerce_number || '-'}</p>
          <p>주소: {legal.address || '-'}</p>
          <p>개인정보보호책임자: {legal.privacy_officer || '-'} ({legal.privacy_officer_email || '-'})</p>
          <p className="mt-3">© 2026 나만의 조교. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
