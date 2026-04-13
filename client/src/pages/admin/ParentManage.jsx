import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete } from '../../api';

export default function ParentManage() {
  const [parents, setParents] = useState([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [loading, setLoading] = useState(false);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingParent, setEditingParent] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', relationship: '보호자', is_payer: false, memo: '' });

  // 자녀 연결 모달
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkParentId, setLinkParentId] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [linkForm, setLinkForm] = useState({ student_id: '', relationship: '', is_primary: true, is_payer: false });

  // 자녀 목록 모달
  const [showChildrenModal, setShowChildrenModal] = useState(false);
  const [childrenParent, setChildrenParent] = useState(null);
  const [children, setChildren] = useState([]);

  const showMessage = (text, type = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 3000);
  };

  const loadParents = async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const data = await api(`/parents${params}`);
      setParents(data);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadParents(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadParents();
  };

  // 등록/수정 모달
  const openCreateModal = () => {
    setEditingParent(null);
    setForm({ name: '', phone: '', email: '', relationship: '보호자', is_payer: false, memo: '' });
    setShowModal(true);
  };

  const openEditModal = (parent) => {
    setEditingParent(parent);
    setForm({
      name: parent.name || '',
      phone: parent.phone || '',
      email: parent.email || '',
      relationship: parent.relationship || '보호자',
      is_payer: parent.is_payer || false,
      memo: parent.memo || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingParent) {
        await apiPut(`/parents/${editingParent.id}`, form);
        showMessage('보호자 정보가 수정되었습니다.');
      } else {
        await apiPost('/parents', form);
        showMessage('보호자가 등록되었습니다.');
      }
      setShowModal(false);
      loadParents();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" 보호자를 삭제하시겠습니까? 자녀 연결도 모두 해제됩니다.`)) return;
    try {
      await apiDelete(`/parents/${id}`);
      showMessage('보호자가 삭제되었습니다.');
      loadParents();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // 자녀 연결
  const openLinkModal = async (parentId) => {
    setLinkParentId(parentId);
    setLinkForm({ student_id: '', relationship: '', is_primary: true, is_payer: false });
    setStudentSearch('');
    try {
      const data = await api('/admin/students');
      setStudents(data);
    } catch (err) {
      showMessage('학생 목록 불러오기 실패', 'error');
    }
    setShowLinkModal(true);
  };

  const handleLink = async (e) => {
    e.preventDefault();
    if (!linkForm.student_id) return showMessage('학생을 선택해주세요.', 'error');
    try {
      await apiPost(`/parents/${linkParentId}/link-student`, linkForm);
      showMessage('자녀가 연결되었습니다.');
      setShowLinkModal(false);
      loadParents();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // 자녀 목록 보기
  const openChildrenModal = async (parent) => {
    setChildrenParent(parent);
    try {
      const data = await api(`/parents/${parent.id}/children`);
      setChildren(data);
    } catch (err) {
      setChildren([]);
    }
    setShowChildrenModal(true);
  };

  const handleUnlink = async (parentId, studentId, studentName) => {
    if (!window.confirm(`"${studentName}" 학생과의 연결을 해제하시겠습니까?`)) return;
    try {
      await apiDelete(`/parents/${parentId}/unlink-student/${studentId}`);
      showMessage('연결이 해제되었습니다.');
      const data = await api(`/parents/${parentId}/children`);
      setChildren(data);
      loadParents();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // 데이터 이전
  const handleMigrate = async () => {
    if (!window.confirm('기존 학생 데이터의 보호자 정보(parent_name, parent_phone)를 보호자 테이블로 이전합니다.\n\n같은 연락처의 보호자는 하나로 합쳐지며, 형제자매가 자동으로 연결됩니다.\n\n진행하시겠습니까?')) return;
    try {
      const result = await apiPost('/parents/migrate-from-students');
      showMessage(result.message);
      loadParents();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const filteredStudents = students.filter(s => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.school?.toLowerCase().includes(q);
  });

  return (
    <div className="content-area" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>보호자 관리</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={handleMigrate}>기존 데이터 이전</button>
          <button className="btn-primary" onClick={openCreateModal}>보호자 등록</button>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msgType === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {/* 검색바 */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="이름 또는 전화번호로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
        />
        <button type="submit" className="btn-primary">검색</button>
      </form>

      {/* 보호자 테이블 */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: 40 }}>불러오는 중...</p>
      ) : parents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted-foreground)' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>등록된 보호자가 없습니다.</p>
          <p style={{ fontSize: 14 }}>보호자를 등록하거나 "기존 데이터 이전" 버튼으로 학생 데이터에서 보호자를 가져오세요.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>이름</th>
                <th>연락처</th>
                <th>관계</th>
                <th>결제 책임</th>
                <th>자녀 수</th>
                <th>메모</th>
                <th style={{ width: 200 }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td>{p.phone || '-'}</td>
                  <td>{p.relationship || '-'}</td>
                  <td>{p.is_payer ? 'O' : '-'}</td>
                  <td>
                    <span
                      style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
                      onClick={() => openChildrenModal(p)}
                    >
                      {p.children_count || 0}명
                    </span>
                  </td>
                  <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.memo || '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn-small" onClick={() => openEditModal(p)}>편집</button>
                      <button className="btn-small" onClick={() => openLinkModal(p.id)}>자녀 연결</button>
                      <button className="btn-small btn-danger" onClick={() => handleDelete(p.id, p.name)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '90%' }}>
            <h3 style={{ marginTop: 0 }}>{editingParent ? '보호자 수정' : '보호자 등록'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label>
                  <span style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>이름 *</span>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                </label>
                <label>
                  <span style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>연락처 *</span>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required
                    placeholder="010-0000-0000"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                </label>
                <label>
                  <span style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>이메일</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                </label>
                <label>
                  <span style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>관계</span>
                  <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <option value="보호자">보호자</option>
                    <option value="부">부</option>
                    <option value="모">모</option>
                    <option value="조부">조부</option>
                    <option value="조모">조모</option>
                    <option value="기타">기타</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.is_payer} onChange={(e) => setForm({ ...form, is_payer: e.target.checked })} />
                  <span>결제 책임자</span>
                </label>
                <label>
                  <span style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>메모</span>
                  <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={3}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', resize: 'vertical' }} />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                <button type="submit" className="btn-primary">{editingParent ? '수정' : '등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 자녀 연결 모달 */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '90%' }}>
            <h3 style={{ marginTop: 0 }}>자녀 연결</h3>
            <input
              type="text"
              placeholder="학생 이름 또는 학교로 검색"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
              {filteredStudents.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setLinkForm({ ...linkForm, student_id: s.id })}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: linkForm.student_id === s.id ? 'var(--accent)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <strong>{s.name}</strong> - {s.school} {s.grade}
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <p style={{ padding: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>학생이 없습니다.</p>
              )}
            </div>
            <form onSubmit={handleLink}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label>
                  <span style={{ fontWeight: 500, display: 'block', marginBottom: 4 }}>관계</span>
                  <input type="text" value={linkForm.relationship} onChange={(e) => setLinkForm({ ...linkForm, relationship: e.target.value })}
                    placeholder="부, 모, 조부모 등"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={linkForm.is_primary} onChange={(e) => setLinkForm({ ...linkForm, is_primary: e.target.checked })} />
                  <span>주 보호자</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={linkForm.is_payer} onChange={(e) => setLinkForm({ ...linkForm, is_payer: e.target.checked })} />
                  <span>결제 책임자</span>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowLinkModal(false)}>취소</button>
                <button type="submit" className="btn-primary">연결</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 자녀 목록 모달 */}
      {showChildrenModal && childrenParent && (
        <div className="modal-overlay" onClick={() => setShowChildrenModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: '90%' }}>
            <h3 style={{ marginTop: 0 }}>{childrenParent.name}님의 자녀</h3>
            {children.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 20 }}>연결된 자녀가 없습니다.</p>
            ) : (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>학교</th>
                    <th>학년</th>
                    <th>관계</th>
                    <th>주 보호자</th>
                    <th>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {children.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.school}</td>
                      <td>{c.grade}</td>
                      <td>{c.relationship || '-'}</td>
                      <td>{c.is_primary ? 'O' : '-'}</td>
                      <td>
                        <button className="btn-small btn-danger" onClick={() => handleUnlink(childrenParent.id, c.id, c.name)}>
                          연결 해제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setShowChildrenModal(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
