import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeAnalytics {
  totalEmployees: number;
  activeEmployees: number;
  roleAssignmentRate: number;
  dataCompleteness: number;
  skillsAssessmentRate: number;
  avgPerformanceRating: number;
  loading: boolean;
}

export const useEmployeeAnalytics = (): EmployeeAnalytics => {
  const [analytics, setAnalytics] = useState<EmployeeAnalytics>({
    totalEmployees: 0,
    activeEmployees: 0,
    roleAssignmentRate: 0,
    dataCompleteness: 0,
    skillsAssessmentRate: 0,
    avgPerformanceRating: 0,
    loading: true
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Fetch employee data
        const { data: employees, count: totalEmployees } = await supabase
          .from('xlsmart_employees')
          .select('*', { count: 'exact' });

        const activeEmployees = employees?.filter(emp => emp.is_active).length || 0;

        // Calculate role assignment rate
        const assignedRoles = employees?.filter(emp => emp.standard_role_id || emp.ai_suggested_role_id).length || 0;
        const roleAssignmentRate = totalEmployees ? Math.round((assignedRoles / totalEmployees) * 100) : 0;

        // Calculate data completeness - more flexible requirements
        const completeProfiles = employees?.filter(emp => 
          emp.first_name && emp.last_name && emp.email && emp.current_position &&
          (emp.current_department || emp.current_position) // Allow department to be empty if position is filled
        ).length || 0;
        const dataCompleteness = totalEmployees ? Math.round((completeProfiles / totalEmployees) * 100) : 0;

        // Get skill assessments - count unique employees who have been assessed
        const { data: assessmentData } = await supabase
          .from('xlsmart_skill_assessments')
          .select('employee_id');

        // Count unique employees who have assessments
        const uniqueAssessedEmployees = new Set(assessmentData?.map(a => a.employee_id)).size;
        const skillsAssessmentRate = totalEmployees ? Math.round((uniqueAssessedEmployees / totalEmployees) * 100) : 0;

        // Calculate average performance rating
        const avgRating = employees?.length > 0 
          ? employees.reduce((sum, emp) => sum + (emp.performance_rating || 0), 0) / employees.length 
          : 0;

        setAnalytics({
          totalEmployees: totalEmployees || 0,
          activeEmployees,
          roleAssignmentRate,
          dataCompleteness,
          skillsAssessmentRate,
          avgPerformanceRating: Math.round(avgRating * 10) / 10,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching employee analytics:', error);
        setAnalytics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchAnalytics();
  }, []);

  return analytics;
};