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
    const { careerPathType, identifier, employees } = await req.json();
    
    console.log(`Starting bulk career paths generation: ${careerPathType} - ${identifier}`);
    
    let employeesToProcess;
    
    // Handle two calling patterns: 1) filter by type/identifier, 2) direct employees array
    if (employees && Array.isArray(employees)) {
      employeesToProcess = employees;
      console.log(`Processing ${employees.length} employees directly from array`);
    } else if (careerPathType && identifier) {
      // Get employees based on career path type
      let employeesQuery = supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('is_active', true);

      switch (careerPathType) {
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
          throw new Error('Invalid career path type');
      }

      const { data: employees, error: employeesError } = await employeesQuery;
      if (employeesError) throw employeesError;
      employeesToProcess = employees;
    } else {
      throw new Error('Either provide careerPathType+identifier or employees array');
    }

    if (!employeesToProcess || employeesToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No employees found for the specified criteria' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create career path session with unique identifier
    const sessionId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .insert({
        session_name: `Career Paths ${sessionId}`,
        file_names: [`career_paths_${sessionId}`],
        temp_table_names: [],
        total_rows: employeesToProcess.length,
        status: 'processing',
        created_by: '00000000-0000-0000-0000-000000000000' // System user
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Background processing with EdgeRuntime.waitUntil
    const processCareerPaths = async () => {
      const BATCH_SIZE = 10; // Process 10 employees at a time for career paths (more intensive)
      let processedCount = 0;
      let completedCount = 0;
      let errorCount = 0;

      try {
        for (let i = 0; i < employeesToProcess.length; i += BATCH_SIZE) {
          const batch = employeesToProcess.slice(i, i + BATCH_SIZE);
          
          // Process batch in parallel but with controlled concurrency
          const batchPromises = batch.map(async (employee) => {
            try {
              const careerPath = await generateEmployeeCareerPath(employee);
              
              // Store career path result in AI analysis results table
              await supabase
                .from('ai_analysis_results')
                .insert({
                  analysis_type: 'career_path',
                  function_name: 'employee-career-paths-bulk',
                  input_parameters: {
                    employee_id: employee.id,
                    employee_name: `${employee.first_name} ${employee.last_name}`,
                    current_position: employee.current_position,
                    department: employee.current_department
                  },
                  analysis_result: {
                    lateralRoles: careerPath.lateralRoles,
                    nextRoles: careerPath.nextRoles,
                    requiredSkills: careerPath.requiredSkills,
                    certifications: careerPath.certifications,
                    actionsPlan: careerPath.actionsPlan,
                    recommendations: careerPath.recommendations
                  },
                  created_by: session.created_by,
                  status: 'completed'
                });

              completedCount++;
              return { success: true, employee: employee.id };
            } catch (error) {
              console.error(`Error generating career path for employee ${employee.id}:`, error);
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
                careerPathType,
                identifier
              }
            })
            .eq('id', session.id);

          // Longer delay between batches for career path generation (more intensive)
          await new Promise(resolve => setTimeout(resolve, 3000));
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
              careerPathType,
              identifier,
              completion_time: new Date().toISOString()
            }
          })
          .eq('id', session.id);

        console.log(`Bulk career paths completed: ${completedCount} paths, ${errorCount} errors`);

      } catch (error) {
        console.error('Error in bulk career paths processing:', error);
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
    EdgeRuntime.waitUntil(processCareerPaths());

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      message: `Started bulk career path generation for ${employeesToProcess.length} employees`,
      estimatedDuration: `${Math.ceil(employeesToProcess.length / 10) * 2} minutes`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in employee-career-paths-bulk function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateEmployeeCareerPath(employee: any) {
  if (!liteLLMApiKey) {
    return {
      lateralRoles: [employee.current_position + " (Specialist)"],
      nextRoles: [employee.current_position + " (Advanced)"],
      requiredSkills: ["Leadership", "Communication"],
      certifications: ["Industry Standard Certification"],
      actionsPlan: { lateral: ["Develop expertise"], vertical: ["Lead projects"] },
      recommendations: `Career path unavailable - no LiteLLM API key configured for ${employee.first_name} ${employee.last_name}`
    };
  }

  try {
    const employeeProfile = `
Employee: ${employee.first_name} ${employee.last_name}
Current Position: ${employee.current_position}
Department: ${employee.current_department || 'Not specified'}
Experience: ${employee.years_of_experience || 0} years
Skills: ${Array.isArray(employee.skills) ? employee.skills.join(', ') : employee.skills || 'Not specified'}
Company: ${employee.source_company}
`;

    const prompt = `Generate a comprehensive career path for this employee including lateral and vertical moves.

${employeeProfile}

Create a detailed career progression plan that includes:
1. 2-3 lateral role options (same level, different expertise)
2. 2-3 next level roles (vertical progression)
3. Top 5 skills needed for advancement
4. 2-3 relevant certifications
5. Specific recommended actions for each role transition

Respond with JSON format:
{
  "lateralRoles": ["Role 1", "Role 2"],
  "nextRoles": ["Senior Role 1", "Senior Role 2"],
  "requiredSkills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"],
  "certifications": ["Cert 1", "Cert 2"],
  "actionsPlan": {
    "lateral": ["Action 1 for lateral move", "Action 2 for lateral move"],
    "vertical": ["Action 1 for promotion", "Action 2 for promotion"]
  },
  "recommendations": "Overall career strategy and timeline"
}

Focus on realistic progression within their industry and transferable skills.`;

    console.log('Calling LiteLLM API for employee:', employee.first_name, employee.last_name);
    
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
            content: 'You are an expert career advisor. Respond only with valid JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 800
      }),
    });

    console.log('LiteLLM API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiteLLM API error response:', errorText);
      throw new Error(`LiteLLM API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      console.error('No choices in LiteLLM response:', data);
      throw new Error('No response choices from LiteLLM');
    }
    
    let resultText = data.choices[0].message.content;
    
    // Clean up potential markdown code blocks
    if (resultText.includes('```json')) {
      resultText = resultText.replace(/```json\s*|\s*```/g, '');
    }
    if (resultText.includes('```')) {
      resultText = resultText.replace(/```\s*|\s*```/g, '');
    }
    
    const result = JSON.parse(resultText);

    return {
      lateralRoles: result.lateralRoles || [employee.current_position + " (Specialist)"],
      nextRoles: result.nextRoles || [employee.current_position + " (Senior)"],
      requiredSkills: result.requiredSkills || ["Leadership", "Communication", "Technical Skills"],
      certifications: result.certifications || ["Professional Certification"],
      actionsPlan: result.actionsPlan || { lateral: ["Develop expertise"], vertical: ["Lead projects"] },
      recommendations: result.recommendations || "Continue developing current skills and seek leadership opportunities."
    };

  } catch (error) {
    console.error('Error in AI career path generation:', error);
    return {
      lateralRoles: [employee.current_position + " (Specialist)"],
      nextRoles: [employee.current_position + " (Advanced)"],
      requiredSkills: ["Leadership", "Communication"],
      certifications: ["Industry Certification"],
      actionsPlan: { lateral: ["Develop expertise"], vertical: ["Lead projects"] },
      recommendations: `Error generating career path: ${error.message}`
    };
  }
}