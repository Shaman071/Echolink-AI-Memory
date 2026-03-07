import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * Error display component with retry functionality
 */
export function ErrorDisplay({
    error,
    onRetry,
    onDismiss,
    title = 'Something went wrong',
    showDetails = false,
    className = '',
}) {
    const [showFullError, setShowFullError] = React.useState(false);

    const errorMessage = error?.message || error?.toString() || 'An unknown error occurred';
    const isNetworkError = errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('fetch');

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}
        >
            <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />

                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                        {title}
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {errorMessage}
                    </p>

                    {isNetworkError && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                            Please check your internet connection and try again.
                        </p>
                    )}

                    {showDetails && error?.stack && (
                        <div className="mt-2">
                            <button
                                onClick={() => setShowFullError(!showFullError)}
                                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                            >
                                {showFullError ? 'Hide' : 'Show'} technical details
                            </button>
                            {showFullError && (
                                <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-auto max-h-40">
                                    {error.stack}
                                </pre>
                            )}
                        </div>
                    )}

                    {(onRetry || onDismiss) && (
                        <div className="flex gap-2 mt-3">
                            {onRetry && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={onRetry}
                                    className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/40"
                                >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Retry
                                </Button>
                            )}
                            {onDismiss && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={onDismiss}
                                    className="text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    Dismiss
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

/**
 * Inline error message for form fields
 */
export function FieldError({ error, className = '' }) {
    if (!error) return null;

    return (
        <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`text-sm text-red-600 dark:text-red-400 mt-1 ${className}`}
        >
            {error}
        </motion.p>
    );
}

/**
 * Empty state component
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    actionLabel,
    className = '',
}) {
    return (
        <div className={`text-center py-12 ${className}`}>
            {Icon && (
                <div className="flex justify-center mb-4">
                    <Icon className="h-16 w-16 text-gray-400 dark:text-gray-600" />
                </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {title}
            </h3>
            {description && (
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    {description}
                </p>
            )}
            {action && actionLabel && (
                <Button onClick={action}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}

/**
 * Toast notification component
 */
export function Toast({ message, type = 'info', onClose, duration = 3000 }) {
    const [isVisible, setIsVisible] = React.useState(true);

    React.useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onClose, 300); // Wait for animation
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    if (!isVisible) return null;

    const bgColors = {
        success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
        warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    };

    const textColors = {
        success: 'text-green-800 dark:text-green-200',
        error: 'text-red-800 dark:text-red-200',
        warning: 'text-yellow-800 dark:text-yellow-200',
        info: 'text-blue-800 dark:text-blue-200',
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className={`fixed top-4 right-4 z-50 max-w-sm border rounded-lg shadow-lg p-4 ${bgColors[type]}`}
        >
            <div className="flex items-center gap-3">
                <p className={`flex-1 text-sm font-medium ${textColors[type]}`}>
                    {message}
                </p>
                <button
                    onClick={() => {
                        setIsVisible(false);
                        setTimeout(onClose, 300);
                    }}
                    className={`flex-shrink-0 ${textColors[type]} hover:opacity-70`}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </motion.div>
    );
}

/**
 * Offline indicator
 */
export function OfflineIndicator({ isOnline }) {
    if (isOnline) return null;

    return (
        <motion.div
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium"
        >
            You are currently offline. Some features may not work.
        </motion.div>
    );
}

/**
 * Retry button component
 */
export function RetryButton({ onRetry, isRetrying, className = '' }) {
    return (
        <Button
            onClick={onRetry}
            disabled={isRetrying}
            variant="outline"
            className={className}
        >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry'}
        </Button>
    );
}

export default {
    ErrorDisplay,
    FieldError,
    EmptyState,
    Toast,
    OfflineIndicator,
    RetryButton,
};
