import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';

export default function GamificationManage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('rankings');

  const tabs = [
    { id: 'rankings', label: '🏆 랭킹' },
    { id: 'codes', label: '🔑 코드' },
    { id: 'xp', label: '⚡ XP' },
    { id: 'titles', label: '🎖️ 칭호' },
    { id: 'vocab', label: '📝 어휘' },
    { id: 'knowledge', label: '🧠 지식퀴즈' },
    { id: 'reading', label: '📖 비문학' },
    { id: 'rewards', label: '🎁 보상설정' },
    { id: 'xplog', label: '📊 활동로그' },
    { id: 'shop', label: '🛒 상점' },
    { id: 'backup', label: '💾 백업' },
  ];

  return (
    <div className="content">
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20 }}>🎮 게임 관리</h2>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 8, paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: '0 0 auto', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
              background: tab === t.id ? 'var(--primary)' : 'var(--muted)',
              color: tab === t.id ? 'white' : 'var(--foreground)'
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'rankings' && <RankingsTab />}
      {tab === 'codes' && <CodesTab />}
      {tab === 'xp' && <XpTab />}
      {tab === 'titles' && <TitlesTab />}
      {tab === 'vocab' && <VocabTab />}
      {tab === 'knowledge' && <KnowledgeTab />}
      {tab === 'reading' && <ReadingTab />}
      {tab === 'rewards' && <RewardsTab />}
      {tab === 'xplog' && <XpLogTab />}
      {tab === 'shop' && <ShopTab />}
      {tab === 'backup' && <BackupTab />}

      <button className="btn btn-outline" onClick={() => navigate('/admin')}
        style={{ width: '100%', marginTop: 12 }}>← 대시보드</button>
    </div>
  );
}

