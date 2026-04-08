import { useState, useEffect, useRef } from 'react';
import { apiPost } from '../api';

const EXAMPLES = [
  '3월 학력평가 등록해줘',
  '계성고 학생 목록 보여줘',
  '공지사항 등록: 내일 휴원',
  '히든코드 SPRING 200XP',
];

const ACTION_LABELS = {
  create_exam: '시험 등록',
  input_scores: '성적 입력',
  create_code: '히든코드 생성',
  adjust_xp: 'XP/포인트 조정',
  create_notice: '공지 등록',
  query_data: '데이터 조회',
};

export default function FloatingAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState(null);
  const [pendingMsgIndex, setPendingMsgIndex] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setPendingActions(null);
    try {
      const currentHistory = [...messages, userMsg].slice(-10);
      const res = await apiPost('/ai/parse', { message: text, history: currentHistory });
      const content = res.message || res.error || res.question || '응답을 받았습니다.';
      const assistantMsg = {
        role: 'assistant',
        content,
        actions: res.actions || null,
        status: res.status || (res.error ? 'error' : 'done'),
        data: res.data || null,
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (res.status === 'pending' && res.actions?.length > 0) {
        setPendingActions(res.actions);
        setPendingMsgIndex(messages.length + 1);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: err.message || '오류가 발생했습니다.', status: 'error' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingActions || loading) return;
    setLoading(true);
    try {
      const res = await apiPost('/ai/execute', { actions: pendingActions });
      if (pendingMsgIndex != null) {
        setMessages(prev => prev.map((m, i) => i === pendingMsgIndex ? { ...m, status: 'confirmed' } : m));
      }
      setMessages(prev => [...prev, { role: 'assistant', content: res.message || '완료!', status: 'done', data: res.data || null }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: err.message || '실행 오류', status: 'error' }]);
    } finally {
      setPendingActions(null);
      setPendingMsgIndex(null);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (pendingMsgIndex != null) {
      setMessages(prev => prev.map((m, i) => i === pendingMsgIndex ? { ...m, status: 'cancelled' } : m));
    }
    setPendingActions(null);
    setPendingMsgIndex(null);
    setMessages(prev => [...prev, { role: 'assistant', content: '취소됨', status: 'done' }]);
  };

  return (
    <>
      <style>{`
        @keyframes floatAIPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(59,130,246,0.4); }
          50% { box-shadow: 0 4px 30px rgba(59,130,246,0.7); }
        }
        @keyframes floatAISlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aiDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      {/* Floating Button — above BottomTabBar on mobile */}
      <button
        onClick={() => setOpen(!open)}
        className="floating-ai-btn"
        style={{
          position: 'fixed', bottom: 72, right: 'var(--space-4)', zIndex: 9999,
          width: 52, height: 52, borderRadius: 'var(--radius-full)',
          background: open ? 'var(--muted-foreground)' : 'linear-gradient(135deg, var(--info), oklch(55% 0.20 290))',
          color: 'white', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--text-xl)',
          animation: open ? 'none' : 'floatAIPulse 2s ease-in-out infinite',
          transition: 'all 0.3s',
        }}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 134, right: 'var(--space-4)', zIndex: 9998,
          width: 380, maxWidth: 'calc(100vw - 32px)',
          height: 480, maxHeight: 'calc(100vh - 200px)',
          borderRadius: 'var(--space-4)', overflow: 'hidden',
          background: 'var(--card)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          animation: 'floatAISlideUp 0.25s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px var(--space-4)', background: 'linear-gradient(135deg, var(--info), oklch(55% 0.20 290))',
            color: 'white', flexShrink: 0,
          }}>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>🤖 AI 어시스턴트</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>자연어로 관리 작업을 수행하세요</div>
          </div>

          {/* Chat Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: 'var(--space-3)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
          }}>
            {messages.length === 0 && (
              <div style={{ padding: 'var(--space-2) 0' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 'var(--space-2)' }}>💡 예시:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                  {EXAMPLES.map((ex, i) => (
                    <button key={i} onClick={() => { setInput(ex); inputRef.current?.focus(); }} style={{
                      padding: '5px 10px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                      background: 'var(--neutral-50)', cursor: 'pointer', fontSize: 11, color: 'var(--neutral-600)',
                    }}>{ex}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: 'var(--space-2) var(--space-3)',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? 'var(--primary)' : msg.status === 'error' ? 'var(--destructive-light)' : 'var(--neutral-50)',
                  color: msg.role === 'user' ? 'white' : msg.status === 'error' ? 'oklch(35% 0.15 25)' : 'var(--foreground)',
                  fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
                }}>
                  {msg.content}
                  {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                    <div style={{ overflowX: 'auto', marginTop: 6 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead><tr>{Object.keys(msg.data[0]).map(c => (
                          <th key={c} style={{ padding: 'var(--space-1) 6px', background: 'var(--border)', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>
                        ))}</tr></thead>
                        <tbody>{msg.data.slice(0, 20).map((r, ri) => (
                          <tr key={ri}>{Object.keys(r).map(c => (
                            <td key={c} style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{r[c] != null ? String(r[c]) : '-'}</td>
                          ))}</tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: 'var(--space-2) 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--neutral-50)' }}>
                  <span style={{ display: 'inline-flex', gap: 3 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 5, height: 5, borderRadius: 'var(--radius-full)', background: 'var(--muted-foreground)',
                        animation: `aiDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </span>
                </div>
              </div>
            )}

            {/* Action Confirmation */}
            {pendingActions && !loading && (
              <div style={{
                padding: 'var(--space-3)', borderRadius: 10, background: 'var(--info-light)',
                border: '1px solid oklch(85% 0.06 230)', fontSize: 'var(--text-xs)',
              }}>
                <div style={{ fontWeight: 700, marginBottom: 'var(--space-2)', fontSize: 13 }}>📋 실행할 작업</div>
                {pendingActions.map((a, i) => (
                  <div key={i} style={{ padding: 'var(--space-1) 0', borderBottom: '1px solid var(--info-light)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{ACTION_LABELS[a.type] || a.type}</span>
                    {a.description && <span style={{ color: 'var(--muted-foreground)', marginLeft: 6 }}>— {a.description}</span>}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button onClick={handleConfirm} style={{
                    flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius)', border: 'none',
                    background: 'var(--success)', color: 'white', fontWeight: 700, fontSize: 'var(--text-xs)', cursor: 'pointer',
                  }}>✅ 실행</button>
                  <button onClick={handleCancel} style={{
                    flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                    background: 'var(--card)', color: 'var(--neutral-500)', fontWeight: 700, fontSize: 'var(--text-xs)', cursor: 'pointer',
                  }}>✕ 취소</button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px var(--space-3)', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--neutral-50)' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="메시지 입력..."
                disabled={loading}
                style={{
                  flex: 1, padding: '9px var(--space-3)', borderRadius: 10,
                  border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  padding: 'var(--space-2) 14px', borderRadius: 10, border: 'none',
                  background: loading || !input.trim() ? 'var(--border)' : 'var(--primary)',
                  color: 'white', fontWeight: 700, fontSize: 13,
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >▶</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
