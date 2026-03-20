import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, saveAuth } from '../api';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    academyName: '', slug: '', subject: '',
    adminUsername: '', adminPassword: '', adminPasswordConfirm: '',
    adminName: '', adminPhone: ''
  });
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (key === 'slug') setSlugAvailable(null);
  };

  const checkSlug = async () => {
    if (!form.slug || form.slug.length < 3) return;
    try {
      const res = await fetch(`/api/onboarding/check-slug?slug=${form.slug}`);
      const data = await res.json();
      setSlugAvailable(data.available);
    } catch {
      setSlugAvailable(null);
    }
  };

  const autoSlug = () => {
    const slug = form.academyName
      .replace(/[가-힣]/g, (c) => {
        const code = c.charCodeAt(0) - 0xAC00;
        const initial = Math.floor(code / 588);
        const initials = 'gknsddlmbsjjctkph';
        return initials[initial] || '';
      })
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    setForm({ ...form, slug });
    setSlugAvailable(null);
  };

  const handleSubmit = async () => {
    setError('');
    if (form.adminPassword !== form.adminPasswordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (form.adminPassword.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiPost('/onboarding/create-academy', form);
      saveAuth(data.token, data.user);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 32, maxWidth: 480, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '1.5em', fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>나만의 조교</h1>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 14, marginBottom: 24 }}>학원 등록 (3단계 중 {step}단계)</p>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              flex: 1, height: 6, borderRadius: 3,
              background: s <= step ? '#2563eb' : '#e5e7eb',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: '1.1em', fontWeight: 700 }}>학원 정보</h2>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>학원 이름 *</label>
              <input value={form.academyName} onChange={update('academyName')} placeholder="예: 강인한국어연구소" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>
                학원 주소 (slug) *
                <span style={{ fontWeight: 400, color: '#6b7280' }}> — 로그인 URL에 사용됩니다</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.slug} onChange={update('slug')} onBlur={checkSlug} placeholder="kangin-korean" style={{ flex: 1 }} />
                <button type="button" onClick={autoSlug} style={{
                  padding: '8px 12px', fontSize: 12, borderRadius: 8, border: '1px solid #d1d5db',
                  background: '#f9fafb', cursor: 'pointer', whiteSpace: 'nowrap'
                }}>자동 생성</button>
              </div>
              {slugAvailable === true && <p style={{ color: '#16a34a', fontSize: 12, marginTop: 4 }}>사용 가능한 주소입니다</p>}
              {slugAvailable === false && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>이미 사용 중인 주소입니다</p>}
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>주요 과목 (선택)</label>
              <input value={form.subject} onChange={update('subject')} placeholder="예: 국어, 수학, 영어" />
            </div>
            <button className="btn btn-primary" onClick={() => {
              if (!form.academyName || !form.slug) { setError('학원 이름과 주소를 입력해주세요.'); return; }
              setError(''); setStep(2);
            }}>다음</button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: '1.1em', fontWeight: 700 }}>관리자 계정 만들기</h2>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>관리자 이름 *</label>
              <input value={form.adminName} onChange={update('adminName')} placeholder="이름" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>아이디 *</label>
              <input value={form.adminUsername} onChange={update('adminUsername')} placeholder="관리자 아이디" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>비밀번호 *</label>
              <input type="password" value={form.adminPassword} onChange={update('adminPassword')} placeholder="비밀번호 (4자 이상)" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>비밀번호 확인 *</label>
              <input type="password" value={form.adminPasswordConfirm} onChange={update('adminPasswordConfirm')} placeholder="비밀번호 확인" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>연락처 (선택)</label>
              <input value={form.adminPhone} onChange={update('adminPhone')} placeholder="010-0000-0000" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setStep(1)} style={{ flex: 1 }}>이전</button>
              <button className="btn btn-primary" onClick={() => {
                if (!form.adminName || !form.adminUsername || !form.adminPassword) { setError('필수 항목을 입력해주세요.'); return; }
                setError(''); setStep(3);
              }} style={{ flex: 1 }}>다음</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: '1.1em', fontWeight: 700 }}>확인</h2>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, fontSize: 14 }}>
              <p><b>학원:</b> {form.academyName}</p>
              <p><b>주소:</b> {form.slug}</p>
              {form.subject && <p><b>과목:</b> {form.subject}</p>}
              <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
              <p><b>관리자:</b> {form.adminName} ({form.adminUsername})</p>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 16, fontSize: 13 }}>
              <p style={{ fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>14일 무료 체험으로 시작!</p>
              <p style={{ color: '#6b7280' }}>학생 10명까지 모든 기능 무료 체험. 이후 플랜을 선택하세요.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setStep(2)} style={{ flex: 1 }}>이전</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ flex: 1 }}>
                {loading ? '생성 중...' : '학원 만들기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
