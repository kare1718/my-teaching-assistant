import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';
import { useTenantConfig } from '../../contexts/TenantContext';

export default function ReportManage() {
  const { config } = useTenantConfig();
  const STU_SCHOOLS = (config.schools || []).filter(s => s.name !== '조교' && s.name !== '선생님');
  const navigate = useNavigate();
  const [tab, setTab] = useState('write');
  const [status, setStatus] = useState({ gemini: false, sms: false });
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [template, setTemplate] = useState(null);

  // 작성 탭
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [className, setClassName] = useState('');
  const [students, setStudents] = useState([]); // [{id, name, school, grade, items:{}, aiComment:'', examData:null}]
  const [saving, setSaving] = useState(false);
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [msg, setMsg] = useState('');

  // 이력 탭
  const [reports, setReports] = useState([]);
  const [histSchool, setHistSchool] = useState('');
  const [histGrade, setHistGrade] = useState('');

  // 미리보기 모달
  const [previewId, setPreviewId] = useState(null);
  const iframeRef = useRef(null);

  // 템플릿 편집
  const [editTmpl, setEditTmpl] = useState(null);

  useEffect(() => {
    api('/reports/status').then(setStatus).catch(console.error);
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const data = await api('/reports/templates');
    setTemplates(data);
    if (data.length > 0 && !templateId) {
      setTemplateId(String(data[0].id));
      setTemplate({ ...data[0], fields: JSON.parse(data[0].fields_json) });
    }
  };

  useEffect(() => {
    if (!templateId) return;
    const t = templates.find(t => t.id === parseInt(templateId));
    if (t) setTemplate({ ...t, fields: JSON.parse(t.fields_json) });
  }, [templateId, templates]);

  // 학생 로드
  useEffect(() => {
    if (tab !== 'write' || !school) return;
    const params = new URLSearchParams();
    if (school) params.set('school', school);
    if (grade) params.set('grade', grade);
    api(`/reports/class-students?${params}`).then(data => {
      setStudents(data.map(s => ({
        ...s, items: {}, aiComment: '', examData: null, changed: false
      })));
      // 시험 데이터 자동 로드
      data.forEach((s, i) => {
        api(`/reports/student-exam-data/${s.id}`).then(exams => {
          setStudents(prev => {
            const next = [...prev];
            if (next[i]) {
              next[i] = { ...next[i], examData: exams[0] || null };
              if (exams[0]) {
                next[i].items = { ...next[i].items, exam_score: {
                  exam_name: exams[0].exam_name, score: exams[0].score,
                  max_score: exams[0].max_score, rank_num: exams[0].rank_num
                }};
              }
            }
            return next;
          });
        }).catch(() => {});
      });
    }).catch(console.error);
  }, [tab, school, grade]);

  // 항목 수정
  const updateItem = (studentIdx, key, value) => {
    setStudents(prev => {
      const next = [...prev];
      next[studentIdx] = { ...next[studentIdx], items: { ...next[studentIdx].items, [key]: value }, changed: true };
      return next;
    });
  };

  // AI 코멘트 생성
  const generateAI = async (studentIdx) => {
    const s = students[studentIdx];
    if (!s || !templateId) return;
    setAiLoadingId(s.id);
    try {
      const { comment } = await apiPost('/reports/generate-comment-preview', {
        studentId: s.id, items: s.items, templateId: parseInt(templateId)
      });
      setStudents(prev => {
        const next = [...prev];
        next[studentIdx] = { ...next[studentIdx], aiComment: comment, changed: true };
        return next;
      });
    } catch (e) {
      setMsg('AI 생성 실패: ' + e.message);
    }
    setAiLoadingId(null);
  };

  // 전체 AI 생성
  const generateAllAI = async () => {
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const hasData = Object.keys(s.items).some(k => s.items[k] !== '' && s.items[k] !== undefined);
      if (!hasData) continue;
      await generateAI(i);
    }
  };

  // 일괄 저장
  const saveAll = async () => {
    const changed = students.filter(s => s.changed);
    if (changed.length === 0) { setMsg('변경된 내용이 없습니다.'); return; }
    setSaving(true);
    try {
      const result = await apiPost('/reports/bulk', {
        templateId: parseInt(templateId), reportDate, className,
        reports: changed.map(s => ({ studentId: s.id, items: s.items, aiComment: s.aiComment }))
      });
      setMsg(result.message);
      setStudents(prev => prev.map(s => ({ ...s, changed: false })));
    } catch (e) { setMsg('저장 실패: ' + e.message); }
    setSaving(false);
  };

  // 이력 로드
  useEffect(() => {
    if (tab !== 'history') return;
    const params = new URLSearchParams();
    if (histSchool) params.set('school', histSchool);
    if (histGrade) params.set('grade', histGrade);
    api(`/reports/list?${params}`).then(setReports).catch(console.error);
  }, [tab, histSchool, histGrade]);

  // PDF 인쇄
  const printReport = () => {
    if (iframeRef.current) iframeRef.current.contentWindow.print();
  };

  // SMS 전송
  const sendSms = async (reportId) => {
    try {
      const result = await apiPost(`/reports/${reportId}/send-sms`, {});
      setMsg(result.message);
      if (tab === 'history') {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, sms_sent: 1 } : r));
      }
    } catch (e) { setMsg('SMS 전송 실패: ' + e.message); }
  };

  // 템플릿 저장
  const saveTmpl = async () => {
    if (!editTmpl?.name) return;
    try {
      if (editTmpl.id === 'new') {
        await apiPost('/reports/templates', { name: editTmpl.name, description: editTmpl.description, fields: editTmpl.fields });
      } else {
        await apiPut(`/reports/templates/${editTmpl.id}`, { name: editTmpl.name, description: editTmpl.description, fields: editTmpl.fields });
      }
      await loadTemplates();
      setEditTmpl(null);
    } catch (e) { alert(e.message); }
  };

  const grades = school ? ((config.schools || []).find(s => s.name === school)?.grades || []) : [];
  const histGrades = histSchool ? ((config.schools || []).find(s => s.name === histSchool)?.grades || []) : [];

  const TABS = [
    { id: 'write', label: '✍️ 레포트 작성' },
    { id: 'history', label: '📋 이력' },
    { id: 'template', label: '⚙️ 템플릿' },
  ];

  return (
    <div className="content max-w-7xl mx-auto w-full">
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>📄 수업 레포트</h2>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13,
            background: tab === t.id ? 'var(--primary)' : 'var(--muted)',
            color: tab === t.id ? 'white' : 'var(--foreground)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ===== 레포트 작성 탭 ===== */}
      {tab === 'write' && (
        <>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <select value={school} onChange={e => { setSchool(e.target.value); setGrade(''); }}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, minWidth: 100 }}>
                <option value="">학교 선택</option>
                {STU_SCHOOLS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <select value={grade} onChange={e => setGrade(e.target.value)}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, minWidth: 80 }}>
                <option value="">전체 학년</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
                style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input placeholder="수업명 (선택)" value={className} onChange={e => setClassName(e.target.value)}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
            </div>
          </div>

          {/* 학생별 입력 */}
          {students.length > 0 && template && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>👨‍🎓 학생별 입력 ({students.length}명)</h3>
                <div style={{ display: 'flex', gap: 4 }}>
                  {status.gemini && (
                    <button onClick={generateAllAI} disabled={!!aiLoadingId} style={{
                      padding: '6px 10px', borderRadius: 6, border: 'none', background: 'oklch(45% 0.22 290)',
                      color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}>🤖 전체 AI 생성</button>
                  )}
                  <button onClick={saveAll} disabled={saving} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
                    {saving ? '저장 중...' : '💾 일괄 저장'}
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                {students.map((s, si) => (
                  <div key={s.id} style={{
                    border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8,
                    background: s.changed ? 'var(--warning-light)' : 'var(--card)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 6 }}>{s.school} {s.grade}</span>
                      </div>
                      {s.examData && (
                        <span style={{ fontSize: 11, background: 'var(--info-light)', padding: '2px 8px', borderRadius: 4, color: 'oklch(32% 0.12 260)' }}>
                          최근시험: {s.examData.exam_name} {s.examData.score}점
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {template.fields.filter(f => f.type !== 'auto_score').map(f => (
                        <div key={f.key} style={{ minWidth: f.type === 'text' ? 200 : 120, flex: f.type === 'text' ? '1 1 200px' : '0 0 auto' }}>
                          <label style={{ fontSize: 10, color: 'var(--muted-foreground)', display: 'block', marginBottom: 2 }}>{f.label}</label>
                          {f.type === 'select' ? (
                            <select value={s.items[f.key] || ''} onChange={e => updateItem(si, f.key, e.target.value)}
                              style={{ width: '100%', padding: '5px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                              <option value="">-</option>
                              {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : f.type === 'score' ? (
                            <input value={s.items[f.key] || ''} onChange={e => updateItem(si, f.key, e.target.value)}
                              placeholder="점수" style={{ width: '100%', padding: '5px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                          ) : (
                            <input value={s.items[f.key] || ''} onChange={e => updateItem(si, f.key, e.target.value)}
                              placeholder={f.label} style={{ width: '100%', padding: '5px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* AI 코멘트 */}
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>AI 종합 코멘트</label>
                        <textarea value={s.aiComment} onChange={e => {
                          setStudents(prev => {
                            const next = [...prev];
                            next[si] = { ...next[si], aiComment: e.target.value, changed: true };
                            return next;
                          });
                        }} rows={2} placeholder="AI 생성 또는 직접 입력..."
                          style={{ width: '100%', padding: 6, border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                      </div>
                      {status.gemini && (
                        <button onClick={() => generateAI(si)} disabled={aiLoadingId === s.id}
                          style={{ marginTop: 14, padding: '6px 10px', borderRadius: 6, border: 'none', background: 'oklch(45% 0.22 290)', color: 'white', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {aiLoadingId === s.id ? '⏳' : '🤖 AI'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {students.length === 0 && school && (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)' }}>
              학생이 없습니다. 학교를 선택해주세요.
            </div>
          )}
        </>
      )}

      {/* ===== 이력 탭 ===== */}
      {tab === 'history' && (
        <>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <select value={histSchool} onChange={e => { setHistSchool(e.target.value); setHistGrade(''); }}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <option value="">전체 학교</option>
                {STU_SCHOOLS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <select value={histGrade} onChange={e => setHistGrade(e.target.value)}
                style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <option value="">전체 학년</option>
                {histGrades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📋 레포트 이력 ({reports.length}건)</h3>
            {reports.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>레포트가 없습니다.</div>
            ) : (
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {reports.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                    borderBottom: '1px solid var(--secondary)', fontSize: 13,
                  }}>
                    <span style={{ fontWeight: 700, minWidth: 50 }}>{r.student_name}</span>
                    <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>{r.school} {r.grade}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r.report_date}</span>
                    <span style={{ fontSize: 10, background: 'var(--secondary)', padding: '2px 6px', borderRadius: 4 }}>{r.template_name}</span>
                    {r.sms_sent ? (
                      <span style={{ fontSize: 10, background: 'var(--success-light)', color: 'oklch(30% 0.12 145)', padding: '2px 6px', borderRadius: 4 }}>📱 발송완료</span>
                    ) : null}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button onClick={() => setPreviewId(r.id)} style={{
                        padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
                        background: 'var(--muted)', fontSize: 10, cursor: 'pointer'
                      }}>미리보기</button>
                      {!r.sms_sent && (
                        <button onClick={() => sendSms(r.id)} style={{
                          padding: '4px 8px', borderRadius: 4, border: 'none',
                          background: 'oklch(48% 0.18 260)', color: 'white', fontSize: 10, cursor: 'pointer'
                        }}>📱 SMS</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 템플릿 탭 ===== */}
      {tab === 'template' && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>⚙️ 레포트 템플릿</h3>
            <button onClick={() => setEditTmpl({ id: 'new', name: '', description: '', fields: [] })}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>
              + 새 템플릿
            </button>
          </div>
          {templates.map(t => {
            const fields = JSON.parse(t.fields_json);
            return (
              <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span>
                    {t.is_default ? <span style={{ fontSize: 10, background: 'var(--info-light)', color: 'oklch(32% 0.12 260)', padding: '2px 6px', borderRadius: 4, marginLeft: 6 }}>기본</span> : null}
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{t.description}</div>
                  </div>
                  <button onClick={() => setEditTmpl({ ...t, fields })} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--info-light)', fontSize: 11, cursor: 'pointer'
                  }}>✏️ 수정</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {fields.map((f, i) => (
                    <span key={i} style={{ fontSize: 11, background: 'var(--secondary)', padding: '3px 8px', borderRadius: 4 }}>
                      {f.label} ({f.type === 'select' ? '선택' : f.type === 'score' ? '점수' : f.type === 'auto_score' ? '자동' : '텍스트'})
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 템플릿 편집 모달 */}
      {editTmpl && (
        <>
          <div onClick={() => setEditTmpl(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 300 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--card)', borderRadius: 16, padding: 20, width: '90%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto', zIndex: 301, boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)' }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>{editTmpl.id === 'new' ? '새 템플릿' : '템플릿 수정'}</h3>
            <input value={editTmpl.name} onChange={e => setEditTmpl({ ...editTmpl, name: e.target.value })}
              placeholder="템플릿 이름" style={{ width: '100%', padding: 8, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, fontSize: 13, boxSizing: 'border-box' }} />
            <input value={editTmpl.description || ''} onChange={e => setEditTmpl({ ...editTmpl, description: e.target.value })}
              placeholder="설명 (선택)" style={{ width: '100%', padding: 8, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, fontSize: 13, boxSizing: 'border-box' }} />

            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>항목 목록</h4>
            {(editTmpl.fields || []).map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <input value={f.label} onChange={e => {
                  const fields = [...editTmpl.fields];
                  fields[i] = { ...f, label: e.target.value, key: e.target.value.replace(/\s/g, '_').toLowerCase() };
                  setEditTmpl({ ...editTmpl, fields });
                }} placeholder="항목명" style={{ flex: 1, padding: 6, border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }} />
                <select value={f.type} onChange={e => {
                  const fields = [...editTmpl.fields];
                  fields[i] = { ...f, type: e.target.value };
                  setEditTmpl({ ...editTmpl, fields });
                }} style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}>
                  <option value="select">선택형</option>
                  <option value="score">점수형</option>
                  <option value="text">텍스트</option>
                  <option value="auto_score">자동(시험)</option>
                </select>
                {f.type === 'select' && (
                  <input value={(f.options || []).join(',')} onChange={e => {
                    const fields = [...editTmpl.fields];
                    fields[i] = { ...f, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                    setEditTmpl({ ...editTmpl, fields });
                  }} placeholder="옵션1,옵션2,..." style={{ flex: 1, padding: 6, border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 }} />
                )}
                <button onClick={() => {
                  const fields = editTmpl.fields.filter((_, fi) => fi !== i);
                  setEditTmpl({ ...editTmpl, fields });
                }} style={{ padding: '4px 8px', border: 'none', background: 'var(--destructive-light)', color: 'oklch(48% 0.20 25)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>
            ))}
            <button onClick={() => setEditTmpl({ ...editTmpl, fields: [...(editTmpl.fields || []), { key: '', label: '', type: 'select', options: [] }] })}
              style={{ width: '100%', padding: 8, border: '1px dashed var(--border)', borderRadius: 6, background: 'var(--background)', cursor: 'pointer', fontSize: 12, marginTop: 4, marginBottom: 12 }}>
              + 항목 추가
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setEditTmpl(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={saveTmpl} style={{ flex: 1 }}>저장</button>
            </div>
          </div>
        </>
      )}

      {/* 미리보기 모달 */}
      {previewId && (
        <>
          <div onClick={() => setPreviewId(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.5)', zIndex: 300 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--card)', borderRadius: 16, padding: 16, width: '90%', maxWidth: 650, height: '80vh', zIndex: 301, boxShadow: '0 20px 60px oklch(0% 0 0 / 0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
              <h3 style={{ fontSize: 16, margin: 0 }}>📄 레포트 미리보기</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={printReport} className="btn btn-outline" style={{ fontSize: 11, padding: '6px 12px' }}>🖨 PDF 인쇄</button>
                <button onClick={() => sendSms(previewId)} className="btn btn-primary" style={{ fontSize: 11, padding: '6px 12px' }}>📱 SMS</button>
                <button onClick={() => setPreviewId(null)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            <iframe ref={iframeRef} src={`/api/reports/${previewId}/preview`}
              style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, width: '100%' }} />
          </div>
        </>
      )}

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, marginTop: 4,
          background: msg.includes('실패') ? 'var(--destructive-light)' : 'var(--success-light)',
          color: msg.includes('실패') ? 'oklch(48% 0.20 25)' : 'oklch(30% 0.12 145)',
          border: `1px solid ${msg.includes('실패') ? 'oklch(88% 0.06 25)' : 'oklch(90% 0.06 145)'}`
        }}>{msg}</div>
      )}

      <button className="btn btn-outline" onClick={() => navigate('/admin')} style={{ width: '100%', marginTop: 8 }}>
        ← 대시보드
      </button>
    </div>
  );
}
