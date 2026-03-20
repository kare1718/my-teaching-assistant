import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiPost, apiPut, apiDelete } from '../../api';

const CATEGORIES = ['1등급 달성', '성적 향상', '모의고사 우수', '수능 우수'];
const STATUS_TYPES = ['재학생', '졸업생'];

const CATEGORY_STYLES = {
  '1등급 달성': { bg: '#fef3c7', color: '#92400e', border: '#f59e0b', emoji: '🥇' },
  '성적 향상': { bg: '#dcfce7', color: '#166534', border: '#22c55e', emoji: '📈' },
  '모의고사 우수': { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6', emoji: '📊' },
  '수능 우수': { bg: '#fce7f3', color: '#9d174d', border: '#ec4899', emoji: '💯' },
};

export default function HallOfFameManage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    category: '1등급 달성', student_name: '', school: '', grade: '',
    year: '', description: '', achievement: '', display_order: 0, student_status: '재학생',
  });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const load = () => {
    api('/hall-of-fame/admin/all').then(setItems).catch(console.error);
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
        await apiPut(`/hall-of-fame/${editing}`, { ...form, is_visible: true });
        setMsg('수정되었습니다.');
      } else {
        await apiPost('/hall-of-fame', form);
        setMsg('등록되었습니다.');
      }
      resetForm();
      load();
    } catch (e) {
      setMsg(e.message);
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleEdit = (item) => {
    setForm({
      category: item.category, student_name: item.student_name,
      school: item.school || '', grade: item.grade || '',
      year: item.year || '', description: item.description || '', achievement: item.achievement || '',
      display_order: item.display_order || 0, student_status: item.student_status || '재학생',
    });
    setEditing(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/hall-of-fame/${id}`);
      setMsg('삭제되었습니다.');
      load();
    } catch (e) {
      setMsg(e.message);
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleToggleVisible = async (item) => {
    try {
      await apiPut(`/hall-of-fame/${item.id}`, {
        ...item, is_visible: !item.is_visible,
      });
      load();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const getCategoryEmoji = (cat) => CATEGORY_STYLES[cat]?.emoji || '⭐';
  const getCategoryStyle = (cat) => CATEGORY_STYLES[cat] || { bg: '#f3f4f6', color: '#374151', border: '#9ca3af', emoji: '⭐' };

  const [filterStatus, setFilterStatus] = useState('all');
  const filtered = items.filter(i => {
    if (filterCat !== 'all' && i.category !== filterCat) return false;
    if (filterStatus !== 'all' && (i.student_status || '재학생') !== filterStatus) return false;
    return true;
  });

  return (
    <div className="content">
      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>🏆 '강인한 국어' 명예의 전당 관리</h2>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          성적 우수, 성적 향상, 모의고사/수능 우수 학생을 등록하세요
        </p>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 8,
          background: msg.includes('삭제') || msg.includes('오류') ? '#fef2f2' : '#dcfce7',
          color: msg.includes('삭제') || msg.includes('오류') ? '#991b1b' : '#166534',
          fontSize: 13, fontWeight: 600
        }}>{msg}</div>
      )}

      {/* 등록/수정 폼 */}
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
          {editing ? '✏️ 수정' : '➕ 새로 등록'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>카테고리 *</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryEmoji(c)} {c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>구분 *</label>
              <select value={form.student_status} onChange={e => setForm({ ...form, student_status: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                {STATUS_TYPES.map(s => <option key={s} value={s}>{s === '재학생' ? '🎒' : '🎓'} {s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>학생 이름 *</label>
              <input value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })}
                placeholder="홍길동" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>학교</label>
              <input value={form.school} onChange={e => setForm({ ...form, school: e.target.value })}
                placeholder="계성고" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>달성 학년</label>
              <input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}
                placeholder="고3" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>연도 <span style={{ color: '#94a3b8', fontWeight: 400 }}>(선택)</span></label>
              <select value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                <option value="">선택 안함</option>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>표시 순서</label>
              <input type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>성취 내용</label>
            <input value={form.achievement} onChange={e => setForm({ ...form, achievement: e.target.value })}
              placeholder="예) 국어 1등급, 3→1등급 상승, 서울대 합격" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>상세 설명</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="선택 사항" rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSubmit} style={{ flex: 1 }}>
              {editing ? '수정 완료' : '등록'}
            </button>
            {editing && (
              <button className="btn btn-outline" onClick={resetForm}>취소</button>
            )}
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, marginBottom: 4 }}>
        {/* 재학생/졸업생 필터 */}
        {['all', ...STATUS_TYPES].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-outline'}`}>
            {s === 'all' ? '전체' : s === '재학생' ? '🎒 재학생' : '🎓 졸업생'}
          </button>
        ))}
        <span style={{ borderLeft: '1px solid var(--border)', margin: '0 2px' }} />
        {/* 카테고리 필터 */}
        <button onClick={() => setFilterCat('all')}
          className={`btn btn-sm ${filterCat === 'all' ? 'btn-primary' : 'btn-outline'}`}>
          전체 ({items.length})
        </button>
        {CATEGORIES.map(c => {
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
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
          📋 등록 목록 ({filtered.length}건)
        </h3>
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 20, fontSize: 13 }}>
            등록된 항목이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(item => {
              const catStyle = getCategoryStyle(item.category);
              return (
              <div key={item.id} style={{
                border: `1px solid ${catStyle.border}30`, borderRadius: 10, padding: 14,
                borderLeft: `4px solid ${item.is_visible ? catStyle.border : '#d1d5db'}`,
                opacity: item.is_visible ? 1 : 0.6,
                background: `linear-gradient(135deg, ${catStyle.bg}40, white)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}40`,
                      }}>
                        {getCategoryEmoji(item.category)} {item.category}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10,
                        background: (item.student_status || '재학생') === '졸업생' ? '#e0e7ff' : '#f0fdf4',
                        color: (item.student_status || '재학생') === '졸업생' ? '#3730a3' : '#166534',
                      }}>
                        {(item.student_status || '재학생') === '졸업생' ? '🎓' : '🎒'} {item.student_status || '재학생'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{item.student_name}</span>
                      {(item.school || item.grade || item.year) && (
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                          {item.school}{item.grade ? ` ${item.grade}` : ''}{item.year ? ` (${item.year})` : ''}
                        </span>
                      )}
                      {!item.is_visible && (
                        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>숨김</span>
                      )}
                    </div>
                    {item.achievement && (
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginTop: 4 }}>
                        {item.achievement}
                      </div>
                    )}
                    {item.description && (
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleToggleVisible(item)}
                      style={{ fontSize: 11 }}>
                      {item.is_visible ? '숨김' : '표시'}
                    </button>
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

      <button className="btn btn-outline" onClick={() => navigate('/admin')}
        style={{ width: '100%', marginTop: 8 }}>← 대시보드</button>
    </div>
  );
}
