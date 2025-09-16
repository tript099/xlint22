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
  
  return confidence;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Fix Existing Mappings Function Started ===');
    
    // Get all existing role mappings
    const { data: existingMappings, error: fetchError } = await supabase
      .from('xlsmart_role_mappings')
      .select('*');

    if (fetchError) {
      throw new Error(`Error fetching mappings: ${fetchError.message}`);
    }

    console.log(`Found ${existingMappings?.length || 0} existing mappings to fix`);

    if (!existingMappings || existingMappings.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No existing mappings found to fix',
        mappingsFixed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let fixedCount = 0;
    const updates = [];

    // Process each mapping
    for (const mapping of existingMappings) {
      if (!mapping.original_role_title || !mapping.standardized_role_title) {
        console.log(`Skipping mapping ${mapping.id} - missing role titles`);
        continue;
      }

      // Calculate real confidence based on role similarity
      const realConfidence = calculateRoleSimilarity(
        mapping.original_role_title, 
        mapping.standardized_role_title
      );

      // Convert to percentage
      const confidencePercentage = Math.round(realConfidence * 100);

      // Only update if confidence is significantly different (more than 5% difference)
      const currentConfidence = mapping.mapping_confidence || 0;
      if (Math.abs(confidencePercentage - currentConfidence) > 5) {
        updates.push({
          id: mapping.id,
          mapping_confidence: confidencePercentage,
          requires_manual_review: confidencePercentage < 80
        });

        console.log(`🔧 Fixing mapping: "${mapping.original_role_title}" → "${mapping.standardized_role_title}"`);
        console.log(`  - Old confidence: ${currentConfidence}%`);
        console.log(`  - New confidence: ${confidencePercentage}%`);
        console.log(`  - Similarity: ${realConfidence.toFixed(3)}`);
      }
    }

    // Batch update all mappings
    if (updates.length > 0) {
      console.log(`Updating ${updates.length} mappings with realistic confidence values...`);
      
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('xlsmart_role_mappings')
          .update({
            mapping_confidence: update.mapping_confidence,
            requires_manual_review: update.requires_manual_review
          })
          .eq('id', update.id);

        if (updateError) {
          console.error(`Error updating mapping ${update.id}:`, updateError);
        } else {
          fixedCount++;
        }
      }
    }

    console.log(`Successfully fixed ${fixedCount} mappings`);

    return new Response(JSON.stringify({
      success: true,
      message: `Fixed ${fixedCount} existing mappings with realistic confidence values`,
      mappingsFixed: fixedCount,
      totalMappings: existingMappings.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fix existing mappings:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
