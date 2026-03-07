import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from 'react-query';
import { useAuth } from '../context/AuthContext';
import { getRecentFragments, getStats, fragmentsAPI } from '../services/api';
import { TimelineChart, MemoryGraph } from '../components';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import {
  Sparkles,
  TrendingUp,
  Database,
  Search
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();

  // Fetch recent fragments
  const { data: recentFragments, isLoading: isLoadingFragments } = useQuery(
    'recentFragments',
    () => getRecentFragments(5),
    { enabled: !!user }
  );

  // Fetch dashboard statistics
  const { data: stats, isLoading: isLoadingStats } = useQuery(
    'dashboardStats',
    getStats,
    { enabled: !!user }
  );

  // Fetch timeline data
  const { data: timelineData } = useQuery(
    'dashboardTimeline',
    () => fragmentsAPI.getTimeline(),
    { enabled: !!user }
  );

  // Fetch graph data
  const { data: graphData } = useQuery(
    'dashboardGraph',
    () => fragmentsAPI.getGraph({ limit: 50 }),
    { enabled: !!user }
  );

  if (isLoadingFragments || isLoadingStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-3">
          <Sparkles className="h-12 w-12 text-blue-500 animate-pulse" />
          <p className="text-muted-foreground">Loading your knowledge graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your knowledge overview</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => window.location.href = '/query'}>
            <Search className="h-5 w-5 mr-2" />
            Search
          </Button>
          <Button onClick={() => window.location.href = '/uploads'}>
            <CloudArrowUpIcon className="h-5 w-5 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div whileHover={{ y: -6 }} className="transition-transform cursor-pointer" onClick={() => window.location.href = '/fragments'}>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Fragments</CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats?.counts?.fragments || 0}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Total knowledge fragments
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -6 }} className="transition-transform cursor-pointer" onClick={() => window.location.href = '/uploads'}>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sources</CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center">
                <span className="text-2xl">📚</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900 dark:text-green-100">{stats?.counts?.sources || 0}</div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Documents and files
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -6 }} className="transition-transform cursor-pointer" onClick={() => window.location.href = '/links'}>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Connections</CardTitle>
              <div className="h-10 w-10 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center">
                <span className="text-2xl">🔗</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{stats?.totalLinks || 0}</div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Fragment connections
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -6 }} className="transition-transform cursor-pointer" onClick={() => window.location.href = '/query'}>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Searches</CardTitle>
              <div className="h-10 w-10 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-300" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">{stats?.counts?.queries || 0}</div>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Searches performed
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <TimelineChart data={timelineData?.data || []} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Knowledge Graph</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <MemoryGraph
                data={graphData?.data || { nodes: [], edges: [] }}
                onNodeClick={(node) => window.location.href = `/fragments/${node.id}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-t-4 border-t-blue-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
              Recent Fragments
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/query'}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentFragments?.length > 0 ? (
            <div className="space-y-3">
              {recentFragments.map((fragment) => (
                <div
                  key={fragment._id}
                  className="border-l-4 border-l-blue-500 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => window.location.href = `/fragments/${fragment._id}`}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">{fragment.source?.title || 'Untitled Source'}</h3>
                    <span className="text-xs text-muted-foreground">
                      {new Date(fragment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {fragment.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No recent fragments found.</p>
              <Button onClick={() => window.location.href = '/uploads'}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Upload your first document
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
