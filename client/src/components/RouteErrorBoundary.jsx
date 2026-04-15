import React from 'react';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RouteErrorBoundary]', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.pathname !== this.props.pathname && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-12 max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-extrabold text-[#102044] mb-2">
              이 페이지를 불러올 수 없습니다
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              일시적인 오류가 발생했습니다. 다른 메뉴를 이용하시거나 다시 시도해주세요.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg text-xs font-mono text-red-700 text-left overflow-auto max-h-40">
                {this.state.error.name}: {this.state.error.message}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-2.5 bg-[#102044] text-white rounded-lg font-bold text-sm hover:bg-[#1e2a5e]"
              >
                다시 시도
              </button>
              <button
                onClick={() => window.history.back()}
                className="px-6 py-2.5 bg-white border border-slate-200 text-[#102044] rounded-lg font-bold text-sm hover:bg-slate-50"
              >
                이전 페이지
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
