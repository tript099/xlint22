import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrainingProgram, 
  TrainingEnrollment, 
  TrainingAnalytics,
  CreateTrainingProgramData,
  AssignTrainingData,
  UpdateEnrollmentData
} from "@/types/training-management";

export const useTrainingManagement = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTrainingProgram = async (data: CreateTrainingProgramData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('training-management-crud', {
        body: {
          action: 'create_program',
          ...data
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to create training program');
      }

      return response.program;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTrainingProgram = async (id: string, data: Partial<CreateTrainingProgramData>) => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('training-management-crud', {
        body: {
          action: 'update_program',
          id,
          ...data
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to update training program');
      }

      return response.program;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTrainingProgram = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('training-management-crud', {
        body: {
          action: 'delete_program',
          id
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to delete training program');
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getTrainingPrograms = async (params?: { status?: string; category?: string; limit?: number; offset?: number }) => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('training-management-crud', {
        body: {
          action: 'get_programs',
          ...params
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch training programs');
      }

      return response.programs;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const assignTraining = async (data: AssignTrainingData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('training-management-crud', {
        body: {
          action: 'assign_training',
          ...data
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to assign training');
      }

      return response.enrollment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeTrainings = async (employeeId: string, params?: { status?: string; limit?: number; offset?: number }) => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('training-management-crud', {
        body: {
          action: 'get_employee_trainings',
          employeeId,
          ...params
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch employee trainings');
      }

      return response.enrollments;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateEnrollment = async (data: UpdateEnrollmentData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('training-management-crud', {
        body: {
          action: 'update_enrollment',
          ...data
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to update enrollment');
      }

      return response.enrollment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getTrainingAnalytics = async (): Promise<TrainingAnalytics> => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('training-management-crud', {
        body: {
          action: 'get_training_analytics'
        }
      });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch training analytics');
      }

      return response.analytics;
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
    createTrainingProgram,
    updateTrainingProgram,
    deleteTrainingProgram,
    getTrainingPrograms,
    assignTraining,
    getEmployeeTrainings,
    updateEnrollment,
    getTrainingAnalytics
  };
};


