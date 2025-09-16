import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

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
    const { analysisType, departmentFilter, roleFilter } = await req.json();

    console.log('Starting compensation intelligence analysis:', { analysisType, departmentFilter, roleFilter });

    // Fetch employee compensation data - include all active employees and estimate salaries if missing
    const { data: employees, error: empError } = await supabase
      .from('xlsmart_employees')
      .select(`
        id,
        first_name,
        last_name,
        current_position,
        current_department,
        current_level,
        years_of_experience,
        salary,
        currency,
        performance_rating,
        skills,
        standard_role_id,
        hire_date,
        gender
      `)
      .eq('is_active', true);

    if (empError) {
      console.error('Error fetching employees:', empError);
      throw empError;
    }

    // Estimate salaries for employees without salary data based on level and experience
    const employeesWithSalary = employees?.map(emp => {
      if (!emp.salary || emp.salary === 0) {
        let estimatedSalary = 80000000; // Base salary in IDR (~$5,300 USD)
        
        // Adjust based on level
        if (emp.current_level?.toLowerCase().includes('senior') || emp.current_level?.toLowerCase().includes('lead')) {
          estimatedSalary = 120000000; // ~$8,000 USD
        } else if (emp.current_level?.toLowerCase().includes('manager') || emp.current_level?.toLowerCase().includes('head')) {
          estimatedSalary = 150000000; // ~$10,000 USD
        } else if (emp.current_level?.toLowerCase().includes('director')) {
          estimatedSalary = 250000000; // ~$16,700 USD
        }
        
        // Adjust based on experience (more reasonable increase)
        if (emp.years_of_experience) {
          estimatedSalary += Math.min(emp.years_of_experience, 20) * 3000000; // Cap at 20 years, ~$200 per year
        }
        
        return { ...emp, salary: estimatedSalary, currency: emp.currency || 'IDR' };
      }
      
      // If salary exists but seems unreasonable (too high), normalize it
      if (emp.salary > 1000000000) { // More than 1 billion IDR (~$67k USD)
        return { ...emp, salary: Math.min(emp.salary, 500000000), currency: emp.currency || 'IDR' };
      }
      
      return emp;
    }) || [];

    console.log(`Fetched ${employeesWithSalary.length} employees for compensation analysis`);
    console.log('Sample employee with estimated salary:', employeesWithSalary[0]);
    
    if (employeesWithSalary.length === 0) {
      console.log('No employees found - returning early');
      return new Response(JSON.stringify({
        error: 'No employee data available for analysis',
        totalEmployees: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch standard roles with salary info
    const { data: standardRoles, error: rolesError } = await supabase
      .from('xlsmart_standard_roles')
      .select('*')
      .eq('is_active', true);

    if (rolesError) {
      console.error('Error fetching standard roles:', rolesError);
      throw rolesError;
    }

    // Fetch job descriptions with salary ranges
    const { data: jobDescriptions, error: jdError } = await supabase
      .from('xlsmart_job_descriptions')
      .select('*')
      .not('salary_range_min', 'is', null);

    if (jdError) {
      console.error('Error fetching job descriptions:', jdError);
      throw jdError;
    }

    let analysisResult;

    switch (analysisType) {
      case 'pay_equity':
        analysisResult = await performPayEquityAnalysis(employeesWithSalary, standardRoles, departmentFilter, roleFilter);
        break;
      case 'market_benchmarking':
        analysisResult = await performMarketBenchmarking(employeesWithSalary, standardRoles, jobDescriptions, departmentFilter);
        break;
      case 'promotion_readiness':
        analysisResult = await performPromotionReadinessAnalysis(employeesWithSalary, standardRoles, departmentFilter);
        break;
      case 'compensation_optimization':
        analysisResult = await performCompensationOptimization(employeesWithSalary, standardRoles, jobDescriptions);
        break;
      default:
        throw new Error('Invalid analysis type');
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in compensation intelligence:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to perform compensation intelligence analysis'
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
  console.log('OpenAI API Key exists:', !!openAIApiKey);
  console.log('System prompt length:', systemPrompt.length);
  console.log('Prompt length:', prompt.length);

  const requestBody = {
    model: 'azure/gpt-4.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_completion_tokens: 3000,
  };

  console.log('Making request to LiteLLM proxy...');
  
  try {
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
    console.log('LiteLLM proxy response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiteLLM API error response:', errorText);
      throw new Error(`LiteLLM API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Response content length:', data.choices?.[0]?.message?.content?.length || 0);
    console.log('LiteLLM response received successfully');
    
    const content = data.choices[0].message.content;
    
    // Clean up any markdown code blocks before JSON parsing
    const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
    
    // Additional cleaning - remove any trailing content after the last }
    const lastBraceIndex = cleanContent.lastIndexOf('}');
    const finalContent = lastBraceIndex !== -1 ? cleanContent.substring(0, lastBraceIndex + 1) : cleanContent;
    
    console.log('Cleaned content preview (first 200 chars):', finalContent.substring(0, 200));
    console.log('Analysis completed successfully');
    return finalContent;
    
  } catch (error) {
    console.error('Error in callLiteLLM:', error);
    throw error;
  }
}

async function performPayEquityAnalysis(employees: any[], standardRoles: any[], departmentFilter?: string, roleFilter?: string) {
  let filteredEmployees = employees;
  
  if (departmentFilter) {
    filteredEmployees = filteredEmployees.filter(emp => emp.current_department === departmentFilter);
  }
  
  if (roleFilter) {
    filteredEmployees = filteredEmployees.filter(emp => emp.current_position === roleFilter);
  }

  const systemPrompt = `You are an AI compensation analyst for XLSMART, one of Indonesia's largest telecom companies. Specialize in pay equity analysis and analyze employee compensation data to: Detect inequities, gaps, or misalignments. Provide structured insights with metrics (percentages, salary ranges, benchmarks). Recommend fair, transparent, and competitive adjustments aligned with XLSMART's HR policies and telecom industry standards. Always present findings in a clear, professional format (tables, charts, or bullet points where appropriate). ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return analysis in JSON format:
{
  "payEquityMetrics": {
    "overallEquityScore": number (0-100),
    "totalEmployeesAnalyzed": number,
    "potentialIssuesFound": number,
    "avgSalaryVariance": number
  },
  "genderPayAnalysis": [
    {
      "role": "string",
      "department": "string",
      "genderPayGap": number,
      "sampleSize": {"male": number, "female": number},
      "riskLevel": "High|Medium|Low",
      "recommendedActions": ["action1", "action2"]
    }
  ],
  "experiencePayAnalysis": [
    {
      "role": "string",
      "experienceRange": "string",
      "salaryRange": {"min": number, "max": number, "median": number},
      "outliers": [{"employeeId": "string", "reason": "string"}],
      "recommendations": ["rec1", "rec2"]
    }
  ],
  "departmentPayAnalysis": [
    {
      "department": "string",
      "avgSalary": number,
      "salaryVariance": number,
      "equityIssues": ["issue1", "issue2"],
      "recommendedAdjustments": ["adj1", "adj2"]
    }
  ],
  "actionPlan": {
    "immediateActions": ["action1", "action2"],
    "mediumTermActions": ["action1", "action2"],
    "budgetImpact": number,
    "timeline": "string"
    }
}`;

  const prompt = `Analyze pay equity for ${filteredEmployees.length} employees:

EMPLOYEE COMPENSATION DATA:
${JSON.stringify(filteredEmployees.map(emp => ({
  id: emp.id,
  position: emp.current_position,
  department: emp.current_department,
  level: emp.current_level,
  experience: emp.years_of_experience,
  salary: emp.salary,
  currency: emp.currency,
  performance: emp.performance_rating,
  hire_date: emp.hire_date
})), null, 2)}

STANDARD ROLES:
${JSON.stringify(standardRoles.map(role => ({
  id: role.id,
  title: role.role_title,
  level: role.role_level,
  department: role.department,
  salary_grade: role.salary_grade,
  experience_min: role.experience_range_min,
  experience_max: role.experience_range_max
})), null, 2)}

Provide comprehensive pay equity analysis focusing on:
1. Gender pay gap analysis across roles and departments
2. Experience-based compensation fairness
3. Department and level-based equity assessment
4. Actionable recommendations for addressing inequities`;

  try {
    const result = await callLiteLLM(prompt, systemPrompt);
    return JSON.parse(result);
  } catch (error) {
    console.error('Error in performPayEquityAnalysis:', error);
    
    // Calculate a reasonable variance from actual salary data
    const salaries = filteredEmployees.map(emp => emp.salary || 0).filter(s => s > 0);
    let variance = 0;
    if (salaries.length > 1) {
      const mean = salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length;
      const squaredDiffs = salaries.map(salary => Math.pow(salary - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length;
      const standardDeviation = Math.sqrt(avgSquaredDiff);
      variance = Math.min((standardDeviation / mean) * 100, 50); // Cap at 50%
    }
    
    return {
      payEquityMetrics: { 
        overallEquityScore: 75, 
        totalEmployeesAnalyzed: filteredEmployees.length, 
        potentialIssuesFound: Math.floor(filteredEmployees.length * 0.1), 
        avgSalaryVariance: Math.round(variance * 10) / 10 
      },
      genderPayAnalysis: [],
      experiencePayAnalysis: [],
      departmentPayAnalysis: [],
      actionPlan: { immediateActions: [], mediumTermActions: [], budgetImpact: 0, timeline: "TBD" },
      saved: false,
      error: error.message
    };
  }
}

async function performMarketBenchmarking(employees: any[], standardRoles: any[], jobDescriptions: any[], departmentFilter?: string) {
  const filteredEmployees = departmentFilter 
    ? employees.filter(emp => emp.current_department === departmentFilter)
    : employees;

  const systemPrompt = `You are an AI compensation analyst for XLSMART, one of Indonesia's largest telecom companies. Specialize in market benchmarking and analyze employee compensation data to: Detect inequities, gaps, or misalignments. Provide structured insights with metrics (percentages, salary ranges, benchmarks). Recommend fair, transparent, and competitive adjustments aligned with XLSMART's HR policies and telecom industry standards. Always present findings in a clear, professional format (tables, charts, or bullet points where appropriate). ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return analysis in JSON format:
{
  "marketPositioning": {
    "overallMarketPosition": "Above|At|Below Market",
    "competitivenessScore": number (0-100),
    "retentionRisk": "High|Medium|Low",
    "attractionCapability": "Strong|Moderate|Weak"
  },
  "roleBenchmarking": [
    {
      "role": "string",
      "currentAvgSalary": number,
      "marketP50": number,
      "marketP75": number,
      "marketP90": number,
      "gap": number,
      "priority": "High|Medium|Low",
      "recommendedAction": "string"
    }
  ],
  "departmentBenchmarking": [
    {
      "department": "string",
      "avgSalary": number,
      "marketPosition": "string",
      "competitiveRisk": "High|Medium|Low",
      "talentAttractionImpact": "string",
      "recommendations": ["rec1", "rec2"]
    }
  ],
  "budgetRecommendations": {
    "totalAdjustmentNeeded": number,
    "priorityAdjustments": [
      {
        "category": "string",
        "amount": number,
        "justification": "string",
        "timeline": "string"
      }
    ],
    "phasedApproach": ["phase1", "phase2", "phase3"]
  }
}`;

  const prompt = `Analyze market benchmarking for ${filteredEmployees.length} employees:

EMPLOYEE DATA:
${JSON.stringify(filteredEmployees.slice(0, 50), null, 2)}

STANDARD ROLES WITH REQUIREMENTS:
${JSON.stringify(standardRoles, null, 2)}

JOB DESCRIPTIONS WITH SALARY RANGES:
${JSON.stringify(jobDescriptions, null, 2)}

Provide comprehensive market benchmarking analysis focusing on:
1. Current compensation positioning vs market standards
2. Role-by-role competitive analysis
3. Department-level market positioning
4. Budget recommendations for competitive alignment

Note: Use Indonesian market standards for telecommunications industry. Assume market data based on role complexity, requirements, and industry standards.`;

  try {
    const result = await callLiteLLM(prompt, systemPrompt);
    return JSON.parse(result);
  } catch (error) {
    console.error('Error in performMarketBenchmarking:', error);
    return {
      marketPositioning: { overallMarketPosition: "Unknown", competitivenessScore: 0, retentionRisk: "Medium", attractionCapability: "Moderate" },
      roleBenchmarking: [],
      departmentBenchmarking: [],
      budgetRecommendations: { totalAdjustmentNeeded: 0, priorityAdjustments: [], phasedApproach: [] },
      saved: false,
      error: error.message
    };
  }
}

async function performPromotionReadinessAnalysis(employees: any[], standardRoles: any[], departmentFilter?: string) {
  const filteredEmployees = departmentFilter 
    ? employees.filter(emp => emp.current_department === departmentFilter)
    : employees;

  const systemPrompt = `You are an AI compensation analyst for XLSMART, one of Indonesia's largest telecom companies. Specialize in promotion readiness and analyze employee compensation data to: Detect inequities, gaps, or misalignments. Provide structured insights with metrics (percentages, salary ranges, benchmarks). Recommend fair, transparent, and competitive adjustments aligned with XLSMART's HR policies and telecom industry standards. Always present findings in a clear, professional format (tables, charts, or bullet points where appropriate). ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return analysis in JSON format:
{
  "promotionReadiness": [
    {
      "employeeId": "string",
      "currentRole": "string",
      "currentSalary": number,
      "readinessScore": number (0-100),
      "targetRole": "string",
      "targetSalary": number,
      "readinessFactors": ["factor1", "factor2"],
      "developmentNeeds": ["need1", "need2"],
      "timeToPromotion": "string",
      "salaryIncrease": number
    }
  ],
  "salaryAdjustmentCandidates": [
    {
      "employeeId": "string",
      "currentSalary": number,
      "recommendedSalary": number,
      "adjustmentType": "Merit|Market|Equity|Performance",
      "justification": "string",
      "urgency": "High|Medium|Low",
      "retentionRisk": "High|Medium|Low"
    }
  ],
  "organizationalImpact": {
    "totalPromotionBudget": number,
    "totalAdjustmentBudget": number,
    "talentRetentionImprovement": number,
    "expectedROI": "string",
    "implementationTimeline": "string"
  },
  "successionOpportunities": [
    {
      "currentRole": "string",
      "departingEmployee": "string",
      "readyCandidates": ["candidateId1", "candidateId2"],
      "developingCandidates": ["candidateId3", "candidateId4"],
      "externalHireNeeded": boolean
    }
  ]
}`;

  const prompt = `Analyze promotion readiness for ${filteredEmployees.length} employees:

EMPLOYEE DATA:
${JSON.stringify(filteredEmployees, null, 2)}

STANDARD ROLES (Career Progression Paths):
${JSON.stringify(standardRoles, null, 2)}

Provide comprehensive promotion readiness analysis focusing on:
1. Identification of promotion-ready employees
2. Salary adjustment recommendations for performance/market alignment
3. Organizational budget impact and ROI analysis
4. Succession planning opportunities and internal mobility`;

  try {
    const result = await callLiteLLM(prompt, systemPrompt);
    return JSON.parse(result);
  } catch (error) {
    console.error('Error in performPromotionReadinessAnalysis:', error);
    return {
      promotionReadiness: [],
      salaryAdjustmentCandidates: [],
      organizationalImpact: { totalPromotionBudget: 0, totalAdjustmentBudget: 0, talentRetentionImprovement: 0, expectedROI: "TBD", implementationTimeline: "TBD" },
      successionOpportunities: [],
      saved: false,
      error: error.message
    };
  }
}

async function performCompensationOptimization(employees: any[], standardRoles: any[], jobDescriptions: any[]) {
  const systemPrompt = `You are an AI compensation analyst for XLSMART, one of Indonesia's largest telecom companies. Specialize in compensation optimization and analyze employee compensation data to: Detect inequities, gaps, or misalignments. Provide structured insights with metrics (percentages, salary ranges, benchmarks). Recommend fair, transparent, and competitive adjustments aligned with XLSMART's HR policies and telecom industry standards. Always present findings in a clear, professional format (tables, charts, or bullet points where appropriate). ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return analysis in JSON format:
{
  "currentState": {
    "totalCompensationBudget": number,
    "avgSalaryByLevel": {"junior": number, "mid": number, "senior": number},
    "compressionIssues": number,
    "budgetUtilization": number
  },
  "optimizationOpportunities": [
    {
      "area": "string",
      "currentCost": number,
      "optimizedCost": number,
      "savings": number,
      "implementation": "string",
      "riskFactors": ["risk1", "risk2"]
    }
  ],
  "salaryBandRecommendations": [
    {
      "role": "string",
      "level": "string",
      "currentRange": {"min": number, "max": number},
      "recommendedRange": {"min": number, "max": number},
      "rationale": "string",
      "affectedEmployees": number
    }
  ],
  "strategicRecommendations": {
    "shortTerm": ["rec1", "rec2"],
    "mediumTerm": ["rec1", "rec2"],
    "longTerm": ["rec1", "rec2"],
    "totalInvestment": number,
    "expectedOutcomes": ["outcome1", "outcome2"]
  }
}`;

  const prompt = `Analyze compensation optimization for the entire organization:

ALL EMPLOYEE COMPENSATION DATA:
${JSON.stringify(employees, null, 2)}

STANDARD ROLES STRUCTURE:
${JSON.stringify(standardRoles, null, 2)}

JOB DESCRIPTIONS WITH SALARY RANGES:
${JSON.stringify(jobDescriptions, null, 2)}

Provide comprehensive compensation optimization analysis focusing on:
1. Current compensation structure assessment
2. Optimization opportunities and cost savings
3. Salary band restructuring recommendations
4. Strategic roadmap for compensation excellence`;

  try {
    const result = await callLiteLLM(prompt, systemPrompt);
    return JSON.parse(result);
  } catch (error) {
    console.error('Error in performCompensationOptimization:', error);
    return {
      currentState: { totalCompensationBudget: 0, avgSalaryByLevel: {}, compressionIssues: 0, budgetUtilization: 0 },
      optimizationOpportunities: [],
      salaryBandRecommendations: [],
      strategicRecommendations: { shortTerm: [], mediumTerm: [], longTerm: [], totalInvestment: 0, expectedOutcomes: [] },
      saved: false,
      error: error.message
    };
  }
}