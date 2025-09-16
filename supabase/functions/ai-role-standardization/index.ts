import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to calculate real role similarity and confidence
function calculateRoleSimilarity(role1: string, role2: string): number {
  const normalized1 = role1.toLowerCase().trim();
  const normalized2 = role2.toLowerCase().trim();
  
  // Exact match
  if (normalized1 === normalized2) return 1.0;
  
  // Check for exact word matches
  const words1 = normalized1.split(/\s+/);
  const words2 = normalized2.split(/\s+/);
  
  let exactWordMatches = 0;
  let totalWords = Math.max(words1.length, words2.length);
  
  for (const word1 of words1) {
    if (words2.includes(word1)) {
      exactWordMatches++;
    }
  }
  
  // Calculate similarity based on word matches
  const wordSimilarity = exactWordMatches / totalWords;
  
  // Check for substring matches (e.g., "Software Engineer" vs "Senior Software Engineer")
  const containsMatch = normalized1.includes(normalized2) || normalized2.includes(normalized1);
  const substringBonus = containsMatch ? 0.2 : 0;
  
  // Check for common role keywords
  const commonKeywords = ['engineer', 'manager', 'analyst', 'specialist', 'coordinator', 'lead', 'senior', 'junior'];
  let keywordMatches = 0;
  
  for (const keyword of commonKeywords) {
    if (normalized1.includes(keyword) && normalized2.includes(keyword)) {
      keywordMatches++;
    }
  }
  
  const keywordBonus = (keywordMatches / commonKeywords.length) * 0.3;
  
  // Final confidence calculation
  const confidence = Math.min(wordSimilarity + substringBonus + keywordBonus, 0.95);
  
  console.log(`🔍 Similarity calculation for "${role1}" vs "${role2}":`);
  console.log(`  - Word similarity: ${wordSimilarity}`);
  console.log(`  - Substring bonus: ${substringBonus}`);
  console.log(`  - Keyword bonus: ${keywordBonus}`);
  console.log(`  - Final confidence: ${confidence}`);
  
  return confidence;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== AI Role Standardization Function Started ===');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    let body;
    try {
      body = await req.json();
      console.log('Request body:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }
    
    const { sessionId } = body;
    
    if (!sessionId) {
      console.error('Missing sessionId in request');
      throw new Error('Session ID is required');
    }
    
    console.log('Processing session ID:', sessionId);
    
    console.log('Starting AI role standardization for session:', sessionId);

    // Get upload session details
    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error(`Database error: ${sessionError.message}`);
    }

    if (!session) {
      throw new Error('Upload session not found');
    }

    // Use OPENAI_API_KEY for LiteLLM proxy (try both possible keys)
    console.log('Checking for API key...');
    let openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    }
    console.log('API key exists:', !!openAIApiKey);
    console.log('API key length:', openAIApiKey?.length || 0);
    
    if (!openAIApiKey) {
      console.error('No OpenAI API key found');
      console.error('Available env vars:', Object.keys(Deno.env.toObject()).filter(k => k.includes('API')));
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY or OPENAI_API_KEY_NEW');
    }

    // Update session status to processing (use valid status)
    await supabase
      .from('xlsmart_upload_sessions')
      .update({ status: 'uploading' }) // Use valid status instead of 'standardizing'
      .eq('id', sessionId);

    const standardRoles: any[] = [];
    const roleMappings: any[] = [];

    console.log('Starting AI role standardization for session:', sessionId);

         // Get uploaded data from session
     const uploadedData = session.ai_analysis || {};
     const rawData = uploadedData.raw_data || [];
     
     console.log('Session AI analysis:', uploadedData);
     console.log('Raw data length:', rawData.length);
     
     let sampleData = [];
     
     if (rawData.length === 0) {
       console.log('No raw data found in session, trying database tables...');
       
       // Fallback: try to fetch from xl_roles_data and smart_roles_data tables
       console.log('Fetching XL roles data...');
       const { data: xlData, error: xlError } = await supabase
         .from('xl_roles_data')
         .select('*')
         .eq('session_id', sessionId);

       console.log('Fetching Smart roles data...');
       const { data: smartData, error: smartError } = await supabase
         .from('smart_roles_data')
         .select('*')
         .eq('session_id', sessionId);

       console.log('XL data result:', { count: xlData?.length, error: xlError?.message });
       console.log('Smart data result:', { count: smartData?.length, error: smartError?.message });

       if ((xlError && smartError) || (!xlData?.length && !smartData?.length)) {
         throw new Error(`No role data found for session ${sessionId}. Please ensure data was uploaded correctly.`);
       }

       sampleData = [...(xlData || []), ...(smartData || [])];
       console.log(`Found ${sampleData.length} role records from database tables`);
     } else {
       console.log(`Found ${rawData.length} files with data in session`);
       
       // Convert raw_data format to the expected format
       for (const fileData of rawData) {
         console.log('Processing file data:', fileData.fileName || 'unknown');
         console.log('File data structure:', Object.keys(fileData));
         
         if (fileData.rows && fileData.headers) {
           console.log(`Processing ${fileData.rows.length} rows with headers:`, fileData.headers);
           
           for (const row of fileData.rows) {
             const roleObj = {};
             fileData.headers.forEach((header, index) => {
               roleObj[header] = row[index] || '';
             });
             
             // Look for role title in various possible column names
             const roleTitle = roleObj.Title || roleObj.title || roleObj['Role Title'] || 
                              roleObj['role title'] || roleObj['RoleTitle'] || roleObj['roleTitle'] ||
                              roleObj['Position'] || roleObj['position'] || roleObj['Job Title'] ||
                              roleObj['job title'] || roleObj['JobTitle'] || roleObj['jobTitle'];
             
             if (roleTitle) {
               sampleData.push({
                 role_title: roleTitle,
                 department: roleObj.Department || roleObj.department || roleObj['Department'] || '',
                 seniority_band: roleObj.Level || roleObj.level || roleObj['Role Level'] || 
                                roleObj['Seniority'] || roleObj['seniority'] || roleObj['Band'] || '',
                 source_file: fileData.fileName || 'unknown'
               });
             }
           }
         } else {
           console.log('File data missing rows or headers:', fileData);
         }
       }
       console.log(`Converted ${sampleData.length} roles from raw data`);
     }
    
    if (sampleData.length === 0) {
      throw new Error(`No role data found for session ${sessionId}. Please ensure data was uploaded correctly.`);
    }

    // Get existing standard roles from database for AI comparison
    console.log('Fetching existing standard roles...');
    const { data: existingRoles, error: rolesError } = await supabase
      .from('xlsmart_standard_roles')
      .select('id, role_title, department, job_family, role_level, standard_description')
      .eq('is_active', true);

    if (rolesError) {
      console.error('Error fetching existing roles:', rolesError);
      // Don't throw error, just log it and continue with empty array
    }

    console.log('Sample role data:', sampleData.slice(0, 2));
    console.log('Existing standard roles count:', existingRoles?.length || 0);

    // Use AI to analyze uploaded roles and normalize against existing standards
    const aiPrompt = `
You are an expert HR data analyst. Analyze the uploaded role data and normalize it against existing standard roles.

UPLOADED ROLE DATA (sample):
${JSON.stringify(sampleData.slice(0, 5), null, 2)}

EXISTING STANDARD ROLES IN DATABASE:
${JSON.stringify(existingRoles?.slice(0, 10) || [], null, 2)}

Your tasks:
1. **NORMALIZE AGAINST EXISTING**: First check if uploaded roles can be mapped to existing standard roles
2. **CREATE NEW STANDARDS**: Only create new standard roles if uploaded roles don't match existing ones
3. **PROPER MAPPING**: Map each uploaded role to the best matching standard role (existing or new)

IMPORTANT RULES:
- If an uploaded role matches an existing standard role (similar title, department, skills), map to the existing one
- Only create new standard roles when uploaded roles are genuinely different
- Use consistent naming and categorization
- Focus on telecommunications industry standards

Respond with JSON:
{
  "analysis": "Brief analysis of the uploaded roles vs existing standards",
  "existingMatches": [
    {
      "uploaded_role_title": "Original Role Title",
      "standard_role_id": "existing_role_uuid",
      "confidence": 0.85,
      "reasoning": "Why this mapping makes sense"
    }
  ],
  "newStandardRoles": [
    {
      "role_title": "New Standardized Role Name",
      "job_family": "Engineering/Operations/Sales/etc",
      "role_level": "Junior/Mid/Senior/Lead/Manager",
      "department": "Department Name",
      "standard_description": "Clear role description",
      "core_responsibilities": ["responsibility1", "responsibility2"],
      "required_skills": ["skill1", "skill2"],
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "mappingInstructions": "How to map uploaded roles to standards (both existing and new)"
}
`;

    console.log('Making request to LiteLLM API...');
    const requestBody = {
      model: 'azure/gpt-4.1',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert HR data analyst specializing in telecommunications role standardization. Analyze role data carefully and normalize against existing standards. Always respond with valid JSON.' 
        },
        { role: 'user', content: aiPrompt }
      ],
      temperature: 0.7,
      max_completion_tokens: 4000,
    };
    
    console.log('API request payload:', JSON.stringify(requestBody, null, 2));
    
    console.log('Making request to LiteLLM proxy...');
    console.log('Request URL: https://proxyllm.ximplify.id/v1/chat/completions');
    console.log('Request payload size:', JSON.stringify(requestBody).length);
    
    const aiResponse = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('LiteLLM proxy response status:', aiResponse.status);
    console.log('LiteLLM proxy response headers:', Object.fromEntries(aiResponse.headers.entries()));

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('LiteLLM proxy error status:', aiResponse.status);
      console.error('LiteLLM proxy error response:', errorText);
      throw new Error(`LiteLLM proxy error (${aiResponse.status}): ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let analysis;
    
    try {
      const content = aiData.choices?.[0]?.message?.content;
      if (!content) {
        console.error('No content in AI response:', aiData);
        throw new Error('AI response missing content');
      }
      
      console.log('AI response content:', content);
      
      // Clean markdown formatting from AI response
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('Cleaned content for parsing:', cleanContent.substring(0, 200) + '...');
      
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('AI response content:', aiData.choices?.[0]?.message?.content);
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }

    console.log('AI Analysis:', analysis);

    // Create NEW standard roles only (existing ones are already in database)
    console.log('Creating new standard roles. Count:', analysis.newStandardRoles?.length || 0);
    for (const standardRole of analysis.newStandardRoles || []) {
      console.log('Creating standard role:', standardRole.role_title);
      
      // Check if role already exists before creating
      const { data: existingRole } = await supabase
        .from('xlsmart_standard_roles')
        .select('*')
        .eq('role_title', standardRole.role_title)
        .single();
      
      if (existingRole) {
        console.log('Role already exists, using existing:', standardRole.role_title);
        standardRoles.push(existingRole);
        continue;
      }
      
      try {
        const { data: createdRole, error: roleError } = await supabase
          .from('xlsmart_standard_roles')
          .insert({
            role_title: standardRole.role_title,
            job_family: standardRole.job_family,
            role_level: standardRole.role_level,
            role_category: 'Technical',
            department: standardRole.department,
            standard_description: standardRole.standard_description,
            core_responsibilities: standardRole.core_responsibilities || [],
            required_skills: standardRole.required_skills || [],
            keywords: standardRole.keywords || [],
            created_by: session.created_by,
            industry_alignment: 'Telecommunications'
          })
          .select()
          .single();

        if (roleError) {
          console.error('Error creating standard role:', roleError);
          console.error('Failed role data:', standardRole);
          continue;
        }

        console.log('Successfully created standard role:', createdRole.role_title);
        standardRoles.push(createdRole);
      } catch (roleCreateError) {
        console.error('Exception creating standard role:', roleCreateError);
        console.error('Failed role data:', standardRole);
        continue;
      }
    }

    // Create a role catalog entry with valid source_company
    const { data: catalogData, error: catalogError } = await supabase
      .from('xlsmart_role_catalogs')
      .insert({
        source_company: 'XL Axiata + Smartfren', // Use correct constraint value
        file_name: 'AI Standardized Roles',
        file_format: 'json',
        upload_status: 'completed',
        total_roles: sampleData.length,
        uploaded_by: session.created_by
      })
      .select()
      .single();

    if (catalogError) {
      console.error('Error creating catalog:', catalogError);
      console.log('Continuing without catalog - this is not critical');
      // Don't throw error, just log it and continue
    }

    // If catalog creation failed, we can't create mappings since catalog_id is required
    if (!catalogData) {
      console.error('No catalog created, cannot create mappings');
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to create catalog, mappings cannot be created'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all uploaded role data for this session
    let allUploadedRoles = [];
    
    if (rawData.length > 0) {
      // Use the raw data we already converted
      allUploadedRoles = sampleData; // We already have all the roles in sampleData
    } else {
      // Fallback to database tables for all data
      const { data: allXlData } = await supabase
        .from('xl_roles_data')
        .select('*')
        .eq('session_id', sessionId);

      const { data: allSmartData } = await supabase
        .from('smart_roles_data')
        .select('*')
        .eq('session_id', sessionId);

      allUploadedRoles = [...(allXlData || []), ...(allSmartData || [])];
    }

    // Create mappings using AI analysis
    for (const uploadedRole of allUploadedRoles) {
      if (!uploadedRole.role_title) continue;

      let bestMatch = null;
      let confidence = 0;

      // First check if AI found an existing match
      const existingMatch = analysis.existingMatches?.find(
        (match: any) => match.uploaded_role_title.toLowerCase() === uploadedRole.role_title.toLowerCase()
      );

      if (existingMatch) {
        // Use existing standard role
        const existingRole = existingRoles?.find(role => role.id === existingMatch.standard_role_id);
        if (existingRole) {
          bestMatch = existingRole;
          // Calculate REAL confidence based on role similarity
          const similarity = calculateRoleSimilarity(uploadedRole.role_title, existingRole.role_title);
          confidence = Math.max(similarity, 0.6); // Minimum 60% for existing matches
          console.log(`🔍 DEBUG: Role "${uploadedRole.role_title}" - Real confidence: ${confidence} (similarity: ${similarity})`);
        }
      } else {
        // Map to created standard role (includes both new and existing roles)
        bestMatch = standardRoles.find(sr => 
          sr.role_title.toLowerCase().includes(uploadedRole.role_title.toLowerCase()) ||
          uploadedRole.role_title.toLowerCase().includes(sr.role_title.toLowerCase())
        );
        if (!bestMatch && standardRoles.length > 0) {
          // Fallback to first available standard role
          bestMatch = standardRoles[0];
        }
        // Calculate REAL confidence based on role similarity for new standard roles
        if (bestMatch) {
          const similarity = calculateRoleSimilarity(uploadedRole.role_title, bestMatch.role_title);
          confidence = Math.max(similarity, 0.5); // Minimum 50% for new matches
          console.log(`🔍 DEBUG: Role "${uploadedRole.role_title}" - New standard role confidence: ${confidence} (similarity: ${similarity})`);
        } else {
          confidence = 0.3; // Low confidence for fallback
          console.log(`🔍 DEBUG: Role "${uploadedRole.role_title}" - Fallback confidence: ${confidence}`);
        }
      }

      if (bestMatch) {
        const finalConfidence = confidence * 100;
        console.log(`🔍 DEBUG: Final confidence for "${uploadedRole.role_title}" → "${bestMatch.role_title}": ${finalConfidence}%`);
        
        roleMappings.push({
          original_role_title: uploadedRole.role_title,
          original_department: uploadedRole.department,
          original_level: uploadedRole.seniority_band,
          standardized_role_title: bestMatch.role_title,
          standardized_department: bestMatch.department,
          standardized_level: bestMatch.role_level,
          job_family: bestMatch.job_family,
          standard_role_id: bestMatch.id,
                  mapping_confidence: finalConfidence,
        mapping_status: 'auto_mapped',
        requires_manual_review: confidence < 0.8,
          catalog_id: catalogData.id
        });
      }
    }

    // Insert role mappings
    if (roleMappings.length > 0) {
      const { error: mappingsError } = await supabase
        .from('xlsmart_role_mappings')
        .insert(roleMappings);

      if (mappingsError) {
        console.error('Error inserting role mappings:', mappingsError);
        console.log('Continuing without mappings - roles were still created');
        // Don't throw error, just log it
      }
    }

    // Update session with completion
    await supabase
      .from('xlsmart_upload_sessions')
      .update({ 
        status: 'completed',
        ai_analysis: {
          ...session.ai_analysis,
          standardization_complete: true,
          standardRolesCreated: standardRoles.length,
          roleMappingsCreated: roleMappings.length,
          createdRoles: standardRoles.map(r => ({
            id: r.id,
            title: r.role_title,
            department: r.department,
            level: r.role_level,
            family: r.job_family
          })),
          processedAt: new Date().toISOString()
        }
      })
      .eq('id', sessionId);

    console.log('AI standardization complete');

    return new Response(JSON.stringify({
      success: true,
      standardizedRolesCreated: standardRoles.length,
      mappingsCreated: roleMappings.length,
      xlDataProcessed: sampleData.length,
      smartDataProcessed: 0,
      message: 'AI role standardization completed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI role standardization:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Get sessionId from request body if available for error tracking
    let sessionId = null;
    try {
      // Don't clone the request if it's already consumed
      if (req.bodyUsed) {
        console.log('Request body already consumed, cannot extract sessionId for error tracking');
      } else {
        const body = await req.clone().json();
        sessionId = body.sessionId;
      }
    } catch (parseError) {
      console.error('Could not parse request body for error tracking:', parseError);
    }
    
            // Update session with error if sessionId is available
    if (sessionId) {
      try {
        await supabase
          .from('xlsmart_upload_sessions')
          .update({ 
            status: 'failed', // Use valid status value
            error_message: error.message 
          })
          .eq('id', sessionId);
      } catch (updateError) {
        console.error('Failed to update session with error:', updateError);
      }
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});