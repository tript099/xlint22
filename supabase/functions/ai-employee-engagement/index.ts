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
    const { analysisType, departmentFilter, timeFrame } = await req.json();

    console.log(`Starting employee engagement analysis: ${analysisType}`);

    // Fetch employee data
    let employeesQuery = supabase
      .from('xlsmart_employees')
      .select('*');

    if (departmentFilter) {
      employeesQuery = employeesQuery.eq('department', departmentFilter);
    }

    const { data: employees } = await employeesQuery;

    // Fetch related data
    const { data: skillAssessments } = await supabase
      .from('xlsmart_skill_assessments')
      .select('*');

    const { data: trainings } = await supabase
      .from('employee_trainings')
      .select('*');

    let result;
    switch (analysisType) {
      case 'sentiment_analysis':
        result = await performSentimentAnalysis(employees || [], skillAssessments || [], timeFrame);
        break;
      case 'engagement_prediction':
        result = await performEngagementPrediction(employees || [], trainings || []);
        break;
      case 'retention_modeling':
        result = await performRetentionModeling(employees || [], departmentFilter);
        break;
      case 'early_warning':
        result = await performEarlyWarning(employees || [], skillAssessments || []);
        break;
      default:
        throw new Error('Invalid analysis type');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-employee-engagement function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
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
    
    console.log('Analysis completed successfully');
    return cleanContent;
    
  } catch (error) {
    console.error('Error in callLiteLLM:', error);
    throw error;
  }
}

async function performSentimentAnalysis(employees: any[], skillAssessments: any[], timeFrame?: string) {
  const systemPrompt = `You are an AI expert in employee engagement, retention modeling, and sentiment analysis for XLSMART, one of Indonesia's largest telecom companies. Your role is to analyze employee data (performance metrics, skills assessments, surveys, feedback, and engagement indicators) to: Detect current sentiment patterns and morale levels. Predict future engagement and retention risks. Generate early-warning alerts for potential disengagement. Recommend data-driven, actionable strategies (e.g., training, recognition programs, career development, workload balancing). Always provide outputs in a clear, structured format (tables, dashboards, or bullet points) so HR leaders can act quickly and effectively. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "overallSentiment": {
    "score": number,
    "trend": "positive|negative|stable",
    "primaryDrivers": ["string"]
  },
  "departmentSentiment": [
    {
      "department": "string",
      "sentimentScore": number,
      "employeeCount": number,
      "topConcerns": ["string"],
      "positiveIndicators": ["string"]
    }
  ],
  "sentimentFactors": [
    {
      "factor": "string",
      "impact": "high|medium|low",
      "affectedEmployees": number,
      "recommendation": "string"
    }
  ],
  "riskSegments": [
    {
      "segment": "string",
      "riskLevel": "high|medium|low",
      "employeeCount": number,
      "indicators": ["string"]
    }
  ]
}`;

  const prompt = `Analyze employee sentiment and engagement patterns:

Employee Data: ${JSON.stringify(employees.slice(0, 25).map(emp => ({
    department: emp.department,
    role: emp.current_role,
    performance: emp.performance_rating,
    experience: emp.years_experience,
    lastUpdate: emp.updated_at
  })))}

Skills Assessments: ${JSON.stringify(skillAssessments.slice(0, 15).map(assessment => ({
    employeeId: assessment.employee_id,
    assessmentDate: assessment.assessment_date,
    overallScore: assessment.overall_score,
    status: assessment.status
  })))}

${timeFrame ? `Analysis timeframe: ${timeFrame}` : ''}

Analyze sentiment patterns, identify engagement drivers, and provide actionable insights.`;

  try {
    const response = await callLiteLLM(prompt, systemPrompt);
    console.log('Sentiment analysis - Raw response length:', response.length);
    console.log('Sentiment analysis - Response preview:', response.substring(0, 200));
    return JSON.parse(response);
  } catch (error) {
    console.error('Error in performSentimentAnalysis:', error);
    return {
      overallSentiment: { score: 0, trend: "stable", primaryDrivers: [] },
      departmentSentiment: [],
      sentimentFactors: [],
      riskSegments: [],
      saved: false,
      error: error.message
    };
  }
}

