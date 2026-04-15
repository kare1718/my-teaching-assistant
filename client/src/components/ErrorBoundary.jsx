import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8f9fa]">
          <div className="max-w-xl w-full bg-white rounded-xl border border-slate-100 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-2xl">
                ⚠️
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#102044]">
                  페이지를 불러올 수 없습니다
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  일시적인 오류가 발생했습니다. 다시 시도해주세요.
                </p>
              </div>
            </div>

            {isDev && error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg text-xs font-mono text-red-700 overflow-auto max-h-60">
                <div className="font-bold mb-2">{error.name}: {error.message}</div>
                {errorInfo?.componentStack && (
                  <pre className="whitespace-pre-wrap">{errorInfo.componentStack.slice(0, 500)}</pre>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-3 bg-[#102044] text-white rounded-lg font-bold hover:bg-[#1e2a5e] transition-colors"
              >
                다시 시도
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-[#102044] rounded-lg font-bold hover:bg-slate-50 transition-colors"
              >
                새로고침
              </button>
              <button
                onClick={this.handleHome}
                className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-colors"
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
