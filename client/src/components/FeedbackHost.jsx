// Toast 스택 + Confirm 다이얼로그 렌더러 — App에 1회 마운트
import { useEffect } from 'react';
import { useFeedbackStore } from '../lib/feedback';

const TOAST_ICONS = { success: '✓', error: '⚠', info: 'ℹ' };

export default function FeedbackHost() {
  const toasts = useFeedbackStore((s) => s.toasts);
  const confirmState = useFeedbackStore((s) => s.confirmState);
  const closeConfirm = useFeedbackStore((s) => s.closeConfirm);

  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeConfirm(false);
      if (e.key === 'Enter') closeConfirm(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, closeConfirm]);

  return (
    <>
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} role="status">
            <span aria-hidden="true">{TOAST_ICONS[t.type] || ''}</span>
            <span className="toast__msg">{t.message}</span>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="confirm-overlay" onClick={() => closeConfirm(false)}>
          <div className="confirm-card" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-card__title">{confirmState.title}</h3>
            <p className="confirm-card__message">{confirmState.message}</p>
            <div className="confirm-card__actions">
              <button type="button" className="confirm-card__btn confirm-card__btn--cancel" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                className={`confirm-card__btn ${confirmState.danger ? 'confirm-card__btn--danger' : 'confirm-card__btn--ok'}`}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
