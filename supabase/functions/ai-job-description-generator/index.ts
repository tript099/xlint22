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

// OPTIMIZATION: Cache API key at module level
let cachedApiKey: string | null = null;

const getApiKey = (): string => {
  if (cachedApiKey) return cachedApiKey;
  
  cachedApiKey = Deno.env.get('LITELLM_API_KEY') || 
                 Deno.env.get('OPENAI_API_KEY') || 
                 Deno.env.get('OPENAI_API_KEY_NEW') || null;
  
  if (!cachedApiKey) {
    throw new Error('API key not configured');
  }
  
  return cachedApiKey;
};

// OPTIMIZATION: Improved JSON sanitizer for better parsing
const safeJsonParse = (str: string) => {
  try {
    // Remove potential markdown code blocks
    let cleaned = str.replace(/```json\s*/, '').replace(/```\s*$/, '');
    
    // Fix common JSON issues
    cleaned = cleaned
      .trim()
      .replace(/,\s*}/g, "}") // Remove trailing commas in objects
      .replace(/,\s*]/g, "]") // Remove trailing commas in arrays
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Remove control characters
    
    return JSON.parse(cleaned);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'JSON parsing failed';
    console.error('JSON parse failed for:', str);
    throw new Error(`Invalid JSON response: ${errorMessage}`);
  }
};

// OPTIMIZATION: Process roles in batches with error tolerance
const processRolesBatch = async (roles: any[], userId: string) => {
  const batchSize = 5; // Process 5 roles per AI call
  const allResults: any[] = [];
  const errors: any[] = [];
  
  for (let i = 0; i < roles.length; i += batchSize) {
    const batch = roles.slice(i, i + batchSize);
    
    try {
      const batchResults = await generateBatchJobDescriptions(batch, userId);
      
      // GUARD: Check if AI returned expected count
      if (batchResults.length !== batch.length) {
        console.warn(`AI returned ${batchResults.length} JDs, expected ${batch.length} for batch ${i/batchSize + 1}`);
        
        // Pad with null if fewer returned
        while (batchResults.length < batch.length) {
          batchResults.push(null);
        }
        
        // Truncate if more returned
        if (batchResults.length > batch.length) {
          batchResults.splice(batch.length);
        }
      }
      
      allResults.push(...batchResults);
    } catch (error) {
      console.error(`Error processing batch ${i/batchSize + 1}:`, error);
      
      // Add null placeholders for failed batch
      const nullResults = new Array(batch.length).fill(null);
      allResults.push(...nullResults);
      
      errors.push({
        batchIndex: i/batchSize + 1,
        roles: batch.map(r => r.position || r.roleTitle),
        error: error instanceof Error ? error.message : 'Unknown batch processing error'
      });
    }
  }
  
  return { results: allResults, errors };
};

// OPTIMIZATION: Generate multiple JDs in one AI call
const generateBatchJobDescriptions = async (roles: any[], userId: string) => {
  console.log(`Generating batch of ${roles.length} job descriptions...`);
  
  const rolesText = roles.map((role, index) => `
Role ${index + 1}:
- Position: ${role.position || role.roleTitle}
- Department: ${role.department || ''}
- Level: ${role.experienceLevel || role.level || ''}
- Employment Type: ${role.employmentType || 'full_time'}
- Location: ${role.locationType || role.locationStatus || 'office'}
- Salary Range: ${role.salaryRange || 'Competitive package'}
- Requirements: ${role.specificRequirements || role.requirements || 'Standard telecommunications industry requirements'}
- Company Values: ${role.companyValues || ''}
- Benefits: ${role.benefits || ''}
- Custom Instructions: ${role.customInstructions || ''}
- Standard Role ID: ${role.selectedStandardRole || role.standardRoleId || ''}
`).join('\n');

  const aiPrompt = `You are an expert HR professional and job description writer for large telecommunications companies like XLSMART. Generate complete job descriptions for the following ${roles.length} roles.

${rolesText}

IMPORTANT: Return a JSON array with ${roles.length} job description objects. Each object must follow this EXACT structure:

{
  "title": "Generated job title",
  "summary": "Job Purposes paragraph (2-3 sentences)",
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
}

CRITICAL: Return ONLY a valid JSON array of ${roles.length} objects. Fill ALL fields with realistic, specific data - never use "-" or leave fields empty.`;

  const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'azure/gpt-4.1',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert HR professional and job description writer for large telecommunications companies like XLSMART. Generate complete job descriptions that are clear, professional, and aligned with telecom industry standards. CRITICAL: Fill ALL fields with realistic, specific data - never use "-" or leave fields empty. Always return valid JSON arrays when processing multiple roles.' 
        },
        { role: 'user', content: aiPrompt }
      ],
      temperature: 0.7,
      max_completion_tokens: 4000, // Increased for batch processing
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LiteLLM API error:', errorText);
    throw new Error(`LiteLLM API error: ${response.statusText}`);
  }

  const aiData = await response.json();
  
  let generatedJDs;
  try {
    const content = aiData.choices[0].message.content;
    generatedJDs = safeJsonParse(content);
    
    // Ensure we have an array
    if (!Array.isArray(generatedJDs)) {
      generatedJDs = [generatedJDs];
    }
    
    console.log(`Successfully parsed ${generatedJDs.length} job descriptions`);
  } catch (parseError) {
    console.error('Failed to parse AI response:', aiData.choices[0]?.message?.content);
    throw new Error('Failed to generate job descriptions - invalid AI response format');
  }

  return generatedJDs;
};

