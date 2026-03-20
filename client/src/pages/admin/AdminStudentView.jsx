import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api';

export default function AdminStudentView() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api(`/admin/students/${id}/view-data`).then(setData).catch(console.error);
  }, [id]);

  if (!data) return <div className="content"><p style={{ color: 'var(--muted-foreground)' }}>로딩 중...</p></div>;

  const { student, notices, scores } = data;

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt;{' '}
        <Link to={`/admin/student/${id}`}>{student.name} 관리</Link> &gt;{' '}
        <span>학생 페이지 미리보기</span>
      </div>

      <div style={{
        background: 'var(--warning)', color: '#92400e', padding: '8px 16px',
        borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        👁️ 관리자 미리보기 모드 — 학생에게 보이는 화면입니다
      </div>

      <div className="greeting-card">
        <h2>{student.name}님 안녕하세요!</h2>
        <p>언제나 강인쌤이 응원합니다.</p>
      </div>

      <div className="card floating-card">
        <h2>내 정보</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div className="stat-card floating-card"><span className="stat-label">이름</span><span className="stat-value" style={{ fontSize: 16 }}>{student.name}</span></div>
          <div className="stat-card floating-card"><span className="stat-label">학교</span><span className="stat-value" style={{ fontSize: 16 }}>{student.school}</span></div>
          <div className="stat-card floating-card"><span className="stat-label">학년</span><span className="stat-value" style={{ fontSize: 16 }}>{student.grade}</span></div>
          <div className="stat-card floating-card"><span className="stat-label">연락처</span><span className="stat-value" style={{ fontSize: 14 }}>{student.phone || '-'}</span></div>
          <div className="stat-card floating-card"><span className="stat-label">학부모</span><span className="stat-value" style={{ fontSize: 14 }}>{student.parent_name || '-'}</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card floating-card">
          <h2>최근 안내사항</h2>
          {notices.length === 0 ? <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>안내사항이 없습니다.</p> :
            notices.map((n) => (
              <div key={n.id} className="notice-card">
                <div className="notice-title">{n.title}</div>
                <div className="notice-date">{n.created_at}</div>
              </div>
            ))}
        </div>
        <div className="card floating-card">
          <h2>최근 성적</h2>
          {scores.length === 0 ? <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>등록된 성적이 없습니다.</p> : (
            <table><thead><tr><th>시험</th><th>점수</th></tr></thead><tbody>
              {scores.map((s, i) => (<tr key={i}><td>{s.exam_name}</td><td style={{ fontWeight: 600 }}>{s.score}점</td></tr>))}
            </tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}
