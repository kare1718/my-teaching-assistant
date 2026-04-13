import { useState, useEffect, useRef } from 'react';
import { api, apiPut } from '../api';

const FONT = "'Paperlogy', 'Noto Sans KR', system-ui, sans-serif";

const TYPE_ICONS = {
  gift: '🎁',
  announcement: '📢',
  system: '⚙️',
  warning: '⚠️',
};

export default function PlatformNotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const ref = useRef(null);

  const loadCount = () => {
    api('/notifications/unread-count').then(r => setCount(r.count || 0)).catch(() => {});
  };

  const loadAll = () => {
    api('/notifications').then(setNotifications).catch(() => {});
  };

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) loadAll();
  }, [open]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id) => {
    await apiPut(`/notifications/${id}/read`).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setCount(c => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await apiPut('/notifications/read-all').catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setCount(0);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
          position: 'relative', fontSize: 18,
        }}>
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, width: 16, height: 16,
            borderRadius: '50%', background: '#dc2626', color: '#fff',
            fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{count > 9 ? '9+' : count}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, width: 360, maxHeight: 420, overflow: 'auto',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 999, fontFamily: FONT,
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--foreground)' }}>알림</span>
            {count > 0 && (
              <button onClick={markAllRead}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                모두 읽음
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
              알림이 없습니다
            </div>
          ) : notifications.map(n => (
            <div key={n.id}
              onClick={() => { if (!n.is_read) markRead(n.id); }}
              style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                background: n.is_read ? 'transparent' : 'var(--primary-light)',
                cursor: n.is_read ? 'default' : 'pointer',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{TYPE_ICONS[n.type] || '📋'}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)', flex: 1 }}>{n.title}</span>
                {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />}
              </div>
              {n.message && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>{n.message}</p>}
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4, display: 'block' }}>
                {n.created_at ? new Date(n.created_at).toLocaleString('ko-KR') : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
