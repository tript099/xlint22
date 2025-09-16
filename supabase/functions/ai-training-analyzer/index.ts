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

interface TrainingRecommendation {
  employeeId: string;
  employeeName: string;
  currentRole: string;
  department: string;
  recommendedTrainings: Array<{
    trainingId: string;
    trainingName: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    estimatedHours: number;
    skillsGained: string[];
  }>;
  skillGaps: string[];
  overallScore: number;
  analysisDate: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeId, analysisType = 'individual' } = await req.json();

    console.log(`Starting AI training analysis for ${analysisType}:`, employeeId);

    if (analysisType === 'individual' && !employeeId) {
      throw new Error('Employee ID is required for individual analysis');
    }

    let employees = [];
    
    if (analysisType === 'individual') {
      // Get single employee
      const { data: employee, error: employeeError } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('id', employeeId)
        .eq('is_active', true)
        .single();

      if (employeeError || !employee) {
        throw new Error(`Employee not found: ${employeeError?.message}`);
      }
      employees = [employee];
    } else {
      // Get all active employees
      const { data: allEmployees, error: employeesError } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('is_active', true);

      if (employeesError) {
        throw new Error(`Failed to fetch employees: ${employeesError.message}`);
      }
      employees = allEmployees || [];
    }

    // Get available training programs
    const { data: trainingPrograms, error: programsError } = await supabase
      .from('training_programs')
      .select('*')
      .eq('status', 'active');

    if (programsError) {
      throw new Error(`Failed to fetch training programs: ${programsError.message}`);
    }

    const recommendations: TrainingRecommendation[] = [];

    // Analyze each employee
    for (const employee of employees) {
      try {
        const recommendation = await analyzeEmployeeTraining(employee, trainingPrograms || []);
        recommendations.push(recommendation);
      } catch (error) {
        console.error(`Error analyzing employee ${employee.id}:`, error);
        // Continue with other employees
      }
    }

    // Save analysis results
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('ai_analysis_results')
      .insert({
        analysis_type: 'training_recommendations',
        function_name: 'ai-training-analyzer',
        input_parameters: { employeeId, analysisType },
        analysis_result: { recommendations },
        created_by: 'system',
        status: 'completed'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving analysis:', saveError);
    }

    return new Response(JSON.stringify({
      success: true,
      recommendations,
      analysisId: savedAnalysis?.id,
      totalAnalyzed: recommendations.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI Training Analyzer error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'AI training analysis failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function analyzeEmployeeTraining(employee: any, trainingPrograms: any[]): Promise<TrainingRecommendation> {
  const systemPrompt = `You are an expert HR Training Analyst AI. Your role is to analyze employee profiles and recommend appropriate training programs.

Guidelines:
- Analyze the employee's current role, department, and skills
- Identify skill gaps and development opportunities
- Recommend specific training programs with clear reasoning
- Prioritize recommendations (high/medium/low) based on business impact
- Consider career progression and role requirements
- Focus on practical, actionable training recommendations

Format your response as a JSON object with:
1. skillGaps: Array of identified skill gaps
2. recommendedTrainings: Array of training recommendations with trainingId, priority, reason, skillsGained
3. overallScore: Overall training readiness score (0-100)
4. analysisDate: Current date

Be specific and practical in your recommendations.`;

  const employeeContext = `
Employee Profile:
- Name: ${employee.first_name} ${employee.last_name}
- Current Role: ${employee.current_position}
- Department: ${employee.current_department}
- Experience: ${employee.years_of_experience} years
- Skills: ${JSON.stringify(employee.skills || [])}
- Performance Rating: ${employee.performance_rating || 'Not available'}

Available Training Programs:
${trainingPrograms.map(program => `
- ID: ${program.id}
- Name: ${program.name}
- Category: ${program.category}
- Duration: ${program.duration_hours} hours
- Target Audience: ${program.target_audience?.join(', ') || 'All'}
- Skills: ${program.tags?.join(', ') || 'Various'}
`).join('\n')}

Please analyze this employee and provide specific training recommendations.`;

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
        { role: 'user', content: employeeContext }
      ],
      max_completion_tokens: 2000,
      temperature: 0.3
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const analysisText = data.choices[0].message.content;

  // Parse the AI response
  let analysis;
  try {
    // Try to extract JSON from the response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    // Fallback analysis
    analysis = {
      skillGaps: ['Communication', 'Technical Skills', 'Leadership'],
      recommendedTrainings: [],
      overallScore: 75,
      analysisDate: new Date().toISOString()
    };
  }

  // Map training recommendations to actual training programs
  const recommendedTrainings = analysis.recommendedTrainings?.map((rec: any) => {
    const matchingProgram = trainingPrograms.find(program => 
      program.id === rec.trainingId || 
      program.name.toLowerCase().includes(rec.trainingName?.toLowerCase() || '') ||
      program.category.toLowerCase().includes(rec.category?.toLowerCase() || '')
    );

    return {
      trainingId: matchingProgram?.id || rec.trainingId,
      trainingName: matchingProgram?.name || rec.trainingName || 'Recommended Training',
      category: matchingProgram?.category || rec.category || 'General',
      priority: rec.priority || 'medium',
      reason: rec.reason || 'Skill development needed',
      estimatedHours: matchingProgram?.duration_hours || rec.estimatedHours || 20,
      skillsGained: rec.skillsGained || matchingProgram?.tags || []
    };
  }) || [];

  return {
    employeeId: employee.id,
    employeeName: `${employee.first_name} ${employee.last_name}`,
    currentRole: employee.current_position,
    department: employee.current_department,
    recommendedTrainings,
    skillGaps: analysis.skillGaps || [],
    overallScore: analysis.overallScore || 75,
    analysisDate: analysis.analysisDate || new Date().toISOString()
  };
}


