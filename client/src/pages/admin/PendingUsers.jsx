import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPut, apiDelete } from '../../api';

export default function PendingUsers() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState('');

  const load = () => api('/admin/pending-users').then(setUsers).catch(console.error);

  useEffect(() => { load(); }, []);

  const approve = async (userId) => {
    await apiPut(`/admin/approve/${userId}`, {});
    setMsg('승인되었습니다.');
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const reject = async (userId, name) => {
    if (!confirm(`${name} 학생의 가입을 거절하시겠습니까? 계정이 삭제됩니다.`)) return;
    await apiDelete(`/admin/reject/${userId}`);
    setMsg('거절 처리되었습니다.');
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>가입 승인 관리</span>
      </div>

      <div className="card">
        <h2>가입 승인 대기 ({users.length}명)</h2>
        {msg && <div className="alert alert-success">{msg}</div>}
        {users.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>승인 대기 중인 학생이 없습니다.</p>
        ) : (
          <>
            {/* 모바일 카드 뷰 */}
            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {users.map((u) => (
                <div key={u.id} style={{
                  border: '1px solid var(--border)', borderRadius: 10, padding: 14,
                  borderLeft: '4px solid var(--primary)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</span>
                      <span style={{ color: 'var(--muted-foreground)', fontSize: 12, marginLeft: 6 }}>{u.school} {u.grade}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-success btn-sm" onClick={() => approve(u.id)} style={{ fontWeight: 700 }}>승인</button>
                      <button className="btn btn-danger btn-sm" onClick={() => reject(u.id, u.name)}>거절</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                    <span>ID: {u.username}</span>
                    <span>연락처: {u.phone || '-'}</span>
                    <span>학부모: {u.parent_name || '-'}</span>
                    <span>{u.created_at}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* 데스크탑 테이블 뷰 */}
            <div className="desktop-only" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>이름</th>
                    <th>아이디</th>
                    <th>학교</th>
                    <th>학년</th>
                    <th>연락처</th>
                    <th>학부모</th>
                    <th>가입일</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-success btn-sm" onClick={() => approve(u.id)}>승인</button>
                          <button className="btn btn-danger btn-sm" onClick={() => reject(u.id, u.name)}>거절</button>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td>{u.username}</td>
                      <td>{u.school}</td>
                      <td>{u.grade}</td>
                      <td>{u.phone || '-'}</td>
                      <td>{u.parent_name || '-'}</td>
                      <td style={{ fontSize: 12, color: '#888' }}>{u.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