async function performEngagementPrediction(employees: any[], trainings: any[]) {
  const systemPrompt = `You are an AI expert in employee engagement, retention modeling, and sentiment analysis for XLSMART, one of Indonesia's largest telecom companies. Your role is to analyze employee data (performance metrics, skills assessments, surveys, feedback, and engagement indicators) to: Detect current sentiment patterns and morale levels. Predict future engagement and retention risks. Generate early-warning alerts for potential disengagement. Recommend data-driven, actionable strategies (e.g., training, recognition programs, career development, workload balancing). Always provide outputs in a clear, structured format (tables, dashboards, or bullet points) so HR leaders can act quickly and effectively. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "engagementForecasting": {
    "currentEngagementRate": number,
    "predictedEngagementRate": number,
    "forecastConfidence": number,
    "keyPredictors": ["string"]
  },
  "employeeSegments": [
    {
      "segment": "string",
      "currentEngagement": number,
      "predictedEngagement": number,
      "employeeCount": number,
      "interventionNeeded": boolean
    }
  ],
  "engagementDrivers": [
    {
      "driver": "string",
      "currentImpact": number,
      "predictedImpact": number,
      "actionable": boolean,
      "recommendation": "string"
    }
  ],
  "interventionStrategies": [
    {
      "strategy": "string",
      "targetSegment": "string",
      "expectedImprovement": number,
      "implementationPriority": "high|medium|low"
    }
  ]
}`;

  const prompt = `Predict employee engagement trends and recommend interventions:

Employees: ${JSON.stringify(employees.slice(0, 20).map(emp => ({
    id: emp.id,
    name: `${emp.first_name} ${emp.last_name}`,
    department: emp.current_department || emp.department,
    role: emp.current_position || emp.current_role,
    performance: emp.performance_rating,
    experience: emp.years_of_experience || emp.years_experience,
    hireDate: emp.hire_date
  })))}

Training Participation: ${JSON.stringify(trainings.slice(0, 15).map(training => ({
    employeeId: training.employee_id,
    trainingType: training.training_name,
    completionStatus: training.completion_date ? 'completed' : 'in_progress',
    duration: training.duration_hours
  })))}

Predict engagement patterns and recommend targeted interventions.`;

  try {
    const response = await callLiteLLM(prompt, systemPrompt);
    console.log('Engagement prediction - Raw response length:', response.length);
    console.log('Engagement prediction - Response preview:', response.substring(0, 200));
    return JSON.parse(response);
  } catch (error) {
    console.error('Error in performEngagementPrediction:', error);
    return {
      engagementForecasting: { currentEngagementRate: 0, predictedEngagementRate: 0, forecastConfidence: 0, keyPredictors: [] },
      employeeSegments: [],
      engagementDrivers: [],
      interventionStrategies: [],
      saved: false,
      error: error.message
    };
  }
}

async function performRetentionModeling(employees: any[], departmentFilter?: string) {
  const systemPrompt = `You are an AI expert in employee engagement, retention modeling, and sentiment analysis for XLSMART, one of Indonesia's largest telecom companies. Your role is to analyze employee data (performance metrics, skills assessments, surveys, feedback, and engagement indicators) to: Detect current sentiment patterns and morale levels. Predict future engagement and retention risks. Generate early-warning alerts for potential disengagement. Recommend data-driven, actionable strategies (e.g., training, recognition programs, career development, workload balancing). Always provide outputs in a clear, structured format (tables, dashboards, or bullet points) so HR leaders can act quickly and effectively. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "retentionMetrics": {
    "overallRetentionRate": number,
    "predictedRetentionRate": number,
    "averageTenure": number,
    "criticalRetentionRisk": number
  },
  "riskAnalysis": [
    {
      "employee": "string (use the employee name from the data)",
      "retentionProbability": number,
      "riskFactors": ["string"],
      "retentionActions": ["string"],
      "timeToRisk": "string"
    }
  ],
  "departmentRetention": [
    {
      "department": "string",
      "retentionRate": number,
      "averageTenure": number,
      "topRiskFactors": ["string"],
      "retentionStrategies": ["string"]
    }
  ],
  "retentionStrategies": [
    {
      "strategy": "string",
      "targetRisk": "high|medium|low",
      "expectedImpact": number,
      "implementationCost": "high|medium|low"
    }
  ]
}`;

  const prompt = `Analyze employee retention patterns and predict retention risks:

Employee Data: ${JSON.stringify(employees.slice(0, 25).map(emp => ({
    id: emp.id,
    name: `${emp.first_name} ${emp.last_name}`,
    department: emp.current_department || emp.department,
    role: emp.current_position || emp.current_role,
    performance: emp.performance_rating,
    experience: emp.years_of_experience || emp.years_experience,
    hireDate: emp.hire_date,
    lastPromotion: emp.last_promotion_date
  })))}

${departmentFilter ? `Focus analysis on department: ${departmentFilter}` : ''}

Identify retention risks and recommend targeted retention strategies.`;

  try {
    const response = await callLiteLLM(prompt, systemPrompt);
    console.log('Retention modeling - Raw response length:', response.length);
    console.log('Retention modeling - Response preview:', response.substring(0, 200));
    return JSON.parse(response);
  } catch (error) {
    console.error('Error in performRetentionModeling:', error);
    return {
      retentionMetrics: { overallRetentionRate: 0, predictedRetentionRate: 0, averageTenure: 0, criticalRetentionRisk: 0 },
      riskAnalysis: [],
      departmentRetention: [],
      retentionStrategies: [],
      saved: false,
      error: error.message
    };
  }
}

