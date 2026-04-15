import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api('/admin/students')
      .then(data => {
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        setStudents(rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <h2 className="text-2xl font-extrabold text-[#102044] tracking-tight">학생 목록</h2>
        <p className="text-sm text-slate-500 mt-1">총 {filtered.length}명 / 전체 {students.length}명</p>
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
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">이름</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">학교</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">학년</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">상태</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => {
                const isActive = (s.status || 'active') === 'active';
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-bold text-[#102044]">{s.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.school || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.grade || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
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
