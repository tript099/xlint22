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
  console.log('🚀 Function invoked:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Parsing request body...');
    const requestBody = await req.json();
    console.log('📋 Request action:', requestBody.action);
    
    const { action, sessionName, excelData, sessionId } = requestBody;
    
    // Test endpoint
    if (action === 'test') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Edge function is working with LiteLLM',
        timestamp: new Date().toISOString(),
        liteLLMEndpoint: 'https://proxyllm.ximplify.id',
        hasLiteLLMKey: !!Deno.env.get('OPENAI_API_KEY')
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'upload') {
      console.log('Starting flexible role upload for session:', sessionName);
      console.log('Received', excelData.length, 'Excel files');

      // Get current user ID from authorization header  
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Authorization header missing or invalid');
      }
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        console.error('Auth error:', userError);
        throw new Error(`Authentication failed: ${userError?.message || 'User not found'}`);
      }

      console.log('Authenticated user:', user.id);

      // Create upload session with JSON storage
      const { data: session, error: sessionError } = await supabase
        .from('xlsmart_upload_sessions')
        .insert({
          session_name: sessionName,
          file_names: excelData.map((file: any) => file.fileName),
          temp_table_names: [], // Not using actual tables
          total_rows: excelData.reduce((sum: number, file: any) => sum + file.rows.length, 0),
          status: 'analyzing',
          created_by: user.id,
          ai_analysis: {
            raw_data: excelData // Store all Excel data as JSON
          }
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Failed to create upload session: ${sessionError.message}`);
      }

      console.log('✅ Upload session created with ID:', session.id);

      return new Response(JSON.stringify({
        success: true,
        sessionId: session.id,
        totalRows: session.total_rows,
        message: `Successfully stored ${session.total_rows} rows from ${excelData.length} files`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'standardize') {
      console.log('Starting AI standardization for session:', sessionId);

      // Get current user ID from authorization header
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Authorization header missing or invalid');
      }
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        console.error('Auth error:', userError);
        throw new Error(`Authentication failed: ${userError?.message || 'User not found'}`);
      }

      console.log('Authenticated user for standardization:', user.id);

      // Get upload session
      const { data: session, error: sessionError } = await supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        throw new Error('Upload session not found');
      }

      // Get LiteLLM API key
      const liteLLMApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!liteLLMApiKey) {
        throw new Error('LiteLLM API key not configured');
      }
      
      console.log('Using LiteLLM proxy for AI processing');

      // Update status
      await supabase
        .from('xlsmart_upload_sessions')
        .update({ status: 'standardizing' })
        .eq('id', sessionId);

      const rawData = session.ai_analysis.raw_data;
      const allRoles: any[] = [];
      
      // Collect all role data from all files
      for (const fileData of rawData) {
        const { fileName, headers, rows } = fileData;
        
        for (let i = 0; i < rows.length; i++) {
          const roleData: any = {
            source_file: fileName,
            original_row_number: i + 1
          };
          
          // Map headers to values
          for (let j = 0; j < headers.length; j++) {
            roleData[headers[j]] = rows[i][j] || '';
          }
          
          allRoles.push(roleData);
        }
      }

      console.log('Total roles to analyze:', allRoles.length);

      // Use AI to analyze and create standard roles
      const sampleRoles = allRoles.slice(0, 10);
      const allHeaders = [...new Set(rawData.flatMap((file: any) => file.headers))];
      
      const aiPrompt = `
Analyze this role data and create standardized telecommunications roles.

Available Columns: ${allHeaders.join(', ')}
Sample Role Data: ${JSON.stringify(sampleRoles)}
Total Roles: ${allRoles.length}

Create standardized roles for a telecommunications company. Your response should be JSON:

{
  "detected_structure": {
    "title_column": "best_column_for_role_titles",
    "department_column": "best_column_for_departments", 
    "level_column": "best_column_for_levels",
    "other_useful_columns": ["col1", "col2"]
  },
  "standard_roles": [
    {
      "role_title": "Network Engineer",
      "job_family": "Technology",
      "role_level": "Mid",
      "department": "Network Operations",
      "standard_description": "Designs and maintains network infrastructure",
      "core_responsibilities": ["Network design", "Troubleshooting", "Maintenance"],
      "required_skills": ["Cisco", "TCP/IP", "Routing"],
      "keywords": ["network", "engineer", "infrastructure"]
    }
  ],
  "mapping_rules": [
    {
      "original_pattern": "Network.*Engineer",
      "maps_to": "Network Engineer",
      "confidence": 90
    }
  ]
}

Focus on telecommunications-specific roles and create comprehensive standard roles.
`;

      const aiResponse = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${liteLLMApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'azure/gpt-4.1',
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert HR analyst for telecommunications companies. Create standardized role definitions and mapping rules. Always respond with valid JSON.' 
            },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`LiteLLM API error: ${aiResponse.statusText}`);
      }

      const aiData = await aiResponse.json();
      let analysis;
      
      try {
        analysis = JSON.parse(aiData.choices[0].message.content);
      } catch (parseError) {
        console.error('Failed to parse AI response:', aiData.choices[0].message.content);
        throw new Error('Failed to parse AI analysis');
      }

      console.log('AI Analysis complete:', analysis);

      // Create standard roles in database
      const createdStandardRoles = [];
      for (const standardRole of analysis.standard_roles || []) {
        const { data: createdRole, error: roleError } = await supabase
          .from('xlsmart_standard_roles')
          .insert({
            role_title: standardRole.role_title,
            job_family: standardRole.job_family,
            role_level: standardRole.role_level,
            department: standardRole.department,
            standard_description: standardRole.standard_description,
            core_responsibilities: standardRole.core_responsibilities || [],
            required_skills: standardRole.required_skills || [],
            keywords: standardRole.keywords || [],
            industry_alignment: 'Telecommunications',
            created_by: user.id
          })
          .select()
          .single();

        if (!roleError && createdRole) {
          createdStandardRoles.push(createdRole);
        }
      }

      // Create role mappings
      const titleColumn = analysis.detected_structure?.title_column;
      const mappings = [];
      
      if (titleColumn && createdStandardRoles.length > 0) {
        for (const role of allRoles) {
          const originalTitle = role[titleColumn];
          if (!originalTitle) continue;

          // Find best matching standard role using mapping rules
          let bestMatch = null;
          let bestConfidence = 0;

          for (const rule of analysis.mapping_rules || []) {
            const pattern = new RegExp(rule.original_pattern, 'i');
            if (pattern.test(originalTitle)) {
              bestMatch = createdStandardRoles.find(sr => sr.role_title === rule.maps_to);
              bestConfidence = rule.confidence || 70;
              break;
            }
          }

          // Fallback: simple text matching
          if (!bestMatch) {
            bestMatch = createdStandardRoles.find(sr => 
              sr.role_title.toLowerCase().includes(originalTitle.toLowerCase()) ||
              originalTitle.toLowerCase().includes(sr.role_title.toLowerCase())
            );
            bestConfidence = 60;
          }

          // Last resort: pick first standard role
          if (!bestMatch && createdStandardRoles.length > 0) {
            bestMatch = createdStandardRoles[0];
            bestConfidence = 40;
          }

          if (bestMatch) {
            mappings.push({
              original_role_title: originalTitle,
              original_department: role[analysis.detected_structure?.department_column] || null,
              original_level: role[analysis.detected_structure?.level_column] || null,
              standardized_role_title: bestMatch.role_title,
              standardized_department: bestMatch.department,
              standardized_level: bestMatch.role_level,
              job_family: bestMatch.job_family,
              standard_role_id: bestMatch.id,
              mapping_confidence: bestConfidence,
              mapping_status: bestConfidence > 70 ? 'auto_mapped' : 'manual_review'
            });
          }
        }
      }

      // Create a catalog entry
      const { data: catalog, error: catalogError } = await supabase
        .from('xlsmart_role_catalogs')
        .insert({
          source_company: 'dynamic_upload',
          file_name: session.file_names.join(', '),
          file_format: 'excel',
          upload_status: 'completed',
          uploaded_by: user.id,
          total_roles: mappings.length,
          processed_roles: mappings.length,
          mapping_accuracy: mappings.length > 0 ? 
            mappings.reduce((sum, m) => sum + m.mapping_confidence, 0) / mappings.length : 0
        })
        .select()
        .single();

      // Insert mappings with catalog reference
      if (!catalogError && catalog && mappings.length > 0) {
        const mappingsWithCatalog = mappings.map(m => ({ ...m, catalog_id: catalog.id }));
        
        const { error: mappingsError } = await supabase
          .from('xlsmart_role_mappings')
          .insert(mappingsWithCatalog);

        if (mappingsError) {
          console.error('Error inserting mappings:', mappingsError);
        }
      }

      // Update session
      await supabase
        .from('xlsmart_upload_sessions')
        .update({ 
          status: 'completed',
          ai_analysis: {
            ...session.ai_analysis,
            detected_structure: analysis.detected_structure,
            standard_roles_created: createdStandardRoles.length,
            mappings_created: mappings.length,
            catalog_id: catalog?.id
          }
        })
        .eq('id', sessionId);

      console.log('Standardization complete');

      return new Response(JSON.stringify({
        success: true,
        standardRolesCreated: createdStandardRoles.length,
        mappingsCreated: mappings.length,
        catalogId: catalog?.id,
        message: 'AI role standardization completed successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('❌ Function error:', error);
    console.error('📍 Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});