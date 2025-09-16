import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeProfile, careerGoals, currentSkills, industryTrends } = await req.json();

    console.log('Development Pathways request:', { employeeProfile, careerGoals, currentSkills });

    const systemPrompt = `You are an expert Career Development and Learning Pathways AI.
Your role is to create personalized development pathways based on employee profiles, career goals, and industry trends.

Guidelines:
- Create structured learning pathways with clear progression steps
- Recommend specific courses, certifications, and skill development activities
- Consider both technical and soft skills development
- Include timeline estimates and prerequisites
- Suggest mentoring and coaching opportunities
- Align recommendations with industry trends and future job market needs
- Provide alternative pathways for different career directions
- Include measurable milestones and success metrics

Format your response as a comprehensive development plan with:
1. Skill Gap Analysis
2. Primary Development Pathway
3. Alternative Career Tracks
4. Learning Resources & Activities
5. Timeline & Milestones
6. Success Metrics
7. Networking & Mentoring Opportunities`;

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
          { 
            role: 'user', 
            content: `Employee Profile: ${JSON.stringify(employeeProfile)}
Career Goals: ${careerGoals}
Current Skills: ${JSON.stringify(currentSkills)}
Industry Trends: ${industryTrends || 'Consider current market trends'}

Please create a comprehensive development pathway plan for this employee.`
          }
        ],
        max_completion_tokens: 2500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const developmentPlan = data.choices[0].message.content;

    console.log('Generated development pathway successfully');

    // Save development pathway to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_analysis_results')
      .insert({
        analysis_type: 'development_pathways',
        function_name: 'development-pathways',
        input_parameters: { employeeProfile, careerGoals, currentSkills, industryTrends },
        analysis_result: { developmentPlan },
        created_by: 'system', // Will be set by RLS to auth.uid()
        status: 'completed'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving development pathway:', saveError);
    }

    return new Response(JSON.stringify({ 
      developmentPlan,
      success: true,
      saved: !saveError,
      analysisId: savedAnalysis?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in development-pathways function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});