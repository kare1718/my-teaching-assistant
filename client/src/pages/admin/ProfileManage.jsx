import { useState, useEffect } from 'react';
import { api, apiPut } from '../../api';

export default function ProfileManage() {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [bioText, setBioText] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/admin/site-settings/instructor_profile').then(data => {
      if (data && data.name) {
        setProfile(data);
        setName(data.name || '');
        setSlogan(data.slogan || '');
        setBioText((data.bio || []).join('\n'));
      }
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const bio = bioText.split('\n').map(line => line.trimEnd());
      await apiPut('/admin/site-settings/instructor_profile', {
        value: { name, slogan, bio }
      });
      setMsg('저장되었습니다!');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <div className="content"><p style={{ color: 'var(--muted-foreground)' }}>로딩 중...</p></div>;

  return (
    <div className="content max-w-4xl mx-auto w-full">
      <h1>👨‍🏫 강사 프로필 관리</h1>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 'var(--space-4)' }}>
        로그인 페이지에 표시되는 강사 약력을 수정합니다.
      </p>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)',
          background: msg.includes('저장') ? 'var(--success-light)' : 'var(--destructive-light)',
          color: msg.includes('저장') ? 'oklch(30% 0.12 145)' : 'oklch(35% 0.15 25)',
          fontSize: 13, fontWeight: 600,
        }}>{msg}</div>
      )}

      <div className="card" style={{ padding: 'var(--space-5)', maxWidth: 600 }}>
        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ fontWeight: 700, fontSize: 13 }}>강사 이름 / 타이틀</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 국어 홍길동 T"
            style={{ fontSize: 'var(--text-sm)' }}
          />
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 'var(--space-1)' }}>
            로그인 페이지 프로필 카드에 표시됩니다.
          </p>
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ fontWeight: 700, fontSize: 13 }}>슬로건</label>
          <textarea
            value={slogan}
            onChange={e => setSlogan(e.target.value)}
            rows={3}
            placeholder="우리 학원의 슬로건을&#10;입력해주세요"
            style={{ fontSize: 14, resize: 'vertical' }}
          />
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 'var(--space-1)' }}>
            줄바꿈이 그대로 반영됩니다.
          </p>
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ fontWeight: 700, fontSize: 13 }}>약력</label>
          <textarea
            value={bioText}
            onChange={e => setBioText(e.target.value)}
            rows={8}
            placeholder="한 줄에 하나씩 입력&#10;부제목은 |로 구분 (예: 성북 학림학원 최다 수강생|(고1,2,3 / 23~26년도))&#10;빈 줄은 간격으로 표시됩니다"
            style={{ fontSize: 14, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.8 }}
          />
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 'var(--space-1)' }}>
            한 줄에 하나의 항목을 입력합니다. <code>|</code> 뒤에 부제목(작은 글씨)을 넣을 수 있습니다.<br />
            빈 줄은 여백으로 표시됩니다.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 120 }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 미리보기 */}
      <h2 style={{ marginTop: 'var(--space-6)', fontSize: 'var(--text-base)' }}>미리보기</h2>
      <div style={{
        maxWidth: 320, margin: '0 auto', padding: 'var(--space-6)', borderRadius: 16,
        background: 'var(--card)', boxShadow: '0 4px 20px oklch(0% 0 0 / 0.08)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 100, height: 100, borderRadius: 'var(--radius-full)', overflow: 'hidden',
          margin: '0 auto var(--space-4)', border: '3px solid var(--border)',
        }}>
          <img src="/uploads/profile.jpg" alt="프로필"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--primary)' }}>
          {name || '강사 이름'}
        </h3>
        <div style={{ width: 40, height: 2, background: 'var(--primary)', margin: '0 auto var(--space-4)', borderRadius: 2 }} />
        <div style={{ fontSize: 'var(--text-sm)' }}>
          <p style={{ fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--foreground)' }}>약력</p>
          {bioText.split('\n').map((line, i) => {
            if (!line.trim()) return <br key={i} />;
            const parts = line.split('|');
            return (
              <div key={i}>
                <p style={{ margin: '2px 0', color: parts[0].startsWith('전)') ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                  {parts[0]}
                </p>
                {parts[1] && (
                  <p style={{ fontSize: '0.85em', color: 'var(--muted-foreground)', margin: '0 0 4px' }}>
                    {parts[1]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
