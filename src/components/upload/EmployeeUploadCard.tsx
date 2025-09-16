/**
 * Employee upload card component - extracted from EmployeeUploadTwoStep
 * Handles individual upload modes (upload-only vs upload-assign)
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileUploadZone } from '@/components/common/FileUploadZone';
import { ProgressCard } from '@/components/common/ProgressCard';
import { Upload, UserCheck } from 'lucide-react';
import { UploadProgress, Status } from '@/lib/types';
import { FILE_UPLOAD } from '@/lib/constants';

interface EmployeeUploadCardProps {
  mode: 'upload-only' | 'upload-assign';
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  files: FileList | null;
  progress: UploadProgress;
  status: Status;
  isUploading: boolean;
  onFilesChange: (files: FileList | null) => void;
  onUpload: () => void;
  disabled?: boolean;
}

export const EmployeeUploadCard: React.FC<EmployeeUploadCardProps> = ({
  mode,
  title,
  description,
  icon: Icon,
  files,
  progress,
  status,
  isUploading,
  onFilesChange,
  onUpload,
  disabled = false
}) => {
  const handleFileSelect = (selectedFiles: File[]) => {
    // Convert File[] to FileList-like object
    const fileList = {
      length: selectedFiles.length,
      item: (index: number) => selectedFiles[index] || null,
      [Symbol.iterator]: function* () {
        for (let i = 0; i < selectedFiles.length; i++) {
          yield selectedFiles[i];
        }
      }
    } as FileList;
    
    onFilesChange(fileList);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {status === 'idle' && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`employee-files-${mode}`}>Employee Data Files</Label>
              <FileUploadZone
                onFilesSelected={handleFileSelect}
                disabled={disabled || isUploading}
                multiple={true}
                accept={{
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                  'application/vnd.ms-excel': ['.xls'],
                  'text/csv': ['.csv']
                }}
              />
            </div>
            
            {files && files.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files:</Label>
                <div className="space-y-1">
                  {Array.from(files).map((file, index) => (
                    <div key={index} className="text-sm bg-muted p-2 rounded flex justify-between items-center">
                      <span>{file.name}</span>
                      <span className="text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <Button 
              onClick={onUpload}
              disabled={!files || files.length === 0 || isUploading || disabled}
              className="w-full"
            >
              {mode === 'upload-only' ? (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Data Only
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Upload & Assign Roles
                </>
              )}
            </Button>
          </>
        )}
        
        {(status === 'loading' || status === 'success') && (
          <ProgressCard
            title={isUploading ? "Uploading..." : "Upload Complete"}
            progress={progress}
            status={status === 'loading' ? 'processing' : 'completed'}
            description={
              mode === 'upload-only' 
                ? "Processing employee data..." 
                : "Uploading data for AI role assignment..."
            }
          />
        )}
        
        {status === 'error' && (
          <ProgressCard
            title="Upload Failed"
            progress={progress}
            status="error"
            description="An error occurred during upload. Please try again."
          />
        )}
      </CardContent>
    </Card>
  );
};