import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiRaw } from '../../api';

export default function BackupManage() {
  const navigate = useNavigate();
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
      const res = await apiRaw('/gamification/admin/backup/students');
      if (!res.ok) throw new Error(`백업 다운로드 실패 (${res.status})`);
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
    <div className="content">
      <div className="breadcrumb">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/admin'); }}>대시보드</a> &gt; <span>백업 관리</span>
      </div>

      <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 'var(--space-2)' }}>💾</div>
        <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>학생 데이터 백업</h3>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 'var(--space-4)' }}>
          학생 정보, 성적, 게임 데이터 등 모든 학생 관련 데이터를 백업/복원합니다.
        </p>

        {msg && (
          <div style={{
            padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)', fontSize: 13, fontWeight: 500,
            background: msg.type === 'success' ? 'var(--success-light)' : 'var(--destructive-light)',
            color: msg.type === 'success' ? 'var(--success)' : 'var(--destructive)',
            border: `1px solid ${msg.type === 'success' ? 'oklch(90% 0.06 145)' : 'oklch(88% 0.06 25)'}`
          }}>{msg.text}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <button className="btn btn-primary" onClick={handleDownload} disabled={loading}
            style={{ width: '100%', fontSize: 'var(--text-sm)', padding: 'var(--space-3)' }}>
            📥 백업 파일 다운로드 (JSON)
          </button>
          <button onClick={handleAutoBackup} disabled={loading} style={{
            width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius)', border: '1px solid var(--primary)',
            background: 'var(--card)', color: 'var(--primary)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer'
          }}>
            🗄️ 서버에 백업 저장
          </button>
          <label style={{
            width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius)', border: '1px solid var(--warning)',
            background: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
            textAlign: 'center', boxSizing: 'border-box'
          }}>
            📤 백업 파일로 복원
            <input type="file" accept=".json" onChange={handleRestore} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* 슬롯 백업 */}
      <div className="card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
        <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>🗄️ 서버 백업 슬롯</h4>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 'var(--space-3)' }}>
          3개의 슬롯에 전체 데이터를 저장/복원할 수 있습니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[1, 2, 3].map(slot => {
            const info = slots.find(s => s.slot === slot);
            const isEmpty = !info || info.empty;
            const totalRows = info?.rowCounts ? Object.values(info.rowCounts).reduce((s, v) => s + v, 0) : 0;
            return (
              <div key={slot} style={{
                border: '1px solid var(--border)', borderRadius: 10, padding: 'var(--space-3)',
                background: isEmpty ? 'var(--neutral-50)' : 'var(--card)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isEmpty ? 'var(--border)' : 'var(--primary)', color: 'var(--card)', fontWeight: 800, fontSize: 13,
                    }}>{slot}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>서버 {slot}</div>
                      {isEmpty ? (
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>비어있음</div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                          {new Date(info.created_at).toLocaleString('ko-KR')} · {info.tableCount}테이블 · {totalRows.toLocaleString()}행
                          {info.size && <span> · {(info.size / 1024 / 1024).toFixed(1)}MB</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button onClick={() => handleSlotBackup(slot)} disabled={loading}
                    className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 'var(--text-xs)' }}>
                    💾 백업
                  </button>
                  {!isEmpty && (
                    <button onClick={() => handleSlotRestore(slot)} disabled={loading}
                      className="btn btn-outline btn-sm" style={{ flex: 1, fontSize: 'var(--text-xs)', borderColor: 'var(--warning)', color: 'oklch(35% 0.12 75)' }}>
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
      <div className="card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
        <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>👥 테스트 학생 데이터</h4>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 'var(--space-3)' }}>
          학교별 20명씩 (계성고, 경신고, 용문고, 대일외고, 중3) 총 100명의 테스트 학생을 생성합니다.<br/>
          이미 존재하는 아이디는 건너뜁니다. 비밀번호: 1234
        </p>
        <button onClick={handleSeedStudents} disabled={loading} style={{
          width: '100%', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid oklch(55% 0.20 290)',
          background: 'oklch(96% 0.02 290)', color: 'oklch(38% 0.20 290)', fontWeight: 600, fontSize: 13, cursor: 'pointer'
        }}>
          👥 테스트 학생 100명 생성
        </button>
      </div>

      {/* 게임 설정 리셋 */}
      <div className="card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
        <h4 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>⚙️ 게임 설정 리셋</h4>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 'var(--space-3)' }}>
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
          width: '100%', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--destructive)',
          background: 'var(--destructive-light)', color: 'var(--destructive)', fontWeight: 600, fontSize: 13, cursor: 'pointer'
        }}>
          🔄 상점/칭호/캐릭터 설정 리셋
        </button>
      </div>

      {/* 서버 백업 목록 */}
      {backups.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 'var(--space-2)' }}>
          <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
            🗄️ 서버 백업 기록 (최근 30일)
          </div>
          {backups.map((b, i) => (
            <div key={b.date} style={{
              padding: '10px 14px', borderBottom: i < backups.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>📁 {b.date}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {b.fileCount}개 파일 · {(b.size / 1024).toFixed(1)}KB
                </span>
              </div>
              <div style={{ marginTop: 'var(--space-1)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                {b.files.filter(f => f !== 'full-backup.json').map(f => (
                  <span key={f} style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 'var(--space-1)',
                    background: 'var(--muted)', color: 'var(--muted-foreground)'
                  }}>{f.replace('.json', '')}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-outline" onClick={() => navigate('/admin')}
        style={{ width: '100%', marginTop: 'var(--space-3)' }}>← 대시보드</button>
    </div>
  );
}
