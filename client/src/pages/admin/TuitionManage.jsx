import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { askConfirm } from '../../lib/feedback';
import { PageLoading, EmptyState, StatusBadge } from '../../components/ui';

// 수납 추이 컴포넌트
function TuitionTrend() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/tuition/trend')
      .then(setData)
      .catch(() => setData({ trend: [], current_students: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoading />;
  if (!data || data.trend.length === 0) {
    return (
      <div className="p-[60px] text-center text-slate-400 bg-white rounded-xl border border-slate-100 shadow-sm">
        수납 데이터가 쌓이면 추이를 확인할 수 있습니다.
      </div>
    );
  }

  const maxAmount = Math.max(...data.trend.map(t => t.total_amount), 1);

  return (
    <div className="flex flex-col gap-4">
      {/* 현재 재원생 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
        <span className="text-[13px] text-slate-500">현재 재원생</span>
        <span className="text-[22px] font-display font-extrabold text-[var(--primary)]">{data.current_students}명</span>
      </div>

      {/* 월별 수납 바 차트 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-[15px] font-bold mb-4 text-[var(--primary)]">월별 수납 추이</h3>
        <div className="flex flex-col gap-3">
          {data.trend.map(t => {
            const rate = t.total_amount > 0 ? Math.round((t.collected / t.total_amount) * 100) : 0;
            return (
              <div key={t.month}>
                <div className="flex justify-between mb-1 text-[13px]">
                  <span className="font-bold text-[var(--primary)]">{t.label}</span>
                  <span className="text-slate-500">수납률 <strong className={rate >= 80 ? 'text-emerald-600' : 'text-[#ba1a1a]'}>{rate}%</strong></span>
                </div>
                {/* 청구 바 */}
                <div className="h-3.5 bg-slate-200 rounded-full mb-[3px] relative overflow-hidden">
                  <div className="h-full bg-slate-200 rounded-full" style={{ width: `${(t.total_amount / maxAmount) * 100}%` }} />
                </div>
                {/* 수납 바 */}
                <div className="h-3.5 bg-slate-100 rounded-full relative overflow-hidden">
                  <div className="h-full bg-[var(--cta)] rounded-full" style={{ width: `${(t.collected / maxAmount) * 100}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[11px] text-slate-400">
                  <span>청구 {t.total_amount.toLocaleString()}원</span>
                  <span>수납 {t.collected.toLocaleString()}원</span>
                  <span>미수 {t.outstanding.toLocaleString()}원</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block bg-slate-200" /> 청구</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block bg-[var(--cta)]" /> 수납</span>
        </div>
      </div>

      {/* 월별 상세 테이블 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">월</th>
                <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">청구</th>
                <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">수납</th>
                <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">미수</th>
                <th className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">수납률</th>
                <th className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">건수</th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map(t => {
                const rate = t.total_amount > 0 ? Math.round((t.collected / t.total_amount) * 100) : 0;
                return (
                  <tr key={t.month}>
                    <td className="px-3 py-2.5 border-b border-slate-50 font-semibold">{t.label}</td>
                    <td className="px-3 py-2.5 border-b border-slate-50 text-right font-display">{t.total_amount.toLocaleString()}원</td>
                    <td className="px-3 py-2.5 border-b border-slate-50 text-right font-display font-bold text-[var(--cta)]">{t.collected.toLocaleString()}원</td>
                    <td className={`px-3 py-2.5 border-b border-slate-50 text-right font-display ${t.outstanding > 0 ? 'text-[#ba1a1a]' : 'text-slate-400'}`}>{t.outstanding.toLocaleString()}원</td>
                    <td className={`px-3 py-2.5 border-b border-slate-50 text-center font-display font-bold ${rate >= 80 ? 'text-emerald-600' : 'text-[#ba1a1a]'}`}>{rate}%</td>
                    <td className="px-3 py-2.5 border-b border-slate-50 text-center text-slate-500">{t.paid_count}/{t.total_bills}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function TuitionManage() {
  const [tuitionTab, setTuitionTab] = useState('billing'); // 'billing' | 'trend'
  const [tab, setTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [records, setRecords] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // 예외 처리 상태
  const [discountRules, setDiscountRules] = useState([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ name: '', rule_type: 'sibling', discount_type: 'percent', discount_value: 10, min_siblings: 2, is_active: true });
  const [splitModal, setSplitModal] = useState(null); // { record, splits }
  const [installmentModal, setInstallmentModal] = useState(null); // { record, count }

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ name: '', amount: '', description: '', billing_cycle: 'monthly' });

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordForm, setRecordForm] = useState({ student_id: '', plan_id: '', due_date: '', amount: '' });

  const [filter, setFilter] = useState('all');

  // 결제 링크 모달 상태
  const [linkModal, setLinkModal] = useState(null); // { paymentUrl, studentName, amount, dueDate }
  const [linkLoading, setLinkLoading] = useState(false);

  const loadPlans = () => api('/tuition/plans').then(setPlans).catch(() => setPlans([]));
  const loadRecords = () => api('/tuition/records').then(setRecords).catch(() => setRecords([]));
  const loadOverdue = () => api('/tuition/overdue').then(setOverdue).catch(() => setOverdue([]));
  const loadRules = () => api('/tuition/discount-rules').then(setDiscountRules).catch(() => setDiscountRules([]));

  useEffect(() => {
    Promise.all([loadPlans(), loadRecords(), loadOverdue(), loadRules()]).then(() => setLoading(false));
  }, []);

  const showMessage = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleSavePlan = async () => {
    if (!planForm.name || !planForm.amount) { showMessage('이름과 금액을 입력하세요.'); return; }
    try {
      if (editingPlan) {
        await apiPut(`/tuition/plans/${editingPlan.id}`, planForm);
        showMessage('수납 플랜이 수정되었습니다.');
      } else {
        await apiPost('/tuition/plans', planForm);
        showMessage('수납 플랜이 생성되었습니다.');
      }
      setShowPlanForm(false);
      setEditingPlan(null);
      setPlanForm({ name: '', amount: '', description: '', billing_cycle: 'monthly' });
      loadPlans();
    } catch (e) { showMessage(e.message); }
  };

  const handleCreateRecord = async () => {
    if (!recordForm.student_id || !recordForm.plan_id || !recordForm.due_date) {
      showMessage('학생, 플랜, 납부일을 입력하세요.');
      return;
    }
    try {
      await apiPost('/tuition/records', recordForm);
      showMessage('수납 기록이 생성되었습니다.');
      setShowRecordForm(false);
      setRecordForm({ student_id: '', plan_id: '', due_date: '', amount: '' });
      loadRecords();
    } catch (e) { showMessage(e.message); }
  };

  const handleMarkPaid = async (id) => {
    try {
      await apiPut(`/tuition/records/${id}/pay`);
      showMessage('결제 완료 처리되었습니다.');
      loadRecords();
      loadOverdue();
    } catch (e) { showMessage(e.message); }
  };

  const handleNotifyOverdue = async () => {
    if (!await askConfirm('미납 학생/학부모에게 알림을 발송하시겠습니까?')) return;
    try {
      const res = await apiPost('/tuition/overdue/notify');
      showMessage(res.message || '알림이 발송되었습니다.');
    } catch (e) { showMessage(e.message); }
  };

  const handleCreatePaymentLink = async (recordId) => {
    setLinkLoading(true);
    try {
      const res = await apiPost(`/tuition/records/${recordId}/payment-link`);
      setLinkModal({
        paymentUrl: res.paymentUrl,
        studentName: res.studentName,
        amount: res.amount,
        dueDate: res.dueDate,
      });
    } catch (e) { showMessage(e.message); }
    finally { setLinkLoading(false); }
  };

  const handleCopyLink = async () => {
    if (!linkModal?.paymentUrl) return;
    try {
      await navigator.clipboard.writeText(linkModal.paymentUrl);
      showMessage('결제 링크가 복사되었습니다.');
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = linkModal.paymentUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showMessage('결제 링크가 복사되었습니다.');
    }
  };

  // === 할인 규칙 ===
  const handleSaveRule = async () => {
    if (!ruleForm.name || !ruleForm.discount_value) { showMessage('이름과 할인 값을 입력하세요.'); return; }
    try {
      const payload = {
        name: ruleForm.name,
        rule_type: ruleForm.rule_type,
        discount_type: ruleForm.discount_type,
        discount_value: Number(ruleForm.discount_value),
        condition: ruleForm.rule_type === 'sibling' ? { min_siblings: Number(ruleForm.min_siblings) || 2 } : {},
        is_active: ruleForm.is_active,
      };
      if (editingRule) await apiPut(`/tuition/discount-rules/${editingRule.id}`, payload);
      else await apiPost('/tuition/discount-rules', payload);
      showMessage('할인 규칙이 저장되었습니다.');
      setShowRuleForm(false); setEditingRule(null);
      setRuleForm({ name: '', rule_type: 'sibling', discount_type: 'percent', discount_value: 10, min_siblings: 2, is_active: true });
      loadRules();
    } catch (e) { showMessage(e.message); }
  };

  const handleDeleteRule = async (id) => {
    if (!await askConfirm('할인 규칙을 삭제하시겠습니까?')) return;
    try { await apiDelete(`/tuition/discount-rules/${id}`); showMessage('삭제되었습니다.'); loadRules(); }
    catch (e) { showMessage(e.message); }
  };

  // === 혼합 수납 ===
  const openSplitModal = (record) => {
    setSplitModal({ record, splits: [{ method: 'card', amount: record.amount, memo: '' }] });
  };
  const addSplitLine = () => setSplitModal(m => ({ ...m, splits: [...m.splits, { method: 'cash', amount: 0, memo: '' }] }));
  const updateSplitLine = (i, field, value) => setSplitModal(m => {
    const splits = [...m.splits];
    splits[i] = { ...splits[i], [field]: field === 'amount' ? Number(value) : value };
    return { ...m, splits };
  });
  const removeSplitLine = (i) => setSplitModal(m => ({ ...m, splits: m.splits.filter((_, idx) => idx !== i) }));

  const handleSubmitSplit = async () => {
    if (!splitModal) return;
    try {
      const res = await apiPost(`/tuition/records/${splitModal.record.id}/split-payment`, { splits: splitModal.splits });
      showMessage(res.message || '혼합 수납이 기록되었습니다.');
      setSplitModal(null);
      loadRecords(); loadOverdue();
    } catch (e) { showMessage(e.message); }
  };

  // === 분할 납부 ===
  const handleSubmitInstallment = async () => {
    if (!installmentModal) return;
    try {
      const res = await apiPost(`/tuition/records/${installmentModal.record.id}/installments`, { count: installmentModal.count });
      showMessage(res.message || '분할 납부가 생성되었습니다.');
      setInstallmentModal(null);
      loadRecords();
    } catch (e) { showMessage(e.message); }
  };

  const handleSendAlimtalk = async () => {
    if (!linkModal) return;
    showMessage('카카오 알림톡 발송 기능은 SMS 크레딧이 필요합니다. (추후 연동 예정)');
  };

  if (loading) return <PageLoading wrap="main-content" />;

  const filteredRecords = records.filter(r => {
    if (filter === 'unpaid') return r.status === 'pending';
    if (filter === 'paid') return r.status === 'paid';
    if (filter === 'overdue') return r.status === 'overdue' || (r.status === 'pending' && r.due_date && new Date(r.due_date) < new Date());
    return true;
  });

  const tabBtn = (key, label) => (
    <button key={key} onClick={() => setTab(key)} className={`px-5 py-2 rounded-lg text-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
      tab === key
        ? 'bg-[var(--primary)] text-white font-bold'
        : 'bg-slate-100 text-slate-600 font-medium hover:bg-slate-200'
    }`}>{label}</button>
  );

  const cycleLabels = { monthly: '월납', quarterly: '분기납', yearly: '연납', once: '일시납' };

  return (
    <div className="main-content p-5 max-w-[1100px] mx-auto">
      <h2 className="text-2xl font-extrabold text-[var(--primary)] tracking-tight mb-5">수납 관리</h2>

      {/* 상단 탭: 청구/납부 | 수납 추이 */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTuitionTab('billing')} className={`px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap cursor-pointer border transition-colors ${
          tuitionTab === 'billing'
            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
        }`}>청구/납부</button>
        <button onClick={() => setTuitionTab('trend')} className={`px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap cursor-pointer border transition-colors ${
          tuitionTab === 'trend'
            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
        }`}>수납 추이</button>
      </div>

      {tuitionTab === 'trend' ? (
        <TuitionTrend />
      ) : (
      <>

      {msg && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 mb-4 text-sm font-semibold">
          {msg}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {tabBtn('plans', '수납 플랜')}
        {tabBtn('records', '수납 현황')}
        {tabBtn('discounts', '할인 규칙')}
      </div>

      {/* 수납 플랜 탭 */}
      {tab === 'plans' && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-[var(--primary)]">수납 플랜 목록</h3>
            <button onClick={() => { setShowPlanForm(true); setEditingPlan(null); setPlanForm({ name: '', amount: '', description: '', billing_cycle: 'monthly' }); }}
              className="bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer">
              + 플랜 추가
            </button>
          </div>
          {plans.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <EmptyState title="등록된 수납 플랜이 없습니다." />
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {plans.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                  <h4 className="font-bold mb-2 text-[var(--primary)]">{p.name}</h4>
                  <p className="text-[22px] font-display font-extrabold text-[var(--primary)]">{Number(p.amount).toLocaleString()}원</p>
                  <p className="text-[13px] text-slate-500 mt-1">{cycleLabels[p.billing_cycle] || p.billing_cycle}</p>
                  {p.description && <p className="text-[13px] text-slate-500 mt-1">{p.description}</p>}
                  <button onClick={() => { setEditingPlan(p); setPlanForm({ name: p.name, amount: p.amount, description: p.description || '', billing_cycle: p.billing_cycle || 'monthly' }); setShowPlanForm(true); }}
                    className="mt-3 px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[13px] hover:bg-slate-50 cursor-pointer">
                    수정
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 수납 현황 탭 */}
      {tab === 'records' && (
        <section>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex gap-1.5">
              {[
                { key: 'all', label: '전체' },
                { key: 'unpaid', label: '미납' },
                { key: 'overdue', label: '연체' },
                { key: 'paid', label: '완납' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3.5 py-1.5 rounded-full text-[13px] cursor-pointer transition-colors ${
                  filter === f.key
                    ? 'bg-[var(--primary)] text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowRecordForm(true)}
                className="bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer">
                + 수납 등록
              </button>
              {overdue.length > 0 && (
                <button onClick={handleNotifyOverdue}
                  className="bg-[#ba1a1a] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer">
                  미납 알림 ({overdue.length})
                </button>
              )}
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <EmptyState title="수납 기록이 없습니다." />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">학생</th>
                      <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">플랜</th>
                      <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">금액</th>
                      <th className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">납부일</th>
                      <th className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">상태</th>
                      <th className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(r => {
                      const isOverdue = r.status === 'overdue' || (r.status === 'pending' && r.due_date && new Date(r.due_date) < new Date());
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 border-b border-slate-50">{r.student_name || r.student_id}</td>
                          <td className="px-3 py-2.5 border-b border-slate-50">{r.plan_name || '-'}</td>
                          <td className="px-3 py-2.5 border-b border-slate-50 text-right font-display font-bold text-[var(--primary)]">{Number(r.amount).toLocaleString()}원</td>
                          <td className="px-3 py-2.5 border-b border-slate-50 text-center">{r.due_date ? new Date(r.due_date).toLocaleDateString('ko-KR') : '-'}</td>
                          <td className="px-3 py-2.5 border-b border-slate-50 text-center">
                            <StatusBadge variant={r.status === 'paid' ? 'success' : isOverdue ? 'warning' : 'danger'}>
                              {r.status === 'paid' ? '완납' : isOverdue ? '연체' : '미납'}
                            </StatusBadge>
                          </td>
                          <td className="px-3 py-2.5 border-b border-slate-50 text-center">
                            {r.status !== 'paid' && (
                              <div className="flex gap-1 justify-center flex-wrap">
                                <button onClick={() => handleMarkPaid(r.id)}
                                  className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 cursor-pointer">
                                  완납
                                </button>
                                <button onClick={() => handleCreatePaymentLink(r.id)} disabled={linkLoading}
                                  className="px-2.5 py-1 rounded-md bg-white border border-[var(--primary)] text-[var(--primary)] text-xs font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                  결제링크
                                </button>
                                <button onClick={() => openSplitModal(r)}
                                  className="px-2.5 py-1 rounded-md bg-white border border-[var(--cta)] text-[var(--cta)] text-xs font-semibold hover:bg-slate-50 cursor-pointer">
                                  혼합수납
                                </button>
                                <button onClick={() => setInstallmentModal({ record: r, count: 3 })}
                                  className="px-2.5 py-1 rounded-md bg-white border border-[var(--primary)] text-[var(--primary)] text-xs font-semibold hover:bg-slate-50 cursor-pointer">
                                  분할납부
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 할인 규칙 탭 */}
      {tab === 'discounts' && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-[var(--primary)]">할인 규칙 (형제/장학/프로모션)</h3>
            <button onClick={() => { setEditingRule(null); setShowRuleForm(true); setRuleForm({ name: '', rule_type: 'sibling', discount_type: 'percent', discount_value: 10, min_siblings: 2, is_active: true }); }}
              className="bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer">
              + 규칙 추가
            </button>
          </div>
          {discountRules.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <EmptyState title="등록된 할인 규칙이 없습니다. 형제 할인/장학금/프로모션을 추가해보세요." />
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {discountRules.map(r => {
                const typeLabels = { sibling: '형제 할인', scholarship: '장학금', promotion: '프로모션', custom: '기타' };
                const cond = typeof r.condition === 'string' ? (() => { try { return JSON.parse(r.condition); } catch { return {}; } })() : (r.condition || {});
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="rounded-full px-3 py-0.5 text-xs font-bold bg-indigo-50 text-[var(--primary)]">
                        {typeLabels[r.rule_type] || r.rule_type}
                      </span>
                      {!r.is_active && <span className="text-[11px] text-slate-400">비활성</span>}
                    </div>
                    <h4 className="text-[15px] font-bold text-[var(--primary)] mb-1">{r.name}</h4>
                    <p className="text-xl font-display font-extrabold text-[var(--cta)]">
                      {r.discount_type === 'percent' ? `${r.discount_value}%` : `${Number(r.discount_value).toLocaleString()}원`}
                    </p>
                    {r.rule_type === 'sibling' && (
                      <p className="text-xs text-slate-500 mt-1">형제 {cond.min_siblings || 2}명 이상 시 적용</p>
                    )}
                    <div className="flex gap-1.5 mt-3">
                      <button onClick={() => {
                        setEditingRule(r);
                        setRuleForm({
                          name: r.name, rule_type: r.rule_type, discount_type: r.discount_type,
                          discount_value: r.discount_value, min_siblings: cond.min_siblings || 2, is_active: !!r.is_active,
                        });
                        setShowRuleForm(true);
                      }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs hover:bg-slate-50 cursor-pointer">수정</button>
                      <button onClick={() => handleDeleteRule(r.id)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-[#ba1a1a] text-xs hover:bg-red-50 cursor-pointer">삭제</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 할인 규칙 폼 모달 */}
      {showRuleForm && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-5"
          onClick={() => setShowRuleForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[440px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-[var(--primary)]">{editingRule ? '할인 규칙 수정' : '할인 규칙 추가'}</h3>
            <div className="flex flex-col gap-3">
              <input placeholder="규칙 이름 (예: 형제 10% 할인)" value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <select value={ruleForm.rule_type} onChange={e => setRuleForm({ ...ruleForm, rule_type: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
                <option value="sibling">형제 할인</option>
                <option value="scholarship">장학금</option>
                <option value="promotion">프로모션</option>
                <option value="custom">기타</option>
              </select>
              {ruleForm.rule_type === 'sibling' && (
                <label className="text-[13px] text-slate-500">
                  최소 형제 수
                  <input type="number" min="2" value={ruleForm.min_siblings} onChange={e => setRuleForm({ ...ruleForm, min_siblings: e.target.value })}
                    className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
                </label>
              )}
              <div className="flex gap-2">
                <select value={ruleForm.discount_type} onChange={e => setRuleForm({ ...ruleForm, discount_type: e.target.value })}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
                  <option value="percent">퍼센트</option>
                  <option value="fixed">정액</option>
                </select>
                <input type="number" placeholder={ruleForm.discount_type === 'percent' ? '% 값' : '원 값'} value={ruleForm.discount_value} onChange={e => setRuleForm({ ...ruleForm, discount_value: e.target.value })}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              </div>
              <label className="flex gap-2 items-center text-[13px]">
                <input type="checkbox" checked={ruleForm.is_active} onChange={e => setRuleForm({ ...ruleForm, is_active: e.target.checked })} />
                활성화
              </label>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowRuleForm(false)}
                className="px-5 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 cursor-pointer">취소</button>
              <button onClick={handleSaveRule}
                className="bg-[var(--cta)] text-white px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 혼합 수납 모달 */}
      {splitModal && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-5"
          onClick={() => setSplitModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[500px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2 text-[var(--primary)]">혼합 수납</h3>
            <p className="text-[13px] text-slate-500 mb-4">
              {splitModal.record.student_name || splitModal.record.student_id} · 청구액 {Number(splitModal.record.amount).toLocaleString()}원
            </p>
            <div className="flex flex-col gap-2">
              {splitModal.splits.map((s, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <select value={s.method} onChange={e => updateSplitLine(i, 'method', e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
                    <option value="card">카드</option>
                    <option value="cash">현금</option>
                    <option value="bank">계좌이체</option>
                    <option value="portone">PortOne</option>
                  </select>
                  <input type="number" placeholder="금액" value={s.amount} onChange={e => updateSplitLine(i, 'amount', e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
                  <button onClick={() => removeSplitLine(i)}
                    className="px-2.5 py-1.5 rounded-md bg-white border border-red-200 text-[#ba1a1a] text-xs hover:bg-red-50 cursor-pointer">×</button>
                </div>
              ))}
            </div>
            <button onClick={addSplitLine}
              className="mt-2.5 px-3 py-1.5 rounded-md bg-white border border-dashed border-slate-300 text-slate-500 text-xs hover:bg-slate-50 cursor-pointer">
              + 결제 수단 추가
            </button>
            <div className="mt-3 px-3 py-2.5 bg-slate-50 rounded-lg text-[13px] text-[var(--primary)]">
              합계: <strong className="font-display">{splitModal.splits.reduce((s, x) => s + Number(x.amount || 0), 0).toLocaleString()}원</strong>
              {' / '}청구: <strong className="font-display">{Number(splitModal.record.amount).toLocaleString()}원</strong>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setSplitModal(null)}
                className="px-5 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 cursor-pointer">취소</button>
              <button onClick={handleSubmitSplit}
                className="bg-[var(--cta)] text-white px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer">수납 기록</button>
            </div>
          </div>
        </div>
      )}

      {/* 분할 납부 모달 */}
      {installmentModal && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-5"
          onClick={() => setInstallmentModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[420px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2 text-[var(--primary)]">분할 납부</h3>
            <p className="text-[13px] text-slate-500 mb-4">
              청구액 {Number(installmentModal.record.amount).toLocaleString()}원을 몇 회로 나눠 청구할지 선택하세요.
            </p>
            <label className="text-[13px] text-slate-500 block mb-3">
              분할 횟수 (2~12)
              <input type="number" min="2" max="12" value={installmentModal.count}
                onChange={e => setInstallmentModal({ ...installmentModal, count: Math.max(2, Math.min(12, Number(e.target.value) || 2)) })}
                className="mt-1 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
            </label>
            <div className="px-3 py-2.5 bg-slate-50 rounded-lg text-[13px] text-[var(--primary)]">
              회차당 약 <strong className="font-display">{Math.floor(installmentModal.record.amount / installmentModal.count).toLocaleString()}원</strong>
              {' · '}매월 청구 생성
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setInstallmentModal(null)}
                className="px-5 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 cursor-pointer">취소</button>
              <button onClick={handleSubmitInstallment}
                className="bg-[var(--cta)] text-white px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer">생성</button>
            </div>
          </div>
        </div>
      )}

      {/* 플랜 폼 모달 */}
      {showPlanForm && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-5"
          onClick={() => setShowPlanForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[420px] shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-[var(--primary)]">{editingPlan ? '플랜 수정' : '플랜 추가'}</h3>
            <div className="flex flex-col gap-3">
              <input placeholder="플랜 이름" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <input type="number" placeholder="금액 (원)" value={planForm.amount} onChange={e => setPlanForm({ ...planForm, amount: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <select value={planForm.billing_cycle} onChange={e => setPlanForm({ ...planForm, billing_cycle: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
                <option value="monthly">월납</option>
                <option value="quarterly">분기납</option>
                <option value="yearly">연납</option>
                <option value="once">일시납</option>
              </select>
              <textarea placeholder="설명 (선택)" value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                rows={3} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)] resize-y" />
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowPlanForm(false)}
                className="px-5 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 cursor-pointer">취소</button>
              <button onClick={handleSavePlan}
                className="bg-[var(--cta)] text-white px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 수납 등록 모달 */}
      {showRecordForm && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-5"
          onClick={() => setShowRecordForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[420px] shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-[var(--primary)]">수납 등록</h3>
            <div className="flex flex-col gap-3">
              <input type="number" placeholder="학생 ID" value={recordForm.student_id} onChange={e => setRecordForm({ ...recordForm, student_id: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <select value={recordForm.plan_id} onChange={e => {
                const plan = plans.find(p => p.id === Number(e.target.value));
                setRecordForm({ ...recordForm, plan_id: e.target.value, amount: plan ? plan.amount : '' });
              }} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]">
                <option value="">플랜 선택</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({Number(p.amount).toLocaleString()}원)</option>)}
              </select>
              <input type="date" value={recordForm.due_date} onChange={e => setRecordForm({ ...recordForm, due_date: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
              <input type="number" placeholder="금액 (원)" value={recordForm.amount} onChange={e => setRecordForm({ ...recordForm, amount: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" />
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowRecordForm(false)}
                className="px-5 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 cursor-pointer">취소</button>
              <button onClick={handleCreateRecord}
                className="bg-[var(--cta)] text-white px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display cursor-pointer">등록</button>
            </div>
          </div>
        </div>
      )}

      {/* 결제 링크 모달 */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-5"
          onClick={() => setLinkModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[420px] shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-[var(--primary)]">결제 링크 생성 완료</h3>

            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-[13px] text-slate-500 mb-1">학생: <strong className="text-[var(--primary)]">{linkModal.studentName}</strong></p>
              <p className="text-[13px] text-slate-500 mb-1">금액: <strong className="font-display text-[var(--primary)]">{Number(linkModal.amount).toLocaleString()}원</strong></p>
              <p className="text-[13px] text-slate-500">납부 기한: <strong className="text-[var(--primary)]">{linkModal.dueDate ? new Date(linkModal.dueDate).toLocaleDateString('ko-KR') : '-'}</strong></p>
            </div>

            <div className="bg-white rounded-lg p-3 mb-4 break-all text-[13px] text-slate-500 border border-slate-200">
              {linkModal.paymentUrl}
            </div>

            <div className="flex gap-2">
              <button onClick={handleCopyLink}
                className="flex-1 py-2.5 rounded-lg bg-[var(--cta)] text-white font-bold text-sm hover:opacity-90 font-display cursor-pointer">
                링크 복사
              </button>
              <button onClick={handleSendAlimtalk}
                className="flex-1 py-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-700 font-bold text-sm hover:bg-amber-100 cursor-pointer">
                알림톡 발송
              </button>
            </div>

            <button onClick={() => setLinkModal(null)}
              className="w-full mt-2.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 cursor-pointer">
              닫기
            </button>
          </div>
        </div>
      )}

      </>
      )}
    </div>
  );
}
