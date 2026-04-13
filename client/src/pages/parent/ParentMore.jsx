import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, getUser, logout } from '../../api';

export default function ParentMore() {
  const navigate = useNavigate();
  const user = getUser();
  const [view, setView] = useState('menu'); // menu | scores | inquiry | consent
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [scores, setScores] = useState([]);
  const [inquiryText, setInquiryText] = useState('');
  const [inquiryMsg, setInquiryMsg] = useState('');
  const [consent, setConsent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api('/parent/children').then((data) => {
      setChildren(data);
      if (data.length > 0) setSelectedChild(data[0]);
    }).catch(console.error);
  }, []);

  // 성적 로드
  useEffect(() => {
    if (view !== 'scores' || !selectedChild) return;
    setLoading(true);
    api(`/parent/children/${selectedChild.id}/scores`)
      .then(setScores)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [view, selectedChild]);

  // 수신 동의 로드
  useEffect(() => {
    if (view !== 'consent') return;
    api('/parent/consent').then(setConsent).catch(console.error);
  }, [view]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleInquiry = async () => {
    if (!inquiryText.trim()) return;
    try {
      await apiPost('/parent/inquiry', {
        content: inquiryText,
        student_id: selectedChild?.id,
      });
      setInquiryMsg('문의가 접수되었습니다.');
      setInquiryText('');
    } catch (e) {
      setInquiryMsg(e.message);
    }
  };

  const handleConsentToggle = async () => {
    try {
      const result = await apiPut('/parent/consent', {
        marketing_consent: !consent?.marketing_consent,
      });
      setConsent({ ...consent, marketing_consent: result.marketing_consent });
    } catch (e) { console.error(e); }
  };

  // 메뉴 뷰
  if (view === 'menu') {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>더보기</h2>

        <div style={styles.profileBox}>
          <div style={styles.avatar}>{(user?.name || '?')[0]}</div>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{user?.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>보호자</p>
          </div>
        </div>

        <div style={styles.menuList}>
          {[
            { label: '성적 보기', icon: '📊', action: () => setView('scores') },
            { label: '문의하기', icon: '💬', action: () => setView('inquiry') },
            { label: '수신 동의 관리', icon: '📩', action: () => setView('consent') },
            { label: '로그아웃', icon: '🚪', action: handleLogout, danger: true },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={item.action}
              style={{
                ...styles.menuItem,
                color: item.danger ? '#dc2626' : 'var(--text-primary, #111)',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontSize: 15 }}>{item.label}</span>
              <span style={{ marginLeft: 'auto', color: '#9ca3af' }}>&rsaquo;</span>
            </button>
          ))}
        </div>

        <div style={{ height: 80 }} />
      </div>
    );
  }

  // 성적 뷰
  if (view === 'scores') {
    return (
      <div style={styles.container}>
        <button onClick={() => setView('menu')} style={styles.backBtn}>&larr; 돌아가기</button>
        <h2 style={styles.title}>성적 보기</h2>

        {children.length > 1 && (
          <select
            value={selectedChild?.id || ''}
            onChange={(e) => setSelectedChild(children.find(c => c.id === Number(e.target.value)))}
            style={styles.select}
          >
            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>불러오는 중...</p>
        ) : scores.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>성적 기록이 없습니다.</p>
        ) : (
          scores.map(s => (
            <div key={s.id} style={styles.scoreCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{s.exam_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                    {s.exam_date ? new Date(s.exam_date).toLocaleDateString('ko-KR') : '-'}
                    {s.exam_type && ` | ${s.exam_type}`}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--primary-color, #4f46e5)' }}>
                    {s.score}<span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280' }}>/{s.total_score}</span>
                  </p>
                  {s.rank && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{s.rank}등</p>}
                </div>
              </div>
            </div>
          ))
        )}
        <div style={{ height: 80 }} />
      </div>
    );
  }

  // 문의 뷰
  if (view === 'inquiry') {
    return (
      <div style={styles.container}>
        <button onClick={() => { setView('menu'); setInquiryMsg(''); }} style={styles.backBtn}>&larr; 돌아가기</button>
        <h2 style={styles.title}>문의하기</h2>

        {children.length > 1 && (
          <select
            value={selectedChild?.id || ''}
            onChange={(e) => setSelectedChild(children.find(c => c.id === Number(e.target.value)))}
            style={styles.select}
          >
            {children.map(c => <option key={c.id} value={c.id}>{c.name} 관련</option>)}
          </select>
        )}

        <textarea
          value={inquiryText}
          onChange={(e) => setInquiryText(e.target.value)}
          placeholder="문의 내용을 입력해주세요."
          style={styles.textarea}
          rows={5}
        />
        <button onClick={handleInquiry} disabled={!inquiryText.trim()} style={{
          ...styles.submitBtn,
          opacity: inquiryText.trim() ? 1 : 0.5,
        }}>
          문의 보내기
        </button>
        {inquiryMsg && <p style={{ marginTop: 8, fontSize: 14, color: inquiryMsg.includes('오류') ? '#dc2626' : '#15803d' }}>{inquiryMsg}</p>}
        <div style={{ height: 80 }} />
      </div>
    );
  }

  // 수신 동의 뷰
  if (view === 'consent') {
    return (
      <div style={styles.container}>
        <button onClick={() => setView('menu')} style={styles.backBtn}>&larr; 돌아가기</button>
        <h2 style={styles.title}>수신 동의 관리</h2>

        <div style={styles.consentCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>마케팅 수신 동의</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                학원 소식, 이벤트 등 마케팅 메시지 수신
              </p>
            </div>
            <button
              onClick={handleConsentToggle}
              style={{
                ...styles.toggleBtn,
                background: consent?.marketing_consent ? 'var(--primary-color, #4f46e5)' : '#d1d5db',
              }}
            >
              <span style={{
                ...styles.toggleKnob,
                transform: consent?.marketing_consent ? 'translateX(20px)' : 'translateX(0)',
              }} />
            </button>
          </div>
          {consent?.consented_at && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9ca3af' }}>
              마지막 변경: {new Date(consent.consented_at).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>

        <div style={{ height: 80 }} />
      </div>
    );
  }

  return null;
}

const styles = {
  container: { maxWidth: 480, margin: '0 auto', padding: '16px 16px 0' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 12 },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, color: 'var(--primary-color, #4f46e5)',
    padding: '4px 0', marginBottom: 8,
  },
  profileBox: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 12,
    background: 'var(--bg-secondary, #f9fafb)',
    marginBottom: 16,
  },
  avatar: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'var(--primary-color, #4f46e5)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 700,
  },
  menuList: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 12px', borderRadius: 10, border: 'none',
    background: 'var(--bg-primary, #fff)', cursor: 'pointer',
    width: '100%', textAlign: 'left',
    borderBottom: '1px solid var(--border-color, #f3f4f6)',
  },
  select: {
    width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)', marginBottom: 12,
  },
  scoreCard: {
    padding: 14, borderRadius: 10,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)', marginBottom: 8,
  },
  textarea: {
    width: '100%', padding: 12, fontSize: 14, borderRadius: 8,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)', resize: 'vertical',
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  submitBtn: {
    marginTop: 8, width: '100%', padding: '12px 0', borderRadius: 8,
    border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600,
    background: 'var(--primary-color, #4f46e5)', color: '#fff',
  },
  consentCard: {
    padding: 16, borderRadius: 12,
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-primary, #fff)',
  },
  toggleBtn: {
    width: 44, height: 24, borderRadius: 12, border: 'none',
    cursor: 'pointer', position: 'relative', padding: 2,
    transition: 'background 0.2s',
  },
  toggleKnob: {
    display: 'block', width: 20, height: 20, borderRadius: '50%',
    background: '#fff', transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
};
