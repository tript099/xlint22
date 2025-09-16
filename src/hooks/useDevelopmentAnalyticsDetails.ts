import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PopularLearningTrack {
  name: string;
  learners: number;
  completionRate: number;
}

interface LearningProgress {
  category: string;
  progress: number;
  color: string;
}

interface DevelopmentAnalyticsDetails {
  popularTracks: PopularLearningTrack[];
  learningProgress: LearningProgress[];
  loading: boolean;
}

export const useDevelopmentAnalyticsDetails = (): DevelopmentAnalyticsDetails => {
  const [analytics, setAnalytics] = useState<DevelopmentAnalyticsDetails>({
    popularTracks: [],
    learningProgress: [],
    loading: true
  });

  useEffect(() => {
    const fetchAnalyticsDetails = async () => {
      try {
        // Fetch training programs with enrollment and completion data
        const [programsResult, enrollmentsResult, completionsResult] = await Promise.all([
          supabase
            .from('training_programs')
            .select('*')
            .eq('status', 'active'),
          
          supabase
            .from('employee_training_enrollments')
            .select('training_program_id, status'),
          
          supabase
            .from('training_completions')
            .select('training_program_id')
        ]);

        if (programsResult.error) throw programsResult.error;
        if (enrollmentsResult.error) throw enrollmentsResult.error;
        if (completionsResult.error) throw completionsResult.error;

        const programs = programsResult.data || [];
        const enrollments = enrollmentsResult.data || [];
        const completions = completionsResult.data || [];

        // Calculate popular learning tracks based on development plan recommendations
        const trackStats = new Map<string, { learners: number; completions: number }>();
        
        // Get development plans with their recommended courses
        const { data: developmentPlans } = await supabase
          .from('xlsmart_development_plans')
          .select('recommended_courses, progress_percentage')
          .eq('plan_status', 'active');

        if (developmentPlans) {
          developmentPlans.forEach(plan => {
            if (plan.recommended_courses && Array.isArray(plan.recommended_courses)) {
              plan.recommended_courses.forEach((course: any) => {
                const category = course.category || course.type || 'General';
                const current = trackStats.get(category) || { learners: 0, completions: 0 };
                current.learners++;
                // Consider a course "completed" if the development plan progress is > 80%
                if (plan.progress_percentage > 80) {
                  current.completions++;
                }
                trackStats.set(category, current);
              });
            }
          });
        }

        // Fallback to training enrollments if no development plans
        if (trackStats.size === 0) {
          enrollments.forEach(enrollment => {
            const program = programs.find(p => p.id === enrollment.training_program_id);
            if (program) {
              const category = program.category || 'General';
              const current = trackStats.get(category) || { learners: 0, completions: 0 };
              current.learners++;
              trackStats.set(category, current);
            }
          });

          completions.forEach(completion => {
            const program = programs.find(p => p.id === completion.training_program_id);
            if (program) {
              const category = program.category || 'General';
              const current = trackStats.get(category) || { learners: 0, completions: 0 };
              current.completions++;
              trackStats.set(category, current);
            }
          });
        }

        const popularTracks: PopularLearningTrack[] = Array.from(trackStats.entries())
          .map(([name, stats]) => ({
            name,
            learners: stats.learners,
            completionRate: stats.learners > 0 ? Math.round((stats.completions / stats.learners) * 100) : 0
          }))
          .sort((a, b) => b.learners - a.learners)
          .slice(0, 3);

        // Calculate learning progress by category from development plans
        const progressStats = new Map<string, { total: number; completed: number }>();
        
        if (developmentPlans) {
          developmentPlans.forEach(plan => {
            if (plan.recommended_courses && Array.isArray(plan.recommended_courses)) {
              plan.recommended_courses.forEach((course: any) => {
                const category = course.category || course.type || 'General';
                const current = progressStats.get(category) || { total: 0, completed: 0 };
                current.total++;
                // Consider completed if development plan progress > 80%
                if (plan.progress_percentage > 80) {
                  current.completed++;
                }
                progressStats.set(category, current);
              });
            }
          });
        }

        // Fallback to training enrollments if no development plans
        if (progressStats.size === 0) {
          enrollments.forEach(enrollment => {
            const program = programs.find(p => p.id === enrollment.training_program_id);
            if (program) {
              const category = program.category || 'General';
              const current = progressStats.get(category) || { total: 0, completed: 0 };
              current.total++;
              if (enrollment.status === 'completed') {
                current.completed++;
              }
              progressStats.set(category, current);
            }
          });
        }

        const learningProgress: LearningProgress[] = Array.from(progressStats.entries())
          .map(([category, stats]) => {
            const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            let color = 'bg-blue-500';
            
            // Assign colors based on category
            if (category.toLowerCase().includes('technical') || category.toLowerCase().includes('tech')) {
              color = 'bg-blue-500';
            } else if (category.toLowerCase().includes('soft') || category.toLowerCase().includes('leadership')) {
              color = 'bg-green-500';
            } else if (category.toLowerCase().includes('industry') || category.toLowerCase().includes('domain')) {
              color = 'bg-purple-500';
            } else if (category.toLowerCase().includes('compliance') || category.toLowerCase().includes('safety')) {
              color = 'bg-orange-500';
            }

            return {
              category,
              progress,
              color
            };
          })
          .sort((a, b) => b.progress - a.progress);

        setAnalytics({
          popularTracks,
          learningProgress,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching development analytics details:', error);
        setAnalytics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchAnalyticsDetails();
  }, []);

  return analytics;
};
