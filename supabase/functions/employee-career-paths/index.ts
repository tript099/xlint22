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
    const { employeeData } = await req.json();
    
    console.log(`Generating career path for employee: ${employeeData.name}`);

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const careerPath = await generateCareerPath(employeeData);

    // Save career path to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_analysis_results')
      .insert({
        analysis_type: 'employee_career_paths',
        function_name: 'employee-career-paths',
        input_parameters: { employeeData },
        analysis_result: { careerPath },
        created_by: 'system', // Will be set by RLS to auth.uid()
        status: 'completed'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving career path analysis:', saveError);
    }

    return new Response(JSON.stringify({
      success: true,
      careerPath,
      saved: !saveError,
      analysisId: savedAnalysis?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in employee-career-paths function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateCareerPath(employeeData: any) {
  try {
    const employeeProfile = `
Employee: ${employeeData.name}
Current Position: ${employeeData.currentPosition}
Department: ${employeeData.department || 'Not specified'}
Experience: ${employeeData.experienceYears} years
Skills: ${Array.isArray(employeeData.currentSkills) ? employeeData.currentSkills.join(', ') : employeeData.currentSkills || 'Not specified'}
Career Interests: ${employeeData.careerInterests}
Preferred Direction: ${employeeData.preferredDirection || 'Not specified'}
Geographic Flexibility: ${employeeData.geographicFlexibility || 'Not specified'}
Leadership Aspiration: ${employeeData.leadershipAspiration || 'Not specified'}
`;

    const prompt = `Create a comprehensive career path plan for this employee.

${employeeProfile}

Generate a detailed career path that includes:
1. Assessment of current role and position
2. 3-5 potential next roles (short-term: 1-2 years)
3. Long-term career destinations (3-5 years)
4. Required skills for progression
5. Recommended certifications or training
6. Realistic timeline for career advancement
7. Specific actionable recommendations

Provide the response as a JSON object with this structure:
{
  "currentRole": "Current position analysis",
  "nextRoles": ["Role 1", "Role 2", "Role 3"],
  "timeframe": "Overall timeline description",
  "requiredSkills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": ["Cert 1", "Cert 2"],
  "recommendations": "Detailed recommendations and action plan"
}

Focus on realistic career progression based on industry standards and the employee's interests and experience level.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert career counselor and HR strategist who creates personalized career development paths. Always respond with valid JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 1500
      }),
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return {
      currentRole: result.currentRole || employeeData.currentPosition,
      nextRoles: result.nextRoles || [],
      timeframe: result.timeframe || "2-3 years",
      requiredSkills: result.requiredSkills || [],
      certifications: result.certifications || [],
      recommendations: result.recommendations || "No specific recommendations available"
    };

  } catch (error) {
    console.error('Error in AI career path generation:', error);
    return {
      currentRole: employeeData.currentPosition,
      nextRoles: ["Senior " + employeeData.currentPosition, "Lead " + employeeData.currentPosition],
      timeframe: "2-3 years",
      requiredSkills: ["Leadership", "Communication", "Technical expertise"],
      certifications: ["Industry-relevant certification"],
      recommendations: `Error generating detailed career path: ${error.message}`
    };
  }
}