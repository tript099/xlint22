import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currentContent, updateRequest, jobDescription } = await req.json();
    
    let openAIApiKey = Deno.env.get('LITELLM_API_KEY');
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    }
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
    }
    if (!openAIApiKey) {
      console.error('No API key found in environment');
      throw new Error('API key not configured');
    }

    // Extract structured data from the job description
    const jobIdentity = jobDescription?.job_identity || {};
    const keyContacts = jobDescription?.key_contacts || {};
    const competencies = jobDescription?.competencies || {};

    const systemPrompt = `You are an expert HR professional specializing in job description updates. Your task is to update the provided job description based on the user's request while maintaining the structured template format.

IMPORTANT: First, determine if the user is asking to SEE the job description or to UPDATE it:
- If the user says "show me", "display", "view", "see", "preview" - they want to see the current JD, NOT update it
- If the user says "update", "change", "modify", "edit", "add", "remove" - they want to update the JD

CRITICAL REQUIREMENTS:
1. ALWAYS return a valid JSON object with the exact structure specified below
2. Maintain all existing structured fields (job_identity, key_contacts, competencies)
3. Only update the specific fields requested by the user (if it's an update request)
4. Keep all other content unchanged unless explicitly requested to modify
5. Ensure all text is professional and well-formatted
6. Do not add any explanatory text outside the JSON structure

REQUIRED JSON STRUCTURE:
{
  "title": "string",
  "summary": "string",
  "responsibilities": ["string array"],
  "required_qualifications": ["string array"],
  "preferred_qualifications": ["string array"],
  "required_skills": ["string array"],
  "preferred_skills": ["string array"],
  "salary_range_min": number,
  "salary_range_max": number,
  "currency": "string",
  "experience_level": "string",
  "education_level": "string",
  "employment_type": "string",
  "location_type": "string",
  "job_identity": {
    "positionTitle": "string",
    "directorate": "string",
    "division": "string (optional)",
    "department": "string (optional)",
    "directSupervisor": "string",
    "directSubordinate": ["string array"]
  },
  "key_contacts": {
    "internal": ["string array"],
    "external": ["string array"]
  },
  "competencies": {
    "functional": {
      "academyQualifications": "string",
      "professionalExperience": "string",
      "certificationLicense": "string",
      "expertise": ["string array"]
    },
    "leadership": {
      "strategicAccountability": "string",
      "customerCentric": "string",
      "coalitionBuilding": "string",
      "peopleFirst": "string",
      "agileLeadership": "string",
      "resultDriven": "string",
      "technologySavvy": "string"
    }
  }
}`;

    const userPrompt = `Please process the following request: "${updateRequest}"

CURRENT JOB DESCRIPTION DATA:
${JSON.stringify(jobDescription, null, 2)}

CURRENT CONTENT:
${currentContent}

INSTRUCTIONS:
1. If the user is asking to SEE/SHOW the job description, return the current data unchanged
2. If the user is asking to UPDATE/MODIFY the job description, update ONLY the fields that need to be changed
3. Keep all existing structured data intact unless specifically requested to modify
4. Ensure all arrays remain as arrays and objects remain as objects
5. Return ONLY the complete JSON object with all fields included
6. Do not add any text before or after the JSON object`;

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiteLLM API error:', errorText);
      throw new Error(`LiteLLM API error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;

    // Try to parse the JSON response
    let updatedJobDescription;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        updatedJobDescription = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI Response:', aiResponse);
      throw new Error('AI returned invalid JSON format');
    }

    // Create a formatted text version for display
    const formattedText = formatJobDescriptionForDisplay(updatedJobDescription);

    return new Response(JSON.stringify({
      success: true,
      updatedContent: formattedText,
      updatedJobDescription: updatedJobDescription,
      message: 'Job description updated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI JD updater:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      message: 'Failed to update job description'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatJobDescriptionForDisplay(jd: any): string {
  return `**JOB DESCRIPTION**

**1. JOB IDENTITY**
**Position Title:** ${jd.job_identity?.positionTitle || jd.title || 'Not specified'}
**Directorate:** ${jd.job_identity?.directorate || 'Not specified'}
${jd.job_identity?.division ? `**Division:** ${jd.job_identity.division}` : ''}
${jd.job_identity?.department ? `**Department:** ${jd.job_identity.department}` : ''}
**Direct Supervisor:** ${jd.job_identity?.directSupervisor || 'Not specified'}
${jd.job_identity?.directSubordinate && jd.job_identity.directSubordinate.length > 0 ? `**Direct Subordinate:**
${jd.job_identity.directSubordinate.map((sub: string, index: number) => `${index + 1}. ${sub}`).join('\n')}` : ''}

**2. JOB PURPOSES**
${jd.summary || 'Not specified'}

**3. MAIN RESPONSIBILITY**
${Array.isArray(jd.responsibilities) && jd.responsibilities.length > 0 ? 
  jd.responsibilities.map((resp: string, index: number) => `${index + 1}. ${resp}`).join('\n\n') : 
  'Not specified'}

**4. KEY OUTPUT**
${Array.isArray(jd.required_qualifications) && jd.required_qualifications.length > 0 ? 
  jd.required_qualifications.map((qual: string) => `• ${qual}`).join('\n') : 
  'Not specified'}

**5. KEY CONTACTS & RELATIONSHIP**
**Internal:**
${jd.key_contacts?.internal && jd.key_contacts.internal.length > 0 ? 
  jd.key_contacts.internal.map((contact: string, index: number) => `${index + 1}. ${contact}`).join('\n') : 
  'Not specified'}

**External:**
${jd.key_contacts?.external && jd.key_contacts.external.length > 0 ? 
  jd.key_contacts.external.map((contact: string, index: number) => `${index + 1}. ${contact}`).join('\n') : 
  'Not specified'}

**6. COMPETENCY SECTION**

**A. FUNCTIONAL COMPETENCY**
${jd.competencies?.functional ? `
**Academy Qualifications:** ${jd.competencies.functional.academyQualifications}
**Professional Experience:** ${jd.competencies.functional.professionalExperience}
**Certification/License:** ${jd.competencies.functional.certificationLicense}
**Expertise:** ${Array.isArray(jd.competencies.functional.expertise) ? jd.competencies.functional.expertise.join(', ') : jd.competencies.functional.expertise}
` : 'Not specified'}

**B. LEADERSHIP COMPETENCY**
${jd.competencies?.leadership ? `
**Strategic accountability:** ${jd.competencies.leadership.strategicAccountability}
**Customer centric:** ${jd.competencies.leadership.customerCentric}
**Coalition Building:** ${jd.competencies.leadership.coalitionBuilding}
**People First:** ${jd.competencies.leadership.peopleFirst}
**Agile Leadership:** ${jd.competencies.leadership.agileLeadership}
**Result Driven:** ${jd.competencies.leadership.resultDriven}
**Technology Savvy:** ${jd.competencies.leadership.technologySavvy}
` : 'Not specified'}`.trim();
}