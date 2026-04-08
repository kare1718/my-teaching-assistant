import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, apiPost } from '../../api';
import BottomTabBar from '../../components/BottomTabBar';
import { SkeletonPage, ErrorState } from '../../components/StudentStates';

const PIN_LENGTH = 4;

export default function AttendanceCheck() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const loadHistory = () => {
    api('/attendance/student/me')
      .then(data => { setHistory(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setHistory([]); setLoading(false); });
  };

  useEffect(() => { loadHistory(); }, []);

  const showMessage = (text, type = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  };

  const handleCheckIn = async (pin) => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await apiPost('/attendance/check-in', { code: pin });
      showMessage(res.message || '출석이 확인되었습니다!', 'success');
      setCode('');
      loadHistory();
    } catch (e) {
      showMessage(e.message, 'error');
      setCode('');
    }
    setChecking(false);
  };

  const handleDigit = (digit) => {
    if (code.length >= PIN_LENGTH || checking) return;
    const next = code + digit;
    setCode(next);
    if (next.length === PIN_LENGTH) {
      handleCheckIn(next);
    }
  };

  const handleBackspace = () => {
    if (checking) return;
    setCode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (checking) return;
    setCode('');
  };

  if (loading) return (
    <div className="content s-page">
      <SkeletonPage />
      <BottomTabBar />
    </div>
  );

  return (
    <div className="content s-page">
      <div className="breadcrumb">
        <Link to="/student">홈</Link> &gt; <span>출석 체크</span>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 12, fontSize: 14, fontWeight: 600, textAlign: 'center',
          background: msgType === 'success' ? 'var(--success-light)' : 'var(--destructive-light)',
          color: msgType === 'success' ? 'var(--success)' : 'oklch(48% 0.20 25)',
        }}>
          {msg}
        </div>
      )}

      {/* 체크인 카드 */}
      <div className="s-card" style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, oklch(48% 0.18 260) 100%)',
        color: 'white', textAlign: 'center', padding: '28px 20px',
      }}>
        <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, opacity: 0.9 }}>출석 코드 입력</p>

        {/* PIN 디스플레이 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div key={i} style={{
              width: 48, height: 48, borderRadius: 12,
              background: i < code.length ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
              border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: 'var(--primary)',
              transition: 'all 0.15s ease',
              transform: i < code.length ? 'scale(1.05)' : 'scale(1)',
            }}>
              {i < code.length ? code[i] : ''}
            </div>
          ))}
        </div>

        {/* 숫자 키패드 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          maxWidth: 240, margin: '0 auto',
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => handleDigit(String(n))} disabled={checking}
              style={{
                padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 20, fontWeight: 700,
                fontFamily: 'inherit', transition: 'background 0.15s',
              }}
              onMouseDown={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseUp={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              {n}
            </button>
          ))}
          <button onClick={handleClear} disabled={checking}
            style={{
              padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit',
            }}>
            C
          </button>
          <button onClick={() => handleDigit('0')} disabled={checking}
            style={{
              padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 20, fontWeight: 700,
              fontFamily: 'inherit',
            }}>
            0
          </button>
          <button onClick={handleBackspace} disabled={checking}
            style={{
              padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: 600,
              fontFamily: 'inherit',
            }}>
            ←
          </button>
        </div>

        {checking && (
          <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>확인 중...</p>
        )}
      </div>

      {/* QR 안내 */}
      <div className="s-card" style={{ textAlign: 'center', color: 'var(--warm-500)', fontSize: 13 }}>
        QR 체크인은 추후 지원 예정입니다.
      </div>

      {/* 출결 기록 */}
      <div className="s-card">
        <div className="s-section-title">내 출결 기록</div>
        {history.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--warm-500)', fontSize: 14 }}>
            출결 기록이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', borderRadius: 10, background: 'var(--secondary)', border: '1px solid var(--student-border)',
              }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>
                    {h.date ? new Date(h.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) : '-'}
                  </p>
                  {h.check_in_time && (
                    <p style={{ fontSize: 12, color: 'var(--warm-500)', marginTop: 2 }}>
                      {h.check_in_time}
                    </p>
                  )}
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  background: h.status === 'present' ? 'var(--success-light)' : h.status === 'late' ? 'var(--warning-light)' : 'var(--destructive-light)',
                  color: h.status === 'present' ? 'var(--success)' : h.status === 'late' ? 'oklch(55% 0.14 85)' : 'oklch(48% 0.20 25)',
                }}>
                  {h.status === 'present' ? '출석' : h.status === 'late' ? '지각' : h.status === 'absent' ? '결석' : h.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}
