import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Service role client for database operations
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== AI Retention Action Planner Started ===');
    
    const requestBody = await req.json();
    console.log('Request body:', requestBody);

    const { 
      employee,
      flightRiskScore,
      riskFactors = [],
      generatePlan = true
    } = requestBody;

    if (!employee || typeof flightRiskScore !== 'number') {
      throw new Error('Employee data and flight risk score are required');
    }

    // Get API key for LiteLLM
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

    // Fetch retention action templates
    const { data: actionTemplates, error: templatesError } = await supabaseService
      .from('retention_action_templates')
      .select('*')
      .order('priority_score', { ascending: false });

    if (templatesError) {
      console.error('Error fetching action templates:', templatesError);
      throw templatesError;
    }

    console.log(`Found ${actionTemplates?.length || 0} action templates`);

    // Determine risk level
    const riskLevel = flightRiskScore >= 80 ? 'high' : flightRiskScore >= 60 ? 'medium' : 'low';

    // Filter applicable templates
    const applicableTemplates = actionTemplates?.filter(template => 
      template.applicable_risk_levels.includes(riskLevel) ||
      template.applicable_risk_levels.includes('all')
    ) || [];

    console.log(`Found ${applicableTemplates.length} applicable templates for ${riskLevel} risk`);

    if (generatePlan) {
      // Generate AI-enhanced retention plan
      const aiPrompt = `You are XLSMART's AI Retention Specialist. Generate a personalized retention action plan for this employee.

EMPLOYEE PROFILE:
- Name: ${employee.first_name} ${employee.last_name}
- Position: ${employee.current_position}
- Department: ${employee.current_department}
- Experience: ${employee.years_of_experience || 0} years
- Performance Rating: ${employee.performance_rating || 'N/A'}/5
- Flight Risk Score: ${flightRiskScore}% (${riskLevel} risk)

RISK FACTORS IDENTIFIED:
${riskFactors.length > 0 ? riskFactors.join(', ') : 'Standard risk assessment based on score'}

AVAILABLE RETENTION ACTIONS (with success rates):
${applicableTemplates.map(template => 
  `- ${template.action_name}: ${template.description} (${template.success_rate}% success rate, ${template.average_timeline_days} days avg timeline)`
).join('\n')}

XLSMART CONTEXT:
- Leading Indonesian telecommunications company
- Strong focus on employee development and career growth
- Competitive compensation and benefits
- Innovation-driven culture
- Family-oriented work environment

GENERATE RETENTION PLAN:
1. Analyze the specific risk factors for this employee
2. Select 3-5 most appropriate actions from the available templates
3. Prioritize actions by urgency and impact
4. Provide specific, actionable recommendations
5. Include realistic timelines and success probability

Respond in JSON format:
{
  "riskAnalysis": {
    "primaryRiskFactors": ["factor1", "factor2"],
    "riskLevel": "${riskLevel}",
    "urgencyLevel": "immediate|high|medium|low",
    "retentionProbability": number
  },
  "recommendedActions": [
    {
      "actionId": "template_id",
      "actionType": "action_type",
      "actionName": "specific_action_name",
      "description": "detailed_action_description",
      "timeline": "specific_timeline",
      "priority": "immediate|high|medium|low",
      "successProbability": number,
      "assignedTo": "manager|hr|employee",
      "specificInstructions": "tailored_instructions"
    }
  ],
  "overallStrategy": "summary_of_retention_strategy",
  "successPrediction": number,
  "nextReviewDate": "YYYY-MM-DD"
}`;

      console.log('Calling LiteLLM API for retention plan generation...');

      const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAIApiKey}`,
        },
        body: JSON.stringify({
          model: 'azure/gpt-4.1',
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert HR retention specialist for XLSMART telecommunications company. Generate personalized, actionable retention plans based on employee data and risk factors. Focus on practical, culturally appropriate solutions for the Indonesian telecom industry. Always return valid JSON format.' 
            },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.7,
          max_completion_tokens: 2000,
        }),
      });

      console.log('LiteLLM API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LiteLLM API error:', errorText);
        throw new Error(`LiteLLM API error: ${response.statusText}`);
      }

      const aiData = await response.json();
      console.log('AI response received, parsing...');

      let retentionPlan;
      try {
        retentionPlan = JSON.parse(aiData.choices[0].message.content);
        console.log('Successfully parsed AI retention plan');
      } catch (parseError) {
        console.error('Failed to parse AI response:', aiData.choices[0]?.message?.content);
        
        // Fallback to template-based plan
        retentionPlan = generateTemplateBasedPlan(applicableTemplates, flightRiskScore, riskLevel);
      }

      // Enrich with template data and ensure proper percentage formatting
      if (retentionPlan.recommendedActions) {
        retentionPlan.recommendedActions = retentionPlan.recommendedActions.map((action: any) => {
          const template = applicableTemplates.find(t => t.id === action.actionId || t.action_name === action.actionName);
          
          // Ensure successProbability is in the correct range (0-100)
          if (action.successProbability !== undefined) {
            const successProb = action.successProbability;
            if (successProb <= 1) {
              // Convert from decimal to percentage
              action.successProbability = Math.round(successProb * 100);
            } else {
              // Already in percentage format, just round it
              action.successProbability = Math.round(successProb);
            }
          }
          
          if (template) {
            return {
              ...action,
              templateId: template.id,
              averageSuccessRate: template.success_rate,
              averageTimeline: template.average_timeline_days,
              costLevel: template.cost_level
            };
          }
          return action;
        });
      }

      // Ensure retentionProbability is in the correct range (0-100)
      if (retentionPlan.riskAnalysis && retentionPlan.riskAnalysis.retentionProbability !== undefined) {
        const retentionProb = retentionPlan.riskAnalysis.retentionProbability;
        if (retentionProb <= 1) {
          // Convert from decimal to percentage
          retentionPlan.riskAnalysis.retentionProbability = Math.round(retentionProb * 100);
        } else {
          // Already in percentage format, just round it
          retentionPlan.riskAnalysis.retentionProbability = Math.round(retentionProb);
        }
      }

      // Ensure successPrediction is in the correct range (0-100)
      if (retentionPlan.successPrediction !== undefined) {
        const successPred = retentionPlan.successPrediction;
        if (successPred <= 1) {
          // Convert from decimal to percentage
          retentionPlan.successPrediction = Math.round(successPred * 100);
        } else {
          // Already in percentage format, just round it
          retentionPlan.successPrediction = Math.round(successPred);
        }
      }

      // Save retention plan to database
      console.log('Saving retention plan to database...');
      const { data: savedPlan, error: saveError } = await supabaseService
        .from('employee_retention_plans')
        .insert({
          employee_id: employee.id,
          flight_risk_score: flightRiskScore,
          risk_factors: riskFactors,
          recommended_actions: retentionPlan.recommendedActions || [],
          plan_status: 'pending',
          success_probability: retentionPlan.successPrediction || retentionPlan.riskAnalysis?.retentionProbability || 65,
          target_completion_date: retentionPlan.nextReviewDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days from now
          notes: retentionPlan.overallStrategy || 'AI-generated retention plan'
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving retention plan:', saveError);
        // Continue anyway, return the generated plan
      } else {
        console.log('Retention plan saved successfully with ID:', savedPlan?.id);
        retentionPlan.planId = savedPlan?.id;
      }

      console.log('=== Retention Plan Generation Complete ===');

      return new Response(JSON.stringify({
        success: true,
        retentionPlan,
        applicableTemplates: applicableTemplates.slice(0, 10), // Include top 10 templates for reference
        saved: !saveError,
        planId: savedPlan?.id,
        message: 'Retention action plan generated successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // Just return templates without AI generation
      return new Response(JSON.stringify({
        success: true,
        applicableTemplates,
        riskLevel,
        message: 'Retention action templates retrieved successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('=== ERROR in Retention Action Planner ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      message: 'Failed to generate retention action plan'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Fallback function for template-based plans
function generateTemplateBasedPlan(templates: any[], riskScore: number, riskLevel: string) {
  const urgencyLevel = riskScore >= 85 ? 'immediate' : riskScore >= 70 ? 'high' : 'medium';
  
  // Select top actions based on priority and success rate
  const selectedActions = templates
    .sort((a, b) => (b.success_rate + b.priority_score) - (a.success_rate + a.priority_score))
    .slice(0, 4)
    .map(template => ({
      actionId: template.id,
      actionType: template.action_type,
      actionName: template.action_name,
      description: template.description,
      timeline: `${template.average_timeline_days} days`,
      priority: template.action_type === 'immediate' ? 'immediate' : 'high',
      successProbability: template.success_rate,
      assignedTo: template.action_type === 'compensation' ? 'hr' : 'manager',
      specificInstructions: `Execute within ${template.average_timeline_days} days for optimal results`
    }));

  return {
    riskAnalysis: {
      primaryRiskFactors: ['performance_concerns', 'career_development'],
      riskLevel,
      urgencyLevel,
      retentionProbability: Math.max(100 - riskScore, 20)
    },
    recommendedActions: selectedActions,
    overallStrategy: `Template-based retention plan for ${riskLevel} risk employee`,
    successPrediction: selectedActions.reduce((sum, action) => sum + action.successProbability, 0) / selectedActions.length,
    nextReviewDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 60 days
  };
}
