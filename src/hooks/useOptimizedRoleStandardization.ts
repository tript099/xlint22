import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StandardizationResult {
  success: boolean;
  standardRolesCreated: number;
  mappingsCreated: number;
  xlDataProcessed: number;
  smartDataProcessed: number;
  optimized?: boolean;
  message: string;
  error?: string;
}

interface UploadSession {
  id: string;
  session_name: string;
  status: string;
  total_rows: number;
  created_at: string;
  ai_analysis?: any;
}

// 🚀 OPTIMIZED: React Query hooks for role standardization with caching

export const useUploadSessions = () => {
  return useQuery({
    queryKey: ['upload-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as UploadSession[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

export const useStandardizedRoles = () => {
  return useQuery({
    queryKey: ['standardized-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xlsmart_standard_roles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
};

export const useRoleMappings = (catalogId?: string) => {
  return useQuery({
    queryKey: ['role-mappings', catalogId],
    queryFn: async () => {
      let query = supabase
        .from('xlsmart_role_mappings')
        .select(`
          *,
          xlsmart_standard_roles!inner (
            role_title,
            job_family,
            role_level,
            department
          )
        `)
        .order('mapping_confidence', { ascending: false });

      if (catalogId) {
        query = query.eq('catalog_id', catalogId);
      }

      const { data, error } = await query.limit(1000);

      if (error) throw error;
      return data;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!catalogId || catalogId === undefined,
    refetchOnWindowFocus: false,
  });
};

export const useCreateUploadSession = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sessionData: {
      sessionName: string;
      fileNames: string[];
      totalRows: number;
      userId: string;
      parsedFiles: any[];
    }) => {
      const { data, error } = await supabase
        .from('xlsmart_upload_sessions')
        .insert({
          session_name: sessionData.sessionName,
          file_names: sessionData.fileNames,
          temp_table_names: [],
          total_rows: sessionData.totalRows,
          status: 'processing',
          created_by: sessionData.userId,
          ai_analysis: { 
            step: 'ready_for_standardization',
            raw_data: sessionData.parsedFiles
          }
        })
        .select()
        .single();

      if (error) throw error;
      return data as UploadSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upload-sessions'] });
      toast({
        title: "✅ Session Created",
        description: "Upload session created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Session Creation Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });
};

export const useOptimizedStandardization = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<StandardizationResult> => {
      console.log('🚀 Starting optimized AI role standardization...');
      
      // 🚀 OPTIMIZED: Use the new optimized function
      const { data, error } = await supabase.functions.invoke('ai-role-standardization-optimized', {
        body: { sessionId }
      });

      if (error) {
        console.error('Standardization error:', error);
        throw new Error(`Standardization failed: ${error.message}`);
      }

      if (!data?.success) {
        console.error('Standardization failed:', data);
        throw new Error(data?.error || 'Standardization failed');
      }

      return data;
    },
    onSuccess: (result) => {
      // 🚀 CACHE INVALIDATION: Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['upload-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['standardized-roles'] });
      queryClient.invalidateQueries({ queryKey: ['role-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['role-analytics'] });

      const message = result.optimized 
        ? `🚀 OPTIMIZED: Created ${result.standardRolesCreated} standard roles with ${result.mappingsCreated} mappings in record time!`
        : `Created ${result.standardRolesCreated} standard roles with ${result.mappingsCreated} mappings`;

      toast({
        title: "✅ Standardization Complete!",
        description: message,
        duration: 5000
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Standardization Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  });
};

export const useRoleStandardizationAnalytics = () => {
  return useQuery({
    queryKey: ['role-standardization-analytics'],
    queryFn: async () => {
      // 🚀 PARALLEL QUERIES: Get all analytics data in parallel
      const [
        sessionsResult,
        rolesResult,
        mappingsResult,
        catalogsResult
      ] = await Promise.all([
        supabase
          .from('xlsmart_upload_sessions')
          .select('status', { count: 'exact' }),
        supabase
          .from('xlsmart_standard_roles')
          .select('job_family', { count: 'exact' })
          .eq('is_active', true),
        supabase
          .from('xlsmart_role_mappings')
          .select('mapping_confidence, mapping_status', { count: 'exact' }),
        supabase
          .from('xlsmart_role_catalogs')
          .select('upload_status', { count: 'exact' })
      ]);

      // Process results
      const totalSessions = sessionsResult.count || 0;
      const completedSessions = sessionsResult.data?.filter(s => s.status === 'completed').length || 0;
      
      const totalStandardRoles = rolesResult.count || 0;
      const uniqueJobFamilies = new Set(rolesResult.data?.map(r => r.job_family)).size;
      
      const totalMappings = mappingsResult.count || 0;
      const avgConfidence = mappingsResult.data?.length > 0 
        ? Math.round(mappingsResult.data.reduce((sum, m) => sum + (m.mapping_confidence || 0), 0) / mappingsResult.data.length)
        : 0;
      
      const activeCatalogs = catalogsResult.data?.filter(c => c.upload_status === 'completed').length || 0;

      return {
        totalSessions,
        completedSessions,
        completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
        totalStandardRoles,
        uniqueJobFamilies,
        totalMappings,
        avgConfidence,
        activeCatalogs,
        processingRate: totalMappings > 0 ? Math.round((totalMappings / totalStandardRoles) * 100) : 0
      };
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
  });
};

// 🚀 UTILITY: Prefetch functions for better UX
export const usePrefetchStandardizationData = () => {
  const queryClient = useQueryClient();

  return {
    prefetchSessions: () => {
      queryClient.prefetchQuery({
        queryKey: ['upload-sessions'],
        staleTime: 2 * 60 * 1000,
      });
    },
    prefetchRoles: () => {
      queryClient.prefetchQuery({
        queryKey: ['standardized-roles'],
        staleTime: 5 * 60 * 1000,
      });
    },
    prefetchAnalytics: () => {
      queryClient.prefetchQuery({
        queryKey: ['role-standardization-analytics'],
        staleTime: 3 * 60 * 1000,
      });
    }
  };
};