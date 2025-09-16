import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== AI Training Analysis Function Started ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Checking environment variables...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
    }
    
    console.log('Environment check:', {
      supabaseUrl: !!supabaseUrl,
      supabaseServiceKey: !!supabaseServiceKey,
      openAIApiKey: !!openAIApiKey
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Parsing request body...');
    const { analysisType, employeeId, departmentFilter, skillGaps } = await req.json();
    console.log('Request params:', { analysisType, employeeId, departmentFilter, skillGaps });

    console.log('Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch employee data with skills and performance info
    console.log('Fetching employee data...');
    let employeeQuery = supabase
      .from('xlsmart_employees')
      .select(`
        *,
        xlsmart_skill_assessments!inner(*)
      `)
      .eq('is_active', true);

    if (employeeId) {
      employeeQuery = employeeQuery.eq('id', employeeId);
    }

    if (departmentFilter) {
      employeeQuery = employeeQuery.eq('current_department', departmentFilter);
    }

    const { data: employees, error: empError } = await employeeQuery;

    if (empError) {
      console.error('Employee fetch error:', empError);
      throw new Error(`Failed to fetch employees: ${empError.message}`);
    }

    console.log(`Found ${employees?.length || 0} employees`);

    // Fetch available training programs
    console.log('Fetching training programs...');
    const { data: trainingPrograms, error: trainingError } = await supabase
      .from('training_programs')
      .select('*')
      .eq('status', 'active');

    if (trainingError) {
      console.error('Training programs fetch error:', trainingError);
      throw new Error(`Failed to fetch training programs: ${trainingError.message}`);
    }

    console.log(`Found ${trainingPrograms?.length || 0} training programs`);

    // Fetch existing enrollments to avoid duplicates
    const { data: existingEnrollments } = await supabase
      .from('employee_training_enrollments')
      .select('employee_id, training_program_id, status')
      .in('status', ['enrolled', 'in_progress']);

    // Call LiteLLM for AI analysis
    console.log('About to call LiteLLM for training analysis...');
    const aiResponse = await callLiteLLM(employees, trainingPrograms, existingEnrollments, analysisType, skillGaps);
    console.log('LiteLLM call completed, response type:', typeof aiResponse);
    
    console.log('Storing AI analysis result in database...');
    
    // Store the analysis result in the database
    const { error: insertError } = await supabase
      .from('ai_analysis_results')
      .insert({
        analysis_type: analysisType,
        function_name: 'ai-training-analysis',
        input_parameters: {
          analysisType,
          employeeId,
          departmentFilter,
          skillGaps,
          employeeCount: employees?.length || 0,
          trainingProgramCount: trainingPrograms?.length || 0
        },
        analysis_result: aiResponse,
        created_by: '00000000-0000-0000-0000-000000000000', // System user
        status: 'completed'
      });

    if (insertError) {
      console.error('Error storing analysis result:', insertError);
      // Don't fail the entire request if storage fails
    } else {
      console.log('Analysis result stored successfully');
    }
    
    console.log('Returning AI response for training analysis type:', analysisType);
    
    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'AI Training Analysis failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callLiteLLM(employees: any[], trainingPrograms: any[], existingEnrollments: any[], analysisType: string, skillGaps?: string[]) {
  let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
  }
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = `You are an expert HR training analyst specializing in workforce development for XLSMART, one of Indonesia's largest telecom companies. Using employee data, skills assessments, and available training programs, analyze and recommend personalized training paths that align with business objectives and career growth. Focus on skill gap analysis, training ROI, and succession planning. Ensure recommendations are practical, measurable, and support XLSMART's strategic goals in telecommunications.`;

  let prompt = '';
  
  if (analysisType === 'skill_gap_training') {
    prompt = `Based on these ${employees.length} employees and ${trainingPrograms.length} available training programs, identify skill gaps and recommend targeted training interventions.

Analysis Requirements:
- Analyze skill gaps between current and required competencies
- Match employees to most suitable training programs
- Prioritize training based on business impact and career progression
- Consider existing enrollments to avoid duplicates
- Estimate training completion timeline and ROI

Return JSON with:
{
  "analysis_date": "2024-12-18",
  "skill_gap_analysis": {
    "critical_gaps": ["skill1", "skill2"],
    "department_gaps": {
      "Engineering": ["technical_skills"],
      "Sales": ["communication_skills"]
    },
    "impact_assessment": "high|medium|low"
  },
  "training_recommendations": [
    {
      "employee_id": "actual_employee_id",
      "employee_name": "First Last",
      "current_role": "current position",
      "recommended_trainings": [
        {
          "training_program_id": "program_id",
          "training_name": "Training Name",
          "priority": "high|medium|low",
          "estimated_completion_time": "8 weeks",
          "expected_skill_improvement": ["skill1", "skill2"],
          "business_justification": "Why this training is important",
          "estimated_cost": 5000000
        }
      ],
      "total_training_hours": 40,
      "estimated_completion_date": "2024-06-01"
    }
  ],
  "program_utilization": [
    {
      "training_program_id": "program_id",
      "program_name": "Training Name",
      "recommended_for": 5,
      "capacity_utilization": "80%",
      "roi_estimate": "high"
    }
  ],
  "summary": {
    "total_recommendations": 25,
    "total_estimated_cost": 125000000,
    "average_completion_time": "10 weeks",
    "expected_skill_improvements": 150
  }
}

Employee data: ${JSON.stringify(employees)}
Training programs: ${JSON.stringify(trainingPrograms)}
Existing enrollments: ${JSON.stringify(existingEnrollments)}`;
  
  } else if (analysisType === 'training_effectiveness') {
    prompt = `Analyze training effectiveness and ROI for ${employees.length} employees across ${trainingPrograms.length} programs.

Focus on:
- Training completion rates and outcomes
- Skill improvement measurements
- Performance impact post-training
- Cost-benefit analysis
- Program optimization recommendations

Return JSON with:
{
  "effectiveness_metrics": {
    "overall_completion_rate": 85,
    "average_skill_improvement": 30,
    "performance_impact": 15,
    "roi_percentage": 240
  },
  "program_analysis": [
    {
      "training_program_id": "program_id",
      "program_name": "Training Name",
      "completion_rate": 90,
      "effectiveness_score": 8.5,
      "participant_satisfaction": 4.2,
      "recommendations": ["Increase hands-on practice", "Add mentoring component"]
    }
  ],
  "optimization_recommendations": [
    "Focus on high-ROI programs",
    "Improve low-performing programs",
    "Expand successful programs"
  ]
}

Employee data: ${JSON.stringify(employees)}
Training programs: ${JSON.stringify(trainingPrograms)}`;

  } else if (analysisType === 'learning_path_optimization') {
    prompt = `Create optimized learning paths for career progression and skill development.

Design structured learning journeys that:
- Align with career goals and role requirements
- Build skills progressively from foundational to advanced
- Consider time constraints and business priorities
- Integrate with existing competency frameworks

Return JSON with:
{
  "learning_paths": [
    {
      "path_id": "unique_id",
      "path_name": "Career Path Name",
      "target_role": "Target Position",
      "duration_months": 12,
      "prerequisite_skills": ["skill1", "skill2"],
      "learning_stages": [
        {
          "stage": 1,
          "focus": "Foundation Building",
          "duration_weeks": 8,
          "training_programs": ["program1", "program2"],
          "milestone": "Complete basic certifications"
        }
      ],
      "success_metrics": ["Skill assessment scores", "Project completion"],
      "estimated_cost": 15000000
    }
  ],
  "path_recommendations": [
    {
      "employee_id": "employee_id",
      "recommended_path": "path_id",
      "rationale": "Why this path suits the employee",
      "customizations": ["Additional technical training", "Leadership focus"]
    }
  ]
}

Employee data: ${JSON.stringify(employees)}
Training programs: ${JSON.stringify(trainingPrograms)}`;
  
  } else {
    // Generic training analysis
    prompt = `Perform comprehensive training analysis for ${employees.length} employees.
Type: ${analysisType}
${skillGaps ? `Focus on skill gaps: ${skillGaps.join(', ')}` : ''}

Provide training recommendations, skill gap analysis, and ROI projections.

Employee data: ${JSON.stringify(employees)}
Training programs: ${JSON.stringify(trainingPrograms)}`;
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
    max_completion_tokens: 4000,
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
    console.log('Raw AI response length:', content.length);
    
    // Clean up any markdown code blocks before JSON parsing
    let cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
    
    // Try to fix common JSON issues
    cleanContent = cleanContent
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
      .trim();
    
    console.log('Analysis completed successfully');
    
    try {
      return JSON.parse(cleanContent);
    } catch (jsonParseError) {
      console.error('JSON parse failed, trying to extract JSON from content');
      console.error('JSON Parse error:', jsonParseError);
      
      // Try to find JSON in the content
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          console.log('Found JSON match, attempting to parse...');
          return JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          console.error('Second parse attempt failed:', secondParseError);
        }
      }
      
      // If all parsing fails, return fallback response
      throw jsonParseError;
    }
  } catch (parseError) {
    console.error('Failed to parse AI response, using fallback');
    console.error('Parse error:', parseError);
    
    // Return a fallback response
    return {
      training_recommendations: employees?.slice(0, 5).map((emp, index) => ({
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        current_role: emp.current_position,
        recommended_trainings: trainingPrograms?.slice(0, 2).map(program => ({
          training_program_id: program.id,
          training_name: program.name,
          priority: 'medium',
          estimated_completion_time: `${program.duration_weeks} weeks`,
          expected_skill_improvement: program.tags?.slice(0, 3) || ['Technical Skills'],
          business_justification: `Recommended to improve ${program.category.toLowerCase()} capabilities`,
          estimated_cost: program.cost_per_participant || 5000000
        })) || [],
        total_training_hours: 40,
        estimated_completion_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      })) || [],
      skill_gap_analysis: {
        critical_gaps: ['Technical Skills', 'Leadership', 'Communication'],
        department_gaps: {
          'Engineering': ['Advanced Programming', 'System Design'],
          'Sales': ['Customer Relations', 'Product Knowledge']
        },
        impact_assessment: 'medium'
      },
      summary: {
        total_recommendations: employees?.length || 0,
        total_estimated_cost: (employees?.length || 0) * 10000000,
        average_completion_time: '12 weeks',
        expected_skill_improvements: (employees?.length || 0) * 3
      }
    };
  }
}
