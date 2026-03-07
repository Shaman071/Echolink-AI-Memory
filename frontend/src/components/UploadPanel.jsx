import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/Button';
import { Progress } from './ui/Progress';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { importAPI } from '../services/api';

// WhatsApp parser regex (same as backend)
const WHATSAPP_REGEX = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:AM|PM|am|pm)?\]?\s*[-–]\s*(.+?):\s*(.*)$/gm;

const parseWhatsAppPreview = (text, maxFragments = 5) => {
  const fragments = [];
  let match;

  while ((match = WHATSAPP_REGEX.exec(text)) && fragments.length < maxFragments) {
    fragments.push({
      sender: match[5]?.trim() || 'Unknown',
      text: match[6]?.trim() || '',
      datetime: new Date(match[1]),
    });
  }

  return fragments;
};

export default function UploadPanel({ onUpload, isUploading, uploadProgress, onUploadSuccess }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
    }));
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
    setIsDragging(false);

    // Auto-generate preview for .txt files (WhatsApp)
    if (acceptedFiles.length > 0 && acceptedFiles[0].type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const fragments = parseWhatsAppPreview(text, 5);
        setPreview({
          fileName: acceptedFiles[0].name,
          fragments,
          totalFragmentsEstimate: (text.match(WHATSAPP_REGEX) || []).length,
        });
      };
      reader.readAsText(acceptedFiles[0]);
    } else {
      setPreview(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxFiles: 10,
    maxSize: 50 * 1024 * 1024, // 50MB
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const removeFile = (fileId) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
    if (files.length === 1) {
      setPreview(null);
      setShowPreview(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    // Only upload the first file for now
    const file = files[0].file;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await importAPI.uploadWhatsApp(file, (progressEvent) => {
        if (progressEvent.total) {
          const percent = (progressEvent.loaded / progressEvent.total) * 100;
          if (onUpload) {
            onUpload([{ ...files[0], progress: percent }]);
          }
        }
      });

      // Success
      const insertedCount = response.inserted || 0;
      toast.success(`Successfully uploaded and imported ${insertedCount} fragments!`);
      setFiles([]);
      setPreview(null);
      setShowPreview(false);

      if (onUploadSuccess) {
        onUploadSuccess(response);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Upload failed');
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
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border',
          'hover:border-primary/50 cursor-pointer',
          'dark:border-slate-700 dark:hover:border-primary/50',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
          'transition-all duration-200 ease-in-out'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="p-3 rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium">
            {isDragActive ? 'Drop the files here' : 'Drag and drop files here'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isDragActive
              ? 'Release to upload'
              : 'PDF, DOCX, TXT, MD, PNG, JPG (max 50MB)'}
          </p>
          <div className="mt-4">
            <Button type="button" variant="outline" size="sm">
              Select Files
            </Button>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 border rounded-md bg-background"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-md bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(file.id)}
                  disabled={isUploading}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove file</span>
                </Button>
              </div>
            ))}
          </div>

          {/* Preview Section */}
          {preview && (
            <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">Parse Preview</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="h-8"
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-1.5" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1.5" />
                      Show
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mb-2">
                Found ~{preview.totalFragmentsEstimate} fragments (showing first {preview.fragments.length})
              </p>

              {showPreview && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {preview.fragments.map((frag, idx) => (
                    <div key={idx} className="p-2 bg-background rounded text-xs border">
                      <p className="font-medium text-foreground">{frag.sender}</p>
                      <p className="text-muted-foreground line-clamp-2">{frag.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {frag.datetime?.toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
              className="w-full sm:w-auto"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>

          {isUploading && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
