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

serve(async (req) => {
  console.log('🚀 Direct upload function called:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, sessionName, excelData, sessionId } = await req.json();
    console.log('📥 Action:', action);
    
    if (action === 'test') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Direct function working',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'upload') {
      console.log('📊 Processing', excelData?.length, 'files');
      
      // Create upload session without auth for now
      const { data: session, error: sessionError } = await supabase
        .from('xlsmart_upload_sessions')
        .insert({
          session_name: sessionName,
          file_names: excelData.map((file: any) => file.fileName),
          temp_table_names: [],
          total_rows: excelData.reduce((sum: number, file: any) => sum + file.rows.length, 0),
          status: 'analyzing',
          ai_analysis: { raw_data: excelData }
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Session creation failed: ${sessionError.message}`);
      }

      console.log('✅ Session created:', session.id);
      return new Response(JSON.stringify({
        success: true,
        sessionId: session.id,
        totalRows: session.total_rows,
        message: `Stored ${session.total_rows} rows`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'standardize') {
      console.log('🤖 Starting standardization for session:', sessionId);
      
      // Get session data
      const { data: session, error } = await supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        throw new Error('Session not found');
      }

      const rawData = session.ai_analysis?.raw_data;
      if (!rawData) {
        throw new Error('No data in session');
      }

      // Call AI for standardization
      const prompt = `Analyze these role catalogs and create standardized telecommunications roles:
${JSON.stringify(rawData, null, 2)}

Return JSON with this structure:
{
  "standardRoles": [{"title": "Network Engineer", "department": "Network", "roleFamily": "Engineering", "seniorityBand": "IC3-IC5", "description": "Network operations"}],
  "mappings": [{"originalRole": "RAN Engineer", "standardRole": "Network Engineer", "confidence": 85, "reasoning": "Direct match"}]
}`;

      const aiResponse = await fetch('https://proxyllm.ximplify.id/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'azure/gpt-4.1',
          messages: [
            { role: 'system', content: 'Return only valid JSON for telecommunications role standardization.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_completion_tokens: 3000
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI API failed: ${aiResponse.status} - ${errorText}`);
      }

      const aiResult = await aiResponse.json();
      const aiContent = aiResult.choices[0].message.content;
      
      let parsedResult;
      try {
        parsedResult = JSON.parse(aiContent);
      } catch (e) {
        console.error('AI response:', aiContent);
        throw new Error('Invalid AI response format');
      }

      // Save to database
      const { data: standardRoles } = await supabase
        .from('xlsmart_standard_roles')
        .insert(
          parsedResult.standardRoles.map((role: any) => ({
            title: role.title,
            department: role.department,
            role_family: role.roleFamily,
            seniority_band: role.seniorityBand,
            description: role.description
          }))
        )
        .select();

      const { data: mappings } = await supabase
        .from('xlsmart_role_mappings')
        .insert(
          parsedResult.mappings.map((mapping: any) => ({
            original_role_title: mapping.originalRole,
            standard_role_title: mapping.standardRole,
            confidence_score: mapping.confidence,
            mapping_reasoning: mapping.reasoning
          }))
        )
        .select();

      await supabase
        .from('xlsmart_upload_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      return new Response(JSON.stringify({
        success: true,
        standardRolesCreated: standardRoles?.length || 0,
        mappingsCreated: mappings?.length || 0,
        message: 'Standardization completed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: 'Invalid action' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});