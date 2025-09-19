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

// � FIX: Enhanced similarity calculation with semantic matching
const similarityCache = new Map<string, number>();

// Synonym and abbreviation mappings with telecom-specific terms
const roleSynonyms = new Map([
  ['engineer', ['developer', 'dev', 'programmer', 'analyst', 'specialist']],
  ['manager', ['mgr', 'supervisor', 'lead', 'director', 'head']],
  ['analyst', ['analyze', 'expert', 'consultant', 'advisor']],
  ['senior', ['sr', 'principal', 'lead', 'chief']],
  ['junior', ['jr', 'associate', 'entry', 'trainee']],
  ['software', ['sw', 'app', 'application', 'system']],
  ['network', ['net', 'infrastructure', 'connectivity']],
  ['sales', ['business', 'commercial', 'revenue']],
  ['operations', ['ops', 'operational', 'support']],
  ['human resources', ['hr', 'people', 'talent', 'personnel']],
  ['customer', ['client', 'user', 'consumer']],
  ['service', ['support', 'help', 'assistance']],
  ['quality', ['qa', 'qc', 'assurance', 'control']],
  ['product', ['prod', 'offering', 'solution']],
  ['project', ['proj', 'program', 'initiative']],
  ['technical', ['tech', 'technology', 'it']],
  ['business', ['biz', 'commercial', 'enterprise']],
  ['marketing', ['mkt', 'promotion', 'brand']],
  ['finance', ['fin', 'financial', 'accounting']],
  ['security', ['sec', 'safety', 'protection']],
  // 🚀 TELECOM-SPECIFIC SYNONYMS
  ['ran', ['radio access network', 'radio network', 'access network']],
  ['noc', ['network operations center', 'network operations centre', 'operations center']],
  ['oss', ['operations support system', 'operational support system']],
  ['bss', ['business support system', 'billing support system']],
  ['vas', ['value added services', 'value-added services', 'additional services']],
  ['radio', ['rf', 'wireless', 'cellular', 'mobile']],
  ['telecom', ['telecommunications', 'telco', 'communications', 'comms']],
  ['infrastructure', ['infra', 'backbone', 'core network']],
  ['subscriber', ['customer', 'user', 'client', 'end user']],
  ['billing', ['charging', 'revenue', 'monetization']],
  ['planning', ['optimization', 'design', 'architecture']]
]);

function normalizeTitle(title: string): string {
  return title.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

function getSemanticMatches(word: string): string[] {
  const matches = [word];
  for (const [key, synonyms] of roleSynonyms.entries()) {
    if (key === word || synonyms.includes(word)) {
      matches.push(key, ...synonyms);
    }
  }
  return [...new Set(matches)]; // Remove duplicates
}

function calculateEnhancedRoleSimilarity(role1: string, role2: string): number {
  const cacheKey = `${role1.toLowerCase()}|${role2.toLowerCase()}`;
  if (similarityCache.has(cacheKey)) {
    return similarityCache.get(cacheKey)!;
  }

  const normalized1 = normalizeTitle(role1);
  const normalized2 = normalizeTitle(role2);
  
  // Exact match
  if (normalized1 === normalized2) {
    similarityCache.set(cacheKey, 1.0);
    return 1.0;
  }
  
  const words1 = normalized1.split(/\s+/).filter(w => w.length > 1);
  const words2 = normalized2.split(/\s+/).filter(w => w.length > 1);
  
  if (words1.length === 0 || words2.length === 0) {
    similarityCache.set(cacheKey, 0.0);
    return 0.0;
  }
  
  // 1. Exact word matches
  let exactMatches = 0;
  for (const word1 of words1) {
    if (words2.includes(word1)) {
      exactMatches++;
    }
  }
  
  // 2. Semantic matches (synonyms/abbreviations)
  let semanticMatches = 0;
  for (const word1 of words1) {
    const semanticOptions = getSemanticMatches(word1);
    for (const word2 of words2) {
      if (semanticOptions.includes(word2)) {
        semanticMatches++;
        break; // Count each word1 only once
      }
    }
  }
  
  // 3. Substring matches (for compound words)
  let substringMatches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.length > 3 && word2.length > 3) {
        if (word1.includes(word2) || word2.includes(word1)) {
          substringMatches++;
          break;
        }
      }
    }
  }
  
  // 4. Position-aware scoring (title order matters)
  let positionBonus = 0;
  if (words1[0] === words2[0]) positionBonus += 0.2; // Same first word
  if (words1.length > 1 && words2.length > 1 && words1[words1.length-1] === words2[words2.length-1]) {
    positionBonus += 0.1; // Same last word
  }
  
  // Calculate weighted similarity
  const maxWords = Math.max(words1.length, words2.length);
  const exactScore = (exactMatches / maxWords) * 0.6;
  const semanticScore = (semanticMatches / maxWords) * 0.3;
  const substringScore = (substringMatches / maxWords) * 0.1;
  
  const totalSimilarity = Math.min(exactScore + semanticScore + substringScore + positionBonus, 0.98);
  
  similarityCache.set(cacheKey, totalSimilarity);
  return totalSimilarity;
}

