import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { fragmentsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Search, FileText, Calendar, ChevronRight, Filter } from 'lucide-react';

export default function FragmentsListPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const limit = 20;

    // Assume getFragments supports pagination and search? 
    // If not, we'll verify api.js. For now, using standard hook.
    const { data, isLoading, error } = useQuery(
        ['fragments', page, searchTerm],
        () => fragmentsAPI.getFragments({ page, limit, search: searchTerm }),
        { keepPreviousData: true }
    );

    const fragments = data?.data?.docs || data?.data?.results || data?.data || data?.docs || data?.results || [];
    const totalPages = data?.data?.totalPages || data?.totalPages || 1;

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Fragments</h1>
                    <p className="text-muted-foreground mt-1">
                        Browse and manage all knowledge fragments
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter fragments..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-48 rounded-lg border bg-card text-card-foreground shadow-sm animate-pulse bg-muted/50" />
                    ))}
                </div>
            ) : error ? (
                <div className="text-center py-12 bg-red-50 dark:bg-red-900/10 rounded-lg">
                    <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Error loading fragments</h3>
                    <p className="text-red-600 dark:text-red-300 mt-2">{error.message}</p>
                </div>
            ) : fragments.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No fragments found</h3>
                    <p className="text-muted-foreground mt-1">
                        {searchTerm ? 'Try adjusting your search terms.' : 'Upload documents to create fragments.'}
                    </p>
                    <Button className="mt-4" asChild>
                        <Link to="/uploads">Go to Uploads</Link>
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {fragments.map((fragment) => (
                        <Link
                            key={fragment._id || fragment.id}
                            to={`/fragments/${fragment._id || fragment.id}`}
                            className="block group"
                        >
                            <Card className="h-full hover:shadow-md transition-all duration-200 border-transparent hover:border-gray-200 dark:hover:border-gray-700 bg-card/50 hover:bg-card">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="text-lg font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                                            {fragment.title || fragment.source?.title || 'Untitled Fragment'}
                                        </CardTitle>
                                        {fragment.source?.type && (
                                            <Badge variant="secondary" className="capitalize text-xs">
                                                {fragment.source.type}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4 min-h-[4.5rem]">
                                        {fragment.content}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
                                        <div className="flex items-center">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {formatDate(fragment.datetime || fragment.createdAt)}
                                        </div>
                                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination (Simplified) */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-8 gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Previous
                    </Button>
                    <span className="flex items-center px-4 text-sm font-medium">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}
