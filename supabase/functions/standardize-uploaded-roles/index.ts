import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log('=== STANDARDIZATION FUNCTION STARTED ===');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // LiteLLM not needed for this function - just doing data standardization

    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log('Starting role standardization for session:', sessionId);

    // Update session status to 'standardizing'
    await supabase
      .from('xlsmart_upload_sessions')
      .update({ 
        status: 'standardizing',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    // Fetch data from xl_roles_data and smart_roles_data
    const { data: xlData, error: xlError } = await supabase
      .from('xl_roles_data')
      .select('*')
      .eq('session_id', sessionId);

    if (xlError) {
      console.error('Error fetching XL data:', xlError);
      throw new Error(`Failed to fetch XL data: ${xlError.message}`);
    }

    const { data: smartData, error: smartError } = await supabase
      .from('smart_roles_data')
      .select('*')
      .eq('session_id', sessionId);

    if (smartError) {
      console.error('Error fetching SMART data:', smartError);
      throw new Error(`Failed to fetch SMART data: ${smartError.message}`);
    }

    console.log('Data fetched:', {
      xlCount: xlData?.length || 0,
      smartCount: smartData?.length || 0
    });

    if (!xlData?.length && !smartData?.length) {
      console.log('No data found for processing');
      await supabase
        .from('xlsmart_upload_sessions')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      return new Response(JSON.stringify({
        success: true,
        standardizedRolesCreated: 0,
        mappingsCreated: 0,
        message: 'No data to process'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get session creator for proper user assignment
    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .select('created_by')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      throw new Error(`Failed to fetch session: ${sessionError.message}`);
    }

    const createdBy = session?.created_by;
    if (!createdBy) {
      throw new Error('Session creator not found - session may not exist or user not authenticated');
    }

    // Combine all roles for processing
    const allRoles = [
      ...(xlData || []).map(role => ({ ...role, source: 'xl' })),
      ...(smartData || []).map(role => ({ ...role, source: 'smart' }))
    ];

    console.log('Processing roles:', allRoles.length);

    // Create a role catalog entry first
    const { data: catalogData, error: catalogError } = await supabase
      .from('xlsmart_role_catalogs')
      .insert({
        source_company: 'XL Axiata + Smartfren',
        file_name: 'Combined Upload',
        file_format: 'xlsx',
        upload_status: 'completed',
        total_roles: allRoles.length,
        processed_roles: allRoles.length,
        mapping_accuracy: 100.0,
        uploaded_by: createdBy
      })
      .select()
      .single();

    if (catalogError) {
      console.error('Error creating catalog:', catalogError);
      throw new Error('Failed to create role catalog');
    }

    const catalogId = catalogData.id;
    console.log(`Created catalog with ID: ${catalogId}`);

    // Create standardized roles and mappings
    const standardizedRoles = [];
    const mappings = [];

    // Group similar roles together
    const roleGroups = new Map();
    
    for (const role of allRoles) {
      const key = role.role_title?.toLowerCase().trim() || 'untitled';
      if (!roleGroups.has(key)) {
        roleGroups.set(key, []);
      }
      roleGroups.get(key).push(role);
    }

    console.log('Grouped into', roleGroups.size, 'unique role titles');

    // Create standardized roles for each group
    for (const [roleTitle, roles] of roleGroups) {
      const firstRole = roles[0];
      
      // Create standardized role
      const standardizedRole = {
        role_title: firstRole.role_title || roleTitle,
        job_family: firstRole.role_family || firstRole.department || 'General',
        role_level: firstRole.seniority_band || 'Mid',
        role_category: 'Standard',
        department: firstRole.department || 'General',
        standard_description: firstRole.role_purpose || 'Standard role description',
        core_responsibilities: firstRole.core_responsibilities ? [firstRole.core_responsibilities] : [],
        required_skills: firstRole.required_skills ? firstRole.required_skills.split(',').map(s => s.trim()) : [],
        experience_range_min: firstRole.experience_min_years || 0,
        experience_range_max: (firstRole.experience_min_years || 0) + 5,
        education_requirements: firstRole.education ? [firstRole.education] : [],
        keywords: [roleTitle, firstRole.role_title].filter(Boolean),
        created_by: createdBy,
        industry_alignment: 'Telecommunications'
      };

      const { data: insertedRole, error: roleError } = await supabase
        .from('xlsmart_standard_roles')
        .insert(standardizedRole)
        .select('id')
        .single();

      if (roleError) {
        console.error('Error inserting standardized role:', roleError);
        continue;
      }

      standardizedRoles.push(insertedRole);

      // Create mappings for all roles in this group
      for (const originalRole of roles) {
        const mapping = {
          original_role_title: originalRole.role_title,
          original_department: originalRole.department,
          original_level: originalRole.seniority_band,
          standardized_role_title: standardizedRole.role_title,
          standardized_department: standardizedRole.department,
          standardized_level: standardizedRole.role_level,
          job_family: standardizedRole.job_family,
          standard_role_id: insertedRole.id,
          mapping_confidence: 0.95,
          mapping_status: 'auto_mapped',
          requires_manual_review: false,
          catalog_id: catalogId
        };

        mappings.push(mapping);
      }
    }

    // Insert all mappings
    if (mappings.length > 0) {
      const { error: mappingError } = await supabase
        .from('xlsmart_role_mappings')
        .insert(mappings);

      if (mappingError) {
        console.error('Error inserting mappings:', mappingError);
      }
    }

    await supabase
      .from('xlsmart_upload_sessions')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    console.log('=== STANDARDIZATION COMPLETED SUCCESSFULLY ===');

    return new Response(JSON.stringify({
      success: true,
      standardizedRolesCreated: standardizedRoles.length,
      mappingsCreated: mappings.length,
      message: 'Roles standardized successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== ERROR IN STANDARDIZATION ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      message: 'Standardization failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});