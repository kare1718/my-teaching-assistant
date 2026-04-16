import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [preRegCount, setPreRegCount] = useState(0);

  useEffect(() => {
    api('/admin/students')
      .then(data => {
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        // 안전장치: 관리자/조교/선생님 제외 (role이 없거나 student인 경우만)
        const studentsOnly = rows.filter(s => !s.role || s.role === 'student');
        setStudents(studentsOnly);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api('/admin/pending-users')
      .then(data => {
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        setPendingCount(rows.length);
      })
      .catch(() => {});

    api('/admin/pre-registered')
      .then(data => {
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        setPreRegCount(rows.length);
      })
      .catch(() => {});
  }, []);

  const filtered = students.filter(s => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.school || '').toLowerCase().includes(q) ||
      (s.grade || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-[#102044] tracking-tight">학생 명단</h2>
        <p className="text-sm text-slate-500 mt-1">총 {filtered.length}명 / 전체 {students.length}명</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr]" style={{ gap: 12, marginBottom: 24 }}>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm md:[grid-row:span_2]" style={{ padding: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>전체 재원생</p>
          <p style={{ fontSize: 48, fontWeight: 800, color: '#102044', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
            {students.length}<span style={{ fontSize: 20, fontWeight: 600 }}>명</span>
          </p>
        </div>
        <Link to="/admin/pending" className="bg-white rounded-xl border border-slate-100 shadow-sm hover:border-[#004bf0]/30 transition-colors block" style={{ padding: '16px 20px', textDecoration: 'none' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>가입 승인 대기</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{pendingCount}건</p>
        </Link>
        <Link to="/admin/pre-registered" className="bg-white rounded-xl border border-slate-100 shadow-sm hover:border-[#004bf0]/30 transition-colors block" style={{ padding: '16px 20px', textDecoration: 'none' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>사전 등록</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#004bf0' }}>{preRegCount}명</p>
        </Link>
      </div>

      <div className="mb-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="이름 · 학교 · 학년 검색"
          className="w-full md:w-80 px-4 py-3 bg-white rounded-lg border border-slate-200 text-sm outline-none focus:border-[#004bf0]/40 focus:ring-4 focus:ring-[#004bf0]/5"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center text-slate-400 text-sm">
          등록된 학생이 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-[#f3f4f5]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">이름</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">학교</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">학년</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">상태</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => {
                const isActive = (s.status || 'active') === 'active';
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-bold text-[#102044] whitespace-nowrap">{s.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[220px]" title={s.school || ''}>{s.school || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{s.grade || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold ${
                        isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {isActive ? '재원' : '퇴원'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/admin/student-view/${s.id}`} className="text-[#004bf0] text-sm font-bold hover:underline">
                        상세 →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
