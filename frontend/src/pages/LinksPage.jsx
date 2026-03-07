import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { RefreshCw, Loader2, Network, TrendingUp, Filter, Link as LinkIcon, ArrowRight, Zap, Clock, GitBranch, MessageSquare } from 'lucide-react';
import { fragmentsAPI, linkAPI } from '../services/api';
import { format } from 'date-fns';

export default function LinksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [viewFragment, setViewFragment] = useState(null);

  // Fetch link statistics
  const { data: stats, isLoading: statsLoading } = useQuery(
    'linkStats',
    async () => (await fragmentsAPI.getStatus()).data,
    { enabled: !!user }
  );

  // Fetch filtered links
  const { data: linksData, isLoading: linksLoading } = useQuery(
    ['links', selectedType],
    async () => {
      const resp = await linkAPI.getAll({ type: selectedType, limit: 50 });
      return resp.data;
    },
    { enabled: !!user }
  );

  // Rebuild links mutation
  const handleRebuildLinks = async () => {
    setIsRebuilding(true);
    setRebuildResult(null);
    try {
      const response = await linkAPI.rebuild({});
      setRebuildResult(response.data);
      queryClient.invalidateQueries('linkStats');
      queryClient.invalidateQueries('topicClusters');
      queryClient.invalidateQueries('links');
    } catch (error) {
      console.error('Error rebuilding links:', error);
      setRebuildResult({
        error: error.response?.data?.message || 'Failed to rebuild links',
      });
    } finally {
      setIsRebuilding(false);
    }
  };

  const relationshipTypes = [
    { id: 'same_topic', label: 'Same Topic', icon: <Network className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
    { id: 'followup', label: 'Follow Up', icon: <Clock className="h-4 w-4" />, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    { id: 'supports', label: 'Supports', icon: <Zap className="h-4 w-4" />, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
    { id: 'contradicts', label: 'Contradicts', icon: <GitBranch className="h-4 w-4" />, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    { id: 'related', label: 'Related', icon: <LinkIcon className="h-4 w-4" />, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
    { id: 'similar', label: 'Similar', icon: <Zap className="h-4 w-4" />, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    { id: 'same_author', label: 'Same Author', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Knowledge Graph</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Explore connections between your documents and ideas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleRebuildLinks}
            disabled={isRebuilding}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
          >
            {isRebuilding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Analyze & Link
              </>
            )}
          </Button>
        </div>
      </div>

      {rebuildResult && (
        <div className={`p-4 rounded-lg border flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-300 ${rebuildResult.error
          ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
          : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
          }`}>
          <span className="font-medium">
            {rebuildResult.error || `Successfully created ${rebuildResult.linksCreated} new connections.`}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setRebuildResult(null)} className="h-6 w-6 p-0 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            ×
          </Button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Connections', value: stats?.totalLinks || 0, icon: <Network />, desc: 'Semantic links' },
          { label: 'Avg Connectivity', value: stats?.avgLinksPerFragment?.toFixed(1) || '0.0', icon: <TrendingUp />, desc: 'Links per fragment' },
          { label: 'Graph Density', value: stats?.graphDensity || 'N/A', icon: <Zap />, desc: 'Network strength' }
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                {stat.icon}
              </div>
              <Badge variant="outline" className="text-xs font-normal">Live</Badge>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{statsLoading ? '...' : stat.value}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Browse Relationships</h3>
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={selectedType === null ? 'default' : 'outline'}
            onClick={() => setSelectedType(null)}
            className="rounded-full"
          >
            All
          </Button>
          {relationshipTypes.map(type => (
            <Button
              key={type.id}
              variant={selectedType === type.id ? 'default' : 'outline'}
              onClick={() => setSelectedType(type.id)}
              className={`rounded-full ${selectedType === type.id ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              {type.label}
            </Button>
          ))}
        </div>

        {/* Links List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {linksLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : linksData?.results?.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {linksData.results.map((link) => {
                const typeConfig = relationshipTypes.find(t => t.id === link.type) || relationshipTypes[4];
                return (
                  <div key={link._id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg shrink-0 ${typeConfig.color}`}>
                        {typeConfig.icon}
                      </div>

                      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                        <div
                          className="text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded transition-colors"
                          onClick={() => setViewFragment(link.sourceFragment)}
                        >
                          <p className="font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                            "{link.sourceFragment?.content?.substring(0, 100)}..."
                          </p>
                          <p className="text-xs text-slate-500 mt-1">Source ID: {link.sourceFragment?._id?.substring(0, 8)}</p>
                        </div>

                        <div className="flex items-center justify-center text-slate-300 dark:text-slate-600">
                          <ArrowRight className="h-4 w-4" />
                        </div>

                        <div
                          className="text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded transition-colors"
                          onClick={() => setViewFragment(link.targetFragment)}
                        >
                          <p className="font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                            "{link.targetFragment?.content?.substring(0, 100)}..."
                          </p>
                          <p className="text-xs text-slate-500 mt-1">Target ID: {link.targetFragment?._id?.substring(0, 8)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500">
              <div className="mx-auto w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                <Filter className="h-5 w-5 text-slate-400" />
              </div>
              <p>No links found for this filter.</p>
              <Button variant="link" onClick={handleRebuildLinks}>Try Analyzing Content</Button>
            </div>
          )}
        </div>
      </div>

      {/* Topic Clusters Section */}
      <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Topic Clusters</h3>
        <TopicClustersView />
      </div>

      {/* Fragment Viewer Modal */}
      <FragmentViewer
        fragment={viewFragment}
        isOpen={!!viewFragment}
        onClose={() => setViewFragment(null)}
      />
    </div>
  );
}

function FragmentViewer({ fragment, isOpen, onClose }) {
  if (!isOpen || !fragment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
            Document Fragment
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
            ×
          </Button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="prose dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">
              {fragment.content}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {fragment.keywords?.map(k => (
              <Badge key={k} variant="secondary" className="text-xs">
                {k}
              </Badge>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
          <span>ID: {fragment._id}</span>
          <span>{fragment.datetime ? format(new Date(fragment.datetime), 'PP p') : 'Unknown Date'}</span>
        </div>
      </div>
    </div>
  );
}

function TopicClustersView() {
  const { data: clusters, isLoading } = useQuery(
    'topicClusters',
    async () => {
      const response = await linkAPI.getClusters();
      return response.data;
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="ml-2 text-slate-500">Clustering topics...</span>
      </div>
    );
  }

  if (!clusters || clusters.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
        No topics found. Add more diverse content to see clustering.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clusters.map((cluster) => (
        <div
          key={cluster.topicId}
          className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-3">
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800">
              {cluster.label || `Topic ${cluster.topicId.substring(6, 10)}`}
            </Badge>
            <span className="text-xs font-medium text-slate-500 flex items-center">
              <Network className="h-3 w-3 mr-1" />
              {cluster.size} items
            </span>
          </div>

          <div className="mb-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium line-clamp-3 italic">
              "{cluster.representative?.content || 'No content'}"
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex -space-x-2">
              {cluster.fragments.slice(0, 4).map((f, i) => (
                <div key={i} className="h-6 w-6 rounded-full bg-slate-200 ring-2 ring-white dark:bg-slate-700 dark:ring-slate-900 flex items-center justify-center text-[9px] font-bold text-slate-500">
                  {i + 1}
                </div>
              ))}
            </div>
            <span className="text-xs text-slate-400">
              {(cluster.avgSimilarity * 100).toFixed(0)}% Match
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
