import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, apiPost, apiDelete, apiUpload } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';

export default function SchoolPage() {
  const { config } = useTenantConfig();
  const { school } = useParams();
  const navigate = useNavigate();
  const schoolName = decodeURIComponent(school);
  const schoolConfig = (config.schools || []).find(s => s.name === schoolName) || null;
  const grades = schoolConfig ? schoolConfig.grades : ['1학년', '2학년'];

  const [gradeCounts, setGradeCounts] = useState({});
  const [exams, setExams] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [showExamForm, setShowExamForm] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [newExam, setNewExam] = useState({ examType: '학력평가 모의고사', name: '', examDate: '', grade: '', maxScore: 100 });
  const [newMaterial, setNewMaterial] = useState({ title: '', description: '', classDate: '', youtubeUrl: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('overview');

  const loadData = () => {
    api(`/admin/schools/${encodeURIComponent(schoolName)}/grades`).then((data) => {
      const counts = {};
      data.forEach((g) => { counts[g.grade] = g.student_count; });
      setGradeCounts(counts);
    }).catch(console.error);

    api('/scores/exams').then((data) => {
      setExams(data.filter(e => e.school === schoolName));
    }).catch(console.error);

    api(`/admin/materials?school=${encodeURIComponent(schoolName)}`).then(setMaterials).catch(console.error);
  };

  useEffect(() => { loadData(); }, [schoolName]);

  const createExam = async (e) => {
    e.preventDefault();
    try {
      await apiPost('/scores/exams', {
        examType: newExam.examType,
        name: newExam.name,
        examDate: newExam.examDate || null,
        school: schoolName,
        grade: newExam.grade || null,
        maxScore: parseFloat(newExam.maxScore) || 100
      });
      setNewExam({ examType: '학력평가 모의고사', name: '', examDate: '', grade: '', maxScore: 100 });
      setShowExamForm(false);
      setMsg('시험이 등록되었습니다.');
      loadData();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const deleteExam = async (examId) => {
    if (!confirm('이 시험과 관련 성적을 모두 삭제하시겠습니까?')) return;
    await apiDelete(`/scores/exams/${examId}`);
    loadData();
  };

  const createMaterial = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('school', schoolName);
      formData.append('title', newMaterial.title);
      formData.append('description', newMaterial.description);
      formData.append('classDate', newMaterial.classDate);
      formData.append('youtubeUrl', newMaterial.youtubeUrl);
      if (uploadFile) {
        formData.append('file', uploadFile);
      }
      await apiUpload('/admin/materials', formData);
      setNewMaterial({ title: '', description: '', classDate: '', youtubeUrl: '' });
      setUploadFile(null);
      setShowMaterialForm(false);
      setMsg('수업 자료가 등록되었습니다.');
      loadData();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const deleteMaterial = async (materialId) => {
    if (!confirm('이 자료를 삭제하시겠습니까?')) return;
    await apiDelete(`/admin/materials/${materialId}`);
    loadData();
  };

  const getExamBadgeClass = (type) => {
    if (type === '학력평가 모의고사') return 'badge badge-info';
    if (type?.includes('파이널')) return 'badge badge-danger';
    if (type?.includes('모의고사')) return 'badge badge-purple';
    return 'badge badge-warning';
  };

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&?\s]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  return (
    <div className="content">
      <div className="breadcrumb">
        <Link to="/admin">대시보드</Link> &gt; <span>{schoolName}</span>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>학년 현황</button>
        <button className={`tab ${tab === 'exams' ? 'active' : ''}`} onClick={() => setTab('exams')}>시험 관리</button>
        <button className={`tab ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>수업 자료</button>
      </div>

      {tab === 'overview' && (
        <div className="card">
          <h2>{schoolName} - 학년별 현황</h2>
          <div className="card-grid">
            {grades.map((g) => (
              <div
                key={g}
                className="grid-card"
                onClick={() => navigate(`/admin/school/${encodeURIComponent(schoolName)}/grade/${encodeURIComponent(g)}`)}
              >
                <div className="title">{g}</div>
                <div className="count">학생 {gradeCounts[g] || 0}명</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'exams' && (
        <div className="card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {schoolName} 시험 관리
            <button className="btn btn-primary btn-sm" onClick={() => setShowExamForm(!showExamForm)}>
              {showExamForm ? '취소' : '+ 시험 등록'}
            </button>
          </h2>

          {showExamForm && (
            <form onSubmit={createExam} style={{ background: 'var(--neutral-50)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>시험 분류 *</label>
                  <select value={newExam.examType} onChange={(e) => setNewExam({ ...newExam, examType: e.target.value })}>
                    {(config.examTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>시험명 *</label>
                  <input value={newExam.name} onChange={(e) => setNewExam({ ...newExam, name: e.target.value })} placeholder="예: 3월 모의고사" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>시험 날짜</label>
                  <input type="date" value={newExam.examDate} onChange={(e) => setNewExam({ ...newExam, examDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>만점</label>
                  <input type="number" value={newExam.maxScore} onChange={(e) => setNewExam({ ...newExam, maxScore: e.target.value })} min="1" placeholder="100" />
                </div>
              </div>
              <div className="form-group">
                <label>대상 학년 (비우면 전체)</label>
                <select value={newExam.grade} onChange={(e) => setNewExam({ ...newExam, grade: e.target.value })}>
                  <option value="">전체</option>
                  {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-success">등록</button>
            </form>
          )}

          {exams.length === 0 ? (
            <p style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 20 }}>등록된 시험이 없습니다.</p>
          ) : (
            <table>
              <thead>
                <tr><th>분류</th><th>시험명</th><th>날짜</th><th>만점</th><th>대상</th><th></th></tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className={getExamBadgeClass(e.exam_type)}>
                        {e.exam_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td>{e.exam_date || '-'}</td>
                    <td>{e.max_score}점</td>
                    <td>{e.grade || '전체'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/admin/scores?exam=${e.id}`)}>성적입력</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteExam(e.id)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'materials' && (
        <div className="card">
          <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {schoolName} 수업 자료
            <button className="btn btn-primary btn-sm" onClick={() => setShowMaterialForm(!showMaterialForm)}>
              {showMaterialForm ? '취소' : '+ 자료 등록'}
            </button>
          </h2>

          {showMaterialForm && (
            <form onSubmit={createMaterial} style={{ background: 'var(--neutral-50)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>제목 *</label>
                  <input value={newMaterial.title} onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })} placeholder="수업 제목" required />
                </div>
                <div className="form-group">
                  <label>수업 날짜</label>
                  <input type="date" value={newMaterial.classDate} onChange={(e) => setNewMaterial({ ...newMaterial, classDate: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>설명</label>
                <textarea
                  value={newMaterial.description}
                  onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })}
                  placeholder="수업 내용 설명..."
                  style={{ minHeight: 60 }}
                />
              </div>
              <div className="form-group">
                <label>유튜브 링크</label>
                <input value={newMaterial.youtubeUrl} onChange={(e) => setNewMaterial({ ...newMaterial, youtubeUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div className="form-group">
                <label>파일 업로드</label>
                <input type="file" onChange={(e) => setUploadFile(e.target.files[0])} />
              </div>
              <button type="submit" className="btn btn-success">등록</button>
            </form>
          )}

          {materials.length === 0 ? (
            <p style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 20 }}>등록된 수업 자료가 없습니다.</p>
          ) : (
            <div>
              {materials.map((m) => (
                <div key={m.id} style={{
                  border: '1px solid #eee', borderRadius: 10, padding: 16, marginBottom: 12,
                  background: 'var(--neutral-50)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--foreground)', marginBottom: 4 }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--neutral-400)', marginBottom: 8 }}>
                        {m.class_date || '날짜 미지정'} | 등록: {m.created_at}
                      </div>
                      {m.description && (
                        <p style={{ fontSize: 14, color: 'var(--neutral-600)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{m.description}</p>
                      )}
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteMaterial(m.id)}>삭제</button>
                  </div>

                  {m.youtube_url && getYoutubeEmbedUrl(m.youtube_url) && (
                    <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden' }}>
                      <iframe
                        width="100%" height="315"
                        src={getYoutubeEmbedUrl(m.youtube_url)}
                        title={m.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ borderRadius: 8 }}
                      />
                    </div>
                  )}

                  {m.file_name && (
                    <div style={{ marginTop: 8 }}>
                      <a
                        href={`/uploads/${m.file_path}`}
                        download={m.file_name}
                        className="btn btn-primary btn-sm"
                        style={{ textDecoration: 'none' }}
                      >
                        {m.file_name} 다운로드
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
