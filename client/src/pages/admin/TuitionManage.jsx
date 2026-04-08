import { useState, useEffect } from 'react';
import { api, apiPost, apiPut } from '../../api';

export default function TuitionManage() {
  const [tab, setTab] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [records, setRecords] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

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

  useEffect(() => {
    Promise.all([loadPlans(), loadRecords(), loadOverdue()]).then(() => setLoading(false));
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
    if (!window.confirm('미납 학생/학부모에게 알림을 발송하시겠습니까?')) return;
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

  const handleSendAlimtalk = async () => {
    if (!linkModal) return;
    showMessage('카카오 알림톡 발송 기능은 SMS 크레딧이 필요합니다. (추후 연동 예정)');
  };

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;

  const filteredRecords = records.filter(r => {
    if (filter === 'unpaid') return r.status === 'pending';
    if (filter === 'paid') return r.status === 'paid';
    if (filter === 'overdue') return r.status === 'overdue' || (r.status === 'pending' && r.due_date && new Date(r.due_date) < new Date());
    return true;
  });

  const tabBtn = (key, label) => (
    <button key={key} onClick={() => setTab(key)} style={{
      padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 14, fontWeight: tab === key ? 700 : 500,
      background: tab === key ? 'var(--primary)' : 'var(--muted)',
      color: tab === key ? 'white' : 'var(--foreground)',
    }}>{label}</button>
  );

  const cycleLabels = { monthly: '월납', quarterly: '분기납', yearly: '연납', once: '일시납' };

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 20 }}>수납 관리</h2>

      {msg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--success-light)', color: 'oklch(52% 0.14 160)', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabBtn('plans', '수납 플랜')}
        {tabBtn('records', '수납 현황')}
      </div>

      {/* 수납 플랜 탭 */}
      {tab === 'plans' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>수납 플랜 목록</h3>
            <button onClick={() => { setShowPlanForm(true); setEditingPlan(null); setPlanForm({ name: '', amount: '', description: '', billing_cycle: 'monthly' }); }}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13 }}>
              + 플랜 추가
            </button>
          </div>
          {plans.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-500)', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              등록된 수납 플랜이 없습니다.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {plans.map(p => (
                <div key={p.id} style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: 8 }}>{p.name}</h4>
                  <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{Number(p.amount).toLocaleString()}원</p>
                  <p style={{ fontSize: 13, color: 'var(--neutral-500)', marginTop: 4 }}>{cycleLabels[p.billing_cycle] || p.billing_cycle}</p>
                  {p.description && <p style={{ fontSize: 13, color: 'var(--neutral-500)', marginTop: 4 }}>{p.description}</p>}
                  <button onClick={() => { setEditingPlan(p); setPlanForm({ name: p.name, amount: p.amount, description: p.description || '', billing_cycle: p.billing_cycle || 'monthly' }); setShowPlanForm(true); }}
                    style={{ marginTop: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 13, fontFamily: 'inherit' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'all', label: '전체' },
                { key: 'unpaid', label: '미납' },
                { key: 'overdue', label: '연체' },
                { key: 'paid', label: '완납' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
                  background: filter === f.key ? 'var(--primary)' : 'var(--muted)',
                  color: filter === f.key ? 'white' : 'var(--foreground)', fontFamily: 'inherit',
                }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowRecordForm(true)}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13 }}>
                + 수납 등록
              </button>
              {overdue.length > 0 && (
                <button onClick={handleNotifyOverdue}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'oklch(48% 0.20 25)', color: 'white', fontWeight: 600, fontSize: 13 }}>
                  미납 알림 ({overdue.length})
                </button>
              )}
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--neutral-500)', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
              수납 기록이 없습니다.
            </div>
          ) : (
            <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--muted)' }}>
                      <th style={{ padding: 10, textAlign: 'left' }}>학생</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>플랜</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>금액</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>납부일</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>상태</th>
                      <th style={{ padding: 10, textAlign: 'center' }}>액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(r => {
                      const isOverdue = r.status === 'overdue' || (r.status === 'pending' && r.due_date && new Date(r.due_date) < new Date());
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: 10 }}>{r.student_name || r.student_id}</td>
                          <td style={{ padding: 10 }}>{r.plan_name || '-'}</td>
                          <td style={{ padding: 10, textAlign: 'right' }}>{Number(r.amount).toLocaleString()}원</td>
                          <td style={{ padding: 10, textAlign: 'center' }}>{r.due_date ? new Date(r.due_date).toLocaleDateString('ko-KR') : '-'}</td>
                          <td style={{ padding: 10, textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                              background: r.status === 'paid' ? 'var(--success-light)' : isOverdue ? 'oklch(97% 0.02 60)' : 'var(--destructive-light)',
                              color: r.status === 'paid' ? 'oklch(52% 0.14 160)' : isOverdue ? 'oklch(52% 0.18 45)' : 'oklch(48% 0.20 25)',
                            }}>{r.status === 'paid' ? '완납' : isOverdue ? '연체' : '미납'}</span>
                          </td>
                          <td style={{ padding: 10, textAlign: 'center' }}>
                            {r.status !== 'paid' && (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button onClick={() => handleMarkPaid(r.id)}
                                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--success)', color: 'white', fontSize: 12, fontWeight: 600 }}>
                                  완납
                                </button>
                                <button onClick={() => handleCreatePaymentLink(r.id)} disabled={linkLoading}
                                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--primary)', cursor: 'pointer', background: 'white', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>
                                  결제링크
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

      {/* 플랜 폼 모달 */}
      {showPlanForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowPlanForm(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{editingPlan ? '플랜 수정' : '플랜 추가'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input placeholder="플랜 이름" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <input type="number" placeholder="금액 (원)" value={planForm.amount} onChange={e => setPlanForm({ ...planForm, amount: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <select value={planForm.billing_cycle} onChange={e => setPlanForm({ ...planForm, billing_cycle: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }}>
                <option value="monthly">월납</option>
                <option value="quarterly">분기납</option>
                <option value="yearly">연납</option>
                <option value="once">일시납</option>
              </select>
              <textarea placeholder="설명 (선택)" value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                rows={3} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPlanForm(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 14, fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleSavePlan}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14 }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 수납 등록 모달 */}
      {showRecordForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowRecordForm(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>수납 등록</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="number" placeholder="학생 ID" value={recordForm.student_id} onChange={e => setRecordForm({ ...recordForm, student_id: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <select value={recordForm.plan_id} onChange={e => {
                const plan = plans.find(p => p.id === Number(e.target.value));
                setRecordForm({ ...recordForm, plan_id: e.target.value, amount: plan ? plan.amount : '' });
              }} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }}>
                <option value="">플랜 선택</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({Number(p.amount).toLocaleString()}원)</option>)}
              </select>
              <input type="date" value={recordForm.due_date} onChange={e => setRecordForm({ ...recordForm, due_date: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <input type="number" placeholder="금액 (원)" value={recordForm.amount} onChange={e => setRecordForm({ ...recordForm, amount: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRecordForm(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 14, fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleCreateRecord}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14 }}>등록</button>
            </div>
          </div>
        </div>
      )}

      {/* 결제 링크 모달 */}
      {linkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setLinkModal(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>결제 링크 생성 완료</h3>

            <div style={{ background: 'var(--muted)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--neutral-500)', marginBottom: 4 }}>학생: <strong style={{ color: 'var(--foreground)' }}>{linkModal.studentName}</strong></p>
              <p style={{ fontSize: 13, color: 'var(--neutral-500)', marginBottom: 4 }}>금액: <strong style={{ color: 'var(--foreground)' }}>{Number(linkModal.amount).toLocaleString()}원</strong></p>
              <p style={{ fontSize: 13, color: 'var(--neutral-500)' }}>납부 기한: <strong style={{ color: 'var(--foreground)' }}>{linkModal.dueDate ? new Date(linkModal.dueDate).toLocaleDateString('ko-KR') : '-'}</strong></p>
            </div>

            <div style={{ background: 'var(--background)', borderRadius: 8, padding: 12, marginBottom: 16, wordBreak: 'break-all', fontSize: 13, color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
              {linkModal.paymentUrl}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopyLink}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                링크 복사
              </button>
              <button onClick={handleSendAlimtalk}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid oklch(80% 0.14 85)', cursor: 'pointer', background: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                알림톡 발송
              </button>
            </div>

            <button onClick={() => setLinkModal(null)}
              style={{ width: '100%', marginTop: 10, padding: '8px 0', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 14, fontFamily: 'inherit', color: 'var(--neutral-500)' }}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
