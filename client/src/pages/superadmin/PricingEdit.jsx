// 슈퍼관리자 — 요금제/AI 크레딧 편집 페이지
// 수정 즉시 서버 캐시 무효화 + 랜딩페이지 반영
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPut } from '../../api';
import { PageLoading } from '../../components/ui';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const cardStyle = {
  background: 'var(--card)', borderRadius: 16, padding: '24px 28px',
  border: '1px solid var(--border)', marginBottom: 20,
};

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)',
  borderRadius: 8, fontSize: 14, fontFamily: FONT, outline: 'none',
  background: 'var(--card)', color: 'var(--foreground)', boxSizing: 'border-box',
};

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 4 };

export default function PricingEdit() {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    Promise.all([
      api('/tiers/all'),
      api('/tiers/features'),
    ]).then(([t, f]) => {
      setTiers(t);
      setFeatures(f);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const updateTier = (key, patch) => {
    setTiers(tiers.map(t => t.tier_key === key ? { ...t, ...patch } : t));
  };

  const saveTier = async (tier) => {
    setSavingKey(tier.tier_key);
    try {
      await apiPut(`/tiers/admin/${tier.tier_key}`, {
        display_name: tier.display_name,
        sort_order: parseInt(tier.sort_order),
        monthly_price: parseInt(tier.monthly_price) || 0,
        yearly_price: tier.yearly_price ? parseInt(tier.yearly_price) : null,
        max_students: tier.max_students === null || tier.max_students === '' ? null : parseInt(tier.max_students),
        ai_credits_monthly: parseInt(tier.ai_credits_monthly) || 0,
        description: tier.description,
        features: Array.isArray(tier.features) ? tier.features : (tier.features || '').split('\n').filter(Boolean),
        highlighted: !!tier.highlighted,
        cta_label: tier.cta_label,
        cta_type: tier.cta_type,
        is_public: !!tier.is_public,
        is_active: !!tier.is_active,
      });
      showMsg(`${tier.display_name} 저장 완료`);
      load();
    } catch (err) {
      showMsg(`저장 실패: ${err.message}`);
    } finally {
      setSavingKey(null);
    }
  };

  const saveFeatureCost = async (f) => {
    try {
      await apiPut(`/tiers/admin/features/${f.feature_key}`, {
        credit_cost: parseInt(f.credit_cost),
        display_name: f.display_name,
        description: f.description,
        is_active: !!f.is_active,
      });
      showMsg(`${f.display_name} 단가 저장됨`);
    } catch (err) {
      showMsg(`저장 실패: ${err.message}`);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/superadmin')}
          style={{
            padding: '8px 16px', background: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: 10, cursor: 'pointer', fontSize: 14, fontFamily: FONT, color: 'var(--foreground)',
          }}>← 뒤로</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>요금제 & AI 크레딧</h1>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontWeight: 600, fontSize: 14,
          background: msg.includes('실패') ? '#fee2e2' : '#d1fae5',
          color: msg.includes('실패') ? '#dc2626' : '#059669' }}>{msg}</div>
      )}

      <div style={{ ...cardStyle, background: 'oklch(96% 0.04 90)', borderColor: 'oklch(80% 0.12 90)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'oklch(35% 0.14 70)', lineHeight: 1.6 }}>
          💡 저장 즉시 랜딩페이지(<a href="/" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>https://najogyo.com</a>)에 반영됩니다.<br/>
          <b>AI 크레딧 원가율 목표: 5~8%</b> — Gemini Flash 기준 1 크레딧 ≈ 약 15원 원가
        </p>
      </div>

      {/* 티어 카드 편집 */}
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '24px 0 12px', color: 'var(--foreground)' }}>
        요금제 ({tiers.length}개)
      </h2>

      {tiers.map((tier) => (
        <div key={tier.tier_key} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: 'var(--muted)', color: 'var(--muted-foreground)', fontFamily: 'monospace',
            }}>{tier.tier_key}</span>
            <input
              value={tier.display_name || ''}
              onChange={e => updateTier(tier.tier_key, { display_name: e.target.value })}
              style={{ ...inputStyle, fontSize: 18, fontWeight: 800, flex: 1, maxWidth: 250 }}
            />
            {tier.highlighted && (
              <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--primary)', color: '#fff' }}>인기</span>
            )}
            <button
              onClick={() => saveTier(tier)}
              disabled={savingKey === tier.tier_key}
              style={{
                padding: '8px 18px', background: 'var(--primary)', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: savingKey === tier.tier_key ? 'default' : 'pointer', fontFamily: FONT,
                opacity: savingKey === tier.tier_key ? 0.6 : 1,
              }}>
              {savingKey === tier.tier_key ? '저장 중…' : '저장'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>월 가격 (원, VAT별도)</label>
              <input
                type="number"
                value={tier.monthly_price ?? ''}
                onChange={e => updateTier(tier.tier_key, { monthly_price: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>연 결제 월환산</label>
              <input
                type="number"
                value={tier.yearly_price ?? ''}
                placeholder="비워두면 연결제 미제공"
                onChange={e => updateTier(tier.tier_key, { yearly_price: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>학생 수 (무제한은 비우기)</label>
              <input
                type="number"
                value={tier.max_students ?? ''}
                onChange={e => updateTier(tier.tier_key, { max_students: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>월 AI 크레딧</label>
              <input
                type="number"
                value={tier.ai_credits_monthly ?? 0}
                onChange={e => updateTier(tier.tier_key, { ai_credits_monthly: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>정렬 순서</label>
              <input
                type="number"
                value={tier.sort_order ?? 0}
                onChange={e => updateTier(tier.tier_key, { sort_order: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>CTA 버튼 문구</label>
              <input
                value={tier.cta_label || ''}
                onChange={e => updateTier(tier.tier_key, { cta_label: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>CTA 동작</label>
              <select
                value={tier.cta_type || 'signup'}
                onChange={e => updateTier(tier.tier_key, { cta_type: e.target.value })}
                style={inputStyle}
              >
                <option value="signup">회원가입 이동</option>
                <option value="contact">문의하기</option>
                <option value="upgrade">업그레이드</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>부제목 (카드 상단 설명)</label>
            <input
              value={tier.description || ''}
              onChange={e => updateTier(tier.tier_key, { description: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>기능 목록 (한 줄에 하나씩)</label>
            <textarea
              rows={6}
              value={Array.isArray(tier.features) ? tier.features.join('\n') : (tier.features || '')}
              onChange={e => updateTier(tier.tier_key, { features: e.target.value.split('\n').filter(Boolean) })}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: FONT, lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!tier.highlighted}
                onChange={e => updateTier(tier.tier_key, { highlighted: e.target.checked })} />
              인기 플랜 배지
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!tier.is_public}
                onChange={e => updateTier(tier.tier_key, { is_public: e.target.checked })} />
              랜딩에 공개
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!tier.is_active}
                onChange={e => updateTier(tier.tier_key, { is_active: e.target.checked })} />
              활성 (신규 가입 허용)
            </label>
          </div>
        </div>
      ))}

      {/* AI 기능별 단가 */}
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '32px 0 12px', color: 'var(--foreground)' }}>
        AI 기능별 크레딧 단가
      </h2>

      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                {['기능 키', '표시명', '크레딧', '모델', '설명', '활성', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--muted-foreground)', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={f.feature_key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-foreground)' }}>{f.feature_key}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <input
                      value={f.display_name || ''}
                      onChange={e => setFeatures(features.map((x, j) => j === i ? { ...x, display_name: e.target.value } : x))}
                      style={{ ...inputStyle, padding: '6px 10px' }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', width: 80 }}>
                    <input
                      type="number"
                      value={f.credit_cost ?? 1}
                      onChange={e => setFeatures(features.map((x, j) => j === i ? { ...x, credit_cost: parseInt(e.target.value) || 1 } : x))}
                      style={{ ...inputStyle, padding: '6px 10px' }}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>{f.model || '-'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted-foreground)', maxWidth: 240 }}>{f.description}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <input type="checkbox" checked={!!f.is_active}
                      onChange={e => setFeatures(features.map((x, j) => j === i ? { ...x, is_active: e.target.checked } : x))} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => saveFeatureCost(f)}
                      style={{
                        padding: '6px 12px', background: 'var(--primary)', color: '#fff',
                        border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT,
                      }}>저장</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