async function performEarlyWarning(employees: any[], skillAssessments: any[]) {
  const systemPrompt = `You are an AI expert in employee engagement, retention modeling, and sentiment analysis for XLSMART, one of Indonesia's largest telecom companies. Your role is to analyze employee data (performance metrics, skills assessments, surveys, feedback, and engagement indicators) to: Detect current sentiment patterns and morale levels. Predict future engagement and retention risks. Generate early-warning alerts for potential disengagement. Recommend data-driven, actionable strategies (e.g., training, recognition programs, career development, workload balancing). Always provide outputs in a clear, structured format (tables, dashboards, or bullet points) so HR leaders can act quickly and effectively. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "warningSystem": {
    "totalEmployeesMonitored": number,
    "highRiskEmployees": number,
    "mediumRiskEmployees": number,
    "earlyWarningAccuracy": number
  },
  "riskIndicators": [
    {
      "indicator": "string",
      "riskLevel": "high|medium|low",
      "frequency": number,
      "predictiveValue": number,
      "description": "string"
    }
  ],
  "alertedEmployees": [
    {
      "employee": "string (use the employee name from the data)",
      "riskScore": number,
      "primaryWarnings": ["string"],
      "recommendedActions": ["string"],
      "urgency": "immediate|soon|monitor"
    }
  ],
  "preventiveActions": [
    {
      "action": "string",
      "applicableRisks": ["string"],
      "effectivenessRate": number,
      "implementationTime": "string"
    }
  ]
}`;

  const prompt = `Create early warning analysis for employee disengagement:

Employee Performance Data: ${JSON.stringify(employees.slice(0, 20).map(emp => ({
    id: emp.id,
    name: `${emp.first_name} ${emp.last_name}`,
    department: emp.current_department || emp.department,
    role: emp.current_position || emp.current_role,
    performance: emp.performance_rating,
    experience: emp.years_of_experience || emp.years_experience,
    lastUpdate: emp.updated_at
  })))}

Skills Assessment Trends: ${JSON.stringify(skillAssessments.slice(0, 15).map(assessment => ({
    employeeId: assessment.employee_id,
    assessmentDate: assessment.assessment_date,
    overallScore: assessment.overall_score,
    progressTrend: assessment.progress_notes
  })))}

Identify early warning signals and recommend immediate interventions.`;

  try {
    const response = await callLiteLLM(prompt, systemPrompt);
    console.log('Early warning - Raw response length:', response.length);
    console.log('Early warning - Response preview:', response.substring(0, 200));
    return JSON.parse(response);
  } catch (error) {
    console.error('Error in performEarlyWarning:', error);
    return {
      warningSystem: { totalEmployeesMonitored: employees.length, highRiskEmployees: 0, mediumRiskEmployees: 0, earlyWarningAccuracy: 0 },
      riskIndicators: [],
      alertedEmployees: [],
      preventiveActions: [],
      saved: false,
      error: error.message
    };
  }
}