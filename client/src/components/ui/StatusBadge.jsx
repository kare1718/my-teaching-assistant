const VARIANTS = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-blue-100 text-blue-700',
  primary: 'bg-[#102044] text-white',
  accent: 'bg-[#004bf0] text-white',
};

export function StatusBadge({ variant = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-bold ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  );
}

export default StatusBadge;
