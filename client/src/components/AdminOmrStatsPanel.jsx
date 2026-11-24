import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';

const CHOICE_SYMBOLS = ['', '①', '②', '③', '④', '⑤'];
const FONT_D = "var(--font-display, 'Paperlogy', 'KoPub Dotum', sans-serif)";
const FONT_B = "var(--font-body, 'KoPub Dotum', 'Paperlogy', sans-serif)";

const P = {
  navy: '#102044',
  navySub: '#1E3159',
  surface: '#F8F9FB',
  headerBg: '#F4F6FA',
  white: '#FFFFFF',
  border: '#DCE2EC',
  borderSoft: '#EAEFF5',
  text: '#1E293B',
  muted: '#64748B',
  mutedLight: '#94A3B8',
  sageText: '#335B48',
  sageFill: '#3D6854',
  sageBg: '#F1F6F3',
  sageBorder: '#CADAD1',
  brickText: '#913E43',
  brickBg: '#FAF3F3',
  brickBorder: '#E0C8CA',
  sandText: '#7F5C24',
  sandFill: '#9B7635',
  sandBg: '#FAF6EE',
  sandBorder: '#E3D5BA',
};

function rateColor(rate) {
  if (rate === null || rate === undefined) return P.muted;
  if (rate >= 70) return P.sageText;
  if (rate >= 40) return P.sandText;
  return P.brickText;
}

function rateBarFill(rate) {
  if (rate >= 70) return P.sageFill;
  if (rate >= 40) return P.sandFill;
  return P.brickText;
}

/**
 * 관리자·조교용 OMR 문항별 정답률 · 선지 분포 · 킬러 문항 · 오답 학생 분석 패널
 * - 화이트 & 딥 네이비 + Paperlogy/KoPub 돋움 + 균일 1px 테두리 (왼쪽 강조선 없음)
 */
