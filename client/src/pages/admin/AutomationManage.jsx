import { useState, useEffect, useCallback } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';

/* ─── Constants ─────────────────────────────────────────────────── */
const TRIGGER_META = {
  absence:               { label: '결석 알림',       icon: 'person_off',      bg: 'bg-red-100/60',  text: 'text-red-600' },
  overdue:               { label: '미납 리마인드',   icon: 'payments',        bg: 'bg-blue-100/60', text: 'text-blue-700' },
  consecutive_absence:   { label: '연속 결석 경고',  icon: 'contact_phone',   bg: 'bg-indigo-100/60', text: 'text-indigo-600' },
  makeup_pending:        { label: '보강 기한 임박',  icon: 'assignment_late', bg: 'bg-slate-200',   text: 'text-slate-400' },
  consultation_followup: { label: '상담 후속 리마인드', icon: 'refresh',      bg: 'bg-gray-200/60', text: 'text-gray-600' },
  withdrawal:            { label: '퇴원 알림',       icon: 'logout',          bg: 'bg-orange-100/60', text: 'text-orange-600' },
};

const ACTION_LABELS = { send_sms: 'SMS', create_task: 'Task', send_notification: 'Notification' };
const TRIGGER_OPTIONS = Object.entries(TRIGGER_META).map(([v, m]) => ({ value: v, label: m.label }));
const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([v, l]) => ({ value: v, label: l }));
const PRIORITY_STYLE = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-blue-100 text-blue-700',
  normal: 'bg-slate-100 text-slate-600',
  low:    'bg-gray-100 text-gray-500',
};
const PRIORITY_LABEL = { urgent: '긴급', high: '높음', normal: '보통', low: '낮음' };

/* ─── Reusable tiny components ──────────────────────────────────── */
const MI = ({ icon, className = '', filled = false }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
  >{icon}</span>
);

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#004bf0]' : 'bg-slate-200'}`}
  >
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white border border-gray-300 transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
  </button>
);

