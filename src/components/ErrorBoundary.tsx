"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.error("Uncaught error:", error, errorInfo);
    }
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-2xl border border-red-100 m-4">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            ¡Oops! Algo salió mal.
          </h2>
          <p className="text-sm text-red-500 mb-6 text-center max-w-md">
            {this.state.error?.message || "Ha ocurrido un error inesperado al cargar esta sección."}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium shadow-sm"
          >
            Intentar de nuevo
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}