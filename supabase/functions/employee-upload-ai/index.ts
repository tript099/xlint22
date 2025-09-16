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
    const { employees, sessionName } = await req.json();
    
    console.log(`Starting employee upload for ${employees.length} employees`);
    
    // Create upload session
    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .insert({
        session_name: sessionName,
        file_names: employees.map((emp: any) => emp.sourceFile || 'bulk_upload').filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index),
        temp_table_names: [],
        total_rows: employees.length,
        status: 'processing',
        created_by: '00000000-0000-0000-0000-000000000000' // System user
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Process employees in batches to avoid timeouts
    const BATCH_SIZE = 100;
    let processedCount = 0;
    let assignedCount = 0;
    let errorCount = 0;

    // Get existing standard roles for AI matching
    const { data: standardRoles } = await supabase
      .from('xlsmart_standard_roles')
      .select('*')
      .eq('is_active', true);

    // Background processing with EdgeRuntime.waitUntil
    const processEmployees = async () => {
      for (let i = 0; i < employees.length; i += BATCH_SIZE) {
        const batch = employees.slice(i, i + BATCH_SIZE);
        
        try {
          // Process each employee in the batch
          for (const employee of batch) {
            try {
              // Normalize employee data
              const normalizedEmployee = {
                employee_number: employee['Employee Number'] || employee['EmployeeID'] || employee['ID'] || `EMP${Date.now()}${Math.random()}`,
                source_company: employee['Company'] || employee['Organization'] || 'Unknown',
                first_name: employee['First Name'] || employee['FirstName'] || employee['Name']?.split(' ')[0] || 'Unknown',
                last_name: employee['Last Name'] || employee['LastName'] || employee['Name']?.split(' ').slice(1).join(' ') || '',
                email: employee['Email'] || employee['EmailAddress'] || `${employee['Employee Number'] || 'unknown'}@company.com`,
                phone: employee['Phone'] || employee['PhoneNumber'] || employee['Mobile'] || '',
                current_position: employee['Position'] || employee['Job Title'] || employee['Role'] || 'Unknown',
                current_department: employee['Department'] || employee['Division'] || '',
                current_level: employee['Level'] || employee['Grade'] || '',
                years_of_experience: parseInt(employee['Experience'] || employee['Years of Experience'] || '0') || 0,
                salary: parseFloat(employee['Salary'] || employee['Annual Salary'] || '0') || null,
                skills: Array.isArray(employee['Skills']) ? employee['Skills'] : 
                       typeof employee['Skills'] === 'string' ? employee['Skills'].split(',').map((s: string) => s.trim()) : [],
                certifications: Array.isArray(employee['Certifications']) ? employee['Certifications'] : 
                               typeof employee['Certifications'] === 'string' ? employee['Certifications'].split(',').map((c: string) => c.trim()) : [],
                currency: employee['Currency'] || 'IDR',
                uploaded_by: session.created_by
              };

              // Use AI to assign role if standard roles exist
              let assignedRole = null;
              if (standardRoles && standardRoles.length > 0) {
                const roleAssignment = await assignRoleWithAI(normalizedEmployee, standardRoles);
                assignedRole = roleAssignment;
              }

              // Insert employee into xlsmart_employees table
              const { error: insertError } = await supabase
                .from('xlsmart_employees')
                .insert(normalizedEmployee);

              if (insertError) {
                console.error('Error inserting employee:', insertError);
                errorCount++;
              } else {
                if (assignedRole) {
                  assignedCount++;
                }
                processedCount++;
              }

            } catch (employeeError) {
              console.error('Error processing employee:', employeeError);
              errorCount++;
            }
          }

          // Update progress
          await supabase
            .from('xlsmart_upload_sessions')
            .update({
              ai_analysis: {
                processed: processedCount,
                assigned: assignedCount,
                errors: errorCount,
                total: employees.length
              }
            })
            .eq('id', session.id);

        } catch (batchError) {
          console.error('Error processing batch:', batchError);
          errorCount += batch.length;
        }
      }

      // Mark session as completed
      await supabase
        .from('xlsmart_upload_sessions')
        .update({
          status: 'completed',
          ai_analysis: {
            processed: processedCount,
            assigned: assignedCount,
            errors: errorCount,
            total: employees.length,
            completion_time: new Date().toISOString()
          }
        })
        .eq('id', session.id);

      console.log(`Employee upload completed: ${processedCount} processed, ${assignedCount} assigned, ${errorCount} errors`);
    };

    // Start background processing
    EdgeRuntime.waitUntil(processEmployees());

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      message: `Started processing ${employees.length} employees`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in employee-upload-ai function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function assignRoleWithAI(employee: any, standardRoles: any[]) {
  if (!openAIApiKey) {
    console.log('No OpenAI API key, skipping AI role assignment');
    return null;
  }

  try {
    const prompt = `Analyze this employee profile and assign the most suitable role from the available standard roles.

Employee Profile:
- Position: ${employee.current_position}
- Department: ${employee.current_department}
- Level: ${employee.current_level}
- Experience: ${employee.years_of_experience} years
- Skills: ${Array.isArray(employee.skills) ? employee.skills.join(', ') : employee.skills}
- Certifications: ${Array.isArray(employee.certifications) ? employee.certifications.join(', ') : employee.certifications}

Available Standard Roles:
${standardRoles.map(role => `- ${role.role_title} (${role.job_family}, Level: ${role.role_level})`).join('\n')}

Return only the role_title of the best matching standard role, or "NO_MATCH" if no suitable role exists.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { role: 'system', content: 'You are an expert HR system that assigns employees to the most appropriate standard roles based on their profile.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 100
      }),
    });

    const data = await response.json();
    const assignedRole = data.choices[0].message.content.trim();
    
    if (assignedRole !== "NO_MATCH") {
      console.log(`Assigned role "${assignedRole}" to employee ${employee.first_name} ${employee.last_name}`);
      return assignedRole;
    }
    
    return null;
  } catch (error) {
    console.error('Error in AI role assignment:', error);
    return null;
  }
}