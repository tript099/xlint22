// Force redeploy for API key refresh
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { analysisType, departmentFilter, timeHorizon } = await req.json();

    console.log(`Starting advanced role intelligence analysis: ${analysisType}`);

    // Fetch data with error handling
    let rolesQuery = supabase
      .from('xlsmart_standard_roles')
      .select('*');

    if (departmentFilter) {
      rolesQuery = rolesQuery.eq('department', departmentFilter);
    }

    const { data: standardRoles, error: rolesError } = await rolesQuery;
    if (rolesError) {
      console.error('Error fetching standard roles:', rolesError);
    }
    console.log(`Fetched ${standardRoles?.length || 0} standard roles`);

    const { data: employees, error: employeesError } = await supabase
      .from('xlsmart_employees')
      .select('*');
    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
    }
    console.log(`Fetched ${employees?.length || 0} employees`);

    const { data: jobDescriptions, error: jdError } = await supabase
      .from('xlsmart_job_descriptions')
      .select('*');
    if (jdError) {
      console.error('Error fetching job descriptions:', jdError);
    }
    console.log(`Fetched ${jobDescriptions?.length || 0} job descriptions`);

    let result;
    switch (analysisType) {
      case 'role_evolution':
        result = await performRoleEvolution(standardRoles || [], employees || [], timeHorizon);
        break;
      case 'redundancy_analysis':
        result = await performRedundancyAnalysis(standardRoles || [], employees || []);
        break;
      case 'future_prediction':
        result = await performFuturePrediction(standardRoles || [], jobDescriptions || [], timeHorizon);
        break;
      case 'competitiveness_scoring':
        result = await performCompetitivenessScoring(standardRoles || [], employees || [], departmentFilter);
        break;
      default:
        throw new Error('Invalid analysis type');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-advanced-role-intelligence function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callLiteLLM(prompt: string, systemPrompt: string, maxTokens: number = 3000) {
  let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
  }
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

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
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_completion_tokens: maxTokens,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('LiteLLM API error:', data);
    console.error('Response status:', response.status, response.statusText);
    throw new Error(`LiteLLM API error: ${data.error?.message || response.statusText}`);
  }
  
  const content = data.choices[0].message.content;
  
  // Clean up the response - remove markdown code blocks if present
  const cleanedContent = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  
  console.log('AI Response content length:', cleanedContent.length);
  
  return cleanedContent;
}

async function performRoleEvolution(standardRoles: any[], employees: any[], timeHorizon?: string) {
  const systemPrompt = `You are an AI specialist in advanced role intelligence for XLSMART, one of Indonesia's largest telecom companies. Specialize in role evolution analysis to: Analyze how roles are evolving and predict future skill requirements. Identify emerging roles and transformation patterns. Recommend adaptation strategies for workforce evolution. Ensure insights align with telecom industry trends and XLSMART's organizational development. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are structured, comprehensive, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "evolutionOverview": {
    "rolesAnalyzed": number,
    "evolutionRate": number,
    "disruptionRisk": "high|medium|low",
    "adaptationReadiness": number
  },
  "roleEvolutionTracking": [
    {
      "role": "string",
      "evolutionStage": "emerging|evolving|mature|declining",
      "skillShiftTrends": ["string"],
      "futureSkillRequirements": ["string"],
      "transformationProbability": number,
      "timeToSignificantChange": "string"
    }
  ],
  "emergingRoles": [
    {
      "roleTitle": "string",
      "department": "string",
      "emergenceDrivers": ["string"],
      "requiredSkills": ["string"],
      "timeToMarketNeed": "string",
      "preparednessLevel": "high|medium|low"
    }
  ],
  "skillEvolution": [
    {
      "skillCategory": "string",
      "currentImportance": number,
      "futureImportance": number,
      "evolutionTrend": "increasing|decreasing|stable",
      "affectedRoles": ["string"]
    }
  ]
}`;

  const prompt = `Analyze role evolution patterns and future requirements:

Current Standard Roles: ${JSON.stringify(standardRoles.map(role => ({
    title: role.role_title,
    department: role.department,
    level: role.role_level,
    skills: role.required_skills,
    responsibilities: role.responsibilities
  })))}

Employee Role Distribution: ${JSON.stringify((employees || []).map(emp => ({
    role: emp.current_role,
    department: emp.department,
    skills: emp.skills,
    experience: emp.years_experience
  })))}

${timeHorizon ? `Analysis time horizon: ${timeHorizon}` : 'Default 3-year horizon'}

Analyze role evolution trends and predict future role requirements.`;

  const response = await callLiteLLM(prompt, systemPrompt);
  try {
    return JSON.parse(response);
  } catch (error) {
    console.error('Error parsing role evolution response:', error);
    console.error('Raw response:', response);
    throw new Error('Failed to parse AI response for role evolution analysis');
  }
}

