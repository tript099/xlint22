import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AIStats {
  employees: string;
  roles: string; 
  accuracy: string;
  skills: string;
  loading: boolean;
}

export const useAIStats = (): AIStats => {
  const [stats, setStats] = useState<AIStats>({
    employees: "0",
    roles: "0", 
    accuracy: "0%",
    skills: "0",
    loading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch real data from database tables
        const [
          employeesResult,
          rolesResult, 
          mappingsResult,
          skillsResult
        ] = await Promise.all([
          supabase.from('xlsmart_employees').select('*', { count: 'exact', head: true }),
          supabase.from('xlsmart_standard_roles').select('*', { count: 'exact', head: true }),
          supabase.from('xlsmart_role_mappings').select('mapping_confidence'),
          supabase.from('skills_master').select('*', { count: 'exact', head: true })
        ]);

        const employeeCount = employeesResult.count || 0;
        const roleCount = rolesResult.count || 0;
        const skillCount = skillsResult.count || 0;
        
        // Calculate average accuracy from mappings
        const mappings = mappingsResult.data || [];
        const averageAccuracy = mappings.length > 0 
          ? Math.round(mappings.reduce((sum: number, m: any) => sum + (m.mapping_confidence || 0), 0) / mappings.length)
          : 0;

        setStats({
          employees: employeeCount.toLocaleString(),
          roles: roleCount.toString(),
          accuracy: `${averageAccuracy}%`,
          skills: skillCount.toString(),
          loading: false
        });
      } catch (error) {
        console.error('Error fetching AI stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  return stats;
};