import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SkillsAnalytics {
  totalSkills: number;
  employeesWithSkills: number;
  skillCategories: number;
  coverageRate: number;
  loading: boolean;
}

export const useSkillsAnalytics = (): SkillsAnalytics => {
  const [analytics, setAnalytics] = useState<SkillsAnalytics>({
    totalSkills: 0,
    employeesWithSkills: 0,
    skillCategories: 0,
    coverageRate: 0,
    loading: true
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Fetch total skills
        const { count: totalSkills } = await supabase
          .from('skills_master')
          .select('*', { count: 'exact', head: true });

        // Fetch distinct skill categories
        const { data: categories } = await supabase
          .from('skills_master')
          .select('category');

        const uniqueCategories = new Set(categories?.map(skill => skill.category)).size;

        // Fetch employees with skills
        const { data: employeeSkills } = await supabase
          .from('employee_skills')
          .select('employee_id');

        const employeesWithSkills = new Set(employeeSkills?.map(es => es.employee_id)).size;

        // Get total employees for coverage rate
        const { count: totalEmployees } = await supabase
          .from('xlsmart_employees')
          .select('*', { count: 'exact', head: true });

        // Calculate coverage rate
        const coverageRate = totalEmployees && employeesWithSkills
          ? Math.round((employeesWithSkills / totalEmployees) * 100)
          : 0;

        setAnalytics({
          totalSkills: totalSkills || 0,
          employeesWithSkills,
          skillCategories: uniqueCategories,
          coverageRate,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching skills analytics:', error);
        setAnalytics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchAnalytics();
  }, []);

  return analytics;
};