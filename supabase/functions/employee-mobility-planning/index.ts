import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const liteLLMApiKey = Deno.env.get('LITELLM_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeData, targetRole, currentPerformance } = await req.json();

    console.log('Employee Mobility Planning request:', { employeeData, targetRole, currentPerformance });

    const systemPrompt = `You are an expert HR Mobility and Career Planning AI. 
Your role is to analyze employee data and provide comprehensive mobility and career planning recommendations.

Guidelines:
- Analyze current skills vs target role requirements
- Identify skill gaps and development needs
- Suggest internal mobility opportunities
- Provide timeline estimates for role transitions
- Consider performance data and career aspirations
- Recommend specific actions and milestones
- Be specific and actionable in your recommendations

Format your response as a structured plan with clear sections for:
1. Current State Analysis
2. Gap Analysis
3. Recommended Career Path
4. Development Actions
5. Timeline & Milestones
6. Internal Opportunities`;

    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${liteLLMApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Employee Data: ${JSON.stringify(employeeData)}
Target Role: ${targetRole}
Current Performance: ${currentPerformance}

Please create a comprehensive mobility and career planning strategy for this employee.`
          }
         ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LiteLLM API error: ${response.status}`);
    }

    const data = await response.json();
    const mobilityPlan = data.choices[0].message.content;

    console.log('Generated mobility plan successfully');

    return new Response(JSON.stringify({ 
      mobilityPlan,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in employee-mobility-planning function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});