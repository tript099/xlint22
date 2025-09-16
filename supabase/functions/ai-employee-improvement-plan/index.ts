import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== AI Employee Improvement Plan Function Started ===')
    
    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json()
      console.log('Request body parsed:', JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      throw new Error('Invalid request body')
    }

    const { employee } = requestBody
    
    if (!employee) {
      console.error('No employee data provided')
      throw new Error('Employee data is required')
    }

    console.log('Processing employee:', employee.first_name, employee.last_name)
    
    // Get API key for LiteLLM (same priority as retention planner)
    let openAIApiKey = Deno.env.get('LITELLM_API_KEY');
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    }
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
    }
    if (!openAIApiKey) {
      console.error('No API key found in environment');
      throw new Error('AI API key not configured');
    }
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('Environment check:')
    console.log('- API key exists:', !!openAIApiKey)
    console.log('- SUPABASE_URL exists:', !!SUPABASE_URL)
    console.log('- SUPABASE_SERVICE_ROLE_KEY exists:', !!SUPABASE_SERVICE_ROLE_KEY)

    // Initialize Supabase client with service role key
    console.log('Initializing Supabase client...')
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Fetch available training programs
    console.log('Fetching training programs...')
    const { data: trainingPrograms, error: trainingError } = await supabase
      .from('training_programs')
      .select('id, name, description, category, type, duration_hours, difficulty_level, learning_objectives, target_audience, tags')
      .eq('status', 'active')

    if (trainingError) {
      console.error('Error fetching training programs:', trainingError)
    }

    // Fetch available departments from employee data
    const { data: departments, error: deptError } = await supabase
      .from('xlsmart_employees')
      .select('current_department')
      .not('current_department', 'is', null)

    if (deptError) {
      console.error('Error fetching departments:', deptError)
    }

    // Get unique departments
    const availableDepartments = [...new Set(departments?.map(d => d.current_department) || [])]

    const improvementPrompt = `
You are an expert HR consultant specializing in employee development and performance improvement. 

Generate a comprehensive improvement plan for the following employee:

EMPLOYEE DETAILS:
- Name: ${employee.first_name} ${employee.last_name}
- Position: ${employee.current_position}
- Department: ${employee.current_department || 'Not specified'}
- Performance Rating: ${employee.performance_rating}/5
- Years of Experience: ${employee.years_of_experience || 'Not specified'}
- Current Skills: ${employee.skills?.join(', ') || 'Not specified'}

AVAILABLE TRAINING PROGRAMS IN DATABASE:
${trainingPrograms?.map(t => `
• "${t.name}" (${t.category})
  - Type: ${t.type} | Duration: ${t.duration_hours}h | Level: ${t.difficulty_level}
  - Description: ${t.description}
  - Learning Objectives: ${t.learning_objectives?.join(', ') || 'Not specified'}
  - Target Audience: ${t.target_audience?.join(', ') || 'General'}
  - Skills/Tags: ${t.tags?.join(', ') || 'Not specified'}
