import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import BottomTabBar from '../../components/BottomTabBar';

const EXAM_CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'mock', label: '모의고사', types: ['학력평가 모의고사', '서강인T 자체 모의고사'] },
  { key: 'regular', label: '정규반', types: ['정규반 내신 테스트'] },
  { key: '1mid', label: '1학기 중간', types: ['1학기 중간고사', '1학기 중간 내신 파이널'] },
  { key: '1final', label: '1학기 기말', types: ['1학기 기말고사', '1학기 기말 내신 파이널'] },
  { key: '2mid', label: '2학기 중간', types: ['2학기 중간고사', '2학기 중간 내신 파이널'] },
  { key: '2final', label: '2학기 기말', types: ['2학기 기말고사', '2학기 기말 내신 파이널'] },
];

const CAT_COLORS = {
  mock: '#3b82f6',
  regular: '#f59e0b',
  '1mid': '#8b5cf6',
  '1final': '#06b6d4',
  '2mid': '#10b981',
  '2final': '#ef4444',
};

const CAT_ICONS = {
  mock: '📝',
  regular: '📋',
  '1mid': '🌸',
  '1final': '☀️',
  '2mid': '🍂',
  '2final': '❄️',
};

export default function ScoreView() {
  const [scores, setScores] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [distribution, setDistribution] = useState(null);
  const [showDist, setShowDist] = useState(null);
  const [expandedTrends, setExpandedTrends] = useState({});

  useEffect(() => { api('/scores/my-scores').then(setScores).catch(console.error); }, []);

  const loadDistribution = async (examId) => {
    if (showDist === examId) { setShowDist(null); setDistribution(null); return; }
    setShowDist(examId);
    try { const data = await api(`/scores/exams/${examId}/distribution`); setDistribution(data); }
    catch (e) { console.error(e); }
  };

  // 카테고리별 성적 그룹
  const categories = EXAM_CATEGORIES.filter(c => c.key !== 'all');
  const getCatScores = (cat) => scores.filter(s => cat.types.includes(s.exam_type));

  // 전체 or 특정 카테고리
  const visibleCats = activeCategory === 'all'
    ? categories.filter(c => getCatScores(c).length > 0)
    : categories.filter(c => c.key === activeCategory && getCatScores(c).length > 0);

  // 전체 통계
  const totalExams = scores.length;
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, e) => s + (e.score / (e.max_score || 100)) * 100, 0) / scores.length)
    : 0;

  const generateNormalDistribution = (dist) => {
    if (!dist || dist.totalStudents < 2) return [];
    const { average, highest, lowest, allScores: rawScores, maxScore } = dist;
    const sc = rawScores || [];
    const mean = average;
    const variance = sc.length > 0 ? sc.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sc.length : Math.pow((highest - lowest) / 4, 2);
    const stdDev = Math.sqrt(variance) || 1;
    const points = [];
    const mn = Math.max(0, mean - 3.5 * stdDev);
    const mx = Math.min(maxScore, mean + 3.5 * stdDev);
    const step = (mx - mn) / 50;
    for (let x = mn; x <= mx; x += step) {
      const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
      points.push({ score: Math.round(x * 10) / 10, density: Math.round(y * 10000) / 10000 });
    }
    return points;
  };

  const renderTrendChart = (data, color) => {
    if (data.length < 2) return null;
    const trendData = data.map(s => ({ name: s.exam_name.length > 8 ? s.exam_name.slice(0, 8) + '…' : s.exam_name, 점수: s.score, fullName: s.exam_name }));
    const scoreValues = data.map(s => s.score);
    const minS = Math.min(...scoreValues), maxS = Math.max(...scoreValues);
    const range = maxS - minS;
    const padding = Math.max(range * 0.3, 5);
    const yMin = Math.max(0, Math.floor((minS - padding) / 5) * 5);
    const yMax = Math.min(Math.max(...data.map(s => s.max_score || 100)), Math.ceil((maxS + padding) / 5) * 5);

    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
          <YAxis domain={[yMin, yMax]} stroke="var(--muted-foreground)" fontSize={11} />
          <Tooltip
            formatter={(v) => [`${v}점`, '점수']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
          />
          <Line type="monotone" dataKey="점수" stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const distData = distribution ? Object.entries(distribution.distribution).map(([range, count]) => ({
    range, 학생수: count,
    isMyRange: distribution.myScore !== null && parseInt(range.split('-')[0]) <= distribution.myScore && distribution.myScore <= parseInt(range.split('-')[1])
  })) : [];
  const normalData = distribution ? generateNormalDistribution(distribution) : [];

  return (
    <div className="content">
      <div className="breadcrumb"><Link to="/student">홈</Link> &gt; <span>성적 조회</span></div>

      {/* 요약 카드 */}
      {scores.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', borderRadius: 12, padding: '14px 16px', color: 'white' }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>총 시험 수</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{totalExams}<span style={{ fontSize: 13, fontWeight: 400 }}>회</span></div>
          </div>
          <div style={{ flex: 1, background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 12, padding: '14px 16px', color: 'white' }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>평균 환산 점수</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{avgScore}<span style={{ fontSize: 13, fontWeight: 400 }}>점</span></div>
          </div>
        </div>
      )}

      {/* 카테고리 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        <button
          onClick={() => setActiveCategory('all')}
          style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
            background: activeCategory === 'all' ? 'var(--primary)' : 'var(--muted)',
            color: activeCategory === 'all' ? 'white' : 'var(--foreground)',
          }}>📊 전체</button>
        {categories.map(c => {
          const count = getCatScores(c).length;
          return (
            <button key={c.key} onClick={() => setActiveCategory(c.key)}
              style={{
                padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
                background: activeCategory === c.key ? (CAT_COLORS[c.key] || 'var(--primary)') : 'var(--muted)',
                color: activeCategory === c.key ? 'white' : 'var(--foreground)',
                opacity: count === 0 ? 0.5 : 1,
              }}>
              {CAT_ICONS[c.key] || '📄'} {c.label} {count > 0 && <span style={{ fontSize: 11, opacity: 0.8 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* 카테고리별 성적 카드 */}
      {visibleCats.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>
          등록된 성적이 없습니다.
        </div>
      )}

      {visibleCats.map(cat => {
        const catScores = getCatScores(cat).sort((a, b) => (b.exam_date || '').localeCompare(a.exam_date || ''));
        const color = CAT_COLORS[cat.key] || '#6b7280';
        const icon = CAT_ICONS[cat.key] || '📄';
        const hasTrend = catScores.length >= 2;

        return (
          <div key={cat.key} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10 }}>
            {/* 카테고리 헤더 */}
            <div style={{
              padding: '12px 16px', background: `${color}10`,
              borderBottom: `2px solid ${color}30`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontWeight: 700, fontSize: 15, color }}>{cat.label}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: color, color: 'white', fontWeight: 600,
                }}>{catScores.length}건</span>
              </div>
              {hasTrend && (
                <button onClick={() => setExpandedTrends(p => ({ ...p, [cat.key]: !p[cat.key] }))}
                  style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 6,
                    border: `1px solid ${color}40`, background: expandedTrends[cat.key] ? color : 'transparent',
                    color: expandedTrends[cat.key] ? 'white' : color,
                    cursor: 'pointer', fontWeight: 600,
                  }}>
                  📈 추이 {expandedTrends[cat.key] ? '▲' : '▼'}
                </button>
              )}
            </div>

            {/* 추이 차트 */}
            {expandedTrends[cat.key] && hasTrend && (
              <div style={{ padding: '12px 8px 4px' }}>
                {renderTrendChart(getCatScores(cat).sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || '')), color)}
              </div>
            )}

            {/* 시험 목록 */}
            {catScores.map((s, i) => (
              <div key={`${s.exam_id}-${i}`} style={{
                padding: '10px 16px',
                borderBottom: i < catScores.length - 1 ? '1px solid var(--border)' : 'none',
                background: showDist === s.exam_id ? '#f8fafc' : 'white',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{s.exam_name}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted-foreground)', flexWrap: 'wrap' }}>
                      <span>📅 {s.exam_date || '-'}</span>
                      <span style={{ color: 'var(--muted-foreground)', fontSize: 11, background: 'var(--muted)', padding: '1px 6px', borderRadius: 4 }}>{s.exam_type}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color }}>
                      {s.score}<span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 400 }}>/{s.max_score}</span>
                    </div>
                    {s.rank_num && (
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {s.rank_num}등 / {s.total_students}명
                      </div>
                    )}
                  </div>
                </div>
                {s.note && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, padding: '4px 8px', background: '#f9fafb', borderRadius: 6 }}>
                    💬 {s.note}
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => loadDistribution(s.exam_id)}
                    style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 6,
                      border: '1px solid var(--border)', cursor: 'pointer',
                      background: showDist === s.exam_id ? 'var(--primary)' : 'var(--muted)',
                      color: showDist === s.exam_id ? 'white' : 'var(--foreground)',
                    }}>
                    📊 분포 보기
                  </button>
                </div>

                {/* 분포 차트 - 인라인 */}
                {showDist === s.exam_id && distribution && (
                  <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8, marginBottom: 16 }}>
                      {distribution.myScore !== null && (
                        <div style={{ textAlign: 'center', padding: 8, background: 'white', borderRadius: 8, border: '1px solid #dbeafe' }}>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>내 점수</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{distribution.myScore}</div>
                        </div>
                      )}
                      <div style={{ textAlign: 'center', padding: 8, background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>평균</div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{distribution.average}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 8, background: 'white', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>최고</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{distribution.highest}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 8, background: 'white', borderRadius: 8, border: '1px solid #fecaca' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>최저</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{distribution.lowest}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 8, background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>응시</div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{distribution.totalStudents}명</div>
                      </div>
                    </div>

                    {normalData.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#374151' }}>표준분포</div>
                        <ResponsiveContainer width="100%" height={180}>
                          <AreaChart data={normalData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="score" fontSize={10} stroke="var(--muted-foreground)" />
                            <YAxis hide />
                            <Tooltip formatter={(v, n) => n === 'density' ? [v, '밀도'] : [v, n]} labelFormatter={(v) => `${v}점`}
                              contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                            <Area type="monotone" dataKey="density" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
                            {distribution.myScore !== null && (
                              <ReferenceLine x={distribution.myScore} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5"
                                label={{ value: `나 ${distribution.myScore}`, fill: '#ef4444', fontSize: 11, position: 'top' }} />
                            )}
                            <ReferenceLine x={distribution.average} stroke="#6b7280" strokeWidth={1.5} strokeDasharray="3 3"
                              label={{ value: `평균 ${distribution.average}`, fill: '#6b7280', fontSize: 10, position: 'insideTopRight' }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#374151' }}>구간별 인원</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={distData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="range" fontSize={10} stroke="var(--muted-foreground)" />
                        <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={10} />
                        <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="학생수" radius={[4, 4, 0, 0]}>
                          {distData.map((entry, index) => (<Cell key={index} fill={entry.isMyRange ? '#ef4444' : color} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      <BottomTabBar />
    </div>
  );
}