// === 랭킹 관리 ===
function RankingsTab() {
  const [rankings, setRankings] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editXp, setEditXp] = useState('');
  const [editPoints, setEditPoints] = useState('');
  const [search, setSearch] = useState('');
  const [rankType, setRankType] = useState('all'); // all, weekly, monthly
  const [periodInfo, setPeriodInfo] = useState(null);

  const load = () => {
    const url = rankType === 'all'
      ? '/gamification/admin/rankings'
      : `/gamification/admin/rankings?type=${rankType}`;
    api(url).then(data => {
      if (data.rankings) {
        setRankings(data.rankings);
        setPeriodInfo(data.since);
      } else {
        setRankings(data);
        setPeriodInfo(null);
      }
    }).catch(console.error);
  };
  useEffect(() => { load(); }, [rankType]);

  const filtered = rankings.filter(r =>
    !search || r.name.includes(search) || (r.school || '').includes(search)
  );

  const handleEdit = (r) => {
    setEditId(r.student_id);
    setEditXp(String(r.xp));
    setEditPoints(String(r.points));
  };

  const handleSave = async (studentId) => {
    try {
      await apiPut(`/gamification/admin/rankings/${studentId}`, {
        xp: parseInt(editXp),
        points: parseInt(editPoints)
      });
      setEditId(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const handleReset = async (studentId, name) => {
    if (!confirm(`${name} 학생의 게임 데이터(XP, 포인트, 레벨)를 초기화하시겠습니까?`)) return;
    try {
      await apiDelete(`/gamification/admin/rankings/${studentId}/reset`);
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDeleteAll = async (studentId, name) => {
    if (!confirm(`⚠️ ${name} 학생의 모든 게임 데이터(캐릭터, 칭호, 퀴즈기록, 구매내역 등)를 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await apiDelete(`/gamification/admin/rankings/${studentId}`);
      load();
    } catch (e) { alert(e.message); }
  };

  const xpLabel = rankType === 'weekly' ? '주간 XP' : rankType === 'monthly' ? '월간 XP' : 'XP';

  return (
    <>
      {/* 전체/주간/월간 서브탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[
          { id: 'all', label: '전체' },
          { id: 'weekly', label: '주간' },
          { id: 'monthly', label: '월간' },
        ].map(t => (
          <button key={t.id} onClick={() => setRankType(t.id)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: rankType === t.id ? 'var(--primary)' : 'var(--muted)',
              color: rankType === t.id ? 'white' : 'var(--foreground)',
            }}>{t.label}</button>
        ))}
      </div>

      {periodInfo && (
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 6, padding: '4px 8px', background: '#eff6ff', borderRadius: 6 }}>
          📅 기간: {new Date(periodInfo).toLocaleDateString('ko-KR')} ~ 오늘
        </div>
      )}

      <input
        placeholder="이름 또는 학교로 검색..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, fontSize: 13, boxSizing: 'border-box' }}
      />

      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6, paddingLeft: 4 }}>
        총 {filtered.length}명 {rankType !== 'all' && `(${rankType === 'weekly' ? '주간' : '월간'} 활동자)`}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.map((r, i) => (
          <div key={r.student_id} style={{
            padding: '12px 14px',
            borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            {/* 학생 정보 행 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 26, fontWeight: 800, fontSize: 13, textAlign: 'center',
                color: r.rank <= 3 ? '#f59e0b' : 'var(--muted-foreground)'
              }}>
                {r.rank}
              </div>
              <span style={{ fontSize: 22 }}>{r.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 6 }}>
                    {r.school} {r.grade}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  Lv.{r.level} · {xpLabel}: {(rankType !== 'all' ? (r.period_xp || 0) : r.xp).toLocaleString()} · 포인트: {r.points.toLocaleString()}
                  {rankType !== 'all' && <span style={{ marginLeft: 4, color: '#94a3b8' }}>(총 XP: {r.xp.toLocaleString()})</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => editId === r.student_id ? setEditId(null) : handleEdit(r)} style={{
                  padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)',
                  borderRadius: 6, background: editId === r.student_id ? 'var(--primary)' : 'var(--card)',
                  color: editId === r.student_id ? 'white' : 'var(--foreground)', cursor: 'pointer'
                }}>수정</button>
                <button onClick={() => handleReset(r.student_id, r.name)} style={{
                  padding: '4px 8px', fontSize: 11, border: '1px solid #f59e0b',
                  borderRadius: 6, background: 'var(--card)', color: '#f59e0b', cursor: 'pointer'
                }}>초기화</button>
                <button onClick={() => handleDeleteAll(r.student_id, r.name)} style={{
                  padding: '4px 8px', fontSize: 11, border: '1px solid var(--destructive)',
                  borderRadius: 6, background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
                }}>삭제</button>
              </div>
            </div>

            {/* 수정 폼 */}
            {editId === r.student_id && (
              <div style={{
                marginTop: 10, padding: 12, background: 'var(--muted)', borderRadius: 8,
                display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 120 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>XP:</label>
                  <input type="number" value={editXp} onChange={e => setEditXp(e.target.value)}
                    style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 120 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>포인트:</label>
                  <input type="number" value={editPoints} onChange={e => setEditPoints(e.target.value)}
                    style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }} />
                </div>
                <button className="btn btn-primary" onClick={() => handleSave(r.student_id)}
                  style={{ fontSize: 12, padding: '6px 16px' }}>저장</button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>
            {search ? '검색 결과가 없습니다.' : '학생 데이터가 없습니다.'}
          </div>
        )}
      </div>
    </>
  );
}

// === 코드 관리 ===
function CodesTab() {
  const [codes, setCodes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [quickXp, setQuickXp] = useState('');
  const [quickMsg, setQuickMsg] = useState(null);
  const [form, setForm] = useState({ code: '', codeType: 'general', xpAmount: 10, description: '', maxUses: '' });

  const load = () => api('/gamification/admin/codes').then(setCodes).catch(console.error);
  useEffect(() => { load(); }, []);

  // 빠른 코드 생성
  const handleQuickCreate = async (xp) => {
    try {
      const result = await apiPost('/gamification/admin/codes', {
        xpAmount: xp, codeType: 'general', description: `히든코드 ${xp}XP`, maxUses: null
      });
      setQuickMsg({ type: 'success', text: `✅ 코드 생성: ${result.code} (${xp} XP)`, code: result.code });
      setQuickXp('');
      load();
    } catch (e) { setQuickMsg({ type: 'error', text: e.message }); }
    setTimeout(() => setQuickMsg(null), 8000);
  };

  const handleCreate = async () => {
    try {
      await apiPost('/gamification/admin/codes', {
        ...form,
        xpAmount: parseInt(form.xpAmount) || 10,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null
      });
      setShowForm(false);
      setForm({ code: '', codeType: 'general', xpAmount: 10, description: '', maxUses: '' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 코드를 삭제하시겠습니까?')) return;
    await apiDelete(`/gamification/admin/codes/${id}`);
    load();
  };

  const handleToggle = async (code) => {
    await apiPut(`/gamification/admin/codes/${code.id}`, { isActive: code.is_active ? 0 : 1 });
    load();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setQuickMsg({ type: 'success', text: `📋 코드 복사됨: ${text}`, code: text });
      setTimeout(() => setQuickMsg(null), 3000);
    });
  };

  return (
    <>
      {/* 빠른 코드 생성 */}
      <div className="card" style={{ padding: 16, marginBottom: 8 }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>⚡ 빠른 히든코드 생성</h4>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[50, 100, 200, 500].map(xp => (
            <button key={xp} onClick={() => handleQuickCreate(xp)} style={{
              flex: 1, minWidth: 60, padding: '10px 4px', borderRadius: 8, border: '1px solid var(--primary)',
              background: 'var(--card)', color: 'var(--primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer'
            }}>
              {xp} XP
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" placeholder="직접 입력 (XP)" value={quickXp}
            onChange={e => setQuickXp(e.target.value)}
            style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8, fontSize: 14 }}
            onKeyDown={e => e.key === 'Enter' && quickXp && handleQuickCreate(parseInt(quickXp))}
          />
          <button className="btn btn-primary" onClick={() => quickXp && handleQuickCreate(parseInt(quickXp))}
            disabled={!quickXp} style={{ whiteSpace: 'nowrap' }}>
            생성
          </button>
        </div>
        {quickMsg && (
          <div style={{
            marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 14,
            background: quickMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: quickMsg.type === 'success' ? '#166534' : '#991b1b',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 600 }}>{quickMsg.text}</span>
            {quickMsg.code && (
              <button onClick={() => copyToClipboard(quickMsg.code)} style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid #166534',
                background: '#f0fdf4', color: '#166534', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>복사</button>
            )}
          </div>
        )}
      </div>

      {/* 상세 코드 생성 */}
      <button onClick={() => setShowForm(!showForm)} style={{
        width: '100%', marginBottom: 8, padding: '10px', borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--card)', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: 13, cursor: 'pointer'
      }}>
        {showForm ? '접기 ▲' : '상세 설정으로 코드 생성 ▼'}
      </button>

      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="코드 (비우면 자동생성)" value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <select value={form.codeType} onChange={e => setForm({ ...form, codeType: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
              <option value="general">일반</option>
              <option value="attendance">출석</option>
              <option value="homework">과제</option>
              <option value="event">이벤트</option>
            </select>
            <input type="number" placeholder="XP 보상" value={form.xpAmount}
              onChange={e => setForm({ ...form, xpAmount: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <input placeholder="설명" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <input type="number" placeholder="최대 사용 횟수 (비우면 무제한)" value={form.maxUses}
              onChange={e => setForm({ ...form, maxUses: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <button className="btn btn-primary" onClick={handleCreate}>생성</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {codes.map((c, i) => (
          <div key={c.id} style={{
            padding: '10px 14px', borderBottom: i < codes.length - 1 ? '1px solid var(--border)' : 'none',
            display: 'flex', alignItems: 'center', gap: 10, opacity: c.is_active ? 1 : 0.5
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 15 }}>{c.code}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                {c.code_type} · {c.xp_amount}XP · 사용 {c.current_uses}/{c.max_uses || '∞'}
                {c.description && ` · ${c.description}`}
              </div>
            </div>
            <button onClick={() => handleToggle(c)} style={{
              padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)',
              borderRadius: 6, background: 'var(--card)', cursor: 'pointer'
            }}>{c.is_active ? '비활성' : '활성'}</button>
            <button onClick={() => handleDelete(c.id)} style={{
              padding: '4px 8px', fontSize: 11, border: '1px solid var(--destructive)',
              borderRadius: 6, background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
            }}>삭제</button>
          </div>
        ))}
        {codes.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>코드가 없습니다.</div>}
      </div>
    </>
  );
}

// === XP 관리 ===
function XpTab() {
  const [overview, setOverview] = useState([]);
  const [adjustForm, setAdjustForm] = useState(null);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');

  const load = () => api('/gamification/admin/xp-overview').then(setOverview).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleAdjust = async (studentId) => {
    if (!amount) return;
    try {
      await apiPut('/gamification/admin/adjust-xp', {
        studentId, amount: parseInt(amount), description: desc
      });
      setAdjustForm(null);
      setAmount('');
      setDesc('');
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {overview.map((s, i) => (
        <div key={s.student_id} style={{
          padding: '10px 14px', borderBottom: i < overview.length - 1 ? '1px solid var(--border)' : 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{s.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name} <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.school} {s.grade}</span></div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                Lv.{s.level} · XP: {s.xp} · 포인트: {s.points}
              </div>
            </div>
            <button onClick={() => setAdjustForm(adjustForm === s.student_id ? null : s.student_id)}
              className="btn btn-outline" style={{ fontSize: 11, padding: '4px 8px' }}>조정</button>
          </div>
          {adjustForm === s.student_id && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input type="number" placeholder="XP 수량 (+/-)" value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ flex: 1, minWidth: 80, padding: 8, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }} />
              <input placeholder="사유" value={desc}
                onChange={e => setDesc(e.target.value)}
                style={{ flex: 2, minWidth: 100, padding: 8, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }} />
              <button className="btn btn-primary" onClick={() => handleAdjust(s.student_id)}
                style={{ fontSize: 12, padding: '6px 12px' }}>적용</button>
            </div>
          )}
        </div>
      ))}
      {overview.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>학생 데이터가 없습니다.</div>}
    </div>
  );
}

// === 칭호 관리 ===
function TitlesTab() {
  const [titles, setTitles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', conditionType: 'manual', conditionValue: 0, icon: '' });

  const load = () => api('/gamification/admin/titles').then(setTitles).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await apiPost('/gamification/admin/titles', {
        ...form, conditionValue: parseInt(form.conditionValue) || 0
      });
      setShowForm(false);
      setForm({ name: '', description: '', conditionType: 'manual', conditionValue: 0, icon: '' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 칭호를 삭제하시겠습니까?')) return;
    await apiDelete(`/gamification/admin/titles/${id}`);
    load();
  };

  return (
    <>
      <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ width: '100%', marginBottom: 8 }}>
        + 칭호 추가
      </button>

      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="칭호 이름" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <input placeholder="아이콘 (이모지)" value={form.icon}
              onChange={e => setForm({ ...form, icon: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <input placeholder="설명" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <select value={form.conditionType} onChange={e => setForm({ ...form, conditionType: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
              <option value="manual">수동 부여</option>
              <option value="xp_total">XP 달성</option>
              <option value="quiz_count">퀴즈 정답 수</option>
              <option value="code_count">코드 사용 수</option>
              <option value="level">레벨 달성</option>
            </select>
            {form.conditionType !== 'manual' && (
              <input type="number" placeholder="목표 수치" value={form.conditionValue}
                onChange={e => setForm({ ...form, conditionValue: e.target.value })}
                style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            )}
            <button className="btn btn-primary" onClick={handleCreate}>추가</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {titles.map((t, i) => (
          <div key={t.id} style={{
            padding: '10px 14px', borderBottom: i < titles.length - 1 ? '1px solid var(--border)' : 'none',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <span style={{ fontSize: 20 }}>{t.icon || '🏷️'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                {t.condition_type === 'manual' ? '수동 부여' :
                  `${t.condition_type} ≥ ${t.condition_value}`}
                {t.description && ` · ${t.description}`}
              </div>
            </div>
            <button onClick={() => handleDelete(t.id)} style={{
              padding: '4px 8px', fontSize: 11, border: '1px solid var(--destructive)',
              borderRadius: 6, background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
            }}>삭제</button>
          </div>
        ))}
        {titles.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>칭호가 없습니다.</div>}
      </div>
    </>
  );
}

// === 지식 퀴즈 관리 ===
function KnowledgeTab() {
  const [questions, setQuestions] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const load = () => {
    api('/gamification/knowledge/categories').then(cats => {
      // categories만 가져옴
      setQuestions(cats);
    }).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const handleReseed = async () => {
    if (!confirm('⚠️ 기존 지식 퀴즈 문제를 모두 삭제하고 최신 시드 데이터로 교체합니다.\n(학생들의 정답 기록은 유지되지만 문제와 연결이 끊길 수 있습니다)\n\n계속하시겠습니까?')) return;
    setLoading(true);
    try {
      const result = await apiPost('/gamification/admin/knowledge/reseed', {});
      setMsg({ type: 'success', text: result.message });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🧠 지식 퀴즈 문제</h3>
        <button onClick={handleReseed} disabled={loading}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? '처리 중...' : '🔄 문제 리시드'}
        </button>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 10, fontSize: 13, fontWeight: 600,
          background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
          color: msg.type === 'success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>{msg.text}</div>
      )}

      <div className="card" style={{ padding: 14, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.7 }}>
          💡 <strong>리시드 안내</strong>: 관리자가 시드 파일(knowledgeQuizSeed.js)을 수정한 후<br />
          "문제 리시드" 버튼을 누르면 서버에 배포된 새 문제로 교체됩니다.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {questions.map(c => (
          <div key={c.category} style={{
            padding: '10px 16px', borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd',
            fontSize: 13, fontWeight: 600, color: '#0369a1'
          }}>
            {c.category} <span style={{ fontWeight: 800, color: '#0284c7' }}>({c.count}문제)</span>
          </div>
        ))}
        {questions.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>카테고리를 불러오는 중...</div>
        )}
      </div>
    </div>
  );
}

function ReadingTab() {
  const [passages, setPassages] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    api('/gamification/reading/categories').then(cats => {
      setPassages(cats);
    }).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const handleReseed = async () => {
    if (!confirm('⚠️ 기존 비문학 지문과 문제를 모두 삭제하고 최신 시드 데이터로 교체합니다.\n(학생들의 독해 기록은 초기화됩니다)\n\n계속하시겠습니까?')) return;
    setLoading(true);
    try {
      const result = await apiPost('/gamification/admin/reading/reseed', {});
      setMsg({ type: 'success', text: result.message });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📖 비문학 독해 지문</h3>
        <button onClick={handleReseed} disabled={loading}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #8b5cf6', background: '#faf5ff', color: '#6b21a8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? '처리 중...' : '🔄 지문 리시드'}
        </button>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 10, fontSize: 13, fontWeight: 600,
          background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
          color: msg.type === 'success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>{msg.text}</div>
      )}

      <div className="card" style={{ padding: 14, background: '#faf5ff', border: '1px solid #e9d5ff', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: '#6b21a8', lineHeight: 1.7 }}>
          💡 <strong>리시드 안내</strong>: 관리자가 시드 파일(readingPassageSeed.js)을 수정한 후<br />
          "지문 리시드" 버튼을 누르면 서버에 배포된 새 지문으로 교체됩니다.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {passages.map(c => (
          <div key={c.category} style={{
            padding: '10px 16px', borderRadius: 10, background: '#faf5ff', border: '1px solid #e9d5ff',
            fontSize: 13, fontWeight: 600, color: '#6b21a8'
          }}>
            {c.category} <span style={{ fontWeight: 800, color: '#7c3aed' }}>({c.count}지문)</span>
          </div>
        ))}
        {passages.length === 0 && (
          <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>카테고리를 불러오는 중...</div>
        )}
      </div>
    </div>
  );
}

// === 어휘 관리 ===
function VocabTab() {
  const [words, setWords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [reseedMsg, setReseedMsg] = useState(null);
  const [form, setForm] = useState({
    category: '사자성어', questionText: '', correctAnswer: '',
    wrongAnswer1: '', wrongAnswer2: '', wrongAnswer3: '',
    difficulty: 1, explanation: ''
  });

  const load = () => {
    const params = filter ? `?category=${filter}` : '';
    api(`/gamification/admin/vocab${params}`).then(setWords).catch(console.error);
  };
  useEffect(() => { load(); }, [filter]);

  const handleReseed = async () => {
    if (!confirm('⚠️ 기존 어휘를 모두 삭제하고 vocabSeed.js 파일에서 다시 불러옵니다.\n\n직접 추가한 문제도 삭제됩니다. 계속하시겠습니까?')) return;
    try {
      const result = await apiPost('/gamification/admin/vocab/reseed', {});
      setReseedMsg({ type: 'success', text: result.message });
      load();
    } catch (e) { setReseedMsg({ type: 'error', text: e.message }); }
    setTimeout(() => setReseedMsg(null), 3000);
  };

  const handleCreate = async () => {
    try {
      await apiPost('/gamification/admin/vocab', {
        category: form.category,
        questionText: form.questionText,
        correctAnswer: form.correctAnswer,
        wrongAnswers: [form.wrongAnswer1, form.wrongAnswer2, form.wrongAnswer3].filter(Boolean),
        difficulty: parseInt(form.difficulty) || 1,
        explanation: form.explanation
      });
      setShowForm(false);
      setForm({ category: '사자성어', questionText: '', correctAnswer: '', wrongAnswer1: '', wrongAnswer2: '', wrongAnswer3: '', difficulty: 1, explanation: '' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;
    await apiDelete(`/gamification/admin/vocab/${id}`);
    load();
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
          <option value="">전체</option>
          <option value="사자성어">사자성어</option>
          <option value="맞춤법">맞춤법</option>
          <option value="어휘">어휘</option>
          <option value="문법">문법</option>
          <option value="고전시가">고전시가</option>
          <option value="문학개념어">문학개념어</option>
        </select>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ 추가</button>
        <button onClick={handleReseed} style={{
          padding: '8px 12px', borderRadius: 8, border: '1px solid #f59e0b', background: '#fffbeb',
          color: '#92400e', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap'
        }}>🔄 리시드</button>
        <button onClick={() => {
          const token = localStorage.getItem('token');
          window.open(`/api/gamification/admin/vocab/export?token=${token}`, '_blank');
        }} style={{
          padding: '8px 12px', borderRadius: 8, border: '1px solid #22c55e', background: '#f0fdf4',
          color: '#166534', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap'
        }}>📥 엑셀</button>
      </div>

      {reseedMsg && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 8, fontSize: 13, fontWeight: 500,
          background: reseedMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
          color: reseedMsg.type === 'success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${reseedMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>{reseedMsg.text}</div>
      )}

      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
              <option value="사자성어">사자성어</option>
              <option value="맞춤법">맞춤법</option>
              <option value="어휘">어휘</option>
              <option value="문법">문법</option>
              <option value="고전시가">고전시가</option>
              <option value="문학개념어">문학개념어</option>
            </select>
            <input placeholder="문제" value={form.questionText}
              onChange={e => setForm({ ...form, questionText: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <input placeholder="정답" value={form.correctAnswer}
              onChange={e => setForm({ ...form, correctAnswer: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: '#f0fdf4' }} />
            <input placeholder="오답 1" value={form.wrongAnswer1}
              onChange={e => setForm({ ...form, wrongAnswer1: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <input placeholder="오답 2" value={form.wrongAnswer2}
              onChange={e => setForm({ ...form, wrongAnswer2: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <input placeholder="오답 3" value={form.wrongAnswer3}
              onChange={e => setForm({ ...form, wrongAnswer3: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}
                style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
                <option value={1}>쉬움</option>
                <option value={2}>보통</option>
                <option value={3}>어려움</option>
              </select>
            </div>
            <input placeholder="해설 (선택)" value={form.explanation}
              onChange={e => setForm({ ...form, explanation: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} />
            <button className="btn btn-primary" onClick={handleCreate}>추가</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
          총 {words.length}문제
        </div>
        {words.slice(0, 50).map((w, i) => {
          let wrongArr = [];
          try { wrongArr = JSON.parse(w.wrong_answers); } catch {}
          return (
            <div key={w.id} style={{
              padding: '10px 14px', borderBottom: i < Math.min(words.length, 50) - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <div style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                background: 'var(--muted)', color: 'var(--muted-foreground)', whiteSpace: 'nowrap'
              }}>{w.category}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{w.question_text}</div>
                <div style={{ fontSize: 11, color: '#16a34a' }}>✅ {w.correct_answer}</div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>난이도{w.difficulty}</span>
              <button onClick={() => handleDelete(w.id)} style={{
                padding: '4px 6px', fontSize: 10, border: '1px solid var(--destructive)',
                borderRadius: 4, background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
              }}>삭제</button>
            </div>
          );
        })}
        {words.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>문제가 없습니다.</div>}
      </div>
    </>
  );
}

// === 상점 관리 ===
function ShopTab() {
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [subTab, setSubTab] = useState('items');
  const [form, setForm] = useState({ name: '', description: '', icon: '🎁', price: '', stock: '', imageUrl: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '', icon: '', price: '', stock: '', imageUrl: '' });

  const load = () => {
    api('/gamification/admin/shop').then(setItems).catch(console.error);
    api('/gamification/admin/shop/purchases').then(setPurchases).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await apiPost('/gamification/admin/shop', {
        ...form,
        price: parseInt(form.price) || 0,
        stock: form.stock ? parseInt(form.stock) : null
      });
      setShowForm(false);
      setForm({ name: '', description: '', icon: '🎁', price: '', stock: '', imageUrl: '' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 상품을 삭제하시겠습니까?')) return;
    await apiDelete(`/gamification/admin/shop/${id}`);
    load();
  };

  const handleToggle = async (item) => {
    await apiPut(`/gamification/admin/shop/${item.id}`, { isActive: item.is_active ? 0 : 1 });
    load();
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name || '',
      description: item.description || '',
      icon: item.icon || '🎁',
      price: item.price?.toString() || '',
      stock: item.stock !== null ? item.stock.toString() : '',
      imageUrl: item.image_url || ''
    });
  };

  const handleEdit = async () => {
    try {
      await apiPut(`/gamification/admin/shop/${editingId}`, {
        name: editForm.name,
        description: editForm.description,
        icon: editForm.icon,
        price: parseInt(editForm.price) || 0,
        stock: editForm.stock ? parseInt(editForm.stock) : null,
        imageUrl: editForm.imageUrl
      });
      setEditingId(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const handlePurchaseStatus = async (purchaseId, status) => {
    await apiPut(`/gamification/admin/shop/purchases/${purchaseId}`, { status });
    load();
  };

  const pendingCount = purchases.filter(p => p.status === 'pending').length;
  const inputStyle = { padding: 10, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box' };

  return (
    <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button onClick={() => setSubTab('items')} style={{
          flex: 1, padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          background: subTab === 'items' ? 'var(--primary)' : 'var(--muted)',
          color: subTab === 'items' ? 'white' : 'var(--foreground)'
        }}>상품 관리</button>
        <button onClick={() => setSubTab('purchases')} style={{
          flex: 1, padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          background: subTab === 'purchases' ? 'var(--primary)' : 'var(--muted)',
          color: subTab === 'purchases' ? 'white' : 'var(--foreground)',
          position: 'relative'
        }}>
          구매 내역
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: 'var(--destructive)', color: 'white',
              borderRadius: '50%', width: 18, height: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10
            }}>{pendingCount}</span>
          )}
        </button>
      </div>

      {subTab === 'items' && (
        <>
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); }} style={{ width: '100%', marginBottom: 8 }}>
            + 상품 추가
          </button>

          {showForm && (
            <div className="card" style={{ padding: 16, marginBottom: 8 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>새 상품 추가</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input placeholder="상품명" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                <input placeholder="설명" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input placeholder="아이콘 (이모지)" value={form.icon}
                    onChange={e => setForm({ ...form, icon: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" placeholder="가격 (P)" value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" placeholder="재고" value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={() => setForm({ ...form, stock: '' })} style={{
                    padding: '8px 12px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
                    borderRadius: 8, background: !form.stock ? '#dbeafe' : 'var(--card)', cursor: 'pointer', whiteSpace: 'nowrap',
                    color: !form.stock ? '#1e40af' : 'var(--foreground)'
                  }}>∞ 무제한</button>
                </div>
                <input placeholder="이미지 URL (선택)" value={form.imageUrl}
                  onChange={e => setForm({ ...form, imageUrl: e.target.value })} style={inputStyle} />
                <button className="btn btn-primary" onClick={handleCreate}>추가</button>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((item, i) => (
              <div key={item.id} style={{
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: item.is_active ? 1 : 0.5
              }}>
                {editingId === item.id ? (
                  <div style={{ padding: 14 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>✏️ 상품 수정</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input placeholder="상품명" value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} />
                      <input placeholder="설명" value={editForm.description}
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={inputStyle} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input placeholder="아이콘" value={editForm.icon}
                          onChange={e => setEditForm({ ...editForm, icon: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                        <input type="number" placeholder="가격 (P)" value={editForm.price}
                          onChange={e => setEditForm({ ...editForm, price: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="number" placeholder="재고" value={editForm.stock}
                          onChange={e => setEditForm({ ...editForm, stock: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                        <button type="button" onClick={() => setEditForm({ ...editForm, stock: '' })} style={{
                          padding: '8px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
                          borderRadius: 8, background: !editForm.stock ? '#dbeafe' : 'var(--card)', cursor: 'pointer', whiteSpace: 'nowrap',
                          color: !editForm.stock ? '#1e40af' : 'var(--foreground)'
                        }}>∞ 무제한</button>
                      </div>
                      <input placeholder="이미지 URL" value={editForm.imageUrl}
                        onChange={e => setEditForm({ ...editForm, imageUrl: e.target.value })} style={inputStyle} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary" onClick={handleEdit} style={{ flex: 1 }}>저장</button>
                        <button className="btn btn-outline" onClick={() => setEditingId(null)} style={{ flex: 1 }}>취소</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <span style={{ fontSize: 24 }}>{item.icon || '🎁'}</span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {item.price}P · 재고: {item.stock !== null ? item.stock : '∞'}
                        {item.description && ` · ${item.description}`}
                      </div>
                    </div>
                    <button onClick={() => { startEdit(item); setShowForm(false); }} style={{
                      padding: '4px 8px', fontSize: 11, border: '1px solid var(--primary)',
                      borderRadius: 6, background: 'var(--card)', color: 'var(--primary)', cursor: 'pointer'
                    }}>수정</button>
                    <button onClick={() => handleToggle(item)} style={{
                      padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)',
                      borderRadius: 6, background: 'var(--card)', cursor: 'pointer'
                    }}>{item.is_active ? '비활성' : '활성'}</button>
                    <button onClick={() => handleDelete(item.id)} style={{
                      padding: '4px 8px', fontSize: 11, border: '1px solid var(--destructive)',
                      borderRadius: 6, background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
                    }}>삭제</button>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>상품이 없습니다.</div>}
          </div>
        </>
      )}

      {subTab === 'purchases' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {purchases.length > 0 && (
            <div style={{ padding: '8px 14px', background: 'var(--muted)', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>
              대기 {pendingCount}건 · 완료 {purchases.length - pendingCount}건
            </div>
          )}
          {purchases.map((p, i) => (
            <div key={p.id} style={{
              padding: '10px 14px', borderBottom: i < purchases.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', alignItems: 'center', gap: 10,
              background: p.status === 'pending' ? '#fef3c710' : 'transparent'
            }}>
              <span style={{ fontSize: 20 }}>{p.icon || '🎁'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {p.student_name} · {p.item_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {p.school} {p.grade} · {new Date(p.created_at).toLocaleDateString('ko-KR')} · {p.price_paid}P
                </div>
              </div>
              {p.status === 'pending' ? (
                <button onClick={() => handlePurchaseStatus(p.id, 'completed')}
                  className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}>
                  지급 완료
                </button>
              ) : (
                <button onClick={() => handlePurchaseStatus(p.id, 'pending')}
                  style={{
                    fontSize: 11, padding: '4px 10px', border: '1px solid #16a34a',
                    borderRadius: 6, background: '#dcfce7', color: '#166534',
                    cursor: 'pointer', fontWeight: 600
                  }}>
                  ✅ 지급완료 (취소)
                </button>
              )}
            </div>
          ))}
          {purchases.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>구매 내역이 없습니다.</div>}
        </div>
      )}
    </>
  );
}

// === 백업 관리 ===
function XpLogTab() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState([]);
  const [days, setDays] = useState(7);
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('days', days);
      if (sourceFilter) params.set('source', sourceFilter);
      const data = await api(`/gamification/admin/xp-logs?${params}`);
      setLogs(data.logs || []);
      setSummary(data.summary || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [days, sourceFilter]);

  const sourceLabels = {
    vocab_quiz: '어휘 퀴즈', knowledge_quiz: '지식 퀴즈', reading_quiz: '비문학 독해',
    daily_login: '출석 보너스', code_redeem: '코드 사용', avatar_change: '아바타 변경',
    nickname_change: '닉네임 변경', admin_adjust: '관리자 조정', homework_bonus: '과제 보너스',
    ox_quiz: 'O/X 퀴즈',
  };
  const getSourceLabel = (s) => sourceLabels[s] || s;

  const filtered = search
    ? logs.filter(l => l.student_name?.includes(search) || l.source?.includes(search) || l.description?.includes(search))
    : logs;

  return (
    <div>
      {/* 요약 카드 */}
      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📊 소스별 XP 요약 (최근 {days}일)</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-outline'}`}>{d}일</button>
          ))}
        </div>
        {summary.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
            {summary.map(s => (
              <div key={s.source} onClick={() => setSourceFilter(sourceFilter === s.source ? '' : s.source)}
                style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: sourceFilter === s.source ? '#eff6ff' : '#f8fafc',
                  border: `1px solid ${sourceFilter === s.source ? '#3b82f6' : 'var(--border)'}`,
                }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>{getSourceLabel(s.source)}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{s.total_amount?.toLocaleString()} XP</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.count}건</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 13 }}>데이터 없음</div>
        )}
      </div>

      {/* 로그 목록 */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📋 활동 로그 ({filtered.length}건)</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름/소스 검색..."
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, width: 160 }} />
        </div>

        {sourceFilter && (
          <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 8 }}>
            필터: {getSourceLabel(sourceFilter)} <button onClick={() => setSourceFilter('')}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>✕ 해제</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>로딩 중...</div>
        ) : (
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {filtered.map(l => (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9',
                fontSize: 12, gap: 8,
              }}>
                <span style={{ fontWeight: 600, minWidth: 50 }}>{l.student_name}</span>
                <span style={{ color: '#64748b', fontSize: 11, minWidth: 50 }}>{l.school}</span>
                <span style={{
                  padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: l.amount > 0 ? '#dcfce7' : l.amount < 0 ? '#fef2f2' : '#f1f5f9',
                  color: l.amount > 0 ? '#166534' : l.amount < 0 ? '#dc2626' : '#64748b',
                }}>
                  {l.amount > 0 ? '+' : ''}{l.amount} XP
                </span>
                <span style={{ color: '#94a3b8', fontSize: 10 }}>{getSourceLabel(l.source)}</span>
                {l.description && <span style={{ color: '#64748b', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</span>}
                <span style={{ color: '#94a3b8', fontSize: 10, flexShrink: 0 }}>
                  {new Date(l.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>로그가 없습니다.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BackupTab() {
  const [backups, setBackups] = useState([]);
  const [slots, setSlots] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadBackups = () => api('/gamification/admin/backup/list').then(setBackups).catch(console.error);
  const loadSlots = () => api('/gamification/admin/backup/slots').then(setSlots).catch(console.error);
  useEffect(() => { loadBackups(); loadSlots(); }, []);

  const handleSlotBackup = async (slot) => {
    if (!confirm(`서버 ${slot}에 현재 데이터를 백업합니다.\n기존 백업은 덮어씌워집니다.\n\n계속하시겠습니까?`)) return;
    setLoading(true);
    try {
      const result = await apiPost(`/gamification/admin/backup/slot/${slot}`, {});
      setMsg({ type: 'success', text: result.message });
      loadSlots();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const handleSlotRestore = async (slot) => {
    if (!confirm(`⚠️ 서버 ${slot}의 백업으로 복원합니다.\n현재 데이터가 백업 시점으로 돌아갑니다.\n\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?`)) return;
    setLoading(true);
    try {
      const result = await apiPost(`/gamification/admin/backup/slot/${slot}/restore`, {});
      setMsg({ type: 'success', text: result.message });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
    setTimeout(() => setMsg(null), 5000);
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/gamification/admin/backup/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `student-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ type: 'success', text: '백업 파일 다운로드 완료!' });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const handleAutoBackup = async () => {
    setLoading(true);
    try {
      const result = await apiPost('/gamification/admin/backup/auto', {});
      setMsg({ type: 'success', text: result.message });
      loadBackups();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const handleSeedStudents = async () => {
    if (!confirm('테스트 학생 100명(학교별 20명)을 생성합니다.\n이미 존재하는 아이디는 건너뜁니다.\n\n계속하시겠습니까?')) return;
    setLoading(true);
    try {
      const result = await apiPost('/gamification/admin/seed-students', {});
      setMsg({ type: 'success', text: result.message });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setLoading(false);
    setTimeout(() => setMsg(null), 5000);
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('⚠️ 기존 학생 데이터를 모두 삭제하고 백업 파일로 복원합니다.\n\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) {
      e.target.value = '';
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const result = await apiPost('/gamification/admin/restore/students', backup);
      setMsg({ type: 'success', text: result.message });
    } catch (e) { setMsg({ type: 'error', text: '복원 실패: ' + e.message }); }
    e.target.value = '';
    setLoading(false);
    setTimeout(() => setMsg(null), 5000);
  };

  return (
    <>
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>💾</div>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>학생 데이터 백업</h3>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>
          학생 정보, 성적, 게임 데이터 등 모든 학생 관련 데이터를 백업/복원합니다.
        </p>

        {msg && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 500,
            background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: msg.type === 'success' ? '#16a34a' : '#dc2626',
            border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}>{msg.text}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleDownload} disabled={loading}
            style={{ width: '100%', fontSize: 14, padding: '12px' }}>
            📥 백업 파일 다운로드 (JSON)
          </button>
          <button onClick={handleAutoBackup} disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--primary)',
            background: 'var(--card)', color: 'var(--primary)', fontWeight: 600, fontSize: 14, cursor: 'pointer'
          }}>
            🗄️ 서버에 백업 저장
          </button>
          <label style={{
            width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #f59e0b',
            background: '#fffbeb', color: '#92400e', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            textAlign: 'center', boxSizing: 'border-box'
          }}>
            📤 백업 파일로 복원
            <input type="file" accept=".json" onChange={handleRestore} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* 슬롯 백업 (서버 1/2/3) */}
      <div className="card" style={{ padding: 16, marginTop: 8 }}>
        <h4 style={{ fontSize: 14, marginBottom: 4 }}>🗄️ 서버 백업 슬롯</h4>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 12 }}>
          3개의 슬롯에 전체 데이터를 저장/복원할 수 있습니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(slot => {
            const info = slots.find(s => s.slot === slot);
            const isEmpty = !info || info.empty;
            const totalRows = info?.rowCounts ? Object.values(info.rowCounts).reduce((s, v) => s + v, 0) : 0;
            return (
              <div key={slot} style={{
                border: '1px solid var(--border)', borderRadius: 10, padding: 12,
                background: isEmpty ? '#f8fafc' : 'white',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isEmpty ? '#e2e8f0' : '#3b82f6', color: 'white', fontWeight: 800, fontSize: 13,
                    }}>{slot}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>서버 {slot}</div>
                      {isEmpty ? (
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>비어있음</div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {new Date(info.created_at).toLocaleString('ko-KR')} · {info.tableCount}테이블 · {totalRows.toLocaleString()}행
                          {info.size && <span> · {(info.size / 1024 / 1024).toFixed(1)}MB</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleSlotBackup(slot)} disabled={loading}
                    className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 12 }}>
                    💾 백업
                  </button>
                  {!isEmpty && (
                    <button onClick={() => handleSlotRestore(slot)} disabled={loading}
                      className="btn btn-outline btn-sm" style={{ flex: 1, fontSize: 12, borderColor: '#f59e0b', color: '#92400e' }}>
                      📤 복원
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 학생 시드 */}
      <div className="card" style={{ padding: 16, marginTop: 8 }}>
        <h4 style={{ fontSize: 14, marginBottom: 8 }}>👥 테스트 학생 데이터</h4>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
          학교별 20명씩 (계성고, 경신고, 용문고, 대일외고, 중3) 총 100명의 테스트 학생을 생성합니다.<br/>
          이미 존재하는 아이디는 건너뜁니다. 비밀번호: 1234
        </p>
        <button onClick={handleSeedStudents} disabled={loading} style={{
          width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #8b5cf6',
          background: '#f5f3ff', color: '#6d28d9', fontWeight: 600, fontSize: 13, cursor: 'pointer'
        }}>
          👥 테스트 학생 100명 생성
        </button>
      </div>

      {/* 게임 설정 리셋 */}
      <div className="card" style={{ padding: 16, marginTop: 8 }}>
        <h4 style={{ fontSize: 14, marginBottom: 8 }}>⚙️ 게임 설정 리셋</h4>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
          상점 가격, 칭호, 캐릭터 잠금레벨을 최신 설정으로 다시 적용합니다.<br/>
          학생 데이터(XP, 구매기록 등)는 유지됩니다.
        </p>
        <button onClick={async () => {
          if (!confirm('상점/칭호/캐릭터 설정을 리셋합니다.\n학생 데이터는 유지됩니다.\n\n계속하시겠습니까?')) return;
          setLoading(true);
          try {
            const result = await apiPost('/gamification/admin/reseed-game-config', {});
            setMsg({ type: 'success', text: result.message });
          } catch (e) { setMsg({ type: 'error', text: e.message }); }
          setLoading(false);
          setTimeout(() => setMsg(null), 5000);
        }} disabled={loading} style={{
          width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ef4444',
          background: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer'
        }}>
          🔄 상점/칭호/캐릭터 설정 리셋
        </button>
      </div>

      {/* 서버 백업 목록 */}
      {backups.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
          <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
            🗄️ 서버 백업 기록 (최근 30일)
          </div>
          {backups.map((b, i) => (
            <div key={b.date} style={{
              padding: '10px 14px', borderBottom: i < backups.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>📁 {b.date}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {b.fileCount}개 파일 · {(b.size / 1024).toFixed(1)}KB
                </span>
              </div>
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {b.files.filter(f => f !== 'full-backup.json').map(f => (
                  <span key={f} style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: 'var(--muted)', color: 'var(--muted-foreground)'
                  }}>{f.replace('.json', '')}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// === 보상 설정 탭 ===
function RewardsTab() {
  const [settings, setSettings] = useState({ weekly: {}, monthly: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/gamification/reward-settings').then(data => {
      const w = {}, m = {};
      data.forEach(s => {
        if (s.type === 'weekly') w[s.rank] = s.amount;
        else m[s.rank] = s.amount;
      });
      // 기본값 채우기
      for (let i = 1; i <= 10; i++) {
        if (!w[i]) w[i] = 0;
        if (!m[i]) m[i] = 0;
      }
      setSettings({ weekly: w, monthly: m });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const updateVal = (type, rank, val) => {
    setSettings(prev => ({
      ...prev,
      [type]: { ...prev[type], [rank]: parseInt(val) || 0 }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allSettings = [];
      Object.entries(settings.weekly).forEach(([rank, amount]) => {
        allSettings.push({ type: 'weekly', rank: parseInt(rank), amount });
      });
      Object.entries(settings.monthly).forEach(([rank, amount]) => {
        allSettings.push({ type: 'monthly', rank: parseInt(rank), amount });
      });
      await apiPost('/gamification/reward-settings', { settings: allSettings });
      setMsg('보상 설정이 저장되었습니다!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 20 }}>로딩중...</div>;

  const rankLabels = { 1: '🥇 1위', 2: '🥈 2위', 3: '🥉 3위' };

  return (
    <>
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🎁 랭킹 보상 포인트 설정</h3>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>
          주간/월간 랭킹 보상으로 지급되는 XP+포인트를 설정합니다.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* 주간 */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#2563eb' }}>📅 주간 보상</h4>
            {[1,2,3,4,5,6,7,8,9,10].map(rank => (
              <div key={rank} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 50 }}>
                  {rankLabels[rank] || `${rank}위`}
                </span>
                <input type="number" value={settings.weekly[rank] || 0}
                  onChange={e => updateVal('weekly', rank, e.target.value)}
                  style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
                />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>pt</span>
              </div>
            ))}
          </div>

          {/* 월간 */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#16a34a' }}>📆 월간 보상</h4>
            {[1,2,3,4,5,6,7,8,9,10].map(rank => (
              <div key={rank} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 50 }}>
                  {rankLabels[rank] || `${rank}위`}
                </span>
                <input type="number" value={settings.monthly[rank] || 0}
                  onChange={e => updateVal('monthly', rank, e.target.value)}
                  style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right' }}
                />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>pt</span>
              </div>
            ))}
          </div>
        </div>

        {msg && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8,
            background: msg.includes('실패') ? '#fee2e2' : '#dcfce7',
            color: msg.includes('실패') ? '#991b1b' : '#166534', fontSize: 13, fontWeight: 600 }}>
            {msg}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}
          style={{ width: '100%', marginTop: 12 }}>
          {saving ? '저장중...' : '💾 보상 설정 저장'}
        </button>
      </div>
    </>
  );
}
