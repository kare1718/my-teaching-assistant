import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut } from '../../api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function BackupSecurity() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('backup');
  const [backups, setBackups] = useState([]);
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([
        api('/superadmin/backups'),
        api('/superadmin/security'),
      ]);
      setBackups(b);
      setSecurity(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleFullBackup = async () => {
    if (!confirm('플랫폼 전체 백업을 실행하시겠습니까?\n모든 학원의 데이터가 백업됩니다.')) return;
    setBackupLoading(true);
    setMessage('');
    try {
      const result = await apiPost('/superadmin/backup', {});
      setMessage(`백업 완료: ${result.tableCount}개 테이블, ${JSON.stringify(result.rowCounts)}`);
      loadData();
    } catch (err) {
      setMessage('백업 실패: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDeleteBackup = async (id, name) => {
    if (!confirm(`"${name}" 백업을 삭제하시겠습니까?`)) return;
    try {
      await api(`/superadmin/backups/${id}`, { method: 'DELETE' });
      setMessage('백업이 삭제되었습니다.');
      loadData();
    } catch (err) {
      setMessage('삭제 실패: ' + err.message);
    }
  };

  const handleDownload = async (id) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/superadmin/backups/${id}/download`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBlockUser = async (userId, blocked) => {
    try {
      await apiPut(`/superadmin/users/${userId}/block`, { blocked });
      setMessage(blocked ? '사용자가 차단되었습니다.' : '차단이 해제되었습니다.');
      loadData();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleSuspendTenant = async (tenantId, suspend) => {
    const action = suspend ? '정지' : '정지 해제';
    if (!confirm(`이 학원을 ${action}하시겠습니까?${suspend ? '\n소속 모든 유저가 차단됩니다.' : ''}`)) return;
    try {
      await apiPost(`/superadmin/tenants/${tenantId}/${suspend ? 'suspend' : 'unsuspend'}`, {});
      setMessage(`학원이 ${action}되었습니다.`);
      loadData();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const tabStyle = (t) => ({
    padding: '10px 20px', fontSize: 14, fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
    color: tab === t ? 'var(--primary)' : 'var(--muted-foreground)',
    borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
    background: 'transparent', border: 'none', fontFamily: 'inherit',
  });

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>로딩 중...</div>;

  const platformBackups = backups.filter(b => b.backup_type === 'platform_full');
  const autoBackups = backups.filter(b => b.backup_type.startsWith('auto_'));

  return (
    <div style={{ padding: '24px', maxWidth: 1280, margin: '0 auto' }}>
      <button onClick={() => navigate('/superadmin')} style={{
        padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
        background: 'var(--card)', cursor: 'pointer', fontSize: 13, marginBottom: 16, fontFamily: 'inherit',
      }}>
        &larr; 대시보드
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>백업 & 보안 관리</h1>

      {message && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: message.includes('실패') ? 'var(--destructive-light)' : 'var(--success-light)',
          color: message.includes('실패') ? 'var(--destructive)' : 'var(--success)',
          border: `1px solid ${message.includes('실패') ? 'var(--destructive)' : 'var(--success)'}20`,
        }}>
          {message}
          <button onClick={() => setMessage('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>x</button>
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <button style={tabStyle('backup')} onClick={() => setTab('backup')}>백업 관리</button>
        <button style={tabStyle('security')} onClick={() => setTab('security')}>보안 관리</button>
      </div>

      {/* ========== 백업 탭 ========== */}
      {tab === 'backup' && (
        <>
          {/* 전체 백업 실행 */}
          <div style={{
            background: 'var(--card)', borderRadius: 12, padding: 24,
            border: '1px solid var(--border)', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>플랫폼 전체 백업</h2>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  모든 학원의 데이터를 DB에 영구 저장합니다 (최대 5개 보관)
                </p>
              </div>
              <button
                onClick={handleFullBackup}
                disabled={backupLoading}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 14,
                  fontFamily: 'inherit', opacity: backupLoading ? 0.6 : 1,
                }}
              >
                {backupLoading ? '백업 중...' : '지금 백업 실행'}
              </button>
            </div>
          </div>

          {/* 자동 백업 현황 */}
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>자동 백업 (슬롯 3개 로테이션)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[1, 2, 3].map(slot => {
              const b = autoBackups.find(x => x.backup_type === `auto_slot${slot}`);
              return (
                <div key={slot} style={{
                  background: 'var(--card)', borderRadius: 12, padding: 16,
                  border: `1px solid ${b ? 'var(--success)' : 'var(--border)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>슬롯 {slot}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                      background: b ? 'var(--success)' : 'var(--muted)',
                      color: b ? 'white' : 'var(--muted-foreground)',
                    }}>
                      {b ? '저장됨' : '비어있음'}
                    </span>
                  </div>
                  {b ? (
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{b.backup_name}</span>
                      <span>{timeAgo(b.created_at)} ({new Date(b.created_at).toLocaleString('ko-KR')})</span>
                      <span>{formatBytes(b.size)}</span>
                      <button
                        onClick={() => handleDownload(b.id)}
                        style={{
                          marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--card)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        }}
                      >
                        다운로드
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>아직 백업이 없습니다</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 플랫폼 수동 백업 목록 */}
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>수동 백업 이력</h3>
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
              <thead>
                <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>백업명</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>유형</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>생성일시</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>크기</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {platformBackups.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{b.backup_name}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, background: 'var(--primary)', color: 'white', fontWeight: 600 }}>전체</span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12 }}>
                      {new Date(b.created_at).toLocaleString('ko-KR')}
                      <div style={{ color: 'var(--muted-foreground)' }}>{timeAgo(b.created_at)}</div>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>{formatBytes(b.size)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => handleDownload(b.id)} style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--card)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        }}>다운로드</button>
                        <button onClick={() => handleDeleteBackup(b.id, b.backup_name)} style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid var(--destructive)',
                          background: 'transparent', color: 'var(--destructive)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        }}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {platformBackups.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)' }}>수동 백업 이력이 없습니다. 위의 "지금 백업 실행" 버튼을 눌러보세요.</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {/* ========== 보안 탭 ========== */}
      {tab === 'security' && security && (
        <>
          {/* 보안 통계 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: '전체 사용자', value: security.totalUsers, color: 'var(--primary)' },
              { label: '차단된 사용자', value: security.blockedUsers, color: 'var(--destructive)' },
              { label: '승인 대기', value: security.pendingUsers, color: 'var(--warning)' },
              { label: '비활성 학원', value: security.inactiveTenants?.length || 0, color: 'var(--muted-foreground)' },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'var(--card)', borderRadius: 12, padding: '16px 20px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* 비활성 학원 */}
          {security.inactiveTenants?.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>정지된 학원</h3>
              <div style={{
                background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)',
                marginBottom: 24, overflow: 'hidden',
              }}>
                {security.inactiveTenants.map(t => (
                  <div key={t.id} style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 8 }}>코드: {t.invite_code}</span>
                    </div>
                    <button onClick={() => handleSuspendTenant(t.id, false)} style={{
                      padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: 'var(--success)', color: 'white', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    }}>정지 해제</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 최근 가입 사용자 */}
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>최근 가입 사용자</h3>
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
              <thead>
                <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>이름</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>아이디</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>역할</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>소속</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {security.recentUsers?.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>@{u.username}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                        background: u.role === 'admin' ? 'var(--warning)' : 'var(--primary)',
                        color: 'white',
                      }}>{u.role === 'admin' ? '관리자' : '학생'}</span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12 }}>{u.tenant_name || '-'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {u.role !== 'superadmin' && (
                        <button onClick={() => handleBlockUser(u.id, true)} style={{
                          padding: '3px 10px', borderRadius: 6, border: '1px solid var(--destructive)',
                          background: 'transparent', color: 'var(--destructive)', cursor: 'pointer',
                          fontSize: 11, fontFamily: 'inherit',
                        }}>차단</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
