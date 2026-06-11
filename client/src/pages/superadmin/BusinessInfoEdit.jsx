// 슈퍼관리자 — 플랫폼 사업자 정보 수정 페이지
// 토스페이먼츠/카드사 심사를 위해 실제 사업자등록증 정보를 입력하는 곳
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPut } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const FIELDS = [
  { key: 'company_name', label: '상호 (사업자등록증 기재 그대로)', placeholder: '케이아이에듀테크', required: true },
  { key: 'ceo_name', label: '대표자명', placeholder: '홍길동', required: true },
  { key: 'business_number', label: '사업자등록번호', placeholder: '123-45-67890', required: true,
    hint: '하이픈(-) 포함 형식' },
  { key: 'ecommerce_number', label: '통신판매업 신고번호',
    placeholder: '제2026-서울강남-1234호',
    hint: '간이과세자면 비워두세요. 없으면 국민카드만 제외됩니다.' },
  { key: 'address', label: '사업장 주소', placeholder: '서울특별시 강남구 …', required: true,
    hint: '우편번호 포함 전체 주소' },
  { key: 'phone', label: '대표 연락처', placeholder: '070-1234-5678', required: true,
    hint: '070/0505/전국대표/080/휴대폰 모두 가능' },
  { key: 'email', label: '고객 이메일', placeholder: 'support@najogyo.com', required: true },
  { key: 'privacy_officer', label: '개인정보보호책임자 성명', placeholder: '홍길동', required: true },
  { key: 'privacy_officer_email', label: '보호책임자 이메일', placeholder: 'privacy@najogyo.com', required: true },
];

const cardStyle = {
  background: 'var(--card)', borderRadius: 16, padding: '28px 32px',
  border: '1px solid var(--border)',
};

export default function BusinessInfoEdit() {
  const navigate = useNavigate();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/legal-info').then((d) => {
      const cleaned = { ...d };
      // placeholder 값은 비워서 사용자가 실값 입력하도록 유도
      for (const key of Object.keys(cleaned)) {
        const v = cleaned[key];
        if (typeof v === 'string' && (v.includes('미설정') || v === '000-00-00000' || v === '제0000-서울-0000호' || v === '02-0000-0000')) {
          cleaned[key] = '';
        }
      }
      setForm(cleaned);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    setErr(''); setMsg('');
    const missing = FIELDS.filter(f => f.required && !form[f.key]?.trim());
    if (missing.length) {
      setErr(`필수 항목 누락: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      await apiPut('/legal-info', form);
      setMsg('✅ 저장되었습니다. https://najogyo.com/business-info 에서 확인하세요.');
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      setErr(e.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT }}>로딩 중...</div>;

  return (
    <div style={{ padding: '32px 24px', maxWidth: 780, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/superadmin')}
          style={{
            padding: '8px 16px', background: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: 10, cursor: 'pointer', fontSize: 14, fontFamily: FONT, color: 'var(--foreground)',
          }}>← 뒤로</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>사업자 정보 관리</h1>
      </div>

      <div style={{ ...cardStyle, marginBottom: 20, background: 'oklch(96% 0.04 90)', borderColor: 'oklch(80% 0.12 90)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'oklch(35% 0.14 70)', lineHeight: 1.6 }}>
          ⚠ 이 정보는 <b>https://najogyo.com/business-info</b> 에 공개되며 카드사/PG사 심사에 사용됩니다.<br/>
          사업자등록증에 기재된 정보와 <b>완전히 일치</b>해야 합니다. 오타·누락 시 심사 탈락 사유가 됩니다.
        </p>
      </div>

      {err && (
        <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontWeight: 600, fontSize: 14,
          background: '#fee2e2', color: '#dc2626' }}>{err}</div>
      )}
      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontWeight: 600, fontSize: 14,
          background: '#d1fae5', color: '#059669' }}>{msg}</div>
      )}

      <div style={cardStyle}>
        {FIELDS.map((f, i) => (
          <div key={f.key} style={{ marginBottom: i === FIELDS.length - 1 ? 0 : 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
              {f.label}
              {f.required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
            </label>
            <input
              value={form[f.key] || ''}
              onChange={update(f.key)}
              placeholder={f.placeholder}
              style={{
                width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
                borderRadius: 10, fontSize: 14, fontFamily: FONT, outline: 'none',
                background: 'var(--card)', color: 'var(--foreground)', boxSizing: 'border-box',
              }}
            />
            {f.hint && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>{f.hint}</p>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <button onClick={save} disabled={saving}
            style={{
              flex: 1, padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700,
              fontFamily: FONT, cursor: saving ? 'default' : 'pointer', border: 'none',
              background: 'var(--primary)', color: '#fff', opacity: saving ? 0.6 : 1,
            }}>
            {saving ? '저장 중...' : '저장'}
          </button>
          <button onClick={() => window.open('/business-info', '_blank')}
            style={{
              padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
              fontFamily: FONT, cursor: 'pointer', border: '1.5px solid var(--border)',
              background: 'var(--card)', color: 'var(--foreground)',
            }}>
            공개 페이지 확인 ↗
          </button>
        </div>
      </div>
    </div>
  );
}
