import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="grid min-h-dvh place-items-center bg-[#FAFAFA] px-5 text-center text-[#1A1A1A]">
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h1 className="text-2xl font-extrabold text-[#8B0000]">
              RedeeMERP hit a display error
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#666666]">
              The app recovered instead of showing a blank page. Refresh and use
              Demo Mode if you are not physically at RCCG Camp.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-12 rounded-xl bg-[#8B0000] px-5 text-sm font-extrabold text-white"
            >
              Reload App
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