async function performRedundancyAnalysis(standardRoles: any[], employees: any[]) {
  const systemPrompt = `You are an AI specialist in advanced role intelligence for XLSMART, one of Indonesia's largest telecom companies. Specialize in redundancy analysis to: Analyze role redundancy and overlap across the organization. Identify consolidation opportunities and efficiency improvements. Recommend organizational restructuring strategies. Ensure optimization aligns with telecom operational excellence and XLSMART's strategic goals. 

⚙️ CRITICAL OUTPUT REQUIREMENTS: 
- Always return COMPLETE, valid JSON format
- NEVER add comments like "// ... Truncated for brevity" or "// ... Additional roles can be extended as needed"
- NEVER use "..." or abbreviations in arrays
- Include ALL data for ALL roles - do not skip or abbreviate any entries
- Ensure the JSON is syntactically perfect and parseable
- Results must be structured, comprehensive, and machine-readable for XLSMART's HR systems

Return a JSON object with this structure:
{
  "redundancyOverview": {
    "totalRolesAnalyzed": number,
    "redundantRolesIdentified": number,
    "overlapScore": number,
    "optimizationPotential": number
  },
  "roleOverlapAnalysis": [
    {
      "roleGroup": ["string"],
      "overlapPercentage": number,
      "redundantFunctions": ["string"],
      "consolidationOpportunity": "high|medium|low",
      "impactAssessment": "string"
    }
  ],
  "efficiencyOpportunities": [
    {
      "opportunity": "string",
      "affectedRoles": ["string"],
      "potentialSavings": number,
      "implementationComplexity": "high|medium|low",
      "recommendation": "string"
    }
  ],
  "restructuringOptions": [
    {
      "option": "string",
      "consolidatedRoles": ["string"],
      "newRoleStructure": "string",
      "benefitsExpected": ["string"],
      "risksConsidered": ["string"]
    }
  ],
  "optimizationPlan": [
    {
      "phase": "string",
      "actions": ["string"],
      "timeline": "string",
      "expectedOutcomes": ["string"],
      "successMetrics": ["string"]
    }
  ]
}`;

  const prompt = `Analyze role redundancy and organizational efficiency:

Standard Role Definitions: ${JSON.stringify(standardRoles.map(role => ({
    title: role.role_title,
    department: role.department,
    responsibilities: role.responsibilities,
    skills: role.required_skills,
    level: role.role_level
  })))}

Current Employee Roles: ${JSON.stringify((employees || []).map(emp => ({
    role: emp.current_role,
    department: emp.department,
    responsibilities: emp.job_responsibilities,
    skills: emp.skills
  })))}

Identify redundant roles and recommend optimization strategies.`;

  const response = await callLiteLLM(prompt, systemPrompt); // Use default 3000 tokens
  try {
    // Check for truncation indicators
    if (response.includes('// ...') || response.includes('...') || response.includes('Truncated') || response.includes('abbreviated')) {
      console.error('AI response appears to be truncated:', response.substring(response.length - 200));
      throw new Error('AI response was truncated - incomplete JSON');
    }
    return JSON.parse(response);
  } catch (error) {
    console.error('Error parsing redundancy analysis response:', error);
    console.error('Raw response length:', response.length);
    console.error('Raw response (last 500 chars):', response.substring(Math.max(0, response.length - 500)));
    throw new Error('Failed to parse AI response for redundancy analysis');
  }
}

async function performFuturePrediction(standardRoles: any[], jobDescriptions: any[], timeHorizon?: string) {
  const systemPrompt = `You are an AI specialist in advanced role intelligence for XLSMART, one of Indonesia's largest telecom companies. Specialize in future prediction analysis to: Predict future role requirements and organizational needs based on telecom industry trends. Identify emerging roles and obsolescence risks. Recommend preparation strategies for workforce transformation. Ensure predictions align with technological advancement and XLSMART's strategic vision. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are structured, comprehensive, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "futurePrediction": {
    "predictionConfidence": number,
    "disruptionLevel": "high|medium|low",
    "newRolesExpected": number,
    "obsoleteRolesExpected": number
  },
  "futureRoles": [
    {
      "predictedRole": "string",
      "department": "string",
      "emergenceTimeframe": "string",
      "drivingFactors": ["string"],
      "requiredSkills": ["string"],
      "preparationStrategy": "string"
    }
  ],
  "roleTransformations": [
    {
      "currentRole": "string",
      "transformedRole": "string",
      "transformationDrivers": ["string"],
      "skillGaps": ["string"],
      "transitionPlan": "string"
    }
  ],
  "obsolescenceRisk": [
    {
      "role": "string",
      "riskLevel": "high|medium|low",
      "obsolescenceFactors": ["string"],
      "mitigationStrategies": ["string"],
      "transitionOptions": ["string"]
    }
  ],
  "preparationRecommendations": [
    {
      "recommendation": "string",
      "targetArea": "string",
      "implementationPriority": "high|medium|low",
      "expectedBenefit": "string",
      "timeline": "string"
    }
  ]
}`;

  const prompt = `Predict future role requirements and transformations:

Current Role Landscape: ${JSON.stringify(standardRoles.map(role => ({
    title: role.role_title,
    department: role.department,
    skills: role.required_skills,
    level: role.role_level
  })))}

Job Description Patterns: ${JSON.stringify((jobDescriptions || []).map(jd => ({
    role: jd.role_title,
    requirements: jd.requirements,
    responsibilities: jd.key_responsibilities
  })))}

${timeHorizon ? `Prediction timeframe: ${timeHorizon}` : 'Default 5-year prediction horizon'}

Predict future role evolution and organizational needs.`;

  const response = await callLiteLLM(prompt, systemPrompt);
  try {
    return JSON.parse(response);
  } catch (error) {
    console.error('Error parsing future prediction response:', error);
    console.error('Raw response:', response);
    throw new Error('Failed to parse AI response for future prediction analysis');
  }
}

