import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPut, apiPost, apiDelete } from '../../api';

const formatKST = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function ReviewManage() {
  const [reviews, setReviews] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');
  const [editModal, setEditModal] = useState(null);
  const [editContent, setEditContent] = useState('');

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

  const grantReward = async (r) => {
    if (!confirm(`${r.student_name}에게 후기 보상 200P를 지급하시겠습니까?`)) return;
    try {
      await apiPost(`/admin/reviews/${r.id}/reward`);
      setMsg(`${r.student_name}에게 200P 지급 완료!`);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); }
  };

  const grantBestReward = async (r) => {
    if (!confirm(`${r.student_name}에게 베스트 후기 보상 500P를 지급하시겠습니까?`)) return;
    try {
      await apiPost(`/admin/reviews/${r.id}/reward-best`);
      setMsg(`${r.student_name}에게 베스트 500P 지급 완료!`);
      load();
      setTimeout(() => setMsg(''), 3000);
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

  const openEdit = (r) => {
    setEditModal(r);
    setEditContent(r.content);
  };

  const saveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await apiPut(`/admin/reviews/${editModal.id}/content`, { content: editContent.trim() });
      setMsg('후기가 수정되었습니다.');
      setEditModal(null);
      load();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const filtered = filter === 'all' ? reviews
    : filter === 'pending' ? reviews.filter(r => r.status === 'pending')
    : filter === 'approved' ? reviews.filter(r => r.status === 'approved')
    : reviews.filter(r => r.is_best);

  return (
    <div className="content max-w-7xl mx-auto w-full">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>후기 관리</span>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="card">
        <h2>수업 후기 관리 ({reviews.length}건)</h2>
        <div style={{ marginBottom: 'var(--space-3)', display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
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
        ) : isMobile ? (
          /* 모바일 카드 뷰 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filtered.map(r => (
              <div key={r.id} style={{
                padding: 'var(--space-3) var(--space-3)', borderRadius: 10, border: '1px solid var(--border)',
                background: r.is_best ? 'var(--warning-light)' : 'var(--card)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{r.student_name}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 'var(--space-1)' }}>{r.school} {r.grade}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {r.status === 'pending' && <span className="badge badge-warning">대기</span>}
                    {r.status === 'approved' && <span className="badge badge-success">승인</span>}
                    {r.is_best && <span className="badge badge-warning">BEST</span>}
                  </div>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--foreground)', marginBottom: 'var(--space-2)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{r.content}</p>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 'var(--space-2)' }}>
                  {formatKST(r.created_at)}
                  {r.rewarded && <span style={{ marginLeft: 'var(--space-2)', color: 'var(--success)' }}>200P 지급됨</span>}
                  {r.best_rewarded && <span style={{ marginLeft: 'var(--space-2)', color: 'oklch(60% 0.18 45)' }}>베스트 500P 지급됨</span>}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                  {r.status === 'pending' && <button className="btn btn-success btn-sm" onClick={() => approve(r.id)}>승인</button>}
                  {r.status === 'approved' && !r.rewarded && (
                    <button className="btn btn-sm" onClick={() => grantReward(r)} style={{ background: 'oklch(80% 0.14 85)', color: 'oklch(30% 0.10 75)', border: 'none', fontWeight: 700 }}>💰 200P</button>
                  )}
                  {r.is_best && !r.best_rewarded && (
                    <button className="btn btn-sm" onClick={() => grantBestReward(r)} style={{ background: 'oklch(60% 0.18 45)', color: 'white', border: 'none', fontWeight: 700 }}>⭐ 500P</button>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>수정</button>
                  <button className={`btn btn-sm ${r.is_best ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleBest(r.id)}>{r.is_best ? 'BEST해제' : 'BEST'}</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 700 }}>
              <thead>
                <tr><th>학생</th><th>내용</th><th>상태</th><th>작성일</th><th>관리</th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={r.is_best ? { background: 'var(--warning-light)' } : {}}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {r.student_name}
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 400 }}>{r.school} {r.grade}</div>
                    </td>
                    <td style={{ maxWidth: 400, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflow: 'hidden' }}>{r.content}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                        {r.status === 'pending' && <span className="badge badge-warning">대기</span>}
                        {r.status === 'approved' && <span className="badge badge-success">승인</span>}
                        {r.is_best ? <span className="badge badge-warning">BEST</span> : null}
                        {r.rewarded ? <span style={{ fontSize: 10, color: 'var(--success)' }}>200P 지급됨</span> : null}
                        {r.best_rewarded ? <span style={{ fontSize: 10, color: 'oklch(60% 0.18 45)' }}>베스트 500P 지급됨</span> : null}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted-foreground)', fontSize: 'var(--text-xs)' }}>{formatKST(r.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                        {r.status === 'pending' && (
                          <button className="btn btn-success btn-sm" onClick={() => approve(r.id)}>승인</button>
                        )}
                        {r.status === 'approved' && !r.rewarded && (
                          <button className="btn btn-sm" onClick={() => grantReward(r)}
                            style={{ background: 'oklch(80% 0.14 85)', color: 'oklch(30% 0.10 75)', border: 'none', fontWeight: 700 }}>
                            💰 200P
                          </button>
                        )}
                        {r.is_best && !r.best_rewarded && (
                          <button className="btn btn-sm" onClick={() => grantBestReward(r)}
                            style={{ background: 'oklch(60% 0.18 45)', color: 'white', border: 'none', fontWeight: 700 }}>
                            ⭐ 500P
                          </button>
                        )}
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>수정</button>
                        <button className={`btn btn-sm ${r.is_best ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleBest(r.id)}>
                          {r.is_best ? 'BEST해제' : 'BEST'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 수정 모달 */}
      {editModal && (
        <>
          <div onClick={() => setEditModal(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--card)', borderRadius: 16, padding: 'var(--space-6)', width: 420, maxWidth: '90vw', zIndex: 10001,
            boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)',
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>✏️ 후기 수정</h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 'var(--space-2)' }}>
              <strong>{editModal.student_name}</strong>의 후기
            </p>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
              rows={6} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <button className="btn btn-outline" onClick={() => setEditModal(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={saveEdit} style={{ flex: 1 }}>저장</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
