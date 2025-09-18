import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RoleAnalytics {
  totalRoles: number;
  mappingAccuracy: number;
  standardizationRate: number;
  roleCategories: number;
  totalMappings: number;
  activeCatalogs: number;
  loading: boolean;
}

const fetchRoleAnalytics = async (): Promise<Omit<RoleAnalytics, 'loading'>> => {
  // OPTIMIZED: Single batch query with parallel execution
  const [
    standardRolesResult,
    roleMappingsResult,
    roleCatalogsResult
  ] = await Promise.all([
    // Get standard roles count and job families in one query
    supabase
      .from('xlsmart_standard_roles')
      .select('job_family', { count: 'exact' }),
    
    // Get role mappings data
    supabase
      .from('xlsmart_role_mappings')
      .select('mapping_confidence', { count: 'exact' }),
    
    // Get role catalogs data with totals
    supabase
      .from('xlsmart_role_catalogs')
      .select('total_roles, processed_roles, upload_status', { count: 'exact' })
  ]);

  // Process results
  const totalRoles = standardRolesResult.count || 0;
  
  // Calculate unique job families
  const uniqueJobFamilies = new Set(
    standardRolesResult.data
      ?.filter(role => role.job_family)
      .map(role => role.job_family)
  ).size;

  // Calculate mapping accuracy
  const mappings = roleMappingsResult.data || [];
  const totalMappings = roleMappingsResult.count || 0;
  const avgAccuracy = mappings.length > 0 
    ? mappings.reduce((sum, m) => sum + (m.mapping_confidence || 0), 0) / mappings.length 
    : 0;

  // Calculate active catalogs and standardization rate
  const catalogs = roleCatalogsResult.data || [];
  const activeCatalogs = catalogs.filter(c => c.upload_status === 'completed').length;
  
  const totalRolesUploaded = catalogs
    .filter(c => c.upload_status === 'completed')
    .reduce((sum, catalog) => sum + (catalog.total_roles || 0), 0);

  // Calculate standardization rate based on actual role mappings created
  const standardizationRate = totalRolesUploaded > 0 
    ? Math.round((totalMappings / totalRolesUploaded) * 100)
    : (totalMappings > 0 ? 100 : 0);

  return {
    totalRoles,
    mappingAccuracy: Math.round(avgAccuracy),
    standardizationRate,
    roleCategories: uniqueJobFamilies,
    totalMappings,
    activeCatalogs
  };
};

export const useOptimizedRoleAnalytics = (): RoleAnalytics => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['role-analytics'],
    queryFn: fetchRoleAnalytics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });

  if (error) {
    console.error('Error fetching role analytics:', error);
  }

  return {
    ...data,
    totalRoles: data?.totalRoles || 0,
    mappingAccuracy: data?.mappingAccuracy || 0,
    standardizationRate: data?.standardizationRate || 0,
    roleCategories: data?.roleCategories || 0,
    totalMappings: data?.totalMappings || 0,
    activeCatalogs: data?.activeCatalogs || 0,
    loading: isLoading
  };
};