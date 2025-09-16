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
    console.log('Employee role assignment function started - v5');
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    
    console.log(`Starting AI role assignment for session: ${sessionId}`);
    console.log(`OpenAI API key configured: ${openAIApiKey ? 'Yes' : 'No'}`);
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured in environment variables');
    }
    
    // Get the session details
    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error(`Session not found: ${sessionError.message}`);
    }

    console.log('Session found:', session.session_name);

    // Get ALL unassigned employees for this user (not just from this session)
    const { data: employees, error: employeesError } = await supabase
      .from('xlsmart_employees')
      .select('*')
      .eq('uploaded_by', session.created_by)
      .is('standard_role_id', null); // Get employees without assigned roles

    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      throw new Error(`Failed to fetch employees: ${employeesError.message}`);
    }

    if (!employees || employees.length === 0) {
      throw new Error('No unassigned employees found for this user');
    }

    console.log(`Found ${employees.length} unassigned employees`);

    // Get existing standard roles with job descriptions for AI matching
    const { data: standardRoles, error: rolesError } = await supabase
      .from('xlsmart_standard_roles')
      .select(`
        *,
        job_descriptions:xlsmart_job_descriptions(
          title,
          summary,
          responsibilities,
          required_qualifications,
          required_skills,
          experience_level
        )
      `)
      .eq('is_active', true);

    if (rolesError) {
      console.error('Roles error:', rolesError);
      throw new Error(`Failed to fetch standard roles: ${rolesError.message}`);
    }

    if (!standardRoles || standardRoles.length === 0) {
      throw new Error('No standard roles available for assignment');
    }

    console.log(`Found ${standardRoles.length} standard roles`);

    // Update session status to indicate role assignment started
    await supabase
      .from('xlsmart_upload_sessions')
      .update({ 
        status: 'assigning_roles',
        ai_analysis: {
          processed: 0,
          assigned: 0,
          errors: 0,
          total: employees.length
        }
      })
      .eq('id', sessionId);

    // Process employees synchronously for reliability
    const BATCH_SIZE = 5; // Smaller batches for better reliability
    let processedCount = 0;
    let assignedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      const batch = employees.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(employees.length/BATCH_SIZE)}`);
      
      for (const employee of batch) {
        try {
          console.log(`Processing employee: ${employee.first_name} ${employee.last_name}`);
          
          // Use AI to get role suggestion and assign it directly
          const suggestedRoleId = await assignRoleWithAI(employee, standardRoles);
          
          if (suggestedRoleId) {
            // Directly assign the role (not just suggest)
            const { error: updateError } = await supabase
              .from('xlsmart_employees')
              .update({ 
                standard_role_id: suggestedRoleId,
                ai_suggested_role_id: suggestedRoleId,
                role_assignment_status: 'ai_suggested',
                assigned_by: session.created_by,
                assignment_notes: 'Assigned by AI'
              })
              .eq('id', employee.id);

            if (updateError) {
              console.error('Error assigning role to employee:', updateError);
              errorCount++;
              errors.push(`${employee.first_name} ${employee.last_name}: ${updateError.message}`);
            } else {
              assignedCount++;
              console.log(`Successfully assigned role to ${employee.first_name} ${employee.last_name}`);
            }
          } else {
            console.log(`No suitable role found for ${employee.first_name} ${employee.last_name}`);
            // Update status to indicate AI couldn't find a match
            await supabase
              .from('xlsmart_employees')
              .update({ 
                role_assignment_status: 'pending',
                assignment_notes: 'AI could not find suitable role match'
              })
              .eq('id', employee.id);
          }
          
          processedCount++;

        } catch (employeeError) {
          console.error('Error processing employee for role assignment:', employeeError);
          errorCount++;
          errors.push(`${employee.first_name} ${employee.last_name}: ${employeeError.message}`);
          processedCount++;
        }

        // Update progress after each employee
        await supabase
          .from('xlsmart_upload_sessions')
          .update({
            ai_analysis: {
              processed: processedCount,
              assigned: assignedCount,
              errors: errorCount,
              total: employees.length,
              error_details: errors.slice(-10) // Keep last 10 errors
            }
          })
          .eq('id', sessionId);
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < employees.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Mark session as completed
    const finalStatus = errorCount === 0 ? 'roles_assigned' : 
                       assignedCount > 0 ? 'roles_assigned' : 'failed';
    
    await supabase
      .from('xlsmart_upload_sessions')
      .update({
        status: finalStatus,
        ai_analysis: {
          processed: processedCount,
          assigned: assignedCount,
          errors: errorCount,
          total: employees.length,
          completion_time: new Date().toISOString(),
          error_details: errors
        }
      })
      .eq('id', sessionId);

    console.log(`AI role assignment completed: ${assignedCount} assigned, ${errorCount} errors out of ${processedCount} processed`);

    return new Response(JSON.stringify({
      success: true,
      sessionId: sessionId,
      processed: processedCount,
      assigned: assignedCount,
      errors: errorCount,
      total: employees.length,
      message: errorCount === 0 ? 
        `Successfully assigned roles to ${assignedCount} employees` :
        `Assigned roles to ${assignedCount} employees with ${errorCount} errors`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Critical error in employee-role-assignment function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function assignRoleWithAI(employee: any, standardRoles: any[]) {
  console.log(`Processing AI role assignment for: ${employee.first_name} ${employee.last_name}`);
  
  try {
    const employeeSkills = Array.isArray(employee.skills) ? employee.skills.join(', ') : employee.skills || '';
    const employeeCerts = Array.isArray(employee.certifications) ? employee.certifications.join(', ') : employee.certifications || '';
    
    // Extract aspirations and location from skills if they were stored there
    let aspirations = '';
    let location = '';
    if (Array.isArray(employee.skills)) {
      const aspirationsSkill = employee.skills.find((s: string) => s.startsWith('Aspirations:'));
      const locationSkill = employee.skills.find((s: string) => s.startsWith('Location:'));
      if (aspirationsSkill) aspirations = aspirationsSkill.replace('Aspirations:', '').trim();
      if (locationSkill) location = locationSkill.replace('Location:', '').trim();
    }

    const formatRole = (role: any) => {
      const jd = role.job_descriptions?.[0];
      const responsibilities = Array.isArray(jd?.responsibilities) ? jd.responsibilities.slice(0, 3).join('; ') : '';
      const requiredSkills = Array.isArray(jd?.required_skills) ? jd.required_skills.join(', ') : '';
      const coreSkills = Array.isArray(role.required_skills) ? role.required_skills.join(', ') : '';
      
      return `- ID: ${role.id}
  Title: ${role.role_title}
  Family: ${role.job_family}
  Level: ${role.role_level}
  Category: ${role.role_category}
  Department: ${role.department}
  Experience Range: ${role.experience_range_min}-${role.experience_range_max} years
  Key Skills: ${coreSkills || requiredSkills}
  Main Duties: ${responsibilities || jd?.summary || role.standard_description || 'Not specified'}`;
    };

    const prompt = `You are an expert HR system that assigns employees to the most appropriate standard roles. Analyze this employee profile and find the BEST MATCHING standard role from the available options.