async function performCompetitivenessScoring(standardRoles: any[], employees: any[], departmentFilter?: string) {
  const systemPrompt = `You are an AI specialist in advanced role intelligence for XLSMART, one of Indonesia's largest telecom companies. Specialize in competitiveness scoring to: Analyze role competitiveness in the telecom talent market. Assess market positioning and talent attraction capabilities. Recommend strategies to improve competitive advantage and retention. Ensure analysis aligns with Indonesian telecom market dynamics and XLSMART's talent strategy. 

⚙️ CRITICAL OUTPUT REQUIREMENTS: 
- Always return COMPLETE, valid JSON format
- NEVER add comments like "// ... Truncated for brevity" or "// ... Additional roles can be extended as needed"
- NEVER use "..." or abbreviations in arrays
- Include ALL data for ALL roles - do not skip or abbreviate any entries
- Ensure the JSON is syntactically perfect and parseable
- Results must be structured, comprehensive, and machine-readable for XLSMART's HR systems

Return a JSON object with this structure:
{
  "competitivenessOverview": {
    "averageCompetitivenessScore": number,
    "marketPositioning": "leader|competitive|lagging",
    "talentAttractionRisk": "high|medium|low",
    "retentionAdvantage": number
  },
  "roleCompetitiveness": [
    {
      "role": "string",
      "competitivenessScore": number,
      "marketDemand": "high|medium|low",
      "talentSupply": "abundant|balanced|scarce",
      "competitiveAdvantages": ["string"],
      "improvementAreas": ["string"]
    }
  ],
  "marketIntelligence": [
    {
      "role": "string",
      "marketTrends": ["string"],
      "salaryBenchmark": "above|at|below_market",
      "skillsPremium": ["string"],
      "competitorAdvantages": ["string"]
    }
  ],
  "talentStrategy": [
    {
      "strategy": "string",
      "targetRoles": ["string"],
      "implementation": "string",
      "expectedImpact": "high|medium|low",
      "investmentRequired": "high|medium|low"
    }
  ],
  "riskMitigation": [
    {
      "risk": "string",
      "affectedRoles": ["string"],
      "mitigationActions": ["string"],
      "monitoringMetrics": ["string"],
      "successCriteria": "string"
    }
  ]
}`;

  const prompt = `Analyze role competitiveness and market positioning:

Standard Roles Portfolio: ${JSON.stringify(standardRoles.map(role => ({
    title: role.role_title,
    department: role.department,
    level: role.role_level,
    skills: role.required_skills
  })))}

Current Talent Profile: ${JSON.stringify((employees || []).map(emp => ({
    role: emp.current_role,
    department: emp.department,
    experience: emp.years_experience,
    performance: emp.performance_rating,
    skills: emp.skills
  })))}

${departmentFilter ? `Focus analysis on department: ${departmentFilter}` : ''}

Assess role competitiveness and recommend talent attraction strategies.`;

  const response = await callLiteLLM(prompt, systemPrompt); // Use default 3000 tokens
  try {
    // Check for truncation indicators
    if (response.includes('// ...') || response.includes('...') || response.includes('Truncated') || response.includes('abbreviated')) {
      console.error('AI response appears to be truncated:', response.substring(response.length - 200));
      throw new Error('AI response was truncated - incomplete JSON');
    }
    return JSON.parse(response);
  } catch (error) {
    console.error('Error parsing competitiveness scoring response:', error);
    console.error('Raw response length:', response.length);
    console.error('Raw response (last 500 chars):', response.substring(Math.max(0, response.length - 500)));
    throw new Error('Failed to parse AI response for competitiveness scoring');
  }
}