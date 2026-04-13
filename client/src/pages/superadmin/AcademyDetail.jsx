import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const TIERS = ['trial', 'free', 'basic', 'standard', 'pro', 'enterprise'];
const TIER_LABELS = {
  trial: '체험', free: '무료', basic: '베이직', standard: '스탠다드', pro: '프로', enterprise: '엔터프라이즈',
};

const cardStyle = {
  background: 'var(--card)', borderRadius: 16, padding: '24px 28px',
  border: '1px solid var(--border)',
};

export default function AcademyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('info');

  // 메모
  const [memos, setMemos] = useState([]);
  const [newMemo, setNewMemo] = useState('');

  // 기프트
  const [grants, setGrants] = useState([]);
  const [promos, setPromos] = useState([]);

  // 결제 내역
  const [payments, setPayments] = useState([]);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const load = () => {
    api(`/superadmin/academies/${id}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (tab === 'memos') {
      api(`/superadmin/academies/${id}/memos`).then(setMemos).catch(console.error);
    }
    if (tab === 'gifts') {
      api('/superadmin/promotions').then(setPromos).catch(console.error);
      // 모든 프로모션의 grants 중 이 학원 것만 조회 (간단히 전체 프로모션 순회)
      api('/superadmin/promotions').then(async (ps) => {
        const allGrants = [];
        for (const p of ps) {
          try {
            const g = await api(`/superadmin/promotions/${p.id}/grants`);
            allGrants.push(...g.filter(gr => gr.academy_id === parseInt(id)).map(gr => ({ ...gr, promo_name: p.name, promo_type: p.type })));
          } catch {}
        }
        setGrants(allGrants.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      });
    }
    if (tab === 'payments') {
      api(`/superadmin/revenue/payments?academy_id=${id}`).then(r => setPayments(r.payments || [])).catch(console.error);
    }
  }, [tab, id]);

  const toggleStatus = async () => {
    const isActive = data.academy.is_active === false || data.academy.is_active === 0;
    try {
      await apiPut(`/superadmin/academies/${id}/status`, { isActive });
      showMsg(isActive ? '학원이 활성화되었습니다.' : '학원이 비활성화되었습니다.');
      load();
    } catch (err) { showMsg(err.message); }
  };

  const changeTier = async (tier) => {
    try {
      await apiPut(`/superadmin/academies/${id}/tier`, { tier });
      showMsg(`티어가 ${TIER_LABELS[tier]}로 변경되었습니다.`);
      load();
    } catch (err) { showMsg(err.message); }
  };

  const addMemo = async () => {
    if (!newMemo.trim()) return;
    try {
      await apiPost(`/superadmin/academies/${id}/memos`, { content: newMemo });
      setNewMemo('');
      const m = await api(`/superadmin/academies/${id}/memos`);
      setMemos(m);
      showMsg('메모가 저장되었습니다.');
    } catch (err) { showMsg(err.message); }
  };

  const deleteMemo = async (memoId) => {
    try {
      await apiDelete(`/superadmin/memos/${memoId}`);
      setMemos(memos.filter(m => m.id !== memoId));
    } catch (err) { showMsg(err.message); }
  };

  const quickGrant = async (promoId) => {
    try {
      const result = await apiPost(`/superadmin/promotions/${promoId}/grant`, { academy_id: parseInt(id), note: '학원 상세에서 직접 지급' });
      showMsg(result.message || '지급 완료');
    } catch (err) { showMsg(err.message); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT, color: 'var(--muted-foreground)' }}>로딩 중...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT }}>학원을 찾을 수 없습니다.</div>;

  const { academy, stats, subscription } = data;
  const isActive = academy.is_active !== false && academy.is_active !== 0;

  const tabs = [
    { key: 'info', label: '기본 정보' },
    { key: 'memos', label: '메모' },
    { key: 'payments', label: '결제 내역' },
    { key: 'gifts', label: '기프트' },
  ];

  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto', fontFamily: FONT }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/superadmin')}
          style={{
            padding: '8px 16px', background: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: 10, cursor: 'pointer', fontSize: 14, fontFamily: FONT, color: 'var(--foreground)',
          }}>← 목록</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>{academy.name}</h1>
          <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>{academy.slug}</span>
        </div>
        <span style={{
          padding: '6px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13,
          background: isActive ? '#d1fae5' : '#fee2e2', color: isActive ? '#059669' : '#dc2626',
        }}>{isActive ? '활성' : '비활성'}</span>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontWeight: 600, fontSize: 14,
          background: '#d1fae5', color: '#059669',
        }}>{msg}</div>
      )}

      {/* 통계 카드 */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: '학생 수', value: stats?.students?.count || 0 },
          { label: '시험 수', value: stats?.exams?.count || 0 },
          { label: '퀴즈 로그', value: stats?.quizLogs?.count || 0 },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, flex: 1, minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
              border: 'none', borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent', color: tab === t.key ? 'var(--primary)' : 'var(--muted-foreground)',
              marginBottom: -1,
            }}>{t.label}</button>
        ))}
      </div>

      {/* 기본 정보 탭 */}
      {tab === 'info' && (
        <>
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--foreground)' }}>학원 정보</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px 16px', fontSize: 14 }}>
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>학원명</span>
              <span style={{ color: 'var(--foreground)' }}>{academy.name}</span>
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>슬러그</span>
              <span style={{ color: 'var(--foreground)', fontFamily: 'monospace' }}>{academy.slug}</span>
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>현재 티어</span>
              <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{TIER_LABELS[academy.subscription_tier] || academy.subscription_tier}</span>
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>최대 학생</span>
              <span style={{ color: 'var(--foreground)' }}>{academy.max_students || '-'}명</span>
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>생성일</span>
              <span style={{ color: 'var(--foreground)' }}>{academy.created_at ? new Date(academy.created_at).toLocaleDateString('ko-KR') : '-'}</span>
            </div>
          </div>

          {subscription && (
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--foreground)' }}>구독 정보</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px 16px', fontSize: 14 }}>
                <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>상태</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>{subscription.status}</span>
                <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>시작일</span>
                <span>{subscription.started_at ? new Date(subscription.started_at).toLocaleDateString('ko-KR') : '-'}</span>
                <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>종료일</span>
                <span>{subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString('ko-KR') : '-'}</span>
              </div>
            </div>
          )}

          <div style={cardStyle}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--foreground)' }}>관리</h3>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 8 }}>티어 변경</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TIERS.map(t => (
                  <button key={t} onClick={() => changeTier(t)} disabled={academy.subscription_tier === t}
                    style={{
                      padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      fontFamily: FONT, cursor: academy.subscription_tier === t ? 'default' : 'pointer',
                      border: academy.subscription_tier === t ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                      background: academy.subscription_tier === t ? 'var(--primary-light)' : 'var(--card)',
                      color: academy.subscription_tier === t ? 'var(--primary)' : 'var(--foreground)',
                    }}>{TIER_LABELS[t]}</button>
                ))}
              </div>
            </div>
            <button onClick={toggleStatus}
              style={{
                padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                fontFamily: FONT, cursor: 'pointer', border: 'none',
                background: isActive ? '#fee2e2' : '#d1fae5', color: isActive ? '#dc2626' : '#059669',
              }}>{isActive ? '학원 비활성화' : '학원 활성화'}</button>
          </div>
        </>
      )}

      {/* 메모 탭 */}
      {tab === 'memos' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--foreground)' }}>관리자 메모</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <textarea rows={2} placeholder="메모를 입력하세요..." value={newMemo}
              onChange={e => setNewMemo(e.target.value)}
              style={{
                flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10,
                fontSize: 14, fontFamily: FONT, outline: 'none', resize: 'vertical',
                background: 'var(--card)', color: 'var(--foreground)',
              }} />
            <button onClick={addMemo} disabled={!newMemo.trim()}
              style={{
                padding: '10px 20px', background: 'var(--primary)', color: 'var(--card)',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: newMemo.trim() ? 'pointer' : 'default', fontFamily: FONT,
                opacity: newMemo.trim() ? 1 : 0.5, alignSelf: 'flex-start',
              }}>저장</button>
          </div>
          {memos.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>메모가 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {memos.map(m => (
                <div key={m.id} style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--muted)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                      {m.author_name || '관리자'} · {m.created_at ? new Date(m.created_at).toLocaleString('ko-KR') : ''}
                    </span>
                    <button onClick={() => deleteMemo(m.id)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>삭제</button>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 결제 내역 탭 */}
      {tab === 'payments' && (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                {['금액', '상태', '결제방법', '결제일'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--muted-foreground)', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)' }}>결제 내역이 없습니다</td></tr>
              ) : payments.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{Number(p.amount).toLocaleString()}원</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: p.status === 'paid' ? '#d1fae5' : p.status === 'failed' ? '#fee2e2' : '#fef3c7',
                      color: p.status === 'paid' ? '#059669' : p.status === 'failed' ? '#dc2626' : '#d97706',
                    }}>{p.status === 'paid' ? '완료' : p.status === 'failed' ? '실패' : p.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted-foreground)' }}>{p.payment_method || '-'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted-foreground)', fontSize: 13 }}>
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 기프트 탭 */}
      {tab === 'gifts' && (
        <>
          {/* 빠른 지급 */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--foreground)' }}>빠른 지급</h3>
            {promos.filter(p => p.is_active).length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
                활성 프로모션이 없습니다.{' '}
                <span onClick={() => navigate('/superadmin/promotions')} style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>프로모션 생성하기 →</span>
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {promos.filter(p => p.is_active).map(p => (
                  <button key={p.id} onClick={() => { if (confirm(`${academy.name}에 "${p.name}"을(를) 지급하시겠습니까?`)) quickGrant(p.id); }}
                    style={{
                      padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      fontFamily: FONT, cursor: 'pointer',
                      border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)',
                    }}>🎁 {p.name}</button>
                ))}
              </div>
            )}
          </div>

          {/* 지급 내역 */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--foreground)' }}>지급 내역</h3>
            {grants.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>이 학원에 지급된 기프트가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {grants.map(g => (
                  <div key={g.id} style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>🎁</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>{g.promo_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {g.note || ''} · {g.created_at ? new Date(g.created_at).toLocaleDateString('ko-KR') : ''}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: g.status === 'applied' ? '#d1fae5' : '#dbeafe',
                      color: g.status === 'applied' ? '#059669' : '#2563eb',
                    }}>{g.status === 'applied' ? '적용됨' : g.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
