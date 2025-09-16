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

const liteLLMApiKey = Deno.env.get('LITELLM_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planningType, identifier, employees } = await req.json();
    
    console.log(`Starting bulk mobility planning: ${planningType} - ${identifier}`);
    
    let employeesToProcess;
    
    // Handle two calling patterns: 1) filter by type/identifier, 2) direct employees array
    if (employees && Array.isArray(employees)) {
      employeesToProcess = employees;
      console.log(`Processing ${employees.length} employees directly from array`);
    } else if (planningType && identifier) {
      // Get employees based on planning type
      let employeesQuery = supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('is_active', true);

      switch (planningType) {
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
          throw new Error('Invalid planning type');
      }

      const { data: employees, error: employeesError } = await employeesQuery;
      if (employeesError) throw employeesError;
      employeesToProcess = employees;
    } else {
      throw new Error('Either provide planningType+identifier or employees array');
    }

    if (!employeesToProcess || employeesToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No employees found for the specified criteria' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create planning session - first delete any existing processing sessions for this user
    const { error: deleteError } = await supabase
      .from('xlsmart_upload_sessions')
      .delete()
      .eq('created_by', '00000000-0000-0000-0000-000000000000')
      .eq('status', 'processing');

    if (deleteError) {
      console.log('Note: Could not delete existing sessions:', deleteError.message);
    }

    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .insert({
        session_name: `Bulk Mobility Planning - ${planningType ? planningType.toUpperCase() + ': ' + identifier : 'Direct employees'} - ${Date.now()}`,
        file_names: [`mobility_planning_${planningType || 'direct'}`],
        temp_table_names: [],
        total_rows: employeesToProcess.length,
        status: 'processing',
        created_by: '00000000-0000-0000-0000-000000000000' // System user
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Background processing with EdgeRuntime.waitUntil
    const processMobilityPlans = async () => {
      const BATCH_SIZE = 15; // Process 15 employees at a time for mobility planning
      let processedCount = 0;
      let completedCount = 0;
      let errorCount = 0;

      try {
        for (let i = 0; i < employeesToProcess.length; i += BATCH_SIZE) {
          const batch = employeesToProcess.slice(i, i + BATCH_SIZE);
          
          // Process batch in parallel but with controlled concurrency
          const batchPromises = batch.map(async (employee) => {
            try {
              console.log(`Processing mobility plan for employee: ${employee.first_name} ${employee.last_name} (ID: ${employee.id})`);
              const mobilityPlan = await generateMobilityPlan(employee);
              
              // Store mobility plan result in AI analysis results table
              await supabase
                .from('ai_analysis_results')
                .insert({
                  analysis_type: 'mobility_plan',
                  function_name: 'employee-mobility-planning-bulk',
                  input_parameters: {
                    employee_id: employee.id,
                    employee_name: `${employee.first_name} ${employee.last_name}`,
                    current_position: employee.current_position,
                    department: employee.current_department,
                    experience: employee.years_of_experience,
                    performance_rating: employee.performance_rating
                  },
                  analysis_result: {
                    mobilityPlan: mobilityPlan,
                    timestamp: new Date().toISOString()
                  },
                  created_by: '00000000-0000-0000-0000-000000000000',
                  status: 'completed'
                });

              completedCount++;
              console.log(`Completed mobility plan for ${employee.first_name} ${employee.last_name}. Total completed: ${completedCount}`);
              return { success: true, employee: employee.id };
            } catch (error) {
              console.error(`Error generating mobility plan for employee ${employee.id}:`, error);
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
                total: employeesToProcess.length,
                planningType,
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
              total: employeesToProcess.length,
              planningType,
              identifier,
              completion_time: new Date().toISOString()
            }
          })
          .eq('id', session.id);

        console.log(`Bulk mobility planning completed: ${completedCount} plans generated, ${errorCount} errors, Total employees: ${employeesToProcess.length}`);

      } catch (error) {
        console.error('Error in bulk mobility planning processing:', error);
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
    EdgeRuntime.waitUntil(processMobilityPlans());

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      message: `Started bulk mobility planning for ${employeesToProcess.length} employees`,
      estimatedDuration: `${Math.ceil(employeesToProcess.length / 15)} minutes`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in employee-mobility-planning-bulk function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateMobilityPlan(employee: any) {
  if (!liteLLMApiKey) {
    return `Mobility planning unavailable - no LiteLLM API key configured for employee ${employee.first_name} ${employee.last_name}`;
  }

    console.log(`Generating mobility plan for employee: ${employee.first_name} ${employee.last_name}`);
    try {
const employeeProfile = `
Current Position: ${employee.current_position}
Department: ${employee.current_department || 'Not specified'}
Experience: ${employee.years_of_experience || 0} years
Skills: ${Array.isArray(employee.skills) ? employee.skills.join(', ') : employee.skills || 'Not specified'}
Company: ${employee.source_company}
Performance Rating: ${employee.performance_rating || 'Not specified'}
`;

    const prompt = `Generate a comprehensive employee mobility plan for this employee.

${employeeProfile}

Create a detailed mobility plan that includes:
1. Current role assessment and strengths
2. Potential internal mobility opportunities (lateral and vertical)
3. Skill gaps to fill for target roles
4. Recommended timeline for mobility (6-month, 1-year, 2-year goals)
5. Specific action items and milestones
6. Mentoring and development recommendations
7. Risk assessment for retention

Focus on realistic career progression within the organization and provide actionable steps.`;

    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${liteLLMApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert HR consultant specializing in employee mobility and career development within organizations.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1200
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error('Error in AI mobility planning:', error);
    return `Error generating mobility plan: ${error.message}`;
  }
}