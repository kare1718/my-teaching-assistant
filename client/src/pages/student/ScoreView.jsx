import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getUser } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { SkeletonPage, ErrorState, EmptyState } from '../../components/StudentStates';
import BottomTabBar from '../../components/BottomTabBar';
import { useMyScores, useStudentsList, useDistribution, useOmrSubmission } from '../../hooks/queries/useScores';

const DEFAULT_CAT_COLORS = [
  'oklch(30% 0.08 260)', 'var(--warning)', 'oklch(55% 0.20 290)',
  'oklch(62% 0.16 200)', 'oklch(58% 0.14 160)', 'var(--destructive)',
  'oklch(50% 0.16 30)', 'oklch(45% 0.12 120)',
];

const DEFAULT_CAT_ICONS = ['📝', '📋', '🌸', '☀️', '🍂', '❄️', '📚', '✏️'];

export default function ScoreView() {
  const { config } = useTenantConfig();
  const [activeCategory, setActiveCategory] = useState('all');
  const [showDist, setShowDist] = useState(null);
  const [expandedTrends, setExpandedTrends] = useState({});
  const [selectedOmrExamId, setSelectedOmrExamId] = useState(null);

  const EXAM_CATEGORIES = useMemo(() => {
    const cats = (config.examTypes || []).map((c, i) => ({
      key: c.key || `cat_${i}`,
      label: c.label || c.key,
      types: c.types || [],
    }));
    return [{ key: 'all', label: '전체' }, ...cats];
  }, [config.examTypes]);

  const CAT_COLORS = useMemo(() => {
    const map = {};
    (config.examTypes || []).forEach((c, i) => {
      map[c.key || `cat_${i}`] = DEFAULT_CAT_COLORS[i % DEFAULT_CAT_COLORS.length];
    });
    return map;
  }, [config.examTypes]);

  const CAT_ICONS = useMemo(() => {
    const map = {};
    (config.examTypes || []).forEach((c, i) => {
      map[c.key || `cat_${i}`] = DEFAULT_CAT_ICONS[i % DEFAULT_CAT_ICONS.length];
    });
    return map;
  }, [config.examTypes]);

  const user = getUser();
  const isStaff = user?.role === 'admin' || user?.school === '조교' || user?.school === '선생님';
  const [selectedStudent, setSelectedStudent] = useState('');
  const [filterSchool, setFilterSchool] = useState('');

  const { data: scores = [], isLoading: loading, error: scoresError } = useMyScores(selectedStudent);
  const { data: studentsList = [] } = useStudentsList(isStaff);
  const { data: distribution = null } = useDistribution(showDist);
  const { data: omrData = null, isLoading: omrLoading } = useOmrSubmission(selectedOmrExamId, selectedStudent);
  const loadError = scoresError?.message || '';

  const staffSchools = [...new Set(studentsList.map(s => s.school))].sort();
  const filteredStudents = filterSchool
    ? studentsList.filter(s => s.school === filterSchool)
    : studentsList;

  const loadDistribution = (examId) => {
    setShowDist(prev => prev === examId ? null : examId);
  };

  const loadOmrData = (examId) => {
    setSelectedOmrExamId(prev => prev === examId ? null : examId);
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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--warm-200)" />
          <XAxis dataKey="name" fontSize={11} stroke="var(--warm-500)" />
          <YAxis domain={[yMin, yMax]} stroke="var(--warm-500)" fontSize={11} />
          <Tooltip
            formatter={(v) => [`${v}점`, '점수']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--warm-200)', borderRadius: 'var(--radius)', fontSize: 'var(--text-sm)' }}
          />
          <Line type="monotone" dataKey="점수" stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const distData = distribution?.distribution ? Object.entries(distribution.distribution).map(([range, count]) => ({
    range, 학생수: count,
    isMyRange: distribution.myScore !== null && parseInt(range.split('-')[0]) <= distribution.myScore && distribution.myScore <= parseInt(range.split('-')[1])
  })) : [];
  const normalData = distribution ? generateNormalDistribution(distribution) : [];

  if (loading) {
    return (
      <div className="content s-page">
        <SkeletonPage />
        <BottomTabBar />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="content s-page">
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="content s-page">
      {/* 관리자/조교: 학생 선택 */}
      {isStaff && studentsList.length > 0 && (
        <div className="s-card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterSchool} onChange={e => { setFilterSchool(e.target.value); setSelectedStudent(''); }}
              style={{ padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)', fontSize: 'var(--text-sm)' }}>
              <option value="">전체 학교</option>
              {staffSchools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)', fontSize: 'var(--text-sm)' }}>
              <option value="">내 성적</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.school} {s.grade})</option>
              ))}
            </select>
          </div>
          {selectedStudent && (
            <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--accent)', fontWeight: 600 }}>
              {filteredStudents.find(s => s.id === parseInt(selectedStudent))?.name || ''}의 성적을 조회 중
            </div>
          )}
        </div>
      )}

      {/* 요약 카드 */}
      {scores.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <div style={{ flex: 1, background: 'linear-gradient(135deg, var(--accent), var(--accent-lighter))', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', color: 'white' }}>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>총 시험 수</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{totalExams}<span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>회</span></div>
          </div>
          <div style={{ flex: 1, background: 'linear-gradient(135deg, var(--success), var(--success))', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', color: 'white' }}>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>평균 환산 점수</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{avgScore}<span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>점</span></div>
          </div>
        </div>
      )}

      {/* 카테고리 탭 */}
      <div className="s-tab-pills" style={{ overflowX: 'auto' }}>
        {EXAM_CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setActiveCategory(c.key)}
            className={`s-tab-pill${activeCategory === c.key ? ' active' : ''}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* 카테고리별 성적 카드 */}
      {visibleCats.length === 0 && (
        <EmptyState message="등록된 성적이 없습니다." />
      )}

      {visibleCats.map(cat => {
        const catScores = getCatScores(cat).sort((a, b) => (b.exam_date || '').localeCompare(a.exam_date || ''));
        const color = CAT_COLORS[cat.key] || 'var(--neutral-500)';
        const icon = CAT_ICONS[cat.key] || '📄';
        const hasTrend = catScores.length >= 2;

        return (
          <div key={cat.key} className="s-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
            {/* 카테고리 헤더 */}
            <div style={{
              padding: 'var(--space-3) var(--space-4)', background: `${color}10`,
              borderBottom: `2px solid ${color}30`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-lg)' }}>{icon}</span>
                <span className="s-section-title" style={{ color }}>{cat.label}</span>
                <span style={{
                  fontSize: 'var(--text-xs)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)',
                  background: color, color: 'white', fontWeight: 600,
                }}>{catScores.length}건</span>
              </div>
              {hasTrend && (
                <button onClick={() => setExpandedTrends(p => ({ ...p, [cat.key]: !p[cat.key] }))}
                  style={{
                    fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)',
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
              <div style={{ padding: 'var(--space-3) var(--space-2) var(--space-1)' }}>
                {renderTrendChart(getCatScores(cat).sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || '')), color)}
              </div>
            )}

            {/* 시험 목록 */}
            {catScores.map((s, i) => (
              <div key={`${s.exam_id}-${i}`} style={{
                padding: 'var(--space-2) var(--space-4)',
                borderBottom: i < catScores.length - 1 ? '1px solid var(--warm-200)' : 'none',
                background: showDist === s.exam_id ? 'var(--warm-50)' : 'var(--card)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 3 }}>{s.exam_name}</div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--warm-500)', flexWrap: 'wrap' }}>
                      <span>📅 {s.exam_date || '-'}</span>
                      <span style={{ color: 'var(--warm-500)', fontSize: 'var(--text-xs)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>{s.exam_type}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color }}>
                      {s.score}<span style={{ fontSize: 'var(--text-sm)', color: 'var(--warm-500)', fontWeight: 400 }}>/{s.max_score}</span>
                    </div>
                    {s.rank_num && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warm-500)' }}>
                        {s.rank_num}등 / {s.total_students}명
                      </div>
                    )}
                    {s.rank_num && s.total_students && (() => {
                      const isNaesin = s.exam_name && (s.exam_name.includes('내신') || s.exam_name.includes('중간') || s.exam_name.includes('기말'));
                      const pctile = (s.rank_num / s.total_students) * 100;
                      if (isNaesin) {
                        // 내신 5등급 상대평가: 10%/24%/32%/24%/10% (누적 10/34/66/90/100%)
                        const g = pctile <= 10 ? 1 : pctile <= 34 ? 2 : pctile <= 66 ? 3 : pctile <= 90 ? 4 : 5;
                        const gc = g === 1 ? 'var(--success)' : g === 2 ? 'var(--accent)' : g === 3 ? 'var(--warning)' : g === 4 ? 'var(--destructive)' : 'oklch(35% 0.15 25)';
                        return <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: gc }}>{g}등급</div>;
                      }
                      // 학력평가 9등급 상대평가
                      const g = pctile <= 4 ? 1 : pctile <= 11 ? 2 : pctile <= 23 ? 3 : pctile <= 40 ? 4 : pctile <= 60 ? 5 : pctile <= 77 ? 6 : pctile <= 89 ? 7 : pctile <= 96 ? 8 : 9;
                      const gc = g <= 2 ? 'var(--success)' : g <= 4 ? 'var(--accent)' : g <= 6 ? 'var(--warning)' : 'var(--destructive)';
                      return <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: gc }}>{g}등급</div>;
                    })()}
                  </div>
                </div>
                {s.note && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warm-500)', marginTop: 'var(--space-1)', padding: 'var(--space-1) var(--space-2)', background: 'var(--warm-50)', borderRadius: 'var(--radius-sm)' }}>
                    💬 {s.note}
                  </div>
                )}
                <div style={{ marginTop: 'var(--space-1)', display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                  <button onClick={() => loadDistribution(s.exam_id)}
                    style={{
                      fontSize: 'var(--text-xs)', padding: '3px var(--space-2)', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--warm-200)', cursor: 'pointer',
                      background: showDist === s.exam_id ? 'var(--accent)' : 'var(--warm-100)',
                      color: showDist === s.exam_id ? 'white' : 'var(--warm-800)',
                    }}>
                    📊 분포 보기
                  </button>
                  {s.has_answer_key === 1 && s.has_submission === 1 && (
                    <button onClick={() => loadOmrData(s.exam_id)}
                      style={{
                        fontSize: 'var(--text-xs)', padding: '3px var(--space-2)', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--warm-200)', cursor: 'pointer',
                        background: selectedOmrExamId === s.exam_id ? 'var(--accent)' : 'var(--warm-100)',
                        color: selectedOmrExamId === s.exam_id ? 'white' : 'var(--warm-800)',
                      }}>
                      {omrLoading && selectedOmrExamId === s.exam_id ? '...' : '📝 답안 확인'}
                    </button>
                  )}
                </div>

                {/* 분포 차트 - 인라인 */}
                {showDist === s.exam_id && distribution && (
                  <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--warm-50)', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                      {distribution.myScore !== null && (
                        <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--accent-lighter)' }}>
                          <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>내 점수</div>
                          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--accent)' }}>{distribution.myScore}</div>
                        </div>
                      )}
                      <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)' }}>
                        <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>평균</div>
                        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{distribution.average}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--success-light)' }}>
                        <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>최고</div>
                        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--success)' }}>{distribution.highest}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--destructive-light)' }}>
                        <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>최저</div>
                        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--destructive)' }}>{distribution.lowest}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: 'var(--space-2)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)' }}>
                        <div style={{ fontSize: 10, color: 'var(--warm-500)' }}>응시</div>
                        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{distribution.totalStudents}명</div>
                      </div>
                    </div>

                    {normalData.length > 0 && (
                      <div style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="s-section-title" style={{ marginBottom: 'var(--space-1)' }}>표준분포</div>
                        <ResponsiveContainer width="100%" height={180}>
                          <AreaChart data={normalData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--warm-200)" />
                            <XAxis dataKey="score" fontSize={10} stroke="var(--warm-500)" />
                            <YAxis hide />
                            <Tooltip formatter={(v, n) => n === 'density' ? [v, '밀도'] : [v, n]} labelFormatter={(v) => `${v}점`}
                              contentStyle={{ background: 'var(--card)', border: '1px solid var(--warm-200)', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)' }} />
                            <Area type="monotone" dataKey="density" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
                            {distribution.myScore !== null && (
                              <ReferenceLine x={distribution.myScore} stroke="var(--destructive)" strokeWidth={2} strokeDasharray="5 5"
                                label={{ value: `나 ${distribution.myScore}`, fill: 'var(--destructive)', fontSize: 11, position: 'top' }} />
                            )}
                            <ReferenceLine x={distribution.average} stroke="var(--warm-500)" strokeWidth={1.5} strokeDasharray="3 3"
                              label={{ value: `평균 ${distribution.average}`, fill: 'var(--warm-500)', fontSize: 10, position: 'insideTopRight' }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="s-section-title" style={{ marginBottom: 'var(--space-1)' }}>구간별 인원</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={distData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--warm-200)" />
                        <XAxis dataKey="range" fontSize={10} stroke="var(--warm-500)" />
                        <YAxis allowDecimals={false} stroke="var(--warm-500)" fontSize={10} />
                        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--warm-200)', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)' }} />
                        <Bar dataKey="학생수" radius={[4, 4, 0, 0]}>
                          {distData.map((entry, index) => (<Cell key={index} fill={entry.isMyRange ? 'var(--destructive)' : color} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* 동점자 표시 */}
                    {distribution.studentScores && (() => {
                      const byScore = {};
                      distribution.studentScores.forEach(st => {
                        if (!byScore[st.score]) byScore[st.score] = [];
                        byScore[st.score].push(st);
                      });
                      const ties = Object.entries(byScore).filter(([, arr]) => arr.length > 1).sort((a, b) => b[0] - a[0]);
                      if (ties.length === 0) return null;
                      return (
                        <div style={{ marginTop: 'var(--space-2)' }}>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--warm-500)', marginBottom: 'var(--space-1)' }}>동점자 현황</div>
                          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                            {ties.map(([score, arr]) => (
                              <span key={score} style={{
                                fontSize: 'var(--text-xs)', padding: '3px var(--space-2)', borderRadius: 'var(--radius)',
                                background: distribution.myScore === parseInt(score) ? 'var(--destructive-light)' : 'var(--warm-100)',
                                border: distribution.myScore === parseInt(score) ? '1px solid var(--destructive-light)' : '1px solid var(--warm-200)',
                              }}>
                                <strong>{score}점</strong> {arr.length}명
                                {distribution.myScore === parseInt(score) && <span style={{ color: 'var(--destructive)', marginLeft: 2 }}>(나)</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* OMR 답안 확인 */}
                {selectedOmrExamId === s.exam_id && !omrLoading && omrData && omrData.submission && omrData.answerKey && (() => {
                  const studentAnswers = omrData.submission.answers || [];
                  const answerKeyData = omrData.answerKey.answer_key || omrData.answerKey;
                  const questionCount = (Array.isArray(answerKeyData) ? answerKeyData.length : omrData.answerKey.question_count) || studentAnswers.length;
                  const correctAnswers = Array.isArray(answerKeyData) ? answerKeyData : [];

                  let correctCount = 0;
                  const results = [];
                  for (let i = 0; i < questionCount; i++) {
                    const studentAns = studentAnswers[i] !== undefined ? studentAnswers[i] : '-';
                    const correctAns = correctAnswers[i] !== undefined ? correctAnswers[i] : '-';
                    const isCorrect = String(studentAns) === String(correctAns);
                    if (isCorrect) correctCount++;
                    results.push({ num: i + 1, student: studentAns, correct: correctAns, isCorrect });
                  }
                  const percentage = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;

                  return (
                    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--warm-50)', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)' }}>
                      {/* 요약 */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--warm-200)',
                      }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                          정답 <span style={{ color: 'var(--accent)', fontSize: 'var(--text-lg)' }}>{correctCount}</span>
                          <span style={{ color: 'var(--warm-500)' }}>/{questionCount}</span>
                          <span style={{ marginLeft: 'var(--space-2)', color: percentage >= 80 ? 'var(--success)' : percentage >= 50 ? 'var(--warning)' : 'var(--destructive)', fontWeight: 800 }}>
                            ({percentage}%)
                          </span>
                        </div>
                        {/* 간이 바 */}
                        <div style={{ width: 100, height: 8, background: 'var(--warm-200)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${percentage}%`, height: '100%', borderRadius: 4,
                            background: percentage >= 80 ? 'var(--success)' : percentage >= 50 ? 'var(--warning)' : 'var(--destructive)',
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>

                      {/* 답안 그리드 */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
                        gap: 3,
                      }}>
                        {results.map(r => (
                          <div key={r.num} style={{
                            textAlign: 'center', padding: '4px 2px', borderRadius: 'var(--radius-sm)',
                            background: r.isCorrect ? 'oklch(0.95 0.05 160)' : 'oklch(0.95 0.05 25)',
                            border: `1px solid ${r.isCorrect ? 'oklch(0.8 0.1 160)' : 'oklch(0.8 0.1 25)'}`,
                            position: 'relative',
                          }}>
                            <div style={{ fontSize: 10, color: 'var(--warm-500)', fontWeight: 600, lineHeight: 1.2 }}>{r.num}</div>
                            <div style={{
                              fontSize: 'var(--text-sm)', fontWeight: 800, lineHeight: 1.3,
                              color: r.isCorrect ? 'oklch(0.45 0.15 160)' : 'oklch(0.45 0.15 25)',
                            }}>
                              {r.student}
                            </div>
                            {!r.isCorrect && (
                              <div style={{ fontSize: 9, color: 'oklch(0.5 0.1 160)', lineHeight: 1.2 }}>
                                {r.correct}
                              </div>
                            )}
                            <div style={{
                              position: 'absolute', top: 1, right: 3, fontSize: 9, fontWeight: 900,
                              color: r.isCorrect ? 'oklch(0.5 0.15 250)' : 'oklch(0.5 0.2 25)',
                            }}>
                              {r.isCorrect ? 'O' : 'X'}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 문항별 정답률 바 */}
                      <div style={{ marginTop: 'var(--space-3)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--warm-500)', marginBottom: 'var(--space-1)' }}>문항별 결과</div>
                        <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 32 }}>
                          {results.map(r => (
                            <div key={r.num} style={{
                              flex: 1, minWidth: 2, maxWidth: 12,
                              height: r.isCorrect ? 32 : 10,
                              background: r.isCorrect ? 'oklch(0.6 0.15 250)' : 'oklch(0.65 0.2 25)',
                              borderRadius: '2px 2px 0 0',
                              transition: 'height 0.3s ease',
                            }}
                              title={`${r.num}번: ${r.isCorrect ? 'O' : 'X'} (내 답: ${r.student}, 정답: ${r.correct})`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* OMR 데이터 없음 */}
                {selectedOmrExamId === s.exam_id && !omrLoading && (!omrData || !omrData.submission) && (
                  <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--warm-50)', borderRadius: 'var(--radius)', fontSize: 'var(--text-xs)', color: 'var(--warm-500)' }}>
                    답안 데이터를 찾을 수 없습니다.
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
