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
    console.log('=== AI Employee Exit Strategy Function Started ===')
    
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

    // Calculate tenure
    const hireDate = employee.hire_date ? new Date(employee.hire_date) : null
    const currentDate = new Date()
    const tenureMonths = hireDate ? Math.floor((currentDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0

    // Fetch team members in same department for workload redistribution planning
    const { data: teamMembers, error: teamError } = await supabase
      .from('xlsmart_employees')
      .select('first_name, last_name, current_position, years_of_experience, performance_rating')
      .eq('current_department', employee.current_department)
      .neq('id', employee.id)
      .eq('is_active', true)
      .order('performance_rating', { ascending: false })

    if (teamError) {
      console.error('Error fetching team members:', teamError)
    }

    const exitStrategyPrompt = `
You are an expert HR consultant specializing in employee offboarding and exit strategies.

Generate a comprehensive and professional exit strategy for the following underperforming employee:

EMPLOYEE DETAILS:
- Name: ${employee.first_name} ${employee.last_name}
- Position: ${employee.current_position}
- Department: ${employee.current_department || 'Not specified'}
- Performance Rating: ${employee.performance_rating}/5
- Years of Experience: ${employee.years_of_experience || 'Not specified'}
- Hire Date: ${employee.hire_date || 'Not specified'}
- Tenure: ${tenureMonths} months
- Employee Status: ${employee.is_active ? 'Active' : 'Inactive'}

TEAM CONTEXT FOR WORKLOAD REDISTRIBUTION:
${teamMembers?.length ? `
Team Members in ${employee.current_department}:
${teamMembers.map(tm => `
• ${tm.first_name} ${tm.last_name} - ${tm.current_position} 
  Experience: ${tm.years_of_experience || 'Unknown'} years | Performance: ${tm.performance_rating || 'N/A'}/5
`).join('')}
` : 'No team members found for workload planning'}

LEGAL CONSIDERATIONS:
- Employee tenure: ${tenureMonths} months
- Performance documentation required
- Notice period and final pay calculations
- Benefits termination procedures

TASK: Create a detailed, legally compliant exit strategy with the following structure:

## 🚪 Professional Exit Strategy & Offboarding Plan

### Executive Summary
- Employee profile and performance summary
- Reason for termination (performance-based)
- Key risks and mitigation strategies
- Timeline overview

### Pre-Termination Assessment & Documentation
- **Performance Documentation Review**
  - Compile all performance reviews and warnings
  - Document improvement plan attempts and outcomes
  - Gather supporting evidence and witness statements
  
- **Legal Compliance Checklist**
  - Employment contract review
  - State/local labor law requirements
  - Notice period requirements (based on ${tenureMonths} months tenure)
  - Final pay and benefit calculations

### Termination Timeline & Process

#### **Phase 1: Preparation (Week 1)**
- **Days 1-2: Documentation & Legal Review**
  - Finalize performance documentation
  - HR and legal team review
  - Prepare termination letter and final pay calculations
  
- **Days 3-5: Transition Planning**
  - Identify critical responsibilities and projects
  - Plan workload redistribution among team members
  - Prepare client/stakeholder communication strategy

#### **Phase 2: Execution (Week 2)**
- **Day 1: Termination Meeting**
  - Conduct professional termination discussion
  - Present documentation and reasoning
  - Explain benefits, final pay, and transition process
  
- **Day 2-3: Immediate Transition**
  - Revoke system access and collect equipment
  - Begin knowledge transfer to designated team members
  - Notify relevant clients/stakeholders (if applicable)

#### **Phase 3: Completion (Week 3-4)**
- **Week 3: Knowledge Transfer & Handover**
  - Complete project handovers
  - Document processes and ongoing responsibilities
  - Conduct exit interview
  
- **Week 4: Administrative Closure**
  - Process final paperwork
  - Complete benefit terminations
  - Archive employee records

### Workload Redistribution Strategy
${teamMembers?.length ? `
**Recommended Task Distribution:**
${teamMembers.slice(0, 3).map((tm, index) => `
${index + 1}. ${tm.first_name} ${tm.last_name} (${tm.current_position})
   - Performance Rating: ${tm.performance_rating}/5
   - Recommended Workload: ${tm.performance_rating >= 4 ? 'High-priority tasks' : tm.performance_rating >= 3 ? 'Standard responsibilities' : 'Basic tasks only'}
   - Support Level: ${tm.years_of_experience >= 3 ? 'Minimal supervision needed' : 'Regular check-ins required'}
`).join('')}

**Temporary Coverage Plan:**
- Immediate coverage for critical daily tasks
- Medium-term redistribution based on team capacity
- Long-term hiring plan if needed
` : `
**No Current Team Members Available**
- Consider temporary external contractor
- Redistribute to other departments temporarily
- Accelerate hiring process for replacement
`}

### Client/Stakeholder Communication Plan
- **Internal Notifications**
  - Department team announcement
  - Cross-functional team notifications
  - Management briefing
  
- **External Communications** (if applicable)
  - Client transition letters
  - Vendor/supplier notifications
  - Gradual relationship transfers

### Legal Risk Mitigation
- **Documentation Standards**
  - All interactions documented
  - Witness statements collected
  - Performance improvement attempts recorded
  
- **Compliance Measures**
  - Equal employment opportunity considerations
  - Discrimination risk assessment
  - Severance package evaluation

### Administrative Checklist

#### **IT & Security**
- [ ] Revoke all system access immediately
- [ ] Collect laptop, phone, access cards, keys
- [ ] Change passwords for shared accounts
- [ ] Review data access logs for security

#### **HR & Payroll**
- [ ] Calculate final pay including unused vacation
- [ ] Process benefit terminations (health, dental, 401k)
- [ ] Prepare COBRA documentation
- [ ] Update organizational charts

#### **Knowledge Management**
- [ ] Document key processes and procedures
- [ ] Transfer project ownership
- [ ] Update contact lists and responsibilities
- [ ] Archive important files and communications

### Post-Termination Follow-up
- **Week 1**: Ensure smooth transition, address any immediate issues
- **Month 1**: Follow up on workload distribution effectiveness
- **Month 3**: Evaluate need for permanent replacement hire

### Reference Policy & Future Considerations
- **Reference Guidelines**
  - Dates of employment verification only
  - Performance rating: ${employee.performance_rating}/5 (factual)
  - No personal recommendations due to performance issues
  
- **Re-employment Policy**
  - Not eligible for rehire due to performance termination
  - Documentation to be maintained in permanent file

### Success Metrics for Exit Process
- Smooth transition with minimal business disruption
- No legal challenges or complaints
- Team morale maintained
- Client relationships preserved
- Knowledge successfully transferred

This exit strategy prioritizes legal compliance, business continuity, and maintaining team morale while ensuring a respectful and professional termination process.
`

    console.log('Calling LiteLLM API for exit strategy generation...')
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
            content: 'You are an expert HR consultant specializing in professional employee offboarding and exit strategies. Focus on legal compliance, business continuity, and respectful treatment of the employee.'
          },
          {
            role: 'user',
            content: exitStrategyPrompt
          }
        ],
        max_completion_tokens: 2500,
        temperature: 0.6,
      }),
    })

    console.log('LiteLLM API response status:', response.status)

    if (!response.ok) {
      const errorData = await response.text()
      console.error('LiteLLM API Error:', errorData)
      throw new Error(`LiteLLM API error: ${response.status} - ${errorData}`)
    }

    console.log('Parsing LiteLLM response...')
    const data = await response.json()
    console.log('LiteLLM response received successfully')
    const exitStrategy = data.choices[0]?.message?.content

    if (!exitStrategy) {
      throw new Error('No exit strategy generated')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        exitStrategy,
        employee: {
          name: `${employee.first_name} ${employee.last_name}`,
          position: employee.current_position,
          department: employee.current_department,
          rating: employee.performance_rating,
          tenure: tenureMonths
        },
        teamMembersCount: teamMembers?.length || 0
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error generating exit strategy:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to generate exit strategy' 
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