Employee Profile:
- Employee ID: ${employee.employee_number}
- Name: ${employee.first_name} ${employee.last_name}
- Current Position: ${employee.current_position}
- Department: ${employee.current_department}
- Level: ${employee.current_level}
- Experience: ${employee.years_of_experience} years
- Skills: ${employeeSkills}
- Certifications: ${employeeCerts}
- Performance Rating: ${employee.performance_rating || 'N/A'}
- Aspirations: ${aspirations || 'N/A'}
- Location: ${location || 'N/A'}

Available Standard Roles (with job descriptions):
${standardRoles.map(formatRole).join('\n\n')}

ANALYSIS CRITERIA:
1. **Skills Match**: Compare employee skills with role requirements and job description skills
2. **Experience Level**: Match years of experience with role level expectations
3. **Responsibilities Alignment**: Compare current position with role duties
4. **Department Alignment**: Prefer roles in same/similar departments
5. **Career Progression**: Consider employee aspirations and growth path

INSTRUCTIONS:
- You MUST select ONE of the provided standard role IDs
- Choose the role with the highest overall match score
- Consider both current fit and growth potential
- Return ONLY the UUID of the selected role
- If truly no role fits (very rare), return "NO_MATCH"

Return only the UUID:`;

    console.log('Calling LiteLLM proxy for role assignment...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
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
            content: 'You are an expert HR system that assigns employees to the most appropriate standard roles. You must analyze employee profiles and match them to existing standard roles based on skills, experience, and career fit. Always return only a valid role UUID from the provided list.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 150
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log(`LiteLLM proxy response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LiteLLM proxy error: ${response.statusText} - ${errorText}`);
      throw new Error(`LiteLLM proxy error: ${response.statusText}`);
    }

    const data = await response.json();
    const assignedRoleId = data.choices[0].message.content.trim();
    
    if (assignedRoleId !== "NO_MATCH" && assignedRoleId.length === 36) { // UUID format check
      // Verify the role ID exists in our standard roles
      const roleExists = standardRoles.find(role => role.id === assignedRoleId);
      if (roleExists) {
        console.log(`AI selected role "${roleExists.role_title}" (${assignedRoleId}) for employee ${employee.first_name} ${employee.last_name}`);
        return assignedRoleId;
      } else {
        console.log(`Invalid role ID returned by AI: ${assignedRoleId}`);
        return null;
      }
    }
    
    console.log(`AI found no suitable role for employee ${employee.first_name} ${employee.last_name}`);
    return null;
  } catch (error) {
    console.error('Error in AI role assignment:', error);
    return null;
  }
}