export function PageHeader({ title, subtitle, action, breadcrumb }) {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <div className="text-xs text-slate-400 mb-2">{breadcrumb}</div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#102044] tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
