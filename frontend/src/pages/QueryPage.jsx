import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../context/AuthContext';
import { queryAPI } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import EvidenceCard from '../components/EvidenceCard';
import TimelineChart from '../components/TimelineChart';
import MemoryGraph from '../components/MemoryGraph';
import FragmentDrawer from '../components/FragmentDrawer';
import { Search, Loader2, Sparkles, BarChart3, Network } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QueryPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [showGraph, setShowGraph] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [suggestedQuestions] = useState([
    'What are the key decisions?',
    'Summarize recent discussions',
    'Show me important patterns',
  ]);
  const searchInputRef = useRef(null);
  const [drawerFragmentId, setDrawerFragmentId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filteredEvidence, setFilteredEvidence] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // State for search results and errors
  const [searchData, setSearchData] = useState(null);
  const [searchError, setSearchError] = useState(null);

  const evidence = searchData?.evidence || [];
  const summary = searchData?.summary || '';
  const timeline = searchData?.timeline || [];
  const graph = searchData?.graph ? {
    nodes: searchData.graph.nodes || [],
    links: (searchData.graph.edges || []).map(edge => ({
      source: edge.from,
      target: edge.to,
      ...edge
    }))
  } : { nodes: [], links: [] };

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }

    // Clear previous results and errors
    setIsSearching(true);
    setFilteredEvidence(null);
    setSearchError(null);
    setSearchData(null);

    try {
      const response = await queryAPI.search({ q: query });
      setSearchData(response.data);

      // Show toast if backend returned error in development mode
      if (response.data._error) {
        toast.error(`Search Warning: ${response.data._error}`);
      }
    } catch (error) {
      console.error('Search error:', error);

      // Set error state for display
      setSearchError(error.response?.data?.message || error.message || 'Search failed. Please try again.');

      // Also show toast for immediate feedback
      toast.error(error.response?.data?.message || error.message || 'Search failed');

      // Set empty search data to show "no results" UI
      setSearchData({
        summary: 'Search failed due to a network or server error. Please try again.',
        evidence: [],
        timeline: [],
        graph: { nodes: [], edges: [] }
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handle suggested question click
  const handleSuggestedQuestionClick = (question) => {
    setQuery(question);
    setTimeout(() => handleSearch({ preventDefault: () => { } }), 100);
  };

  // Auto-focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Helper to render evidence area (keeps JSX tidy and avoids nested ternaries)
  const renderEvidence = () => {
    if (isSearching && evidence.length === 0) {
      return (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (filteredEvidence) {
      return (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">Showing {filteredEvidence.length} results for selected date</div>
            <div>
              <Button size="sm" variant="ghost" onClick={() => setFilteredEvidence(null)}>Clear filter</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {filteredEvidence.map((ev, idx) => (
              <EvidenceCard
                key={ev._id}
                title={`Fragment ${idx + 1}`}
                content={ev.text}
                sender={ev.sender || 'Unknown'}
                datetime={ev.datetime}
                relevance={ev.score || 0.5}
                onOpen={() => {
                  setDrawerFragmentId(ev._id);
                  setDrawerOpen(true);
                }}
                onClick={() => {
                  setDrawerFragmentId(ev._id);
                  setDrawerOpen(true);
                }}
                highlighted={drawerFragmentId === ev._id}
              />
            ))}
          </div>
        </div>
      );
    }

    if (evidence.length > 0) {
      return (
        <div className="grid grid-cols-1 gap-4">
          {evidence.map((ev, idx) => (
            <EvidenceCard
              key={ev._id}
              title={`Fragment ${idx + 1}`}
              content={ev.text}
              sender={ev.sender || 'Unknown'}
              datetime={ev.datetime}
              relevance={ev.score || 0.5}
              onOpen={() => {
                setDrawerFragmentId(ev._id);
                setDrawerOpen(true);
              }}
              onClick={() => {
                setDrawerFragmentId(ev._id);
                setDrawerOpen(true);
              }}
              highlighted={drawerFragmentId === ev._id}
            />
          ))}
        </div>
      );
    }

    if (query && !isSearching) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try a different query or upload more documents
            </p>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Search Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Ask anything about your uploaded documents... (Press / to focus)"
                className="pl-12 pr-12 h-14 text-base"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {isSearching ? (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Suggested Questions */}
            {!query && evidence.length === 0 && (
              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-3">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((question, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-sm h-9 rounded-full"
                      onClick={() => handleSuggestedQuestionClick(question)}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {searchError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Search Error</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{searchError}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchError(null)}
                className="flex-shrink-0"
              >
                &times;
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Summary */}
      {summary && summary.trim() && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
              {evidence.length > 0 ? 'AI Summary' : 'Search Result'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed whitespace-pre-line">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Results Summary + Actions */}
      {evidence.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold">Evidence ({evidence.length})</h2>
          </div>
          <div className="flex space-x-2">
            {timeline.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTimeline(!showTimeline)}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {showTimeline ? 'Hide' : 'Show'} Timeline
              </Button>
            )}
            {graph.nodes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGraph(true)}
              >
                <Network className="h-4 w-4 mr-2" />
                Open Graph
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Timeline Chart */}
      {showTimeline && timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <TimelineChart
              data={timeline.map(t => ({
                date: t.date,
                value: t.count,
                title: `${t.count} fragments`,
              }))}
              height={250}
              onEventClick={(evt) => {
                // Filter evidence to the selected date (same day)
                if (!evt || !evt.date) return;
                const clicked = new Date(evt.date);
                const start = new Date(clicked.getFullYear(), clicked.getMonth(), clicked.getDate());
                const end = new Date(start);
                end.setDate(start.getDate() + 1);
                const filtered = evidence.filter(ev => {
                  const d = ev.datetime ? new Date(ev.datetime) : null;
                  return d && d >= start && d < end;
                });
                setFilteredEvidence(filtered);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Evidence Cards */}
      {renderEvidence()}

      {/* Graph Modal */}
      <Modal
        isOpen={showGraph}
        onClose={() => setShowGraph(false)}
        title="Knowledge Graph"
        size="full"
      >
        <div className="h-[70vh]">
          <MemoryGraph
            data={graph}
            height="100%"
            onNodeClick={() => { /* single-click reserved for future highlight */ }}
            onNodeDblClick={(node) => {
              // open in-place drawer when user double-clicks a node
              if (node && node.id) {
                setDrawerFragmentId(node.id);
                setDrawerOpen(true);
              }
            }}
          />
        </div>
        {/* Fragment drawer opened from graph dblclick */}
        <FragmentDrawer
          isOpen={drawerOpen}
          fragmentId={drawerFragmentId}
          onClose={() => setDrawerOpen(false)}
        />
      </Modal>
    </div>
  );
}
