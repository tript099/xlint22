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
        // Fetch standard roles count
        const { count: totalRoles } = await supabase
          .from('xlsmart_standard_roles')
          .select('*', { count: 'exact', head: true });

        // Fetch distinct role categories (job families)
        const { data: jobFamilies } = await supabase
          .from('xlsmart_standard_roles')
          .select('job_family')
          .not('job_family', 'is', null);

        const uniqueJobFamilies = new Set(jobFamilies?.map(role => role.job_family)).size;

        // Fetch role mappings for accuracy calculation
        const { data: mappings, count: totalMappings } = await supabase
          .from('xlsmart_role_mappings')
          .select('mapping_confidence', { count: 'exact' });

        // Calculate average mapping accuracy (confidence is stored as percentages by AI function)
        const avgAccuracy = mappings?.length > 0 
          ? mappings.reduce((sum, m) => sum + (m.mapping_confidence || 0), 0) / mappings.length 
          : 0;

        // Fetch role catalogs
        const { count: activeCatalogs } = await supabase
          .from('xlsmart_role_catalogs')
          .select('*', { count: 'exact', head: true })
          .eq('upload_status', 'completed');

        // Calculate standardization rate - percentage of uploaded roles that have been successfully mapped
        // Get total roles uploaded from catalogs
        const { data: catalogs } = await supabase
          .from('xlsmart_role_catalogs')
          .select('total_roles, processed_roles')
          .eq('upload_status', 'completed');

        const totalRolesUploaded = catalogs?.reduce((sum, catalog) => sum + (catalog.total_roles || 0), 0) || 0;
        const totalRolesProcessed = catalogs?.reduce((sum, catalog) => sum + (catalog.processed_roles || 0), 0) || 0;

        // Debug logging
        console.log('🔍 DEBUG Standardization Rate Calculation:');
        console.log('  - Catalogs found:', catalogs?.length || 0);
        console.log('  - Total roles uploaded:', totalRolesUploaded);
        console.log('  - Total roles processed:', totalRolesProcessed);
        console.log('  - Total mappings created:', totalMappings);
        console.log('  - Raw catalog data:', catalogs);

        // Calculate standardization rate based on actual role mappings created
        // This shows how many uploaded roles were successfully mapped to standardized roles
        const standardizationRate = totalRolesUploaded > 0 
          ? Math.round((totalMappings / totalRolesUploaded) * 100)
          : (totalMappings > 0 ? 100 : 0);

        console.log('  - Final standardization rate:', standardizationRate);

        setAnalytics({
          totalRoles: totalRoles || 0,
          mappingAccuracy: Math.round(avgAccuracy), // Already handled percentage conversion above
          standardizationRate,
          roleCategories: uniqueJobFamilies,
          totalMappings: totalMappings || 0,
          activeCatalogs: activeCatalogs || 0,
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