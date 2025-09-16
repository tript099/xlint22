import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { analysisType, employeeId, departmentFilter } = await req.json();

    console.log('Starting workforce intelligence analysis:', { analysisType, employeeId, departmentFilter });

    // Fetch comprehensive employee data
    const { data: employees, error: empError } = await supabase
      .from('xlsmart_employees')
      .select(`
        *,
        standard_role_id,
        ai_suggested_role_id
      `)
      .eq('is_active', true);

    if (empError) {
      console.error('Error fetching employees:', empError);
      throw empError;
    }

    // Fetch standard roles
    const { data: standardRoles, error: rolesError } = await supabase
      .from('xlsmart_standard_roles')
      .select('*')
      .eq('is_active', true);

    if (rolesError) {
      console.error('Error fetching standard roles:', rolesError);
      throw rolesError;
    }

    // Fetch job descriptions
    const { data: jobDescriptions, error: jdError } = await supabase
      .from('xlsmart_job_descriptions')
      .select('*');

    if (jdError) {
      console.error('Error fetching job descriptions:', jdError);
      throw jdError;
    }

    // Fetch skill assessments
    const { data: skillAssessments, error: skillError } = await supabase
      .from('xlsmart_skill_assessments')
      .select('*');

    if (skillError) {
      console.error('Error fetching skill assessments:', skillError);
      throw skillError;
    }

    let analysisResult;

    switch (analysisType) {
      case 'role_optimization':
        analysisResult = await performRoleOptimization(employees, standardRoles, jobDescriptions, skillAssessments, employeeId);
        break;
      case 'skills_intelligence':
        analysisResult = await performSkillsIntelligence(employees, standardRoles, skillAssessments, departmentFilter);
        break;
      case 'career_planning':
        analysisResult = await performCareerPlanning(employees, standardRoles, jobDescriptions, skillAssessments, employeeId);
        break;
      case 'talent_analytics':
        analysisResult = await performTalentAnalytics(employees, standardRoles, skillAssessments, departmentFilter);
        break;
      case 'workforce_forecasting':
        analysisResult = await performWorkforceForecasting(employees, standardRoles, jobDescriptions, departmentFilter);
        break;
      default:
        throw new Error('Invalid analysis type');
    }

    // Save analysis result to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_analysis_results')
      .insert({
        analysis_type: analysisType,
        function_name: 'ai-workforce-intelligence',
        input_parameters: { analysisType, departmentFilter, employeeId },
        analysis_result: analysisResult,
        created_by: 'system', // Will be set by RLS to auth.uid()
        status: 'completed'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving workforce intelligence analysis:', saveError);
    }

    return new Response(JSON.stringify({
      ...analysisResult,
      saved: !saveError,
      analysisId: savedAnalysis?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in workforce intelligence:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to perform workforce intelligence analysis'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callLiteLLM(prompt: string, systemPrompt: string) {
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
      max_completion_tokens: 2000,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('LiteLLM API error:', data);
    throw new Error(`LiteLLM API error: ${data.error?.message || 'Unknown error'}`);
  }
  
  return data.choices[0].message.content;
}

async function performRoleOptimization(employees: any[], standardRoles: any[], jobDescriptions: any[], skillAssessments: any[], employeeId?: string) {
  const targetEmployees = employeeId ? employees.filter(emp => emp.id === employeeId) : employees;
  
  const systemPrompt = `You are an AI HR workforce intelligence specialist for XLSMART, one of Indonesia's largest telecom companies. Specialize in role optimization and analyze employee data against standard roles, skills, and career frameworks to: Detect mismatches, risks, or opportunities. Provide structured insights for workforce planning and optimization. Recommend actionable strategies (role changes, training, promotions, hiring needs). ⚙️ Output Requirements: Always return results in valid JSON format. Ensure outputs are concise, structured, and machine-readable for integration into XLSMART's HR application.

Return your analysis in JSON format with:
{
  "roleRecommendations": [
    {
      "employeeId": "uuid",
      "currentRole": "string",
      "recommendedStandardRoleId": "uuid", 
      "recommendedRoleTitle": "string",
      "matchScore": number (0-100),
      "reasoning": "string",
      "skillsAlignment": ["skill1", "skill2"],
      "skillGaps": ["gap1", "gap2"],
      "actionItems": ["action1", "action2"]
    }
  ],
  "organizationalInsights": {
    "totalMisaligned": number,
    "avgMatchScore": number,
    "topMisalignmentReasons": ["reason1", "reason2"],
    "departmentAnalysis": [
      {
        "department": "string",
        "alignmentScore": number,
        "recommendedActions": ["action1", "action2"]
      }
    ]
  }
}`;

  const prompt = `Analyze the following data for role optimization:

EMPLOYEES (${targetEmployees.length} records):
${JSON.stringify(targetEmployees.slice(0, 20), null, 2)}

STANDARD ROLES:
${JSON.stringify(standardRoles, null, 2)}

JOB DESCRIPTIONS:
${JSON.stringify(jobDescriptions.slice(0, 10), null, 2)}

SKILL ASSESSMENTS:
${JSON.stringify(skillAssessments.slice(0, 10), null, 2)}

Provide comprehensive role optimization analysis focusing on:
1. Best role matches for each employee based on skills, experience, and performance
2. Identification of role misalignments and reasons
3. Skill gaps that need addressing for optimal role fit
4. Organizational-level insights and recommendations`;

  const result = await callLiteLLM(prompt, systemPrompt);
  return JSON.parse(result);
}

async function performSkillsIntelligence(employees: any[], standardRoles: any[], skillAssessments: any[], departmentFilter?: string) {
  const filteredEmployees = departmentFilter 
    ? employees.filter(emp => emp.current_department === departmentFilter)
    : employees;

  const systemPrompt = `You are an AI HR workforce intelligence specialist for XLSMART, one of Indonesia's largest telecom companies. Specialize in skills intelligence and analyze employee data against standard roles, skills, and career frameworks to: Detect mismatches, risks, or opportunities. Provide structured insights for workforce planning and optimization. Recommend actionable strategies (role changes, training, promotions, hiring needs). ⚙️ Output Requirements: Always return results in valid JSON format. Ensure outputs are concise, structured, and machine-readable for integration into XLSMART's HR application.

Return analysis in JSON format:
{
  "skillsOverview": {
    "totalUniqueSkills": number,
    "avgSkillsPerEmployee": number,
    "topSkillCategories": ["category1", "category2"],
    "skillMaturityLevel": "string"
  },
  "skillGapAnalysis": [
    {
      "skillName": "string",
      "currentSupply": number,
      "requiredDemand": number,
      "gapSeverity": "Critical|High|Medium|Low",
      "affectedRoles": ["role1", "role2"],
      "recommendedActions": ["action1", "action2"]
    }
  ],
  "emergingSkills": [
    {
      "skillName": "string",
      "trendDirection": "Rising|Declining|Stable",
      "futureImportance": "High|Medium|Low",
      "recommendedInvestment": "string"
    }
  ],
  "departmentSkillsProfile": [
    {
      "department": "string",
      "strengthAreas": ["skill1", "skill2"],
      "improvementAreas": ["skill1", "skill2"],
      "recommendations": ["rec1", "rec2"]
    }
  ]
}`;

  const prompt = `Analyze skills intelligence for ${filteredEmployees.length} employees:

EMPLOYEES DATA:
${JSON.stringify(filteredEmployees.slice(0, 25), null, 2)}

STANDARD ROLES REQUIREMENTS:
${JSON.stringify(standardRoles, null, 2)}

SKILL ASSESSMENTS:
${JSON.stringify(skillAssessments, null, 2)}

Provide comprehensive skills intelligence focusing on:
1. Current skill landscape and distribution
2. Critical skill gaps across roles and departments
3. Emerging skills trends and future needs
4. Department-specific skill profiles and recommendations`;

  const result = await callLiteLLM(prompt, systemPrompt);
  return JSON.parse(result);
}

async function performCareerPlanning(employees: any[], standardRoles: any[], jobDescriptions: any[], skillAssessments: any[], employeeId?: string) {
  const targetEmployees = employeeId ? employees.filter(emp => emp.id === employeeId) : employees.slice(0, 10);

  const systemPrompt = `You are an AI HR workforce intelligence specialist for XLSMART, one of Indonesia's largest telecom companies. Specialize in career planning and analyze employee data against standard roles, skills, and career frameworks to: Detect mismatches, risks, or opportunities. Provide structured insights for workforce planning and optimization. Recommend actionable strategies (role changes, training, promotions, hiring needs). ⚙️ Output Requirements: Always return results in valid JSON format. Ensure outputs are concise, structured, and machine-readable for integration into XLSMART's HR application.

Return analysis in JSON format:
{
  "careerPathways": [
    {
      "employeeId": "uuid",
      "currentPosition": "string",
      "careerGoals": ["goal1", "goal2"],
      "shortTermPath": {
        "nextRole": "string",
        "timeframe": "string",
        "requiredSkills": ["skill1", "skill2"],
        "developmentActions": ["action1", "action2"]
      },
      "longTermPath": {
        "destinationRoles": ["role1", "role2"],
        "timeframe": "string",
        "majorMilestones": ["milestone1", "milestone2"],
        "strategicSkills": ["skill1", "skill2"]
      },
      "readinessScore": number (0-100),
      "riskFactors": ["risk1", "risk2"]
    }
  ],
  "successionPlanning": [
    {
      "criticalRole": "string",
      "readyCandidates": ["employeeId1", "employeeId2"],
      "developingCandidates": ["employeeId3", "employeeId4"],
      "urgency": "High|Medium|Low",
      "recommendedActions": ["action1", "action2"]
    }
  ]
}`;

  const prompt = `Analyze career planning for employees:

EMPLOYEES:
${JSON.stringify(targetEmployees, null, 2)}

STANDARD ROLES (Career Ladder):
${JSON.stringify(standardRoles, null, 2)}

JOB DESCRIPTIONS:
${JSON.stringify(jobDescriptions.slice(0, 10), null, 2)}

SKILL ASSESSMENTS:
${JSON.stringify(skillAssessments.filter(sa => 
  targetEmployees.some(emp => emp.id === sa.employee_id)
), null, 2)}

Provide comprehensive career planning analysis focusing on:
1. Personalized career progression pathways for each employee
2. Skills development roadmaps for career advancement
3. Succession planning for critical roles
4. Readiness assessment for next-level positions`;

  const result = await callLiteLLM(prompt, systemPrompt);
  return JSON.parse(result);
}

async function performTalentAnalytics(employees: any[], standardRoles: any[], skillAssessments: any[], departmentFilter?: string) {
  const filteredEmployees = departmentFilter 
    ? employees.filter(emp => emp.current_department === departmentFilter)
    : employees;

  const systemPrompt = `You are an AI HR workforce intelligence specialist for XLSMART, one of Indonesia's largest telecom companies. Specialize in talent analytics and analyze employee data against standard roles, skills, and career frameworks to: Detect mismatches, risks, or opportunities. Provide structured insights for workforce planning and optimization. Recommend actionable strategies (role changes, training, promotions, hiring needs). ⚙️ Output Requirements: Always return results in valid JSON format. Ensure outputs are concise, structured, and machine-readable for integration into XLSMART's HR application.

Return analysis in JSON format:
{
  "talentSegmentation": {
    "highPerformers": ["employeeId1", "employeeId2"],
    "highPotential": ["employeeId3", "employeeId4"],
    "solid_performers": ["employeeId5", "employeeId6"],
    "developmentNeeded": ["employeeId7", "employeeId8"]
  },
  "retentionRiskAnalysis": [
    {
      "employeeId": "uuid",
      "riskLevel": "High|Medium|Low",
      "riskFactors": ["factor1", "factor2"],
      "retentionStrategies": ["strategy1", "strategy2"],
      "impactIfLost": "High|Medium|Low"
    }
  ],
  "talentGaps": [
    {
      "area": "string",
      "severity": "Critical|High|Medium|Low",
      "affectedFunctions": ["function1", "function2"],
      "recommendations": ["rec1", "rec2"]
    }
  ],
  "diversityInsights": {
    "genderDistribution": {"male": number, "female": number, "other": number},
    "experienceDistribution": {"junior": number, "mid": number, "senior": number},
    "departmentDiversity": [{"department": "string", "diversityScore": number}]
  }
}`;

  const prompt = `Analyze talent analytics for ${filteredEmployees.length} employees:

EMPLOYEES:
${JSON.stringify(filteredEmployees, null, 2)}

STANDARD ROLES:
${JSON.stringify(standardRoles, null, 2)}

SKILL ASSESSMENTS:
${JSON.stringify(skillAssessments.filter(sa => 
  filteredEmployees.some(emp => emp.id === sa.employee_id)
), null, 2)}

Provide comprehensive talent analytics focusing on:
1. Talent segmentation and performance categorization
2. Retention risk analysis and mitigation strategies
3. Critical talent gaps and succession planning needs
4. Diversity and inclusion insights`;

  const result = await callLiteLLM(prompt, systemPrompt);
  return JSON.parse(result);
}

async function performWorkforceForecasting(employees: any[], standardRoles: any[], jobDescriptions: any[], departmentFilter?: string) {
  const filteredEmployees = departmentFilter 
    ? employees.filter(emp => emp.current_department === departmentFilter)
    : employees;

  const systemPrompt = `You are an AI HR workforce intelligence specialist for XLSMART, one of Indonesia's largest telecom companies. Specialize in workforce forecasting and analyze employee data against standard roles, skills, and career frameworks to: Detect mismatches, risks, or opportunities. Provide structured insights for workforce planning and optimization. Recommend actionable strategies (role changes, training, promotions, hiring needs). ⚙️ Output Requirements: Always return results in valid JSON format. Ensure outputs are concise, structured, and machine-readable for integration into XLSMART's HR application.

Return analysis in JSON format:
{
  "workforceForecasting": {
    "currentHeadcount": number,
    "projectedNeeds": {
      "3months": number,
      "6months": number,
      "12months": number
    },
    "growthAreas": ["area1", "area2"],
    "contractionAreas": ["area1", "area2"]
  },
  "teamOptimization": [
    {
      "department": "string",
      "currentStructure": {"seniors": number, "mids": number, "juniors": number},
      "optimizedStructure": {"seniors": number, "mids": number, "juniors": number},
      "rationale": "string",
      "expectedImpact": "string"
    }
  ],
  "hiringPriorities": [
    {
      "roleType": "string",
      "urgency": "High|Medium|Low",
      "quantity": number,
      "keySkills": ["skill1", "skill2"],
      "timeframe": "string"
    }
  ],
  "budgetImplications": {
    "currentTotalCompensation": number,
    "projectedIncrease": number,
    "costOptimizationOpportunities": ["opportunity1", "opportunity2"]
  }
}`;

  const prompt = `Analyze workforce forecasting for ${filteredEmployees.length} employees:

CURRENT WORKFORCE:
${JSON.stringify(filteredEmployees, null, 2)}

STANDARD ROLES:
${JSON.stringify(standardRoles, null, 2)}

JOB DESCRIPTIONS:
${JSON.stringify(jobDescriptions, null, 2)}

Provide comprehensive workforce forecasting focusing on:
1. Future headcount needs and growth projections
2. Optimal team structures and compositions
3. Strategic hiring priorities and timelines
4. Budget implications and cost optimization opportunities`;

  const result = await callLiteLLM(prompt, systemPrompt);
  return JSON.parse(result);
}