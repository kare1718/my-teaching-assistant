import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, getUser } from '../api';

export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [celebrated, setCelebrated] = useState(
    localStorage.getItem('onboarding_celebrated') === '1'
  );
  const [showCelebrate, setShowCelebrate] = useState(false);

  const user = getUser();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

  useEffect(() => {
    if (!isAdminRoute || !isAdmin) { setData(null); return; }
    let cancelled = false;
    api('/onboarding/progress')
      .then(res => { if (!cancelled) setData(res); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname, isAdminRoute, isAdmin]);

  useEffect(() => {
    if (!data) return;
    const required = data.items.filter(i => !i.optional);
    const requiredDone = required.filter(i => i.done).length;
    if (requiredDone >= 7 && !celebrated) {
      setShowCelebrate(true);
      localStorage.setItem('onboarding_celebrated', '1');
      setCelebrated(true);
    }
  }, [data, celebrated]);

  if (!isAdminRoute || !isAdmin || !data || data.hidden) return null;
  if (data.progress === 100 && celebrated && !open) return null;

  const progress = data.progress;

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed right-6 bottom-6 z-50 w-16 h-16 rounded-full bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20 flex flex-col items-center justify-center font-extrabold hover:bg-[var(--cta)] transition-all"
        style={{ zIndex: 9998 }}
        aria-label="온보딩 체크리스트"
      >
        <span className="text-[10px] font-bold opacity-80">온보딩</span>
        <span className="text-base">{progress}%</span>
      </button>

      {/* 펼쳐진 체크리스트 */}
      {open && (
        <div
          className="fixed right-6 bottom-24 z-50 w-80 bg-white rounded-xl border border-slate-100 shadow-xl p-5"
          style={{ zIndex: 9999 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-base font-extrabold text-[var(--primary)] tracking-tight">시작하기 체크리스트</div>
              <div className="text-xs text-slate-500">{data.doneCount} / {data.total} 완료</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-[var(--cta)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {data.items.map(item => (
              <button
                key={item.key}
                onClick={() => { navigate(item.path); setOpen(false); }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                  item.done ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-[var(--primary)]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  item.done ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 bg-white'
                }`}>
                  {item.done ? '✓' : ''}
                </span>
                <span className={`flex-1 ${item.done ? 'line-through opacity-70' : 'font-semibold'}`}>{item.label}</span>
                {item.optional && <span className="text-[10px] text-slate-400">(선택)</span>}
              </button>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 text-center">
            가입 후 {data.daysOld}일차 · 7일 후 자동 숨김
          </div>
        </div>
      )}

      {/* 축하 모달 */}
      {showCelebrate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
          onClick={() => setShowCelebrate(false)}
        >
          <div
            className="bg-white rounded-2xl p-10 max-w-md mx-4 text-center shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-extrabold text-[var(--primary)] mb-2">첫 가치 체험 완료!</h2>
            <p className="text-slate-600 mb-6">
              학원 운영의 핵심 단계를 모두 완료하셨어요.<br/>
              이제 나만의 조교가 여러분의 학원을 더 편하게 만들어드립니다.
            </p>
            <button
              onClick={() => setShowCelebrate(false)}
              className="px-8 py-3 bg-[var(--primary)] text-white rounded-lg font-extrabold hover:bg-[var(--cta)]"
            >
              좋아요!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
