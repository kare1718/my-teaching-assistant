import { useState, useEffect } from 'react';
import { api, apiPut } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';

export default function AcademySettings() {
  const { config, setConfig } = useTenantConfig();
  const [schools, setSchools] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [siteTitle, setSiteTitle] = useState('');
  const [mainTitle, setMainTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (config) {
      setSchools(config.schools || []);
      setExamTypes(config.examTypes || []);
      setSiteTitle(config.siteTitle || '');
      setMainTitle(config.mainTitle || '');
    }
  }, [config]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const result = await apiPut('/academies/settings', { schools, examTypes, siteTitle, mainTitle });
      setMessage('설정이 저장되었습니다.');
      if (setConfig && result.settings) {
        setConfig(prev => ({ ...prev, ...result.settings }));
      }
    } catch (err) {
      setMessage('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addSchool = () => setSchools([...schools, { name: '', grades: ['1학년', '2학년'] }]);
  const removeSchool = (idx) => setSchools(schools.filter((_, i) => i !== idx));
  const updateSchool = (idx, key, val) => {
    const next = [...schools];
    next[idx] = { ...next[idx], [key]: val };
    setSchools(next);
  };

  const addExamType = () => setExamTypes([...examTypes, '']);
  const removeExamType = (idx) => setExamTypes(examTypes.filter((_, i) => i !== idx));

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 24 }}>학원 설정</h2>

      {message && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: message.includes('실패') ? '#fef2f2' : '#f0fdf4',
          color: message.includes('실패') ? '#dc2626' : '#16a34a', fontSize: 14
        }}>{message}</div>
      )}

      {/* 기본 정보 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>기본 정보</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>사이트 제목</label>
            <input value={siteTitle} onChange={e => setSiteTitle(e.target.value)} placeholder="학원 이름" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>메인 슬로건</label>
            <input value={mainTitle} onChange={e => setMainTitle(e.target.value)} placeholder="슬로건 문구" />
          </div>
        </div>
      </section>

      {/* 학교 관리 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>학교/학년 관리</h3>
          <button className="btn btn-primary" onClick={addSchool} style={{ fontSize: 13, padding: '6px 14px' }}>+ 학교 추가</button>
        </div>
        {schools.map((s, i) => (
          <div key={i} style={{ padding: 12, borderRadius: 8, background: 'var(--muted)', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input value={s.name} onChange={e => updateSchool(i, 'name', e.target.value)}
                placeholder="학교 이름" style={{ flex: 1 }} />
              <button onClick={() => removeSchool(i)} style={{
                background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
                padding: '6px 10px', cursor: 'pointer', fontSize: 12
              }}>삭제</button>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>학년 (쉼표로 구분)</div>
            <input value={(s.grades || []).join(', ')}
              onChange={e => updateSchool(i, 'grades', e.target.value.split(',').map(g => g.trim()).filter(Boolean))}
              placeholder="1학년, 2학년, 3학년" style={{ fontSize: 13 }} />
          </div>
        ))}
      </section>

      {/* 시험 유형 */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>시험 유형 관리</h3>
          <button className="btn btn-primary" onClick={addExamType} style={{ fontSize: 13, padding: '6px 14px' }}>+ 유형 추가</button>
        </div>
        {examTypes.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={t} onChange={e => {
              const next = [...examTypes];
              next[i] = e.target.value;
              setExamTypes(next);
            }} placeholder="시험 유형명" style={{ flex: 1 }} />
            <button onClick={() => removeExamType(i)} style={{
              background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6,
              padding: '6px 10px', cursor: 'pointer', fontSize: 12
            }}>삭제</button>
          </div>
        ))}
      </section>

      <button className="btn btn-primary" onClick={save} disabled={saving}
        style={{ width: '100%', fontSize: 16, padding: 14 }}>
        {saving ? '저장 중...' : '설정 저장'}
      </button>
    </div>
  );
}
