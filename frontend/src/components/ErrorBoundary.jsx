import React from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './ui/Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900 rounded-full mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-white">
              Oops! Something went wrong
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
              We encountered an error while loading this page. Please try refreshing or go back to the dashboard.
            </p>
            {this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-md">
                <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            <div className="flex space-x-3">
              <Button
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                Refresh Page
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="flex-1"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
