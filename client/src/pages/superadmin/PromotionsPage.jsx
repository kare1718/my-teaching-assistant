import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const PROMO_TYPES = {
  free_month: { label: '무료 기간 연장', icon: '📅', desc: '구독 기간을 무료로 연장' },
  tier_upgrade: { label: '티어 업그레이드', icon: '⬆️', desc: '일시적으로 상위 티어 적용' },
  sms_credits: { label: 'SMS 크레딧', icon: '💬', desc: 'SMS 크레딧 충전' },
  discount_coupon: { label: '할인 쿠폰', icon: '🏷️', desc: '결제 시 할인 적용' },
  trial_extension: { label: '체험 연장', icon: '⏰', desc: '체험 기간 연장' },
  feature_unlock: { label: '기능 해제', icon: '🔓', desc: '특정 기능 임시 해제' },
};

const STATUS_LABELS = {
  granted: { text: '지급됨', bg: '#dbeafe', color: '#2563eb' },
  applied: { text: '적용됨', bg: '#d1fae5', color: '#059669' },
  expired: { text: '만료', bg: '#f3f4f6', color: '#6b7280' },
  revoked: { text: '취소', bg: '#fee2e2', color: '#dc2626' },
};

const cardStyle = {
  background: 'var(--card)', borderRadius: 16, padding: '24px 28px',
  border: '1px solid var(--border)',
};
const btnPrimary = {
  padding: '10px 20px', background: 'var(--primary)', color: 'var(--card)',
  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: FONT,
};
const btnSecondary = {
  padding: '10px 20px', background: 'var(--muted)', color: 'var(--foreground)',
  border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: FONT,
};
const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
  borderRadius: 10, fontSize: 14, fontFamily: FONT, outline: 'none',
  background: 'var(--card)', color: 'var(--foreground)', boxSizing: 'border-box',
};

