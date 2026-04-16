import { useState, useEffect } from 'react';
import { api } from '../../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";
const PRIMARY = 'var(--primary)';
const ACCENT = 'var(--cta)';
const SURFACE = '#f8f9fa';

const TIER_LABELS = {
  free: 'Free', trial: 'Free', starter: 'Starter', basic: 'Starter',
  pro: 'Pro', standard: 'Pro', first_class: 'First Class', enterprise: 'First Class',
};
const TIER_COLORS = {
  free: '#94a3b8', trial: '#94a3b8', starter: '#3b82f6', basic: '#3b82f6',
  pro: '#7c3aed', standard: '#7c3aed', first_class: '#f59e0b', enterprise: '#f59e0b',
};

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '-';
  if (seconds < 60) return `${seconds}초`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return `${min}분${sec > 0 ? ' ' + sec + '초' : ''}`;
  const hr = Math.floor(min / 60);
  return `${hr}시간 ${min % 60}분`;
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateFull(d) {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const ROLE_LABELS = { admin: '관리자', student: '학생', parent: '보호자', assistant: '조교', superadmin: '슈퍼관리자' };

// --- 컴포넌트 ---

function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 13, color: '#64748b', fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color: accent || PRIMARY, fontFamily: FONT }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: FONT }}>{sub}</span>}
    </div>
  );
}

