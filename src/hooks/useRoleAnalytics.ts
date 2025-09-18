import { useEffect, useState } from "react";
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

export const useRoleAnalytics = (): RoleAnalytics => {
  const [analytics, setAnalytics] = useState<RoleAnalytics>({
    totalRoles: 0,
    mappingAccuracy: 0,
    standardizationRate: 0,
    roleCategories: 0,
    totalMappings: 0,
    activeCatalogs: 0,
    loading: true
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // OPTIMIZED: Single batch query with parallel execution instead of sequential
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

        console.log('📊 OPTIMIZED Analytics Results:', {
          totalRoles,
          uniqueJobFamilies,
          totalMappings,
          activeCatalogs,
          totalRolesUploaded,
          standardizationRate,
          avgAccuracy: Math.round(avgAccuracy)
        });

        setAnalytics({
          totalRoles,
          mappingAccuracy: Math.round(avgAccuracy),
          standardizationRate,
          roleCategories: uniqueJobFamilies,
          totalMappings,
          activeCatalogs,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching role analytics:', error);
        setAnalytics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchAnalytics();
  }, []);

  return analytics;
};