import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getFragment, updateFragment } from '../services/api';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { X, Edit, Save } from 'lucide-react';

export default function FragmentDrawer({ isOpen, fragmentId, onClose }) {
  const queryClient = useQueryClient();
  const { data: fragment, isLoading, error } = useQuery(
    ['fragmentDrawer', fragmentId],
    () => getFragment(fragmentId),
    { enabled: !!fragmentId && isOpen }
  );

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', tags: '' });

  useEffect(() => {
    if (fragment) {
      setForm({
        title: fragment.title || '',
        content: fragment.content || '',
        tags: (fragment.tags || []).join(', '),
      });
    }
  }, [fragment]);

  const mutation = useMutation(({ id, data }) => updateFragment(id, data), {
    onSuccess: () => {
      queryClient.invalidateQueries(['fragment', fragmentId]);
      queryClient.invalidateQueries(['fragmentDrawer', fragmentId]);
      queryClient.invalidateQueries('search');
      setIsEditing(false);
    },
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    mutation.mutate({ id: fragmentId, data: {
      title: form.title,
      content: form.content,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    }});
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[440px] bg-white dark:bg-slate-900 border-l z-30 shadow-xl flex flex-col">
      <div className="p-4 border-b flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fragment</h3>
          <p className="text-sm text-muted-foreground">Quick view</p>
        </div>
        <div className="ml-2 flex items-center space-x-2">
          {!isEditing ? (
            <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" variant="ghost" onClick={handleSave} disabled={mutation.isLoading}>
              <Save className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-600">Failed to load fragment.</p>
          </div>
        ) : fragment ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isEditing ? (
                    <input
                      className="w-full bg-transparent border rounded px-2 py-1"
                      name="title"
                      value={form.title}
                      onChange={handleChange}
                    />
                  ) : (
                    fragment.title || 'Untitled Fragment'
                  )}
                </CardTitle>
                <CardDescription>
                  {new Date(fragment.createdAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  {isEditing ? (
                    <textarea
                      name="content"
                      value={form.content}
                      onChange={handleChange}
                      rows={8}
                      className="w-full bg-transparent border rounded p-2"
                    />
                  ) : (
                    <p className="whitespace-pre-line">{fragment.content}</p>
                  )}
                </div>

                {fragment.tags && fragment.tags.length > 0 && !isEditing && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fragment.tags.map((t, i) => (
                      <span key={i} className="px-2 py-1 text-xs bg-muted rounded">{t}</span>
                    ))}
                  </div>
                )}

                {isEditing && (
                  <div className="mt-3">
                    <label className="text-xs text-muted-foreground">Tags (comma separated)</label>
                    <input
                      name="tags"
                      value={form.tags}
                      onChange={handleChange}
                      className="w-full mt-1 bg-transparent border rounded px-2 py-1"
                    />
                  </div>
                )}

                {fragment.source && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <div><strong>Source:</strong> {fragment.source.title || fragment.source.filename || fragment.source.url}</div>
                    <div className="mt-2">Type: <span className="capitalize">{fragment.source.type}</span></div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => window.open(`/fragment/${fragment._id}`, '_blank')}>Open full view</Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No fragment selected.</p>
          </div>
        )}
      </div>
    </div>
  );
}
