import { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: error.stack || null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || null,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-lg border-2 border-red-200 p-8 max-w-3xl w-full">
            <div className="flex items-start mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 mr-4 flex-shrink-0" />
              <div>
                <h1 className="text-2xl font-bold text-red-900 mb-2">
                  Application Error
                </h1>
                <p className="text-slate-700 mb-4">
                  Something went wrong while rendering this page.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Error Message:</h2>
                <pre className="bg-red-50 border border-red-200 rounded p-4 overflow-auto text-sm text-red-900">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            {this.state.errorInfo && (
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Stack Trace:</h2>
                <pre className="bg-slate-50 border border-slate-200 rounded p-4 overflow-auto text-xs text-slate-700 max-h-96">
                  {this.state.errorInfo}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
