import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { employeeIds, assignImmediately = true } = await req.json();

    console.log(`Starting AI role assignment for ${employeeIds?.length || 0} employees`);

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      throw new Error('Employee IDs array is required');
    }

    // Get OpenAI API key for LiteLLM proxy
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Get employees
    const { data: employees, error: employeesError } = await supabase
      .from('xlsmart_employees')
      .select('*')
      .in('id', employeeIds)
      .is('standard_role_id', null);

    if (employeesError) {
      throw new Error(`Failed to fetch employees: ${employeesError.message}`);
    }

    if (!employees || employees.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No unassigned employees found',
        processed: 0,
        assigned: 0,
        errors: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get standard roles with job descriptions
    const { data: standardRoles, error: rolesError } = await supabase
      .from('xlsmart_standard_roles')
      .select('*')
      .eq('is_active', true);

    if (rolesError) {
      throw new Error(`Failed to fetch standard roles: ${rolesError.message}`);
    }

    if (!standardRoles || standardRoles.length === 0) {
      throw new Error('No standard roles available');
    }

    // Get job descriptions for additional context
    const { data: jobDescriptions, error: jdError } = await supabase
      .from('xlsmart_job_descriptions')
      .select('*')
      .eq('status', 'approved');

    if (jdError) {
      console.warn('Failed to fetch job descriptions:', jdError.message);
    }

    // Create a map of role IDs to job descriptions
    const jdMap = new Map();
    if (jobDescriptions) {
      jobDescriptions.forEach(jd => {
        if (jd.standard_role_id) {
          jdMap.set(jd.standard_role_id, jd);
        }
      });
    }

    console.log(`Processing ${employees.length} employees with ${standardRoles.length} standard roles`);

    let assigned = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Process each employee
    for (const employee of employees) {
      try {
        console.log(`Processing employee: ${employee.first_name} ${employee.last_name}`);
        
        const suggestedRoleId = await assignRoleWithAI(employee, standardRoles, jdMap, openAIApiKey);
        
        if (suggestedRoleId && assignImmediately) {
          const { error: updateError } = await supabase
            .from('xlsmart_employees')
            .update({
              standard_role_id: suggestedRoleId,
              ai_suggested_role_id: suggestedRoleId,
              role_assignment_status: 'ai_suggested',
              assigned_by: employee.uploaded_by,
              assignment_notes: 'Assigned by AI'
            })
            .eq('id', employee.id);

          if (updateError) {
            console.error(`Error assigning role to employee ${employee.id}:`, updateError);
            errors++;
            errorDetails.push(`${employee.first_name} ${employee.last_name}: ${updateError.message}`);
          } else {
            assigned++;
            console.log(`Successfully assigned role to ${employee.first_name} ${employee.last_name}`);
          }
        } else if (!suggestedRoleId) {
          // Update status to indicate AI couldn't find a match
          await supabase
            .from('xlsmart_employees')
            .update({
              role_assignment_status: 'pending',
              assignment_notes: 'AI could not find suitable role match'
            })
            .eq('id', employee.id);
          
          console.log(`No suitable role found for ${employee.first_name} ${employee.last_name}`);
        }
      } catch (error) {
        console.error(`Error processing employee ${employee.id}:`, error);
        errors++;
        errorDetails.push(`${employee.first_name} ${employee.last_name}: ${error.message}`);
      }
    }

    console.log(`AI assignment completed: ${assigned} assigned, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed: employees.length,
      assigned,
      errors,
      message: `Processed ${employees.length} employees: ${assigned} assigned, ${errors} errors`,
      errorDetails: errorDetails.slice(0, 5) // Limit error details
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI employee assignment:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: `Critical error: ${error.message}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function assignRoleWithAI(employee: any, standardRoles: any[], jdMap: Map<string, any>, apiKey: string) {
  try {
    const employeeSkills = Array.isArray(employee.skills) ? employee.skills.join(', ') : employee.skills || '';
    const employeeCerts = Array.isArray(employee.certifications) ? employee.certifications.join(', ') : employee.certifications || '';
    
    const formatRole = (role: any) => {
      const coreSkills = Array.isArray(role.required_skills) ? role.required_skills.join(', ') : '';
      const responsibilities = Array.isArray(role.core_responsibilities) ? role.core_responsibilities.slice(0, 3).join('; ') : '';
      
      // Get job description if available
      const jobDesc = jdMap.get(role.id);
      const jdInfo = jobDesc ? `
  JD Summary: ${jobDesc.summary || 'Not specified'}
  Required Skills: ${Array.isArray(jobDesc.required_skills) ? jobDesc.required_skills.join(', ') : ''}
  Responsibilities: ${Array.isArray(jobDesc.responsibilities) ? jobDesc.responsibilities.slice(0, 3).join('; ') : ''}` : '';
      
      return `${role.id} | ${role.role_title} | ${role.job_family} | ${role.role_level} | ${role.department}
  Experience: ${role.experience_range_min}-${role.experience_range_max} years
  Key Skills: ${coreSkills}
  Standard Responsibilities: ${responsibilities || role.standard_description || 'Not specified'}${jdInfo}`;
    };

    const prompt = `You are an expert HR system that assigns employees to the most appropriate standard roles. 

Employee Profile:
- Name: ${employee.first_name} ${employee.last_name}
- Current Position: ${employee.current_position}
- Department: ${employee.current_department || 'N/A'}
- Level: ${employee.current_level || 'N/A'}
- Experience: ${employee.years_of_experience || 0} years
- Skills: ${employeeSkills}
- Certifications: ${employeeCerts}

Available Standard Roles (with detailed info):
${standardRoles.map(formatRole).join('\n\n')}

Find the BEST MATCHING role ID by analyzing:
1. Skills match (employee skills vs required role skills)
2. Experience level compatibility (years of experience)
3. Job responsibilities alignment
4. Job title and department similarity

Respond with ONLY the UUID of the best matching role, or "NO_MATCH" if no suitable role exists.`;

    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert HR system that assigns employees to standard roles. Always return only a valid role UUID from the provided list.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 150
      }),
    });

    if (!response.ok) {
      throw new Error(`LiteLLM API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('LiteLLM API response:', JSON.stringify(data, null, 2));
    const assignedRoleId = data.choices[0].message.content.trim();
    
    console.log(`AI suggested role ID: "${assignedRoleId}" for employee ${employee.first_name} ${employee.last_name}`);
    
    if (assignedRoleId === "NO_MATCH") {
      console.log(`AI explicitly said NO_MATCH for employee ${employee.first_name} ${employee.last_name}`);
      return null;
    }
    
    // Try to find the role ID in our list (be more flexible with matching)
    const roleExists = standardRoles.find(role => 
      role.id === assignedRoleId || 
      role.id.includes(assignedRoleId.trim()) ||
      assignedRoleId.includes(role.id)
    );
    
    if (roleExists) {
      console.log(`AI selected role "${roleExists.role_title}" for employee ${employee.first_name} ${employee.last_name}`);
      return roleExists.id;
    } else {
      console.log(`AI suggested invalid role ID: "${assignedRoleId}". Available role IDs: ${standardRoles.map(r => r.id).join(', ')}`);
      // Fallback: assign the first role that matches the employee's general area
      const fallbackRole = standardRoles.find(role => 
        role.role_title.toLowerCase().includes(employee.current_position.toLowerCase().split(' ')[0]) ||
        employee.current_position.toLowerCase().includes(role.role_title.toLowerCase().split(' ')[0])
      );
      if (fallbackRole) {
        console.log(`Fallback assignment: "${fallbackRole.role_title}" for employee ${employee.first_name} ${employee.last_name}`);
        return fallbackRole.id;
      }
    }
    
    console.log(`AI found no suitable role for employee ${employee.first_name} ${employee.last_name}`);
    return null;
  } catch (error) {
    console.error('Error in AI role assignment:', error);
    return null;
  }
}