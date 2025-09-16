import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { jobDescriptionId, recommendations } = await req.json();

    console.log(`Fixing job description ${jobDescriptionId} with recommendations:`, recommendations);

    // Get the current job description
    const { data: jobDescription, error: fetchError } = await supabase
      .from('xlsmart_job_descriptions')
      .select('*')
      .eq('id', jobDescriptionId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch job description: ${fetchError.message}`);
    }

    // Prepare the fix prompt
    const systemPrompt = `You are an expert HR professional specializing in job description optimization. Your task is to improve the provided job description based on specific recommendations while maintaining its core structure and professional tone.

    Key Instructions:
    1. Apply ONLY the specific recommendations provided
    2. Maintain the original structure and format
    3. Keep all existing content that doesn't need improvement
    4. Use professional, inclusive language
    5. Return the complete improved job description in JSON format
    6. Do not add unnecessary information not requested in recommendations`;

    const userPrompt = `Please improve this job description based on the following specific recommendations:

    CURRENT JOB DESCRIPTION:
    Title: ${jobDescription.title}
    Summary: ${jobDescription.summary}
    Responsibilities: ${JSON.stringify(jobDescription.responsibilities)}
    Required Qualifications: ${JSON.stringify(jobDescription.required_qualifications)}
    Preferred Qualifications: ${JSON.stringify(jobDescription.preferred_qualifications)}
    Required Skills: ${JSON.stringify(jobDescription.required_skills)}
    Preferred Skills: ${JSON.stringify(jobDescription.preferred_skills)}
    Experience Level: ${jobDescription.experience_level}
    Education Level: ${jobDescription.education_level}
    Employment Type: ${jobDescription.employment_type}
    Location Type: ${jobDescription.location_type}

    SPECIFIC RECOMMENDATIONS TO APPLY:
    ${recommendations.map((rec: string, i: number) => `${i + 1}. ${rec}`).join('\n')}

    Please return the improved job description in this exact JSON format:
    {
      "title": "improved title if needed",
      "summary": "improved summary",
      "responsibilities": ["improved responsibility 1", "improved responsibility 2", ...],
      "required_qualifications": ["improved qualification 1", "improved qualification 2", ...],
      "preferred_qualifications": ["improved qualification 1", "improved qualification 2", ...],
      "required_skills": ["improved skill 1", "improved skill 2", ...],
      "preferred_skills": ["improved skill 1", "improved skill 2", ...],
      "improvements_made": ["description of improvement 1", "description of improvement 2", ...]
    }`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 3000,
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;

    console.log('AI Response received for job description fix');

    // Parse the AI response
    let improvements;
    try {
      // Clean the response if it has markdown formatting
      const cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```/g, '');
      improvements = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI improvements');
    }

    // Update the job description in the database
    const updateData = {
      title: improvements.title || jobDescription.title,
      summary: improvements.summary || jobDescription.summary,
      responsibilities: improvements.responsibilities || jobDescription.responsibilities,
      required_qualifications: improvements.required_qualifications || jobDescription.required_qualifications,
      preferred_qualifications: improvements.preferred_qualifications || jobDescription.preferred_qualifications,
      required_skills: improvements.required_skills || jobDescription.required_skills,
      preferred_skills: improvements.preferred_skills || jobDescription.preferred_skills,
      status: 'review', // Mark as review after AI improvements
      updated_at: new Date().toISOString()
    };

    const { data: updatedJD, error: updateError } = await supabase
      .from('xlsmart_job_descriptions')
      .update(updateData)
      .eq('id', jobDescriptionId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update job description: ${updateError.message}`);
    }

    console.log('Job description updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        updatedJobDescription: updatedJD,
        improvementsMade: improvements.improvements_made || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in job description fix:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});