import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, apiPut, apiGet, apiPost } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import { useUIStore } from '../../stores/useUIStore';

const SETTINGS_TABS = [
  { label: '학원 정보', path: '/admin/settings' },
  { label: '구독 관리', path: '/admin/subscription' },
  { label: '역할·권한', path: null },
  { label: '출결 정책', path: null },
  { label: '수납 정책', path: null },
  { label: '알림 설정', path: null },
];

export default function AcademySettings() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [inviteCodes, setInviteCodes] = useState({ student_invite_code: '', parent_invite_code: '' });
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet('/academies/invite-codes');
        setInviteCodes({
          student_invite_code: data.student_invite_code || '',
          parent_invite_code: data.parent_invite_code || '',
        });
      } catch (_) { /* 권한 없음 등은 무시 */ }
    })();
  }, []);

  const regenerateInviteCode = async (type) => {
    const label = type === 'student' ? '학생' : '학부모';
    if (!window.confirm(`${label}용 초대 코드를 재발급하시겠습니까?\n기존 코드는 즉시 무효화되며, 재발급 후에는 새 코드로만 가입할 수 있습니다.`)) return;
    setInviteLoading(true);
    try {
      const result = await apiPost('/academies/invite-codes/regenerate', { type });
      setInviteCodes(prev => ({ ...prev, ...result }));
      setMessage(`${label}용 초대 코드가 재발급되었습니다.`);
    } catch (err) {
      setMessage('재발급 실패: ' + (err.message || ''));
    } finally {
      setInviteLoading(false);
    }
  };

  const copyCode = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMessage('초대 코드가 복사되었습니다.');
    } catch (_) { /* ignore */ }
  };

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
    { value: 'light', label: '라이트', icon: 'light_mode' },
    { value: 'dark', label: '다크', icon: 'dark_mode' },
    { value: 'system', label: '시스템', icon: 'computer' },
  ];

  const inputCls = 'w-full px-5 py-4 bg-[#edeeef] rounded-lg border border-transparent text-sm outline-none focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 transition-all';

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto w-full">
      {/* Settings Tabs */}
      <div className="flex gap-2 flex-wrap mb-2">
        {SETTINGS_TABS.map(tab => {
          const isCurrent = tab.path === location.pathname;
          const disabled = !tab.path;
          return (
            <button
              key={tab.label}
              onClick={() => tab.path && navigate(tab.path)}
              disabled={disabled}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                isCurrent
                  ? 'bg-[#102044] text-white shadow-sm'
                  : disabled
                    ? 'bg-white border border-slate-200 text-slate-300 cursor-default'
                    : 'bg-white border border-slate-200 text-slate-500 hover:text-[#102044] hover:border-[#102044]/30'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Page Title */}
      <div>
        <h3 className="text-2xl font-extrabold text-[#102044] tracking-tight">학원 정보</h3>
        <p className="text-sm text-slate-500 mt-1">학원 기본 정보 및 시스템 설정을 관리합니다.</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-5 py-3 rounded-xl text-sm font-semibold ${
          message.includes('실패') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          {message}
        </div>
      )}

      {/* Invite Codes */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[#102044]">qr_code_2</span>
          <h4 className="text-lg font-bold text-[#102044]">초대 코드</h4>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          학생과 학부모가 회원가입할 때 이 코드를 입력해야 본 학원에 속하게 됩니다. 외부에 유출되면 재발급하세요.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-5 bg-slate-50 rounded-xl">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">학생용 코드</p>
              <p className="text-xl font-extrabold text-[#102044] mt-1 font-mono truncate">
                {inviteCodes.student_invite_code || '발급 중...'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => copyCode(inviteCodes.student_invite_code)}
                disabled={!inviteCodes.student_invite_code}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:border-[#102044]/30 disabled:opacity-50"
              >
                복사
              </button>
              <button
                type="button"
                onClick={() => regenerateInviteCode('student')}
                disabled={inviteLoading}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:border-[#004bf0]/40 hover:text-[#004bf0] disabled:opacity-50"
              >
                재발급
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 p-5 bg-slate-50 rounded-xl">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">학부모용 코드</p>
              <p className="text-xl font-extrabold text-[#102044] mt-1 font-mono truncate">
                {inviteCodes.parent_invite_code || '발급 중...'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => copyCode(inviteCodes.parent_invite_code)}
                disabled={!inviteCodes.parent_invite_code}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:border-[#102044]/30 disabled:opacity-50"
              >
                복사
              </button>
              <button
                type="button"
                onClick={() => regenerateInviteCode('parent')}
                disabled={inviteLoading}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:border-[#004bf0]/40 hover:text-[#004bf0] disabled:opacity-50"
              >
                재발급
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Setting */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-[#102044]">palette</span>
          <h4 className="text-lg font-bold text-[#102044]">테마 설정</h4>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {themeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl transition-all ${
                theme === opt.value
                  ? 'bg-[#004bf0]/5 border-2 border-[#004bf0] ring-2 ring-[#004bf0]/10'
                  : 'bg-[#f3f4f5] border-2 border-transparent hover:border-slate-200'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${
                theme === opt.value ? 'text-[#004bf0]' : 'text-slate-400'
              }`}>
                {opt.icon}
              </span>
              <span className={`text-sm font-semibold ${
                theme === opt.value ? 'text-[#102044]' : 'text-slate-500'
              }`}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sidebar Setting */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-[#102044]">side_navigation</span>
          <h4 className="text-lg font-bold text-[#102044]">사이드바 설정</h4>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#102044]">사이드바 고정</p>
            <p className="text-xs text-slate-500 mt-1">고정하면 사이드바가 항상 펼쳐져 있습니다</p>
          </div>
          <button
            onClick={handleToggleSidebarPin}
            className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
              sidebarPinned ? 'bg-[#004bf0]' : 'bg-slate-300'
            }`}
          >
            <span
              className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200"
              style={{ left: sidebarPinned ? 'calc(100% - 28px)' : '4px' }}
            />
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-[#102044]">info</span>
          <h4 className="text-lg font-bold text-[#102044]">기본 정보</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">사이트 제목</label>
            <input
              value={siteTitle}
              onChange={e => setSiteTitle(e.target.value)}
              placeholder="학원 이름"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">메인 슬로건</label>
            <input
              value={mainTitle}
              onChange={e => setMainTitle(e.target.value)}
              placeholder="슬로건 문구"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">전화번호</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="02-1234-5678"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">주소</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="학원 주소"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Schools */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#102044]">school</span>
            <h4 className="text-lg font-bold text-[#102044]">학교/학년 관리</h4>
          </div>
          <button
            onClick={addSchool}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-[#004bf0] border border-[#004bf0]/20 hover:bg-[#004bf0]/5 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            학교 추가
          </button>
        </div>
        <div className="space-y-4">
          {schools.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">등록된 학교가 없습니다. 학교를 추가해 주세요.</p>
          )}
          {schools.map((s, i) => (
            <div key={i} className="bg-[#f3f4f5] rounded-xl p-5">
              <div className="flex gap-3 items-center mb-3">
                <input
                  value={s.name}
                  onChange={e => updateSchool(i, 'name', e.target.value)}
                  placeholder="학교 이름"
                  className="flex-1 px-4 py-3 bg-white rounded-lg border border-transparent text-sm font-semibold outline-none focus:border-[#004bf0]/40 focus:ring-4 focus:ring-[#004bf0]/5"
                />
                <button
                  onClick={() => removeSchool(i)}
                  className="px-3 py-3 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">학년 (쉼표로 구분)</label>
                <input
                  value={(s.grades || []).join(', ')}
                  onChange={e => updateSchool(i, 'grades', e.target.value.split(',').map(g => g.trim()).filter(Boolean))}
                  placeholder="1학년, 2학년, 3학년"
                  className="w-full px-4 py-3 bg-white rounded-lg border border-transparent text-sm outline-none focus:border-[#004bf0]/40 focus:ring-4 focus:ring-[#004bf0]/5"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exam Types */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#102044]">quiz</span>
            <h4 className="text-lg font-bold text-[#102044]">시험 유형 관리</h4>
          </div>
          <button
            onClick={addExamCategory}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-[#004bf0] border border-[#004bf0]/20 hover:bg-[#004bf0]/5 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            카테고리 추가
          </button>
        </div>
        <div className="space-y-4">
          {examTypes.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">등록된 시험 유형이 없습니다.</p>
          )}
          {examTypes.map((cat, i) => (
            <div key={i} className="bg-[#f3f4f5] rounded-xl p-5">
              <div className="flex gap-3 items-center mb-4">
                <input
                  value={cat.label || ''}
                  onChange={e => updateExamCategory(i, 'label', e.target.value)}
                  placeholder="카테고리명 (예: 모의고사)"
                  className="flex-1 px-4 py-3 bg-white rounded-lg border border-transparent text-sm font-semibold outline-none focus:border-[#004bf0]/40 focus:ring-4 focus:ring-[#004bf0]/5"
                />
                <input
                  value={cat.key || ''}
                  onChange={e => updateExamCategory(i, 'key', e.target.value)}
                  placeholder="key"
                  className="w-28 px-3 py-3 bg-white rounded-lg border border-transparent text-xs outline-none focus:border-[#004bf0]/40 focus:ring-4 focus:ring-[#004bf0]/5"
                  style={{ fontFamily: 'monospace' }}
                />
                <button
                  onClick={() => removeExamCategory(i)}
                  className="px-3 py-3 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
              <div className="pl-4 border-l-2 border-slate-200 ml-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">하위 시험 유형</p>
                <div className="space-y-2">
                  {(cat.types || []).map((t, j) => (
                    <div key={j} className="flex gap-2 items-center">
                      <input
                        value={t}
                        onChange={e => updateSubType(i, j, e.target.value)}
                        placeholder="시험 유형명"
                        className="flex-1 px-4 py-2.5 bg-white rounded-lg border border-transparent text-sm outline-none focus:border-[#004bf0]/40 focus:ring-4 focus:ring-[#004bf0]/5"
                      />
                      <button
                        onClick={() => removeSubType(i, j)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addSubType(i)}
                  className="mt-3 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 border border-dashed border-slate-300 hover:border-[#004bf0]/30 hover:text-[#004bf0] transition-all"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  하위 유형 추가
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clinic Topics */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#102044]">psychology</span>
            <h4 className="text-lg font-bold text-[#102044]">클리닉 질문 주제</h4>
          </div>
          <button
            onClick={() => setClinicTopics([...clinicTopics, ''])}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-[#004bf0] border border-[#004bf0]/20 hover:bg-[#004bf0]/5 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            주제 추가
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          비어있으면 기본 주제가 사용됩니다 (수업 내용 질문, 시험 분석, 학습 방법 상담 등)
        </p>
        <div className="space-y-2">
          {clinicTopics.map((t, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={t}
                onChange={e => {
                  const next = [...clinicTopics];
                  next[i] = e.target.value;
                  setClinicTopics(next);
                }}
                placeholder="주제명"
                className="flex-1 px-4 py-3 bg-[#edeeef] rounded-lg border border-transparent text-sm outline-none focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5"
              />
              <button
                onClick={() => setClinicTopics(clinicTopics.filter((_, j) => j !== i))}
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-4 rounded-xl bg-[#102044] text-white text-base font-bold hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50"
      >
        {saving ? '저장 중...' : '변경사항 저장'}
      </button>
    </div>
  );
}
