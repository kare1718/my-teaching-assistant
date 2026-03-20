import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { apiPost, apiGet, saveAuth } from '../api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const academySlug = searchParams.get('academy');
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [showFindPw, setShowFindPw] = useState(false);
  const [findForm, setFindForm] = useState({ username: '', name: '', phone: '' });
  const [findResult, setFindResult] = useState(null);
  const [findError, setFindError] = useState('');
  const [academyConfig, setAcademyConfig] = useState(null);

  useEffect(() => {
    if (academySlug) {
      apiGet(`/academies/config?slug=${academySlug}`)
        .then(data => setAcademyConfig(data))
        .catch(() => {});
    }
  }, [academySlug]);

  const siteTitle = academyConfig?.siteTitle || '나만의 조교';
  const mainTitle = academyConfig?.mainTitle || '나만의 조교로 학원 운영을 더욱 편리하게';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await apiPost('/auth/login', { ...form, academySlug });
      saveAuth(data.token, data.user);
      const isAssistant = data.user.school === '조교';
      navigate((data.user.role === 'admin' || isAssistant) ? '/admin' : '/student');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFindPassword = async () => {
    setFindError('');
    setFindResult(null);
    if (!findForm.username || !findForm.name || !findForm.phone) {
      setFindError('모든 항목을 입력해주세요.');
      return;
    }
    try {
      const data = await apiPost('/auth/find-password', findForm);
      setFindResult(data.tempPassword);
    } catch (err) {
      setFindError(err.message);
    }
  };

  const primaryColor = academyConfig?.branding?.primaryColor || '#1e3a5f';

  return (
    <div className="auth-container" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `linear-gradient(135deg, ${primaryColor}22 0%, ${primaryColor}08 100%)`,
      }} />

      {showFindPw && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setShowFindPw(false); setFindResult(null); setFindError(''); }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, width: 320, maxWidth: '90vw', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, textAlign: 'center' }}>비밀번호 찾기</h3>
            {findError && <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{findError}</div>}
            {findResult ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 12, marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>임시 비밀번호가 발급되었습니다</p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)', letterSpacing: 4 }}>{findResult}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 8 }}>로그인 후 비밀번호를 변경해주세요</p>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setShowFindPw(false); setFindResult(null); }}>확인</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input placeholder="아이디" value={findForm.username} onChange={e => setFindForm({...findForm, username: e.target.value})} />
                <input placeholder="이름" value={findForm.name} onChange={e => setFindForm({...findForm, name: e.target.value})} />
                <input placeholder="가입 시 입력한 전화번호" value={findForm.phone} onChange={e => setFindForm({...findForm, phone: e.target.value})} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFindPassword}>찾기</button>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowFindPw(false)}>취소</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="auth-card" style={{ position: 'relative', zIndex: 1, maxWidth: 420 }}>
        <h1 style={{ fontSize: '1.6em', marginBottom: 4 }}>{siteTitle}</h1>
        <p className="subtitle" style={{ marginBottom: 4 }}>{mainTitle}</p>
        <p className="subtitle">로그인하여 시작하세요</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>아이디</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="아이디를 입력하세요"
              required
            />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">로그인</button>
        </form>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
          <span className="switch-link" style={{ cursor: 'pointer', color: 'var(--primary)', fontSize: 13 }}
            onClick={() => setShowFindPw(true)}>비밀번호 찾기</span>
          <Link to={academySlug ? `/register?academy=${academySlug}` : '/register'} className="switch-link" style={{ fontSize: 13 }}>회원가입</Link>
        </div>
      </div>
    </div>
  );
}