`).join('\n') || 'No training programs available'}

AVAILABLE DEPARTMENTS FOR POTENTIAL TRANSFER:
${availableDepartments.join(', ') || 'Current department only'}

TASK: Create a detailed 90-day improvement plan with the following structure:

## 📋 Performance Improvement Plan

### Current Situation Analysis
- Identify specific performance gaps based on rating of ${employee.performance_rating}/5
- Root cause analysis of underperformance
- Skills assessment and gaps

### 30-Day Goals (Month 1) - Foundation Building
- **Week 1-2: Assessment & Goal Setting**
  - Conduct detailed skills assessment
  - Set clear, measurable objectives
  - Establish baseline metrics
  
- **Week 3-4: Initial Training & Support**
  - SPECIFIC TRAINING ASSIGNMENTS (select from available programs above):
    [Select 1-2 most relevant training programs from the database list]
  - Daily check-ins with supervisor
  - Begin skill-building activities

### 60-Day Goals (Month 2) - Skill Development
- **Week 5-6: Advanced Training**
  - ADDITIONAL TRAINING ASSIGNMENTS (select from available programs):
    [Select 1-2 more training programs that build on Month 1]
  - Practical application of new skills
  - Peer collaboration projects
  
- **Week 7-8: Performance Monitoring**
  - Mid-point performance evaluation
  - Adjust training plan if needed
  - Team integration activities

### 90-Day Goals (Month 3) - Performance Optimization
- **Week 9-10: Advanced Application**
  - Lead small projects or initiatives
  - Mentor newer team members
  - Complete certification if applicable
  
- **Week 11-12: Final Evaluation**
  - Comprehensive performance review
  - Target: Achieve performance rating of 3.5+/5
  - Plan for continued development

### Specific Recommendations

#### Training Program Assignments
[List specific training programs from the database with rationale for each selection]

#### Mentorship & Support
- Assign senior colleague as mentor
- Weekly 1-on-1 meetings with manager
- Peer support group participation

#### Department/Role Considerations
- Current department fit assessment
- Consider cross-functional collaboration
- Potential for role adjustment: [Assess if different department would be beneficial]

#### Success Metrics & KPIs
- Performance rating improvement (target: 3.5+/5)
- Training completion rates (target: 100%)
- Specific skill assessments
- 360-degree feedback scores
- Project completion quality

### Support Structure
- **Manager Involvement**: Weekly reviews, goal adjustment, resource provision
- **HR Support**: Training coordination, policy guidance, documentation
- **Peer Mentoring**: Buddy system, knowledge sharing sessions

### Timeline & Milestones
- Day 7: Initial assessment complete
- Day 30: First training program complete
- Day 60: Mid-point evaluation
- Day 90: Final performance review

### Risk Mitigation
- Regular check-ins to identify obstacles early
- Flexible training schedule to accommodate workload
- Alternative training options if initial selections don't fit
- Clear escalation path for additional support

Provide specific, actionable recommendations using the actual training programs available in our database. Focus on employee growth and realistic achievable goals.
`

    console.log('Calling LiteLLM API for improvement plan generation...')
    console.log('Using model: azure/gpt-4.1')
    
    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
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
            content: 'You are an expert HR consultant specializing in employee development and performance improvement plans. Use specific training programs from the provided database when making recommendations.'
          },
          {
            role: 'user',
            content: improvementPrompt
          }
        ],
        max_completion_tokens: 2500,
        temperature: 0.7,
      }),
    })

    console.log('LiteLLM API response status:', response.status)

    if (!response.ok) {
      const errorData = await response.text()
      console.error('LiteLLM API Error Response:', errorData)
      console.error('Response status:', response.status)
      console.error('Response headers:', Object.fromEntries(response.headers.entries()))
      throw new Error(`LiteLLM API error: ${response.status} - ${errorData}`)
    }

    console.log('Parsing LiteLLM response...')
    const data = await response.json()
    console.log('LiteLLM response data:', JSON.stringify(data, null, 2))
    
    const improvementPlan = data.choices[0]?.message?.content

    console.log('Improvement plan generated:', !!improvementPlan)
    console.log('Plan length:', improvementPlan?.length || 0)

    if (!improvementPlan) {
      console.error('No improvement plan in response. Full response:', data)
      throw new Error('No improvement plan generated from OpenAI')
    }

    console.log('Returning successful response...')
    return new Response(
      JSON.stringify({ 
        success: true, 
        improvementPlan,
        employee: {
          name: `${employee.first_name} ${employee.last_name}`,
          position: employee.current_position,
          department: employee.current_department,
          rating: employee.performance_rating
        },
        availableTrainings: trainingPrograms?.length || 0,
        availableDepartments: availableDepartments.length || 0
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error generating improvement plan:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to generate improvement plan' 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500
      }
    )
  }
})
