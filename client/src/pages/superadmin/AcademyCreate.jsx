import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const TIERS = [
  { value: 'trial', label: '체험' },
  { value: 'basic', label: '베이직' },
  { value: 'standard', label: '스탠다드' },
  { value: 'pro', label: '프로' },
  { value: 'enterprise', label: '엔터프라이즈' },
];

const inputStyle = {
  width: '100%', padding: '12px 16px', border: '1.5px solid var(--border)',
  borderRadius: 12, fontSize: 14, fontFamily: FONT, outline: 'none',
  color: 'var(--foreground)', background: 'var(--card)', boxSizing: 'border-box',
};
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 };

export default function AcademyCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', slug: '', tier: 'trial',
    ownerUsername: '', ownerPassword: '', ownerName: '', ownerPhone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSlug = (name) => {
    const slug = name.replace(/[^a-zA-Z0-9가-힣]/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
    set('slug', slug);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.slug) { setError('학원 이름과 슬러그를 입력해주세요.'); return; }
    setLoading(true);
    try {
      const res = await apiPost('/superadmin/academies', form);
      navigate(`/superadmin/academy/${res.academyId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: 'var(--card)', borderRadius: 16, padding: '28px',
    border: '1px solid var(--border)', marginBottom: 20,
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: 640, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => navigate('/superadmin')}
          style={{
            padding: '8px 16px', background: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: 10, cursor: 'pointer', fontSize: 14, fontFamily: FONT, color: 'var(--foreground)',
          }}
        >
          ← 목록
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>학원 생성</h1>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 20,
          background: 'var(--destructive-light)', color: 'var(--destructive)', fontWeight: 600, fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: 'var(--foreground)' }}>학원 정보</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>학원 이름 *</label>
            <input style={inputStyle} value={form.name} onChange={e => { set('name', e.target.value); handleSlug(e.target.value); }} placeholder="예: 강인한 국어" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>슬러그 (URL) *</label>
            <input style={inputStyle} value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="예: kangin-korean" />
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>najogyo.com/login?academy={form.slug || '...'}</div>
          </div>
          <div>
            <label style={labelStyle}>구독 티어</label>
            <select style={inputStyle} value={form.tier} onChange={e => set('tier', e.target.value)}>
              {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px', color: 'var(--foreground)' }}>관리자 계정 (선택)</h3>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 16 }}>비워두면 관리자 계정 없이 학원만 생성됩니다.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>아이디</label>
              <input style={inputStyle} value={form.ownerUsername} onChange={e => set('ownerUsername', e.target.value)} placeholder="admin" />
            </div>
            <div>
              <label style={labelStyle}>비밀번호</label>
              <input style={inputStyle} type="password" value={form.ownerPassword} onChange={e => set('ownerPassword', e.target.value)} placeholder="********" />
            </div>
            <div>
              <label style={labelStyle}>이름</label>
              <input style={inputStyle} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="관리자" />
            </div>
            <div>
              <label style={labelStyle}>전화번호</label>
              <input style={inputStyle} value={form.ownerPhone} onChange={e => set('ownerPhone', e.target.value)} placeholder="010-0000-0000" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '16px', background: 'var(--primary)', color: 'var(--card)',
            border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700,
            fontFamily: FONT, cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '생성 중...' : '학원 생성'}
        </button>
      </form>
    </div>
  );
}
