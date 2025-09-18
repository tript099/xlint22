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
    // OPTIMIZED: Try to use a single query with JOIN first
    const { data, error } = await supabase
      .from('xlsmart_standard_roles')
      .select(`
        *,
        employee_count:xlsmart_employees(count)
      `)
      .order('role_title');

    if (error) throw error;
    
    // Process the joined data
    return (data || []).map(role => ({
      ...role,
      employee_count: role.employee_count?.[0]?.count || 0
    }));
  } catch (error) {
    console.error('JOIN query failed, using fallback:', error);
    
    // Fallback: Use optimized batch query
    const { data: rolesData, error: rolesError } = await supabase
      .from('xlsmart_standard_roles')
      .select('*')
      .order('role_title');

    if (rolesError) throw rolesError;

    // Get all employee counts in a single query
    const roleTitles = rolesData?.map(role => role.role_title) || [];
    
    if (roleTitles.length === 0) return [];

    const { data: employeeCounts } = await supabase
      .from('xlsmart_employees')
      .select('current_position')
      .in('current_position', roleTitles);

    // Count employees per role
    const countMap = new Map();
    employeeCounts?.forEach(emp => {
      const role = emp.current_position;
      countMap.set(role, (countMap.get(role) || 0) + 1);
    });

    return (rolesData || []).map(role => ({
      ...role,
      employee_count: countMap.get(role.role_title) || 0
    }));
  }
};

export const useStandardizedRoles = () => {
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ['standardized-roles'],
    queryFn: fetchStandardizedRoles,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
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