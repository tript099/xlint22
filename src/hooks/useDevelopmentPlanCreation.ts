import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DevelopmentPlanData {
  employee_id: string;
  target_role: string;
  current_skill_level: number;
  target_skill_level: number;
  development_areas: string[];
  recommended_courses: any[];
  recommended_certifications: any[];
  recommended_projects: any[];
  timeline_months: number;
  progress_percentage: number;
  plan_status: 'active' | 'completed' | 'paused' | 'cancelled';
}

export const useDevelopmentPlanCreation = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const createStructuredDevelopmentPlan = async (
    aiAnalysisResult: any,
    employeeId: string,
    targetRole: string
  ) => {
    setIsCreating(true);
    
    try {
      // Parse the AI-generated development plan text
      const developmentPlanText = aiAnalysisResult.analysis_result?.developmentPlan || '';
      
      // Extract structured data from the AI response
      const structuredData = parseDevelopmentPlan(developmentPlanText);
      
      // Create the structured development plan in the database
      const { data, error } = await supabase
        .from('xlsmart_development_plans')
        .insert({
          employee_id: employeeId,
          target_role: targetRole,
          current_skill_level: structuredData.currentSkillLevel,
          target_skill_level: structuredData.targetSkillLevel,
          development_areas: structuredData.developmentAreas,
          recommended_courses: structuredData.recommendedCourses,
          recommended_certifications: structuredData.recommendedCertifications,
          recommended_projects: structuredData.recommendedProjects,
          timeline_months: structuredData.timelineMonths,
          progress_percentage: 0, // Start at 0%
          plan_status: 'active',
          created_by: (await supabase.auth.getUser()).data.user?.id,
          assigned_to: employeeId
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✅ Development Plan Created!",
        description: "Structured development plan has been saved to the database.",
      });

      return data;
    } catch (error) {
      console.error('Error creating structured development plan:', error);
      toast({
        title: "Error",
        description: "Failed to create structured development plan.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createStructuredDevelopmentPlan,
    isCreating
  };
};

// Helper function to parse AI-generated development plan text into structured data
function parseDevelopmentPlan(planText: string): {
  currentSkillLevel: number;
  targetSkillLevel: number;
  developmentAreas: string[];
  recommendedCourses: any[];
  recommendedCertifications: any[];
  recommendedProjects: any[];
  timelineMonths: number;
} {
  // This is a simplified parser - you might want to make this more sophisticated
  const lines = planText.split('\n');
  
  const developmentAreas: string[] = [];
  const recommendedCourses: any[] = [];
  const recommendedCertifications: any[] = [];
  const recommendedProjects: any[] = [];
  
  let timelineMonths = 12; // Default
  
  // Extract timeline
  const timelineMatch = planText.match(/(\d+)\s*months?/i);
  if (timelineMatch) {
    timelineMonths = parseInt(timelineMatch[1]);
  }
  
  // Extract development areas from the text
  const areaKeywords = ['Technical', 'Leadership', 'Communication', 'Project Management', 'Industry Knowledge'];
  areaKeywords.forEach(keyword => {
    if (planText.toLowerCase().includes(keyword.toLowerCase())) {
      developmentAreas.push(keyword);
    }
  });
  
  // Extract courses and certifications
  const courseKeywords = ['training', 'course', 'workshop', 'program'];
  const certKeywords = ['certification', 'certificate', 'certified'];
  
  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    if (courseKeywords.some(keyword => lowerLine.includes(keyword))) {
      recommendedCourses.push({
        name: line.trim().replace(/^[-•*]\s*/, ''),
        category: 'Professional Development',
        duration: '4-8 weeks',
        skills: ['Professional Skills']
      });
    }
    
    if (certKeywords.some(keyword => lowerLine.includes(keyword))) {
      recommendedCertifications.push({
        name: line.trim().replace(/^[-•*]\s*/, ''),
        provider: 'Industry Standard',
        validity: '2-3 years',
        skills: ['Certification']
      });
    }
  });
  
  return {
    currentSkillLevel: 3.0, // Default - could be calculated from employee data
    targetSkillLevel: 4.5, // Default - could be calculated from target role
    developmentAreas,
    recommendedCourses,
    recommendedCertifications,
    recommendedProjects,
    timelineMonths
  };
}