/* ─── Main Component ────────────────────────────────────────────── */
export default function AutomationManage() {
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskSummary, setTaskSummary] = useState({});
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Rule form
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ name: '', trigger_type: 'absence', action_type: 'send_sms', conditions: '{}', action_config: '{}' });

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };

  /* ─── Data loaders ─────────────────────────────────────────────── */
  const loadRules = useCallback(() => {
    api('/automation/rules').then(setRules).catch(() => setRules([]));
  }, []);

  const loadTasks = useCallback(() => {
    api('/automation/tasks').then(d => setTasks(d.tasks || [])).catch(() => setTasks([]));
    api('/automation/tasks/summary').then(setTaskSummary).catch(() => {});
  }, []);

  const loadLogs = useCallback((page = 1) => {
    api(`/automation/logs?page=${page}&limit=20`).then(d => {
      setLogs(d.logs || []);
      setLogTotal(d.total || 0);
      setLogPage(page);
    }).catch(() => setLogs([]));
  }, []);

  useEffect(() => {
    Promise.all([
      api('/automation/rules').then(setRules).catch(() => []),
      api('/automation/tasks').then(d => setTasks(d.tasks || [])).catch(() => []),
      api('/automation/tasks/summary').then(setTaskSummary).catch(() => {}),
      api('/automation/logs?page=1&limit=20').then(d => { setLogs(d.logs || []); setLogTotal(d.total || 0); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  /* ─── Rule handlers ────────────────────────────────────────────── */
  const toggleRule = async (rule) => {
    try {
      const res = await apiPut(`/automation/rules/${rule.id}/toggle`, {});
      flash(res.message);
      loadRules();
    } catch (e) { flash(e.message); }
  };

  const deleteRule = async (id) => {
    if (!window.confirm('이 규칙을 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/automation/rules/${id}`);
      flash('규칙이 삭제되었습니다.');
      loadRules();
    } catch (e) { flash(e.message); }
  };

  const saveRule = async () => {
    const payload = {
      name: ruleForm.name,
      trigger_type: ruleForm.trigger_type,
      action_type: ruleForm.action_type,
      conditions: tryParseJSON(ruleForm.conditions),
      action_config: tryParseJSON(ruleForm.action_config),
    };
    if (!payload.name) { flash('규칙 이름을 입력하세요.'); return; }
    try {
      if (editingRule) {
        await apiPut(`/automation/rules/${editingRule.id}`, payload);
        flash('규칙이 수정되었습니다.');
      } else {
        await apiPost('/automation/rules', payload);
        flash('규칙이 생성되었습니다.');
      }
      setShowRuleForm(false);
      setEditingRule(null);
      setRuleForm({ name: '', trigger_type: 'absence', action_type: 'send_sms', conditions: '{}', action_config: '{}' });
      loadRules();
    } catch (e) { flash(e.message); }
  };

  const openEditRule = (r) => {
    setEditingRule(r);
    setRuleForm({
      name: r.name,
      trigger_type: r.trigger_type,
      action_type: r.action_type,
      conditions: typeof r.conditions === 'string' ? r.conditions : JSON.stringify(r.conditions || {}, null, 2),
      action_config: typeof r.action_config === 'string' ? r.action_config : JSON.stringify(r.action_config || {}, null, 2),
    });
    setShowRuleForm(true);
  };

  /* ─── Task handlers ────────────────────────────────────────────── */
  const completeTask = async (id) => {
    try {
      await apiPut(`/automation/tasks/${id}/complete`, {});
      flash('업무가 완료 처리되었습니다.');
      loadTasks();
    } catch (e) { flash(e.message); }
  };

  /* ─── Derived data ─────────────────────────────────────────────── */
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const activeRulesCount = rules.filter(r => r.is_active).length;
  const totalExecutions = rules.reduce((s, r) => s + (r.trigger_count || 0), 0);

  /* ─── Render ───────────────────────────────────────────────────── */
  if (loading) return <div className="main-content p-10 text-sm text-slate-500">로딩 중...</div>;

  return (
    <div className="main-content min-h-screen bg-[#f8f9fa]">
      <div className="max-w-7xl mx-auto p-10">
        {/* Toast */}
        {msg && (
          <div className="fixed top-20 right-8 z-50 bg-[#102044] text-white px-5 py-3 rounded-xl text-sm font-bold shadow-lg animate-fade-in">
            {msg}
          </div>
        )}

        {/* ── Page Header ───────────────────────────────────────── */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <nav className="flex items-center gap-2 text-xs font-bold text-slate-400 tracking-widest uppercase mb-2">
              <span>Automation</span>
              <MI icon="chevron_right" className="text-[10px]" />
              <span className="text-[#102044]">규칙 관리</span>
            </nav>
            <h2 className="text-4xl font-extrabold text-[#102044] tracking-tight">자동화 관리</h2>
          </div>
          <button
            onClick={() => { setEditingRule(null); setRuleForm({ name: '', trigger_type: 'absence', action_type: 'send_sms', conditions: '{}', action_config: '{}' }); setShowRuleForm(true); }}
            className="bg-[#004bf0] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <MI icon="add" />
            규칙 추가
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <div className="flex gap-8 border-b border-slate-200/60 mb-8">
          {[
            { key: 'rules', label: '규칙 관리' },
            { key: 'queue', label: '업무 큐' },
            { key: 'logs',  label: '실행 이력' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key === 'logs') loadLogs(1); }}
              className={`pb-4 text-sm font-bold px-1 transition-colors ${
                tab === t.key
                  ? 'text-[#004bf0] border-b-2 border-[#004bf0]'
                  : 'text-slate-500 hover:text-[#102044]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            TAB: 규칙 관리
        ═══════════════════════════════════════════════════════════ */}
        {tab === 'rules' && (
          <div className="grid grid-cols-12 gap-8">
            {/* Rule List (col-span-8) */}
            <div className="col-span-12 lg:col-span-8 space-y-4">
              {rules.length === 0 && (
                <div className="bg-white p-12 rounded-2xl text-center text-slate-400 text-sm">
                  등록된 자동화 규칙이 없습니다. "규칙 추가" 버튼으로 첫 규칙을 만들어보세요.
                </div>
              )}
              {rules.map(rule => {
                const meta = TRIGGER_META[rule.trigger_type] || TRIGGER_META.absence;
                const isActive = !!rule.is_active;
                return (
                  <div
                    key={rule.id}
                    className={`bg-white p-6 rounded-2xl flex items-center justify-between hover:bg-slate-50/80 transition-all group ${!isActive ? 'opacity-75' : ''}`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isActive ? meta.bg : 'bg-slate-200'} ${isActive ? meta.text : 'text-slate-400'}`}>
                        <MI icon={meta.icon} className="text-3xl" filled />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`text-lg font-bold ${isActive ? 'text-[#102044]' : 'text-slate-400'}`}>{rule.name}</h4>
                          {isActive && (
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                              {ACTION_LABELS[rule.action_type] || rule.action_type}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm mb-2 ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>
                          {describeRule(rule)}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          {isActive ? (
                            <>
                              <span className="flex items-center gap-1"><MI icon="bolt" className="text-xs" /> 실행 {rule.trigger_count || 0}회</span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full" />
                              <span>마지막 실행: {rule.last_triggered_at ? formatDate(rule.last_triggered_at) : '-'}</span>
                            </>
                          ) : (
                            <span>상태: 비활성화</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <Toggle checked={isActive} onChange={() => toggleRule(rule)} />
                      <div className="relative group/menu">
                        <button className="text-slate-300 group-hover:text-slate-600 transition-colors">
                          <MI icon="more_vert" />
                        </button>
                        <div className="hidden group-hover/menu:block absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-20 w-32">
                          <button onClick={() => openEditRule(rule)} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">수정</button>
                          <button onClick={() => deleteRule(rule.id)} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">삭제</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Sidebar (col-span-4) */}
            <div className="col-span-12 lg:col-span-4 space-y-8">
              {/* Performance Card */}
              <div className="bg-[#102044] p-8 rounded-3xl text-white relative overflow-hidden h-64 flex flex-col justify-between">
                <div className="relative z-10">
                  <span className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em] mb-2 block">Monthly Performance</span>
                  <h3 className="text-3xl font-extrabold leading-tight">
                    자동화로 아낀 시간<br />
                    <span className="text-[#004bf0]">{(totalExecutions * 0.17).toFixed(1)} 시간</span>
                  </h3>
                </div>
                <div className="flex items-end justify-between relative z-10">
                  <div className="text-xs opacity-70">활성 규칙 {activeRulesCount}개</div>
                  <span className="text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                    <MI icon="trending_up" className="text-xs text-green-400" /> 총 {totalExecutions}회 실행
                  </span>
                </div>
                <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
                  <MI icon="auto_awesome" className="text-[200px]" />
                </div>
              </div>

              {/* Insights Card */}
              <div className="bg-[#f3f4f5] p-6 rounded-3xl">
                <h5 className="text-sm font-bold text-[#102044] mb-4 flex items-center gap-2">
                  <MI icon="insights" className="text-sm" />
                  주요 알림
                </h5>
                <div className="space-y-4">
                  {taskSummary.pending > 0 && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#004bf0] mt-1.5 shrink-0" />
                      <p className="text-sm text-slate-600 leading-relaxed">
                        <span className="font-bold text-[#102044]">대기 중 업무</span>가 {taskSummary.pending}건 있습니다.
                      </p>
                    </div>
                  )}
                  {taskSummary.urgent > 0 && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <p className="text-sm text-slate-600 leading-relaxed">
                        <span className="font-bold text-[#102044]">긴급/높음 우선순위</span> 업무가 {taskSummary.urgent}건 있습니다.
                      </p>
                    </div>
                  )}
                  {taskSummary.overdue > 0 && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <p className="text-sm text-slate-600 leading-relaxed">
                        <span className="font-bold text-[#102044]">기한 초과</span> 업무가 {taskSummary.overdue}건 있습니다.
                      </p>
                    </div>
                  )}
                  {rules.filter(r => !r.is_active).length > 0 && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <p className="text-sm text-slate-600 leading-relaxed">
                        <span className="font-bold text-[#102044]">비활성 규칙</span>이 {rules.filter(r => !r.is_active).length}개 있습니다. 활성화를 권장합니다.
                      </p>
                    </div>
                  )}
                  {taskSummary.completed_today > 0 && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <p className="text-sm text-slate-600 leading-relaxed">
                        오늘 <span className="font-bold text-[#102044]">{taskSummary.completed_today}건</span>의 업무가 완료되었습니다.
                      </p>
                    </div>
                  )}
                  {!taskSummary.pending && !taskSummary.urgent && !taskSummary.overdue && rules.every(r => r.is_active) && (
                    <p className="text-sm text-slate-400">현재 특별한 알림이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB: 업무 큐
        ═══════════════════════════════════════════════════════════ */}
        {tab === 'queue' && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-extrabold text-[#102044] tracking-tight">실시간 업무 큐</h3>
              <button onClick={loadTasks} className="text-sm font-bold text-[#004bf0] flex items-center gap-1 hover:underline">
                <MI icon="refresh" className="text-sm" /> 새로고침
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Pending */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">대기 ({pendingTasks.length})</span>
                </div>
                {pendingTasks.length === 0 && <EmptyColumn label="대기 중인 업무 없음" />}
                {pendingTasks.map(task => (
                  <TaskCard key={task.id} task={task} onComplete={completeTask} />
                ))}
              </div>
              {/* In Progress */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">진행중 ({inProgressTasks.length})</span>
                </div>
                {inProgressTasks.length === 0 && <EmptyColumn label="진행 중인 업무 없음" />}
                {inProgressTasks.map(task => (
                  <TaskCard key={task.id} task={task} inProgress onComplete={completeTask} />
                ))}
              </div>
              {/* Completed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">완료 ({completedTasks.length})</span>
                </div>
                {completedTasks.length === 0 && <EmptyColumn label="완료된 업무 없음" />}
                {completedTasks.slice(0, 10).map(task => (
                  <TaskCard key={task.id} task={task} completed />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB: 실행 이력
        ═══════════════════════════════════════════════════════════ */}
        {tab === 'logs' && (
          <div>
            <h3 className="text-2xl font-extrabold text-[#102044] tracking-tight mb-6">실행 이력</h3>
            <div className="bg-white rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f3f4f5]">
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">규칙</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">트리거</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">액션</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">상태</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">실행일시</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">실행 이력이 없습니다.</td></tr>
                  )}
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-[#102044]">{log.rule_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{TRIGGER_META[log.trigger_type]?.label || log.trigger_type}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{ACTION_LABELS[log.action_type] || log.action_type}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                          log.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                          log.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>{log.status === 'success' ? '성공' : log.status === 'failed' ? '실패' : log.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{formatDate(log.executed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              {logTotal > 20 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                  <span className="text-xs text-slate-400">총 {logTotal}건</span>
                  <div className="flex gap-2">
                    <button
                      disabled={logPage <= 1}
                      onClick={() => loadLogs(logPage - 1)}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-[#102044] hover:bg-slate-50 disabled:opacity-40"
                    >이전</button>
                    <span className="px-3 py-1.5 text-xs text-slate-500">{logPage} / {Math.ceil(logTotal / 20)}</span>
                    <button
                      disabled={logPage >= Math.ceil(logTotal / 20)}
                      onClick={() => loadLogs(logPage + 1)}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-[#102044] hover:bg-slate-50 disabled:opacity-40"
                    >다음</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            MODAL: 규칙 추가/수정
        ═══════════════════════════════════════════════════════════ */}
        {showRuleForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowRuleForm(false)}>
            <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-extrabold text-[#102044] mb-6">{editingRule ? '규칙 수정' : '규칙 추가'}</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">규칙 이름</label>
                  <input
                    value={ruleForm.name}
                    onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 text-sm"
                    placeholder="예: 결석 알림"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">트리거 유형</label>
                    <select
                      value={ruleForm.trigger_type}
                      onChange={e => setRuleForm(f => ({ ...f, trigger_type: e.target.value }))}
                      className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 text-sm"
                    >
                      {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">액션 유형</label>
                    <select
                      value={ruleForm.action_type}
                      onChange={e => setRuleForm(f => ({ ...f, action_type: e.target.value }))}
                      className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 text-sm"
                    >
                      {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">조건 (JSON)</label>
                  <textarea
                    value={ruleForm.conditions}
                    onChange={e => setRuleForm(f => ({ ...f, conditions: e.target.value }))}
                    rows={3}
                    className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 text-sm font-mono"
                    placeholder='{"threshold": 3}'
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">액션 설정 (JSON)</label>
                  <textarea
                    value={ruleForm.action_config}
                    onChange={e => setRuleForm(f => ({ ...f, action_config: e.target.value }))}
                    rows={3}
                    className="w-full px-5 py-4 bg-[#edeeef] rounded-lg border-transparent focus:border-[#004bf0]/40 focus:bg-white focus:ring-4 focus:ring-[#004bf0]/5 text-sm font-mono"
                    placeholder='{"template": "결석 알림"}'
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button onClick={() => setShowRuleForm(false)} className="px-6 py-3 border border-slate-200 text-[#102044] font-bold rounded-lg hover:bg-slate-50 text-sm">취소</button>
                <button onClick={saveRule} className="px-6 py-3 bg-[#004bf0] text-white font-bold rounded-lg hover:bg-[#003bcc] text-sm">
                  {editingRule ? '수정' : '추가'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */
function TaskCard({ task, inProgress = false, completed = false, onComplete }) {
  return (
    <div className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100/50 ${inProgress ? 'border-l-4 border-l-[#004bf0]' : ''} ${completed ? 'opacity-80' : ''}`}>
      <div className="flex justify-between items-start mb-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
          completed ? 'bg-slate-200 text-slate-400' : (PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.normal)
        }`}>
          {completed ? '완료' : (PRIORITY_LABEL[task.priority] || task.priority)}
        </span>
        <span className="text-[10px] font-medium text-slate-400">
          {completed && task.completed_at ? formatDate(task.completed_at) : task.due_date ? formatDate(task.due_date) : ''}
        </span>
      </div>
      <h5 className={`font-bold text-sm mb-1 leading-snug ${completed ? 'text-slate-400 line-through' : 'text-[#102044]'}`}>
        {task.title}
      </h5>
      {task.description && (
        <p className={`text-xs mb-3 ${completed ? 'text-slate-300' : 'text-slate-500'}`}>
          {task.description}
        </p>
      )}
      {!completed && (
        <div className="flex items-center justify-between border-t border-slate-100/50 pt-3">
          <span className="text-[10px] font-semibold text-slate-500">
            {task.assigned_name || '미배정'}
          </span>
          {onComplete && (
            <button
              onClick={() => onComplete(task.id)}
              className="text-[10px] font-bold text-[#004bf0] hover:underline"
            >완료 처리</button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyColumn({ label }) {
  return (
    <div className="bg-white/60 p-6 rounded-2xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
      {label}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  const m = dt.getMonth() + 1;
  const day = dt.getDate();
  const h = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
}

function describeRule(rule) {
  const trigger = TRIGGER_META[rule.trigger_type]?.label || rule.trigger_type;
  const action = ACTION_LABELS[rule.action_type] || rule.action_type;
  return `${trigger} → ${action}`;
}

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return {}; }
}
