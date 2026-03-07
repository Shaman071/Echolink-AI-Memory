import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../context/AuthContext';
import { getUploads, uploadFile, deleteUpload } from '../services/api';
import { API_URL } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';
import {
  Trash2,
  UploadCloud,
  FileText,
  File,
  FileImage,
  FileCode,
  FileArchive,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import UploadPanel from '../components/UploadPanel';

const fileIcons = {
  'application/pdf': <FileText className="h-5 w-5 text-red-500" />,
  'text/plain': <FileText className="h-5 w-5 text-gray-500" />,
  'application/msword': <FileText className="h-5 w-5 text-blue-500" />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': <FileText className="h-5 w-5 text-blue-500" />,
  'image/jpeg': <FileImage className="h-5 w-5 text-green-500" />,
  'image/png': <FileImage className="h-5 w-5 text-green-500" />,
  'application/json': <FileCode className="h-5 w-5 text-yellow-500" />,
  'application/zip': <FileArchive className="h-5 w-5 text-purple-500" />,
  'default': <File className="h-5 w-5 text-gray-400" />
};

const getFileIcon = (mimeType) => {
  return fileIcons[mimeType] || fileIcons['default'];
};

export default function UploadsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Fetch uploads
  const {
    data: uploads,
    isLoading,
    isError: uploadsError,
    error: uploadsErrorObj,
    refetch: refetchUploads,
  } = useQuery('uploads', getUploads, {
    enabled: !!user,
    onSuccess: (data) => {
      console.log('Uploads data:', data);
      if (data && data.length > 0) {
        console.log('First upload item:', data[0]);
        console.log('Has _id:', '_id' in data[0]);
        console.log('Has id:', 'id' in data[0]);
      }
    }
  });

  // Poll for status changes when there are uploads being processed/indexing/pending
  useEffect(() => {
    let interval = null;

    try {
      const needsPolling = Array.isArray(uploads) && uploads.some(u => ['pending', 'processing', 'indexing'].includes(u.status));

      if (needsPolling) {
        // Poll every 3 seconds
        interval = setInterval(async () => {
          try {
            await refetchUploads();
            // Also refresh dashboard stats so counts update
            queryClient.invalidateQueries('dashboardStats');
          } catch (err) {
            // Non-fatal — log for debugging
            // eslint-disable-next-line no-console
            console.warn('Error while polling uploads status:', err.message || err);
          }
        }, 3000);
      }
    } catch (err) {
      console.warn('Uploads polling setup error:', err.message || err);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [uploads, refetchUploads, queryClient]);

  // SSE: subscribe to server events for real-time updates
  useEffect(() => {
    let es;
    try {
      // Use credentialed EventSource (cookies) — server will set accessToken HttpOnly cookie on login
      const base = API_URL.replace(/\/$/, '');
      const url = `${base}/stream/updates`;
      // withCredentials ensures cookies are included when connecting
      es = new EventSource(url, { withCredentials: true });

      es.addEventListener('connected', () => {
        // connection established
      });

      es.addEventListener('sourceStatus', (e) => {
        try {
          const payload = JSON.parse(e.data);
          queryClient.invalidateQueries('uploads');
          queryClient.invalidateQueries('dashboardStats');
          queryClient.invalidateQueries('recentFragments');
          queryClient.invalidateQueries('dashboardTimeline');
          queryClient.invalidateQueries('dashboardGraph');
        } catch (err) {
          // ignore
        }
      });

      es.onerror = (err) => {
        // If SSE fails, fallback to polling already in place
        // eslint-disable-next-line no-console
        console.warn('SSE connection error, falling back to polling', err);
        if (es) {
          es.close();
          es = null;
        }
      };
    } catch (err) {
      // ignore
    }

    return () => {
      if (es) {
        try { es.close(); } catch (e) { }
      }
    };
  }, [queryClient]);

  // Upload mutation with progress
  const uploadMutation = useMutation(({ file, onUploadProgress }) => uploadFile(file, onUploadProgress), {
    onMutate: () => {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadSuccess(false);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries('uploads');
      queryClient.invalidateQueries('dashboardStats');
      queryClient.invalidateQueries('fragments');
      queryClient.invalidateQueries('recentFragments');
      queryClient.invalidateQueries('dashboardTimeline');
      queryClient.invalidateQueries('dashboardGraph');
      setUploadSuccess(true);
      setUploadedCount(prev => prev + 1);
      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
    },
    onSettled: () => {
      setIsUploading(false);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 2000);
    },
  });

  const [deleteResult, setDeleteResult] = useState(null);

  // Delete mutation
  const deleteMutation = useMutation(deleteUpload, {
    onSuccess: () => {
      queryClient.invalidateQueries('uploads');
      queryClient.invalidateQueries('dashboardStats');
      queryClient.invalidateQueries('fragments');
      queryClient.invalidateQueries('recentFragments');
      queryClient.invalidateQueries('dashboardTimeline');
      queryClient.invalidateQueries('dashboardGraph');
      setDeleteResult({ success: true, message: 'File deleted successfully.' });
      setTimeout(() => setDeleteResult(null), 3000);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
      setDeleteResult({ success: false, message: 'Failed to delete file. Please try again.' });
    }
  });

  const handleUploadPanelUpload = async (files) => {
    if (!files.length) return;

    // Upload first file with progress
    const file = files[0].file;
    try {
      await uploadMutation.mutateAsync({
        file,
        onUploadProgress: (evt) => {
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(percent);
        },
      });
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleUploadSuccess = (data) => {
    // Data contains response from backend with inserted count
    queryClient.invalidateQueries('uploads');
    queryClient.invalidateQueries('fragments');
    queryClient.invalidateQueries('dashboardStats');
    queryClient.invalidateQueries('recentFragments');
    queryClient.invalidateQueries('dashboardTimeline');
    queryClient.invalidateQueries('dashboardGraph');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this upload? This action cannot be undone.')) {
      setDeleteResult(null);
      await deleteMutation.mutateAsync(id);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Uploads</h1>
      </div>

      {/* Privacy & Consent Notice */}
      <Card className="mb-4 border-2 border-yellow-300 bg-yellow-50 dark:bg-yellow-900">
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400" />
            Privacy & Consent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-yellow-900 dark:text-yellow-100 space-y-2">
            <p>
              By uploading files, you consent to processing and storage of your data for search and analysis. You may delete uploads at any time. Data is stored securely and never shared with third parties.
            </p>
            <p>
              <strong>GDPR:</strong> You have the right to export or delete your data. For full details, see our <a href="/privacy" className="underline text-blue-700 dark:text-blue-300">Privacy Policy</a>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            Upload Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UploadPanel
            onUpload={handleUploadPanelUpload}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            onUploadSuccess={handleUploadSuccess}
          />

          {/* WhatsApp Upload Info */}
          <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-start space-x-3">
              <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">WhatsApp Chat Support</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Export your WhatsApp chat as .txt and upload it here. We'll automatically parse messages, detect senders, and create a searchable knowledge graph. The preview shows the first 5 fragments.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Notification */}
      {deleteResult && (
        <div className={`p-4 rounded-lg border flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-300 ${deleteResult.success
          ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
          : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
          }`}>
          <div className="flex items-center">
            {deleteResult.success ? (
              <CheckCircle2 className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            <span className="font-medium">{deleteResult.message}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDeleteResult(null)} className="h-6 w-6 p-0 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            ×
          </Button>
        </div>
      )}

      {/* Uploads Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Your Files</h2>
          <Button variant="outline" size="sm" onClick={() => refetchUploads()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : uploadsError ? (
          <div className="text-center py-12 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 mb-4">Error loading uploads</p>
            <Button onClick={() => refetchUploads()}>Retry</Button>
          </div>
        ) : uploads?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploads.map((upload) => (
              <div
                key={upload._id}
                className="group relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:border-blue-500 dark:hover:border-blue-500"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                    {getFileIcon(upload.fileType)}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={`${upload.status === 'processed' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' :
                      upload.status === 'processing' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse' :
                        upload.status === 'error' ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' :
                          'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                      } border`}>
                      {upload.status}
                    </Badge>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate mb-1" title={upload.title}>
                  {upload.title}
                </h3>

                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {upload.createdAt ? format(new Date(upload.createdAt), 'MMM d, h:mm a') : 'Unknown'}
                  </div>
                  <div className="flex items-center">
                    <File className="h-3 w-3 mr-1" />
                    {upload.fileSize ? formatFileSize(upload.fileSize) : '0 B'}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-500">
                    {upload.fragmentCount || 0} fragments
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
                    onClick={() => handleDelete(upload._id)}
                    disabled={deleteMutation.isLoading}
                    title="Delete File"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No files uploaded</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">
              Upload documents or WhatsApp chats above to build your knowledge base.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
