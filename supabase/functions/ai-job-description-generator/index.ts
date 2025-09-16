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
    console.log('=== JD Generator Function Started ===');
    
    // Get current user ID from authorization header
    const authHeader = req.headers.get('authorization');
    let userId = 'd77125e3-bb96-442c-a2d1-80f15baf497d'; // Default fallback
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub || userId;
        console.log('Extracted user ID from token:', userId);
      } catch (e) {
        console.log('Could not extract user ID from token, using fallback');
      }
    }

    const requestBody = await req.json();
    console.log('Request body:', requestBody);

    const { 
      roleTitle, 
      department = '', 
      level = '', 
      standardRoleId = null, // Optional link to standard role
      employmentType = 'full_time',
      locationStatus = 'office',
      salaryRange = '',
      requirements = '',
      customInstructions = '',
      tone = 'professional',
      language = 'en'
    } = requestBody;

    console.log('Parsed inputs:', { roleTitle, department, level });

    if (!roleTitle) {
      throw new Error('Role title is required');
    }

    let openAIApiKey = Deno.env.get('LITELLM_API_KEY');
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    }
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
    }
    if (!openAIApiKey) {
      console.error('Neither LITELLM_API_KEY, OPENAI_API_KEY nor OPENAI_API_KEY_NEW found in environment');
      throw new Error('API key not configured');
    }
    
    console.log('API key found, proceeding with AI generation...');

    // Build AI prompt
    const aiPrompt = `You are an expert HR professional and job description writer for large telecommunications companies like XLSMART. Generate a complete job description following the EXACT template structure provided below.

Create a comprehensive job description for the following role:

ROLE DETAILS:
- Position: ${roleTitle}
- Department: ${department}
- Level: ${level}
- Employment Type: ${employmentType}
- Work Location: ${locationStatus}
- Salary Range: ${salaryRange || 'Competitive package'}

ADDITIONAL REQUIREMENTS:
${requirements || 'Standard telecommunications industry requirements'}

CUSTOM INSTRUCTIONS:
${customInstructions}

TONE: ${tone}
LANGUAGE: ${language}

IMPORTANT: Follow this EXACT template structure and format:

**1. JOB IDENTITY**
Create a table with "Field" and "Detail" columns:
- Position Title: [Use the exact role title provided or generate a professional title]
- Directorate: [Generate appropriate directorate based on department/function - e.g., "Technology", "Operations", "Sales & Marketing", "Finance", "Human Resources"]
- Division: [Generate appropriate division within the directorate - e.g., "Network Operations", "Customer Service", "Enterprise Sales", "Financial Planning"]
- Department: [Use the provided department or generate specific department name]
- Direct Supervisor: [Generate immediate supervisor role - e.g., "Senior Manager", "Department Head", "Team Lead", "Director"]
- Direct Subordinate: [Generate 3-8 realistic subordinate roles with numbers - e.g., "5 Customer Service Representatives", "3 Technical Support Specialists"]

**2. JOB PURPOSES**
Write 1 comprehensive paragraph (2-3 sentences) describing the overarching purpose and strategic impact of the role.

**3. MAIN RESPONSIBILITY**
Provide 3-4 numbered paragraphs, each describing a major responsibility area with strategic focus.

**4. KEY OUTPUT**
List 3-5 bullet points of expected deliverables and outcomes.

**5. KEY CONTACTS & RELATIONSHIP**
- Internal: 1-2 numbered points about internal relationships
- External: 1-2 numbered points about external stakeholders

**6. COMPETENCY SECTION**

A. FUNCTIONAL COMPETENCY
- Academy Qualifications: Education requirements
- Professional Experience: Years and type of experience
- Certification/License: Relevant certifications
- Expertise: 2-3 areas of technical expertise

B. LEADERSHIP COMPETENCY
Create a table with Competency and Level columns for:
- Strategic accountability
- Customer centric
- Coalition Building
- People First
- Agile Leadership
- Result Driven
- Technology Savvy
(All should be "Mastery" level for senior roles)

Respond in JSON format:
{
  "title": "Generated job title",
  "summary": "Job Purposes paragraph",
  "responsibilities": ["Main Responsibility 1", "Main Responsibility 2", "Main Responsibility 3", "Main Responsibility 4"],
  "requiredQualifications": ["Academy Qualifications", "Professional Experience", "Certification/License"],
  "preferredQualifications": ["Expertise areas"],
  "benefits": ["Key Output 1", "Key Output 2", "Key Output 3"],
  "fullDescription": "Complete formatted job description with all sections",
  "keywords": ["keyword 1", "keyword 2", "keyword 3"],
  "estimatedSalary": {
    "min": 75000,
    "max": 120000,
    "currency": "IDR"
  },
  "jobIdentity": {
    "positionTitle": "Generated title",
    "directorate": "Department/Function",
    "division": "Division if applicable",
    "department": "Specific department",
    "directSupervisor": "Immediate supervisor",
    "directSubordinate": ["Subordinate 1", "Subordinate 2", "Subordinate 3"]
  },
  "keyContacts": {
    "internal": ["Internal relationship 1", "Internal relationship 2"],
    "external": ["External relationship 1", "External relationship 2"]
  },
  "competencies": {
    "functional": {
      "academyQualifications": "Education requirements",
      "professionalExperience": "Experience requirements",
      "certificationLicense": "Certification requirements",
      "expertise": ["Expertise area 1", "Expertise area 2", "Expertise area 3"]
    },
    "leadership": {
      "strategicAccountability": "Mastery",
      "customerCentric": "Mastery",
      "coalitionBuilding": "Mastery",
      "peopleFirst": "Mastery",
      "agileLeadership": "Mastery",
      "resultDriven": "Mastery",
      "technologySavvy": "Mastery"
    }
  }
}`;

    console.log('Making request to LiteLLM API...');

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
            content: 'You are an expert HR professional and job description writer for large telecommunications companies like XLSMART. Based on the provided inputs, generate a complete job description that is clear, professional, and aligned with telecom industry standards. CRITICAL: Fill ALL fields with realistic, specific data - never use "-" or leave fields empty. Generate appropriate directorates, divisions, departments, supervisors, and subordinates based on the role context. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART\'s HR systems.' 
          },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 3000,
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
    
    let generatedJD;
    try {
      generatedJD = JSON.parse(aiData.choices[0].message.content);
      console.log('Successfully parsed AI response');
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiData.choices[0]?.message?.content);
      throw new Error('Failed to generate job description - invalid AI response format');
    }

    // Save to database with proper role linking
    console.log('Saving to database...');
    const insertData = {
      title: generatedJD.title,
      summary: generatedJD.summary,
      responsibilities: generatedJD.responsibilities,
      required_qualifications: generatedJD.requiredQualifications,
      preferred_qualifications: generatedJD.preferredQualifications,
      required_skills: [],
      preferred_skills: [],
      salary_range_min: generatedJD.estimatedSalary?.min,
      salary_range_max: generatedJD.estimatedSalary?.max,
      currency: generatedJD.estimatedSalary?.currency || 'IDR',
      experience_level: level,
      education_level: 'bachelor',
      employment_type: employmentType,
      location_type: locationStatus,
      ai_generated: true,
      generated_by: userId,
      ai_prompt_used: aiPrompt.substring(0, 1000), // Truncate if too long
      tone: tone,
      language: language,
      status: 'draft',
      // New structured template fields
      job_identity: generatedJD.jobIdentity || null,
      key_contacts: generatedJD.keyContacts || null,
      competencies: generatedJD.competencies || null,
      template_version: 'structured_v1', // Track template version
      ...(standardRoleId && { standard_role_id: standardRoleId }) // Link to role if provided
    };

    const { data: savedJD, error: saveError } = await supabaseService
      .from('xlsmart_job_descriptions')
      .insert(insertData)
      .select()
      .single();

    if (saveError) {
      console.error('Error saving job description:', saveError);
      // Continue anyway, return the generated content
    } else {
      console.log('Successfully saved to database with ID:', savedJD?.id);
    }

    console.log('=== JD Generation Complete ===');

    return new Response(JSON.stringify({
      success: true,
      jobDescription: generatedJD,
      saved: !saveError,
      id: savedJD?.id,
      message: 'Job description generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== ERROR in JD Generator ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      message: 'Failed to generate job description'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});