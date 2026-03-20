import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, apiPut, apiDelete } from '../../api';

export default function GradePage() {
  const { school, grade } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('active');
  const [msg, setMsg] = useState('');
  const [bulkGrade, setBulkGrade] = useState('');
  const schoolName = decodeURIComponent(school);
  const gradeName = decodeURIComponent(grade);

  const loadStudents = () => {
    api(`/admin/schools/${encodeURIComponent(schoolName)}/grades/${encodeURIComponent(gradeName)}/students`)
      .then(setStudents)
      .catch(console.error);
  };

  useEffect(() => { loadStudents(); }, [schoolName, gradeName]);

  const toggleStatus = async (studentId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await apiPut(`/admin/students/${studentId}/status`, { status: newStatus });
      setMsg(newStatus === 'active' ? '재원 상태로 변경되었습니다.' : '퇴원 처리되었습니다.');
      loadStudents();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const changeGrade = async (studentId, newGrade) => {
    try {
      await apiPut(`/admin/students/${studentId}/grade`, { grade: newGrade });
      setMsg(`학년이 ${newGrade}(으)로 변경되었습니다.`);
      loadStudents();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const bulkChangeGrade = async () => {
    if (!bulkGrade) return;
    if (!window.confirm(`${schoolName} ${gradeName} 재원 중인 학생 전체를 ${bulkGrade}(으)로 변경하시겠습니까?`)) return;
    try {
      await apiPut('/admin/bulk-grade', { school: schoolName, fromGrade: gradeName, toGrade: bulkGrade });
      setMsg(`${gradeName} → ${bulkGrade} 일괄 변경 완료`);
      loadStudents();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); }
  };

  const deleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`정말 ${studentName} 학생을 삭제하시겠습니까?\n성적, 후기 등 모든 데이터가 삭제됩니다.`)) return;
    try {
      await apiDelete(`/admin/students/${studentId}`);
      setMsg(`${studentName} 학생이 삭제되었습니다.`);
      loadStudents();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) { setMsg(err.message); }
  };

  const filteredStudents = filter === 'all' ? students :
    filter === 'active' ? students.filter(s => (s.status || 'active') === 'active') :
    students.filter(s => s.status === 'inactive');

  const activeCount = students.filter(s => (s.status || 'active') === 'active').length;
  const inactiveCount = students.filter(s => s.status === 'inactive').length;

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt;{' '}
        <Link to={`/admin/school/${encodeURIComponent(schoolName)}`}>{schoolName}</Link> &gt;{' '}
        <span>{gradeName}</span>
      </div>

      <div className="card floating-card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {schoolName} {gradeName} 학생 목록
          <span style={{
            fontSize: 13, fontWeight: 500, minHeight: 28,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: msg ? '#166534' : 'transparent',
            background: msg ? '#f0fdf4' : 'transparent',
            padding: '4px 14px', borderRadius: 'var(--radius)',
            border: msg ? '1px solid #bbf7d0' : '1px solid transparent',
            transition: 'all 0.3s'
          }}>{msg || '\u00A0'}</span>
        </h2>
        <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('active')}>
            재원 중 ({activeCount})
          </button>
          <button className={`btn btn-sm ${filter === 'inactive' ? 'btn-danger' : 'btn-outline'}`} onClick={() => setFilter('inactive')}>
            퇴원 ({inactiveCount})
          </button>
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-secondary' : 'btn-outline'}`} onClick={() => setFilter('all')}>
            전체 ({students.length})
          </button>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={bulkGrade} onChange={(e) => setBulkGrade(e.target.value)} style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}>
              <option value="">학년 선택</option>
              <option value="1학년">1학년</option>
              <option value="2학년">2학년</option>
              <option value="3학년">3학년</option>
            </select>
            <button className="btn btn-sm btn-warning" onClick={bulkChangeGrade} disabled={!bulkGrade}>
              일괄 학년 변경
            </button>
          </div>
        </div>
        {filteredStudents.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 40 }}>학생이 없습니다.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>학년</th>
                <th>상태</th>
                <th>연락처</th>
                <th>학부모</th>
                <th>특이사항</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id} style={(s.status === 'inactive') ? { opacity: 0.5 } : {}}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>
                    <select
                      value={s.grade}
                      onChange={(e) => changeGrade(s.id, e.target.value)}
                      style={{ width: 'auto', padding: '3px 24px 3px 8px', fontSize: 12 }}
                    >
                      <option value="1학년">1학년</option>
                      <option value="2학년">2학년</option>
                    </select>
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${(s.status || 'active') === 'active' ? 'btn-success' : 'btn-danger'}`}
                      onClick={() => toggleStatus(s.id, s.status || 'active')}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      {(s.status || 'active') === 'active' ? '재원 중' : '퇴원'}
                    </button>
                  </td>
                  <td>{s.phone || '-'}</td>
                  <td>{s.parent_name || '-'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.memo || '-'}
                  </td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/admin/student/${s.id}`)}>
                      관리
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteStudent(s.id, s.name)} style={{ fontSize: 11, padding: '3px 6px' }}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
