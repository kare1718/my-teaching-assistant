import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--background)', padding: 20
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <p style={{ fontSize: 96, fontWeight: 900, color: 'var(--border)', lineHeight: 1, marginBottom: 8 }}>404</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>
          페이지를 찾을 수 없습니다
        </h1>
        <p style={{ fontSize: 14, color: 'var(--neutral-400)', marginBottom: 32, lineHeight: 1.6 }}>
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => navigate('/')} style={{
            padding: '12px 28px', fontSize: 14, fontWeight: 600, borderRadius: 12,
            background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer'
          }}>홈으로</button>
          <button onClick={() => navigate('/login')} style={{
            padding: '12px 28px', fontSize: 14, fontWeight: 600, borderRadius: 12,
            background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', cursor: 'pointer'
          }}>로그인</button>
        </div>
      </div>
    </div>
  );
}
