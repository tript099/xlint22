/**
 * Custom hook for progress polling operations
 * Handles common progress polling patterns used across upload components
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UploadProgress } from '@/lib/types';
import { ERROR_MESSAGES, UI } from '@/lib/constants';

interface ProgressPollingOptions {
  endpoint: string;
  interval?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: UploadProgress) => void;
  successStatus?: string;
  errorStatus?: string;
}

export const useProgressPolling = () => {
  const [isPolling, setIsPolling] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ 
    total: 0, 
    processed: 0, 
    assigned: 0, 
    errors: 0 
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startPolling = useCallback(async (
    sessionId: string, 
    options: ProgressPollingOptions
  ) => {
    const {
      endpoint,
      interval = 2000,
      onSuccess,
      onError,
      onProgress,
      successStatus = 'completed',
      errorStatus = 'error'
    } = options;

    setIsPolling(true);
    setProgress({ total: 0, processed: 0, assigned: 0, errors: 0 });

    intervalRef.current = setInterval(async () => {
      try {
        const { data: progressData, error } = await supabase.functions.invoke(endpoint, {
          body: { sessionId }
        });

        if (error) {
          throw new Error(error.message || ERROR_MESSAGES.NETWORK);
        }

        if (progressData) {
          const currentProgress = progressData.progress || progress;
          setProgress(currentProgress);
          onProgress?.(currentProgress);

          if (progressData.status === successStatus) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsPolling(false);
            onSuccess?.(progressData);
          } else if (progressData.status === errorStatus) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setIsPolling(false);
            const errorMessage = progressData.error || ERROR_MESSAGES.GENERIC;
            onError?.(errorMessage);
          }
        }
      } catch (error: any) {
        console.error('Progress polling error:', error);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsPolling(false);
        onError?.(error.message || ERROR_MESSAGES.NETWORK);
      }
    }, interval);
  }, [progress, toast]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({ total: 0, processed: 0, assigned: 0, errors: 0 });
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopPolling();
  }, [stopPolling]);

  return {
    isPolling,
    progress,
    startPolling,
    stopPolling,
    resetProgress,
    cleanup
  };
};