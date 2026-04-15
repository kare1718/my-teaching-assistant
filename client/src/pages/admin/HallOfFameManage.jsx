import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';

const DEFAULT_CATEGORIES = ['1등급 달성', '성적 향상', '모의고사 우수', '수능 우수'];
const STATUS_TYPES = ['재학생', '졸업생'];

const STYLE_POOL = [
  { bg: 'var(--warning-light)', color: 'oklch(35% 0.12 75)', border: 'var(--warning)', emoji: '🥇' },
  { bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)', border: 'var(--success)', emoji: '📈' },
  { bg: 'var(--info-light)', color: 'oklch(32% 0.12 260)', border: 'var(--info)', emoji: '📊' },
  { bg: 'oklch(94% 0.04 350)', color: 'oklch(35% 0.15 350)', border: 'oklch(58% 0.20 350)', emoji: '💯' },
  { bg: 'oklch(92% 0.04 280)', color: 'oklch(28% 0.10 280)', border: 'oklch(50% 0.20 280)', emoji: '🏆' },
  { bg: 'oklch(96% 0.06 85)', color: 'oklch(35% 0.10 75)', border: 'oklch(72% 0.14 85)', emoji: '⭐' },
  { bg: 'var(--success-light)', color: 'oklch(30% 0.12 145)', border: 'oklch(72% 0.14 150)', emoji: '🎯' },
  { bg: 'oklch(97% 0.02 10)', color: 'oklch(35% 0.15 10)', border: 'oklch(55% 0.20 15)', emoji: '🔥' },
];

const getCatStyle = (cat, idx) => STYLE_POOL[idx % STYLE_POOL.length] || STYLE_POOL[0];