export default function AdminOmrStatsPanel({ statsData, examName = '시험', filterSchool = '', filterGrade = '' }) {
  const [basis, setBasis] = useState('first'); // 'first' | 'latest' | 'compare'
  const [showTable, setShowTable] = useState(true);
  const [expandedQ, setExpandedQ] = useState(null);
  const [exporting, setExporting] = useState(false);

  const stats = Array.isArray(statsData?.stats) ? statsData.stats : [];
  if (stats.length === 0) return null;

  const totalRespondents = statsData.totalRespondents ?? statsData.totalSubmissions ?? 0;
  const topWrong = Array.isArray(statsData.topWrongQuestions) ? statsData.topWrongQuestions : [];
  const categorySummary = Array.isArray(statsData.categorySummary) ? statsData.categorySummary : [];
  const numChoices = Number(statsData.choiceCount) || 5;

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const rows = stats.map(st => {
        const cRates = basis === 'latest' ? (st.latestChoiceRates || {}) : (st.firstChoiceRates || {});
        const topW = basis === 'latest' ? st.latestTopWrongChoice : st.firstTopWrongChoice;
        const wrongList = basis === 'latest' ? (st.wrongStudentsLatest || []) : (st.wrongStudentsFirst || []);
        const row = {
          '문항': `${st.questionNum}번`,
          '영역': st.category || '-',
          '정답': CHOICE_SYMBOLS[Number(st.correctAnswer)] || st.correctAnswer,
          '1차 정답률(%)': st.firstCorrectRate,
          '최종 정답률(%)': st.latestCorrectRate,
          '오답 교정률(%)': st.correctionRate !== null && st.correctionRate !== undefined ? st.correctionRate : '-',
          '최다 오답 선지': topW ? `${CHOICE_SYMBOLS[topW.choice] || topW.choice} (${topW.rate}%)` : '-',
          '변별도': st.discrimination !== null && st.discrimination !== undefined ? st.discrimination : '-',
        };
        for (let c = 1; c <= numChoices; c++) {
          row[`${CHOICE_SYMBOLS[c] || c}(%)`] = cRates[String(c)] ?? 0;
        }
        row['오답 학생'] = wrongList.map(w => `${w.name}(${w.choice ? (CHOICE_SYMBOLS[w.choice] || w.choice) : '미기입'})`).join(', ');
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '문항별_정답률');
      const safeName = String(examName).replace(/[\\/:*?"<>|]/g, '_');
      XLSX.writeFile(wb, `OMR_정답률분석_${safeName}.xlsx`);
    } catch (e) {
      console.error('엑셀 내보내기 실패:', e);
    } finally {
      setExporting(false);
    }
  };

  const toggleExpandQ = (qNum) => {
    setShowTable(true);
    setExpandedQ(prev => (prev === qNum ? null : qNum));
  };

  return (
    <div style={{
      fontFamily: FONT_B,
      marginBottom: 16,
      borderRadius: 10,
      border: `1px solid ${P.border}`,
      background: P.surface,
      overflow: 'hidden',
    }}>
      {/* 헤더 바 */}
      <div style={{
        padding: '10px 14px',
        background: P.headerBg,
        borderBottom: `1px solid ${P.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONT_D, fontSize: 13.5, fontWeight: 700, color: P.navy }}>
            문항별 정답률 · 선지 분포 분석
          </span>
          <span style={{
            fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
            padding: '2px 8px', borderRadius: 4,
            background: P.white, color: P.navySub, border: `1px solid ${P.border}`,
          }}>
            응시 {totalRespondents}명
            {(filterSchool || filterGrade) ? ` (${[filterSchool, filterGrade].filter(Boolean).join(' ')})` : ''}
          </span>
          {statsData.averageFirstScore !== null && statsData.averageFirstScore !== undefined && (
            <span style={{ fontFamily: FONT_D, fontSize: 11.5, color: P.muted }}>
              1차 평균 <strong style={{ color: P.navy }}>{statsData.averageFirstScore}점</strong>
              {statsData.averageLatestScore !== null && statsData.averageLatestScore !== statsData.averageFirstScore && (
                <> &rarr; 최종 평균 <strong style={{ color: P.sageText }}>{statsData.averageLatestScore}점</strong></>
              )}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {[
            { key: 'first', label: '1차 기준 (난이도)' },
            { key: 'latest', label: '최종 기준' },
            { key: 'compare', label: '1차 → 최종 비교' },
          ].map(tab => {
            const active = basis === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setBasis(tab.key)}
                style={{
                  fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                  padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${active ? P.navy : P.border}`,
                  background: active ? P.navy : P.white,
                  color: active ? P.white : P.muted,
                }}
              >
                {tab.label}
              </button>
            );
          })}
          {totalRespondents > 0 && (
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              style={{
                fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${P.border}`, background: P.white, color: P.navy,
              }}
            >
              {exporting ? '생성 중...' : '엑셀 저장'}
            </button>
          )}
        </div>
      </div>

      {totalRespondents === 0 ? (
        <div style={{ padding: '18px 14px', textAlign: 'center', fontSize: 12.5, color: P.muted, background: P.white }}>
          아직 제출된 학생 답안이 없습니다. 학생이나 조교가 답안을 입력하면 문항별 정답률과 오답률 TOP 5가 자동 분석됩니다.
        </div>
      ) : (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 1. 오답률 TOP 5 (수업 해설 우선순위 카드) */}
          {topWrong.length > 0 && (
            <div>
              <div style={{
                fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: P.navy,
                marginBottom: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>오답률 TOP {topWrong.length} (수업 해설 우선순위 · 1차 기준)</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: P.muted }}>클릭하면 오답 학생 명단이 열립니다</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 7 }}>
                {topWrong.map((q, idx) => {
                  const isExp = expandedQ === q.questionNum;
                  const delta = (q.latestCorrectRate ?? 0) - (q.firstCorrectRate ?? 0);
                  return (
                    <button
                      key={q.questionNum}
                      type="button"
                      onClick={() => toggleExpandQ(q.questionNum)}
                      style={{
                        textAlign: 'left',
                        padding: '9px 10px',
                        borderRadius: 8,
                        background: P.white,
                        border: isExp ? `1.5px solid ${P.navy}` : `1px solid ${P.border}`,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{ fontFamily: FONT_D, fontSize: 12.5, fontWeight: 700, color: P.navy }}>
                          {idx + 1}위 · {String(q.questionNum).padStart(2, '0')}번
                        </span>
                        <span style={{
                          fontFamily: FONT_D, fontSize: 11, fontWeight: 700,
                          padding: '1px 6px', borderRadius: 4,
                          background: P.brickBg, color: P.brickText, border: `1px solid ${P.brickBorder}`,
                        }}>
                          정답률 {q.firstCorrectRate}%
                        </span>
                      </div>
                      <div style={{ fontFamily: FONT_D, fontSize: 11.5, color: P.text }}>
                        정답 <strong>{CHOICE_SYMBOLS[Number(q.correctAnswer)] || q.correctAnswer}</strong>
                        {q.firstTopWrongChoice && (
                          <span style={{ color: P.brickText, marginLeft: 6 }}>
                            최다 오답 {CHOICE_SYMBOLS[q.firstTopWrongChoice.choice] || q.firstTopWrongChoice.choice} ({q.firstTopWrongChoice.rate}%)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: P.muted, display: 'flex', justifyContent: 'space-between' }}>
                        <span>최종 {q.latestCorrectRate}%{delta > 0 ? ` (+${delta}%p)` : ''}</span>
                        <span>오답 {q.firstWrongCount}명</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. 영역별 평균 정답률 (영역 태그 설정된 경우) */}
          {categorySummary.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: FONT_D, fontSize: 11.5, fontWeight: 700, color: P.navySub }}>영역별 정답률:</span>
              {categorySummary.map(c => (
                <span key={c.category} style={{
                  fontFamily: FONT_D, fontSize: 11.5, fontWeight: 600,
                  padding: '3px 9px', borderRadius: 6,
                  background: P.white, border: `1px solid ${P.border}`, color: P.text,
                }}>
                  {c.category} ({c.questionCount}) · <strong style={{ color: rateColor(c.avgFirstCorrectRate) }}>{c.avgFirstCorrectRate}%</strong>
                  {c.avgLatestCorrectRate !== c.avgFirstCorrectRate && (
                    <span style={{ color: P.muted }}> &rarr; {c.avgLatestCorrectRate}%</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* 3. 정답률 막대 차트 */}
          <div style={{ background: P.white, borderRadius: 8, border: `1px solid ${P.borderSoft}`, padding: '10px 10px 4px' }}>
            <ResponsiveContainer width="100%" height={156}>
              <BarChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" stroke={P.borderSoft} />
                <XAxis dataKey="questionNum" fontSize={10} stroke={P.muted} tickFormatter={v => `${v}번`} />
                <YAxis domain={[0, 100]} fontSize={10} stroke={P.muted} tickFormatter={v => `${v}%`} width={36} />
                <Tooltip
                  formatter={(v, name) => [`${v}%`, name === 'firstCorrectRate' ? '1차 정답률' : name === 'latestCorrectRate' ? '최종 정답률' : '정답률']}
                  labelFormatter={v => `${v}번 문항`}
                  contentStyle={{ background: P.white, border: `1px solid ${P.border}`, borderRadius: 8, fontSize: 12 }}
                />
                {basis === 'compare' ? (
                  <>
                    <Legend formatter={v => (v === 'firstCorrectRate' ? '1차 정답률' : '최종 정답률')} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="firstCorrectRate" fill={P.navy} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="latestCorrectRate" fill={P.sageFill} radius={[3, 3, 0, 0]} />
                  </>
                ) : (
                  <Bar dataKey={basis === 'latest' ? 'latestCorrectRate' : 'firstCorrectRate'} radius={[3, 3, 0, 0]}>
                    {stats.map((entry, idx) => {
                      const val = basis === 'latest' ? entry.latestCorrectRate : entry.firstCorrectRate;
                      return <Cell key={idx} fill={rateBarFill(val)} />;
                    })}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 4. 문항별 선지 분포 & 오답 학생 상세 테이블 */}
          <div style={{ background: P.white, borderRadius: 8, border: `1px solid ${P.border}`, overflow: 'hidden' }}>
            <div style={{
              padding: '8px 12px', background: P.headerBg, borderBottom: showTable ? `1px solid ${P.border}` : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: FONT_D, fontSize: 12, fontWeight: 700, color: P.navy }}>
                문항별 선지 선택 분포 및 오답 학생 명단
              </span>
              <button
                type="button"
                onClick={() => setShowTable(prev => !prev)}
                style={{
                  fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                  background: 'none', border: 'none', color: P.muted, cursor: 'pointer',
                }}
              >
                {showTable ? '표 접기' : '표 펼치기'}
              </button>
            </div>

            {showTable && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: P.surface, borderBottom: `1px solid ${P.border}`, color: P.muted, fontFamily: FONT_D }}>
                      <th style={{ padding: '7px 8px', textAlign: 'center' }}>문항</th>
                      <th style={{ padding: '7px 6px', textAlign: 'center' }}>정답</th>
                      <th style={{ padding: '7px 6px', textAlign: 'center' }}>1차%</th>
                      <th style={{ padding: '7px 6px', textAlign: 'center' }}>최종%</th>
                      <th style={{ padding: '7px 6px', textAlign: 'center' }}>교정률</th>
                      <th style={{ padding: '7px 8px', textAlign: 'left' }}>선지 분포 ({basis === 'latest' ? '최종' : '1차'})</th>
                      <th style={{ padding: '7px 6px', textAlign: 'center' }}>변별도</th>
                      <th style={{ padding: '7px 8px', textAlign: 'center' }}>오답 학생</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map(st => {
                      const isExp = expandedQ === st.questionNum;
                      const cRates = basis === 'latest' ? (st.latestChoiceRates || {}) : (st.firstChoiceRates || {});
                      const wrongList = basis === 'latest' ? (st.wrongStudentsLatest || []) : (st.wrongStudentsFirst || []);
                      const topWrongChoice = basis === 'latest' ? st.latestTopWrongChoice?.choice : st.firstTopWrongChoice?.choice;

                      return (
                        <tr key={st.questionNum} style={{ borderBottom: `1px solid ${P.borderSoft}` }}>
                          <td colSpan={8} style={{ padding: 0 }}>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '54px 44px 52px 52px 54px minmax(180px, 1fr) 54px 78px',
                              alignItems: 'center',
                              background: isExp ? P.headerBg : P.white,
                            }}>
                              <div style={{ padding: '7px 8px', textAlign: 'center', fontFamily: FONT_D, fontWeight: 700, color: P.navy }}>
                                {String(st.questionNum).padStart(2, '0')}
                                {st.category && <div style={{ fontSize: 9.5, fontWeight: 500, color: P.muted }}>{st.category}</div>}
                              </div>
                              <div style={{ padding: '7px 6px', textAlign: 'center', fontFamily: FONT_D, fontWeight: 700, color: P.navy }}>
                                {CHOICE_SYMBOLS[Number(st.correctAnswer)] || st.correctAnswer}
                              </div>
                              <div style={{ padding: '7px 6px', textAlign: 'center', fontFamily: FONT_D, fontWeight: 700, color: rateColor(st.firstCorrectRate), fontVariantNumeric: 'tabular-nums' }}>
                                {st.firstCorrectRate}%
                              </div>
                              <div style={{ padding: '7px 6px', textAlign: 'center', fontFamily: FONT_D, fontWeight: 600, color: rateColor(st.latestCorrectRate), fontVariantNumeric: 'tabular-nums' }}>
                                {st.latestCorrectRate}%
                              </div>
                              <div style={{ padding: '7px 6px', textAlign: 'center', fontFamily: FONT_D, color: P.muted, fontVariantNumeric: 'tabular-nums' }}>
                                {st.correctionRate !== null && st.correctionRate !== undefined ? `${st.correctionRate}%` : '-'}
                              </div>
                              <div style={{ padding: '7px 8px', display: 'flex', gap: 5, flexWrap: 'wrap', fontFamily: FONT_D, fontSize: 11 }}>
                                {Array.from({ length: numChoices }, (_, i) => i + 1).map(c => {
                                  const r = cRates[String(c)] ?? 0;
                                  const isAns = String(c) === String(st.correctAnswer);
                                  const isTopW = topWrongChoice === c && !isAns;
                                  return (
                                    <span key={c} style={{
                                      padding: '1px 5px', borderRadius: 4,
                                      background: isAns ? P.sageBg : isTopW ? P.brickBg : P.surface,
                                      color: isAns ? P.sageText : isTopW ? P.brickText : P.muted,
                                      border: `1px solid ${isAns ? P.sageBorder : isTopW ? P.brickBorder : P.borderSoft}`,
                                      fontWeight: isAns || isTopW ? 700 : 500,
                                      fontVariantNumeric: 'tabular-nums',
                                    }}>
                                      {CHOICE_SYMBOLS[c] || c} {r}%
                                    </span>
                                  );
                                })}
                              </div>
                              <div style={{ padding: '7px 6px', textAlign: 'center', fontFamily: FONT_D, color: P.muted, fontVariantNumeric: 'tabular-nums' }}>
                                {st.discrimination !== null && st.discrimination !== undefined ? st.discrimination.toFixed(2) : '-'}
                              </div>
                              <div style={{ padding: '7px 8px', textAlign: 'center' }}>
                                {wrongList.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedQ(isExp ? null : st.questionNum)}
                                    style={{
                                      fontFamily: FONT_D, fontSize: 11, fontWeight: 600,
                                      padding: '2px 7px', borderRadius: 5, cursor: 'pointer',
                                      border: `1px solid ${isExp ? P.navy : P.brickBorder}`,
                                      background: isExp ? P.navy : P.brickBg,
                                      color: isExp ? P.white : P.brickText,
                                    }}
                                  >
                                    {wrongList.length}명 {isExp ? '▲' : '▼'}
                                  </button>
                                ) : (
                                  <span style={{ fontFamily: FONT_D, fontSize: 11, color: P.sageText }}>0명</span>
                                )}
                              </div>
                            </div>

                            {isExp && wrongList.length > 0 && (
                              <div style={{
                                padding: '8px 12px',
                                background: P.surface,
                                borderTop: `1px solid ${P.borderSoft}`,
                                display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
                              }}>
                                <span style={{ fontFamily: FONT_D, fontSize: 11, fontWeight: 700, color: P.navySub, marginRight: 4 }}>
                                  {st.questionNum}번 오답 ({basis === 'latest' ? '최종' : '1차'} · {wrongList.length}명):
                                </span>
                                {wrongList.map(w => (
                                  <span key={w.studentId} style={{
                                    fontFamily: FONT_D, fontSize: 11,
                                    padding: '2px 7px', borderRadius: 5,
                                    background: P.white, border: `1px solid ${P.border}`, color: P.text,
                                  }}>
                                    {w.name}
                                    <span style={{ color: P.brickText, fontWeight: 700, marginLeft: 4 }}>
                                      {w.choice ? (CHOICE_SYMBOLS[Number(w.choice)] || w.choice) : '미기입'}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
