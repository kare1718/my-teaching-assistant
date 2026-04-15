import { useState, useEffect } from 'react';
import { api, apiPut } from '../../api';

const ROLES = [
  { key: 'director', label: '원장', badge: 'Super Admin' },
  { key: 'teacher', label: '강사', badge: null },
  { key: 'counselor', label: '상담', badge: null },
  { key: 'admin_staff', label: '행정', badge: null },
  { key: 'assistant', label: '보조', badge: null },
];

const FEATURES = [
  { key: 'student_manage', label: '학생 관리', desc: '원생 정보 및 출결 현황 조회/수정' },
  { key: 'attendance', label: '출결 입력', desc: '수업별 학생 출석 처리' },
  { key: 'billing_view', label: '수납 조회', desc: '수강료 미납 및 입금 내역 확인' },
  { key: 'billing_process', label: '수납 처리', desc: '수강료 결제 승인 및 환불 처리' },
  { key: 'counseling', label: '상담 기록', desc: '학부모 및 학생 상담 내용 등록' },
  { key: 'messaging', label: '메시지 발송', desc: 'SMS, 알림톡 대량 발송 및 템플릿 관리' },
  { key: 'reports', label: '리포트 조회', desc: '경영 통계 및 성적 리포트 출력' },
  { key: 'settings', label: '설정 변경', desc: '학원 기본 설정 및 시스템 정책 변경' },
];

const ACTIONS = ['read', 'write', 'delete'];
const ACTION_LABELS = { read: '조회 (Read)', write: '작성 (Write)', delete: '삭제 (Delete)' };

function getDefaultPermissions() {
  const perms = {};
  ROLES.forEach(role => {
    perms[role.key] = {};
    FEATURES.forEach(feat => {
      if (role.key === 'director') {
        perms[role.key][feat.key] = { read: true, write: true, delete: true };
      } else if (role.key === 'teacher') {
        perms[role.key][feat.key] = {
          read: true,
          write: ['student_manage', 'attendance', 'counseling'].includes(feat.key),
          delete: false,
        };
      } else if (role.key === 'counselor') {
        perms[role.key][feat.key] = {
          read: ['student_manage', 'counseling', 'billing_view'].includes(feat.key),
          write: feat.key === 'counseling',
          delete: false,
        };
      } else if (role.key === 'admin_staff') {
        perms[role.key][feat.key] = {
          read: ['student_manage', 'billing_view', 'billing_process', 'messaging'].includes(feat.key),
          write: ['billing_process', 'messaging'].includes(feat.key),
          delete: false,
        };
      } else {
        perms[role.key][feat.key] = { read: feat.key === 'student_manage' || feat.key === 'attendance', write: false, delete: false };
      }
    });
  });
  return perms;
}

