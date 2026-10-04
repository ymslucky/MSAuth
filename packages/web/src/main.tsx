/** SPA 入口：QueryClient + Toast + ErrorBoundary + Router（SPEC §7.10） */
import { QueryClientProvider } from '@tanstack/react-query';
import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app';
import { queryClient } from './lib/query';
import { ToastProvider } from './components/ui/toast';
import './index.css';

/** 渲染异常兜底：白色卡片 + 错误信息 + 刷新（避免白屏） */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[msauth-web] render error:', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
          <div className="card w-full max-w-sm rounded-card p-8 text-center">
            <p className="overline">ERROR · 渲染异常</p>
            <h1 className="t-title mt-1.5">页面出错了</h1>
            <p className="t-caption mt-1.5">渲染发生异常，刷新通常可以解决。</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex h-10 items-center rounded-xl bg-action px-4 text-sm font-semibold text-white shadow-card transition-colors hover:bg-action-hover"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
