import { useState, useEffect } from 'react';
import { api, apiPost, apiPut, apiDelete, apiRaw } from '../../../api';

export default function VocabTab() {
  const [words, setWords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [reseedMsg, setReseedMsg] = useState(null);
  const [vocabPage, setVocabPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    category: '', questionText: '', correctAnswer: '',
    wrongAnswer1: '', wrongAnswer2: '', wrongAnswer3: '',
    difficulty: 1, explanation: ''
  });
  const [form, setForm] = useState({
    category: '사자성어', questionText: '', correctAnswer: '',
    wrongAnswer1: '', wrongAnswer2: '', wrongAnswer3: '',
    difficulty: 1, explanation: ''
  });

  const load = () => {
    const params = filter ? `?category=${filter}` : '';
    api(`/gamification/admin/vocab${params}`).then(setWords).catch(console.error);
  };
  useEffect(() => { load(); }, [filter]);

  const handleReseed = async () => {
    if (!confirm('⚠️ 기존 어휘를 모두 삭제하고 vocabSeed.js 파일에서 다시 불러옵니다.\n\n직접 추가한 문제도 삭제됩니다. 계속하시겠습니까?')) return;
    try {
      const result = await apiPost('/gamification/admin/vocab/reseed', {});
      setReseedMsg({ type: 'success', text: result.message });
      load();
    } catch (e) { setReseedMsg({ type: 'error', text: e.message }); }
    setTimeout(() => setReseedMsg(null), 3000);
  };

  const handleCreate = async () => {
    try {
      await apiPost('/gamification/admin/vocab', {
        category: form.category,
        questionText: form.questionText,
        correctAnswer: form.correctAnswer,
        wrongAnswers: [form.wrongAnswer1, form.wrongAnswer2, form.wrongAnswer3].filter(Boolean),
        difficulty: parseInt(form.difficulty) || 1,
        explanation: form.explanation
      });
      setShowForm(false);
      setForm({ category: '사자성어', questionText: '', correctAnswer: '', wrongAnswer1: '', wrongAnswer2: '', wrongAnswer3: '', difficulty: 1, explanation: '' });
      load();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;
    await apiDelete(`/gamification/admin/vocab/${id}`);
    load();
  };

  const startEditVocab = (w) => {
    let wrongArr = [];
    try { wrongArr = JSON.parse(w.wrong_answers); } catch {}
    setEditingId(w.id);
    setEditForm({
      category: w.category || '사자성어',
      questionText: w.question_text || '',
      correctAnswer: w.correct_answer || '',
      wrongAnswer1: wrongArr[0] || '',
      wrongAnswer2: wrongArr[1] || '',
      wrongAnswer3: wrongArr[2] || '',
      difficulty: w.difficulty || 1,
      explanation: w.explanation || '',
    });
    setShowForm(false);
  };

  const handleEditVocab = async () => {
    try {
      await apiPut(`/gamification/admin/vocab/${editingId}`, {
        category: editForm.category,
        questionText: editForm.questionText,
        correctAnswer: editForm.correctAnswer,
        wrongAnswers: [editForm.wrongAnswer1, editForm.wrongAnswer2, editForm.wrongAnswer3].filter(Boolean),
        difficulty: parseInt(editForm.difficulty) || 1,
        explanation: editForm.explanation,
      });
      setEditingId(null);
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <option value="">전체</option>
          <option value="사자성어">사자성어</option>
          <option value="맞춤법">맞춤법</option>
          <option value="어휘">어휘</option>
          <option value="문법">문법</option>
          <option value="고전시가">고전시가</option>
          <option value="문학개념어">문학개념어</option>
        </select>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ 추가</button>
        <button onClick={handleReseed} style={{
          padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius)', border: '1px solid var(--warning)', background: 'var(--warning-light)',
          color: 'oklch(35% 0.12 75)', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer', whiteSpace: 'nowrap'
        }}>🔄 리시드</button>
        <button onClick={async () => {
          try {
            const res = await apiRaw('/gamification/admin/vocab/export');
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'vocab-export.csv';
            a.click();
            URL.revokeObjectURL(a.href);
          } catch (e) { alert('내보내기 실패: ' + e.message); }
        }} style={{
          padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius)', border: '1px solid var(--success)', background: 'var(--success-light)',
          color: 'var(--success)', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer', whiteSpace: 'nowrap'
        }}>📥 엑셀</button>
      </div>

      {reseedMsg && (
        <div style={{
          padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-2)', fontSize: 13, fontWeight: 500,
          background: reseedMsg.type === 'success' ? 'var(--success-light)' : 'var(--destructive-light)',
          color: reseedMsg.type === 'success' ? 'var(--success)' : 'var(--destructive)',
          border: `1px solid ${reseedMsg.type === 'success' ? 'oklch(90% 0.06 145)' : 'oklch(88% 0.06 25)'}`
        }}>{reseedMsg.text}</div>
      )}

      {showForm && (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <option value="사자성어">사자성어</option>
              <option value="맞춤법">맞춤법</option>
              <option value="어휘">어휘</option>
              <option value="문법">문법</option>
              <option value="고전시가">고전시가</option>
              <option value="문학개념어">문학개념어</option>
            </select>
            <input placeholder="문제" value={form.questionText}
              onChange={e => setForm({ ...form, questionText: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
            <input placeholder="정답" value={form.correctAnswer}
              onChange={e => setForm({ ...form, correctAnswer: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--success-light)' }} />
            <input placeholder="오답 1" value={form.wrongAnswer1}
              onChange={e => setForm({ ...form, wrongAnswer1: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
            <input placeholder="오답 2" value={form.wrongAnswer2}
              onChange={e => setForm({ ...form, wrongAnswer2: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
            <input placeholder="오답 3" value={form.wrongAnswer3}
              onChange={e => setForm({ ...form, wrongAnswer3: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}
                style={{ flex: 1, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <option value={1}>쉬움</option>
                <option value={2}>보통</option>
                <option value={3}>어려움</option>
              </select>
            </div>
            <input placeholder="해설 (선택)" value={form.explanation}
              onChange={e => setForm({ ...form, explanation: e.target.value })}
              style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
            <button className="btn btn-primary" onClick={handleCreate}>추가</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>총 {words.length}문제 (표시: {Math.min(words.length, vocabPage * 100)}개)</span>
          {words.length > vocabPage * 100 && (
            <button onClick={() => setVocabPage(p => p + 1)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--primary)', background: 'var(--card)', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
              더 보기 (+100)
            </button>
          )}
        </div>
        {words.slice(0, vocabPage * 100).map((w, i) => {
          let wrongArr = [];
          try { wrongArr = JSON.parse(w.wrong_answers); } catch {}
          return (
            <div key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
              {editingId === w.id ? (
                <div style={{ padding: 14 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>✏️ 어휘 수정</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                        style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                        <option value="사자성어">사자성어</option>
                        <option value="맞춤법">맞춤법</option>
                        <option value="어휘">어휘</option>
                        <option value="문법">문법</option>
                        <option value="고전시가">고전시가</option>
                        <option value="문학개념어">문학개념어</option>
                      </select>
                      <select value={editForm.difficulty} onChange={e => setEditForm({ ...editForm, difficulty: e.target.value })}
                        style={{ flex: '0 0 80px', padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                        <option value={1}>쉬움</option>
                        <option value={2}>보통</option>
                        <option value={3}>어려움</option>
                      </select>
                    </div>
                    <input placeholder="문제" value={editForm.questionText}
                      onChange={e => setEditForm({ ...editForm, questionText: e.target.value })}
                      style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
                    <input placeholder="정답" value={editForm.correctAnswer}
                      onChange={e => setEditForm({ ...editForm, correctAnswer: e.target.value })}
                      style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--success-light)' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input placeholder="오답 1" value={editForm.wrongAnswer1}
                        onChange={e => setEditForm({ ...editForm, wrongAnswer1: e.target.value })}
                        style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
                      <input placeholder="오답 2" value={editForm.wrongAnswer2}
                        onChange={e => setEditForm({ ...editForm, wrongAnswer2: e.target.value })}
                        style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
                      <input placeholder="오답 3" value={editForm.wrongAnswer3}
                        onChange={e => setEditForm({ ...editForm, wrongAnswer3: e.target.value })}
                        style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
                    </div>
                    <input placeholder="해설 (선택)" value={editForm.explanation}
                      onChange={e => setEditForm({ ...editForm, explanation: e.target.value })}
                      style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary" onClick={handleEditVocab} style={{ flex: 1 }}>저장</button>
                      <button className="btn btn-outline" onClick={() => setEditingId(null)} style={{ flex: 1 }}>취소</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: 'var(--muted)', color: 'var(--muted-foreground)', whiteSpace: 'nowrap'
                  }}>{w.category}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{w.question_text}</div>
                    <div style={{ fontSize: 11, color: 'var(--success)' }}>✅ {w.correct_answer}</div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>난이도{w.difficulty}</span>
                  <button onClick={() => startEditVocab(w)} style={{
                    padding: 'var(--space-1) 6px', fontSize: 10, border: '1px solid var(--primary)',
                    borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--primary)', cursor: 'pointer'
                  }}>수정</button>
                  <button onClick={() => handleDelete(w.id)} style={{
                    padding: 'var(--space-1) 6px', fontSize: 10, border: '1px solid var(--destructive)',
                    borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--destructive)', cursor: 'pointer'
                  }}>삭제</button>
                </div>
              )}
            </div>
          );
        })}
        {words.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)' }}>문제가 없습니다.</div>}
      </div>
    </>
  );
}