export default function RolePermissions() {
  const [selectedRole, setSelectedRole] = useState('director');
  const [permissions, setPermissions] = useState(getDefaultPermissions);
  const [customRoles, setCustomRoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/academies/my');
        const settings = data.settings || {};
        if (settings.rolePermissions) {
          setPermissions(prev => {
            const merged = { ...getDefaultPermissions() };
            Object.keys(settings.rolePermissions).forEach(roleKey => {
              if (merged[roleKey]) {
                Object.keys(settings.rolePermissions[roleKey]).forEach(featKey => {
                  if (merged[roleKey][featKey]) {
                    merged[roleKey][featKey] = { ...merged[roleKey][featKey], ...settings.rolePermissions[roleKey][featKey] };
                  }
                });
              } else {
                merged[roleKey] = settings.rolePermissions[roleKey];
              }
            });
            return merged;
          });
        }
        if (settings.customRoles) {
          setCustomRoles(settings.customRoles);
        }
      } catch (err) {
        console.error('권한 설정 로드 실패:', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const allRoles = [...ROLES, ...customRoles.map(r => ({ key: r.key, label: r.label, badge: null }))];
  const currentRole = allRoles.find(r => r.key === selectedRole);

  const togglePermission = (featureKey, action) => {
    if (selectedRole === 'director') return;
    setPermissions(prev => {
      const next = { ...prev };
      const rolePerm = { ...next[selectedRole] };
      const featPerm = { ...rolePerm[featureKey] };
      featPerm[action] = !featPerm[action];
      if (!featPerm.read && (featPerm.write || featPerm.delete)) {
        featPerm.read = true;
      }
      rolePerm[featureKey] = featPerm;
      next[selectedRole] = rolePerm;
      return next;
    });
  };

  const handleReset = () => {
    const defaults = getDefaultPermissions();
    if (defaults[selectedRole]) {
      setPermissions(prev => ({ ...prev, [selectedRole]: defaults[selectedRole] }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await apiPut('/academies/settings', {
        rolePermissions: permissions,
        customRoles,
      });
      setMessage('권한 설정이 저장되었습니다.');
    } catch (err) {
      setMessage('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    const key = 'custom_' + newRoleName.trim().replace(/\s+/g, '_').toLowerCase();
    if (allRoles.some(r => r.key === key)) return;
    const newRole = { key, label: newRoleName.trim() };
    setCustomRoles(prev => [...prev, newRole]);
    const newPerms = {};
    FEATURES.forEach(feat => {
      newPerms[feat.key] = { read: false, write: false, delete: false };
    });
    setPermissions(prev => ({ ...prev, [key]: newPerms }));
    setSelectedRole(key);
    setNewRoleName('');
    setShowAddRole(false);
  };

  const rolePerms = permissions[selectedRole] || {};

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-slate-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-extrabold text-[#102044] tracking-tight">권한 설정</h3>
        <p className="text-sm text-slate-500 mt-1">사용자 역할별 시스템 접근 및 작업 권한을 관리합니다.</p>
      </div>

      {/* Toast */}
      {message && (
        <div className={`mb-6 px-5 py-3 rounded-lg text-sm font-bold ${message.includes('실패') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Role List Sidebar */}
        <div className="col-span-12 lg:col-span-3 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">사용자 역할</h3>
          <div className="space-y-2">
            {allRoles.map(role => (
              <button
                key={role.key}
                onClick={() => setSelectedRole(role.key)}
                className={`w-full px-4 py-3 rounded-lg text-sm font-bold text-left transition-colors flex items-center justify-between ${
                  selectedRole === role.key
                    ? 'bg-[#102044] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-[#102044] hover:border-[#102044]/30'
                }`}
              >
                <span>{role.label}</span>
                {selectedRole === role.key && <span>›</span>}
              </button>
            ))}
          </div>

          {/* Add Role */}
          {showAddRole ? (
            <div className="mt-4 space-y-2">
              <input
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRole()}
                placeholder="역할 이름"
                className="w-full px-4 py-2.5 bg-white rounded-lg border border-slate-200 text-sm focus:border-[#004bf0]/40 focus:ring-4 focus:ring-[#004bf0]/5 focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddRole}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-[#102044] text-white"
                >
                  추가
                </button>
                <button
                  onClick={() => { setShowAddRole(false); setNewRoleName(''); }}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddRole(true)}
              className="w-full mt-4 px-4 py-3 rounded-lg text-sm font-bold border border-dashed border-[#004bf0]/30 text-[#004bf0] hover:bg-[#004bf0]/5 transition-colors"
            >
              + 역할 추가
            </button>
          )}
        </div>

        {/* Permission Matrix */}
        <div className="col-span-12 lg:col-span-9">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Matrix Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-[#f3f4f5]/50 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[#102044]">{currentRole?.label} 권한 상세</h4>
                <p className="text-xs text-slate-500">
                  {selectedRole === 'director'
                    ? '모든 시스템 기능에 대한 전체 접근 권한이 부여됩니다.'
                    : '각 기능별 조회/작성/삭제 권한을 설정합니다.'}
                </p>
              </div>
              {currentRole?.badge && (
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                  {currentRole.badge}
                </span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#f3f4f5]">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">기능 구분</th>
                    {ACTIONS.map(action => (
                      <th key={action} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                        {ACTION_LABELS[action]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {FEATURES.map(feat => (
                    <tr key={feat.key} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="font-semibold text-[#102044]">{feat.label}</div>
                        <div className="text-xs text-slate-400">{feat.desc}</div>
                      </td>
                      {ACTIONS.map(action => (
                        <td key={action} className="px-6 py-5 text-center">
                          <input
                            type="checkbox"
                            checked={rolePerms[feat.key]?.[action] || false}
                            onChange={() => togglePermission(feat.key, action)}
                            disabled={selectedRole === 'director'}
                            className="w-5 h-5 rounded border-slate-300 text-[#102044] focus:ring-[#102044]/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex items-center justify-end gap-4">
            <button
              onClick={handleReset}
              disabled={selectedRole === 'director'}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-[#f3f4f5] transition-colors disabled:opacity-40"
            >
              초기화
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-2.5 rounded-lg text-sm font-bold bg-[#102044] text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
            >
              {saving ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
