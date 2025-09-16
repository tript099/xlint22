import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration for batch processing
const BATCH_SIZE = 50; // Process roles in batches of 50
const MAX_CONCURRENT_BATCHES = 3; // Process up to 3 batches concurrently
const AI_REQUEST_DELAY = 100; // 100ms delay between AI requests to avoid rate limiting

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { xlRoles, smartRoles, includeIndustryStandards, catalogId } = await req.json();
    
    console.log('Processing XLSMART role creation for:', { 
      catalogId, 
      xlCount: xlRoles.length, 
      smartCount: smartRoles.length, 
      includeIndustry: includeIndustryStandards 
    });

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Step 1: Get all standard roles for AI matching with optimized query
    const { data: standardRoles, error: standardRolesError } = await supabase
      .from('xlsmart_standard_roles')
      .select('id, role_title, job_family, role_level, department, keywords')
      .eq('is_active', true)
      .limit(1000); // Reasonable limit for standard roles

    if (standardRolesError) {
      throw new Error(`Failed to fetch standard roles: ${standardRolesError.message}`);
    }

    console.log(`Found ${standardRoles.length} standard roles for matching`);

    // Step 2: Generate industry standards if requested (optimized for large scale)
    let industryRoles = [];
    if (includeIndustryStandards) {
      console.log('Generating AI industry standards...');
      
      const industryPrompt = `Generate a comprehensive list of 25 telecommunications industry standard roles for large enterprises (10,000+ employees). Include roles across all departments and levels. Format as JSON array with objects containing: {title, department, level, description}. Focus on roles commonly found in large telecom companies.`;
      
      try {
        const industryResponse = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'azure/gpt-4.1',
            messages: [
              { role: 'system', content: 'You are an expert in telecommunications industry role standards for large enterprises. Always respond with valid JSON.' },
              { role: 'user', content: industryPrompt }
            ],
            temperature: 0.3,
            max_tokens: 3000,
          }),
        });

        if (industryResponse.ok) {
          const industryData = await industryResponse.json();
          try {
            industryRoles = JSON.parse(industryData.choices[0].message.content);
            console.log(`Generated ${industryRoles.length} AI industry standard roles`);
          } catch (error) {
            console.error('Failed to parse AI industry roles:', error);
            industryRoles = [];
          }
        }
      } catch (error) {
        console.error('Failed to generate industry standards:', error);
        industryRoles = [];
      }
    }

    // Step 3: Merge all role data from available sources
    const allRoleData = [
      ...xlRoles.map((role: any) => ({ ...role, source: 'XL' })),
      ...smartRoles.map((role: any) => ({ ...role, source: 'SMART' })),
      ...(includeIndustryStandards ? industryRoles.map((role: any) => ({ ...role, source: 'Industry' })) : [])
    ];

    console.log(`Processing ${allRoleData.length} total roles from ${includeIndustryStandards ? 3 : 2} sources`);

    // Step 4: Process roles in batches for better performance and reliability
    const batches = [];
    for (let i = 0; i < allRoleData.length; i += BATCH_SIZE) {
      batches.push(allRoleData.slice(i, i + BATCH_SIZE));
    }

    console.log(`Split into ${batches.length} batches of up to ${BATCH_SIZE} roles each`);

    let allMappingResults: any[] = [];
    let processedCount = 0;

    // Process batches with concurrency control
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += MAX_CONCURRENT_BATCHES) {
      const currentBatches = batches.slice(batchIndex, batchIndex + MAX_CONCURRENT_BATCHES);
      
      const batchPromises = currentBatches.map(async (batch, localIndex) => {
        const globalBatchIndex = batchIndex + localIndex;
        console.log(`Processing batch ${globalBatchIndex + 1}/${batches.length} with ${batch.length} roles`);
        
        const batchResults = [];
        
        for (const [roleIndex, inputRole] of batch.entries()) {
          try {
            // Add delay to avoid rate limiting
            if (roleIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, AI_REQUEST_DELAY));
            }

            // Create optimized AI prompt for large-scale processing
            const aiPrompt = `
Analyze this ${inputRole.source} role for a large telecommunications company (10,000+ employees) and map it to the best standard role:

INPUT ROLE:
- Title: ${inputRole.title || inputRole.name || 'Not specified'}
- Department: ${inputRole.department || 'Not specified'}
- Level: ${inputRole.level || 'Not specified'}

AVAILABLE STANDARD ROLES (abbreviated for efficiency):
${standardRoles.slice(0, 20).map(role => `${role.id}: ${role.role_title} (${role.job_family})`).join('\n')}

Respond with JSON only:
{
  "standardRoleId": "best-match-uuid",
  "confidence": 85,
  "requiresManualReview": false
}

Confidence >80 = auto-approve, <80 = manual review needed.`;

            const aiResponse = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'azure/gpt-4.1',
                messages: [
                  { role: 'system', content: 'You are an expert HR role standardization AI for large telecommunications enterprises. Always respond with valid JSON only.' },
                  { role: 'user', content: aiPrompt }
                ],
                temperature: 0.1,
                max_tokens: 200,
              }),
            });

            if (!aiResponse.ok) {
              throw new Error(`OpenAI API error: ${aiResponse.statusText}`);
            }

            const aiData = await aiResponse.json();
            let aiMapping;
            
            try {
              aiMapping = JSON.parse(aiData.choices[0].message.content);
            } catch (parseError) {
              // Fallback for parsing errors
              const fallbackRole = standardRoles[0];
              aiMapping = {
                standardRoleId: fallbackRole.id,
                confidence: 30,
                requiresManualReview: true
              };
            }

            // Find the matched standard role
            const matchedStandardRole = standardRoles.find(role => role.id === aiMapping.standardRoleId);
            
            if (!matchedStandardRole) {
              console.error(`Invalid standard role ID returned for ${inputRole.title}: ${aiMapping.standardRoleId}`);
              continue;
            }

            // Create mapping record
            const mappingRecord = {
              catalog_id: catalogId,
              original_role_title: inputRole.title || inputRole.name || 'Unknown',
              original_department: inputRole.department || null,
              original_level: inputRole.level || null,
              standardized_role_title: matchedStandardRole.role_title,
              standardized_department: matchedStandardRole.department,
              standardized_level: matchedStandardRole.role_level,
              job_family: matchedStandardRole.job_family,
              standard_role_id: matchedStandardRole.id,
              mapping_confidence: aiMapping.confidence || 50,
              requires_manual_review: aiMapping.requiresManualReview || aiMapping.confidence < 80,
              mapping_status: aiMapping.requiresManualReview || aiMapping.confidence < 80 ? 'manual_review' : 'auto_mapped'
            };

            batchResults.push(mappingRecord);
            
          } catch (error) {
            console.error(`Error processing role ${inputRole.title}:`, error);
            // Continue processing other roles instead of failing the entire batch
          }
        }
        
        return batchResults;
      });

      // Wait for current batch group to complete
      const batchGroupResults = await Promise.all(batchPromises);
      
      // Flatten and add to all results
      for (const batchResult of batchGroupResults) {
        allMappingResults.push(...batchResult);
        processedCount += batchResult.length;
      }

      console.log(`Completed batch group. Total processed: ${processedCount}/${allRoleData.length}`);

      // Update progress in database
      await supabase
        .from('xlsmart_role_catalogs')
        .update({
          processed_roles: processedCount,
          total_roles: allRoleData.length,
          upload_status: processedCount >= allRoleData.length ? 'processing_final' : 'processing'
        })
        .eq('id', catalogId);
    }

    // Step 5: Insert all mappings in batches to avoid memory issues
    if (allMappingResults.length > 0) {
      const insertBatchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < allMappingResults.length; i += insertBatchSize) {
        const insertBatch = allMappingResults.slice(i, i + insertBatchSize);
        
        const { error: insertError } = await supabase
          .from('xlsmart_role_mappings')
          .insert(insertBatch);

        if (insertError) {
          console.error(`Failed to insert batch ${Math.floor(i / insertBatchSize) + 1}:`, insertError);
          // Continue with other batches instead of failing completely
        } else {
          insertedCount += insertBatch.length;
        }
      }

      console.log(`Successfully inserted ${insertedCount}/${allMappingResults.length} mappings`);
    }

    // Step 6: Update catalog with final results
    const totalRoles = allMappingResults.length;
    const autoMappedCount = allMappingResults.filter(m => m.mapping_status === 'auto_mapped').length;
    const averageConfidence = totalRoles > 0 
      ? allMappingResults.reduce((sum, m) => sum + m.mapping_confidence, 0) / totalRoles 
      : 0;

    const { error: updateError } = await supabase
      .from('xlsmart_role_catalogs')
      .update({
        upload_status: 'completed',
        total_roles: totalRoles,
        processed_roles: totalRoles,
        mapping_accuracy: parseFloat(averageConfidence.toFixed(2))
      })
      .eq('id', catalogId);

    if (updateError) {
      throw new Error(`Failed to update catalog: ${updateError.message}`);
    }

    console.log(`Successfully processed ${totalRoles} roles with ${autoMappedCount} auto-mapped and ${totalRoles - autoMappedCount} requiring review`);

    return new Response(JSON.stringify({
      success: true,
      totalRoles,
      autoMappedCount,
      manualReviewCount: totalRoles - autoMappedCount,
      averageConfidence: parseFloat(averageConfidence.toFixed(2)),
      processedInBatches: batches.length,
      batchSize: BATCH_SIZE
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in role standardization:', error);
    
    // Update catalog status to error
    try {
      const { catalogId } = await req.json();
      if (catalogId) {
        await supabase
          .from('xlsmart_role_catalogs')
          .update({ upload_status: 'error' })
          .eq('id', catalogId);
      }
    } catch (updateError) {
      console.error('Failed to update catalog status to error:', updateError);
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