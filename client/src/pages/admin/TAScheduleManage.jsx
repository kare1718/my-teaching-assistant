import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
const TIME_SLOTS = [];
for (let h = 9; h <= 21; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
TIME_SLOTS.push('22:00');

// 시간 옵션 (09:00 ~ 22:00, 30분 단위)
const TIME_OPTIONS = TIME_SLOTS.map(t => t);

// scheduleMap → 조교별 요일별 시작/끝 시간 추출
function scheduleToMemberTimes(scheduleMap, activeMembers) {
  // { memberId: { 0: {start, end}, 1: {start, end}, ... } }
  const result = {};
  activeMembers.forEach(m => { result[m.id] = {}; });

  for (const key of Object.keys(scheduleMap)) {
    const ids = scheduleMap[key] || [];
    if (ids.length === 0) continue;
    const [dayStr, time] = key.split('_');
    const day = parseInt(dayStr);
    ids.forEach(id => {
      if (!result[id]) result[id] = {};
      if (!result[id][day]) result[id][day] = { start: time, end: time };
      else {
        if (time < result[id][day].start) result[id][day].start = time;
        if (time > result[id][day].end) result[id][day].end = time;
      }
    });
  }

  // end를 +30분으로 변환 (마지막 슬롯의 끝)
  for (const id of Object.keys(result)) {
    for (const day of Object.keys(result[id])) {
      const endSlot = result[id][day].end;
      const [h, m] = endSlot.split(':').map(Number);
      const endMin = h * 60 + m + 30;
      result[id][day].end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    }
  }
  return result;
}

// 조교별 시간 입력 → scheduleMap으로 변환
function memberTimesToSchedule(memberTimes) {
  const scheduleMap = {};
  for (const [memberIdStr, days] of Object.entries(memberTimes)) {
    const memberId = parseInt(memberIdStr);
    for (const [dayStr, times] of Object.entries(days)) {
      const day = parseInt(dayStr);
      if (!times.start || !times.end || times.start >= times.end) continue;
      // start부터 end 전까지의 30분 슬롯 채우기
      for (const slot of TIME_SLOTS) {
        if (slot >= times.start && slot < times.end) {
          const key = `${day}_${slot}`;
          if (!scheduleMap[key]) scheduleMap[key] = [];
          if (!scheduleMap[key].includes(memberId)) scheduleMap[key].push(memberId);
        }
      }
    }
  }
  return scheduleMap;
}

export default function TAScheduleManage() {
  const [tab, setTab] = useState(0);
  const tabs = ['근무 기록', '월간 근무표', '조교 명단'];

  const [members, setMembers] = useState([]);

  // 탭1: 근무 기록
  const [workLogs, setWorkLogs] = useState([]);
  const [summary, setSummary] = useState([]);
  const [swapLogId, setSwapLogId] = useState(null); // 대타 교체 중인 로그 ID
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [showLogForm, setShowLogForm] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [logForm, setLogForm] = useState({
    ta_member_id: '', work_date: '', check_in: '', check_out: '',
    hours: '', is_substitute: false, substitute_for: '', memo: ''
  });

  // 탭2: 월간 근무표
  const [schedYear, setSchedYear] = useState(now.getFullYear());
  const [schedMonth, setSchedMonth] = useState(now.getMonth() + 1);
  const [regularSchedule, setRegularSchedule] = useState({});
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [memberTimes, setMemberTimes] = useState({}); // 편집용: { memberId: { day: {start, end} } }

  // 탭3: 조교 명단 폼
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ name: '', phone: '', role_desc: '' });

  const loadMembers = () => api('/ta/members').then(setMembers).catch(console.error);
  const loadWorkLogs = () => {
    api(`/ta/work-logs?year=${selYear}&month=${selMonth}`).then(setWorkLogs).catch(console.error);
    api(`/ta/work-logs/summary?year=${selYear}&month=${selMonth}`).then(setSummary).catch(console.error);
  };
  const loadRegularSchedule = (y, m) => {
    const year = y || schedYear;
    const month = m || schedMonth;
    api(`/ta/regular-schedule?year=${year}&month=${month}`).then(data => {
      const map = {};
      data.forEach(s => {
        const key = `${s.day_of_week}_${s.time_slot}`;
        map[key] = JSON.parse(s.ta_member_ids || '[]');
      });
      setRegularSchedule(map);
    }).catch(console.error);
  };

  // 현재 근무기록 탭에서 사용하는 월의 근무표 (자동채우기용)
  const [currentMonthSchedule, setCurrentMonthSchedule] = useState({});
  const loadCurrentMonthSchedule = () => {
    api(`/ta/regular-schedule?year=${selYear}&month=${selMonth}`).then(data => {
      const map = {};
      data.forEach(s => {
        const key = `${s.day_of_week}_${s.time_slot}`;
        map[key] = JSON.parse(s.ta_member_ids || '[]');
      });
      setCurrentMonthSchedule(map);
    }).catch(console.error);
  };

  useEffect(() => { loadMembers(); }, []);
  useEffect(() => { if (tab === 0) { loadWorkLogs(); loadCurrentMonthSchedule(); } }, [tab, selYear, selMonth]);
  useEffect(() => { if (tab === 1) loadRegularSchedule(); }, [tab, schedYear, schedMonth]);

  const autoFillFromSchedule = (memberId, workDate) => {
    if (!memberId || !workDate) return {};
    const d = new Date(workDate + 'T00:00:00');
    const jsDay = d.getDay();
    const dbDay = jsDay === 0 ? 6 : jsDay - 1;
    const slots = [];
    for (const key of Object.keys(currentMonthSchedule)) {
      const [day, time] = key.split('_');
      if (parseInt(day) === dbDay && (currentMonthSchedule[key] || []).includes(memberId)) {
        slots.push(time);
      }
    }
    if (slots.length === 0) return {};
    slots.sort();
    const checkIn = slots[0];
    const lastSlot = slots[slots.length - 1];
    const [lastH, lastM] = lastSlot.split(':').map(Number);
    const endMin = lastH * 60 + lastM + 30;
    const checkOut = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    return { check_in: checkIn, check_out: checkOut };
  };

  // ===== 탭1: 근무 기록 =====
  const resetLogForm = () => {
    setLogForm({ ta_member_id: '', work_date: '', check_in: '', check_out: '', hours: '', is_substitute: false, substitute_for: '', memo: '' });
    setEditingLog(null);
    setShowLogForm(false);
  };

  const handleSaveLog = async () => {
    if (!logForm.ta_member_id || !logForm.work_date) return alert('조교와 날짜를 선택해주세요.');
    // 시간이 입력된 경우 hours 자동 재계산
    let hours = logForm.hours !== '' ? parseFloat(logForm.hours) : 0;
    if (logForm.check_in && logForm.check_out) {
      const [inH, inM] = logForm.check_in.split(':').map(Number);
      const [outH, outM] = logForm.check_out.split(':').map(Number);
      const calc = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;
      if (calc > 0) hours = calc;
    }
    const payload = {
      ta_member_id: Number(logForm.ta_member_id),
      work_date: logForm.work_date,
      check_in: logForm.check_in,
      check_out: logForm.check_out,
      hours,
      is_substitute: logForm.is_substitute,
      substitute_for: logForm.substitute_for,
      memo: logForm.memo,
    };
    try {
      if (editingLog) {
        await apiPut(`/ta/work-logs/${editingLog.id}`, payload);
      } else {
        await apiPost('/ta/work-logs', payload);
      }
      resetLogForm();
      loadWorkLogs();
    } catch (e) {
      alert('저장 실패: ' + (e.message || '알 수 없는 오류'));
    }
  };

  const handleDeleteLog = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await apiDelete(`/ta/work-logs/${id}`);
    loadWorkLogs();
  };

  // 대타 교체: 원래 근무자 이름 클릭 → 대타 조교 선택
  const handleSwapSubstitute = async (log, newMemberId) => {
    setSwapLogId(null);
    const newMember = members.find(m => m.id === newMemberId);
    const originalMember = members.find(m => m.id === log.ta_member_id);
    if (!newMember || !originalMember) return;

    // 원래 기록을 대타로 변경: 조교를 교체하고 대타 표시
    await apiPut(`/ta/work-logs/${log.id}`, {
      ta_member_id: newMemberId,
      work_date: log.work_date,
      check_in: log.check_in,
      check_out: log.check_out,
      hours: log.hours,
      is_substitute: true,
      substitute_for: originalMember.name,
      memo: log.memo || ''
    });
    loadWorkLogs();
  };

  const openEditLog = (log) => {
    setLogForm({
      ta_member_id: log.ta_member_id, work_date: log.work_date,
      check_in: log.check_in || '', check_out: log.check_out || '',
      hours: log.hours || '', is_substitute: !!log.is_substitute,
      substitute_for: log.substitute_for || '', memo: log.memo || ''
    });
    setEditingLog(log);
    setShowLogForm(true);
  };

  const handleBulkGenerate = async () => {
    if (!confirm(`${selYear}년 ${selMonth}월 근무표 기반으로 근무 기록을 일괄 생성합니다.\n이미 기록이 있는 날짜는 건너뜁니다.\n\n계속하시겠습니까?`)) return;
    try {
      const result = await apiPost('/ta/work-logs/bulk-generate', { year: selYear, month: selMonth });
      alert(result.message);
      loadWorkLogs();
    } catch (e) {
      alert(e.message || '일괄 생성 실패');
    }
  };

  const handleExportCsv = () => {
    const token = localStorage.getItem('token');
    const url = `/api/ta/work-logs/export-csv?year=${selYear}&month=${selMonth}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `조교근무-${selYear}-${String(selMonth).padStart(2, '0')}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert('내보내기 실패'));
  };

  const renderWorkLogsTab = () => {
    const grouped = {};
    workLogs.forEach(l => {
      if (!grouped[l.work_date]) grouped[l.work_date] = [];
      grouped[l.work_date].push(l);
    });

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}
              onClick={() => { resetLogForm(); setShowLogForm(true); }}>
              + 근무 추가
            </button>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 10px' }}
              onClick={handleBulkGenerate}>
              ⚡ 일괄 생성
            </button>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 10px' }}
              onClick={handleExportCsv}>
              📥 엑셀
            </button>
          </div>
        </div>

        {showLogForm && (
          <div className="card" style={{ padding: 16, marginBottom: 12, background: '#f8fafc' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
              {editingLog ? '근무 수정' : '근무 추가'}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle}>조교</label>
                <select value={logForm.ta_member_id}
                  onChange={e => {
                    const id = Number(e.target.value);
                    setLogForm(prev => {
                      const fill = autoFillFromSchedule(id, prev.work_date);
                      return { ...prev, ta_member_id: id, ...(fill.check_in && !prev.check_in ? fill : {}) };
                    });
                  }}
                  style={inputStyle}>
                  <option value="">선택</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}{!m.is_active ? ' (비활성)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>날짜</label>
                <input type="date" value={logForm.work_date}
                  onChange={e => {
                    const date = e.target.value;
                    setLogForm(prev => {
                      const fill = autoFillFromSchedule(prev.ta_member_id, date);
                      return { ...prev, work_date: date, ...(fill.check_in && !prev.check_in ? fill : {}) };
                    });
                  }}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>출근</label>
                <input type="time" value={logForm.check_in}
                  onChange={e => {
                    const checkIn = e.target.value;
                    setLogForm(prev => {
                      let hours = prev.hours;
                      if (checkIn && prev.check_out) {
                        const [inH, inM] = checkIn.split(':').map(Number);
                        const [outH, outM] = prev.check_out.split(':').map(Number);
                        const calc = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;
                        if (calc > 0) hours = calc;
                      }
                      return { ...prev, check_in: checkIn, hours };
                    });
                  }}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>퇴근</label>
                <input type="time" value={logForm.check_out}
                  onChange={e => {
                    const checkOut = e.target.value;
                    setLogForm(prev => {
                      let hours = prev.hours;
                      if (prev.check_in && checkOut) {
                        const [inH, inM] = prev.check_in.split(':').map(Number);
                        const [outH, outM] = checkOut.split(':').map(Number);
                        const calc = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;
                        if (calc > 0) hours = calc;
                      }
                      return { ...prev, check_out: checkOut, hours };
                    });
                  }}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>시간 (자동계산)</label>
                <input type="number" step="0.5" placeholder="자동계산" value={logForm.hours}
                  onChange={e => setLogForm(prev => ({ ...prev, hours: e.target.value }))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>메모</label>
                <input type="text" placeholder="메모" value={logForm.memo}
                  onChange={e => setLogForm(prev => ({ ...prev, memo: e.target.value }))}
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={logForm.is_substitute}
                  onChange={e => setLogForm(prev => ({ ...prev, is_substitute: e.target.checked }))} />
                대타 근무
              </label>
              {logForm.is_substitute && (
                <input type="text" placeholder="대타 대상 (예: 홍길동)" value={logForm.substitute_for}
                  onChange={e => setLogForm(prev => ({ ...prev, substitute_for: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleSaveLog}>
                {editingLog ? '수정' : '추가'}
              </button>
              <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={resetLogForm}>취소</button>
            </div>
          </div>
        )}

        {Object.keys(grouped).length > 0 && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, textAlign: 'right' }}>
            💡 이름을 클릭하면 대타를 교체할 수 있습니다
          </div>
        )}

        {Object.keys(grouped).length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
            이 달의 근무 기록이 없습니다.
          </div>
        ) : (
          Object.keys(grouped).sort().map(date => {
            const d = new Date(date + 'T00:00:00');
            const dayName = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
            return (
              <div key={date} className="card" style={{ padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
                  {date.slice(5).replace('-', '/')} ({dayName})
                </div>
                {grouped[date].map(log => (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 4,
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      {/* 이름 클릭 → 대타 교체 드롭다운 */}
                      <span style={{
                        fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '2px 6px', borderRadius: 6,
                        background: swapLogId === log.id ? '#e0e7ff' : 'transparent',
                        border: swapLogId === log.id ? '1px solid #818cf8' : '1px solid transparent',
                        transition: 'all 0.15s',
                      }}
                        onClick={() => setSwapLogId(swapLogId === log.id ? null : log.id)}
                        title="클릭하여 대타 교체"
                      >
                        {log.ta_name}
                      </span>
                      {log.is_substitute ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                          background: '#fef3c7', color: '#92400e'
                        }}>대타{log.substitute_for ? ` (${log.substitute_for})` : ''}</span>
                      ) : null}
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {log.check_in && log.check_out ? `${log.check_in}~${log.check_out}` : (log.check_in || '')}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                        {log.hours ? `${log.hours}h` : ''}
                      </span>
                      {log.memo && (
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>({log.memo})</span>
                      )}
                    </div>

                    {/* 대타 교체 드롭다운 */}
                    {swapLogId === log.id && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 10,
                        background: 'white', border: '1px solid var(--border)', borderRadius: 10,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 8, minWidth: 200,
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 6, fontWeight: 600 }}>
                          {log.ta_name} → 대타 교체
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {members.filter(m => m.is_active && m.id !== log.ta_member_id).map(m => (
                            <button key={m.id}
                              onClick={() => handleSwapSubstitute(log, m.id)}
                              style={{
                                padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                                background: '#f8fafc', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                                textAlign: 'left', transition: 'all 0.1s',
                              }}
                              onMouseEnter={e => { e.target.style.background = '#dbeafe'; e.target.style.borderColor = '#93c5fd'; }}
                              onMouseLeave={e => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = 'var(--border)'; }}
                            >
                              {m.name}
                              {m.role_desc ? <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 6 }}>{m.role_desc}</span> : null}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setSwapLogId(null)}
                          style={{ marginTop: 6, width: '100%', padding: '5px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 12, color: 'var(--muted-foreground)' }}>
                          취소
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEditLog(log)}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer' }}>
                        수정
                      </button>
                      <button onClick={() => handleDeleteLog(log.id)}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}

        {summary.length > 0 && (
          <div className="card" style={{ padding: 14, marginTop: 12 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
              📊 {selMonth}월 근무시간 합산
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {summary.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid var(--border)'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                    {s.role_desc && (
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 6 }}>{s.role_desc}</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>{s.total_hours}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 2 }}>시간</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 8 }}>({s.work_days}일)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ===== 탭2: 월간 근무표 =====
  const startEditing = () => {
    const activeMembers = members.filter(m => m.is_active);
    const times = scheduleToMemberTimes(regularSchedule, activeMembers);
    setMemberTimes(times);
    setEditingSchedule(true);
  };

  const handleSaveSchedule = async () => {
    const scheduleMap = memberTimesToSchedule(memberTimes);
    const schedule = [];
    for (let day = 0; day < 7; day++) {
      for (const slot of TIME_SLOTS) {
        const key = `${day}_${slot}`;
        const ids = scheduleMap[key] || [];
        schedule.push({ day_of_week: day, time_slot: slot, ta_member_ids: ids });
      }
    }
    await apiPut('/ta/regular-schedule', { schedule, year: schedYear, month: schedMonth });
    setEditingSchedule(false);
    loadRegularSchedule();
    alert('저장되었습니다.');
  };

  const handleCopyFromPrev = async () => {
    let fromMonth = schedMonth - 1;
    let fromYear = schedYear;
    if (fromMonth < 1) { fromMonth = 12; fromYear--; }
    if (!confirm(`${fromYear}년 ${fromMonth}월 근무표를 ${schedYear}년 ${schedMonth}월로 복사합니다.\n기존 ${schedMonth}월 근무표는 덮어씁니다.\n\n계속하시겠습니까?`)) return;
    try {
      const result = await apiPost('/ta/regular-schedule/copy', {
        fromYear, fromMonth, toYear: schedYear, toMonth: schedMonth
      });
      alert(result.message);
      loadRegularSchedule();
    } catch (e) {
      alert(e.message || '복사 실패');
    }
  };

  const updateMemberTime = (memberId, day, field, value) => {
    setMemberTimes(prev => {
      const next = { ...prev };
      if (!next[memberId]) next[memberId] = {};
      if (!next[memberId][day]) next[memberId][day] = { start: '', end: '' };
      next[memberId] = { ...next[memberId], [day]: { ...next[memberId][day], [field]: value } };
      return next;
    });
  };

  // 한 조교의 특정 요일 시간을 모든 요일에 복사
  const copyToAllDays = (memberId, sourceDay) => {
    setMemberTimes(prev => {
      const next = { ...prev };
      const src = next[memberId]?.[sourceDay];
      if (!src || !src.start) return prev;
      next[memberId] = { ...next[memberId] };
      for (let d = 0; d < 7; d++) {
        next[memberId][d] = { ...src };
      }
      return next;
    });
  };

  // 한 조교의 시간을 전체 삭제
  const clearMemberSchedule = (memberId) => {
    setMemberTimes(prev => ({ ...prev, [memberId]: {} }));
  };

  const renderRegularScheduleTab = () => {
    const activeMembers = members.filter(m => m.is_active);

    // 보기 모드용: scheduleMap → 조교별 요일 시간
    const viewTimes = scheduleToMemberTimes(regularSchedule, activeMembers);

    return (
      <div>
        {/* 월 선택 + 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select value={schedYear} onChange={e => setSchedYear(Number(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select value={schedMonth} onChange={e => setSchedMonth(Number(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {editingSchedule ? (
              <>
                <button className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={handleSaveSchedule}>저장</button>
                <button className="btn btn-outline" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setEditingSchedule(false)}>취소</button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={startEditing}>✏️ 수정</button>
                <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 10px' }} onClick={handleCopyFromPrev}>
                  📋 이전달 복사
                </button>
              </>
            )}
          </div>
        </div>

        {editingSchedule ? (
          /* ===== 편집 모드: 조교별 요일 시간 입력 ===== */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeMembers.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
                먼저 조교 명단 탭에서 조교를 등록해주세요.
              </div>
            ) : activeMembers.map(m => {
              const times = memberTimes[m.id] || {};
              return (
                <div key={m.id} className="card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</span>
                      {m.role_desc && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{m.role_desc}</span>}
                    </div>
                    <button onClick={() => clearMemberSchedule(m.id)}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
                      초기화
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                    {DAY_NAMES.map((dayName, dayIdx) => {
                      const t = times[dayIdx] || { start: '', end: '' };
                      return (
                        <div key={dayIdx} style={{
                          padding: '8px', borderRadius: 8,
                          background: t.start ? '#f0f9ff' : '#fafafa',
                          border: t.start ? '1px solid #bfdbfe' : '1px solid var(--border)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: dayIdx >= 5 ? '#dc2626' : 'var(--foreground)' }}>{dayName}</span>
                            {t.start && (
                              <button onClick={() => copyToAllDays(m.id, dayIdx)} title="이 시간을 전체 요일에 복사"
                                style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', color: '#6366f1' }}>
                                전체적용
                              </button>
                            )}
                          </div>
                          <select value={t.start || ''}
                            onChange={e => updateMemberTime(m.id, dayIdx, 'start', e.target.value)}
                            style={{ width: '100%', padding: '4px 2px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, marginBottom: 3 }}>
                            <option value="">시작</option>
                            {TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <select value={t.end || ''}
                            onChange={e => updateMemberTime(m.id, dayIdx, 'end', e.target.value)}
                            style={{ width: '100%', padding: '4px 2px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                            <option value="">종료</option>
                            {[...TIME_OPTIONS.slice(1), '22:30'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ===== 보기 모드: 조교별 요일 근무 시간 테이블 ===== */
          <div>
            {activeMembers.length === 0 || Object.keys(regularSchedule).length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
                {activeMembers.length === 0 ? '조교를 먼저 등록해주세요.' : '이 달의 근무표가 없습니다.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 12px', borderBottom: '2px solid var(--border)', textAlign: 'left', fontWeight: 700, color: 'var(--primary)' }}>조교</th>
                      {DAY_NAMES.map((day, i) => (
                        <th key={i} style={{ padding: '10px 6px', borderBottom: '2px solid var(--border)', textAlign: 'center', fontWeight: 700, color: i >= 5 ? '#dc2626' : 'var(--foreground)', minWidth: 70 }}>
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeMembers.map(m => {
                      const t = viewTimes[m.id] || {};
                      const hasTimes = Object.keys(t).length > 0;
                      if (!hasTimes) return null;
                      return (
                        <tr key={m.id}>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                            {m.name}
                            {m.role_desc && <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400 }}>{m.role_desc}</div>}
                          </td>
                          {DAY_NAMES.map((_, dayIdx) => {
                            const d = t[dayIdx];
                            return (
                              <td key={dayIdx} style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                                {d ? (
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>{d.start}</div>
                                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>~</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>{d.end}</div>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#d1d5db' }}>-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ===== 탭3: 조교 명단 =====
  const resetMemberForm = () => {
    setMemberForm({ name: '', phone: '', role_desc: '' });
    setEditingMember(null);
    setShowMemberForm(false);
  };

  const handleSaveMember = async () => {
    if (!memberForm.name.trim()) return alert('이름을 입력해주세요.');
    if (editingMember) {
      await apiPut(`/ta/members/${editingMember.id}`, { ...memberForm, is_active: editingMember.is_active });
    } else {
      await apiPost('/ta/members', memberForm);
    }
    resetMemberForm();
    loadMembers();
  };

  const handleDeleteMember = async (id) => {
    if (!confirm('해당 조교의 모든 근무 기록도 삭제됩니다. 삭제하시겠습니까?')) return;
    await apiDelete(`/ta/members/${id}`);
    loadMembers();
  };

  const handleToggleActive = async (m) => {
    await apiPut(`/ta/members/${m.id}`, { ...m, is_active: !m.is_active });
    loadMembers();
  };

  const renderMembersTab = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}
          onClick={() => { resetMemberForm(); setShowMemberForm(true); }}>
          + 조교 추가
        </button>
      </div>

      {showMemberForm && (
        <div className="card" style={{ padding: 16, marginBottom: 12, background: '#f8fafc' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
            {editingMember ? '조교 수정' : '조교 추가'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>이름 *</label>
              <input type="text" placeholder="이름" value={memberForm.name}
                onChange={e => setMemberForm({ ...memberForm, name: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>연락처</label>
              <input type="text" placeholder="010-0000-0000" value={memberForm.phone}
                onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>업무</label>
              <input type="text" placeholder="담당 업무" value={memberForm.role_desc}
                onChange={e => setMemberForm({ ...memberForm, role_desc: e.target.value })}
                style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleSaveMember}>
              {editingMember ? '수정' : '추가'}
            </button>
            <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={resetMemberForm}>취소</button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
          등록된 조교가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(m => (
            <div key={m.id} className="card" style={{
              padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              opacity: m.is_active ? 1 : 0.5, flexWrap: 'wrap', gap: 8,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</span>
                  {!m.is_active && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>비활성</span>
                  )}
                </div>
                {m.phone && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{m.phone}</div>}
                {m.role_desc && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 1 }}>{m.role_desc}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => handleToggleActive(m)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: m.is_active ? '#fef3c7' : '#dcfce7', cursor: 'pointer', color: m.is_active ? '#92400e' : '#166534' }}>
                  {m.is_active ? '비활성' : '활성'}
                </button>
                <button onClick={() => { setMemberForm({ name: m.name, phone: m.phone || '', role_desc: m.role_desc || '' }); setEditingMember(m); setShowMemberForm(true); }}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer' }}>
                  수정
                </button>
                <button onClick={() => handleDeleteMember(m.id)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="content">
      <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📅 조교 근무표</h1>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: tab === i ? 700 : 500,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: tab === i ? 'var(--primary)' : '#f8fafc',
              color: tab === i ? 'white' : 'var(--foreground)',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
              transition: 'all 0.15s',
            }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && renderWorkLogsTab()}
      {tab === 1 && renderRegularScheduleTab()}
      {tab === 2 && renderMembersTab()}
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 2 };
const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' };
