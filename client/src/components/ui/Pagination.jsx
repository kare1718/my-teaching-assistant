export function Pagination({ total, limit, offset, onChange }) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages <= 1) return null;

  const go = (p) => onChange((p - 1) * limit);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
      <p className="text-xs text-slate-500">
        총 {total.toLocaleString()}건 중 {offset + 1}~{Math.min(offset + limit, total)}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 rounded disabled:opacity-30"
        >
          이전
        </button>
        <span className="px-3 py-1 text-sm font-bold text-[#102044]">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 rounded disabled:opacity-30"
        >
          다음
        </button>
      </div>
    </div>
  );
}

export default Pagination;
