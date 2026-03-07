import React from 'react';
import { motion } from 'framer-motion';

/**
 * Skeleton loader for text content
 */
export function SkeletonText({ className = '', lines = 3, animate = true }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <motion.div
                    key={i}
                    className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
                    style={{ width: `${100 - (i * 10)}%` }}
                    animate={animate ? {
                        opacity: [0.5, 1, 0.5],
                    } : {}}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            ))}
        </div>
    );
}

/**
 * Skeleton loader for cards
 */
export function SkeletonCard({ className = '' }) {
    return (
        <motion.div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}
            animate={{
                opacity: [0.5, 1, 0.5],
            }}
            transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
            }}
        >
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>

                {/* Content */}
                <SkeletonText lines={3} animate={false} />

                {/* Footer */}
                <div className="flex gap-2">
                    <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>
            </div>
        </motion.div>
    );
}

/**
 * Skeleton loader for evidence cards
 */
export function SkeletonEvidenceCard() {
    return (
        <div className="border-l-4 border-l-blue-500 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950">
            <div className="space-y-3">
                <div className="flex justify-between items-start">
                    <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <SkeletonText lines={2} animate={false} />
                <div className="flex gap-2">
                    <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>
            </div>
        </div>
    );
}

/**
 * Skeleton loader for stats cards
 */
export function SkeletonStatCard() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
                <div className="space-y-3">
                    <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
        </div>
    );
}

/**
 * Skeleton loader for graph
 */
export function SkeletonGraph({ className = '' }) {
    return (
        <div className={`relative ${className}`}>
            <motion.div
                className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg"
                animate={{
                    opacity: [0.5, 1, 0.5],
                }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            >
                <div className="text-center space-y-4">
                    <div className="h-32 w-32 mx-auto">
                        <svg className="animate-spin" viewBox="0 0 100 100">
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeDasharray="60 200"
                                className="text-blue-500"
                            />
                        </svg>
                    </div>
                    <div className="h-4 w-48 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
            </motion.div>
        </div>
    );
}

/**
 * Skeleton loader for table rows
 */
export function SkeletonTable({ rows = 5, columns = 4 }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-4">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <div
                            key={colIndex}
                            className="h-10 flex-1 bg-gray-200 dark:bg-gray-700 rounded"
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * Loading spinner component
 */
export function LoadingSpinner({ size = 'md', className = '' }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
    };

    return (
        <div className={`${sizeClasses[size]} ${className}`}>
            <svg className="animate-spin" viewBox="0 0 50 50">
                <circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray="31.4 31.4"
                    className="text-blue-500"
                />
            </svg>
        </div>
    );
}

/**
 * Full page loading overlay
 */
export function LoadingOverlay({ message = 'Loading...', show = true }) {
    if (!show) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl">
                <div className="flex flex-col items-center space-y-4">
                    <LoadingSpinner size="xl" />
                    <p className="text-lg font-medium">{message}</p>
                </div>
            </div>
        </motion.div>
    );
}

export default {
    SkeletonText,
    SkeletonCard,
    SkeletonEvidenceCard,
    SkeletonStatCard,
    SkeletonGraph,
    SkeletonTable,
    LoadingSpinner,
    LoadingOverlay,
};
