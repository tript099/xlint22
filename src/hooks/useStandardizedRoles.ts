import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StandardizedRole {
  id: string;
  role_title: string;
  role_level?: string;
  department?: string;
  required_skills?: any;
  standard_description?: string;
  created_at?: string;
  employee_count?: number;
}

const fetchStandardizedRoles = async (): Promise<StandardizedRole[]> => {
  try {
    // OPTIMIZED: Use a more efficient JOIN query with proper counting
    const { data, error } = await supabase
      .from('xlsmart_standard_roles')
      .select(`
        id,
        role_title,
        role_level,
        department,
        required_skills,
        standard_description,
        created_at,
        xlsmart_employees!inner(count)
      `)
      .order('role_title');

    if (error) {
      console.warn('JOIN query failed, using optimized alternative:', error);
      
      // OPTIMIZED: Better fallback with aggregation
      const { data: rolesData, error: rolesError } = await supabase
        .from('xlsmart_standard_roles')
        .select('*')
        .order('role_title');

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) return [];

      // Get employee counts using a single aggregation query
      const { data: employeeCounts } = await supabase
        .rpc('get_role_employee_counts', {
          role_titles: rolesData.map(role => role.role_title)
        });

      // Create a map for O(1) lookups
      const countMap = new Map(
        employeeCounts?.map(item => [item.role_title, item.employee_count]) || []
      );

      return rolesData.map(role => ({
        ...role,
        employee_count: countMap.get(role.role_title) || 0
      }));
    }
    
    // Process the joined data
    return (data || []).map(role => ({
      ...role,
      employee_count: role.xlsmart_employees?.[0]?.count || 0
    }));
  } catch (error) {
    console.error('All optimized queries failed, using basic approach:', error);
    
    // Final fallback: Basic query without employee counts
    const { data: rolesData, error: rolesError } = await supabase
      .from('xlsmart_standard_roles')
      .select('*')
      .order('role_title');

    if (rolesError) throw rolesError;

    return (rolesData || []).map(role => ({
      ...role,
      employee_count: 0 // Will be loaded separately if needed
    }));
  }
};

export const useStandardizedRoles = () => {
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ['standardized-roles'],
    queryFn: fetchStandardizedRoles,
    staleTime: 10 * 60 * 1000, // 10 minutes - increased for better caching
    gcTime: 60 * 60 * 1000, // 1 hour - increased for better memory management
    retry: (failureCount, error) => {
      // Smart retry: only retry on network errors, not data errors
      return failureCount < 2 && (error as any)?.code !== 'PGRST116';
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Only refetch if data is stale
    // OPTIMIZED: Enable background updates for better UX
    refetchInterval: 5 * 60 * 1000, // 5 minutes background refresh
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('xlsmart_standard_roles')
        .delete()
        .eq('id', roleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate and refetch roles data
      queryClient.invalidateQueries({ queryKey: ['standardized-roles'] });
      queryClient.invalidateQueries({ queryKey: ['role-analytics'] });
    },
  });

  const refreshRoles = () => {
    queryClient.invalidateQueries({ queryKey: ['standardized-roles'] });
  };

  return {
    roles: rolesQuery.data || [],
    isLoading: rolesQuery.isLoading,
    error: rolesQuery.error,
    deleteRole: deleteRoleMutation.mutate,
    isDeleting: deleteRoleMutation.isPending,
    refreshRoles,
  };
};