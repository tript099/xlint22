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
    const { assessmentType, identifier, targetRoleId, employees: providedEmployees } = await req.json();
    
    console.log(`Starting bulk skills assessment: ${assessmentType} - ${identifier}`);
    
    let employees;
    
    // Check if employees array is provided directly
    if (providedEmployees && Array.isArray(providedEmployees)) {
      employees = providedEmployees;
    } else {
      // Get employees based on assessment type
      let employeesQuery = supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('is_active', true);

      switch (assessmentType) {
        case 'company':
          employeesQuery = employeesQuery.eq('source_company', identifier);
          break;
        case 'department':
          employeesQuery = employeesQuery.eq('current_department', identifier);
          break;
        case 'role':
          employeesQuery = employeesQuery.eq('current_position', identifier);
          break;
        case 'all':
          // No additional filter needed for 'all'
          break;
        default:
          throw new Error('Invalid assessment type');
      }

      const { data: employeesData, error: employeesError } = await employeesQuery;
      if (employeesError) throw employeesError;
      employees = employeesData;
    }

    if (!employees || employees.length === 0) {
      throw new Error(`No employees found for ${assessmentType}: ${identifier}`);
    }

    // Create assessment session with unique identifier to avoid constraint violations
    const timestamp = Date.now();
    const sessionName = `Skills Assessment ${assessmentType}-${identifier}-${timestamp}`;
    
    console.log(`Creating session: ${sessionName}`);
    
    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .insert({
        session_name: sessionName,
        file_names: [`bulk_assessment_${assessmentType}_${timestamp}`],
        temp_table_names: [],
        total_rows: employees.length,
        status: 'processing',
        created_by: '00000000-0000-0000-0000-000000000000'
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      throw sessionError;
    }

    console.log(`Session created successfully: ${session.id}`);

    // Get target role if specified
    let targetRole = null;
    if (targetRoleId) {
      const { data: role } = await supabase
        .from('xlsmart_job_descriptions')
        .select('*')
        .eq('id', targetRoleId)
        .single();
      targetRole = role;
    }

    // Background processing with EdgeRuntime.waitUntil
    const processAssessments = async () => {
      const BATCH_SIZE = 20; // Process 20 employees at a time
      let processedCount = 0;
      let completedCount = 0;
      let errorCount = 0;

      try {
        for (let i = 0; i < employees.length; i += BATCH_SIZE) {
          const batch = employees.slice(i, i + BATCH_SIZE);
          
          // Process batch in parallel but with controlled concurrency
          const batchPromises = batch.map(async (employee) => {
            try {
              console.log(`Starting assessment for employee ${employee.id}: ${employee.first_name} ${employee.last_name}`);
              
              // Check if employee already has a recent assessment (within last 30 days)
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              
              const { data: existingAssessment } = await supabase
                .from('xlsmart_skill_assessments')
                .select('id, assessment_date')
                .eq('employee_id', employee.id)
                .gte('assessment_date', thirtyDaysAgo.toISOString())
                .order('assessment_date', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (existingAssessment) {
                console.log(`Employee ${employee.id} already has recent assessment from ${existingAssessment.assessment_date}, skipping`);
                return { success: true, skipped: true, employeeId: employee.id, reason: 'Recent assessment exists' };
              }
              
              // Find job description for employee's assigned role if no target role specified
              let jobDescriptionId = targetRoleId;
              let assessmentContext = 'specific_role';
              
              if (!jobDescriptionId) {
                if (employee.standard_role_id) {
                  console.log(`Looking up job description for employee's standard role: ${employee.standard_role_id}`);
                  const { data: jobDesc } = await supabase
                    .from('xlsmart_job_descriptions')
                    .select('id')
                    .eq('standard_role_id', employee.standard_role_id)
                    .eq('status', 'approved')
                    .maybeSingle();
                  
                  if (jobDesc) {
                    jobDescriptionId = jobDesc.id;
                    console.log(`Found job description ${jobDescriptionId} for standard role ${employee.standard_role_id}`);
                  } else {
                    console.log(`No job description found for standard role: ${employee.standard_role_id}, performing general assessment`);
                    assessmentContext = 'general';
                    jobDescriptionId = null;
                  }
                } else {
                  console.log(`Employee ${employee.id} has no standard role assigned, performing general assessment`);
                  assessmentContext = 'general';
                  jobDescriptionId = null;
                }
              }
              
              const assessment = await runEmployeeAssessment(employee, targetRole, assessmentContext);
              
              console.log(`Assessment completed for ${employee.id}:`, JSON.stringify(assessment, null, 2));

              // Store assessment result
              console.log('Inserting assessment into database...');
              
              const insertData = {
                employee_id: employee.id,
                job_description_id: jobDescriptionId, // Can be null for general assessments
                overall_match_percentage: assessment.overallMatch || 0,
                skill_gaps: assessment.skillGaps || [],
                churn_risk_score: assessment.churnRisk || 25,
                rotation_risk_score: assessment.rotationRisk || 30,
                level_fit_score: assessment.levelFit || 75,
                recommendations: assessment.recommendations || 'No recommendations available',
                next_role_recommendations: assessment.nextRoles || [],
                ai_analysis: assessmentContext === 'general' 
                  ? `General skills assessment (${assessmentType}) - no specific role target`
                  : `Role-specific assessment via ${assessmentType}`,
                assessed_by: session.created_by
              };
              console.log('Insert data:', JSON.stringify(insertData, null, 2));
              
              const { error: insertError } = await supabase
                .from('xlsmart_skill_assessments')
                .insert(insertData);

              if (insertError) {
                console.error(`Database insert error for employee ${employee.id}:`, insertError);
                throw insertError;
              }

              console.log(`Successfully saved assessment for employee ${employee.id}`);
              return { success: true, employee: employee.id, assessed: true };
            } catch (error) {
              console.error(`Error assessing employee ${employee.id}:`, error);
              return { success: false, employee: employee.id, error: error.message };
            }
          });

          const results = await Promise.allSettled(batchPromises);
          
          // Count results properly
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              if (result.value?.success) {
                if (result.value?.assessed) {
                  completedCount++;
                } else if (result.value?.skipped) {
                  console.log(`Employee ${batch[index]?.id} skipped: ${result.value?.reason}`);
                }
              } else {
                errorCount++;
              }
            } else {
              console.error(`Assessment failed for employee ${batch[index]?.id}:`, result.reason);
              errorCount++;
            }
          });
          
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
                assessmentType,
                identifier,
                sessionName
              }
            })
            .eq('id', session.id);

          // Small delay between batches to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
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
              assessmentType,
              identifier,
              sessionName,
              completion_time: new Date().toISOString()
            }
          })
          .eq('id', session.id);

        console.log(`Bulk assessment completed: ${completedCount} assessments, ${errorCount} errors`);

      } catch (error) {
        console.error('Error in bulk assessment processing:', error);
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
    EdgeRuntime.waitUntil(processAssessments());

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      message: `Started bulk assessment for ${employees.length} employees`,
      estimatedDuration: `${Math.ceil(employees.length / 20)} minutes`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-skills-assessment-bulk function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function runEmployeeAssessment(employee: any, targetRole: any, assessmentContext: string = 'specific_role') {
  console.log(`Starting AI assessment for employee: ${employee.first_name} ${employee.last_name} (context: ${assessmentContext})`);
  
  if (!openAIApiKey) {
    return {
      overallMatch: 50,
      skillGaps: [],
      recommendations: 'AI assessment unavailable - no OpenAI API key configured',
      nextRoles: [],
      churnRisk: 25,
      rotationRisk: 30,
      levelFit: 75
    };
  }

  console.log('OpenAI API key found, proceeding with assessment');
  
  try {
    const employeeProfile = `
Employee: ${employee.first_name} ${employee.last_name}
Current Position: ${employee.current_position}
Department: ${employee.current_department || 'Not specified'}
Experience: ${employee.years_of_experience || 0} years
Skills: ${Array.isArray(employee.skills) ? employee.skills.join(', ') : employee.skills || 'Not specified'}
Certifications: ${Array.isArray(employee.certifications) ? employee.certifications.join(', ') : employee.certifications || 'Not specified'}
`;

    let targetRoleInfo;
    let assessmentInstructions;
    
    if (assessmentContext === 'general') {
      targetRoleInfo = 'No specific target role - performing general skills and career potential assessment';
      assessmentInstructions = `
Assessment Context: General skills evaluation
Focus on:
- Overall skill strength and career potential
- Skills development opportunities 
- Career progression possibilities within telecom industry
- Risk factors based on current role satisfaction and market trends
`;
    } else {
      targetRoleInfo = targetRole ? `
Target Role: ${targetRole.title}
Required Skills: ${Array.isArray(targetRole.required_skills) ? targetRole.required_skills.join(', ') : 'Not specified'}
Required Qualifications: ${Array.isArray(targetRole.required_qualifications) ? targetRole.required_qualifications.join(', ') : 'Not specified'}
Experience Level: ${targetRole.experience_level || 'Not specified'}
` : 'No specific target role - general assessment';
      
      assessmentInstructions = `
Assessment Context: Role-specific evaluation
Focus on:
- Fit for the specific target role
- Specific skill gaps for the target role
- Development path to target role
- Risk factors related to role transition
`;
    }

    const prompt = `Analyze this employee's skills and provide a detailed assessment.

${employeeProfile}

${targetRoleInfo}

${assessmentInstructions}

Provide a JSON response with:
1. overallMatch: percentage (0-100) of how well the employee matches the target role or their career progression potential
2. skillGaps: array of objects with {skill, currentLevel, requiredLevel, gap}
3. recommendations: detailed text recommendations for skill development
4. nextRoles: array of 3-5 suggested career progression roles within telecom industry
5. churnRisk: percentage (0-100) - higher values indicate higher risk of employee leaving (consider: skill gaps, overqualification, market demand, career stagnation)
6. rotationRisk: percentage (0-100) - higher values indicate higher likelihood of internal role change (consider: growth potential, skill transferability, ambition)
7. levelFit: percentage (0-100) - how well the employee's experience and skills match their current level

Analyze realistic risk factors:
- High skill gaps or overqualification can increase churn risk
- Strong performers with growth potential have higher rotation risk
- Consider market conditions, career aspirations, and development opportunities
- Vary the scores based on individual profiles - not everyone should be "Low" risk

Focus on actionable insights and realistic assessments.`;

    console.log(`Making API call to LiteLLM for employee ${employee.id}`);
    console.log('Prompt length:', prompt.length);
    
    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1', // Using the model pattern from other functions
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert HR analyst specializing in skills assessment and career development for XLSMART, one of Indonesia\'s largest telecom companies. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART\'s HR systems.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1000
      }),
    });

    console.log('LiteLLM API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiteLLM API error:', errorText);
      throw new Error(`LiteLLM API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('LiteLLM response received successfully');
    
    // Clean up any markdown code blocks before JSON parsing
    const content = data.choices[0].message.content;
    const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
    
    // Additional cleaning - remove any trailing content after the last }
    const lastBraceIndex = cleanContent.lastIndexOf('}');
    const finalContent = lastBraceIndex !== -1 ? cleanContent.substring(0, lastBraceIndex + 1) : cleanContent;
    
    const result = JSON.parse(finalContent);

    return {
      overallMatch: result.overallMatch || 50,
      skillGaps: result.skillGaps || [],
      recommendations: result.recommendations || 'No specific recommendations available',
      nextRoles: result.nextRoles || [],
      churnRisk: result.churnRisk || 25,
      rotationRisk: result.rotationRisk || 30,
      levelFit: result.levelFit || 75
    };

  } catch (error) {
    console.error('Error in AI assessment:', error);
    return {
      overallMatch: 50,
      skillGaps: [],
      recommendations: `Assessment error: ${error.message}`,
      nextRoles: [],
      churnRisk: 25,
      rotationRisk: 30,
      levelFit: 75
    };
  }
}