function CssBarChart({ data, labelKey, valueKey, maxValue, color, formatValue }) {
  if (!data?.length) return <div style={{ color: '#94a3b8', fontSize: 13, padding: 16 }}>데이터 없음</div>;
  const max = maxValue || Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ minWidth: 80, fontSize: 13, color: '#475569', fontFamily: FONT, textAlign: 'right' }}>
            {item[labelKey]}
          </span>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max((item[valueKey] / max) * 100, 2)}%`,
              height: '100%', background: color || ACCENT, borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ minWidth: 60, fontSize: 13, color: '#64748b', fontFamily: FONT }}>
            {formatValue ? formatValue(item[valueKey]) : item[valueKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ data }) {
  if (!data?.length) return <div style={{ color: '#94a3b8', fontSize: 13, padding: 16 }}>데이터 없음</div>;
  const maxPv = Math.max(...data.map(d => d.page_views || 0), 1);
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, minWidth: data.length * 24, height: 160, padding: '0 4px' }}>
        {data.map((d, i) => {
          const h = Math.max((d.page_views / maxPv) * 140, 4);
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 20 }}
              title={`${d.date}: ${d.page_views} PV / ${d.unique_users}명`}>
              <div style={{
                width: '80%', height: h, background: ACCENT, borderRadius: '4px 4px 0 0',
                opacity: 0.8, transition: 'height 0.3s',
              }} />
              <span style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, fontFamily: FONT }}>
                {formatDate(d.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- 학원 상세 모달 ---
function AcademyDetailModal({ academyId, academyName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!academyId) return;
    setLoading(true);
    api(`/superadmin/analytics/academy/${academyId}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [academyId]);

  const topFeature = data?.feature_usage?.[0]?.feature_name || '-';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      paddingTop: 60, overflowY: 'auto',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '90%', maxWidth: 900,
        maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 32,
      }} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: PRIMARY, margin: 0 }}>
            {academyName} - 사용 현황
          </h2>
          <button onClick={onClose} style={{
            border: 'none', background: '#f1f5f9', borderRadius: 8, padding: '8px 12px',
            cursor: 'pointer', fontSize: 14, color: '#64748b',
          }}>닫기</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>불러오는 중...</div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>데이터를 불러올 수 없습니다.</div>
        ) : (
          <>
            {/* KPI 카드 4개 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
              <KpiCard label="총 접속 누계" value={data.total_logins?.toLocaleString()} sub={`전체 사용자 ${data.total_users}명`} />
              <KpiCard label="접속률 (7일)" value={`${data.access_rate}%`} sub={`${data.active_users_7d} / ${data.total_users}명`} accent={data.access_rate >= 50 ? '#16a34a' : data.access_rate >= 20 ? '#f59e0b' : '#ef4444'} />
              <KpiCard label="평균 체류시간" value={formatDuration(data.feature_usage?.reduce((s, f) => s + (f.avg_duration || 0), 0) / Math.max(data.feature_usage?.length || 1, 1))} />
              <KpiCard label="최다 사용 기능" value={topFeature} accent={ACCENT} />
            </div>

            {/* 일별 접속 추이 */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>
                일별 접속 추이 (최근 30일)
              </h3>
              <DailyChart data={data.daily_trend} />
            </div>

            {/* 기능별 사용 현황 */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>
                기능별 사용 현황 (Top 10)
              </h3>
              <CssBarChart data={data.feature_usage} labelKey="feature_name" valueKey="view_count" color={ACCENT} />
            </div>

            {/* 사용자별 활동 */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20 }}>
              <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: PRIMARY, margin: '0 0 16px' }}>
                사용자별 활동 (Top 10)
              </h3>
              {data.user_activity?.length ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FONT }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>이름</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>역할</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>페이지뷰</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>평균 체류</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>최근 활동</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.user_activity.map((u, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', color: PRIMARY }}>{u.name}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{ROLE_LABELS[u.role] || u.role}</td>
                          <td style={{ padding: '10px 12px', color: PRIMARY, textAlign: 'right', fontWeight: 600 }}>{u.page_views}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b', textAlign: 'right' }}>{formatDuration(u.avg_duration)}</td>
                          <td style={{ padding: '10px 12px', color: '#94a3b8', textAlign: 'right', fontSize: 12 }}>{formatDateFull(u.last_active)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: 16 }}>데이터 없음</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- 메인 페이지 ---
export default function UsageAnalytics() {
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAcademy, setSelectedAcademy] = useState(null);

  useEffect(() => {
    api('/superadmin/analytics/overview')
      .then(setOverview)
      .catch(() => setOverview([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = overview.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.slug?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: PRIMARY, margin: '0 0 6px' }}>사용 현황 분석</h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>학원별 서비스 이용 현황을 한눈에 파악합니다.</p>
      </div>

      {/* 검색 */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="학원명 또는 slug로 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 360, padding: '10px 16px',
            border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14,
            fontFamily: FONT, outline: 'none', background: '#fff',
          }}
        />
      </div>

      {/* 테이블 */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>불러오는 중...</div>
        ) : !filtered.length ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>등록된 학원이 없습니다.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FONT }}>
              <thead>
                <tr style={{ background: SURFACE, borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 600 }}>학원명</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>티어</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>활성 사용자 (7일)</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>접속률</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>페이지뷰 (30일)</th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>평균 체류시간</th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const accessRate = a.total_users > 0 ? Math.round((a.active_users_7d / a.total_users) * 100) : 0;
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedAcademy(a)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: PRIMARY }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.slug}</div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 99,
                          fontSize: 11, fontWeight: 600,
                          background: (TIER_COLORS[a.subscription_tier] || '#94a3b8') + '18',
                          color: TIER_COLORS[a.subscription_tier] || '#94a3b8',
                        }}>
                          {TIER_LABELS[a.subscription_tier] || a.subscription_tier}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600, color: PRIMARY }}>
                        {a.active_users_7d} <span style={{ fontWeight: 400, color: '#94a3b8' }}>/ {a.total_users}</span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 8px' }}>
                        <span style={{
                          fontWeight: 600,
                          color: accessRate >= 50 ? '#16a34a' : accessRate >= 20 ? '#f59e0b' : '#ef4444',
                        }}>{accessRate}%</span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600, color: PRIMARY }}>
                        {(a.page_views_30d || 0).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px 8px', color: '#64748b' }}>
                        {formatDuration(a.avg_duration_30d)}
                      </td>
                      <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                          background: a.is_active ? '#16a34a' : '#ef4444',
                        }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 학원 상세 모달 */}
      {selectedAcademy && (
        <AcademyDetailModal
          academyId={selectedAcademy.id}
          academyName={selectedAcademy.name}
          onClose={() => setSelectedAcademy(null)}
        />
      )}
    </div>
  );
}
