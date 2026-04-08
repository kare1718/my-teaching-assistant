import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';
import { SkeletonPage, ErrorState, EmptyState } from '../../components/StudentStates';

export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError('');
    api('/students/my-info').then((data) => {
      setInfo(data);
      return api(`/students/my-materials`);
    }).then((data) => { setMaterials(data); setLoading(false); })
      .catch((err) => { setLoading(false); setLoadError(err.message || '데이터를 불러올 수 없습니다.'); });
  };

  useEffect(() => { load(); }, []);

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&?\s]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

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
        <Link to="/student">홈</Link> &gt; <span>수업 영상 및 자료</span>
      </div>

      <div className="s-card">
        <div className="s-section-title">수업 영상 및 자료 {info && `(${info.school})`}</div>
        {materials.length === 0 ? (
          <EmptyState message="등록된 수업 자료가 없습니다." />
        ) : (
          <div>
            {materials.map((m) => (
              <div key={m.id} style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12,
                background: 'var(--muted)', borderLeft: '3px solid var(--primary)'
              }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--foreground)', marginBottom: 4 }}>
                  {m.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>
                  {m.class_date || '날짜 미지정'}
                </div>
                {m.description && (
                  <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{m.description}</p>
                )}

                {m.youtube_url && getYoutubeEmbedUrl(m.youtube_url) && (
                  <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    <iframe
                      src={getYoutubeEmbedUrl(m.youtube_url)}
                      title={m.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 8 }}
                    />
                  </div>
                )}

                {m.file_name && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={`/uploads/${m.file_path}`}
                      download={m.file_name}
                      className="btn btn-primary btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      {m.file_name} 다운로드
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}
