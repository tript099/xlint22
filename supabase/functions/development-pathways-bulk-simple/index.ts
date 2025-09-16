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

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pathwayType, identifier } = await req.json();
    
    console.log(`Starting bulk development pathways: ${pathwayType} - ${identifier}`);
    
    // Get employees based on pathway type
    let employeesQuery = supabase
      .from('xlsmart_employees')
      .select('*')
      .eq('is_active', true);

    switch (pathwayType) {
      case 'company':
        employeesQuery = employeesQuery.eq('source_company', identifier);
        break;
      case 'department':
        employeesQuery = employeesQuery.eq('current_department', identifier);
        break;
      case 'role':
        employeesQuery = employeesQuery.eq('current_position', identifier);
        break;
      default:
        throw new Error('Invalid pathway type');
    }

    const { data: employees, error: employeesError } = await employeesQuery;
    if (employeesError) throw employeesError;

    if (!employees || employees.length === 0) {
      throw new Error(`No employees found for ${pathwayType}: ${identifier}`);
    }

    console.log(`Found ${employees.length} employees to process`);

    // Process employees in smaller batches
    const BATCH_SIZE = 5; // Smaller batch size to avoid timeouts
    let processedCount = 0;
    let completedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      const batch = employees.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (employee) => {
        try {
          const developmentPlan = await generateDevelopmentPathway(employee);
          
          // Save development pathway to database
          const { error: saveError } = await supabase
            .from('ai_analysis_results')
            .insert({
              analysis_type: 'development_pathways',
              function_name: 'development-pathways-bulk-simple',
              input_parameters: { 
                employeeProfile: {
                  name: `${employee.first_name} ${employee.last_name}`,
                  currentPosition: employee.current_position,
                  experienceLevel: employee.years_of_experience ? `${employee.years_of_experience} years` : 'Intermediate',
                  currentSkills: Array.isArray(employee.skills) ? employee.skills.join(', ') : '',
                  careerGoals: 'Career Advancement',
                  preferredLearningStyle: 'Mixed',
                  timeCommitment: '5-10 hours/week',
                  industryFocus: 'Telecommunications'
                }
              },
              analysis_result: {
                developmentPlan: developmentPlan,
                timestamp: new Date().toISOString()
              },
              created_by: '00000000-0000-0000-0000-000000000000',
              status: 'completed'
            });

          if (saveError) {
            console.error(`Error saving development pathway for employee ${employee.id}:`, saveError);
            errorCount++;
            return { success: false, employee: employee.id, error: saveError.message };
          }

          completedCount++;
          console.log(`Completed development pathway for ${employee.first_name} ${employee.last_name}. Total completed: ${completedCount}`);
          return { success: true, employee: employee.id };
        } catch (error) {
          console.error(`Error generating development pathway for employee ${employee.id}:`, error);
          errorCount++;
          return { success: false, employee: employee.id, error: error.message };
        }
      });

      await Promise.all(batchPromises);
      processedCount += batch.length;

      // Small delay between batches
      if (i + BATCH_SIZE < employees.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Bulk development pathways completed: ${completedCount} pathways generated, ${errorCount} errors, Total employees: ${employees.length}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully generated development pathways for ${employees.length} employees`,
      total_processed: employees.length,
      completed: completedCount,
      errors: errorCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in development-pathways-bulk-simple function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateDevelopmentPathway(employee: any) {
  if (!openAIApiKey) {
    return `Development pathway unavailable - no OpenAI API key configured for employee ${employee.first_name} ${employee.last_name}`;
  }

  try {
    const systemPrompt = `You are an expert Career Development and Learning Pathways AI.
Your role is to create personalized development pathways based on employee profiles, career goals, and industry trends.

Guidelines:
- Create structured learning pathways with clear progression steps
- Recommend specific courses, certifications, and skill development activities
- Consider both technical and soft skills development
- Include timeline estimates and prerequisites
- Suggest mentoring and coaching opportunities
- Align recommendations with industry trends and future job market needs
- Provide alternative pathways for different career directions
- Include measurable milestones and success metrics

Format your response as a comprehensive development plan with:
1. Skill Gap Analysis
2. Primary Development Pathway
3. Alternative Career Tracks
4. Learning Resources & Activities
5. Timeline & Milestones
6. Success Metrics
7. Networking & Mentoring Opportunities`;

    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Employee Profile: ${JSON.stringify({
              name: `${employee.first_name} ${employee.last_name}`,
              currentPosition: employee.current_position,
              experienceLevel: employee.years_of_experience ? `${employee.years_of_experience} years` : 'Intermediate',
              currentSkills: Array.isArray(employee.skills) ? employee.skills.join(', ') : '',
              careerGoals: 'Career Advancement',
              preferredLearningStyle: 'Mixed',
              timeCommitment: '5-10 hours/week',
              industryFocus: 'Telecommunications'
            })}
Current Skills: ${Array.isArray(employee.skills) ? employee.skills.join(', ') : 'Not specified'}
Industry Trends: Consider current trends in telecommunications industry

Please create a comprehensive development pathway plan for this employee.`
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error('Error generating development pathway:', error);
    return `Error generating development pathway: ${error.message}`;
  }
}


