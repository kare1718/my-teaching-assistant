import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost } from '../../api';

const EXAMPLE_CATEGORIES = [
  {
    label: '📊 현황 확인',
    examples: [
      '오늘 학원 현황 알려줘',
      '학생 몇 명이야?',
      '가입 대기 있어?',
      '이번 주 일정 알려줘',
    ],
  },
  {
    label: '📝 시험/성적',
    examples: [
      '3월 학력평가 등록해줘, 만점 100점',
      '시험 목록 보여줘',
      '최근 시험 성적 조회',
      '김민준 85점, 이서윤 92점 입력',
    ],
  },
  {
    label: '🎮 게임/포인트',
    examples: [
      'XP 랭킹 Top 10 보여줘',
      '히든코드 SPRING 만들어줘 200XP',
      '김민준 XP 50 추가해줘',
      '활성 히든코드 뭐가 있어?',
    ],
  },
  {
    label: '📢 공지/관리',
    examples: [
      '공지사항 등록: 내일 휴원합니다',
      '학생 목록 보여줘',
      '클리닉 예약 현황',
      '최근 공지 조회',
    ],
  },
];

const ACTION_LABELS = {
  create_exam: { icon: '📝', label: '시험 등록' },
  input_scores: { icon: '📊', label: '성적 입력' },
  create_code: { icon: '🎮', label: '히든코드 생성' },
  adjust_xp: { icon: '⚡', label: 'XP/포인트 조정' },
  create_notice: { icon: '📢', label: '공지 등록' },
  query_data: { icon: '🔍', label: '데이터 조회' },
  bulk_sms: { icon: '📱', label: '문자 발송' },
};

