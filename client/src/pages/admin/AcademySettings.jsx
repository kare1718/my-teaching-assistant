import { useState, useEffect } from 'react';
import { api, apiPut } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import { useUIStore } from '../../stores/useUIStore';

export default function AcademySettings() {
  const { config, setConfig } = useTenantConfig();
  const { theme, setTheme } = useUIStore();
  const [schools, setSchools] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [siteTitle, setSiteTitle] = useState('');
  const [mainTitle, setMainTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [clinicTopics, setClinicTopics] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [sidebarPinned, setSidebarPinned] = useState(
    () => localStorage.getItem('adminSidebarPinned') === 'true'
  );

  useEffect(() => {
    if (config) {
      setSchools(config.schools || []);
      setExamTypes(config.examTypes || []);
      setSiteTitle(config.siteTitle || '');
      setMainTitle(config.mainTitle || '');
      setClinicTopics(config.clinicSettings?.topics || []);
      setPhone(config.academyInfo?.phone || '');
      setAddress(config.academyInfo?.address || '');
    }
  }, [config]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const result = await apiPut('/academies/settings', {
        schools, examTypes, siteTitle, mainTitle,
        academyInfo: { phone, address },
        clinicSettings: { topics: clinicTopics.length > 0 ? clinicTopics : undefined },
      });
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

  const addExamCategory = () => setExamTypes([...examTypes, { key: '', label: '', types: [] }]);
  const removeExamCategory = (idx) => setExamTypes(examTypes.filter((_, i) => i !== idx));
  const updateExamCategory = (idx, field, val) => {
    const next = [...examTypes];
    next[idx] = { ...next[idx], [field]: val };
    if (field === 'label' && !next[idx].key) {
      next[idx].key = val.replace(/\s+/g, '_').toLowerCase();
    }
    setExamTypes(next);
  };
  const addSubType = (catIdx) => {
    const next = [...examTypes];
    next[catIdx] = { ...next[catIdx], types: [...(next[catIdx].types || []), ''] };
    setExamTypes(next);
  };
  const removeSubType = (catIdx, typeIdx) => {
    const next = [...examTypes];
    next[catIdx] = { ...next[catIdx], types: next[catIdx].types.filter((_, i) => i !== typeIdx) };
    setExamTypes(next);
  };
  const updateSubType = (catIdx, typeIdx, val) => {
    const next = [...examTypes];
    const types = [...next[catIdx].types];
    types[typeIdx] = val;
    next[catIdx] = { ...next[catIdx], types };
    setExamTypes(next);
  };

  const handleToggleSidebarPin = () => {
    const next = !sidebarPinned;
    setSidebarPinned(next);
    localStorage.setItem('adminSidebarPinned', String(next));
    if (next) localStorage.setItem('adminSidebarOpen', 'true');
    window.dispatchEvent(new Event('sidebarPinChanged'));
  };

  const themeOptions = [
    { value: 'light', label: '라이트', icon: '\u2600\uFE0F' },
    { value: 'dark', label: '다크', icon: '\uD83C\uDF19' },
    { value: 'system', label: '시스템', icon: '\uD83D\uDCBB' },
  ];

  const sectionStyle = {
    background: 'var(--card)', borderRadius: 12, padding: 20,
    marginBottom: 20, border: '1px solid var(--border)',
  };

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 24 }}>학원 설정</h2>

      {message && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: message.includes('실패') ? 'var(--destructive-light)' : 'var(--success-light)',
          color: message.includes('실패') ? 'oklch(48% 0.20 25)' : 'oklch(52% 0.14 160)', fontSize: 14
        }}>{message}</div>
      )}

      {/* 테마 설정 */}
      <section style={sectionStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>테마 설정</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {themeOptions.map(opt => (
            <button key={opt.value} onClick={() => setTheme(opt.value)} style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              border: theme === opt.value ? '2px solid var(--primary)' : '2px solid var(--border)',
              background: theme === opt.value ? 'var(--primary-light, oklch(95% 0.03 250))' : 'var(--muted)',
              color: 'var(--foreground)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              transition: 'all 0.15s ease',
            }}>
              <span style={{ fontSize: 24 }}>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 사이드바 설정 */}
      <section style={sectionStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>사이드바 설정</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>사이드바 고정</div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 }}>
              고정하면 사이드바가 항상 펼쳐져 있습니다
            </div>
          </div>
          <button onClick={handleToggleSidebarPin} style={{
            width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: sidebarPinned ? 'var(--primary)' : 'var(--neutral-300, oklch(75% 0 0))',
            position: 'relative', transition: 'background 0.2s ease',
          }}>
            <span style={{
              position: 'absolute', top: 3, left: sidebarPinned ? 27 : 3,
              width: 22, height: 22, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s ease', boxShadow: '0 1px 3px oklch(0% 0 0 / 0.2)',
            }} />
          </button>
        </div>
      </section>

      {/* 기본 정보 */}
      <section style={sectionStyle}>
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
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>전화번호</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="02-1234-5678" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>주소</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="학원 주소" />
          </div>
        </div>
      </section>

      {/* 학교 관리 */}
      <section style={sectionStyle}>
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
                background: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', border: 'none', borderRadius: 6,
                padding: '6px 10px', cursor: 'pointer', fontSize: 12
              }}>삭제</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 4 }}>학년 (쉼표로 구분)</div>
            <input value={(s.grades || []).join(', ')}
              onChange={e => updateSchool(i, 'grades', e.target.value.split(',').map(g => g.trim()).filter(Boolean))}
              placeholder="1학년, 2학년, 3학년" style={{ fontSize: 13 }} />
          </div>
        ))}
      </section>

      {/* 시험 유형 */}
      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>시험 유형 관리</h3>
          <button className="btn btn-primary" onClick={addExamCategory} style={{ fontSize: 13, padding: '6px 14px' }}>+ 카테고리 추가</button>
        </div>
        {examTypes.map((cat, i) => (
          <div key={i} style={{ padding: 14, borderRadius: 8, background: 'var(--muted)', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input value={cat.label || ''} onChange={e => updateExamCategory(i, 'label', e.target.value)}
                placeholder="카테고리명 (예: 모의고사)" style={{ flex: 1, fontWeight: 600 }} />
              <input value={cat.key || ''} onChange={e => updateExamCategory(i, 'key', e.target.value)}
                placeholder="key (예: mock)" style={{ width: 120, fontSize: 12 }} />
              <button onClick={() => removeExamCategory(i)} style={{
                background: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', border: 'none', borderRadius: 6,
                padding: '6px 10px', cursor: 'pointer', fontSize: 12
              }}>삭제</button>
            </div>
            <div style={{ paddingLeft: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6, fontWeight: 600 }}>하위 시험 유형</div>
              {(cat.types || []).map((t, j) => (
                <div key={j} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <input value={t} onChange={e => updateSubType(i, j, e.target.value)}
                    placeholder="시험 유형명 (예: 학력평가 모의고사)" style={{ flex: 1, fontSize: 13 }} />
                  <button onClick={() => removeSubType(i, j)} style={{
                    background: 'none', color: 'var(--muted-foreground)', border: 'none',
                    cursor: 'pointer', fontSize: 14, padding: '2px 6px'
                  }}>x</button>
                </div>
              ))}
              <button onClick={() => addSubType(i)} style={{
                background: 'none', border: '1px dashed var(--border)', borderRadius: 6,
                padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--muted-foreground)',
                fontFamily: 'inherit', marginTop: 4
              }}>+ 하위 유형 추가</button>
            </div>
          </div>
        ))}
      </section>

      {/* 클리닉 토픽 */}
      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>클리닉 질문 주제</h3>
          <button className="btn btn-primary" onClick={() => setClinicTopics([...clinicTopics, ''])}
            style={{ fontSize: 13, padding: '6px 14px' }}>+ 주제 추가</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10 }}>
          비어있으면 기본 주제가 사용됩니다 (수업 내용 질문, 시험 분석, 학습 방법 상담 등)
        </p>
        {clinicTopics.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input value={t} onChange={e => {
              const next = [...clinicTopics];
              next[i] = e.target.value;
              setClinicTopics(next);
            }} placeholder="주제명" style={{ flex: 1, fontSize: 13 }} />
            <button onClick={() => setClinicTopics(clinicTopics.filter((_, j) => j !== i))} style={{
              background: 'none', color: 'var(--muted-foreground)', border: 'none',
              cursor: 'pointer', fontSize: 14, padding: '2px 6px'
            }}>x</button>
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
