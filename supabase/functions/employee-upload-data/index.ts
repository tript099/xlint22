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

  let sessionId: string | null = null;

  try {
    console.log('Employee upload function started - v6');
    console.log('Environment check - URL:', !!Deno.env.get('SUPABASE_URL'));
    console.log('Environment check - Service Key:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    
    const requestBody = await req.json();
    console.log('Request body parsed successfully');
    
    const { employees, sessionName } = requestBody;
    
    if (!employees || !Array.isArray(employees)) {
      throw new Error('Invalid employees data - must be an array');
    }
    
    if (!sessionName || typeof sessionName !== 'string') {
      throw new Error('Invalid session name - must be a string');
    }
    
    console.log(`Processing ${employees.length} employees for session: ${sessionName}`);
    
    // Get the authenticated user from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    console.log('Auth header found, validating user...');

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    const { data: { user }, error: userError } = await authClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Invalid authentication token');
    }
    
    console.log('User authenticated successfully:', user.id);
    
    // Create upload session first
    console.log('Creating upload session...');
    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .insert({
        session_name: sessionName,
        file_names: employees.map((emp: any) => emp.sourceFile || 'bulk_upload').filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index),
        temp_table_names: [],
        total_rows: employees.length,
        created_by: user.id,
        status: 'uploading'
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      throw new Error(`Failed to create upload session: ${sessionError.message}`);
    }

    sessionId = session.id;
    console.log('Upload session created successfully:', sessionId);

    // Return immediately and process in background
    const response = new Response(JSON.stringify({
      success: true,
      sessionId: sessionId,
      message: `Started processing ${employees.length} employee records`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // Process employees in background
    processEmployeesInBackground(employees, session, user.id);

    return response;

  } catch (error) {
    console.error('Critical error in employee-upload-data function:', error);
    
    // Update session status to failed if we have a session ID
    if (sessionId) {
      try {
        await supabase
          .from('xlsmart_upload_sessions')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', sessionId);
      } catch (updateError) {
        console.error('Failed to update session status:', updateError);
      }
    }
    
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

async function processEmployeesInBackground(employees: any[], session: any, userId: string) {
  console.log('Starting background processing for', employees.length, 'employees');
  
  const BATCH_SIZE = 10;
  let processedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      const batch = employees.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(employees.length/BATCH_SIZE)}`);
      
      const batchData: any[] = [];
      
      for (const employee of batch) {
        try {
          // Normalize employee data according to xlsmart_employees schema
          const normalizedEmployee = {
            employee_number: String(employee['EmployeeID'] || employee['Employee ID'] || employee['ID'] || `EMP${Date.now()}${Math.random()}`),
            source_company: String(employee['Telco'] || employee['Company'] || employee['Organization'] || 'Unknown').toLowerCase(),
            first_name: String(employee['Name']?.split(' ')[0] || employee['FirstName'] || employee['First Name'] || 'Unknown'),
            last_name: String(employee['Name']?.split(' ').slice(1).join(' ') || employee['LastName'] || employee['Last Name'] || ''),
            email: String(employee['Email'] || employee['EmailAddress'] || `${employee['EmployeeID'] || 'unknown'}@company.com`),
            phone: String(employee['Phone'] || employee['PhoneNumber'] || employee['Mobile'] || ''),
            current_position: String(employee['CurrentRoleTitle'] || employee['Current Role Title'] || employee['Position'] || employee['Job Title'] || 'Unknown'),
            current_department: String(employee['Department'] || employee['Division'] || ''),
            current_level: String(employee['Level'] || employee['Grade'] || employee['Seniority'] || ''),
            years_of_experience: parseInt(String(employee['YearsExperience'] || employee['Years Experience'] || employee['Experience'] || '0')) || 0,
            salary: employee['Salary'] ? parseFloat(String(employee['Salary'])) : null,
            currency: String(employee['Currency'] || 'IDR'),
            uploaded_by: userId,
            is_active: true,
            original_role_title: String(employee['CurrentRoleTitle'] || employee['Current Role Title'] || employee['Position'] || employee['Job Title'] || 'Unknown'),
            role_assignment_status: 'pending'
          };

          // Handle skills
          const skillsArray: string[] = [];
          if (employee['Skills']) {
            if (Array.isArray(employee['Skills'])) {
              skillsArray.push(...employee['Skills'].map((s: any) => String(s).trim()));
            } else if (typeof employee['Skills'] === 'string' && employee['Skills'].trim()) {
              skillsArray.push(...employee['Skills'].split(',').map((s: string) => s.trim()).filter(s => s));
            }
          }

          // Add aspirations and location as skill metadata
          if (employee['Aspirations'] && String(employee['Aspirations']).trim()) {
            skillsArray.push(`Aspirations: ${String(employee['Aspirations']).trim()}`);
          }
          if (employee['Location'] && String(employee['Location']).trim()) {
            skillsArray.push(`Location: ${String(employee['Location']).trim()}`);
          }

          (normalizedEmployee as any).skills = skillsArray;

          // Handle certifications
          const certificationsArray: string[] = [];
          if (employee['Certifications']) {
            if (Array.isArray(employee['Certifications'])) {
              certificationsArray.push(...employee['Certifications'].map((c: any) => String(c).trim()));
            } else if (typeof employee['Certifications'] === 'string' && employee['Certifications'].trim()) {
              certificationsArray.push(...employee['Certifications'].split(',').map((c: string) => c.trim()).filter(c => c));
            }
          }
          
          (normalizedEmployee as any).certifications = certificationsArray;

          // Handle performance rating
          if (employee['PerformanceRating'] || employee['Performance Rating']) {
            const rating = employee['PerformanceRating'] || employee['Performance Rating'];
            if (typeof rating === 'string') {
              switch (rating.toLowerCase()) {
                case 'exceeds': (normalizedEmployee as any).performance_rating = 4; break;
                case 'meets': (normalizedEmployee as any).performance_rating = 3; break;
                case 'below': (normalizedEmployee as any).performance_rating = 2; break;
                case 'needs improvement': (normalizedEmployee as any).performance_rating = 1; break;
                default: (normalizedEmployee as any).performance_rating = parseFloat(rating) || null;
              }
            } else {
              (normalizedEmployee as any).performance_rating = parseFloat(rating) || null;
            }
          }

          batchData.push(normalizedEmployee);

        } catch (employeeError) {
          console.error('Error processing employee:', employeeError);
          errorCount++;
          errors.push(`Employee ${employee['EmployeeID'] || 'unknown'}: ${employeeError.message}`);
        }
      }

      // Insert batch if we have valid data
      if (batchData.length > 0) {
        try {
          const { error: insertError } = await supabase
            .from('xlsmart_employees')
            .insert(batchData);

          if (insertError) {
            console.error('Batch insert error:', insertError);
            errorCount += batchData.length;
            errors.push(`Batch insert error: ${insertError.message}`);
          } else {
            processedCount += batchData.length;
            console.log(`Successfully inserted ${batchData.length} employees`);
          }

        } catch (batchError) {
          console.error('Error inserting batch:', batchError);
          errorCount += batchData.length;
          errors.push(`Batch error: ${batchError.message}`);
        }
      }

      // Update progress after each batch
      await supabase
        .from('xlsmart_upload_sessions')
        .update({
          ai_analysis: {
            processed: processedCount,
            assigned: 0,
            errors: errorCount,
            total: employees.length,
            error_details: errors.slice(-10)
          }
        })
        .eq('id', session.id);

      // Small delay between batches
      if (i + BATCH_SIZE < employees.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Mark session as completed
    const finalStatus = errorCount === 0 ? 'completed' : 
                       processedCount > 0 ? 'completed_with_errors' : 'failed';
    
    await supabase
      .from('xlsmart_upload_sessions')
      .update({
        status: finalStatus,
        ai_analysis: {
          processed: processedCount,
          assigned: 0,
          errors: errorCount,
          total: employees.length,
          completion_time: new Date().toISOString(),
          error_details: errors
        }
      })
      .eq('id', session.id);

    console.log(`Background processing completed: ${processedCount} processed, ${errorCount} errors`);

  } catch (error) {
    console.error('Critical error in background processing:', error);
    
    // Mark session as failed
    await supabase
      .from('xlsmart_upload_sessions')
      .update({
        status: 'failed',
        error_message: error.message,
        ai_analysis: {
          processed: processedCount,
          assigned: 0,
          errors: errorCount,
          total: employees.length,
          error_details: [...errors, `Critical error: ${error.message}`]
        }
      })
      .eq('id', session.id);
  }
}