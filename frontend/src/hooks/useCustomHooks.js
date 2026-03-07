import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for retrying failed API requests
 * @param {Function} apiFunction - The API function to retry
 * @param {Object} options - Retry options
 * @returns {Object} - Retry state and functions
 */
export function useRetry(apiFunction, options = {}) {
    const {
        maxRetries = 2,
        retryDelay = 1000,
        exponentialBackoff = true,
    } = options;

    const retriesRef = useRef(0);

    const executeWithRetry = async (...args) => {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await apiFunction(...args);
                retriesRef.current = 0; // Reset on success
                return result;
            } catch (error) {
                lastError = error;
                retriesRef.current = attempt + 1;

                if (attempt < maxRetries) {
                    const delay = exponentialBackoff
                        ? retryDelay * Math.pow(2, attempt)
                        : retryDelay;

                    console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // All retries failed
        throw lastError;
    };

    return {
        executeWithRetry,
        currentRetries: retriesRef.current,
    };
}

/**
 * Custom hook for debouncing values
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} - Debounced value
 */
export function useDebounce(value, delay = 500) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Custom hook for managing loading states
 * @returns {Object} - Loading state and functions
 */
export function useLoadingState(initialState = false) {
    const [isLoading, setIsLoading] = useState(initialState);
    const [error, setError] = useState(null);

    const startLoading = () => {
        setIsLoading(true);
        setError(null);
    };

    const stopLoading = () => {
        setIsLoading(false);
    };

    const setLoadingError = (err) => {
        setIsLoading(false);
        setError(err);
    };

    const reset = () => {
        setIsLoading(false);
        setError(null);
    };

    return {
        isLoading,
        error,
        startLoading,
        stopLoading,
        setLoadingError,
        reset,
    };
}

/**
 * Custom hook for local storage with error handling
 * @param {string} key - Storage key
 * @param {any} initialValue - Initial value
 * @returns {Array} - [value, setValue]
 */
export function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error);
        }
    };

    return [storedValue, setValue];
}

/**
 * Custom hook for online/offline detection
 * @returns {boolean} - Online status
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}

/**
 * Custom hook for automatic retry on network reconnection
 * @param {Function} callback - Function to retry
 * @param {Array} dependencies - Dependencies to watch
 */
export function useRetryOnReconnect(callback, dependencies = []) {
    const isOnline = useOnlineStatus();
    const wasOfflineRef = useRef(false);

    useEffect(() => {
        if (!isOnline) {
            wasOfflineRef.current = true;
        } else if (wasOfflineRef.current && isOnline) {
            // Just came back online
            wasOfflineRef.current = false;
            callback();
        }
    }, [isOnline, callback, ...dependencies]);
}

export default {
    useRetry,
    useDebounce,
    useLoadingState,
    useLocalStorage,
    useOnlineStatus,
    useRetryOnReconnect,
};
