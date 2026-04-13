import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiDelete } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';
import BottomTabBar from '../../components/BottomTabBar';

const DEFAULT_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'
];

const DEFAULT_TOPICS = [
  '수업 내용 질문', '시험 분석', '학습 방법 상담',
  '진도 점검', '오답 분석', '보충 수업', '시험 대비', '재시험', '기타',
];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function ClinicApply() {
  const { config } = useTenantConfig();
  const TIME_SLOTS = config.clinicSettings?.timeSlots || DEFAULT_TIME_SLOTS;
  const TOPICS = config.clinicSettings?.topics || DEFAULT_TOPICS;
  const navigate = useNavigate();
  const [myAppointments, setMyAppointments] = useState([]);
  const [form, setForm] = useState({
    appointment_date: '',
    time_slot: '',
    topic: '',
    detail: '',
  });
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const [loading, setLoading] = useState(false);
  const [slotCounts, setSlotCounts] = useState({});
  const [maxPerSlot, setMaxPerSlot] = useState(0);

  const load = () => {
    api('/clinic/my').then(setMyAppointments).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  // 날짜 선택 시 잔여석 로드
  useEffect(() => {
    if (form.appointment_date) {
      api(`/clinic/slot-counts?date=${form.appointment_date}`)
        .then(data => { setSlotCounts(data.counts || {}); setMaxPerSlot(data.maxPerSlot || 0); })
        .catch(console.error);
    } else {
      setSlotCounts({});
      setMaxPerSlot(0);
    }
  }, [form.appointment_date]);

  // 최소 날짜: 내일
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  // 2주 후 최대
  const maxD = new Date();
  maxD.setDate(maxD.getDate() + 14);
  const maxDate = maxD.toISOString().split('T')[0];

  const handleSubmit = async () => {
    if (!form.appointment_date || !form.time_slot || !form.topic) {
      setMsg('날짜, 시간, 질문 내용을 모두 선택해주세요.');
      setMsgType('error');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost('/clinic', form);
      setMsg(data.message);
      setMsgType('success');
      setForm({ appointment_date: '', time_slot: '', topic: '', detail: '' });
      load();
    } catch (e) {
      setMsg(e.message);
      setMsgType('error');
    }
    setLoading(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleCancel = async (id) => {
    if (!confirm('클리닉 신청을 취소하시겠습니까?')) return;
    try {
      await apiDelete(`/clinic/${id}`);
      setMsg('클리닉 신청이 취소되었습니다.');
      setMsgType('success');
      load();
    } catch (e) {
      setMsg(e.message);
      setMsgType('error');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return { text: '대기 중', bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)' };
      case 'approved': return { text: '승인됨', bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)' };
      case 'rejected': return { text: '거절됨', bg: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)' };
      case 'completed': return { text: '완료', bg: 'oklch(92% 0.04 270)', color: 'oklch(32% 0.12 270)' };
      default: return { text: status, bg: 'var(--muted)', color: 'var(--neutral-700)' };
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = DAY_NAMES[d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}(${day})`;
  };

  const selectedDay = form.appointment_date
    ? DAY_NAMES[new Date(form.appointment_date + 'T00:00:00').getDay()]
    : '';

  return (
    <div className="content" style={{ paddingBottom: 80 }}>
      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>📋 개별 클리닉 신청</h2>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          원하는 날짜와 시간에 1:1 클리닉을 신청하세요
        </p>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 8,
          background: msgType === 'error' ? 'var(--destructive-light)' : 'var(--success-light)',
          color: msgType === 'error' ? 'oklch(35% 0.15 25)' : 'oklch(30% 0.12 145)',
          fontSize: 13, fontWeight: 600
        }}>{msg}</div>
      )}

      {/* 신청 폼 */}
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>새 클리닉 신청</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 날짜 선택 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>
              📅 날짜 선택 {selectedDay && <span style={{ color: 'var(--primary)' }}>({selectedDay}요일)</span>}
            </label>
            <input
              type="date"
              value={form.appointment_date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
            />
          </div>

          {/* 시간 선택 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>
              ⏰ 시간 선택
              {maxPerSlot > 0 && <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400, marginLeft: 6 }}>
                (타임당 최대 {maxPerSlot}명)
              </span>}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
              {TIME_SLOTS.map(slot => {
                const count = slotCounts[slot] || 0;
                const isFull = maxPerSlot > 0 && count >= maxPerSlot;
                const isSelected = form.time_slot === slot;
                return (
                  <button key={slot} onClick={() => !isFull && setForm({ ...form, time_slot: slot })}
                    disabled={isFull}
                    style={{
                      padding: '6px 0', borderRadius: 8, border: '1px solid var(--border)', cursor: isFull ? 'not-allowed' : 'pointer',
                      fontWeight: 600, fontSize: 13,
                      background: isSelected ? 'var(--primary)' : isFull ? 'var(--muted)' : 'white',
                      color: isSelected ? 'white' : isFull ? 'var(--muted-foreground)' : 'var(--foreground)',
                      opacity: isFull ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}>
                    {slot}
                    {maxPerSlot > 0 && form.appointment_date && (
                      <div style={{ fontSize: 9, fontWeight: 400, color: isSelected ? 'oklch(90% 0 0)' : isFull ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                        {isFull ? '마감' : `${count}/${maxPerSlot}`}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 주제 선택 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>📝 질문 주제</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TOPICS.map(t => (
                <button key={t} onClick={() => setForm({ ...form, topic: t })} style={{
                  padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer',
                  fontWeight: 500, fontSize: 12,
                  background: form.topic === t ? 'var(--primary)' : 'white',
                  color: form.topic === t ? 'white' : 'var(--foreground)',
                  transition: 'all 0.2s'
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* 클리닉 희망 내용 */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>
              💬 클리닉 희망 내용
            </label>
            <div style={{
              fontSize: 11, color: 'oklch(55% 0.14 70)', background: 'var(--warning-light)', padding: '6px 10px',
              borderRadius: 6, marginBottom: 6, lineHeight: 1.5,
            }}>
              💡 클리닉 내용을 자세하게 입력해주면 더 빠르고 자세한 상담이 가능합니다!
            </div>
            <textarea
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              placeholder="예) 비문학 지문 읽는 속도가 너무 느려서 시간 내에 못 풀어요. 특히 과학/기술 지문이 어렵습니다."
              style={{ width: '100%', minHeight: 100, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? '신청 중...' : '클리닉 신청하기'}
          </button>
        </div>
      </div>

      {/* 내 신청 목록 */}
      <div className="card" style={{ padding: 16, marginTop: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>내 클리닉 신청 현황</h3>
        {myAppointments.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 20, fontSize: 13 }}>
            신청한 클리닉이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myAppointments.map(a => {
              const badge = getStatusBadge(a.status);
              return (
                <div key={a.id} style={{
                  border: '1px solid var(--border)', borderRadius: 10, padding: 14,
                  borderLeft: `4px solid ${a.status === 'approved' ? 'var(--success)' : a.status === 'pending' ? 'var(--warning)' : a.status === 'rejected' ? 'var(--destructive)' : 'oklch(50% 0.20 280)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>
                        {formatDate(a.appointment_date)} {a.time_slot}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: badge.bg, color: badge.color
                      }}>{badge.text}</span>
                      {a.attended === true && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: 'var(--success-light)', color: 'oklch(30% 0.12 145)' }}>출석</span>
                      )}
                      {a.attended === false && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: 'var(--destructive-light)', color: 'oklch(35% 0.15 25)' }}>결석</span>
                      )}
                    </div>
                    {(a.status === 'pending' || a.status === 'approved') && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleCancel(a.id)}
                        style={{ fontSize: 11, padding: '3px 8px' }}
                      >취소</button>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--foreground)' }}>
                    <span style={{ fontWeight: 600 }}>{a.topic}</span>
                    {a.detail && <span style={{ color: 'var(--muted-foreground)', marginLeft: 8 }}>- {a.detail}</span>}
                  </div>
                  {a.admin_note && (
                    <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4 }}>
                      💬 선생님: {a.admin_note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button className="btn btn-outline" onClick={() => navigate('/student')}
        style={{ width: '100%', marginTop: 8 }}>← 홈으로</button>
      <BottomTabBar />
    </div>
  );
}
