const VARIANTS = {
  primary: 'bg-[#102044] text-white hover:bg-[#1e2a5e]',
  accent: 'bg-[#004bf0] text-white hover:bg-[#0040d4]',
  outline: 'border border-slate-200 text-[#102044] hover:bg-slate-50',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  ghost: 'text-slate-600 hover:bg-slate-50',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
