import React from 'react';

export function Icon({ name, className = '', filled = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

export function Card({ label, title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-6 ${className}`}>
      {label && <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</div>}
      {title && <h3 className="text-lg font-extrabold text-[#102044] tracking-tight mt-1 mb-4">{title}</h3>}
      {children}
    </div>
  );
}

export function Empty({ icon = 'inbox', text = '데이터가 없습니다' }) {
  return (
    <div className="text-center py-10 text-slate-400">
      <Icon name={icon} className="text-4xl opacity-50 mb-2 block" />
      <div className="text-sm font-semibold">{text}</div>
    </div>
  );
}

export function Loading() {
  return <div className="text-center py-10 text-slate-400 text-sm">로딩 중...</div>;
}

export function Stat({ label, value, accent = '#102044' }) {
  return (
    <div className="p-4 rounded-lg bg-[#f8f9fa]">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-extrabold tracking-tight" style={{ color: accent }}>{value}</div>
    </div>
  );
}

export function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return '-';
  return dt.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatMoney(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('ko-KR') + '원';
}
