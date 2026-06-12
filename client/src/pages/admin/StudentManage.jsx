import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, apiPut } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import { toast, askConfirm } from '../../lib/feedback';
import { Card, StatusBadge } from '../../components/ui';
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

  if (!student) return <div className="main-content"><p className="text-sm text-slate-400">로딩 중...</p></div>;

  const getExamBadgeClass = (type) => {
    const base = 'inline-flex items-center whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-bold';
    if (!type) return `${base} bg-amber-100 text-amber-700`;
    const catIdx = (config.examTypes || []).findIndex(c => (c.types || []).includes(type));
    const badges = ['bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-red-100 text-red-700', 'bg-emerald-100 text-emerald-700'];
    return catIdx >= 0 ? `${base} ${badges[catIdx % badges.length]}` : `${base} bg-amber-100 text-amber-700`;
  };

  return (
    <div className="main-content max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-4">
        <Link className="text-[var(--primary)] font-medium hover:underline" to="/admin">대시보드</Link> &gt;{' '}
        <Link className="text-[var(--primary)] font-medium hover:underline" to={`/admin/school/${encodeURIComponent(student.school)}`}>{student.school}</Link> &gt;{' '}
        <Link className="text-[var(--primary)] font-medium hover:underline" to={`/admin/school/${encodeURIComponent(student.school)}/grade/${encodeURIComponent(student.grade)}`}>{student.grade}</Link> &gt;{' '}
        <span className="text-slate-700 font-bold">{student.name}</span>
      </div>

      {msg && <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-6 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[13px] font-semibold shadow-lg">{msg}</div>}

      <Card padding="p-5" className="mb-5">
        <h2 className="flex justify-between items-center flex-wrap gap-2 text-base font-extrabold text-[var(--primary)] tracking-tight mb-4">
          {student.name} 학생 정보
          <div className="flex gap-1.5 flex-wrap items-center">
            {student.blocked ? (
              <StatusBadge variant="danger">🚫 차단됨</StatusBadge>
            ) : null}
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${student.blocked ? 'bg-[var(--primary)] text-white hover:opacity-90' : 'bg-white border border-red-200 text-red-600 hover:bg-red-50'}`}
              onClick={async () => {
                const action = student.blocked ? '해제' : '차단';
                if (!await askConfirm(`${student.name} 학생의 접속을 ${action}하시겠습니까?`)) return;
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
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={async () => {
                const pw = prompt('새 비밀번호를 입력하세요 (4자 이상):');
                if (!pw || pw.length < 4) { if (pw !== null) toast('비밀번호는 4자 이상이어야 합니다.'); return; }
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
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={() => navigate(`/admin/student-view/${id}`)}
            >
              👁️ 학생 페이지 보기
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors font-display ${editing ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-[var(--cta)] text-white hover:opacity-90'}`}
              onClick={() => setEditing(!editing)}
            >
              {editing ? '취소' : '정보 수정'}
            </button>
          </div>
        </h2>

        {editing ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">이름 *</label>
                <input className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">연락처 *</label>
                <input className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">학교 *</label>
                <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" value={editForm.school} onChange={(e) => setEditForm({ ...editForm, school: e.target.value, grade: '' })}>
                  {(config.schools || []).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">학년 *</label>
                <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}>
                  <option value="">선택하세요</option>
                  {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">학부모 이름</label>
                <input className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" value={editForm.parentName} onChange={(e) => setEditForm({ ...editForm, parentName: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">학부모 연락처</label>
                <input className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]" value={editForm.parentPhone} onChange={(e) => setEditForm({ ...editForm, parentPhone: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display" onClick={saveEdit}>저장</button>
              <button className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold" onClick={() => setEditing(false)}>취소</button>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              <tr><th className="text-left text-xs font-bold text-slate-500 px-3 py-2 bg-slate-50 w-32">아이디</th><td className="px-3 py-2 text-sm border-b border-slate-50">{student.username}</td></tr>
              <tr><th className="text-left text-xs font-bold text-slate-500 px-3 py-2 bg-slate-50 w-32">이름</th><td className="px-3 py-2 text-sm border-b border-slate-50">{student.name}</td></tr>
              <tr><th className="text-left text-xs font-bold text-slate-500 px-3 py-2 bg-slate-50 w-32">학교</th><td className="px-3 py-2 text-sm border-b border-slate-50">{student.school}</td></tr>
              <tr><th className="text-left text-xs font-bold text-slate-500 px-3 py-2 bg-slate-50 w-32">학년</th><td className="px-3 py-2 text-sm border-b border-slate-50">{student.grade}</td></tr>
              <tr><th className="text-left text-xs font-bold text-slate-500 px-3 py-2 bg-slate-50 w-32">연락처</th><td className="px-3 py-2 text-sm border-b border-slate-50">{student.phone || '-'}</td></tr>
              <tr><th className="text-left text-xs font-bold text-slate-500 px-3 py-2 bg-slate-50 w-32">학부모</th><td className="px-3 py-2 text-sm border-b border-slate-50">{student.parent_name || '-'}</td></tr>
              <tr><th className="text-left text-xs font-bold text-slate-500 px-3 py-2 bg-slate-50 w-32">학부모 연락처</th><td className="px-3 py-2 text-sm border-b border-slate-50">{student.parent_phone || '-'}</td></tr>
            </tbody>
          </table>
        )}
      </Card>

      <Card padding="p-5" className="mb-5">
        <h2 className="text-base font-extrabold text-[var(--primary)] tracking-tight mb-4">특이사항</h2>
        <textarea
          className="w-full min-h-[100px] resize-y px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--cta)]"
          value={editForm.memo}
          onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
          placeholder="학생에 대한 특이사항을 입력하세요..."
        />
        <div className="flex gap-2 mt-4">
          <button className="bg-[var(--cta)] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 font-display" onClick={saveMemo}>저장</button>
        </div>
      </Card>

      {/* 클리닉 이력 */}
      <Card padding="p-5" className="mb-5">
        <h2 className="flex justify-between items-center text-base font-extrabold text-[var(--primary)] tracking-tight mb-4">
          📋 클리닉 이력
          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${clinicHistory.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>총 {clinicHistory.length}회</span>
        </h2>
        {clinicHistory.length === 0 ? (
          <p className="text-sm text-slate-400">클리닉 이력이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {clinicHistory.map(h => {
              const stMap = { pending: { text: '대기', bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', border: 'var(--warning)' }, approved: { text: '승인', bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)', border: 'var(--success)' }, rejected: { text: '거절', bg: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)', border: 'var(--destructive)' }, completed: { text: '완료', bg: 'oklch(92% 0.04 280)', color: 'oklch(28% 0.10 280)', border: 'oklch(50% 0.20 280)' } };
              const st = stMap[h.status] || stMap.pending;
              const d = new Date(h.appointment_date + 'T00:00:00');
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              const dateLabel = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${dayNames[d.getDay()]})`;
              return (
                <div key={h.id} className="border border-slate-100 rounded-xl p-3 bg-white" style={{ borderLeft: `4px solid ${st.border}` }}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm">📅 {dateLabel} {h.time_slot}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.color }}>{st.text}</span>
                  </div>
                  <div className="text-[13px] mb-0.5">
                    <span className="font-semibold">{h.topic}</span>
                    {h.detail && <span className="text-slate-500 ml-1.5">{h.detail}</span>}
                  </div>
                  {h.admin_note && (
                    <div className="text-xs text-[var(--primary)] mb-0.5">💬 {h.admin_note}</div>
                  )}
                  {h.notes && h.notes.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-200">
                      <div className="text-[11px] font-bold text-slate-400 mb-1">📝 기록 ({h.notes.length}건)</div>
                      {h.notes.map(n => (
                        <div key={n.id} className="bg-slate-50 rounded-lg p-1.5 mb-1 text-xs">
                          <span className="font-semibold">{n.author_name}</span>
                          <span className="text-slate-400 ml-1.5 text-[11px]">
                            {new Date(n.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="mt-0.5 whitespace-pre-wrap leading-snug">{n.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card padding="p-5" className="mb-5">
        <h2 className="text-base font-extrabold text-[var(--primary)] tracking-tight mb-4">성적 현황</h2>
        {scores.length === 0 ? (
          <p className="text-sm text-slate-400">등록된 성적이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50"><th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">분류</th><th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">시험명</th><th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">날짜</th><th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">점수</th><th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">등수</th><th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">비고</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {scores.map((s, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-sm border-b border-slate-50">
                    <span className={getExamBadgeClass(s.exam_type)}>
                      {s.exam_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm border-b border-slate-50">{s.exam_name}</td>
                  <td className="px-3 py-2 text-sm border-b border-slate-50">{s.exam_date || '-'}</td>
                  <td className="px-3 py-2 text-sm border-b border-slate-50 font-semibold">{s.score}/{s.max_score}</td>
                  <td className="px-3 py-2 text-sm border-b border-slate-50">{s.rank_num ? `${s.rank_num}등 / ${s.total_students}명` : '-'}</td>
                  <td className="px-3 py-2 text-sm border-b border-slate-50">{s.note || '-'}</td>
                  <td className="px-3 py-2 text-sm border-b border-slate-50"><button className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showDist === s.exam_id ? 'bg-[var(--cta)] text-white hover:opacity-90' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`} onClick={() => loadDistribution(s.exam_id)}>분포</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {showDist && distribution && (
        <Card padding="p-5" className="mb-5">
          <h2 className="flex justify-between items-center flex-wrap gap-2 text-base font-extrabold text-[var(--primary)] tracking-tight mb-4">
            성적 분포 (만점: {distribution.maxScore}점)
            <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors" onClick={() => { setShowDist(null); setDistribution(null); }}>닫기</button>
          </h2>
          <div className="grid gap-2.5 mb-5 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
            {distribution.myScore !== null && (<div className="flex flex-col items-center p-3 rounded-xl border border-blue-200 bg-white"><span className="text-xs font-bold text-slate-400 mb-1">학생 점수</span><span className="text-xl font-extrabold tracking-tight tabular-nums text-[var(--cta)]">{distribution.myScore}<span className="text-xs font-normal text-slate-400 ml-0.5">점</span></span></div>)}
            <div className="flex flex-col items-center p-3 rounded-xl border border-slate-100 bg-white"><span className="text-xs font-bold text-slate-400 mb-1">평균</span><span className="text-xl font-extrabold tracking-tight tabular-nums text-[var(--primary)]">{distribution.average}<span className="text-xs font-normal text-slate-400 ml-0.5">점</span></span></div>
            <div className="flex flex-col items-center p-3 rounded-xl border border-emerald-200 bg-white"><span className="text-xs font-bold text-slate-400 mb-1">최고점</span><span className="text-xl font-extrabold tracking-tight tabular-nums text-emerald-600">{distribution.highest}<span className="text-xs font-normal text-slate-400 ml-0.5">점</span></span></div>
            <div className="flex flex-col items-center p-3 rounded-xl border border-red-200 bg-white"><span className="text-xs font-bold text-slate-400 mb-1">최저점</span><span className="text-xl font-extrabold tracking-tight tabular-nums text-red-500">{distribution.lowest}<span className="text-xs font-normal text-slate-400 ml-0.5">점</span></span></div>
            <div className="flex flex-col items-center p-3 rounded-xl border border-slate-100 bg-white"><span className="text-xs font-bold text-slate-400 mb-1">응시인원</span><span className="text-xl font-extrabold tracking-tight tabular-nums text-[var(--primary)]">{distribution.totalStudents}<span className="text-xs font-normal text-slate-400 ml-0.5">명</span></span></div>
          </div>

          {normalData.length > 0 && (<div className="mb-6"><h3 className="text-sm font-bold text-[var(--primary)] mb-2">표준분포 곡선</h3>
            <ResponsiveContainer width="100%" height={250}><AreaChart data={normalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="score" fontSize={11} stroke="var(--muted-foreground)" label={{ value: '점수', position: 'insideBottomRight', offset: -5, fill: 'var(--muted-foreground)', fontSize: 12 }} />
              <YAxis hide />
              <Tooltip formatter={(v, n) => n === 'density' ? [v, '밀도'] : [v, n]} labelFormatter={(v) => `${v}점`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
              <Area type="monotone" dataKey="density" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.1} strokeWidth={2} />
              {distribution.myScore !== null && (<ReferenceLine x={distribution.myScore} stroke="var(--destructive)" strokeWidth={2} strokeDasharray="5 5" label={{ value: `학생 ${distribution.myScore}`, fill: 'var(--destructive)', fontSize: 12, position: 'top' }} />)}
              <ReferenceLine x={distribution.average} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: `평균 ${distribution.average}`, fill: 'var(--foreground)', fontSize: 11, position: 'insideTopRight' }} />
            </AreaChart></ResponsiveContainer></div>)}

          <h3 className="text-sm font-bold text-[var(--primary)] mb-2">구간별 인원 분포</h3>
          <ResponsiveContainer width="100%" height={250}><BarChart data={distData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="range" fontSize={11} stroke="var(--muted-foreground)" />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
            <Bar dataKey="학생수" radius={[4, 4, 0, 0]}>
              {distData.map((entry, index) => (<Cell key={index} fill={entry.isStudentRange ? 'var(--destructive)' : 'var(--primary)'} />))}
            </Bar>
          </BarChart></ResponsiveContainer>
        </Card>
      )}

      {visibleTrends.length > 0 && (
        <Card padding="p-5" className="mb-5">
          <h2 className="text-base font-extrabold text-[var(--primary)] tracking-tight mb-4">성적 추이 그래프</h2>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {visibleTrends.map(t => (
              <button key={t.key} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showTrend[t.key] ? 'bg-[var(--cta)] text-white hover:opacity-90' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`} onClick={() => toggleTrend(t.key)}>
                {showTrend[t.key] ? '▲' : '▼'} {t.title}
              </button>
            ))}
          </div>
          {visibleTrends.map(t => showTrend[t.key] && (
            <div key={t.key} className="mb-5">
              <h3 className="text-sm font-bold mb-2" style={{ color: t.color }}>{t.title}</h3>
              {renderTrendChart(t.data, t.title, t.color)}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
