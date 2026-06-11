// 표준 에러 상태 — 재시도 버튼 포함
// 사용: if (error) return <ErrorState message={error} onRetry={load} wrap="main-content" />;
export function ErrorState({ message = '데이터를 불러오지 못했습니다.', onRetry, wrap }) {
  return (
    <div className={wrap}>
      <div className="error-state" role="alert">
        <div style={{ fontSize: 36 }} aria-hidden="true">⚠️</div>
        <p className="error-state__message">{message}</p>
        {onRetry && (
          <button type="button" className="error-state__retry" onClick={onRetry}>다시 시도</button>
        )}
      </div>
    </div>
  );
}

export default ErrorState;
