import { useState, useEffect } from 'react';
import { api, apiUpload } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';

export default function Portfolio() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);

  const loadItems = () => {
    api('/portfolio/student/me')
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setItems([]); setLoading(false); });
  };

  useEffect(() => { loadItems(); }, []);

  const showMessage = (text, type = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleUpload = async () => {
    if (!file) { showMessage('파일을 선택하세요.', 'error'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      fd.append('description', description);
      await apiUpload('/portfolio/upload', fd);
      showMessage('업로드되었습니다!');
      setShowUpload(false);
      setTitle('');
      setDescription('');
      setFile(null);
      loadItems();
    } catch (e) { showMessage(e.message, 'error'); }
    setUploading(false);
  };

  return (
    <div style={{ maxWidth: 512, margin: '0 auto', padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.4em', fontWeight: 800 }}>내 포트폴리오</h2>
        <button onClick={() => setShowUpload(true)}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
          + 업로드
        </button>
      </div>

      {msg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600, textAlign: 'center',
          background: msgType === 'success' ? 'var(--success-light)' : 'var(--destructive-light)',
          color: msgType === 'success' ? 'var(--success)' : 'oklch(48% 0.20 25)',
        }}>
          {msg}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--neutral-500)', fontSize: 14 }}>로딩 중...</p>
      ) : items.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--neutral-500)', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🎨</p>
          <p style={{ fontSize: 15, fontWeight: 600 }}>아직 등록된 작품이 없습니다</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>첫 작품을 업로드해보세요!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {items.map(item => (
            <div key={item.id} onClick={() => setLightbox(item)}
              style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{
                width: '100%', paddingTop: '100%', position: 'relative',
                background: item.file_url ? `url(${item.file_url}) center/cover` : 'var(--secondary)',
              }}>
                {!item.file_url && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-400)', fontSize: 36 }}>📄</div>
                )}
              </div>
              <div style={{ padding: 10 }}>
                <p style={{ fontWeight: 600, fontSize: 13 }}>{item.title || '제목 없음'}</p>
                <p style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 2 }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR') : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '85vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            {lightbox.file_url ? (
              <img src={lightbox.file_url} alt={lightbox.title} style={{ maxWidth: '100%', maxHeight: '78vh', borderRadius: 12, objectFit: 'contain' }} />
            ) : (
              <div style={{ padding: 60, background: 'var(--card)', borderRadius: 12, textAlign: 'center', color: 'var(--neutral-500)' }}>미리보기 불가</div>
            )}
            <div style={{ marginTop: 12, textAlign: 'center', color: 'white' }}>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{lightbox.title || '제목 없음'}</p>
              {lightbox.description && <p style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{lightbox.description}</p>}
            </div>
            <button onClick={() => setLightbox(null)}
              style={{ position: 'absolute', top: -12, right: -12, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'white', cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* 업로드 모달 */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowUpload(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>작품 업로드</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input placeholder="제목" value={title} onChange={e => setTitle(e.target.value)}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <textarea placeholder="설명 (선택)" value={description} onChange={e => setDescription(e.target.value)}
                rows={3} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
              <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files[0])}
                style={{ fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUpload(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'white', fontSize: 14, fontFamily: 'inherit' }}>취소</button>
              <button onClick={handleUpload} disabled={uploading}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14, opacity: uploading ? 0.6 : 1 }}>
                {uploading ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomTabBar />
    </div>
  );
}
