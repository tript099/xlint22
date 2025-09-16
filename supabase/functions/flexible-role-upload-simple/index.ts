import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
    const requestBody = await req.json();
    const { action, sessionName, excelData, sessionId } = requestBody;
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test endpoint
    if (action === 'test') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Edge function is working',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'upload') {
      // Use a system user ID for uploads since JWT is disabled
      const systemUserId = 'd77125e3-bb96-442c-a2d1-80f15baf497d'; // The user from the auth token
      
      // Create upload session
      const { data: session, error: sessionError } = await supabase
        .from('xlsmart_upload_sessions')
        .insert({
          session_name: sessionName,
          file_names: excelData.map((file: any) => file.fileName),
          temp_table_names: [],
          total_rows: excelData.reduce((sum: number, file: any) => sum + file.rows.length, 0),
          status: 'uploaded',
          created_by: systemUserId,
          ai_analysis: {
            raw_data: excelData
          }
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Failed to create upload session: ${sessionError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        sessionId: session.id,
        totalRows: session.total_rows,
        message: `Successfully stored ${session.total_rows} rows from ${excelData.length} files`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'standardize') {
      // Get upload session data
      const { data: session, error: sessionError } = await supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        throw new Error('Upload session not found');
      }

      const rawData = session.ai_analysis?.raw_data;
      if (!rawData || !Array.isArray(rawData)) {
        throw new Error('No valid raw data found in upload session');
      }

      // Get OpenAI API key
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      // Create AI prompt for role standardization
      const prompt = `You are an AI expert in telecommunications role standardization. 

TASK: Analyze these two role catalogs and create standardized telecommunications roles with accurate mappings.

INPUT DATA:
${JSON.stringify(rawData, null, 2)}

INSTRUCTIONS:
1. Analyze the role structures and identify common patterns
2. Create 10-15 standardized telecommunications roles that cover the key functions
3. Map each original role to the most appropriate standardized role
4. Provide confidence scores (0-100) for each mapping
5. Focus on telecommunications industry standards

OUTPUT FORMAT (JSON only):
{
  "standardRoles": [
    {
      "title": "Network Operations Engineer",
      "department": "Network Operations", 
      "roleFamily": "Network Engineering",
      "seniorityBand": "IC3-IC5",
      "description": "Manages network infrastructure and ensures optimal performance"
    }
  ],
  "mappings": [
    {
      "originalRole": "RAN Performance Engineer",
      "standardRole": "Network Operations Engineer", 
      "confidence": 85,
      "reasoning": "Direct mapping for network performance optimization"
    }
  ]
}`;

      // Call LiteLLM
      const litellmResponse = await fetch('https://proxyllm.ximplify.id/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'azure/gpt-4.1',
          messages: [
            { role: 'system', content: 'You are an expert in telecommunications role standardization. Return only valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_completion_tokens: 4000
        }),
      });

      if (!litellmResponse.ok) {
        const errorText = await litellmResponse.text();
        throw new Error(`LiteLLM API failed: ${litellmResponse.status} - ${errorText}`);
      }

      const aiResult = await litellmResponse.json();
      
      let parsedResult;
      try {
        parsedResult = JSON.parse(aiResult.choices[0].message.content);
      } catch (parseError) {
        throw new Error('Invalid JSON response from AI');
      }

      // Insert standard roles
      const { data: standardRoles, error: rolesError } = await supabase
        .from('xlsmart_standard_roles')
        .insert(
          parsedResult.standardRoles.map((role: any) => ({
            role_title: role.title,
            department: role.department,
            job_family: role.roleFamily,
            role_level: role.seniorityBand,
            role_category: role.department,
            standard_description: role.description,
            created_by: session.created_by
          }))
        )
        .select();

      if (rolesError) {
        throw new Error(`Failed to create standard roles: ${rolesError.message}`);
      }

      // Insert role mappings
      const { data: mappings, error: mappingsError } = await supabase
        .from('xlsmart_role_mappings')
        .insert(
          parsedResult.mappings.map((mapping: any) => ({
            original_role_title: mapping.originalRole,
            standardized_role_title: mapping.standardRole,
            mapping_confidence: mapping.confidence,
            catalog_id: session.id
          }))
        )
        .select();

      if (mappingsError) {
        throw new Error(`Failed to create role mappings: ${mappingsError.message}`);
      }

      // Update session status
      await supabase
        .from('xlsmart_upload_sessions')
        .update({ 
          status: 'completed',
          ai_analysis: {
            ...session.ai_analysis,
            standardization_result: parsedResult
          }
        })
        .eq('id', sessionId);

      return new Response(JSON.stringify({
        success: true,
        standardRolesCreated: standardRoles?.length || 0,
        mappingsCreated: mappings?.length || 0,
        message: 'AI role standardization completed successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: 'Invalid action specified' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});