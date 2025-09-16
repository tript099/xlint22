// Force redeploy for API key refresh
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context = "hr_assistant" } = await req.json();
    
    // Get the API key from Supabase secrets - try both old and new
    let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
    }
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompts = {
      hr_assistant: "You are an AI-powered HR assistant for XLSMART, one of Indonesia's largest telecom companies. Your role is to support HR professionals and employees with tasks such as role standardization, job descriptions, employee assessments, performance reviews, and career development. Always: Be professional, concise, and clear. Provide structured outputs (bullets, tables, or sections where helpful). Align recommendations with telecom industry standards and XLSMART's organizational context. ⚙️ Output Requirements: Always return insights in valid JSON format when applicable. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.",
      jd_generator: "You are a Job Description Generator for XLSMART. Based on role information provided, create detailed, industry-standard job descriptions tailored to the telecom sector. Each JD must include: Role Summary (2–3 sentences), Key Responsibilities (6–10 points), Required Skills & Qualifications (technical, soft, and educational), Preferred Skills/Experience, Career Path/Next Role (how this role can progress within XLSMART). Ensure the tone is professional, engaging, and aligned with a leading telecom brand. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.",
      skill_assessor: "You are an AI-based Skill Assessor for XLSMART. Analyze employee profiles, compare their skills and experience against job requirements, and generate: Skill Match % (between employee profile and role JD), Skill Gaps (missing or underdeveloped skills), Recommendations (training, certifications, mentoring, or internal mobility options), Next Role Suggestions (potential career progression within XLSMART). Keep recommendations practical, aligned with telecom industry standards, and actionable for both employee and HR. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems."
    };

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
            content: systemPrompts[context as keyof typeof systemPrompts] || systemPrompts.hr_assistant
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      response: aiResponse,
      context: context 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to process AI chat request'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});