import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, parsedData } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Update session status
    await supabase
      .from('xlsmart_upload_sessions')
      .update({ status: 'standardizing' })
      .eq('id', sessionId);

    // Create prompt for AI
    const prompt = `Analyze this role data and create standardized roles:

${parsedData.map((file: any) => `
File: ${file.fileName}
Headers: ${file.headers.join(', ')}
Sample data: ${JSON.stringify(file.rows.slice(0, 3))}
`).join('\n')}

Create 5-8 standardized telecommunications roles based on this data. Return JSON:
{
  "standardRoles": [
    {
      "role_title": "Network Engineer",
      "department": "Network Operations", 
      "job_family": "Engineering",
      "role_level": "IC3-IC5",
      "role_category": "Technology",
      "standard_description": "Manages network infrastructure"
    }
  ],
  "mappings": [
    {
      "original_role_title": "Original Role Name",
      "standardized_role_title": "Network Engineer",
      "mapping_confidence": 85
    }
  ]
}`;

    // Call OpenAI
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { role: 'system', content: 'You are an expert HR analyst. Create standardized role definitions. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 3000,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`OpenAI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    // Get user ID from session
    const { data: session } = await supabase
      .from('xlsmart_upload_sessions')
      .select('created_by')
      .eq('id', sessionId)
      .single();

    // Insert standard roles
    const { data: createdRoles, error: rolesError } = await supabase
      .from('xlsmart_standard_roles')
      .insert(
        analysis.standardRoles.map((role: any) => ({
          ...role,
          created_by: session.created_by
        }))
      )
      .select();

    if (rolesError) throw rolesError;

    // Insert mappings
    const { data: createdMappings, error: mappingsError } = await supabase
      .from('xlsmart_role_mappings')
      .insert(
        analysis.mappings.map((mapping: any) => ({
          ...mapping,
          catalog_id: sessionId
        }))
      )
      .select();

    if (mappingsError) throw mappingsError;

    // Update session as completed
    await supabase
      .from('xlsmart_upload_sessions')
      .update({ 
        status: 'completed',
        ai_analysis: {
          standardRolesCreated: createdRoles?.length || 0,
          mappingsCreated: createdMappings?.length || 0
        }
      })
      .eq('id', sessionId);

    return new Response(JSON.stringify({
      success: true,
      standardRolesCreated: createdRoles?.length || 0,
      mappingsCreated: createdMappings?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});