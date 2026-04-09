import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, apiPut } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const TIERS = ['trial', 'basic', 'standard', 'pro', 'enterprise'];
const TIER_LABELS = {
  trial: '체험', basic: '베이직', standard: '스탠다드', pro: '프로', enterprise: '엔터프라이즈',
};

export default function AcademyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = () => {
    api(`/superadmin/academies/${id}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const toggleStatus = async () => {
    const isActive = data.academy.is_active === false || data.academy.is_active === 0;
    try {
      await apiPut(`/superadmin/academies/${id}/status`, { isActive });
      setMsg(isActive ? '학원이 활성화되었습니다.' : '학원이 비활성화되었습니다.');
      load();
    } catch (err) { setMsg(err.message); }
  };

  const changeTier = async (tier) => {
    try {
      await apiPut(`/superadmin/academies/${id}/tier`, { tier });
      setMsg(`티어가 ${TIER_LABELS[tier]}로 변경되었습니다.`);
      load();
    } catch (err) { setMsg(err.message); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT, color: 'var(--muted-foreground)' }}>로딩 중...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', fontFamily: FONT }}>학원을 찾을 수 없습니다.</div>;

  const { academy, stats, subscription } = data;
  const isActive = academy.is_active !== false && academy.is_active !== 0;

  const cardStyle = {
    background: 'var(--card)', borderRadius: 16, padding: '24px 28px',
    border: '1px solid var(--border)',
  };
  const statCard = {
    ...cardStyle, flex: 1, minWidth: 140, textAlign: 'center',
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto', fontFamily: FONT }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => navigate('/superadmin')}
          style={{
            padding: '8px 16px', background: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: 10, cursor: 'pointer', fontSize: 14, fontFamily: FONT, color: 'var(--foreground)',
          }}
        >
          ← 목록
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>{academy.name}</h1>
          <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>{academy.slug}</span>
        </div>
        <span style={{
          padding: '6px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13,
          background: isActive ? '#d1fae5' : '#fee2e2',
          color: isActive ? '#059669' : '#dc2626',
        }}>
          {isActive ? '활성' : '비활성'}
        </span>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 20,
          background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600, fontSize: 14,
        }}>
          {msg}
        </div>
      )}

      {/* 통계 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={statCard}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>학생 수</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>{stats?.students?.count || 0}</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>시험 수</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>{stats?.exams?.count || 0}</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>퀴즈 로그</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>{stats?.quizLogs?.count || 0}</div>
        </div>
      </div>

      {/* 학원 정보 */}
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

      {/* 구독 정보 */}
      {subscription && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--foreground)' }}>구독 정보</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px 16px', fontSize: 14 }}>
            <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>상태</span>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>{subscription.status}</span>
            <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>시작일</span>
            <span>{subscription.start_date ? new Date(subscription.start_date).toLocaleDateString('ko-KR') : '-'}</span>
            <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>종료일</span>
            <span>{subscription.end_date ? new Date(subscription.end_date).toLocaleDateString('ko-KR') : '-'}</span>
          </div>
        </div>
      )}

      {/* 액션 */}
      <div style={{ ...cardStyle }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--foreground)' }}>관리</h3>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 8 }}>티어 변경</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TIERS.map(t => (
              <button
                key={t}
                onClick={() => changeTier(t)}
                disabled={academy.subscription_tier === t}
                style={{
                  padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  fontFamily: FONT, cursor: academy.subscription_tier === t ? 'default' : 'pointer',
                  border: academy.subscription_tier === t ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                  background: academy.subscription_tier === t ? 'var(--primary-light)' : 'var(--card)',
                  color: academy.subscription_tier === t ? 'var(--primary)' : 'var(--foreground)',
                  opacity: academy.subscription_tier === t ? 1 : 0.8,
                }}
              >
                {TIER_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={toggleStatus}
          style={{
            padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700,
            fontFamily: FONT, cursor: 'pointer', border: 'none',
            background: isActive ? '#fee2e2' : '#d1fae5',
            color: isActive ? '#dc2626' : '#059669',
          }}
        >
          {isActive ? '학원 비활성화' : '학원 활성화'}
        </button>
      </div>
    </div>
  );
}
