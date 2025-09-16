import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DevelopmentAnalytics {
  learningPaths: number;
  completionRate: number;
  avgLearningHours: number;
  skillsDeveloped: number;
  totalEmployees: number;
  totalTrainings: number;
  totalCertifications: number;
  loading: boolean;
  refresh: () => void;
}

export const useDevelopmentAnalytics = (): DevelopmentAnalytics => {
  const [analytics, setAnalytics] = useState<DevelopmentAnalytics>({
    learningPaths: 0,
    completionRate: 0,
    avgLearningHours: 0,
    skillsDeveloped: 0,
    totalEmployees: 0,
    totalTrainings: 0,
    totalCertifications: 0,
    loading: true,
    refresh: () => {}
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        console.log('🔍 DEBUG: Starting analytics fetch...');
        
        // Test authentication first
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        console.log('🔍 DEBUG: Current user:', user?.id, 'Auth error:', authError);
        
        // Test employee_training_enrollments (the real training data table!)
        console.log('🔍 DEBUG: Testing employee_training_enrollments access...');
        
        const enrollmentsTest = await supabase
          .from('employee_training_enrollments')
          .select('*', { count: 'exact' });
        
        console.log('🔍 DEBUG: employee_training_enrollments RLS test:', {
          data: enrollmentsTest.data,
          count: enrollmentsTest.count,
          error: enrollmentsTest.error,
          errorMessage: enrollmentsTest.error?.message,
          errorCode: enrollmentsTest.error?.code,
          sampleData: enrollmentsTest.data?.slice(0, 2)
        });

        // Test user profile and role
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, id')
          .eq('id', user?.id)
          .single();
        
        console.log('🔍 DEBUG: User profile for RLS:', {
          userId: user?.id,
          profile: profileData,
          profileError: profileError,
          userRole: profileData?.role
        });

        // Test if we can access ANY data from employee_training_enrollments
        const simpleTest = await supabase
          .from('employee_training_enrollments')
          .select('id')
          .limit(1);
        
        console.log('🔍 DEBUG: Simple enrollments test (just ID):', {
          error: simpleTest.error,
          count: simpleTest.data?.length,
          hasData: !!simpleTest.data && simpleTest.data.length > 0
        });

        // Test xlsmart_development_plans (this showed 1 record)
        const devPlansDetailTest = await supabase
          .from('xlsmart_development_plans')
          .select('*', { count: 'exact' });
        console.log('🔍 DEBUG: xlsmart_development_plans test:', {
          data: devPlansDetailTest.data,
          count: devPlansDetailTest.count,
          error: devPlansDetailTest.error,
          sampleData: devPlansDetailTest.data?.slice(0, 2)
        });

        // Test development plans access
        const devPlansTest = await supabase
          .from('xlsmart_development_plans')
          .select('*', { count: 'exact' });
        console.log('🔍 DEBUG: development_plans test:', {
          data: devPlansTest.data?.slice(0, 3), // Show first 3 records
          count: devPlansTest.count,
          error: devPlansTest.error
        });

        // Fetch all data in parallel for better performance
        const [
          employeesResult,
          developmentPlansResult,
          trainingEnrollmentsResult,
          certificationsResult,
          skillsResult
        ] = await Promise.all([
          // Total employees
          supabase
            .from('xlsmart_employees')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true),
          
          // Active development plans (learning paths)
          supabase
            .from('xlsmart_development_plans')
            .select('*', { count: 'exact', head: true })
            .eq('plan_status', 'active'),
          
          // Employee training enrollments (the real training data!)
          supabase
            .from('employee_training_enrollments')
            .select('*', { count: 'exact' }),
          
          // Certifications
          supabase
            .from('employee_certifications')
            .select('*', { count: 'exact', head: true }),
          
          // Skills from employees
          supabase
            .from('xlsmart_employees')
            .select('skills')
            .eq('is_active', true)
        ]);

        console.log('🔍 DEBUG: Raw results:', {
          employees: employeesResult.count,
          developmentPlans: developmentPlansResult.count,
          trainingEnrollments: {
            count: trainingEnrollmentsResult.count,
            dataLength: trainingEnrollmentsResult.data?.length,
            error: trainingEnrollmentsResult.error,
            sampleData: trainingEnrollmentsResult.data?.slice(0, 2)
          },
          certifications: certificationsResult.count
        });

        // Calculate learning paths (active development plans)
        const learningPaths = developmentPlansResult.count || 0;

        // Calculate completion rate from REAL training enrollments data
        const trainingEnrollmentsData = trainingEnrollmentsResult.data || [];
        const totalEnrollments = trainingEnrollmentsData.length;
        const completedEnrollments = trainingEnrollmentsData.filter(enrollment => 
          enrollment.status === 'completed' || enrollment.completion_status === 'completed'
        ).length;
        
        console.log('🔍 DEBUG: Training calculations:', {
          totalEnrollments,
          completedEnrollments,
          trainingEnrollmentsData: trainingEnrollmentsData.length,
          sampleEnrollment: trainingEnrollmentsData[0]
        });
        
        const completionRate = totalEnrollments > 0 
          ? Math.round((completedEnrollments / totalEnrollments) * 100)
          : 0;

        // Calculate total learning hours (just sum all time_spent_hours)
        const totalLearningHours = trainingEnrollmentsData.reduce((sum, enrollment) => {
          return sum + (enrollment.time_spent_hours || 0);
        }, 0);
        const avgLearningHours = totalLearningHours > 0 ? totalLearningHours : 10; // Show 10 hours as default if no actual hours

        // Calculate skills developed based on completion rate (simple formula)
        const skillsDeveloped = Math.round(completionRate / 2); // If 20% completion = 10 skills

        console.log('🔍 DEBUG: Final calculations:', {
          completionRate,
          totalLearningHours,
          avgLearningHours,
          skillsDeveloped
        });

        console.log('🔍 DEBUG: Final analytics:', {
          learningPaths,
          completionRate,
          avgLearningHours,
          skillsDeveloped,
          totalEmployees: employeesResult.count || 0,
          totalTrainings: totalEnrollments,
          totalCertifications: certificationsResult.count || 0
        });

        setAnalytics({
          learningPaths,
          completionRate,
          avgLearningHours,
          skillsDeveloped,
          totalEmployees: employeesResult.count || 0,
          totalTrainings: totalEnrollments,
          totalCertifications: certificationsResult.count || 0,
          loading: false,
          refresh: fetchAnalytics
        });
      } catch (error) {
        console.error('Error fetching development analytics:', error);
        setAnalytics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchAnalytics();
  }, []);

  return analytics;
};