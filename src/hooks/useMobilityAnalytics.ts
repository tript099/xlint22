import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MobilityAnalytics {
  mobilityRate: number;
  retentionRate: number;
  activePlans: number;
  atRiskEmployees: number;
  totalEmployees: number;
  loading: boolean;
}

export const useMobilityAnalytics = (): MobilityAnalytics => {
  const [analytics, setAnalytics] = useState<MobilityAnalytics>({
    mobilityRate: 0,
    retentionRate: 0,
    activePlans: 0,
    atRiskEmployees: 0,
    totalEmployees: 0,
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

        // Calculate retention rate (assuming active employees represent retained employees)
        const retentionRate = totalEmployees ? Math.round((activeEmployees / totalEmployees) * 100) : 0;

        // Calculate active mobility plans from AI analysis results
        const { data: mobilityPlans } = await supabase
          .from('ai_analysis_results')
          .select('*')
          .eq('analysis_type', 'mobility_plan')
          .eq('status', 'completed');

        // Count unique employees with mobility plans (not duplicate records)
        const uniqueEmployeesWithPlans = new Set();
        mobilityPlans?.forEach(plan => {
          const params = plan.input_parameters as any;
          const employeeId = params?.employee_id || 
                            params?.employeeId ||
                            plan.created_by;
          if (employeeId) {
            uniqueEmployeesWithPlans.add(employeeId);
          }
        });

        const activePlans = uniqueEmployeesWithPlans.size;

        // Calculate ACTUAL mobility rate from executed moves (not just plans)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const { data: actualMoves } = await supabase
          .from('employee_moves' as any)
          .select('employee_id, move_date')
          .eq('move_status', 'executed')
          .gte('move_date', oneYearAgo.toISOString().split('T')[0]);

        // Count unique employees who actually moved in the last year
        const uniqueEmployeesWhoMoved = new Set();
        actualMoves?.forEach((move: any) => {
          uniqueEmployeesWhoMoved.add(move.employee_id);
        });

        // Cap mobility rate at 100% maximum
        const mobilityRate = totalEmployees > 0 
          ? Math.min(100, Math.round((uniqueEmployeesWhoMoved.size / totalEmployees) * 100))
          : 0;

        // Debug logging
        console.log('Mobility Analytics Debug:', {
          totalMobilityPlanRecords: mobilityPlans?.length || 0,
          uniqueEmployeesWithPlans: uniqueEmployeesWithPlans.size,
          actualMovesInLastYear: actualMoves?.length || 0,
          uniqueEmployeesWhoMoved: uniqueEmployeesWhoMoved.size,
          totalEmployees,
          calculatedMobilityRate: mobilityRate
        });

        // Estimate at-risk employees (those with low performance or without assignments)
        const atRiskEmployees = employees?.filter(emp => 
          (emp.performance_rating && emp.performance_rating < 3) || !emp.standard_role_id
        ).length || 0;

        setAnalytics({
          mobilityRate,
          retentionRate,
          activePlans,
          atRiskEmployees,
          totalEmployees: totalEmployees || 0,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching mobility analytics:', error);
        setAnalytics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchAnalytics();
  }, []);

  return analytics;
};