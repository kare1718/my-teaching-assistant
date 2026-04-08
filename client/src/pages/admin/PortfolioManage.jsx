import { useState, useEffect } from 'react';
import { api, apiUpload, apiDelete } from '../../api';

export default function PortfolioManage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [students, setStudents] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 업로드 폼
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ student_id: '', title: '', description: '' });
  const [uploadFile, setUploadFile] = useState(null);

  const loadItems = () => {
    const url = filterStudent ? `/portfolio/student/${filterStudent}` : '/portfolio/student/all';
    api(url).then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setItems([]); setLoading(false); });
  };

  useEffect(() => { loadItems(); }, [filterStudent]);
  useEffect(() => { api('/clinic/admin/students').then(setStudents).catch(() => []); }, []);

  const showMessage = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleUpload = async () => {
    if (!uploadFile || !uploadForm.student_id) { showMessage('학생과 파일을 선택하세요.'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('student_id', uploadForm.student_id);
      fd.append('title', uploadForm.title);
      fd.append('description', uploadForm.description);
      await apiUpload('/portfolio/upload', fd);
      showMessage('업로드되었습니다.');
      setShowUpload(false);
      setUploadForm({ student_id: '', title: '', description: '' });
      setUploadFile(null);
      loadItems();
    } catch (e) { showMessage(e.message); }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 작품을 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/portfolio/${id}`);
      showMessage('삭제되었습니다.');
      loadItems();
    } catch (e) { showMessage(e.message); }
  };

  if (loading) return <div className="main-content" style={{ padding: 20 }}>로딩 중...</div>;

  return (
    <div className="main-content" style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: 20 }}>포트폴리오 관리</h2>

      {msg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--success-light)', color: 'oklch(45% 0.14 150)', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* 필터 + 업로드 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', minWidth: 160 }}>
          <option value="">전체 학생</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school})</option>)}
        </select>
        <button onClick={() => setShowUpload(true)}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13 }}>
          + 작품 업로드
        </button>
      </div>

      {/* 갤러리 그리드 */}
      {items.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--neutral-500)', background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          등록된 작품이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {items.map(item => (
            <div key={item.id} style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div
                onClick={() => setLightbox(item)}
                style={{
                  width: '100%', paddingTop: '75%', position: 'relative', cursor: 'pointer',
                  background: item.file_url ? `url(${item.file_url}) center/cover` : 'var(--secondary)',
                }}>
                {!item.file_url && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-400)', fontSize: 40 }}>
                    📄
                  </div>
                )}
              </div>
              <div style={{ padding: 12 }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.title || '제목 없음'}</p>
                <p style={{ fontSize: 12, color: 'var(--neutral-500)' }}>{item.student_name || `학생 #${item.student_id}`}</p>
                <p style={{ fontSize: 11, color: 'var(--neutral-400)', marginTop: 2 }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR') : ''}
                </p>
                <button onClick={() => handleDelete(item.id)}
                  style={{ marginTop: 8, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--destructive-light)', color: 'var(--destructive)', fontSize: 12, fontFamily: 'inherit' }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '85vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            {lightbox.file_url ? (
              <img src={lightbox.file_url} alt={lightbox.title} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain' }} />
            ) : (
              <div style={{ padding: 60, background: 'var(--card)', borderRadius: 12, textAlign: 'center', color: 'var(--neutral-500)' }}>미리보기 불가</div>
            )}
            <div style={{ marginTop: 12, textAlign: 'center', color: 'white' }}>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{lightbox.title || '제목 없음'}</p>
              <p style={{ fontSize: 13, opacity: 0.8 }}>{lightbox.student_name} · {lightbox.description || ''}</p>
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
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>작품 업로드</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select value={uploadForm.student_id} onChange={e => setUploadForm({ ...uploadForm, student_id: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }}>
                <option value="">학생 선택</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school})</option>)}
              </select>
              <input placeholder="제목" value={uploadForm.title} onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' }} />
              <textarea placeholder="설명 (선택)" value={uploadForm.description} onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
                rows={3} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
              <input type="file" accept="image/*,.pdf" onChange={e => setUploadFile(e.target.files[0])}
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
    </div>
  );
}
