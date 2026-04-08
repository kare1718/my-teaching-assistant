import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, apiPut } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';

export default function StudentManage() {
  const { config } = useTenantConfig();
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [scores, setScores] = useState([]);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showTrend, setShowTrend] = useState({});
  const [showDist, setShowDist] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [clinicHistory, setClinicHistory] = useState([]);

  const loadStudent = () => {
    api(`/admin/students/${id}`).then((s) => {
      setStudent(s);
      setEditForm({
        name: s.name || '',
        phone: s.phone || '',
        school: s.school || '',
        grade: s.grade || '',
        parentName: s.parent_name || '',
        parentPhone: s.parent_phone || '',
        memo: s.memo || ''
      });
    }).catch(console.error);
  };

  const loadClinicHistory = () => {
    api(`/clinic/admin/student/${id}/history`).then(setClinicHistory).catch(() => setClinicHistory([]));
  };

  useEffect(() => {
    loadStudent();
    loadClinicHistory();
    api('/scores/exams').then(async (exams) => {
      const allScores = [];
      for (const exam of exams) {
        try {
          const examScores = await api(`/scores/exams/${exam.id}/scores`);
          const studentScore = examScores.find(s => s.student_id === parseInt(id));
          if (studentScore) {
            allScores.push({
              ...studentScore,
              exam_id: exam.id,
              exam_name: exam.name,
              exam_date: exam.exam_date,
              exam_type: exam.exam_type,
              max_score: exam.max_score,
              total_students: examScores.length
            });
          }
        } catch (e) { /* skip */ }
      }
      setScores(allScores);
    }).catch(console.error);
  }, [id]);

  const saveEdit = async () => {
    try {
      await apiPut(`/admin/students/${id}`, editForm);
      setMsg('학생 정보가 수정되었습니다.');
      setEditing(false);
      loadStudent();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const saveMemo = async () => {
    try {
      await apiPut(`/admin/students/${id}/memo`, { memo: editForm.memo });
      setMsg('특이사항이 저장되었습니다.');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const loadDistribution = async (examId) => {
    if (showDist === examId) { setShowDist(null); setDistribution(null); return; }
    setShowDist(examId);
    try { const data = await api(`/scores/exams/${examId}/distribution`); setDistribution(data); }
    catch (e) { console.error(e); }
  };

  const toggleTrend = (key) => {
    setShowTrend(prev => ({ ...prev, [key]: !prev[key] }));
  };

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

  const renderTrendChart = (data, title, color) => {
    if (data.length < 2) return null;
    const trendData = data.map(s => ({ name: s.exam_name, 점수: s.score }));
    const scoreValues = data.map(s => s.score);
    const minS = Math.min(...scoreValues), maxS = Math.max(...scoreValues);
    const range = maxS - minS;
    const padding = Math.max(range * 0.3, 5);
    const yMin = Math.max(0, Math.floor((minS - padding) / 5) * 5);
    const yMax = Math.min(Math.max(...data.map(s => s.max_score || 100)), Math.ceil((maxS + padding) / 5) * 5);
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" fontSize={12} stroke="var(--muted-foreground)" />
          <YAxis domain={[yMin, yMax]} stroke="var(--muted-foreground)" />
          <Tooltip formatter={(v) => [`${v}점`, '점수']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
          <Legend />
          <Line type="monotone" dataKey="점수" stroke={color} strokeWidth={2} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const trendColors = ['var(--warning)', 'var(--info)', 'oklch(55% 0.20 290)', 'var(--destructive)', 'var(--success)', 'oklch(58% 0.20 350)', 'oklch(62% 0.16 200)', 'var(--muted-foreground)'];
  const examTypeSet = [...new Set(scores.map(s => s.exam_type))];
  const trendSections = examTypeSet.map((type, i) => ({
    key: type,
    title: `${type} 성적 추이`,
    data: scores.filter(s => s.exam_type === type),
    color: trendColors[i % trendColors.length],
  }));
  const visibleTrends = trendSections.filter(t => t.data.length >= 2);

  const distData = distribution ? Object.entries(distribution.distribution).map(([range, count]) => ({
    range, 학생수: count,
    isStudentRange: distribution.myScore !== null && parseInt(range.split('-')[0]) <= distribution.myScore && distribution.myScore <= parseInt(range.split('-')[1])
  })) : [];
  const normalData = distribution ? generateNormalDistribution(distribution) : [];

  const grades = editForm.school ? ((config.schools || []).find(s => s.name === editForm.school)?.grades || []) : [];

  if (!student) return <div className="content"><p>로딩 중...</p></div>;

  const getExamBadgeClass = (type) => {
    if (type === '학력평가 모의고사') return 'badge badge-info';
    if (type?.includes('파이널')) return 'badge badge-danger';
    if (type?.includes('모의고사')) return 'badge badge-purple';
    return 'badge badge-warning';
  };

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt;{' '}
        <Link to={`/admin/school/${encodeURIComponent(student.school)}`}>{student.school}</Link> &gt;{' '}
        <Link to={`/admin/school/${encodeURIComponent(student.school)}/grade/${encodeURIComponent(student.grade)}`}>{student.grade}</Link> &gt;{' '}
        <span>{student.name}</span>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {student.name} 학생 정보
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {student.blocked ? (
              <span style={{ fontSize: 11, color: 'oklch(48% 0.20 25)', fontWeight: 700, padding: '2px 8px', background: 'var(--destructive-light)', borderRadius: 6 }}>🚫 차단됨</span>
            ) : null}
            <button
              className={`btn btn-sm ${student.blocked ? 'btn-primary' : 'btn-outline'}`}
              style={!student.blocked ? { color: 'oklch(48% 0.20 25)', borderColor: 'oklch(48% 0.20 25)' } : {}}
              onClick={async () => {
                const action = student.blocked ? '해제' : '차단';
                if (!confirm(`${student.name} 학생의 접속을 ${action}하시겠습니까?`)) return;
                try {
                  await apiPut(`/admin/students/${id}/block`, { blocked: !student.blocked });
                  setMsg(`접속이 ${action}되었습니다.`);
                  loadStudent();
                } catch(e) { setMsg(e.message); }
              }}
            >
              {student.blocked ? '🔓 차단 해제' : '🔒 접속 차단'}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={async () => {
                const pw = prompt('새 비밀번호를 입력하세요 (4자 이상):');
                if (!pw || pw.length < 4) { if (pw !== null) alert('비밀번호는 4자 이상이어야 합니다.'); return; }
                try {
                  await apiPut(`/admin/students/${id}/reset-password`, { newPassword: pw });
                  setMsg('비밀번호가 초기화되었습니다.');
                  setTimeout(() => setMsg(''), 2000);
                } catch(e) { setMsg(e.message); }
              }}
            >
              🔑 비번 초기화
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate(`/admin/student-view/${id}`)}
            >
              👁️ 학생 페이지 보기
            </button>
            <button
              className={`btn ${editing ? 'btn-secondary' : 'btn-primary'} btn-sm`}
              onClick={() => setEditing(!editing)}
            >
              {editing ? '취소' : '정보 수정'}
            </button>
          </div>
        </h2>

        {editing ? (
          <div>
            <div className="form-row">
              <div className="form-group">
                <label>이름 *</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>연락처 *</label>
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>학교 *</label>
                <select value={editForm.school} onChange={(e) => setEditForm({ ...editForm, school: e.target.value, grade: '' })}>
                  {(config.schools || []).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>학년 *</label>
                <select value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}>
                  <option value="">선택하세요</option>
                  {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>학부모 이름</label>
                <input value={editForm.parentName} onChange={(e) => setEditForm({ ...editForm, parentName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>학부모 연락처</label>
                <input value={editForm.parentPhone} onChange={(e) => setEditForm({ ...editForm, parentPhone: e.target.value })} />
              </div>
            </div>
            <div className="btn-group">
              <button className="btn btn-success" onClick={saveEdit}>저장</button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>취소</button>
            </div>
          </div>
        ) : (
          <table>
            <tbody>
              <tr><th style={{ width: 120 }}>아이디</th><td>{student.username}</td></tr>
              <tr><th>이름</th><td>{student.name}</td></tr>
              <tr><th>학교</th><td>{student.school}</td></tr>
              <tr><th>학년</th><td>{student.grade}</td></tr>
              <tr><th>연락처</th><td>{student.phone || '-'}</td></tr>
              <tr><th>학부모</th><td>{student.parent_name || '-'}</td></tr>
              <tr><th>학부모 연락처</th><td>{student.parent_phone || '-'}</td></tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>특이사항</h2>
        <textarea
          value={editForm.memo}
          onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
          placeholder="학생에 대한 특이사항을 입력하세요..."
        />
        <div className="btn-group">
          <button className="btn btn-primary" onClick={saveMemo}>저장</button>
        </div>
      </div>

      {/* 클리닉 이력 */}
      <div className="card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          📋 클리닉 이력
          <span style={{
            fontSize: 13, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
            background: clinicHistory.length > 0 ? 'oklch(92% 0.04 280)' : 'var(--neutral-100)',
            color: clinicHistory.length > 0 ? 'oklch(28% 0.10 280)' : 'var(--neutral-400)'
          }}>총 {clinicHistory.length}회</span>
        </h2>
        {clinicHistory.length === 0 ? (
          <p style={{ color: 'var(--neutral-400)' }}>클리닉 이력이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clinicHistory.map(h => {
              const stMap = { pending: { text: '대기', bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', border: 'var(--warning)' }, approved: { text: '승인', bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)', border: 'var(--success)' }, rejected: { text: '거절', bg: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)', border: 'var(--destructive)' }, completed: { text: '완료', bg: 'oklch(92% 0.04 280)', color: 'oklch(28% 0.10 280)', border: 'oklch(50% 0.20 280)' } };
              const st = stMap[h.status] || stMap.pending;
              const d = new Date(h.appointment_date + 'T00:00:00');
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              const dateLabel = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${dayNames[d.getDay()]})`;
              return (
                <div key={h.id} style={{
                  border: '1px solid var(--border)', borderRadius: 10, padding: 12,
                  borderLeft: `4px solid ${st.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>📅 {dateLabel} {h.time_slot}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: st.bg, color: st.color
                    }}>{st.text}</span>
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>{h.topic}</span>
                    {h.detail && <span style={{ color: 'var(--muted-foreground)', marginLeft: 6 }}>{h.detail}</span>}
                  </div>
                  {h.admin_note && (
                    <div style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 2 }}>💬 {h.admin_note}</div>
                  )}
                  {h.notes && h.notes.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>📝 기록 ({h.notes.length}건)</div>
                      {h.notes.map(n => (
                        <div key={n.id} style={{ background: 'var(--background)', borderRadius: 6, padding: 6, marginBottom: 3, fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>{n.author_name}</span>
                          <span style={{ color: 'var(--muted-foreground)', marginLeft: 6, fontSize: 11 }}>
                            {new Date(n.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div style={{ marginTop: 2, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{n.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2>성적 현황</h2>
        {scores.length === 0 ? (
          <p style={{ color: 'var(--neutral-400)' }}>등록된 성적이 없습니다.</p>
        ) : (
          <table>
            <thead>
              <tr><th>분류</th><th>시험명</th><th>날짜</th><th>점수</th><th>등수</th><th>비고</th><th></th></tr>
            </thead>
            <tbody>
              {scores.map((s, i) => (
                <tr key={i}>
                  <td>
                    <span className={getExamBadgeClass(s.exam_type)}>
                      {s.exam_type}
                    </span>
                  </td>
                  <td>{s.exam_name}</td>
                  <td>{s.exam_date || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{s.score}/{s.max_score}</td>
                  <td>{s.rank_num ? `${s.rank_num}등 / ${s.total_students}명` : '-'}</td>
                  <td>{s.note || '-'}</td>
                  <td><button className={`btn btn-sm ${showDist === s.exam_id ? 'btn-primary' : 'btn-outline'}`} onClick={() => loadDistribution(s.exam_id)}>분포</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDist && distribution && (
        <div className="card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            성적 분포 (만점: {distribution.maxScore}점)
            <button className="btn btn-outline btn-sm" onClick={() => { setShowDist(null); setDistribution(null); }}>닫기</button>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
            {distribution.myScore !== null && (<div className="stat-card" style={{ borderColor: 'var(--info)' }}><span className="stat-label">학생 점수</span><span className="stat-value" style={{ color: 'var(--info)' }}>{distribution.myScore}<span className="stat-unit">점</span></span></div>)}
            <div className="stat-card"><span className="stat-label">평균</span><span className="stat-value">{distribution.average}<span className="stat-unit">점</span></span></div>
            <div className="stat-card" style={{ borderColor: 'var(--success)' }}><span className="stat-label">최고점</span><span className="stat-value" style={{ color: 'var(--success)' }}>{distribution.highest}<span className="stat-unit">점</span></span></div>
            <div className="stat-card" style={{ borderColor: 'var(--destructive)' }}><span className="stat-label">최저점</span><span className="stat-value" style={{ color: 'var(--destructive)' }}>{distribution.lowest}<span className="stat-unit">점</span></span></div>
            <div className="stat-card"><span className="stat-label">응시인원</span><span className="stat-value">{distribution.totalStudents}<span className="stat-unit">명</span></span></div>
          </div>

          {normalData.length > 0 && (<div style={{ marginBottom: 24 }}><h3>표준분포 곡선</h3>
            <ResponsiveContainer width="100%" height={250}><AreaChart data={normalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="score" fontSize={11} stroke="var(--muted-foreground)" label={{ value: '점수', position: 'insideBottomRight', offset: -5, fill: 'var(--muted-foreground)', fontSize: 12 }} />
              <YAxis hide />
              <Tooltip formatter={(v, n) => n === 'density' ? [v, '밀도'] : [v, n]} labelFormatter={(v) => `${v}점`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
              <Area type="monotone" dataKey="density" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.1} strokeWidth={2} />
              {distribution.myScore !== null && (<ReferenceLine x={distribution.myScore} stroke="var(--destructive)" strokeWidth={2} strokeDasharray="5 5" label={{ value: `학생 ${distribution.myScore}`, fill: 'var(--destructive)', fontSize: 12, position: 'top' }} />)}
              <ReferenceLine x={distribution.average} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: `평균 ${distribution.average}`, fill: 'var(--foreground)', fontSize: 11, position: 'insideTopRight' }} />
            </AreaChart></ResponsiveContainer></div>)}

          <h3>구간별 인원 분포</h3>
          <ResponsiveContainer width="100%" height={250}><BarChart data={distData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="range" fontSize={11} stroke="var(--muted-foreground)" />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
            <Bar dataKey="학생수" radius={[4, 4, 0, 0]}>
              {distData.map((entry, index) => (<Cell key={index} fill={entry.isStudentRange ? 'var(--destructive)' : 'var(--primary)'} />))}
            </Bar>
          </BarChart></ResponsiveContainer>
        </div>
      )}

      {visibleTrends.length > 0 && (
        <div className="card">
          <h2>성적 추이 그래프</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {visibleTrends.map(t => (
              <button key={t.key} className={`btn btn-sm ${showTrend[t.key] ? 'btn-primary' : 'btn-outline'}`} onClick={() => toggleTrend(t.key)}>
                {showTrend[t.key] ? '▲' : '▼'} {t.title}
              </button>
            ))}
          </div>
          {visibleTrends.map(t => showTrend[t.key] && (
            <div key={t.key} style={{ marginBottom: 20 }}>
              <h3 style={{ color: t.color }}>{t.title}</h3>
              {renderTrendChart(t.data, t.title, t.color)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
