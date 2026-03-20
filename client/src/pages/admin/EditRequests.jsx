import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPut, apiDelete } from '../../api';

export default function EditRequests() {
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState('');

  const load = () => api('/admin/edit-requests').then(setRequests).catch(console.error);

  useEffect(() => { load(); }, []);

  const fieldLabels = {
    name: '이름', phone: '연락처', school: '학교',
    grade: '학년', parent_name: '학부모 이름', parent_phone: '학부모 연락처'
  };

  // 학생별로 그룹핑
  const grouped = {};
  for (const r of requests) {
    const key = r.student_id;
    if (!grouped[key]) {
      grouped[key] = {
        student_id: r.student_id,
        student_name: r.student_name,
        school: r.school,
        grade: r.grade,
        created_at: r.created_at,
        changes: []
      };
    }
    grouped[key].changes.push(r);
  }

  const approve = async (requestId) => {
    try {
      await apiPut(`/admin/edit-requests/${requestId}/approve`, {});
      setMsg('수정 요청이 승인되었습니다.');
      load();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const reject = async (requestId) => {
    if (!confirm('수정 요청을 거절하시겠습니까?')) return;
    try {
      await apiDelete(`/admin/edit-requests/${requestId}/reject`);
      setMsg('수정 요청이 거절되었습니다.');
      load();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>정보 수정 요청</span>
      </div>

      <div className="card">
        <h2>정보 수정 요청 ({requests.length}건)</h2>
        {msg && <div className="alert alert-success">{msg}</div>}

        {Object.keys(grouped).length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 40 }}>
            대기 중인 수정 요청이 없습니다.
          </p>
        ) : (
          Object.values(grouped).map((group) => (
            <div key={group.student_id} style={{
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: 16, marginBottom: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{group.student_name}</span>
                  <span style={{ color: 'var(--muted-foreground)', fontSize: 13, marginLeft: 8 }}>
                    {group.school} {group.grade}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{group.created_at}</span>
              </div>

              <table>
                <thead>
                  <tr><th>항목</th><th>변경 전</th><th>변경 후</th></tr>
                </thead>
                <tbody>
                  {group.changes.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{fieldLabels[c.field_name] || c.field_name}</td>
                      <td style={{ color: 'var(--muted-foreground)' }}>{c.old_value || '-'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--info)' }}>{c.new_value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-success btn-sm" onClick={() => approve(group.changes[0].id)}>
                  승인
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => reject(group.changes[0].id)}>
                  거절
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