export default function PromotionsPage() {
  const [tab, setTab] = useState('list');
  const [promos, setPromos] = useState([]);
  const [grants, setGrants] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [academies, setAcademies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');

  // 생성 폼
  const [form, setForm] = useState({
    name: '', type: 'free_month', value: {}, code: '', max_uses: '', expires_at: '',
  });

  // 지급 폼
  const [grantForm, setGrantForm] = useState({ academy_id: '', note: '' });
  const [grantSearch, setGrantSearch] = useState('');
  const [showGrantModal, setShowGrantModal] = useState(false);

  const showMsg = (text, type = 'success') => { setMsg(text); setMsgType(type); setTimeout(() => setMsg(''), 3000); };

  const load = () => {
    setLoading(true);
    Promise.all([
      api('/superadmin/promotions'),
      api('/superadmin/academies'),
    ]).then(([p, a]) => {
      setPromos(Array.isArray(p) ? p : []);
      setAcademies(Array.isArray(a) ? a : []);
    }).catch(e => { setPromos([]); setAcademies([]); showMsg(e.message, 'error'); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const loadGrants = (promoId) => {
    api(`/superadmin/promotions/${promoId}/grants`).then(d => setGrants(Array.isArray(d) ? d : [])).catch(() => setGrants([]));
  };

  // 프로모션 생성
  const handleCreate = async () => {
    try {
      const payload = { ...form, value: form.value };
      if (form.code) payload.code = form.code.toUpperCase();
      if (form.max_uses) payload.max_uses = parseInt(form.max_uses);
      if (!form.expires_at) delete payload.expires_at;
      await apiPost('/superadmin/promotions', payload);
      showMsg('프로모션이 생성되었습니다.');
      setForm({ name: '', type: 'free_month', value: {}, code: '', max_uses: '', expires_at: '' });
      setTab('list');
      load();
    } catch (e) { showMsg(e.message, 'error'); }
  };

  // 프로모션 활성/비활성 토글
  const toggleActive = async (promo) => {
    try {
      await apiPut(`/superadmin/promotions/${promo.id}`, { is_active: !promo.is_active });
      showMsg(promo.is_active ? '비활성화 되었습니다.' : '활성화 되었습니다.');
      load();
    } catch (e) { showMsg(e.message, 'error'); }
  };

  // 삭제
  const handleDelete = async (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/superadmin/promotions/${id}`);
      showMsg('삭제되었습니다.');
      load();
    } catch (e) { showMsg(e.message, 'error'); }
  };

  // 지급
  const handleGrant = async () => {
    if (!grantForm.academy_id || !selectedPromo) return;
    try {
      const result = await apiPost(`/superadmin/promotions/${selectedPromo.id}/grant`, grantForm);
      showMsg(result.message || '지급 완료');
      setShowGrantModal(false);
      setGrantForm({ academy_id: '', note: '' });
      loadGrants(selectedPromo.id);
      load();
    } catch (e) { showMsg(e.message, 'error'); }
  };

  // 타입별 value 입력 렌더링
  const renderValueForm = () => {
    const type = form.type;
    switch (type) {
      case 'free_month':
        return (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>연장 개월 수</label>
            <input type="number" min="1" placeholder="1" style={inputStyle}
              value={form.value.months || ''} onChange={e => setForm({ ...form, value: { months: parseInt(e.target.value) || 1 } })} />
          </div>
        );
      case 'tier_upgrade':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>업그레이드 티어</label>
              <select style={inputStyle} value={form.value.tier || 'pro'}
                onChange={e => setForm({ ...form, value: { ...form.value, tier: e.target.value } })}>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="first_class">First Class</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>기간 (일)</label>
              <input type="number" min="1" placeholder="30" style={inputStyle}
                value={form.value.days || ''} onChange={e => setForm({ ...form, value: { ...form.value, days: parseInt(e.target.value) || 30 } })} />
            </div>
          </div>
        );
      case 'sms_credits':
        return (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>충전 건수</label>
            <input type="number" min="1" placeholder="100" style={inputStyle}
              value={form.value.amount || ''} onChange={e => setForm({ ...form, value: { amount: parseInt(e.target.value) || 0 } })} />
          </div>
        );
      case 'discount_coupon':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>할인율 (%)</label>
              <input type="number" min="1" max="100" placeholder="20" style={inputStyle}
                value={form.value.percent || ''} onChange={e => setForm({ ...form, value: { ...form.value, percent: parseInt(e.target.value) || 0 } })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>최대 할인액 (원)</label>
              <input type="number" min="0" placeholder="50000" style={inputStyle}
                value={form.value.max_discount || ''} onChange={e => setForm({ ...form, value: { ...form.value, max_discount: parseInt(e.target.value) || 0 } })} />
            </div>
          </div>
        );
      case 'trial_extension':
        return (
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>연장 일수</label>
            <input type="number" min="1" placeholder="14" style={inputStyle}
              value={form.value.days || ''} onChange={e => setForm({ ...form, value: { days: parseInt(e.target.value) || 14 } })} />
          </div>
        );
      case 'feature_unlock':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>기능 (쉼표 구분)</label>
              <input type="text" placeholder="ai_reports, sms, clinic" style={inputStyle}
                value={(form.value.features || []).join(', ')}
                onChange={e => setForm({ ...form, value: { ...form.value, features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>기간 (일)</label>
              <input type="number" min="1" placeholder="30" style={inputStyle}
                value={form.value.days || ''} onChange={e => setForm({ ...form, value: { ...form.value, days: parseInt(e.target.value) || 30 } })} />
            </div>
          </div>
        );
      default: return null;
    }
  };

  const filteredAcademies = academies.filter(a =>
    !grantSearch || a.name.toLowerCase().includes(grantSearch.toLowerCase()) || a.slug?.toLowerCase().includes(grantSearch.toLowerCase())
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT, color: 'var(--muted-foreground)' }}>로딩 중...</div>;

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1280, margin: '0 auto', fontFamily: FONT }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>프로모션 관리</h1>
        <p style={{ color: 'var(--muted-foreground)', margin: '4px 0 0', fontSize: 14 }}>기프트, 쿠폰, 이용권을 학원에 전달합니다</p>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontWeight: 600, fontSize: 14,
          background: msgType === 'error' ? '#fee2e2' : '#d1fae5',
          color: msgType === 'error' ? '#dc2626' : '#059669',
        }}>{msg}</div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { key: 'list', label: '프로모션 목록' },
          { key: 'create', label: '+ 새 프로모션' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedPromo(null); }}
            style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: FONT,
              cursor: 'pointer', border: 'none',
              background: tab === t.key ? 'var(--primary)' : 'var(--muted)',
              color: tab === t.key ? 'var(--card)' : 'var(--foreground)',
            }}>{t.label}</button>
        ))}
      </div>

      {/* 프로모션 목록 */}
      {tab === 'list' && !selectedPromo && (
        <div style={{ display: 'grid', gap: 16 }}>
          {promos.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 48, color: 'var(--muted-foreground)' }}>
              아직 생성된 프로모션이 없습니다. 위 "새 프로모션" 탭에서 생성하세요.
            </div>
          ) : promos.map(p => {
            const typeInfo = PROMO_TYPES[p.type] || { label: p.type, icon: '📦' };
            const value = typeof p.value === 'string' ? JSON.parse(p.value) : p.value;
            return (
              <div key={p.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 28, width: 48, textAlign: 'center' }}>{typeInfo.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--foreground)' }}>{p.name}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: p.is_active ? '#d1fae5' : '#f3f4f6',
                      color: p.is_active ? '#059669' : '#6b7280',
                    }}>{p.is_active ? '활성' : '비활성'}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#ede9fe', color: '#7c3aed' }}>
                      {typeInfo.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted-foreground)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {p.code && <span>코드: <b style={{ fontFamily: 'monospace' }}>{p.code}</b></span>}
                    <span>지급: {p.grant_count || 0}건</span>
                    {p.max_uses && <span>한도: {p.used_count}/{p.max_uses}</span>}
                    {p.expires_at && <span>만료: {new Date(p.expires_at).toLocaleDateString('ko-KR')}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setSelectedPromo(p); loadGrants(p.id); }}
                    style={{ ...btnPrimary, padding: '8px 16px', fontSize: 13 }}>지급하기</button>
                  <button onClick={() => toggleActive(p)}
                    style={{ ...btnSecondary, padding: '8px 14px', fontSize: 13 }}>
                    {p.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button onClick={() => handleDelete(p.id)}
                    style={{ ...btnSecondary, padding: '8px 14px', fontSize: 13, color: '#dc2626' }}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 프로모션 상세 + 지급 */}
      {tab === 'list' && selectedPromo && (
        <div>
          <button onClick={() => setSelectedPromo(null)} style={{ ...btnSecondary, marginBottom: 16, fontSize: 13 }}>← 목록으로</button>

          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--foreground)' }}>
                {PROMO_TYPES[selectedPromo.type]?.icon} {selectedPromo.name}
              </h2>
              <button onClick={() => setShowGrantModal(true)} style={btnPrimary}>학원에 지급</button>
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted-foreground)', display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px 16px' }}>
              <span style={{ fontWeight: 600 }}>타입</span><span>{PROMO_TYPES[selectedPromo.type]?.label}</span>
              <span style={{ fontWeight: 600 }}>코드</span><span style={{ fontFamily: 'monospace' }}>{selectedPromo.code || '(직접 지급)'}</span>
              <span style={{ fontWeight: 600 }}>사용</span><span>{selectedPromo.used_count}/{selectedPromo.max_uses || '무제한'}</span>
            </div>
          </div>

          {/* 지급 내역 */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--foreground)' }}>지급 내역</h3>
            {grants.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>아직 지급 내역이 없습니다.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['학원', '상태', '지급자', '메모', '지급일'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--muted-foreground)', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map(g => {
                      const s = STATUS_LABELS[g.status] || STATUS_LABELS.granted;
                      return (
                        <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{g.academy_name} <span style={{ color: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 12 }}>({g.academy_slug})</span></td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>{s.text}</span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--muted-foreground)' }}>{g.grantor_name || '-'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--muted-foreground)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.note || '-'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--muted-foreground)', fontSize: 13 }}>
                            {g.created_at ? new Date(g.created_at).toLocaleDateString('ko-KR') : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 지급 모달 */}
          {showGrantModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
            }} onClick={() => setShowGrantModal(false)}>
              <div style={{ ...cardStyle, width: 500, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 20px', color: 'var(--foreground)' }}>
                  {PROMO_TYPES[selectedPromo.type]?.icon} {selectedPromo.name} 지급
                </h3>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>학원 검색</label>
                  <input placeholder="학원명 또는 슬러그..." value={grantSearch} onChange={e => setGrantSearch(e.target.value)} style={inputStyle} />
                </div>

                <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16 }}>
                  {filteredAcademies.slice(0, 20).map(a => (
                    <div key={a.id}
                      onClick={() => setGrantForm({ ...grantForm, academy_id: a.id })}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', fontSize: 14,
                        borderBottom: '1px solid var(--border)',
                        background: grantForm.academy_id === a.id ? 'var(--primary-light)' : 'transparent',
                        fontWeight: grantForm.academy_id === a.id ? 700 : 400,
                      }}>
                      {a.name} <span style={{ color: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 12 }}>({a.slug})</span>
                      <span style={{ float: 'right', fontSize: 12, color: 'var(--muted-foreground)' }}>학생 {a.student_count || 0}명</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>메모 (선택)</label>
                  <textarea rows={2} placeholder="지급 사유..." value={grantForm.note}
                    onChange={e => setGrantForm({ ...grantForm, note: e.target.value })}
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowGrantModal(false)} style={btnSecondary}>취소</button>
                  <button onClick={handleGrant} disabled={!grantForm.academy_id} style={{ ...btnPrimary, opacity: grantForm.academy_id ? 1 : 0.5 }}>지급하기</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 새 프로모션 생성 */}
      {tab === 'create' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 24px', color: 'var(--foreground)' }}>새 프로모션 생성</h3>

          {/* 타입 선택 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 8 }}>프로모션 타입</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              {Object.entries(PROMO_TYPES).map(([key, info]) => (
                <button key={key} onClick={() => setForm({ ...form, type: key, value: {} })}
                  style={{
                    padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    border: form.type === key ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                    background: form.type === key ? 'var(--primary-light)' : 'var(--card)',
                    fontFamily: FONT,
                  }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{info.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{info.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{info.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 기본 정보 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>프로모션 이름 *</label>
              <input placeholder="예: 신규 학원 환영 기프트" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>쿠폰 코드 (선택)</label>
              <input placeholder="예: WELCOME2026" value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} style={{ ...inputStyle, fontFamily: 'monospace' }} />
            </div>
          </div>

          {/* 타입별 값 입력 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 8 }}>프로모션 설정</label>
            {renderValueForm()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>최대 사용 횟수 (비우면 무제한)</label>
              <input type="number" min="1" placeholder="무제한" value={form.max_uses}
                onChange={e => setForm({ ...form, max_uses: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>만료일 (비우면 무기한)</label>
              <input type="date" value={form.expires_at}
                onChange={e => setForm({ ...form, expires_at: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={!form.name}
              style={{ ...btnPrimary, opacity: form.name ? 1 : 0.5 }}>프로모션 생성</button>
            <button onClick={() => setTab('list')} style={btnSecondary}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