// OPTIMIZATION: Bulk database insert
const saveBatchToDatabase = async (generatedJDs: any[], roles: any[], userId: string) => {
  console.log(`Saving ${generatedJDs.length} job descriptions to database...`);
  
  const insertData = generatedJDs.map((generatedJD, index) => {
    const role = roles[index] || {};
    return {
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
      experience_level: role.experienceLevel || role.level || '',
      education_level: 'bachelor',
      employment_type: role.employmentType || 'full_time',
      location_type: role.locationType || role.locationStatus || 'office',
      ai_generated: true,
      generated_by: userId,
      ai_prompt_used: `Batch generated for ${role.position || role.roleTitle}`,
      tone: role.tone || 'professional',
      language: role.language || 'en',
      status: 'draft',
      job_identity: generatedJD.jobIdentity || null,
      key_contacts: generatedJD.keyContacts || null,
      competencies: generatedJD.competencies || null,
      template_version: 'structured_v2_batch',
      ...(role.selectedStandardRole && { standard_role_id: role.selectedStandardRole }),
      ...(role.standardRoleId && { standard_role_id: role.standardRoleId })
    };
  });

  // OPTIMIZATION: Single bulk insert instead of N individual inserts
  const { data: savedJDs, error: saveError } = await supabaseService
    .from('xlsmart_job_descriptions')
    .insert(insertData)
    .select();

  if (saveError) {
    console.error('Error saving job descriptions:', saveError);
    throw new Error(`Database save failed: ${saveError.message}`);
  }

  console.log(`Successfully saved ${savedJDs?.length || 0} job descriptions to database`);
  return savedJDs;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Optimized JD Generator Function Started ===');
    
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
    console.log('Request body received');

    // OPTIMIZATION: Support both single role and bulk generation
    let roles: any[] = [];
    
    if (requestBody.roles && Array.isArray(requestBody.roles)) {
      // Bulk generation mode
      roles = requestBody.roles;
      console.log(`Bulk generation mode: ${roles.length} roles`);
    } else {
      // Single role mode (backward compatibility)
      const { 
        roleTitle, 
        position,
        department = '', 
        level = '', 
        experienceLevel = '',
        standardRoleId = null,
        selectedStandardRole = null,
        employmentType = 'full_time',
        locationType = 'office',
        locationStatus = 'office',
        salaryRange = '',
        specificRequirements = '',
        requirements = '',
        customInstructions = '',
        tone = 'professional',
        language = 'en',
        companyValues = '',
        benefits = '',
        urgency = 'normal',
        useStandardRole = false
      } = requestBody;

      // Validate required fields
      if (!roleTitle && !position) {
        throw new Error('Role title or position is required');
      }

      roles = [{
        position: position || roleTitle,
        roleTitle: roleTitle || position,
        department,
        level,
        experienceLevel,
        standardRoleId,
        selectedStandardRole,
        employmentType,
        locationType: locationType || locationStatus,
        locationStatus: locationStatus || locationType,
        salaryRange,
        specificRequirements: specificRequirements || requirements,
        requirements: requirements || specificRequirements,
        customInstructions,
        tone,
        language,
        companyValues,
        benefits,
        urgency,
        useStandardRole
      }];
      console.log('Single role mode: 1 role');
    }

    if (roles.length === 0) {
      throw new Error('No roles provided for generation');
    }

    // OPTIMIZATION: Process roles in batches
    const startTime = Date.now();
    const batchResult = await processRolesBatch(roles, userId);
    const generatedJDs = batchResult.results;
    const batchErrors = batchResult.errors;
    console.log(`AI generation completed in ${Date.now() - startTime}ms`);

    // Filter out null results (failed generations)
    const validJDs = generatedJDs.filter(jd => jd !== null);
    const failedCount = generatedJDs.length - validJDs.length;

    if (validJDs.length === 0) {
      throw new Error('All job description generations failed');
    }

    // OPTIMIZATION: Bulk save to database (only valid JDs)
    const roleIndexes = generatedJDs.map((jd, index) => jd !== null ? index : null).filter(i => i !== null);
    const validRoles = roleIndexes.map(index => roles[index]);
    const savedJDs = await saveBatchToDatabase(validJDs, validRoles, userId);

    const endTime = Date.now();
    console.log(`=== JD Generation Complete in ${endTime - startTime}ms ===`);

    // Return response based on mode
    if (roles.length === 1) {
      // Single role response (backward compatibility)
      if (validJDs.length === 0) {
        throw new Error('Job description generation failed');
      }
      
      return new Response(JSON.stringify({
        success: true,
        jobDescription: validJDs[0],
        saved: true,
        id: savedJDs?.[0]?.id,
        message: 'Job description generated successfully',
        processingTime: endTime - startTime,
        ...(batchErrors.length > 0 && { warnings: batchErrors })
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Bulk response
      return new Response(JSON.stringify({
        success: true,
        jobDescriptions: validJDs,
        saved: true,
        ids: savedJDs?.map((jd: any) => jd.id) || [],
        count: validJDs.length,
        total: roles.length,
        failed: failedCount,
        message: `${validJDs.length} of ${roles.length} job descriptions generated successfully`,
        processingTime: endTime - startTime,
        averageTimePerJD: validJDs.length > 0 ? Math.round((endTime - startTime) / validJDs.length) : 0,
        ...(batchErrors.length > 0 && { errors: batchErrors })
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : String(error);
    
    console.error('=== ERROR in Optimized JD Generator ===');
    console.error('Error message:', errorMessage);
    console.error('Error stack:', errorStack);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      message: 'Failed to generate job description(s)',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});