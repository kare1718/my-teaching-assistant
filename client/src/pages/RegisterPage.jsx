import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { apiPost, apiGet } from '../api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const academySlug = searchParams.get('academy');
  const [userType, setUserType] = useState('');
  const [form, setForm] = useState({
    username: '', password: '', passwordConfirm: '', name: '',
    phone: '', school: '', grade: '',
    parentName: '', parentPhone: ''
  });
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [academyConfig, setAcademyConfig] = useState(null);

  useEffect(() => {
    if (academySlug) {
      apiGet(`/academies/config?slug=${academySlug}`)
        .then(data => setAcademyConfig(data))
        .catch(() => {});
    }
  }, [academySlug]);

  const schools = academyConfig?.schools?.filter(s => s.name !== '조교' && s.name !== '선생님') || [];
  const siteTitle = academyConfig?.siteTitle || '나만의 조교';
  const isStaff = userType === 'assistant' || userType === 'teacher';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!userType) { setError('가입 유형을 선택해주세요.'); return; }
    if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (!isStaff && (!form.school || !form.grade)) { setError('학교와 학년을 선택해주세요.'); return; }
    if (!form.phone) { setError('연락처를 입력해주세요.'); return; }
    if (!isStaff && (!form.parentName || !form.parentPhone)) { setError('학부모 정보를 입력해주세요.'); return; }
    if (!agreePrivacy) { setError('개인정보 수집 및 이용에 동의해주세요.'); return; }

    const submitData = { ...form, academySlug };
    if (userType === 'assistant') { submitData.school = '조교'; submitData.grade = '조교'; }
    else if (userType === 'teacher') { submitData.school = '선생님'; submitData.grade = '선생님'; }

    try {
      await apiPost('/auth/register', submitData);
      setSuccess('회원가입이 완료되었습니다! 관리자 승인 후 로그인 가능합니다.');
      setTimeout(() => navigate(academySlug ? `/login?academy=${academySlug}` : '/login'), 1500);
    } catch (err) {
      setError(err.message);
    }
  };

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const updatePhone = (key) => (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let formatted = raw;
    if (raw.length <= 3) formatted = raw;
    else if (raw.length <= 7) formatted = raw.slice(0, 3) + '-' + raw.slice(3);
    else formatted = raw.slice(0, 3) + '-' + raw.slice(3, 7) + '-' + raw.slice(7, 11);
    setForm({ ...form, [key]: formatted });
  };

  const selectedSchool = schools.find(s => s.name === form.school);
  const grades = selectedSchool ? selectedSchool.grades : [];

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <h1>{siteTitle}</h1>
        <p className="subtitle">계정을 만드세요</p>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {!userType ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>가입 유형을 선택하세요</p>
            {[
              { key: 'student', label: '학생', desc: '수업을 듣는 학생' },
              { key: 'assistant', label: '조교', desc: '수업 보조 및 관리 담당' },
              { key: 'teacher', label: '선생님', desc: '강사 및 교육 담당' },
            ].map(t => (
              <button key={t.key} type="button" onClick={() => setUserType(t.key)} style={{
                padding: '16px 20px', borderRadius: 12, border: '2px solid var(--border)',
                background: 'var(--card)', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s'
              }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#f8fafc'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)'; }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{t.desc}</div>
                </div>
              </button>
            ))}
            <p className="switch-link" style={{ marginTop: 8 }}>
              이미 계정이 있으신가요? <Link to={academySlug ? `/login?academy=${academySlug}` : '/login'}>로그인</Link>
            </p>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
              padding: '8px 14px', borderRadius: 8, background: 'var(--muted)'
            }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {userType === 'student' ? '학생' : userType === 'assistant' ? '조교' : '선생님'} 가입
              </span>
              <button type="button" onClick={() => { setUserType(''); setError(''); }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--primary)' }}>
                변경
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>아이디 *</label>
                  <input value={form.username} onChange={update('username')} placeholder="아이디" required />
                </div>
                <div className="form-group">
                  <label>이름 *</label>
                  <input value={form.name} onChange={update('name')} placeholder="이름" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>비밀번호 *</label>
                  <input type="password" value={form.password} onChange={update('password')} placeholder="비밀번호" required />
                </div>
                <div className="form-group">
                  <label>비밀번호 확인 *</label>
                  <input type="password" value={form.passwordConfirm} onChange={update('passwordConfirm')} placeholder="비밀번호 확인" required />
                </div>
              </div>

              <div className="form-group">
                <label>연락처 *</label>
                <input value={form.phone} onChange={updatePhone('phone')} placeholder="010-0000-0000" maxLength={13} required />
              </div>

              {userType === 'student' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>학교 *</label>
                      <select value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value, grade: '' })} required>
                        <option value="">선택하세요</option>
                        {schools.map((s) => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>학년 *</label>
                      <select value={form.grade} onChange={update('grade')} required disabled={!form.school}>
                        <option value="">선택하세요</option>
                        {grades.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>학부모 이름 *</label>
                      <input value={form.parentName} onChange={update('parentName')} placeholder="학부모 이름" />
                    </div>
                    <div className="form-group">
                      <label>학부모 연락처 *</label>
                      <input value={form.parentPhone} onChange={updatePhone('parentPhone')} placeholder="010-0000-0000" maxLength={13} />
                    </div>
                  </div>
                </>
              )}

              <div style={{
                background: 'var(--muted)', borderRadius: 10, padding: '14px 16px',
                marginBottom: 16, fontSize: 13
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} id="agreePrivacy"
                    style={{ marginTop: 3, width: 18, height: 18, cursor: 'pointer' }} />
                  <label htmlFor="agreePrivacy" style={{ cursor: 'pointer', lineHeight: 1.5 }}>
                    <b>[필수]</b> 개인정보 수집 및 이용에 동의합니다.
                  </label>
                </div>
                <button type="button" onClick={() => setShowPrivacy(!showPrivacy)} style={{
                  background: 'none', border: 'none', color: 'var(--primary)',
                  fontSize: 12, cursor: 'pointer', marginTop: 6, padding: 0, textDecoration: 'underline'
                }}>
                  {showPrivacy ? '접기' : '개인정보 처리방침 보기'}
                </button>
                {showPrivacy && (
                  <div style={{
                    marginTop: 10, padding: '12px 14px', background: 'var(--card)',
                    borderRadius: 8, fontSize: 12, lineHeight: 1.7,
                    color: 'var(--muted-foreground)', maxHeight: 240, overflow: 'auto',
                    border: '1px solid var(--border)'
                  }}>
                    <p><b>1. 수집하는 개인정보 항목</b></p>
                    <p>- 이름, 아이디, 비밀번호(암호화 저장), 연락처</p>
                    <p>- 학생의 경우: 학부모 이름/연락처, 학교/학년 정보</p>
                    <p style={{ marginTop: 8 }}><b>2. 수집 및 이용 목적</b></p>
                    <p>- 학원 수업 관리, 성적 관리, 출결 확인, 학부모 연락</p>
                    <p style={{ marginTop: 8 }}><b>3. 보유 기간</b></p>
                    <p>- 수강 종료 시 즉시 파기, 탈퇴 요청 시 지체 없이 삭제</p>
                    <p style={{ marginTop: 8 }}><b>4. 마케팅 활용</b></p>
                    <p>- <b>학원 관리 목적으로만 사용, 마케팅/광고/제3자 제공 절대 불가</b></p>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" disabled={!agreePrivacy}
                style={{ opacity: agreePrivacy ? 1 : 0.5 }}>회원가입</button>
            </form>
            <p className="switch-link">
              이미 계정이 있으신가요? <Link to={academySlug ? `/login?academy=${academySlug}` : '/login'}>로그인</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
