export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-[var(--primary)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">{description}</p>
      )}
      {action}
    </div>
  );
}

export default EmptyState;
