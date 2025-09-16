/**
 * Reusable file upload zone component
 * Provides drag & drop and click-to-upload functionality
 */

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FILE_UPLOAD } from '@/lib/constants';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  multiple?: boolean;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFilesSelected,
  accept = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'text/csv': ['.csv']
  },
  maxFiles = 10,
  maxSize = FILE_UPLOAD.MAX_FILE_SIZE,
  disabled = false,
  className,
  children,
  multiple = true
}) => {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setError('File size exceeds the maximum limit');
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setError('Invalid file type. Please upload Excel or CSV files only');
      } else {
        setError('File upload failed. Please try again');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      onFilesSelected(acceptedFiles);
    }
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    disabled,
    multiple
  });

  return (
    <div className={cn('w-full', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50 hover:bg-accent/50',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-destructive bg-destructive/5'
        )}
      >
        <input {...getInputProps()} />
        
        {children || (
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              {isDragActive ? (
                <Upload className="h-6 w-6 text-primary animate-bounce" />
              ) : (
                <FileText className="h-6 w-6 text-primary" />
              )}
            </div>
            
            <div>
              <p className="text-foreground font-medium">
                {isDragActive 
                  ? 'Drop files here...' 
                  : 'Click to upload or drag and drop'
                }
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {multiple ? 'Multiple files supported' : 'Single file only'} • Max {Math.round(maxSize / (1024 * 1024))}MB each
              </p>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-2 flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
};