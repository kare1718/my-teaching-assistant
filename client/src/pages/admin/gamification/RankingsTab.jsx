import { useState, useEffect } from 'react';
import { api, apiPut, apiDelete } from '../../../api';

export default function RankingsTab() {
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
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
        {[
          { id: 'all', label: '전체' },
          { id: 'weekly', label: '주간' },
          { id: 'monthly', label: '월간' },
        ].map(t => (
          <button key={t.id} onClick={() => setRankType(t.id)}
            style={{
              flex: 1, padding: 'var(--space-2) 0', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: rankType === t.id ? 'var(--primary)' : 'var(--muted)',
              color: rankType === t.id ? 'white' : 'var(--foreground)',
            }}>{t.label}</button>
        ))}
      </div>

      {periodInfo && (
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 6, padding: 'var(--space-1) var(--space-2)', background: 'var(--info-light)', borderRadius: 'var(--radius-sm)' }}>
          📅 기간: {new Date(periodInfo).toLocaleDateString('ko-KR')} ~ 오늘
        </div>
      )}

      <input
        placeholder="이름 또는 학교로 검색..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)', fontSize: 13, boxSizing: 'border-box' }}
      />

      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 6, paddingLeft: 'var(--space-1)' }}>
        총 {filtered.length}명 {rankType !== 'all' && `(${rankType === 'weekly' ? '주간' : '월간'} 활동자)`}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.map((r, i) => (
          <div key={r.student_id} style={{
            padding: 'var(--space-3) 14px',
            borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            {/* 학생 정보 행 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 26, fontWeight: 800, fontSize: 13, textAlign: 'center',
                color: r.rank <= 3 ? 'var(--warning)' : 'var(--muted-foreground)'
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
                  {rankType !== 'all' && <span style={{ marginLeft: 'var(--space-1)', color: 'var(--muted-foreground)' }}>(총 XP: {r.xp.toLocaleString()})</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                <button onClick={() => editId === r.student_id ? setEditId(null) : handleEdit(r)} style={{
                  padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', background: editId === r.student_id ? 'var(--primary)' : 'var(--card)',
                  color: editId === r.student_id ? 'white' : 'var(--foreground)', cursor: 'pointer'
                }}>수정</button>
                <button onClick={() => handleReset(r.student_id, r.name)} style={{
                  padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--warning)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--warning)', cursor: 'pointer'
                }}>초기화</button>
                <button onClick={() => handleDeleteAll(r.student_id, r.name)} style={{
                  padding: 'var(--space-1) var(--space-2)', fontSize: 11, border: '1px solid var(--destructive)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
                }}>삭제</button>
              </div>
            </div>

            {/* 수정 폼 */}
            {editId === r.student_id && (
              <div style={{
                marginTop: 10, padding: 'var(--space-3)', background: 'var(--muted)', borderRadius: 'var(--radius)',
                display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flex: 1, minWidth: 120 }}>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>XP:</label>
                  <input type="number" value={editXp} onChange={e => setEditXp(e.target.value)} min="0"
                    style={{ flex: 1, padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flex: 1, minWidth: 120 }}>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>포인트:</label>
                  <input type="number" value={editPoints} onChange={e => setEditPoints(e.target.value)} min="0"
                    style={{ flex: 1, padding: 'var(--space-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }} />
                </div>
                <button className="btn btn-primary" onClick={() => handleSave(r.student_id)}
                  style={{ fontSize: 'var(--text-xs)', padding: '6px var(--space-4)' }}>저장</button>
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