function formatActionPreview(action) {
  const { type, params } = action;
  switch (type) {
    case 'create_exam':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div><strong>시험명:</strong> {params.name || '-'}</div>
          {params.exam_type && <div><strong>유형:</strong> {params.exam_type}</div>}
          {params.max_score != null && <div><strong>만점:</strong> {params.max_score}점</div>}
          {params.exam_date && <div><strong>날짜:</strong> {params.exam_date}</div>}
          {params.school && <div><strong>학교:</strong> {params.school}</div>}
          {params.grade && <div><strong>학년:</strong> {params.grade}</div>}
        </div>
      );
    case 'input_scores':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
          {(params.exam_name || params.exam_id) && (
            <div><strong>시험:</strong> {params.exam_name || `ID: ${params.exam_id}`}</div>
          )}
          {params.scores && params.scores.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {params.scores.map((s, i) => (
                <div key={i} style={{ padding: '2px 0', display: 'flex', gap: 8 }}>
                  <span>{s.student_name}:</span> <strong>{s.score}점</strong>
                  {s.note && <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>({s.note})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case 'create_code':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div><strong>코드:</strong> <code style={{ background: 'var(--border)', padding: '1px 6px', borderRadius: 'var(--space-1)' }}>{params.code || '-'}</code></div>
          {params.xp_amount != null && <div><strong>XP:</strong> {params.xp_amount}</div>}
          {params.max_uses != null && <div><strong>최대 사용:</strong> {params.max_uses}회</div>}
          {params.expires_days != null && <div><strong>유효기간:</strong> {params.expires_days}일</div>}
          {params.description && <div><strong>설명:</strong> {params.description}</div>}
        </div>
      );
    case 'adjust_xp':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div><strong>학생:</strong> {params.student_name || '-'}</div>
          {params.xp_amount != null && <div><strong>XP:</strong> {params.xp_amount > 0 ? '+' : ''}{params.xp_amount}</div>}
          {params.points_amount != null && <div><strong>포인트:</strong> {params.points_amount > 0 ? '+' : ''}{params.points_amount}</div>}
          {params.reason && <div><strong>사유:</strong> {params.reason}</div>}
        </div>
      );
    case 'create_notice':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div><strong>제목:</strong> {params.title || '-'}</div>
          {params.content && (
            <div><strong>내용:</strong> {params.content.length > 80 ? params.content.slice(0, 80) + '...' : params.content}</div>
          )}
          <div><strong>대상:</strong> {params.target_type === 'school' ? params.target_school : '전체'}</div>
        </div>
      );
    default:
      return (
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          {action.description || JSON.stringify(params, null, 2)}
        </div>
      );
  }
}

/**
 * AI 메시지 텍스트를 포맷팅 (줄바꿈, 볼드, 리스트)
 */
function FormatMessage({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {lines.map((line, i) => {
        // 빈 줄
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        // 볼드 처리
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={i}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j}>{part.slice(2, -2)}</strong>;
              }
              return <span key={j}>{part}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function QueryResultTable({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--muted-foreground)', padding: 8 }}>결과가 없습니다.</div>;
  }
  const columns = Object.keys(data[0]);
  return (
    <div style={{ overflowX: 'auto', marginTop: 8, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col} style={{
                padding: '8px 10px', background: 'var(--neutral-50)', fontWeight: 700,
                borderBottom: '2px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap',
                fontSize: 11, color: 'var(--neutral-600)',
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'var(--card)' : 'var(--neutral-50)' }}>
              {columns.map(col => (
                <td key={col} style={{
                  padding: '6px 10px', borderBottom: '1px solid var(--neutral-50)', whiteSpace: 'nowrap',
                  fontSize: 12,
                }}>{row[col] != null ? String(row[col]) : '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 50 && (
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', padding: '6px 10px', background: 'var(--neutral-50)' }}>
          ...외 {data.length - 50}건 더 있음
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: 'var(--radius-full)', background: 'var(--muted-foreground)',
          animation: `aiDotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes aiDotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

export default function AIAssistant() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState(null);
  const [pendingMsgIndex, setPendingMsgIndex] = useState(null);
  const [statusAlerts, setStatusAlerts] = useState([]);
  const [showExamples, setShowExamples] = useState(true);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, pendingActions]);

  // 초기 상태 알림 로드
  useEffect(() => {
    api('/ai/status').then(data => {
      if (data.alerts && data.alerts.length > 0) {
        setStatusAlerts(data.alerts);
      }
    }).catch(() => {});
  }, []);

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setPendingActions(null);
    setPendingMsgIndex(null);
    setShowExamples(false);

    try {
      const res = await apiPost('/ai/parse', {
        message: msg,
        history: messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMsg = {
        role: 'assistant',
        content: res.message || '',
        actions: res.actions || null,
        status: res.status || 'done',
        data: res.data || null,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (res.status === 'pending' && res.actions && res.actions.length > 0) {
        setPendingActions(res.actions);
        setPendingMsgIndex(messages.length + 1);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.message || '오류가 발생했습니다. 다시 시도해주세요.',
        status: 'error',
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleConfirm = async () => {
    if (!pendingActions || loading) return;
    setLoading(true);

    try {
      const res = await apiPost('/ai/execute', { actions: pendingActions });

      if (pendingMsgIndex != null) {
        setMessages(prev => prev.map((m, i) =>
          i === pendingMsgIndex ? { ...m, status: 'confirmed' } : m
        ));
      }

      const resultMsg = {
        role: 'assistant',
        content: res.message || '작업이 완료되었습니다.',
        status: 'done',
        data: res.data || null,
      };
      setMessages(prev => [...prev, resultMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.message || '실행 중 오류가 발생했습니다.',
        status: 'error',
      }]);
    } finally {
      setPendingActions(null);
      setPendingMsgIndex(null);
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleCancel = () => {
    if (pendingMsgIndex != null) {
      setMessages(prev => prev.map((m, i) =>
        i === pendingMsgIndex ? { ...m, status: 'cancelled' } : m
      ));
    }
    setPendingActions(null);
    setPendingMsgIndex(null);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '작업이 취소되었습니다.',
      status: 'done',
    }]);
    inputRef.current?.focus();
  };

  const handleClearChat = () => {
    setMessages([]);
    setPendingActions(null);
    setPendingMsgIndex(null);
    setShowExamples(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'done': return { bg: 'var(--success-light)', border: 'oklch(90% 0.06 145)', color: 'oklch(30% 0.12 145)' };
      case 'error': return { bg: 'var(--destructive-light)', border: 'oklch(88% 0.06 25)', color: 'oklch(35% 0.15 25)' };
      case 'clarification': return { bg: 'var(--warning-light)', border: 'oklch(85% 0.06 60)', color: 'oklch(35% 0.12 75)' };
      case 'pending': return { bg: 'var(--info-light)', border: 'oklch(82% 0.06 260)', color: 'var(--primary)' };
      case 'confirmed': return { bg: 'var(--success-light)', border: 'oklch(90% 0.06 145)', color: 'oklch(30% 0.12 145)' };
      case 'cancelled': return { bg: 'var(--neutral-50)', border: 'var(--border)', color: 'var(--muted-foreground)' };
      default: return { bg: 'var(--neutral-50)', border: 'var(--border)', color: 'var(--foreground)' };
    }
  };

  return (
    <div className="content" style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', padding: '0 8px' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', textAlign: 'center', flexShrink: 0,
        background: 'linear-gradient(135deg, oklch(55% 0.18 275) 0%, oklch(40% 0.18 300) 100%)',
        borderRadius: 'var(--radius-lg)', marginTop: 8, color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => navigate('/admin')} style={{
            background: 'oklch(100% 0 0 / 0.2)', border: 'none', borderRadius: 'var(--radius)',
            padding: '6px 12px', color: 'white', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600,
          }}>← 대시보드</button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>🤖 AI 어시스턴트</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>자연어로 학원을 관리하세요</div>
          </div>
          <button onClick={handleClearChat} style={{
            background: 'oklch(100% 0 0 / 0.2)', border: 'none', borderRadius: 'var(--radius)',
            padding: '6px 12px', color: 'white', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600,
          }}>🗑 새 대화</button>
        </div>
      </div>

      {/* Status Alerts */}
      {statusAlerts.length > 0 && messages.length === 0 && (
        <div style={{
          margin: '8px 0 0', padding: '10px 14px', borderRadius: 10,
          background: 'var(--warning-light)', border: '1px solid oklch(85% 0.06 60)', fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'oklch(35% 0.12 75)' }}>⚠️ 알림</div>
          {statusAlerts.map((alert, i) => (
            <div key={i} style={{ padding: '2px 0', color: 'oklch(30% 0.10 75)' }}>{alert}</div>
          ))}
        </div>
      )}

      {/* Chat Area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10,
        minHeight: 0,
      }}>
        {/* Examples */}
        {showExamples && messages.length === 0 && (
          <div style={{ padding: '8px 0' }}>
            {EXAMPLE_CATEGORIES.map((cat, ci) => (
              <div key={ci} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6, paddingLeft: 2 }}>
                  {cat.label}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cat.examples.map((ex, i) => (
                    <button key={i} onClick={() => handleSend(ex)} style={{
                      padding: '7px 14px', borderRadius: 20, border: '1px solid var(--border)',
                      background: 'var(--card)', cursor: 'pointer', fontSize: 12, color: 'var(--foreground)',
                      transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                      onMouseEnter={e => { e.target.style.background = 'var(--info-light)'; e.target.style.borderColor = 'oklch(72% 0.10 260)'; e.target.style.color = 'var(--primary)'; }}
                      onMouseLeave={e => { e.target.style.background = 'var(--card)'; e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--foreground)'; }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const statusStyle = !isUser ? getStatusStyle(msg.status) : null;

          return (
            <div key={i} style={{
              display: 'flex',
              justifyContent: isUser ? 'flex-end' : 'flex-start',
              padding: '0 2px',
            }}>
              <div style={{
                maxWidth: msg.data ? '95%' : '85%',
                padding: '10px 14px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isUser ? 'var(--primary)' : (statusStyle?.bg || 'var(--neutral-50)'),
                color: isUser ? 'white' : (statusStyle?.color || 'var(--foreground)'),
                border: isUser ? 'none' : `1px solid ${statusStyle?.border || 'var(--border)'}`,
                fontSize: 13,
                lineHeight: 1.6,
                wordBreak: 'break-word',
                boxShadow: '0 1px 3px oklch(0% 0 0 / 0.06)',
              }}>
                {/* Status icon */}
                {!isUser && msg.status === 'error' && <span style={{ marginRight: 4 }}>❌</span>}
                {!isUser && msg.status === 'clarification' && <span style={{ marginRight: 4 }}>💡</span>}

                {/* Message content with formatting */}
                {isUser ? msg.content : <FormatMessage text={msg.content} />}

                {/* Query result table */}
                {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                  <QueryResultTable data={msg.data} />
                )}

                {/* Action preview in confirmed/cancelled messages */}
                {msg.actions && msg.actions.length > 0 && (msg.status === 'confirmed' || msg.status === 'cancelled') && (
                  <div style={{
                    marginTop: 8, padding: 8, borderRadius: 'var(--radius)',
                    background: msg.status === 'confirmed' ? 'oklch(52% 0.14 160 / 0.08)' : 'oklch(0% 0 0 / 0.03)',
                    border: `1px solid ${msg.status === 'confirmed' ? 'oklch(90% 0.06 145)' : 'var(--border)'}`,
                    fontSize: 12,
                  }}>
                    {msg.actions.map((action, ai) => {
                      const al = ACTION_LABELS[action.type] || { icon: '⚙️', label: action.type };
                      return (
                        <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{al.icon}</span>
                          <span style={{ fontWeight: 600 }}>{al.label}</span>
                          {msg.status === 'confirmed' && <span style={{ color: 'var(--success)' }}>(실행됨 ✓)</span>}
                          {msg.status === 'cancelled' && <span style={{ color: 'var(--neutral-400)' }}>(취소됨)</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '0 2px' }}>
            <div style={{
              padding: '12px 18px', borderRadius: '16px 16px 16px 4px',
              background: 'var(--neutral-50)', border: '1px solid var(--border)',
              boxShadow: '0 1px 3px oklch(0% 0 0 / 0.06)',
            }}>
              <LoadingDots />
            </div>
          </div>
        )}

        {/* Action Confirmation Card */}
        {pendingActions && pendingActions.length > 0 && !loading && (
          <div style={{
            margin: '4px 2px 8px',
            padding: 16,
            borderRadius: 14,
            background: 'var(--card)',
            border: '2px solid var(--primary)',
            boxShadow: '0 4px 16px oklch(55% 0.18 260 / 0.12)',
          }}>
            <div style={{
              fontSize: 14, fontWeight: 800, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)',
            }}>
              📋 실행할 작업을 확인해주세요
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingActions.map((action, i) => {
                const al = ACTION_LABELS[action.type] || { icon: '⚙️', label: action.type };
                return (
                  <div key={i} style={{
                    padding: 12, borderRadius: 10, background: 'var(--neutral-50)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 8,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--info-light)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, flexShrink: 0,
                      }}>{al.icon}</span>
                      {al.label}
                      {action.description && (
                        <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', fontSize: 12 }}>— {action.description}</span>
                      )}
                    </div>
                    <div style={{ paddingLeft: 30 }}>
                      {formatActionPreview(action)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={handleConfirm} style={{
                flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, oklch(52% 0.14 160), oklch(42% 0.12 160))', color: 'white',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                boxShadow: '0 2px 8px oklch(52% 0.14 160 / 0.3)',
              }}>
                ✅ 실행하기
              </button>
              <button onClick={handleCancel} style={{
                flex: 1, padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--neutral-50)', color: 'var(--muted-foreground)', fontWeight: 700, fontSize: 14,
                cursor: 'pointer',
              }}>
                ❌ 취소
              </button>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        flexShrink: 0, padding: '10px 0 12px', borderTop: '1px solid var(--border)',
        background: 'var(--background)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="무엇이든 물어보세요... (예: 오늘 학원 현황 알려줘)"
            rows={1}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border)', fontSize: 14,
              resize: 'none', outline: 'none', lineHeight: 1.5,
              maxHeight: 120, minHeight: 44,
              fontFamily: 'inherit',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px oklch(55% 0.18 260 / 0.1)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            style={{
              padding: '11px 20px', borderRadius: 'var(--radius-lg)', border: 'none',
              background: loading || !input.trim() ? 'var(--border)' : 'linear-gradient(135deg, var(--info), oklch(48% 0.18 260))',
              color: 'white', fontWeight: 700, fontSize: 14,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0, height: 44,
              transition: 'all 0.2s',
              boxShadow: loading || !input.trim() ? 'none' : '0 2px 8px oklch(55% 0.18 260 / 0.3)',
            }}
          >
            {loading ? '⏳' : '전송'}
          </button>
        </div>
      </div>
    </div>
  );
}
