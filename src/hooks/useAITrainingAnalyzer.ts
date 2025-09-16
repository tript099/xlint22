import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrainingRecommendation } from "@/types/training-management";

export const useAITrainingAnalyzer = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeEmployeeTraining = async (employeeId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('ai-training-analyzer', {
        body: {
          employeeId,
          analysisType: 'individual'
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to analyze employee training needs');
      }

      return response.recommendations[0] as TrainingRecommendation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const analyzeAllEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('ai-training-analyzer', {
        body: {
          analysisType: 'bulk'
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to analyze all employees');
      }

      return response.recommendations as TrainingRecommendation[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    analyzeEmployeeTraining,
    analyzeAllEmployees
  };
};


