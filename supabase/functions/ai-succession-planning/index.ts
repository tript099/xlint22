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
    console.log('=== AI Succession Planning Function Started ===');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully:', JSON.stringify(requestBody));
    } catch (error) {
      console.error('Failed to parse request body:', error);
      throw new Error('Invalid request body');
    }

    const { analysisType, departmentFilter, positionLevel } = requestBody;
    console.log(`Starting succession planning analysis: ${analysisType}`);
    console.log(`Filters - Department: ${departmentFilter || 'none'}, Position Level: ${positionLevel || 'none'}`);

    // Test database connection first
    console.log('Testing database connection...');
    try {
      const { count: employeeCount, error: testError } = await supabase
        .from('xlsmart_employees')
        .select('*', { count: 'exact', head: true });
      
      if (testError) {
        console.error('Database connection test failed:', testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }
      console.log(`Database connection successful. Employee count: ${employeeCount}`);
    } catch (error) {
      console.error('Database test error:', error);
      throw error;
    }

    // Fetch employees with detailed logging
    console.log('Fetching employees...');
    let employeesQuery = supabase
      .from('xlsmart_employees')
      .select('*')
      .eq('is_active', true);

    if (departmentFilter) {
      console.log(`Applying department filter: ${departmentFilter}`);
      employeesQuery = employeesQuery.eq('current_department', departmentFilter);
    }

    const { data: employees, error: employeesError } = await employeesQuery;
    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      throw new Error(`Failed to fetch employees: ${employeesError.message}`);
    }
    console.log(`Fetched ${employees?.length || 0} employees successfully`);

    // Fetch standard roles with detailed logging
    console.log('Fetching standard roles...');
    const { data: standardRoles, error: rolesError } = await supabase
      .from('xlsmart_standard_roles')
      .select('*')
      .eq('is_active', true);
    
    if (rolesError) {
      console.error('Error fetching standard roles:', rolesError);
      throw new Error(`Failed to fetch standard roles: ${rolesError.message}`);
    }
    console.log(`Fetched ${standardRoles?.length || 0} standard roles successfully`);

    // Fetch skill assessments with detailed logging
    console.log('Fetching skill assessments...');
    const { data: skillAssessments, error: skillsError } = await supabase
      .from('xlsmart_skill_assessments')
      .select('*');
    
    if (skillsError) {
      console.error('Error fetching skill assessments:', skillsError);
      throw new Error(`Failed to fetch skill assessments: ${skillsError.message}`);
    }
    console.log(`Fetched ${skillAssessments?.length || 0} skill assessments successfully`);

    // Perform analysis based on type
    console.log(`Performing analysis type: ${analysisType}`);
    let result;
    switch (analysisType) {
      case 'leadership_pipeline':
        console.log('Calling performLeadershipPipeline...');
        result = await performLeadershipPipeline(employees || [], standardRoles || [], positionLevel);
        break;
      case 'succession_readiness':
        console.log('Calling performSuccessionReadiness...');
        result = await performSuccessionReadiness(employees || [], skillAssessments || []);
        break;
      case 'high_potential_identification':
        console.log('Calling performHighPotentialIdentification...');
        result = await performHighPotentialIdentification(employees || [], skillAssessments || []);
        break;
      case 'leadership_gap_analysis':
        console.log('Calling performLeadershipGapAnalysis...');
        result = await performLeadershipGapAnalysis(employees || [], standardRoles || [], departmentFilter);
        break;
      default:
        console.error(`Invalid analysis type: ${analysisType}`);
        throw new Error('Invalid analysis type');
    }
    console.log('Analysis completed successfully');

    // Save analysis result to database
    console.log('Saving analysis result to database...');
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_analysis_results')
      .insert({
        analysis_type: analysisType,
        function_name: 'ai-succession-planning',
        input_parameters: { analysisType, departmentFilter, positionLevel },
        analysis_result: result,
        status: 'completed'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving succession planning analysis:', saveError);
      // Don't throw here, just log the error
    } else {
      console.log('Analysis saved successfully with ID:', savedAnalysis?.id);
    }

    console.log('=== AI Succession Planning Function Completed Successfully ===');
    return new Response(JSON.stringify({
      ...result,
      saved: !saveError,
      analysisId: savedAnalysis?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('=== AI Succession Planning Function ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callLiteLLM(prompt: string, systemPrompt: string) {
  let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
  }
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log('=== LiteLLM API Call Started ===');
  console.log('Prompt length:', prompt.length);
  console.log('System prompt length:', systemPrompt.length);
  console.log('OpenAI API Key exists:', !!openAIApiKey);
  
  try {
    console.log('Making request to LiteLLM proxy...');
    const requestBody = {
      model: 'azure/gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_completion_tokens: 3000,
    };
    console.log('Request body prepared, model:', requestBody.model);
    
    const startTime = Date.now();
    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    const endTime = Date.now();
    console.log(`API call took ${endTime - startTime}ms`);

    console.log(`LiteLLM proxy response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiteLLM API error response:', errorText);
      console.error('Response status:', response.status);
      console.error('Response statusText:', response.statusText);
      throw new Error(`LiteLLM API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('LiteLLM response received successfully');
    console.log('Full response structure:', JSON.stringify(data, null, 2));
    console.log('Response content length:', data.choices?.[0]?.message?.content?.length || 0);
    console.log('Response preview:', data.choices?.[0]?.message?.content?.substring(0, 200) || 'No content');
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('Empty content received from LiteLLM');
      console.error('Full response data:', JSON.stringify(data, null, 2));
      throw new Error('Empty response from AI');
    }
    
    return content;
  } catch (error) {
    console.error('=== LiteLLM API Call Failed ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

async function performLeadershipPipeline(employees: any[], standardRoles: any[], positionLevel?: string) {
  const systemPrompt = `You are an AI specialist in succession planning and leadership development for XLSMART, one of Indonesia's largest telecom companies. Analyze workforce data to: Map leadership pipelines and assess succession depth. Identify critical gaps and risk areas for future leadership. Generate succession chains for key positions. Recommend development actions to strengthen the pipeline. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure outputs are structured, concise, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "pipelineOverview": {
    "totalLeadershipRoles": number,
    "totalPotentialSuccessors": number,
    "averageSuccessionDepth": number,
    "criticalGapsCount": number
  },
  "leadershipLevels": [
    {
      "level": "string",
      "currentCount": number,
      "requiredCount": number,
      "successorCount": number,
      "gapAnalysis": "string"
    }
  ],
  "successionChains": [
    {
      "role": "string",
      "currentLeader": "string",
      "readySuccessors": ["string"],
      "developingSuccessors": ["string"],
      "successionRisk": "high|medium|low"
    }
  ],
  "developmentRecommendations": [
    {
      "employee": "string",
      "currentRole": "string",
      "targetRole": "string",
      "readinessLevel": number,
      "developmentPlan": ["string"],
      "timeToReadiness": "string"
    }
  ]
}`;

  console.log('=== Starting Leadership Pipeline Analysis ===');
  console.log(`Input: ${employees.length} employees, ${standardRoles.length} roles`);

  // Map positions to departments for better analysis
  const departmentMapping = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('devops') || pos.includes('engineer') || pos.includes('architect')) return 'Engineering';
    if (pos.includes('product') || pos.includes('owner')) return 'Product Management';
    if (pos.includes('analyst') || pos.includes('analytics')) return 'Analytics';
    if (pos.includes('5g') || pos.includes('radio') || pos.includes('network')) return 'Network Operations';
    if (pos.includes('acquisition') || pos.includes('site')) return 'Network Deployment';
    if (pos.includes('ai') || pos.includes('conversational')) return 'AI/ML';
    if (pos.includes('specialist')) return 'Technical Specialist';
    return 'Technology';
  };

  // Clean and prepare employee data for AI analysis
  const cleanEmployees = employees.map(emp => ({
    id: emp.id,
    name: `${emp.first_name} ${emp.last_name}`,
    current_position: emp.current_position,
    current_department: emp.current_department || departmentMapping(emp.current_position || ''),
    current_level: emp.current_level || 'Unknown',
    experience_years: emp.years_of_experience || 0,
    performance_rating: emp.performance_rating || 0,
    skills: Array.isArray(emp.skills) ? emp.skills : (typeof emp.skills === 'string' ? [emp.skills] : []),
    certifications: Array.isArray(emp.certifications) ? emp.certifications : (typeof emp.certifications === 'string' ? [emp.certifications] : [])
  }));

  // Filter leadership roles
  const leadershipRoles = standardRoles.filter(role => 
    role.role_title?.toLowerCase().includes('manager') || 
    role.role_title?.toLowerCase().includes('director') || 
    role.role_title?.toLowerCase().includes('lead') ||
    role.role_title?.toLowerCase().includes('head') ||
    role.role_title?.toLowerCase().includes('chief')
  );

  console.log(`Prepared: ${cleanEmployees.length} clean employees, ${leadershipRoles.length} leadership roles`);

  const prompt = `Analyze leadership pipeline and succession planning for this organization:

EMPLOYEE DATA (${cleanEmployees.length} employees):
${JSON.stringify(cleanEmployees.slice(0, 20), null, 2)}

LEADERSHIP ROLES AVAILABLE (${leadershipRoles.length} roles):
${JSON.stringify(leadershipRoles.slice(0, 10).map(role => ({
  role_title: role.role_title,
  job_family: role.job_family,
  role_level: role.role_level,
  department: role.department
})), null, 2)}

${positionLevel ? `Focus analysis on position level: ${positionLevel}` : ''}

Please provide a comprehensive leadership pipeline analysis based on the actual data provided.`;

  try {
    const response = await callLiteLLM(prompt, systemPrompt);
    return JSON.parse(response);
  } catch (error) {
    console.error('Error in performLeadershipPipeline:', error);
    // Return a fallback structure if AI parsing fails
    return {
      pipelineOverview: { totalLeadershipRoles: 0, totalPotentialSuccessors: 0, averageSuccessionDepth: 0, criticalGapsCount: 0 },
      leadershipLevels: [],
      successionChains: [],
      developmentRecommendations: []
    };
  }
}

async function performSuccessionReadiness(employees: any[], skillAssessments: any[]) {
  const systemPrompt = `You are an AI specialist in succession planning and leadership development for XLSMART, one of Indonesia's largest telecom companies. Analyze workforce data to: Map leadership pipelines and assess succession depth. Identify critical gaps and risk areas for future leadership. Generate succession chains for key positions. Recommend development actions to strengthen the pipeline. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure outputs are structured, concise, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "readinessMetrics": {
    "immediatelyReady": number,
    "readyWithDevelopment": number,
    "longerTermPotential": number,
    "averageReadinessScore": number
  },
  "readinessAssessment": [
    {
      "employee": "string",
      "currentRole": "string",
      "readinessScore": number,
      "readinessCategory": "ready_now|ready_1_year|ready_2_3_years|not_ready",
      "strengthAreas": ["string"],
      "developmentNeeds": ["string"],
      "targetRoles": ["string"]
    }
  ],
  "competencyGaps": [
    {
      "competency": "string",
      "criticalityLevel": "high|medium|low",
      "currentGapSize": number,
      "affectedEmployees": number,
      "developmentSolutions": ["string"]
    }
  ],
  "successionPlans": [
    {
      "criticalRole": "string",
      "incumbentRisk": "high|medium|low",
      "identifiedSuccessors": number,
      "successionStrategy": "string"
    }
  ]
}`;

  console.log('=== Starting Succession Readiness Analysis ===');
  console.log(`Input: ${employees.length} employees, ${skillAssessments.length} assessments`);

  // Clean and prepare employee data
  const cleanEmployees = employees.map(emp => ({
    id: emp.id,
    name: `${emp.first_name} ${emp.last_name}`,
    current_position: emp.current_position,
    current_department: emp.current_department || 'Unknown',
    current_level: emp.current_level || 'Unknown',
    experience_years: emp.years_of_experience || 0,
    performance_rating: emp.performance_rating || 0,
    skills: Array.isArray(emp.skills) ? emp.skills : (typeof emp.skills === 'string' ? [emp.skills] : [])
  }));

  const prompt = `Assess succession readiness across the organization:

EMPLOYEE PERFORMANCE DATA (${cleanEmployees.length} employees):
${JSON.stringify(cleanEmployees.slice(0, 15), null, 2)}

SKILLS ASSESSMENT RESULTS (${skillAssessments.length} assessments):
${JSON.stringify(skillAssessments.slice(0, 10), null, 2)}

Evaluate readiness for advancement and create succession strategies based on the actual employee data provided.`;

  try {
    const response = await callLiteLLM(prompt, systemPrompt);
    return JSON.parse(response);
  } catch (error) {
    console.error('Error in performSuccessionReadiness:', error);
    return {
      readinessMetrics: { immediatelyReady: 0, readyWithDevelopment: 0, longerTermPotential: 0, averageReadinessScore: 0 },
      readinessAssessment: [],
      competencyGaps: [],
      successionPlans: []
    };
  }
}

async function performHighPotentialIdentification(employees: any[], skillAssessments: any[]) {
  const systemPrompt = `You are an AI specialist in succession planning and leadership development for XLSMART, one of Indonesia's largest telecom companies. Analyze workforce data to: Map leadership pipelines and assess succession depth. Identify critical gaps and risk areas for future leadership. Generate succession chains for key positions. Recommend development actions to strengthen the pipeline. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure outputs are structured, concise, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "hipoIdentification": {
    "totalHiposCandidates": number,
    "confirmedHipos": number,
    "emergingTalent": number,
    "hipoRetentionRate": number
  },
  "hipoProfiles": [
    {
      "employee": "string",
      "hipoCategory": "confirmed|emerging|potential",
      "potentialScore": number,
      "strengthIndicators": ["string"],
      "leadershipReadiness": number,
      "careerVelocity": "fast|moderate|slow",
      "riskFactors": ["string"]
    }
  ],
  "talentSegmentation": [
    {
      "segment": "string",
      "employeeCount": number,
      "characteristics": ["string"],
      "developmentStrategy": "string",
      "retentionPriority": "high|medium|low"
    }
  ],
  "developmentTracking": [
    {
      "employee": "string",
      "developmentPath": "string",
      "progressMetrics": ["string"],
      "nextMilestones": ["string"],
      "expectedPromotionTimeline": "string"
    }
  ]
}`;

  console.log('=== Starting High Potential Identification Analysis ===');
  console.log(`Input: ${employees.length} employees, ${skillAssessments.length} assessments`);

  // Map positions to departments for better analysis
  const departmentMapping = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('devops') || pos.includes('engineer') || pos.includes('architect')) return 'Engineering';
    if (pos.includes('product') || pos.includes('owner')) return 'Product Management';
    if (pos.includes('analyst') || pos.includes('analytics')) return 'Analytics';
    if (pos.includes('5g') || pos.includes('radio') || pos.includes('network')) return 'Network Operations';
    if (pos.includes('acquisition') || pos.includes('site')) return 'Network Deployment';
    if (pos.includes('ai') || pos.includes('conversational')) return 'AI/ML';
    if (pos.includes('specialist')) return 'Technical Specialist';
    return 'Technology';
  };

  // Clean and prepare employee data  
  const cleanEmployees = employees.map(emp => ({
    id: emp.id,
    name: `${emp.first_name} ${emp.last_name}`,
    current_position: emp.current_position,
    current_department: emp.current_department || departmentMapping(emp.current_position || ''),
    current_level: emp.current_level || 'Unknown',
    experience_years: emp.years_of_experience || 0,
    performance_rating: emp.performance_rating || 0,
    hire_date: emp.hire_date,
    skills: Array.isArray(emp.skills) ? emp.skills : (typeof emp.skills === 'string' ? [emp.skills] : [])
  }));

  console.log('=== DEBUG: Prepared Employee Data Sample ===');
  console.log(JSON.stringify(cleanEmployees.slice(0, 3), null, 2));
  
  const prompt = `Identify high-potential employees and create development strategies:

EMPLOYEE PROFILES (${cleanEmployees.length} employees):
${JSON.stringify(cleanEmployees.slice(0, 20), null, 2)}

SKILLS AND PERFORMANCE DATA (${skillAssessments.length} assessments):
${JSON.stringify(skillAssessments.slice(0, 10), null, 2)}

Identify high-potential talent based on performance ratings (3.0+), experience levels, and skills. Create realistic numbers based on the actual employee data provided. Look for employees with strong performance ratings and growth potential.`;

  console.log('=== DEBUG: Prompt being sent to AI ===');
  console.log(`Prompt length: ${prompt.length}`);
  console.log('First 500 chars of prompt:', prompt.substring(0, 500));

  try {
    console.log('=== Making AI call for High Potential Identification ===');
    const response = await callLiteLLM(prompt, systemPrompt);
    console.log('=== DEBUG: Raw AI Response ===');
    console.log('Response length:', response.length);
    console.log('Response preview:', response.substring(0, 500));
    
    // Clean the AI response - remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    console.log('Cleaned response preview:', cleanResponse.substring(0, 200));
    const parsedResult = JSON.parse(cleanResponse);
    console.log('=== DEBUG: Parsed AI Result ===');
    console.log(JSON.stringify(parsedResult, null, 2));
    
    return parsedResult;
  } catch (error) {
    console.error('Error in performHighPotentialIdentification:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    // Return a fallback structure if AI parsing fails
    const fallback = {
      hipoIdentification: { totalHiposCandidates: 0, confirmedHipos: 0, emergingTalent: 0, hipoRetentionRate: 0 },
      hipoProfiles: [],
      talentSegmentation: [],
      developmentTracking: []
    };
    console.log('=== Returning fallback result ===');
    return fallback;
  }
}

async function performLeadershipGapAnalysis(employees: any[], standardRoles: any[], departmentFilter?: string) {
  const systemPrompt = `You are an AI specialist in succession planning and leadership development for XLSMART, one of Indonesia's largest telecom companies. Analyze workforce data to: Map leadership pipelines and assess succession depth. Identify critical gaps and risk areas for future leadership. Generate succession chains for key positions. Recommend development actions to strengthen the pipeline. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure outputs are structured, concise, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "gapAnalysis": {
    "totalLeadershipGaps": number,
    "criticalGaps": number,
    "averageTimeToFill": "string",
    "gapImpactRating": number
  },
  "leadershipGaps": [
    {
      "role": "string",
      "department": "string",
      "gapSeverity": "critical|high|medium|low",
      "requiredCount": number,
      "currentCount": number,
      "impactOnBusiness": "string",
      "urgencyToFill": "immediate|3_months|6_months|1_year"
    }
  ],
  "capabilityGaps": [
    {
      "capability": "string",
      "currentLevel": number,
      "requiredLevel": number,
      "affectedRoles": ["string"],
      "buildVsBuyRecommendation": "build|buy|hybrid"
    }
  ],
  "closureStrategies": [
    {
      "strategy": "string",
      "targetGaps": ["string"],
      "timeframe": "string",
      "investment": "high|medium|low",
      "successProbability": number
    }
  ]
}`;

  const prompt = `Analyze leadership gaps and recommend closure strategies:

Current Leadership: ${JSON.stringify(employees.filter(emp => 
    emp.current_role?.toLowerCase().includes('manager') || 
    emp.current_role?.toLowerCase().includes('director') || 
    emp.current_role?.toLowerCase().includes('lead')
  ).slice(0, 15).map(emp => ({
    role: emp.current_role,
    department: emp.department,
    experience: emp.years_experience,
    performance: emp.performance_rating
  })))}

Required Leadership Roles: ${JSON.stringify(standardRoles.filter(role => 
    role.role_title?.toLowerCase().includes('manager') || 
    role.role_title?.toLowerCase().includes('director') || 
    role.role_title?.toLowerCase().includes('lead')
  ).slice(0, 10))}

${departmentFilter ? `Focus analysis on department: ${departmentFilter}` : ''}

Identify critical leadership gaps and recommend strategies to close them.`;

  try {
    const response = await callLiteLLM(prompt, systemPrompt);
    return JSON.parse(response);
  } catch (error) {
    console.error('Error in performLeadershipGapAnalysis:', error);
    return {
      gapAnalysis: { totalLeadershipGaps: 0, criticalGaps: 0, averageTimeToFill: 'N/A', gapImpactRating: 0 },
      leadershipGaps: [],
      capabilityGaps: [],
      closureStrategies: []
    };
  }
}