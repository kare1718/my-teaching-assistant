import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPut, apiDelete } from '../../api';

export default function ReviewManage() {
  const [reviews, setReviews] = useState([]);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => api('/admin/reviews').then(setReviews).catch(console.error);
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      await apiPut(`/admin/reviews/${id}/approve`);
      setMsg('후기가 승인되었습니다.');
      load();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const toggleBest = async (id) => {
    try {
      const res = await apiPut(`/admin/reviews/${id}/best`);
      setMsg(res.message);
      load();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const remove = async (id) => {
    if (!confirm('이 후기를 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/admin/reviews/${id}`);
      setMsg('후기가 삭제되었습니다.');
      load();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const filtered = filter === 'all' ? reviews
    : filter === 'pending' ? reviews.filter(r => r.status === 'pending')
    : filter === 'approved' ? reviews.filter(r => r.status === 'approved')
    : reviews.filter(r => r.is_best);

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>후기 관리</span>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="card">
        <h2>'강인한 국어' 수업 후기 관리 ({reviews.length}건)</h2>
        <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>
            전체 ({reviews.length})
          </button>
          <button className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('pending')}>
            승인 대기 ({reviews.filter(r => r.status === 'pending').length})
          </button>
          <button className={`btn btn-sm ${filter === 'approved' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('approved')}>
            승인됨 ({reviews.filter(r => r.status === 'approved').length})
          </button>
          <button className={`btn btn-sm ${filter === 'best' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('best')}>
            베스트 ({reviews.filter(r => r.is_best).length})
          </button>
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30, fontSize: 13 }}>후기가 없습니다.</p>
        ) : (
          <table>
            <thead>
              <tr><th>학생</th><th>내용</th><th>상태</th><th>작성일</th><th>관리</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={r.is_best ? { background: '#fffbeb' } : {}}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.student_name}</td>
                  <td style={{ maxWidth: 400, lineHeight: 1.5 }}>{r.content}</td>
                  <td>
                    {r.status === 'pending' && <span className="badge badge-warning">대기</span>}
                    {r.status === 'approved' && <span className="badge badge-success">승인</span>}
                    {r.is_best ? <span className="badge badge-warning" style={{ marginLeft: 4 }}>BEST</span> : null}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>{r.created_at}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.status === 'pending' && (
                        <button className="btn btn-success btn-sm" onClick={() => approve(r.id)}>승인</button>
                      )}
                      <button className={`btn btn-sm ${r.is_best ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleBest(r.id)}>
                        {r.is_best ? 'BEST 해제' : 'BEST'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
