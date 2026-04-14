export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#004bf0] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-bold">로딩 중...</p>
      </div>
    </div>
  );
}
