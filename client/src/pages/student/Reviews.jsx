import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost, apiPut } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';
import { SkeletonPage, ErrorState, EmptyState } from '../../components/StudentStates';
import { useTenantConfig } from '../../contexts/TenantContext';

const formatKST = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function Reviews() {
  const { config } = useTenantConfig();
  const [reviews, setReviews] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [content, setContent] = useState('');
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError('');
    Promise.all([
      api('/students/reviews'),
      api('/students/my-reviews'),
    ]).then(([reviewsData, myReviewsData]) => {
      setReviews(reviewsData);
      setMyReviews(myReviewsData);
      setLoading(false);
    }).catch((err) => { setLoading(false); setLoadError(err.message || '데이터를 불러올 수 없습니다.'); });
  };

  useEffect(() => { load(); }, []);

  const submitReview = async () => {
    if (!content.trim()) { setMsg('후기 내용을 입력해주세요.'); setTimeout(() => setMsg(''), 2000); return; }
    try {
      await apiPost('/students/reviews', { content: content.trim() });
      setMsg('후기가 등록되었습니다. 관리자 승인 후 게시 및 포인트가 지급됩니다.');
      setContent('');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); setTimeout(() => setMsg(''), 3000); }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditContent(r.content);
  };

  const saveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await apiPut(`/students/reviews/${editingId}`, { content: editContent.trim() });
      setMsg('후기가 수정되었습니다.');
      setEditingId(null);
      load();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); setTimeout(() => setMsg(''), 2000); }
  };

  const bestReviews = reviews.filter(r => r.is_best);
  const normalReviews = reviews.filter(r => !r.is_best);

  if (loading) return (
    <div className="content s-page">
      <SkeletonPage />
      <BottomTabBar />
    </div>
  );

  if (loadError) return (
    <div className="content s-page">
      <ErrorState message={loadError} onRetry={load} />
      <BottomTabBar />
    </div>
  );

  return (
    <div className="content s-page">
      <div className="breadcrumb">
        <Link to="/student">홈</Link> &gt; <span>수업 후기</span>
      </div>

      <div className="s-tab-pills">
        <button className={`s-tab-pill ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>전체 후기</button>
        <button className={`s-tab-pill ${tab === 'write' ? 'active' : ''}`} onClick={() => setTab('write')}>후기 작성</button>
        <button className={`s-tab-pill ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>내 후기</button>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--success-light)', color: 'oklch(30% 0.12 145)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{msg}</div>}

      {tab === 'all' && (
        <>
          {bestReviews.length > 0 && (
            <div className="s-card">
              <div className="s-section-title">베스트 후기</div>
              {bestReviews.map((r) => (
                <div key={r.id} className="review-card best">
                  <div className="review-content" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{r.content}</div>
                  <div className="review-meta">
                    <span>{r.display_name} {r.display_grade && <span style={{ color: 'var(--warm-500)', fontSize: 'var(--text-xs)' }}>{r.display_grade}</span>}</span>
                    <span className="s-badge-warning">BEST</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="s-card">
            <div className="s-section-title">수업 후기 ({reviews.length}건)</div>
            {normalReviews.length === 0 && bestReviews.length === 0 ? (
              <EmptyState message="등록된 후기가 없습니다." />
            ) : (
              normalReviews.map((r) => (
                <div key={r.id} className="review-card">
                  <div className="review-content" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{r.content}</div>
                  <div className="review-meta">
                    <span>{r.display_name} {r.display_grade && <span style={{ color: 'var(--warm-500)', fontSize: 'var(--text-xs)' }}>{r.display_grade}</span>}</span>
                    <span>{formatKST(r.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'write' && (
        <div className="s-card">
          <div className="s-section-title">수업 후기 작성</div>
          <p style={{ fontSize: 13, color: 'var(--warm-500)', marginBottom: 'var(--space-2)' }}>
            실명으로 등록되며, 공개 시 익명(예: 김**)으로 표시됩니다. 관리자 승인 후 게시됩니다.
          </p>
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)',
            background: 'var(--accent-lighter)', border: '1px solid var(--accent-light)',
            fontSize: 'var(--text-xs)', lineHeight: 1.8, color: 'var(--accent)',
          }}>
            🎁 <strong>관리자 승인 후 200P 지급!</strong><br/>
            ⭐ <strong>베스트 후기 선정 시 500P 지급!</strong>
          </div>
          <div className="form-group">
            <label>후기 내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="수업에 대한 솔직한 후기를 남겨주세요..."
              style={{ minHeight: 120 }}
            />
          </div>
          <button className="s-btn s-btn-warm" onClick={submitReview}>후기 등록</button>
        </div>
      )}

      {tab === 'my' && (
        <div className="s-card">
          <div className="s-section-title">내가 작성한 후기 ({myReviews.length}건)</div>
          {myReviews.length === 0 ? (
            <EmptyState message="작성한 후기가 없습니다." />
          ) : (
            myReviews.map((r) => (
              <div key={r.id} className="review-card" style={r.is_best ? { borderColor: 'var(--warning)', background: 'var(--warning-light)' } : {}}>
                {editingId === r.id ? (
                  <div>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      rows={4} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--student-border)', borderRadius: 'var(--radius)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                      <button className="s-btn s-btn-warm" style={{ fontSize: 'var(--text-xs)', padding: '4px 12px' }} onClick={saveEdit}>저장</button>
                      <button className="s-btn s-btn-warm-outline" style={{ fontSize: 'var(--text-xs)', padding: '4px 12px' }} onClick={() => setEditingId(null)}>취소</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="review-content" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{r.content}</div>
                    <div className="review-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        {r.status === 'pending' && <span className="s-badge-warning">승인 대기</span>}
                        {r.status === 'approved' && <span className="s-badge-success">승인됨</span>}
                        {r.status === 'rejected' && <span className="s-badge-error">거절됨</span>}
                        {r.is_best ? <span className="s-badge-warning" style={{ marginLeft: 6 }}>BEST</span> : null}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <button className="s-btn s-btn-warm-outline" onClick={() => startEdit(r)}
                          style={{ fontSize: 11, padding: '2px 8px' }}>수정</button>
                        <span style={{ fontSize: 12, color: 'var(--warm-500)' }}>{formatKST(r.created_at)}</span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <BottomTabBar />
    </div>
  );
}
