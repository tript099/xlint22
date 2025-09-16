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

    // Create or get existing development session
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionName = `Bulk Development Pathways - ${pathwayType.toUpperCase()}: ${identifier} - ${timestamp}`;
    const systemUserId = '00000000-0000-0000-0000-000000000000';
    
    // First, try to find existing session
    let { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .select('*')
      .eq('session_name', sessionName)
      .eq('created_by', systemUserId)
      .single();

    // If no existing session, create a new one
    if (sessionError && sessionError.code === 'PGRST116') {
      const { data: newSession, error: createError } = await supabase
        .from('xlsmart_upload_sessions')
        .insert({
          session_name: sessionName,
          file_names: [`development_pathways_${pathwayType}`],
          temp_table_names: [],
          total_rows: employees.length,
          status: 'processing',
          created_by: systemUserId
        })
        .select()
        .single();

      if (createError) throw createError;
      session = newSession;
    } else if (sessionError) {
      throw sessionError;
    }

    // Background processing with EdgeRuntime.waitUntil
    const processDevelopmentPathways = async () => {
      const BATCH_SIZE = 15; // Process 15 employees at a time for development planning
      let processedCount = 0;
      let completedCount = 0;
      let errorCount = 0;

      try {
        for (let i = 0; i < employees.length; i += BATCH_SIZE) {
          const batch = employees.slice(i, i + BATCH_SIZE);
          
          // Process batch in parallel but with controlled concurrency
          const batchPromises = batch.map(async (employee) => {
            try {
              console.log(`Processing development pathway for employee: ${employee.first_name} ${employee.last_name} (ID: ${employee.id})`);
              const developmentPlan = await generateDevelopmentPathway(employee);
              
              // Store development plan result in AI analysis results table
              await supabase
                .from('ai_analysis_results')
                .insert({
                  analysis_type: 'development_pathways',
                  function_name: 'development-pathways-bulk',
                  input_parameters: {
                    employee_id: employee.id,
                    employee_name: `${employee.first_name} ${employee.last_name}`,
                    current_position: employee.current_position,
                    department: employee.current_department,
                    experience: employee.years_of_experience
                  },
                  analysis_result: {
                    developmentPlan: developmentPlan,
                    timestamp: new Date().toISOString()
                  },
                  created_by: '00000000-0000-0000-0000-000000000000',
                  status: 'completed'
                });

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

          // Update progress
          await supabase
            .from('xlsmart_upload_sessions')
            .update({
              ai_analysis: {
                processed: processedCount,
                completed: completedCount,
                errors: errorCount,
                total: employees.length,
                pathwayType,
                identifier
              }
            })
            .eq('id', session.id);

          // Small delay between batches to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Mark session as completed
        await supabase
          .from('xlsmart_upload_sessions')
          .update({
            status: 'completed',
            ai_analysis: {
              processed: processedCount,
              completed: completedCount,
              errors: errorCount,
              total: employees.length,
              pathwayType,
              identifier,
              completion_time: new Date().toISOString()
            }
          })
          .eq('id', session.id);

        console.log(`Bulk development pathways completed: ${completedCount} pathways generated, ${errorCount} errors, Total employees: ${employees.length}`);

      } catch (error) {
        console.error('Error in bulk development pathways processing:', error);
        await supabase
          .from('xlsmart_upload_sessions')
          .update({
            status: 'error',
            error_message: error.message
          })
          .eq('id', session.id);
      }
    };

    // Start background processing
    EdgeRuntime.waitUntil(processDevelopmentPathways());

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      message: `Started bulk development pathways for ${employees.length} employees`,
      estimatedDuration: `${Math.ceil(employees.length / 15)} minutes`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in development-pathways-bulk function:', error);
    return new Response(JSON.stringify({ 
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
    const employeeProfile = `
Employee: ${employee.first_name} ${employee.last_name}
Current Position: ${employee.current_position}
Department: ${employee.current_department || 'Not specified'}
Experience: ${employee.years_of_experience || 0} years
Skills: ${Array.isArray(employee.skills) ? employee.skills.join(', ') : employee.skills || 'Not specified'}
Certifications: ${Array.isArray(employee.certifications) ? employee.certifications.join(', ') : employee.certifications || 'Not specified'}
Company: ${employee.source_company}
`;

    const prompt = `Create a comprehensive development pathway for this employee.

${employeeProfile}

Generate a detailed development plan that includes:
1. Current skill assessment and strengths
2. Skill gaps identification for career advancement
3. Recommended learning resources (courses, certifications, books)
4. Hands-on project suggestions
5. Mentoring and networking opportunities
6. Short-term goals (3-6 months)
7. Medium-term goals (6-12 months)
8. Long-term career progression (1-2 years)
9. Success metrics and milestones

Focus on practical, actionable development steps that align with current industry trends and the employee's career trajectory.`;

    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert career development coach and learning specialist who creates personalized development pathways for employees.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1200
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error('Error in AI development pathway generation:', error);
    return `Error generating development pathway: ${error.message}`;
  }
}