import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { requestPayment } from '../utils/payment';

export default function PaymentPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    fetch(`/api/public/tuition/${token}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '결제 정보를 불러올 수 없습니다.');
        setInfo(data);
        if (data.alreadyPaid || data.status === 'paid') setPaid(true);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePay = async () => {
    if (!info) return;
    setPaying(true);
    setError('');
    try {
      const orderName = `${info.academy_name || '학원'} 수강료 - ${info.plan_name || '수납'}`;
      const { paymentId } = await requestPayment(info.amount, orderName, info.student_name || '학생');

      const res = await fetch(`/api/public/tuition/${token}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '결제 처리에 실패했습니다.');
      setPaid(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  };

  const containerStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(180deg, var(--background) 0%, var(--border) 100%)', padding: 20,
    fontFamily: "'Paperlogy', sans-serif",
  };

  const cardStyle = {
    background: 'var(--card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420,
    boxShadow: '0 4px 24px oklch(0% 0 0 / 0.08)',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ textAlign: 'center', color: 'var(--neutral-500)', fontSize: 15 }}>결제 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: 'var(--destructive-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 28,
            }}>!</div>
            <p style={{ color: 'var(--destructive)', fontSize: 15, fontWeight: 600 }}>{error}</p>
            <p style={{ color: 'var(--neutral-500)', fontSize: 13, marginTop: 8 }}>링크가 올바른지 확인해주세요.</p>
          </div>
        </div>
      </div>
    );
  }

  if (paid) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--success-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', border: '3px solid var(--success)',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'oklch(52% 0.14 150)', marginBottom: 8 }}>결제가 완료되었습니다</h2>
            <p style={{ color: 'var(--neutral-500)', fontSize: 14 }}>감사합니다. 결제가 정상적으로 처리되었습니다.</p>
            {info && (
              <div style={{ background: 'var(--background)', borderRadius: 12, padding: 16, marginTop: 20, textAlign: 'left' }}>
                <p style={{ fontSize: 13, color: 'var(--neutral-500)', marginBottom: 4 }}>{info.academy_name}</p>
                <p style={{ fontSize: 14, fontWeight: 600 }}>{info.student_name} - {Number(info.amount).toLocaleString()}원</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* 학원 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), oklch(50% 0.18 260))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', color: 'white', fontWeight: 900, fontSize: 20,
          }}>{(info.academy_name || '학')[0]}</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>{info.academy_name || '학원'}</h2>
          <p style={{ color: 'var(--neutral-500)', fontSize: 13, marginTop: 4 }}>수강료 결제</p>
        </div>

        {/* 결제 정보 */}
        <div style={{ background: 'var(--background)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--neutral-500)' }}>학생</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{info.student_name}</span>
          </div>
          {info.plan_name && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: 'var(--neutral-500)' }}>수강 과목</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{info.plan_name}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--neutral-500)' }}>납부 기한</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {info.due_date ? new Date(info.due_date).toLocaleDateString('ko-KR') : '-'}
            </span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--neutral-500)' }}>결제 금액</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)' }}>{Number(info.amount).toLocaleString()}원</span>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--destructive-light)', color: 'var(--destructive)', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {info.memo && (
          <p style={{ fontSize: 13, color: 'var(--neutral-500)', marginBottom: 16, textAlign: 'center' }}>{info.memo}</p>
        )}

        <button onClick={handlePay} disabled={paying}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--primary), oklch(50% 0.18 260))', color: 'white',
            fontWeight: 800, fontSize: 16, fontFamily: 'inherit', opacity: paying ? 0.6 : 1,
          }}>
          {paying ? '결제 진행 중...' : `${Number(info.amount).toLocaleString()}원 결제하기`}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--neutral-400)', marginTop: 16 }}>
          안전한 결제를 위해 PortOne 결제 시스템을 사용합니다
        </p>
      </div>
    </div>
  );
}
