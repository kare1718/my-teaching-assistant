import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost } from '../../api';

const SUBMIT_OPTIONS = [
  { value: '', label: '-', bg: '#f1f5f9', color: '#64748b' },
  { value: '제출', label: '제출', bg: '#dcfce7', color: '#166534' },
  { value: '미제출', label: '미제출', bg: '#fee2e2', color: '#991b1b' },
  { value: '다시제출', label: '다시', bg: '#fef3c7', color: '#92400e' },
];

const PASS_OPTIONS = [
  { value: '', label: '-', bg: '#f1f5f9', color: '#64748b' },
  { value: '통과', label: '통과', bg: '#dcfce7', color: '#166534' },
  { value: '미통과', label: '미통과', bg: '#fee2e2', color: '#991b1b' },
];

export default function HomeworkManage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [viewMode, setViewMode] = useState('daily'); // daily | history

  // 누적 기록
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // 특별 포인트 모달
  const [bonusModal, setBonusModal] = useState(null);
  const [bonusAmount, setBonusAmount] = useState('50');
  const [bonusReason, setBonusReason] = useState('');

  useEffect(() => {
    api('/homework/classes').then(data => {
      setClasses(data);
      if (data.length > 0) setSelectedClass(data[0].name);
    }).catch(console.error);
  }, []);

  // 일별 학생 로드
  useEffect(() => {
    if (!selectedClass || !date || viewMode !== 'daily') return;
    setLoading(true);
    api(`/homework/class/${encodeURIComponent(selectedClass)}/date/${date}`)
      .then(data => {
        setStudents(data.map(s => ({
          ...s,
          wordTest: s.record?.word_test || '',
          retest: s.record?.retest || '',
          submissionStatus: s.record?.submission_status || '',
          memo: s.record?.memo || '',
          changed: false,
        })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedClass, date, viewMode]);

  // 누적 기록 로드
  useEffect(() => {
    if (!selectedClass || viewMode !== 'history') return;
    setHistLoading(true);
    api(`/homework/history/${encodeURIComponent(selectedClass)}`)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setHistLoading(false));
  }, [selectedClass, viewMode]);

  // 학교+학년 그룹
  const grouped = {};
  students.forEach(s => {
    const key = `${s.school} ${s.grade}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  const update = (studentId, field, value) => {
    setStudents(prev => prev.map(s =>
      s.studentId === studentId ? { ...s, [field]: value, changed: true } : s
    ));
  };

  const cycleStatus = (studentId, field) => {
    const isSubmit = field === 'submissionStatus';
    const isPass = field === 'wordTest' || field === 'retest';
    const opts = isSubmit ? SUBMIT_OPTIONS : isPass ? PASS_OPTIONS : SUBMIT_OPTIONS;
    const cycle = opts.map(o => o.value);
    setStudents(prev => prev.map(s => {
      if (s.studentId !== studentId) return s;
      const idx = cycle.indexOf(s[field] || '');
      return { ...s, [field]: cycle[(idx + 1) % cycle.length], changed: true };
    }));
  };

  const handleSave = async () => {
    const changed = students.filter(s => s.changed);
    if (changed.length === 0) { setMsg('변경 없음'); return; }
    setSaving(true);
    try {
      await apiPost('/homework/bulk-save', {
        className: selectedClass, date,
        records: changed.map(s => ({
          studentId: s.studentId,
          homeworkStatus: '',
          wordTest: s.wordTest,
          retest: s.retest,
          submissionStatus: s.submissionStatus,
          memo: s.memo,
        })),
      });
      setMsg(`${changed.length}건 저장!`);
      setStudents(prev => prev.map(s => ({ ...s, changed: false })));
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('실패: ' + e.message); }
    setSaving(false);
  };

  const handleBonus = async () => {
    if (!bonusModal || !bonusAmount) return;
    try {
      await apiPost('/homework/bonus', {
        studentId: bonusModal.studentId,
        amount: parseInt(bonusAmount),
        reason: bonusReason || '과제 우수',
      });
      setMsg(`${bonusModal.name}에게 ${bonusAmount}pt 지급!`);
      setBonusModal(null); setBonusAmount('50'); setBonusReason('');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('실패: ' + e.message); }
  };

  const StatusBtn = ({ value, onClick, type }) => {
    const opts = type === 'pass' ? PASS_OPTIONS : SUBMIT_OPTIONS;
    const opt = opts.find(o => o.value === (value || '')) || opts[0];
    return (
      <button onClick={onClick} style={{
        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: 12, minWidth: 44, whiteSpace: 'nowrap',
        background: opt.bg, color: opt.color,
      }}>{opt.label}</button>
    );
  };

  // 누적 기록: 날짜별 그룹
  const historyByDate = {};
  history.forEach(r => {
    if (!historyByDate[r.date]) historyByDate[r.date] = [];
    historyByDate[r.date].push(r);
  });
  const sortedDates = Object.keys(historyByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="content">
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20 }}>📝 과제 관리</h2>
      </div>

      {/* 수업 탭 */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 6, paddingBottom: 2 }}>
        {classes.map(c => (
          <button key={c.name} onClick={() => setSelectedClass(c.name)}
            style={{
              flex: '0 0 auto', padding: '8px 14px', borderRadius: 8, border: 'none',
              cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
              background: selectedClass === c.name ? 'var(--primary)' : 'var(--muted)',
              color: selectedClass === c.name ? 'white' : 'var(--foreground)',
            }}>{c.name}</button>
        ))}
      </div>

      {/* 일별/누적 토글 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 8, background: 'var(--muted)', borderRadius: 8, padding: 3 }}>
        <button onClick={() => setViewMode('daily')} style={{
          flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: viewMode === 'daily' ? 'white' : 'transparent',
          color: viewMode === 'daily' ? '#1e293b' : '#94a3b8',
          fontWeight: 700, fontSize: 13,
          boxShadow: viewMode === 'daily' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}>📅 일별 입력</button>
        <button onClick={() => setViewMode('history')} style={{
          flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: viewMode === 'history' ? 'white' : 'transparent',
          color: viewMode === 'history' ? '#1e293b' : '#94a3b8',
          fontWeight: 700, fontSize: 13,
          boxShadow: viewMode === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}>📋 누적 기록</button>
      </div>

      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: msg.includes('실패') ? '#fee2e2' : '#dcfce7',
          color: msg.includes('실패') ? '#991b1b' : '#166534', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {msg}
        </div>
      )}

      {/* === 일별 입력 모드 === */}
      {viewMode === 'daily' && (
        <>
          <div className="card" style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}
              style={{ fontSize: 13, padding: '8px 20px' }}>
              {saving ? '저장중...' : '💾 저장'}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>로딩중...</div>
          ) : (
            Object.entries(grouped).map(([groupKey, groupStudents]) => (
              <div key={groupKey} className="card" style={{ padding: 0, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#f1f5f9', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  🎓 {groupKey} ({groupStudents.length}명)
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={thStyle}>이름</th>
                        <th style={thStyle}>단어</th>
                        <th style={thStyle}>재시험</th>
                        <th style={thStyle}>과제</th>
                        <th style={{ ...thStyle, minWidth: 200 }}>제출 현황</th>
                        <th style={thStyle}>특별 포인트</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStudents.map(s => (
                        <tr key={s.studentId} style={{ borderBottom: '1px solid #f1f5f9', background: s.changed ? '#fefce8' : 'white' }}>
                          <td style={{ ...tdStyle, fontWeight: 600, minWidth: 50 }}>{s.name}</td>
                          <td style={tdStyle}>
                            <StatusBtn value={s.wordTest} onClick={() => cycleStatus(s.studentId, 'wordTest')} type="pass" />
                          </td>
                          <td style={tdStyle}>
                            <StatusBtn value={s.retest} onClick={() => cycleStatus(s.studentId, 'retest')} type="pass" />
                          </td>
                          <td style={tdStyle}>
                            <StatusBtn value={s.submissionStatus} onClick={() => cycleStatus(s.studentId, 'submissionStatus')} type="submit" />
                          </td>
                          <td style={tdStyle}>
                            <textarea value={s.memo} onChange={e => update(s.studentId, 'memo', e.target.value)}
                              placeholder="제출 현황 입력..."
                              rows={2}
                              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                          </td>
                          <td style={tdStyle}>
                            <button onClick={() => setBonusModal({ studentId: s.studentId, name: s.name })}
                              style={{
                                padding: '4px 10px', borderRadius: 6, border: '1px solid #fbbf24',
                                background: '#fffbeb', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#92400e',
                              }}>⭐ 지급</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* === 누적 기록 모드 === */}
      {viewMode === 'history' && (
        <>
          {histLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>로딩중...</div>
          ) : sortedDates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>기록이 없습니다.</div>
          ) : (
            sortedDates.map(dt => {
              const records = historyByDate[dt];
              // 학교+학년별 그룹
              const groups = {};
              records.forEach(r => {
                const k = `${r.school} ${r.grade}`;
                if (!groups[k]) groups[k] = [];
                groups[k].push(r);
              });
              return (
                <div key={dt} className="card" style={{ padding: 0, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', background: '#eff6ff', fontWeight: 700, fontSize: 13, borderBottom: '1px solid #bfdbfe', color: '#1e40af' }}>
                    📅 {dt} ({records.length}명)
                  </div>
                  {Object.entries(groups).map(([gk, grs]) => (
                    <div key={gk}>
                      <div style={{ padding: '4px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                        {gk}
                      </div>
                      {grs.map(r => {
                        const getP = (v) => PASS_OPTIONS.find(o => o.value === (v || '')) || PASS_OPTIONS[0];
                        const getS = (v) => SUBMIT_OPTIONS.find(o => o.value === (v || '')) || SUBMIT_OPTIONS[0];
                        const wb = getP(r.word_test);
                        const rb = getP(r.retest);
                        const sb = getS(r.submission_status);
                        return (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #f8fafc', fontSize: 12, gap: 8 }}>
                            <span style={{ fontWeight: 600, minWidth: 50 }}>{r.student_name}</span>
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: wb.bg, color: wb.color }}>단어 {wb.label}</span>
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: rb.bg, color: rb.color }}>재시험 {rb.label}</span>
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: sb.bg, color: sb.color }}>과제 {sb.label}</span>
                            {r.memo && <span style={{ color: '#64748b', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.memo}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </>
      )}

      {/* 특별 포인트 모달 */}
      {bonusModal && (
        <>
          <div onClick={() => setBonusModal(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'white', borderRadius: 16, padding: 24, width: 320, zIndex: 301,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>⭐ 특별 포인트 지급</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              <strong>{bonusModal.name}</strong>
            </p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[
                { label: '🏆 최우수', amount: 100, reason: '최우수 과제', bg: '#fde68a', color: '#92400e' },
                { label: '⭐ 우수', amount: 50, reason: '우수 과제', bg: '#dbeafe', color: '#1e40af' },
              ].map(p => (
                <button key={p.label} onClick={() => { setBonusAmount(String(p.amount)); setBonusReason(p.reason); }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 14, background: p.bg, color: p.color, textAlign: 'center',
                  }}>
                  <div>{p.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>{p.amount}P</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[30, 50, 100, 200].map(v => (
                <button key={v} onClick={() => setBonusAmount(String(v))}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 12,
                    background: bonusAmount === String(v) ? '#3b82f6' : '#f1f5f9',
                    color: bonusAmount === String(v) ? 'white' : '#374151',
                  }}>{v}P</button>
              ))}
            </div>
            <input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)}
              placeholder="직접 입력"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10, fontSize: 14, boxSizing: 'border-box' }} />
            <input value={bonusReason} onChange={e => setBonusReason(e.target.value)}
              placeholder="사유 (예: 최우수 과제, 성적 향상)"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 14, fontSize: 13, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setBonusModal(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={handleBonus} style={{ flex: 1 }}>지급</button>
            </div>
          </div>
        </>
      )}

      <button className="btn btn-outline" onClick={() => navigate('/admin')}
        style={{ width: '100%', marginTop: 12 }}>← 대시보드</button>
    </div>
  );
}

const thStyle = { padding: '8px 6px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '2px solid var(--border)' };
const tdStyle = { padding: '6px', textAlign: 'center', verticalAlign: 'middle' };
