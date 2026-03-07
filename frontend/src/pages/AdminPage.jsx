import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function AdminPage() {
    const [systemStatus, setSystemStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rebuilding, setRebuilding] = useState(false);
    const [reindexing, setReindexing] = useState(false);

    useEffect(() => {
        fetchSystemStatus();

        // Auto-refetch every 10 seconds to keep stats live
        const interval = setInterval(() => {
            fetchSystemStatus();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const fetchSystemStatus = async () => {
        try {
            setLoading(true);
            const response = await api.get('/status');
            setSystemStatus(response.data);
        } catch (error) {
            console.error('Error fetching system status:', error);
            toast.error('Failed to fetch system status');
        } finally {
            setLoading(false);
        }
    };

    const handleRebuildLinks = async () => {
        try {
            setRebuilding(true);
            const response = await api.post('/links/rebuild');
            toast.success(`Rebuilt ${response.data.linksCreated} links successfully!`);
            fetchSystemStatus();
        } catch (error) {
            console.error('Error rebuilding links:', error);
            toast.error('Failed to rebuild links');
        } finally {
            setRebuilding(false);
        }
    };

    const handleReindexAll = async () => {
        try {
            setReindexing(true);
            // Use server-side bulk reindexing
            const response = await api.post('/admin/reindex-all');

            toast.success(response.data.message || 'Reindexing started');
            fetchSystemStatus();
        } catch (error) {
            console.error('Error reindexing:', error);
            toast.error('Failed to trigger reindexing');
        } finally {
            setReindexing(false);
        }
    };

    const handlePurgeOldData = async () => {
        const confirmed = confirm('Are you sure you want to delete data older than 30 days? This cannot be undone.');
        if (!confirmed) return;

        try {
            setLoading(true);
            const response = await api.delete('/admin/purge-old?days=30');
            toast.success(response.data.message || 'Old data purged successfully');
            fetchSystemStatus();
        } catch (error) {
            console.error('Error purging data:', error);
            toast.error('Failed to purge old data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Loading system status...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

                {/* System Status */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                    <StatCard
                        title="Total Fragments"
                        value={systemStatus?.totalFragments || 0}
                        icon="📄"
                    />
                    <StatCard
                        title="Total Links"
                        value={systemStatus?.totalLinks || 0}
                        icon="🔗"
                    />
                    <StatCard
                        title="Total Queries"
                        value={systemStatus?.totalQueries || 0}
                        icon="🔍"
                    />
                    <StatCard
                        title="Total Sources"
                        value={systemStatus?.totalSources || 0}
                        icon="📁"
                    />
                </div>

                {/* Admin Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-2xl font-semibold mb-4">Admin Actions</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <ActionButton
                            onClick={handleRebuildLinks}
                            loading={rebuilding}
                            title="Rebuild All Links"
                            description="Regenerate all knowledge graph connections"
                            icon="🔄"
                        />
                        <ActionButton
                            onClick={handleReindexAll}
                            loading={reindexing}
                            title="Reindex All Sources"
                            description="Regenerate embeddings for all fragments"
                            icon="⚡"
                        />
                        <ActionButton
                            onClick={handlePurgeOldData}
                            loading={false}
                            title="Purge Old Data"
                            description="Delete data older than 30 days"
                            icon="🗑️"
                            variant="danger"
                        />
                        <ActionButton
                            onClick={fetchSystemStatus}
                            loading={false}
                            title="Refresh Status"
                            description="Update system statistics"
                            icon="🔃"
                        />
                    </div>
                </div>

                {/* Recent Activity */}
                {systemStatus?.recentActivity && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
                        <div className="space-y-2">
                            {systemStatus.recentActivity.map((activity, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                                >
                                    <div>
                                        <div className="font-medium">{activity.type}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {activity.description}
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {new Date(activity.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

function StatCard({ title, value, icon }) {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
                    <p className="text-3xl font-bold mt-2">{value.toLocaleString()}</p>
                </div>
                <div className="text-4xl">{icon}</div>
            </div>
        </motion.div>
    );
}

function ActionButton({ onClick, loading, title, description, icon, variant = 'primary' }) {
    const baseClasses = "p-6 rounded-lg border-2 transition-all cursor-pointer";
    const variantClasses = variant === 'danger'
        ? "border-red-300 hover:border-red-500 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
        : "border-blue-300 hover:border-blue-500 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20";

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={loading ? undefined : onClick}
            className={`${baseClasses} ${variantClasses} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <div className="flex items-start">
                <div className="text-3xl mr-4">{icon}</div>
                <div className="flex-1">
                    <h3 className="font-semibold text-lg">{title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
                    {loading && (
                        <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                            Processing...
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
