import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting conversion of AI analysis results to structured development plans');

    // Get all AI analysis results for development pathways
    const { data: aiResults, error: fetchError } = await supabase
      .from('ai_analysis_results')
      .select('*')
      .eq('analysis_type', 'development_pathways')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    if (!aiResults || aiResults.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No AI analysis results found to convert',
        converted: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${aiResults.length} AI analysis results to convert`);

    let convertedCount = 0;
    let errorCount = 0;

    // Process each AI result
    for (const aiResult of aiResults) {
      try {
        // Extract employee information from input parameters
        const inputParams = aiResult.input_parameters;
        const employeeProfile = inputParams?.employeeProfile;
        
        if (!employeeProfile?.name) {
          console.log(`Skipping AI result ${aiResult.id} - no employee name found`);
          continue;
        }

        // Find the employee in the database
        const nameParts = employeeProfile.name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        const { data: employee, error: employeeError } = await supabase
          .from('xlsmart_employees')
          .select('id')
          .eq('first_name', firstName)
          .eq('last_name', lastName)
          .eq('is_active', true)
          .single();

        if (employeeError || !employee) {
          console.log(`Employee not found for ${employeeProfile.name}, creating placeholder`);
          // Create a placeholder employee or skip
          continue;
        }

        // Check if development plan already exists for this employee
        const { data: existingPlan } = await supabase
          .from('xlsmart_development_plans')
          .select('id')
          .eq('employee_id', employee.id)
          .eq('plan_status', 'active')
          .single();

        if (existingPlan) {
          console.log(`Development plan already exists for employee ${employee.id}`);
          continue;
        }

        // Parse the AI development plan text
        const developmentPlanText = aiResult.analysis_result?.developmentPlan || '';
        const structuredData = parseDevelopmentPlan(developmentPlanText, employeeProfile);

        // Create structured development plan
        const { error: insertError } = await supabase
          .from('xlsmart_development_plans')
          .insert({
            employee_id: employee.id,
            target_role: employeeProfile.careerGoals || employeeProfile.currentPosition || 'Career Advancement',
            current_skill_level: structuredData.currentSkillLevel,
            target_skill_level: structuredData.targetSkillLevel,
            development_areas: structuredData.developmentAreas,
            recommended_courses: structuredData.recommendedCourses,
            recommended_certifications: structuredData.recommendedCertifications,
            recommended_projects: structuredData.recommendedProjects,
            timeline_months: structuredData.timelineMonths,
            progress_percentage: 0, // Start at 0%
            plan_status: 'active',
            created_by: aiResult.created_by || '00000000-0000-0000-0000-000000000000',
            assigned_to: employee.id
          });

        if (insertError) {
          console.error(`Error creating development plan for employee ${employee.id}:`, insertError);
          errorCount++;
        } else {
          convertedCount++;
          console.log(`Successfully created development plan for employee ${employee.id}`);
        }

      } catch (error) {
        console.error(`Error processing AI result ${aiResult.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Conversion completed: ${convertedCount} plans created, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully converted ${convertedCount} AI analysis results to structured development plans`,
      converted: convertedCount,
      errors: errorCount,
      total: aiResults.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in convert-ai-to-development-plans function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to parse AI-generated development plan text into structured data
function parseDevelopmentPlan(planText: string, employeeProfile: any): {
  currentSkillLevel: number;
  targetSkillLevel: number;
  developmentAreas: string[];
  recommendedCourses: any[];
  recommendedCertifications: any[];
  recommendedProjects: any[];
  timelineMonths: number;
} {
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
  const areaKeywords = ['Technical', 'Leadership', 'Communication', 'Project Management', 'Industry Knowledge', 'Soft Skills', 'Hard Skills'];
  areaKeywords.forEach(keyword => {
    if (planText.toLowerCase().includes(keyword.toLowerCase())) {
      developmentAreas.push(keyword);
    }
  });
  
  // Extract courses and certifications
  const courseKeywords = ['training', 'course', 'workshop', 'program', 'learning'];
  const certKeywords = ['certification', 'certificate', 'certified', 'cert'];
  
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
  
  // Calculate skill levels based on experience
  const experience = employeeProfile.experienceLevel || 'Intermediate';
  let currentSkillLevel = 3.0;
  let targetSkillLevel = 4.5;
  
  if (experience.toLowerCase().includes('senior') || experience.toLowerCase().includes('expert')) {
    currentSkillLevel = 4.0;
    targetSkillLevel = 5.0;
  } else if (experience.toLowerCase().includes('junior') || experience.toLowerCase().includes('entry')) {
    currentSkillLevel = 2.0;
    targetSkillLevel = 3.5;
  }
  
  return {
    currentSkillLevel,
    targetSkillLevel,
    developmentAreas,
    recommendedCourses,
    recommendedCertifications,
    recommendedProjects,
    timelineMonths
  };
}