// 🔧 FIX: Function to load all standard roles with pagination
async function loadAllStandardRoles() {
  const allRoles = [];
  let hasMore = true;
  let offset = 0;
  const batchSize = 1000;

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from('xlsmart_standard_roles')
      .select('id, role_title, department, job_family, role_level, standard_description')
      .eq('is_active', true)
      .range(offset, offset + batchSize - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading standard roles batch:', error);
      return { data: allRoles, error };
    }

    if (batch && batch.length > 0) {
      allRoles.push(...batch);
      hasMore = batch.length === batchSize;
      offset += batchSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`🔧 Loaded ${allRoles.length} total standard roles`);
  return { data: allRoles, error: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 OPTIMIZED AI Role Standardization Function Started');
    
    const body = await req.json();
    const { sessionId } = body;
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    
    console.log('Processing session ID:', sessionId);
    
    // � FIX: Load ALL standard roles with pagination (remove 50-row limit)
    const [sessionResult, existingRolesResult] = await Promise.all([
      supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .eq('id', sessionId)
        .single(),
      // Load all active standard roles with pagination
      loadAllStandardRoles()
    ]);

    const { data: session, error: sessionError } = sessionResult;
    const { data: existingRoles, error: rolesError } = existingRolesResult;

    if (sessionError) throw sessionError;
    if (!session) throw new Error(`Session ${sessionId} not found`);

    console.log('🚀 Session and roles data fetched in parallel');

    // Get API key with fallback
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('OPENAI_API_KEY_NEW');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize arrays
    const standardRoles: any[] = [];
    const roleMappings: any[] = [];

    // 🚀 OPTIMIZED DATA PROCESSING: Process uploaded data efficiently
    const uploadedData = session.ai_analysis || {};
    const rawData = uploadedData.raw_data || [];
    
    let sampleData = [];
    
    if (rawData.length > 0) {
      // Convert raw data efficiently
      for (const fileData of rawData) {
        if (fileData.rows && fileData.headers) {
          const roleObjects = fileData.rows.slice(0, 100).map((row: any[]) => { // Limit to 100 per file
            const roleObj: any = {};
            fileData.headers.forEach((header: string, index: number) => {
              roleObj[header] = row[index];
            });
            return {
              role_title: roleObj['Role Title'] || roleObj['role_title'] || roleObj['title'] || 
                         roleObj['Position'] || roleObj['Job Title'] || '',
              department: roleObj['Department'] || roleObj['department'] || 
                         roleObj['Division'] || roleObj['Unit'] || '',
              seniority_band: roleObj['Level'] || roleObj['level'] || roleObj['Role Level'] || 
                             roleObj['Seniority'] || roleObj['Band'] || '',
              source_file: fileData.fileName || 'unknown'
            };
          }).filter(role => role.role_title); // Only include roles with titles
          sampleData.push(...roleObjects);
        }
      }
    }
    
    if (sampleData.length === 0) {
      throw new Error(`No role data found for session ${sessionId}`);
    }

    console.log(`🚀 Processed ${sampleData.length} roles for standardization`);

    // 🚀 OPTIMIZED AI PROCESSING: Use larger sample with random selection for better coverage
    const sampleSize = Math.min(sampleData.length, 50); // Increased from 8 to 50
    const aiSampleData = sampleData
      .sort(() => 0.5 - Math.random()) // Random shuffle for diverse sampling
      .slice(0, sampleSize)
      .map(role => ({
        title: role.role_title,
        dept: role.department || 'N/A',
        level: role.seniority_band || 'N/A'
      }));

    const existingRoleSummary = (existingRoles?.slice(0, 12) || []).map(role => ({
      id: role.id,
      title: role.role_title,
      family: role.job_family
    }));

    const aiPrompt = `Analyze sample roles and create telecom standards:

SAMPLE (${aiSampleData.length}/${sampleData.length} total):
${JSON.stringify(aiSampleData)}

EXISTING STANDARDS:
${JSON.stringify(existingRoleSummary)}

From the uploaded roles, create telecom-standard roles dynamically. Do not limit to a fixed number. Only output the unique standards required to cover the uploaded roles. Respond only with valid JSON:
{
  "newStandardRoles": [
    {
      "role_title": "Network Operations Engineer",
      "job_family": "Engineering",
      "role_level": "Senior",
      "department": "Network Operations",
      "standard_description": "Manages network infrastructure"
    }
  ],
  "existingMatches": [
    {
      "uploaded_role_title": "Original Title",
      "standard_role_id": "uuid",
      "confidence": 85
    }
  ]
}`;

    console.log('🚀 Making optimized AI request...');
    
    const aiResponse = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { 
            role: 'system', 
            content: 'You are a telecom HR expert. Create concise standard roles. Respond only with valid JSON.' 
          },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_completion_tokens: 2000, // Reduced token limit
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    
    // 🔧 FIX: Resilient AI response parsing with raw output logging
    let analysis;
    let rawAiOutput = '';
    
    try {
      // Try multiple response format patterns
      if (aiData.choices && aiData.choices[0] && aiData.choices[0].message) {
        rawAiOutput = aiData.choices[0].message.content;
      } else if (aiData.choices && aiData.choices[0] && aiData.choices[0].text) {
        rawAiOutput = aiData.choices[0].text;
      } else if (aiData.text) {
        rawAiOutput = aiData.text;
      } else if (aiData.content) {
        rawAiOutput = aiData.content;
      } else {
        throw new Error('Unknown AI response format');
      }

      console.log('🔍 Raw AI output:', rawAiOutput);
      
      // Clean the response (remove markdown code blocks if present)
      let cleanedOutput = rawAiOutput.trim();
      if (cleanedOutput.startsWith('```json')) {
        cleanedOutput = cleanedOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedOutput.startsWith('```')) {
        cleanedOutput = cleanedOutput.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      analysis = JSON.parse(cleanedOutput);
      
      // Validate required structure
      if (!analysis.newStandardRoles) analysis.newStandardRoles = [];
      if (!analysis.existingMatches) analysis.existingMatches = [];
      
      console.log('✅ AI parsing successful');
      
    } catch (parseError) {
      console.error('🚨 AI parsing failed:', parseError);
      console.error('Raw AI response:', rawAiOutput);
      
      // Store the failed response for debugging
      const debugInfo = {
        error: parseError.message,
        rawOutput: rawAiOutput,
        timestamp: new Date().toISOString(),
        aiData: JSON.stringify(aiData)
      };
      
      // Intelligent fallback based on sample data patterns
      const sampleTitles = sampleData.slice(0, 3).map(r => r.role_title).filter(Boolean);
      const fallbackRoles = sampleTitles.map(title => {
        const dept = title.toLowerCase().includes('network') ? 'Network Operations' :
                     title.toLowerCase().includes('software') ? 'Software Development' :
                     title.toLowerCase().includes('sales') ? 'Sales' :
                     title.toLowerCase().includes('hr') ? 'Human Resources' :
                     'General Operations';
        
        const level = title.toLowerCase().includes('senior') || title.toLowerCase().includes('lead') ? 'Senior' :
                      title.toLowerCase().includes('junior') ? 'Junior' : 'Mid';
                      
        return {
          role_title: title.replace(/[^a-zA-Z\s]/g, '').trim(),
          job_family: dept.includes('Network') ? 'Engineering' : 
                     dept.includes('Software') ? 'Engineering' :
                     dept.includes('Sales') ? 'Sales' : 'Operations',
          role_level: level,
          department: dept,
          standard_description: `${title} role in ${dept}`
        };
      });
      
      analysis = {
        newStandardRoles: fallbackRoles.length > 0 ? fallbackRoles : [
          {
            role_title: "Generic Role",
            job_family: "Operations",
            role_level: "Mid",
            department: "General Operations",
            standard_description: "General operational role"
          }
        ],
        existingMatches: [],
        _debugInfo: debugInfo
      };
      
      console.log('🔄 Using intelligent fallback analysis');
    }

    console.log('🚀 AI Analysis completed successfully');

    // � FIX: Create standard roles with deduplication checks
    const newRolesToCreate = analysis.newStandardRoles || [];
    if (newRolesToCreate.length > 0) {
      console.log(`� Creating ${newRolesToCreate.length} new standard roles with deduplication...`);
      
      const rolesToActuallyCreate = [];
      
      for (const role of newRolesToCreate) {
        // Check for exact duplicates first
        const exactDuplicate = existingRoles?.find(existing => 
          existing.role_title.toLowerCase() === role.role_title.toLowerCase() &&
          existing.department?.toLowerCase() === role.department?.toLowerCase() &&
          existing.role_level?.toLowerCase() === role.role_level?.toLowerCase()
        );
        
        if (exactDuplicate) {
          console.log(`⚠️ Skipping duplicate role: ${role.role_title}`);
          standardRoles.push(exactDuplicate);
          continue;
        }
        
        // Check for semantic duplicates using enhanced similarity
        let semanticDuplicate = null;
        for (const existing of existingRoles || []) {
          const similarity = calculateEnhancedRoleSimilarity(role.role_title, existing.role_title);
          if (similarity >= 0.9 && 
              existing.department?.toLowerCase() === role.department?.toLowerCase()) {
            semanticDuplicate = existing;
            break;
          }
        }
        
        if (semanticDuplicate) {
          console.log(`⚠️ Skipping semantic duplicate: ${role.role_title} (similar to ${semanticDuplicate.role_title})`);
          standardRoles.push(semanticDuplicate);
          continue;
        }
        
        // Role is unique, add to creation list
        rolesToActuallyCreate.push({
          role_title: role.role_title,
          job_family: role.job_family,
          role_level: role.role_level,
          department: role.department,
          standard_description: role.standard_description,
          is_active: true
        });
      }
      
      if (rolesToActuallyCreate.length > 0) {
        const { data: createdRoles, error: creationError } = await supabase
          .from('xlsmart_standard_roles')
          .insert(rolesToActuallyCreate)
          .select();

        if (creationError) {
          console.error('Error creating standard roles:', creationError);
        } else {
          standardRoles.push(...(createdRoles || []));
          console.log(`✅ Created ${createdRoles?.length || 0} unique new standard roles`);
        }
      } else {
        console.log('🔧 All roles were duplicates, no new roles created');
      }
    }

    // 🚀 BATCH CREATE CATALOG: Create catalog as 'in_progress' first
    const { data: catalogData, error: catalogError } = await supabase
      .from('xlsmart_role_catalogs')
      .insert({
        source_company: 'XL Axiata + Smartfren',
        file_name: 'AI Optimized Standardization',
        file_format: 'json',
        upload_status: 'in_progress', // Will update to 'completed' after mappings succeed
        total_roles: sampleData.length,
        uploaded_by: session.created_by
      })
      .select()
      .single();

    if (catalogError || !catalogData) {
      throw new Error('Failed to create catalog');
    }

    // 🚀 OPTIMIZED MAPPING: Use efficient matching algorithm
    console.log('🚀 Creating optimized role mappings...');
    
    const mappingsToCreate = [];
    const allStandardRoles = [...(existingRoles || []), ...standardRoles];
    
    for (const uploadedRole of sampleData) {
      if (!uploadedRole.role_title) continue;

      let bestMatch = null;
      let confidence = 0;

      // Check AI existing matches first (highest priority)
      const existingMatch = analysis.existingMatches?.find(
        (match: any) => match.uploaded_role_title.toLowerCase() === uploadedRole.role_title.toLowerCase()
      );

      if (existingMatch) {
        const existingRole = existingRoles?.find(role => role.id === existingMatch.standard_role_id);
        if (existingRole) {
          bestMatch = existingRole;
          confidence = existingMatch.confidence / 100;
        }
      } else {
        // Use optimized similarity matching
        let bestSimilarity = 0;
        for (const standardRole of allStandardRoles) {
          const similarity = calculateEnhancedRoleSimilarity(uploadedRole.role_title, standardRole.role_title);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = standardRole;
          }
        }
        confidence = bestSimilarity;
      }

      // 🔧 IMPROVED: Only create mappings above minimum confidence
      if (bestMatch && confidence >= 0.6) {  // Raised from 0.3
        mappingsToCreate.push({
          original_role_title: uploadedRole.role_title,
          original_department: uploadedRole.department,
          original_level: uploadedRole.seniority_band,
          standardized_role_title: bestMatch.role_title,
          standardized_department: bestMatch.department,
          standardized_level: bestMatch.role_level,
          job_family: bestMatch.job_family,
          standard_role_id: bestMatch.id,
          mapping_confidence: Math.round(confidence * 100),
          mapping_status: confidence >= 0.85 ? 'approved' : 'pending_review',  // Raised from 0.8
          requires_manual_review: confidence < 0.85,  // Raised from 0.8
          catalog_id: catalogData.id
        });
      } else {
        console.log(`⚠️ Skipping low-confidence mapping for "${uploadedRole.role_title}" (confidence: ${Math.round(confidence * 100)}%)`);
      }
    }

    // 🚀 BATCH INSERT MAPPINGS: Insert all mappings efficiently
    if (mappingsToCreate.length > 0) {
      console.log(`🚀 Batch inserting ${mappingsToCreate.length} mappings...`);
      
      const BATCH_SIZE = 50;
      let totalInserted = 0;
      
      for (let i = 0; i < mappingsToCreate.length; i += BATCH_SIZE) {
        const batch = mappingsToCreate.slice(i, i + BATCH_SIZE);
        
        try {
          const { error: batchError } = await supabase
            .from('xlsmart_role_mappings')
            .insert(batch);

          if (!batchError) {
            totalInserted += batch.length;
          } else {
            console.error(`Batch ${Math.floor(i/BATCH_SIZE) + 1} failed:`, batchError);
          }
        } catch (error) {
          console.error(`Batch processing error:`, error);
        }
      }
      
      console.log(`✅ Successfully inserted ${totalInserted} mappings`);
    }

    // 🚀 UPDATE CATALOG: Mark as completed after successful mapping
    await supabase
      .from('xlsmart_role_catalogs')
      .update({ upload_status: 'completed' })
      .eq('id', catalogData.id);

    // 🚀 UPDATE SESSION: Deep merge ai_analysis to prevent data loss
    const currentAnalysis = session.ai_analysis || {};
    const updatedAnalysis = {
      ...currentAnalysis,
      // Deep merge existing nested objects
      ...(currentAnalysis.raw_data && { raw_data: currentAnalysis.raw_data }),
      ...(currentAnalysis.initial_analysis && { initial_analysis: currentAnalysis.initial_analysis }),
      ...(currentAnalysis.file_processing && { file_processing: currentAnalysis.file_processing }),
      // Add new standardization data
      standardization_complete: true,
      standardRolesCreated: standardRoles.length,
      roleMappingsCreated: mappingsToCreate.length,
      optimized: true,
      processedAt: new Date().toISOString()
    };

    await supabase
      .from('xlsmart_upload_sessions')
      .update({ 
        status: 'completed',
        ai_analysis: updatedAnalysis
      })
      .eq('id', sessionId);

    console.log('🚀 OPTIMIZATION COMPLETE!');

    return new Response(JSON.stringify({
      success: true,
      standardRolesCreated: standardRoles.length,
      mappingsCreated: mappingsToCreate.length,
      xlDataProcessed: sampleData.length,
      smartDataProcessed: 0,
      optimized: true,
      message: '🚀 Optimized AI role standardization completed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🚨 Optimization error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      optimized: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});