export default function HallOfFameManage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  const [categories, setCategories] = useState(() => {
    try { const s = localStorage.getItem('hof_categories'); return s ? JSON.parse(s) : DEFAULT_CATEGORIES; }
    catch { return DEFAULT_CATEGORIES; }
  });
  const [showCatSettings, setShowCatSettings] = useState(false);
  const [editCats, setEditCats] = useState([]);

  const saveCategories = (cats) => {
    setCategories(cats);
    localStorage.setItem('hof_categories', JSON.stringify(cats));
  };

  const [form, setForm] = useState({
    category: categories[0] || '1등급 달성', student_name: '', school: '', grade: '',
    year: '', description: '', achievement: '', display_order: 0, student_status: '재학생',
  });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const load = () => {
    api('/hall-of-fame/admin/all').then(data => {
      setItems(data);
      const serverCats = [...new Set(data.map(i => i.category))];
      const merged = [...new Set([...categories, ...serverCats])];
      if (merged.length !== categories.length) saveCategories(merged);
    }).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ category: '1등급 달성', student_name: '', school: '', grade: '', year: '', description: '', achievement: '', display_order: 0, student_status: '재학생' });
    setEditing(null);
  };

  const handleSubmit = async () => {
    if (!form.student_name || !form.category) {
      setMsg('카테고리와 학생 이름은 필수입니다.');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    try {
      if (editing) {
        await apiPut(`/hall-of-fame/${editing}`, form);
        setMsg('수정되었습니다.');
      } else {
        await apiPost('/hall-of-fame', form);
        setMsg('등록되었습니다.');
      }
      resetForm();
      load();
    } catch (e) { setMsg(e.message); }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleEdit = (item) => {
    setForm({
      category: item.category, student_name: item.student_name,
      school: item.school || '', grade: item.grade || '',
      year: item.year || '', description: item.description || '', achievement: item.achievement || '',
      display_order: item.display_order || 0, student_status: item.student_status || '재학생',
      is_visible: item.is_visible !== undefined ? item.is_visible : 1,
    });
    setEditing(item.id);
  };

  const handleDelete = async (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try { await apiDelete(`/hall-of-fame/${id}`); setMsg('삭제되었습니다.'); load(); }
    catch (e) { setMsg(e.message); }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleToggleVisible = async (item) => {
    try { await apiPut(`/hall-of-fame/${item.id}`, { ...item, is_visible: !item.is_visible }); load(); }
    catch (e) { setMsg(e.message); }
  };

  const getCategoryEmoji = (cat) => {
    const idx = categories.indexOf(cat);
    return idx >= 0 ? getCatStyle(cat, idx).emoji : '⭐';
  };
  const getCategoryStyle = (cat) => {
    const idx = categories.indexOf(cat);
    return idx >= 0 ? getCatStyle(cat, idx) : { bg: 'var(--neutral-100)', color: 'var(--neutral-700)', border: 'var(--neutral-400)', emoji: '⭐' };
  };

  const handleBulkRename = async (oldName, newName) => {
    if (!oldName || !newName || oldName === newName) return;
    if (!confirm(`"${oldName}" → "${newName}"로 일괄 수정하시겠습니까?`)) return;
    try {
      await apiPut('/hall-of-fame/bulk-rename-category', { oldName, newName });
      const newCats = categories.map(c => c === oldName ? newName : c);
      saveCategories(newCats);
      setMsg(`"${oldName}" → "${newName}" 일괄 수정 완료`);
      load();
    } catch (e) { setMsg(e.message); }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleReward = async (item) => {
    if (!confirm(`${item.student_name}에게 명예의 전당 300P를 지급하시겠습니까?`)) return;
    try {
      await apiPost(`/hall-of-fame/${item.id}/reward`);
      setMsg(`${item.student_name}에게 300P 지급 완료!`);
      load();
    } catch (e) { setMsg(e.message); }
    setTimeout(() => setMsg(''), 3000);
  };

  const [titleModal, setTitleModal] = useState(null);
  const [titleInput, setTitleInput] = useState('');

  const TITLE_PRESETS = [
    '1학기 1등급', '2학기 1등급', '1학년 전체 1등급', '2학년 전체 1등급', '3학년 전체 1등급',
    '모의고사 1등급', '수능 1등급', '성적 대폭 향상', '연간 최우수',
  ];

  const handleGrantTitle = async () => {
    if (!titleModal || !titleInput.trim()) return;
    try {
      const fullTitle = `${titleModal.category} - ${titleInput.trim()}`;
      await apiPost(`/hall-of-fame/${titleModal.id}/grant-title`, { titleName: fullTitle });
      setMsg(`"${fullTitle}" 칭호 부여 완료!`);
      setTitleModal(null); setTitleInput('');
    } catch (e) { setMsg(e.message); }
    setTimeout(() => setMsg(''), 3000);
  };

  const filtered = items.filter(i => {
    if (filterCat !== 'all' && i.category !== filterCat) return false;
    if (filterStatus !== 'all' && (i.student_status || '재학생') !== filterStatus) return false;
    return true;
  });

  const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, boxSizing: 'border-box' };
  const labelStyle = { fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 'var(--space-1)', display: 'block' };

  return (
    <div className="content max-w-7xl mx-auto w-full">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin')}>← 대시보드</button>
        <button onClick={() => { setEditCats([...categories]); setShowCatSettings(true); }}
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--neutral-50)', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
          ⚙️ 카테고리 설정
        </button>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 'var(--space-2)',
          background: msg.includes('삭제') || msg.includes('오류') ? 'var(--destructive-light)' : 'var(--success-light)',
          color: msg.includes('삭제') || msg.includes('오류') ? 'oklch(35% 0.15 25)' : 'oklch(30% 0.12 145)',
          fontSize: 13, fontWeight: 600
        }}>{msg}</div>
      )}

      {/* 가로 2열: 왼쪽 폼 | 오른쪽 목록 */}
      <div className="hof-layout" style={{ display: 'grid', gridTemplateColumns: 'min(380px, 40vw) 1fr', gap: 'var(--space-3)', alignItems: 'start' }}>

        {/* 왼쪽: 등록/수정 폼 */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            {editing ? '✏️ 수정' : '🏆 새로 등록'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <div>
                <label style={labelStyle}>카테고리 *</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                  {categories.map(c => <option key={c} value={c}>{getCategoryEmoji(c)} {c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>구분 *</label>
                <select value={form.student_status} onChange={e => setForm({ ...form, student_status: e.target.value })} style={inputStyle}>
                  {STATUS_TYPES.map(s => <option key={s} value={s}>{s === '재학생' ? '🎒' : '🎓'} {s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>학생 이름 *</label>
              <input value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })}
                placeholder="홍길동" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <div>
                <label style={labelStyle}>학교</label>
                <input value={form.school} onChange={e => setForm({ ...form, school: e.target.value })}
                  placeholder="예: OO고등학교" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>달성 학년</label>
                <input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}
                  placeholder="예: 고3" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <div>
                <label style={labelStyle}>연도</label>
                <select value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} style={inputStyle}>
                  <option value="">선택 안함</option>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>표시 순서</label>
                <input type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                  style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>성취 내용</label>
              <input value={form.achievement} onChange={e => setForm({ ...form, achievement: e.target.value })}
                placeholder="예) 국어 1등급, 3→1등급 상승" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>상세 설명</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="선택 사항" rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-primary" onClick={handleSubmit} style={{ flex: 1 }}>
                {editing ? '수정 완료' : '등록'}
              </button>
              {editing && <button className="btn btn-outline" onClick={resetForm}>취소</button>}
            </div>
          </div>
        </div>

        {/* 오른쪽: 필터 + 목록 */}
        <div>
          {/* 필터 */}
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
            {['all', ...STATUS_TYPES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-outline'}`}>
                {s === 'all' ? '전체' : s === '재학생' ? '🎒 재학생' : '🎓 졸업생'}
              </button>
            ))}
            <span style={{ borderLeft: '1px solid var(--border)', margin: '0 2px' }} />
            <button onClick={() => setFilterCat('all')}
              className={`btn btn-sm ${filterCat === 'all' ? 'btn-primary' : 'btn-outline'}`}>
              전체 ({items.length})
            </button>
            {categories.map(c => {
              const style = getCategoryStyle(c);
              const cnt = items.filter(i => i.category === c).length;
              if (cnt === 0) return null;
              return (
                <button key={c} onClick={() => setFilterCat(c)}
                  style={filterCat === c ? {} : { background: style.bg, color: style.color, borderColor: style.border }}
                  className={`btn btn-sm ${filterCat === c ? 'btn-primary' : 'btn-outline'}`}>
                  {getCategoryEmoji(c)} {c} ({cnt})
                </button>
              );
            })}
          </div>

          {/* 목록 */}
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📋 등록 목록</h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>{filtered.length}건</span>
            </div>
            {filtered.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 'var(--space-5)', fontSize: 13 }}>
                등록된 항목이 없습니다.
              </p>
            ) : (
              <div style={{ maxHeight: 650, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {filtered.map(item => {
                  const catStyle = getCategoryStyle(item.category);
                  return (
                    <div key={item.id} style={{
                      border: `1px solid ${catStyle.border}30`, borderRadius: 10, padding: 'var(--space-3)',
                      borderLeft: `4px solid ${item.is_visible ? catStyle.border : 'var(--neutral-300)'}`,
                      opacity: item.is_visible ? 1 : 0.6,
                      background: `linear-gradient(135deg, ${catStyle.bg}40, white)`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px var(--space-2)', borderRadius: 10,
                              background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}40`,
                            }}>
                              {getCategoryEmoji(item.category)} {item.category}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10,
                              background: (item.student_status || '재학생') === '졸업생' ? 'oklch(92% 0.04 280)' : 'var(--success-light)',
                              color: (item.student_status || '재학생') === '졸업생' ? 'oklch(28% 0.10 280)' : 'oklch(30% 0.12 145)',
                            }}>
                              {(item.student_status || '재학생') === '졸업생' ? '🎓' : '🎒'} {item.student_status || '재학생'}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{item.student_name}</span>
                            {(item.school || item.grade || item.year) && (
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }}>
                                {item.school}{item.grade ? ` ${item.grade}` : ''}{item.year ? ` (${item.year})` : ''}
                              </span>
                            )}
                            {!item.is_visible && <span style={{ fontSize: 10, color: 'var(--destructive)', fontWeight: 600 }}>숨김</span>}
                          </div>
                          {item.achievement && (
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginTop: 'var(--space-1)' }}>{item.achievement}</div>
                          )}
                          {item.description && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginTop: 2 }}>{item.description}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {!item.rewarded && (
                            <button className="btn btn-sm" onClick={() => handleReward(item)}
                              style={{ fontSize: 11, background: 'oklch(80% 0.14 85)', color: 'oklch(30% 0.10 75)', border: 'none', fontWeight: 700 }}>
                              💰 300P
                            </button>
                          )}
                          {item.rewarded && <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600, padding: 'var(--space-1) 0' }}>300P✓</span>}
                          <button className="btn btn-sm" onClick={() => { setTitleModal(item); setTitleInput(''); }}
                            style={{ fontSize: 11, background: 'oklch(55% 0.20 290)', color: 'white', border: 'none', fontWeight: 700 }}>
                            🏅 칭호
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleToggleVisible(item)}
                            style={{ fontSize: 11 }}>{item.is_visible ? '숨김' : '표시'}</button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleEdit(item)}
                            style={{ fontSize: 11 }}>수정</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}
                            style={{ fontSize: 11 }}>삭제</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 카테고리 설정 모달 */}
      {showCatSettings && (
        <>
          <div onClick={() => setShowCatSettings(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: 400, maxWidth: '90vw', zIndex: 10001,
            boxShadow: 'var(--shadow-md)',
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>⚙️ 카테고리 설정</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', marginBottom: 'var(--space-3)' }}>카테고리명을 수정하면 등록된 항목도 일괄 수정됩니다</p>
            {editCats.map((cat, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-base)' }}>{getCatStyle(cat, idx).emoji}</span>
                <input value={cat} onChange={e => {
                  const nf = [...editCats]; nf[idx] = e.target.value; setEditCats(nf);
                }} style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }} />
                {editCats.length > 1 && (
                  <button onClick={() => setEditCats(editCats.filter((_, i) => i !== idx))}
                    style={{ padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--space-1)', border: '1px solid oklch(78% 0.10 25)', background: 'var(--destructive-light)', color: 'var(--destructive)', cursor: 'pointer', fontSize: 11 }}>✕</button>
                )}
              </div>
            ))}
            {editCats.length < 8 && (
              <button onClick={() => setEditCats([...editCats, '새 카테고리'])}
                style={{ fontSize: 'var(--text-xs)', padding: '6px var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', background: 'var(--neutral-50)', cursor: 'pointer', width: '100%', marginBottom: 'var(--space-2)' }}>
                + 카테고리 추가
              </button>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <button className="btn btn-outline" onClick={() => setShowCatSettings(false)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={async () => {
                for (let i = 0; i < categories.length; i++) {
                  if (i < editCats.length && categories[i] !== editCats[i]) {
                    await handleBulkRename(categories[i], editCats[i]);
                  }
                }
                saveCategories(editCats.filter(c => c.trim()));
                setShowCatSettings(false);
                load();
              }} style={{ flex: 1 }}>저장</button>
            </div>
          </div>
        </>
      )}

      {/* 칭호 부여 모달 */}
      {titleModal && (
        <>
          <div onClick={() => setTitleModal(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'oklch(0% 0 0 / 0.4)', zIndex: 10000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: 400, maxWidth: '90vw', zIndex: 10001,
            boxShadow: 'var(--shadow-md)',
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>🏅 칭호 부여</h3>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--neutral-50)', borderRadius: 'var(--radius)' }}>
              <strong>{titleModal.student_name}</strong> · {titleModal.category} · {titleModal.achievement || ''}
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>빠른 선택</label>
              <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                {TITLE_PRESETS.map(t => (
                  <button key={t} onClick={() => setTitleInput(t)}
                    style={{
                      padding: 'var(--space-1) 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      background: titleInput === t ? 'oklch(55% 0.20 290)' : 'var(--neutral-50)',
                      color: titleInput === t ? 'white' : 'var(--neutral-700)',
                      cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>칭호명 (직접 입력 가능)</label>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 'var(--space-1)' }}>
                최종 칭호: <strong>{titleModal.category} - {titleInput || '...'}</strong>
              </div>
              <input value={titleInput} onChange={e => setTitleInput(e.target.value)}
                placeholder="예: 1학기 1등급, 모의고사 1등급"
                style={{ width: '100%', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-outline" onClick={() => setTitleModal(null)} style={{ flex: 1 }}>취소</button>
              <button className="btn btn-primary" onClick={handleGrantTitle} disabled={!titleInput.trim()} style={{ flex: 1 }}>칭호 부여</button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 768px) {
          .hof-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
