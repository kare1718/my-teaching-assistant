// 표준 페이지 로딩 스켈레톤
// 사용: if (loading) return <PageLoading wrap="main-content" />;
// wrap: 원래 페이지가 쓰던 레이아웃 클래스 유지용 (main-content / content / 생략)
export function PageLoading({ wrap }) {
  return (
    <div className={wrap} role="status" aria-label="불러오는 중" style={{ padding: 20 }}>
      <div className="skeleton" style={{ width: 180, height: 24, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 96, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 14, width: '85%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 96 }} />
    </div>
  );
}

export default PageLoading;
