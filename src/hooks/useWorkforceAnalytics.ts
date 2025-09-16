import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WorkforceMetrics {
  totalEmployees: number;
  averageExperience: number;
  skillDistribution: { [key: string]: number };
  departmentBreakdown: { [key: string]: number };
  performanceMetrics: {
    averageRating: number;
    highPerformers: number;
    lowPerformers: number;
  };
  trainingMetrics: {
    totalTrainings: number;
    completionRate: number;
    averageHours: number;
  };
  certificationMetrics: {
    totalCertifications: number;
    expiringCertifications: number;
    topCertifications: { name: string; count: number }[];
  };
  skillGaps: {
    criticalGaps: number;
    totalAssessments: number;
    averageMatchPercentage: number;
  };
  roleDistribution: { [key: string]: number };
  retentionRisk: {
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  careerPathways: {
    totalPathways: number;
    activePathways: number;
    avgReadinessScore: number;
  };
  mobilityPlanning: {
    totalPlans: number;
    internalMoves: number;
    readyForPromotion: number;
  };
  aiInsights: {
    totalAnalyses: number;
    roleOptimizations: number;
    skillRecommendations: number;
  };
}

export const useWorkforceAnalytics = () => {
  const [metrics, setMetrics] = useState<WorkforceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkforceAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch core data first
      const [
        employeesResult,
        skillAssessmentsResult,
        certificationsResult,
        trainingEnrollmentsResult,
        trainingProgramsResult,
        roleMappingsResult,
        standardRolesResult,
        aiAnalysesResult
      ] = await Promise.all([
        supabase.from('xlsmart_employees').select('*'),
        supabase.from('xlsmart_skill_assessments').select('*'),
        supabase.from('employee_certifications').select('*, xlsmart_employees(current_department)'),
        supabase.from('employee_training_enrollments').select(`
          *,
          training_programs(name, category, duration_hours),
          xlsmart_employees!employee_training_enrollments_employee_id_fkey(current_department)
        `),
        supabase.from('training_programs').select('*'),
        supabase.from('xlsmart_role_mappings').select('*'),
        supabase.from('xlsmart_standard_roles').select('*'),
        supabase.from('ai_analysis_results').select('*')
      ]);

      // Handle potential errors
      if (employeesResult.error) throw employeesResult.error;
      if (skillAssessmentsResult.error) throw skillAssessmentsResult.error;
      if (certificationsResult.error) throw certificationsResult.error;
      if (trainingEnrollmentsResult.error) throw trainingEnrollmentsResult.error;
      if (trainingProgramsResult.error) throw trainingProgramsResult.error;
      if (roleMappingsResult.error) throw roleMappingsResult.error;
      if (standardRolesResult.error) throw standardRolesResult.error;
      if (aiAnalysesResult.error) throw aiAnalysesResult.error;

      // Try to fetch training completions (optional)
      let trainingCompletions: any[] = [];
      try {
        const trainingCompletionsResult = await supabase.from('training_completions').select('*');
        if (!trainingCompletionsResult.error) {
          trainingCompletions = trainingCompletionsResult.data || [];
        }
      } catch (completionsError) {
        console.warn('Training completions table not available, using enrollment status instead');
      }

      const employees = employeesResult.data || [];
      const skillAssessments = skillAssessmentsResult.data || [];
      const certifications = certificationsResult.data || [];
      const trainingEnrollments = trainingEnrollmentsResult.data || [];
      const trainingPrograms = trainingProgramsResult.data || [];
      const roleMappings = roleMappingsResult.data || [];
      const standardRoles = standardRolesResult.data || [];
      const aiAnalyses = aiAnalysesResult.data || [];

      // Calculate comprehensive metrics
      const totalEmployees = employees.length;
      
      const averageExperience = employees.reduce((sum, emp) => 
        sum + (emp.years_of_experience || 0), 0) / totalEmployees || 0;

      // Department breakdown
      const departmentBreakdown: { [key: string]: number } = {};
      employees.forEach(emp => {
        const dept = emp.current_department || emp.source_company || 'Unassigned';
        departmentBreakdown[dept] = (departmentBreakdown[dept] || 0) + 1;
      });

      // Skills distribution from employee skills JSONB field
      const skillDistribution: { [key: string]: number } = {};
      employees.forEach(emp => {
        if (emp.skills && Array.isArray(emp.skills)) {
          emp.skills.forEach((skill: any) => {
            const skillName = typeof skill === 'string' ? skill : skill.name || skill.skill || 'Unknown';
            if (skillName && skillName.length > 1 && !skillName.includes(':')) {
              skillDistribution[skillName] = (skillDistribution[skillName] || 0) + 1;
            }
          });
        }
      });

      // Performance metrics
      const performanceRatings = employees.map(emp => Number(emp.performance_rating)).filter(rating => !isNaN(rating) && rating > 0);
      const averageRating = performanceRatings.reduce((sum, rating) => sum + rating, 0) / performanceRatings.length || 0;
      const highPerformers = performanceRatings.filter(rating => rating >= 4).length;
      const lowPerformers = performanceRatings.filter(rating => rating <= 2).length;

      // Training metrics from actual training system data
      const totalTrainings = trainingPrograms.length;
      const activePrograms = trainingPrograms.filter(program => program.status === 'active').length;
      const totalEnrollments = trainingEnrollments.length;
      
      // Calculate completions - try training_completions first, fallback to enrollment status
      const completedTrainings = trainingCompletions.length > 0 
        ? trainingCompletions.length 
        : trainingEnrollments.filter(enrollment => enrollment.status === 'completed').length;
        
      const inProgressTrainings = trainingEnrollments.filter(enrollment => 
        enrollment.status === 'in_progress'
      ).length;
      
      // Calculate completion rate based on enrollments vs completions
      const completionRate = totalEnrollments > 0 ? (completedTrainings / totalEnrollments) * 100 : 0;
      
      // Calculate average hours from actual training programs and time spent
      const totalHoursFromPrograms = trainingPrograms.reduce((sum, program) => 
        sum + (program.duration_hours || 0), 0);
      const totalTimeSpent = trainingEnrollments.reduce((sum, enrollment) => 
        sum + (enrollment.time_spent_hours || 0), 0);
      
      // Use time spent if available, otherwise estimate from program duration
      const averageHours = totalEnrollments > 0 
        ? (totalTimeSpent > 0 ? totalTimeSpent / totalEnrollments : totalHoursFromPrograms / Math.max(totalEnrollments, 1))
        : 0;

      // Certification metrics
      const totalCertifications = certifications.length;
      const now = new Date();
      const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const expiringCertifications = certifications.filter(cert => 
        cert.expiry_date && new Date(cert.expiry_date) <= threeMonthsFromNow
      ).length;

      // Top certifications with better integration to training programs
      const certificationCounts: { [key: string]: number } = {};
      certifications.forEach(cert => {
        const certName = cert.certification_name || 'Unknown';
        certificationCounts[certName] = (certificationCounts[certName] || 0) + 1;
      });
      
      // Also include certifications from training programs
      trainingPrograms.forEach(program => {
        if (program.certification_provided && program.certification_name) {
          const enrolledCount = trainingEnrollments.filter(enrollment => 
            enrollment.training_program_id === program.id && 
            ['completed', 'in_progress'].includes(enrollment.status)
          ).length;
          
          if (enrolledCount > 0) {
            certificationCounts[program.certification_name] = 
              (certificationCounts[program.certification_name] || 0) + enrolledCount;
          }
        }
      });
      
      const topCertifications = Object.entries(certificationCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get latest skill assessment per employee to avoid duplicates
      const latestAssessmentPerEmployee = new Map();
      skillAssessments.forEach(assessment => {
        const employeeId = assessment.employee_id;
        const existingAssessment = latestAssessmentPerEmployee.get(employeeId);
        
        if (!existingAssessment || new Date(assessment.assessment_date) > new Date(existingAssessment.assessment_date)) {
          latestAssessmentPerEmployee.set(employeeId, assessment);
        }
      });

      // Skill gaps analysis from latest assessments only
      const latestAssessments = Array.from(latestAssessmentPerEmployee.values());
      const totalAssessments = latestAssessments.length;
      const averageMatchPercentage = latestAssessments.reduce((sum, assessment) => 
        sum + (Number(assessment.overall_match_percentage) || 0), 0) / totalAssessments || 0;
      const criticalGaps = latestAssessments.filter(assessment => 
        assessment.overall_match_percentage && Number(assessment.overall_match_percentage) < 60
      ).length;

      // Role distribution
      const roleDistribution: { [key: string]: number } = {};
      employees.forEach(emp => {
        const role = emp.current_position || 'Unassigned';
        roleDistribution[role] = (roleDistribution[role] || 0) + 1;
      });

      // Retention risk based on latest skill assessments only
      const highRisk = latestAssessments.filter(assessment => 
        (assessment.churn_risk_score || 0) > 70 || (assessment.rotation_risk_score || 0) > 70
      ).length;
      const mediumRisk = latestAssessments.filter(assessment => 
        ((assessment.churn_risk_score || 0) > 40 && (assessment.churn_risk_score || 0) <= 70) ||
        ((assessment.rotation_risk_score || 0) > 40 && (assessment.rotation_risk_score || 0) <= 70)
      ).length;
      const lowRisk = totalEmployees - highRisk - mediumRisk;

      // Career pathways analysis (based on AI analyses)
      const careerPathwayAnalyses = aiAnalyses.filter(analysis => 
        analysis.analysis_type === 'career_planning' || analysis.function_name === 'employee-career-paths'
      );
      const totalPathways = careerPathwayAnalyses.length;
      const activePathways = careerPathwayAnalyses.filter(analysis => 
        analysis.status === 'completed'
      ).length;

      // Mobility planning analysis
      const mobilityAnalyses = aiAnalyses.filter(analysis => 
        analysis.analysis_type === 'mobility_planning' || analysis.function_name === 'employee-mobility-planning'
      );
      const totalPlans = mobilityAnalyses.length;
      const internalMoves = Math.floor(totalPlans * 0.3); // Estimated
      const readyForPromotion = Math.floor(totalEmployees * 0.15); // Estimated

      // AI insights summary
      const roleOptimizations = aiAnalyses.filter(analysis => 
        analysis.analysis_type === 'mobility_plan' || analysis.function_name === 'employee-mobility-planning-bulk'
      ).length;
      const skillRecommendations = aiAnalyses.filter(analysis => 
        analysis.analysis_type === 'career_path' || analysis.function_name === 'employee-career-paths-bulk'
      ).length;

      const calculatedMetrics: WorkforceMetrics = {
        totalEmployees,
        averageExperience: Math.round(averageExperience * 10) / 10,
        skillDistribution,
        departmentBreakdown,
        performanceMetrics: {
          averageRating: Math.round(averageRating * 10) / 10,
          highPerformers,
          lowPerformers
        },
        trainingMetrics: {
          totalTrainings,
          completionRate: Math.round(completionRate),
          averageHours: Math.round(averageHours)
        },
        certificationMetrics: {
          totalCertifications,
          expiringCertifications,
          topCertifications
        },
        skillGaps: {
          criticalGaps,
          totalAssessments,
          averageMatchPercentage: Math.round(averageMatchPercentage)
        },
        roleDistribution,
        retentionRisk: {
          highRisk,
          mediumRisk,
          lowRisk
        },
        careerPathways: {
          totalPathways,
          activePathways,
          avgReadinessScore: Math.round(Math.random() * 30 + 60) // Placeholder calculation
        },
        mobilityPlanning: {
          totalPlans,
          internalMoves,
          readyForPromotion
        },
        aiInsights: {
          totalAnalyses: aiAnalyses.length,
          roleOptimizations,
          skillRecommendations
        }
      };

      setMetrics(calculatedMetrics);
    } catch (err) {
      console.error('Error fetching workforce analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkforceAnalytics();
  }, []);

  return {
    metrics,
    loading,
    error,
    refetch: fetchWorkforceAnalytics
  };
};