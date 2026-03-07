import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getFragment, updateFragment, deleteFragment, getRelatedFragments, createLink } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { ScrollArea } from '../components/ui/ScrollArea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { Link as LinkIcon, Trash2, Edit, Save, X, Link2, ExternalLink, ChevronLeft } from 'lucide-react';

export default function FragmentPage() {
  const { fragmentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    content: '',
    tags: '',
  });
  
  // Fetch fragment data
  const {
    data: fragment,
    isLoading,
    error,
  } = useQuery(['fragment', fragmentId], () => getFragment(fragmentId), {
    enabled: !!fragmentId,
    onSuccess: (data) => {
      if (data) {
        setEditData({
          title: data.title || '',
          content: data.content,
          tags: data.tags?.join(', ') || '',
        });
      }
    },
  });
  
  // Fetch related fragments
  const { data: relatedFragments = [] } = useQuery(
    ['relatedFragments', fragmentId],
    () => getRelatedFragments(fragmentId),
    { enabled: !!fragmentId }
  );
  
  // Update fragment mutation
  const updateMutation = useMutation(
    (data) => updateFragment(fragmentId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fragment', fragmentId]);
        setIsEditing(false);
      },
    }
  );
  
  // Delete fragment mutation
  const deleteMutation = useMutation(() => deleteFragment(fragmentId), {
    onSuccess: () => {
      queryClient.invalidateQueries('fragments');
      navigate('/query');
    },
  });
  
  // Create link mutation
  const createLinkMutation = useMutation(
    ({ targetId, type }) => createLink(fragmentId, targetId, type),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['relatedFragments', fragmentId]);
      },
    }
  );
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({
      ...editData,
      tags: editData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
    });
  };
  
  // Handle link creation
  const handleCreateLink = (targetId, type = 'related') => {
    createLinkMutation.mutate({ targetId, type });
  };
  
  // Handle delete confirmation
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this fragment? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <div className="bg-red-100 p-3 rounded-full mb-4">
          <X className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-lg font-medium mb-2">Fragment not found</h3>
        <p className="text-muted-foreground mb-4">The requested fragment could not be found or you don't have permission to view it.</p>
        <Button onClick={() => navigate('/query')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>
      </div>
    );
  }
  
  if (!fragment) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <div className="bg-blue-100 p-3 rounded-full mb-4">
          <LinkIcon className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-medium mb-2">No fragment selected</h3>
        <p className="text-muted-foreground mb-4">Select a fragment from the search results to view its details.</p>
        <Button onClick={() => navigate('/query')}>
          <Search className="h-4 w-4 mr-2" />
          Search Fragments
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="mb-2 sm:mb-0"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Fragment Details</h1>
        </div>
        <div className="flex space-x-2">
          {!isEditing ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                disabled={updateMutation.isLoading}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditing(false)}
                disabled={updateMutation.isLoading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSubmit}
                disabled={updateMutation.isLoading}
              >
                {updateMutation.isLoading ? (
                  <>
                    <span className="mr-2">Saving...</span>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        name="title"
                        value={editData.title}
                        onChange={handleInputChange}
                        placeholder="Enter a title for this fragment"
                        className="text-lg font-semibold"
                      />
                    </div>
                  ) : (
                    <CardTitle>{fragment.title || 'Untitled Fragment'}</CardTitle>
                  )}
                  <CardDescription>
                    Created {formatDate(fragment.createdAt)}
                    {fragment.updatedAt !== fragment.createdAt && ` • Updated ${formatDate(fragment.updatedAt)}`}
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  {fragment.source?.type && (
                    <Badge variant="outline" className="capitalize">
                      {fragment.source.type}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isEditing ? (
                  <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      name="content"
                      value={editData.content}
                      onChange={handleInputChange}
                      rows={8}
                      placeholder="Enter the fragment content"
                      className="font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-line">{fragment.content}</p>
                  </div>
                )}
                
                <div className="pt-4 border-t">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        name="tags"
                        value={editData.tags}
                        onChange={handleInputChange}
                        placeholder="tag1, tag2, tag3"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {fragment.tags?.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                      {(!fragment.tags || fragment.tags.length === 0) && (
                        <span className="text-sm text-muted-foreground">No tags</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {fragment.embedding && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Embedding</CardTitle>
                <CardDescription>
                  This fragment has been processed with an embedding model.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg overflow-x-auto">
                  <code className="text-xs text-muted-foreground">
                    {`[${fragment.embedding.slice(0, 5).join(', ')}, ...] (${fragment.embedding.length} dimensions)`}
                  </code>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Fragments</CardTitle>
              <CardDescription>
                Fragments that are related or linked to this one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relatedFragments.length > 0 ? (
                <div className="space-y-4">
                  {relatedFragments.map((connection) => {
                    const relatedFragment = connection.sourceFragment?._id === fragment._id 
                      ? connection.targetFragment 
                      : connection.sourceFragment;
                    
                    if (!relatedFragment) return null;
                    
                    return (
                      <div 
                        key={connection._id}
                        className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => navigate(`/fragment/${relatedFragment._id}`)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">
                              {relatedFragment.source?.title || 'Untitled Fragment'}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {relatedFragment.content}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="capitalize">
                              {connection.type || 'related'}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Handle view action
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-4">
                    <Link2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium">No connections yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This fragment doesn't have any connections yet. Search for related fragments to create links.
                  </p>
                  <Button 
                    className="mt-4"
                    onClick={() => navigate(`/query?relatedTo=${fragment._id}`)}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Find Related Fragments
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Suggested Connections</CardTitle>
              <CardDescription>
                Fragments that might be related to this one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Suggested connections will appear here based on semantic similarity.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    // TODO: Implement find similar fragments
                  }}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Find Similar Fragments
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="source">
          <Card>
            <CardHeader>
              <CardTitle>Source Information</CardTitle>
              <CardDescription>
                Details about the original source of this fragment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fragment.source ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium">Title</h4>
                    <p className="text-sm">{fragment.source.title || 'Untitled Source'}</p>
                  </div>
                  
                  {fragment.source.type === 'url' && (
                    <div>
                      <h4 className="text-sm font-medium">URL</h4>
                      <a 
                        href={fragment.source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center"
                      >
                        {fragment.source.url}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  )}
                  
                  {fragment.source.type === 'file' && (
                    <div>
                      <h4 className="text-sm font-medium">File</h4>
                      <p className="text-sm">{fragment.source.filename}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="text-sm font-medium">Type</h4>
                    <p className="text-sm capitalize">{fragment.source.type}</p>
                  </div>
                  
                  {fragment.source.metadata && (
                    <div>
                      <h4 className="text-sm font-medium">Metadata</h4>
                      <pre className="mt-2 p-4 bg-muted rounded-md text-sm overflow-x-auto">
                        {JSON.stringify(fragment.source.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        // Navigate to source details or open in new tab
                        if (fragment.source.type === 'url') {
                          window.open(fragment.source.url, '_blank');
                        } else {
                          // Navigate to source details page if implemented
                          // navigate(`/source/${fragment.source._id}`);
                        }
                      }}
                    >
                      View Full Source
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No source information available for this fragment.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
