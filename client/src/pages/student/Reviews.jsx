import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [content, setContent] = useState('');
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('all');

  const load = () => {
    api('/students/reviews').then(setReviews).catch(console.error);
    api('/students/my-reviews').then(setMyReviews).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const submitReview = async () => {
    if (!content.trim()) { setMsg('후기 내용을 입력해주세요.'); setTimeout(() => setMsg(''), 2000); return; }
    try {
      await apiPost('/students/reviews', { content: content.trim() });
      setMsg('후기가 등록되었습니다. 관리자 승인 후 표시됩니다.');
      setContent('');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); setTimeout(() => setMsg(''), 3000); }
  };

  const bestReviews = reviews.filter(r => r.is_best);
  const normalReviews = reviews.filter(r => !r.is_best);

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/student">홈</Link> &gt; <span>'강인한 국어' 수업 후기</span>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>전체 후기</button>
        <button className={`tab ${tab === 'write' ? 'active' : ''}`} onClick={() => setTab('write')}>후기 작성</button>
        <button className={`tab ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>내 후기</button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {tab === 'all' && (
        <>
          {bestReviews.length > 0 && (
            <div className="card">
              <h2>⭐ 베스트 후기</h2>
              {bestReviews.map((r) => (
                <div key={r.id} className="review-card best">
                  <div className="review-content">{r.content}</div>
                  <div className="review-meta">
                    <span>{r.display_name}</span>
                    <span className="best-badge">BEST</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h2>'강인한 국어' 수업 후기 ({reviews.length}건)</h2>
            {normalReviews.length === 0 && bestReviews.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30, fontSize: 13 }}>등록된 후기가 없습니다.</p>
            ) : (
              normalReviews.map((r) => (
                <div key={r.id} className="review-card">
                  <div className="review-content">{r.content}</div>
                  <div className="review-meta">
                    <span>{r.display_name}</span>
                    <span>{r.created_at}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'write' && (
        <div className="card">
          <h2>'강인한 국어' 수업 후기 작성</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>
            실명으로 등록되며, 공개 시 익명(예: 김**)으로 표시됩니다. 관리자 승인 후 게시됩니다.
          </p>
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 12,
            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #93c5fd',
            fontSize: 12, lineHeight: 1.8, color: '#1e3a5f',
          }}>
            🎁 <strong>후기 작성 시 200P 지급!</strong><br/>
            ⭐ <strong>베스트 후기 선정 시 1,000P 추가 지급!</strong>
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
          <button className="btn btn-primary" onClick={submitReview}>후기 등록</button>
        </div>
      )}

      {tab === 'my' && (
        <div className="card">
          <h2>내가 작성한 후기 ({myReviews.length}건)</h2>
          {myReviews.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 30, fontSize: 13 }}>작성한 후기가 없습니다.</p>
          ) : (
            myReviews.map((r) => (
              <div key={r.id} className="review-card" style={r.is_best ? { borderColor: 'var(--warning)', background: '#fffbeb' } : {}}>
                <div className="review-content">{r.content}</div>
                <div className="review-meta">
                  <span>
                    {r.status === 'pending' && <span className="badge badge-warning">승인 대기</span>}
                    {r.status === 'approved' && <span className="badge badge-success">승인됨</span>}
                    {r.status === 'rejected' && <span className="badge badge-danger">거절됨</span>}
                    {r.is_best ? <span className="best-badge" style={{ marginLeft: 6 }}>BEST</span> : null}
                  </span>
                  <span>{r.created_at}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <BottomTabBar />
    </div>
  );
}
