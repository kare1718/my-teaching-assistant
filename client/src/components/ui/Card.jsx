export function Card({ children, className = '', padding = 'p-6', ...props }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 shadow-sm ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
