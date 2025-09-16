/**
 * API utility functions
 * Centralized API client with error handling and type safety
 */

import { supabase } from '@/integrations/supabase/client';
import { ERROR_MESSAGES } from './constants';

// Generic API response type
interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// API Error class
class ApiErrorClass extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generic error handler
const handleSupabaseError = (error: any): string => {
  if (!error) return ERROR_MESSAGES.GENERIC;
  
  // Handle specific Supabase error codes
  switch (error.code) {
    case 'PGRST116':
      return 'No data found';
    case '23505':
      return 'This record already exists';
    case '23503':
      return 'Referenced record not found';
    case '42501':
      return ERROR_MESSAGES.UNAUTHORIZED;
    default:
      return error.message || ERROR_MESSAGES.GENERIC;
  }
};

// Base API client
export const api = {
  // Generic GET request
  async get<T>(
    table: string,
    query?: {
      select?: string;
      filters?: Record<string, any>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse<T[]>> {
    try {
      let supabaseQuery = supabase.from(table as any).select(query?.select || '*');
      
      // Apply filters
      if (query?.filters) {
        Object.entries(query.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            supabaseQuery = supabaseQuery.eq(key, value);
          }
        });
      }
      
      // Apply ordering
      if (query?.orderBy) {
        supabaseQuery = supabaseQuery.order(
          query.orderBy.column,
          { ascending: query.orderBy.ascending ?? false }
        );
      }
      
      // Apply pagination
      if (query?.limit) {
        supabaseQuery = supabaseQuery.limit(query.limit);
      }
      if (query?.offset) {
        supabaseQuery = supabaseQuery.range(query.offset, query.offset + (query.limit || 10) - 1);
      }
      
      const { data, error } = await supabaseQuery;
      
      if (error) {
        return {
          data: null,
          error: handleSupabaseError(error),
          success: false
        };
      }
      
      return {
        data: data as T[],
        error: null,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC,
        success: false
      };
    }
  },

  // Generic POST request
  async create<T>(table: string, data: Partial<T>): Promise<ApiResponse<T>> {
    try {
      const { data: result, error } = await supabase
        .from(table as any)
        .insert(data)
        .select()
        .single();
      
      if (error) {
        return {
          data: null,
          error: handleSupabaseError(error),
          success: false
        };
      }
      
      return {
        data: result as T,
        error: null,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC,
        success: false
      };
    }
  },

  // Generic PUT request
  async update<T>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<ApiResponse<T>> {
    try {
      const { data: result, error } = await supabase
        .from(table as any)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        return {
          data: null,
          error: handleSupabaseError(error),
          success: false
        };
      }
      
      return {
        data: result as T,
        error: null,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC,
        success: false
      };
    }
  },

  // Generic DELETE request
  async delete(table: string, id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from(table as any)
        .delete()
        .eq('id', id);
      
      if (error) {
        return {
          data: null,
          error: handleSupabaseError(error),
          success: false
        };
      }
      
      return {
        data: null,
        error: null,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC,
        success: false
      };
    }
  },

  // Bulk insert
  async bulkInsert<T>(table: string, data: Partial<T>[]): Promise<ApiResponse<T[]>> {
    try {
      const { data: result, error } = await supabase
        .from(table as any)
        .insert(data)
        .select();
      
      if (error) {
        return {
          data: null,
          error: handleSupabaseError(error),
          success: false
        };
      }
      
      return {
        data: result as T[],
        error: null,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC,
        success: false
      };
    }
  },

  // RPC call
  async rpc<T>(
    functionName: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await supabase.rpc(functionName as any, params);
      
      if (error) {
        return {
          data: null,
          error: handleSupabaseError(error),
          success: false
        };
      }
      
      return {
        data: data as T,
        error: null,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC,
        success: false
      };
    }
  },

  // Edge function call
  async invokeFunction<T>(
    functionName: string,
    body?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: body || {}
      });
      
      if (error) {
        return {
          data: null,
          error: handleSupabaseError(error),
          success: false
        };
      }
      
      return {
        data: data as T,
        error: null,
        success: true
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC,
        success: false
      };
    }
  }
};

// Specific API methods for different entities
export const employeeApi = {
  getAll: (filters?: Record<string, any>) => 
    api.get('xlsmart_employees', { filters }),
  
  getById: (id: string) => 
    api.get('xlsmart_employees', { filters: { id } }),
  
  create: (data: any) => 
    api.create('xlsmart_employees', data),
  
  update: (id: string, data: any) => 
    api.update('xlsmart_employees', id, data),
  
  delete: (id: string) => 
    api.delete('xlsmart_employees', id),
  
  bulkCreate: (data: any[]) => 
    api.bulkInsert('xlsmart_employees', data),
};

export const roleApi = {
  getAll: (filters?: Record<string, any>) => 
    api.get('xlsmart_standard_roles', { filters }),
  
  getById: (id: string) => 
    api.get('xlsmart_standard_roles', { filters: { id } }),
  
  create: (data: any) => 
    api.create('xlsmart_standard_roles', data),
  
  update: (id: string, data: any) => 
    api.update('xlsmart_standard_roles', id, data),
  
  delete: (id: string) => 
    api.delete('xlsmart_standard_roles', id),
};

export const skillApi = {
  getAll: (filters?: Record<string, any>) => 
    api.get('skills_master', { filters }),
  
  getById: (id: string) => 
    api.get('skills_master', { filters: { id } }),
  
  create: (data: any) => 
    api.create('skills_master', data),
  
  update: (id: string, data: any) => 
    api.update('skills_master', id, data),
  
  delete: (id: string) => 
    api.delete('skills_master', id),
};

export const jobDescriptionApi = {
  getAll: (filters?: Record<string, any>) => 
    api.get('xlsmart_job_descriptions', { filters }),
  
  getById: (id: string) => 
    api.get('xlsmart_job_descriptions', { filters: { id } }),
  
  create: (data: any) => 
    api.create('xlsmart_job_descriptions', data),
  
  update: (id: string, data: any) => 
    api.update('xlsmart_job_descriptions', id, data),
  
  delete: (id: string) => 
    api.delete('xlsmart_job_descriptions', id),
};

// AI processing API
export const aiApi = {
  processEmployeeAssignment: (data: any) =>
    api.invokeFunction('ai-employee-assignment', data),
  
  generateJobDescription: (data: any) =>
    api.invokeFunction('ai-job-description-generator', data),
  
  assessSkills: (data: any) =>
    api.invokeFunction('ai-skills-assessment', data),
  
  analyzeWorkforce: (data: any) =>
    api.invokeFunction('ai-workforce-intelligence', data),
  
  planSuccession: (data: any) =>
    api.invokeFunction('ai-succession-planning', data),
};

// Upload API
export const uploadApi = {
  uploadEmployeeData: (data: any) =>
    api.invokeFunction('employee-upload-data', data),
  
  uploadRoleData: (data: any) =>
    api.invokeFunction('upload-role-data', data),
  
  standardizeRoles: (data: any) =>
    api.invokeFunction('standardize-roles', data),
};

// Export types
export type { ApiResponse };
export { ApiErrorClass as ApiError };