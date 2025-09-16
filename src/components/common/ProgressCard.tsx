/**
 * Reusable progress card component
 * Shows upload/processing progress with status indicators
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { UploadProgress } from '@/lib/types';

interface ProgressCardProps {
  title: string;
  progress: UploadProgress;
  status: 'idle' | 'processing' | 'completed' | 'error';
  description?: string;
  showDetails?: boolean;
  className?: string;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  progress,
  status,
  description,
  showDetails = true,
  className
}) => {
  const getProgressPercentage = () => {
    if (progress.total === 0) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = () => {
    const variants = {
      idle: 'secondary',
      processing: 'default',
      completed: 'default',
      error: 'destructive'
    } as const;

    const labels = {
      idle: 'Ready',
      processing: 'Processing...',
      completed: 'Completed',
      error: 'Error'
    };

    return (
      <Badge variant={variants[status]} className="ml-2">
        {labels[status]}
      </Badge>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {title}
          </div>
          {getStatusBadge()}
        </CardTitle>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{getProgressPercentage()}%</span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
        </div>
        
        {showDetails && progress.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-foreground">{progress.total}</div>
              <div className="text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-blue-600">{progress.processed}</div>
              <div className="text-muted-foreground">Processed</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">{progress.assigned}</div>
              <div className="text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-red-600">{progress.errors}</div>
              <div className="text-muted-foreground">Errors</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};