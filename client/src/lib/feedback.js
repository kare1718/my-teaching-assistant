// 공용 피드백 — Toast + Confirm 단일 진입점
// window.alert → toast(message), window.confirm → await askConfirm(message)
import { create } from 'zustand';

let toastSeq = 0;

export const useFeedbackStore = create((set, get) => ({
  toasts: [],
  confirmState: null,

  pushToast: (message, type) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },

  openConfirm: (opts, resolve) => set({ confirmState: { ...opts, resolve } }),
  closeConfirm: (result) => {
    const st = get().confirmState;
    if (st?.resolve) st.resolve(result);
    set({ confirmState: null });
  },
}));

const ERROR_HINTS = ['실패', '오류', '에러', '잘못', '불가', '부족', '없습니다', '초과', '거부', '다시 시도', '만료', '필요합니다', '선택하세요', '입력하세요', '입력해'];
const SUCCESS_HINTS = ['완료', '성공', '되었습니다', '됐습니다', '저장', '발송', '등록', '추가', '변경', '충전', '복사'];

function classify(message) {
  const m = String(message ?? '');
  if (ERROR_HINTS.some((k) => m.includes(k))) return 'error';
  if (SUCCESS_HINTS.some((k) => m.includes(k))) return 'success';
  return 'info';
}

// toast('저장되었습니다') — 타입 생략 시 메시지 키워드로 자동 분류
export function toast(message, type) {
  useFeedbackStore.getState().pushToast(String(message ?? ''), type || classify(message));
}
toast.success = (m) => toast(m, 'success');
toast.error = (m) => toast(m, 'error');
toast.info = (m) => toast(m, 'info');

// const ok = await askConfirm('정말 삭제하시겠습니까?')
// askConfirm({ title, message, confirmLabel, cancelLabel, danger }) 도 지원
export function askConfirm(messageOrOpts) {
  const opts = typeof messageOrOpts === 'string' ? { message: messageOrOpts } : (messageOrOpts || {});
  const message = opts.message || '';
  return new Promise((resolve) => {
    useFeedbackStore.getState().openConfirm({
      title: opts.title || '확인',
      message,
      confirmLabel: opts.confirmLabel || '확인',
      cancelLabel: opts.cancelLabel || '취소',
      danger: opts.danger ?? /삭제|제거|회수|초기화|무효화|취소됩|되돌릴 수 없/.test(message),
    }, resolve);
  });
}
