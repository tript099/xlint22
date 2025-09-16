import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('🗑️ Starting database cleanup...');

    // Delete in order to respect foreign key constraints
    console.log('Deleting role mappings...');
    const { error: mappingsError } = await supabase
      .from('xlsmart_role_mappings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    console.log('Deleting job descriptions...');
    const { error: jdError } = await supabase
      .from('xlsmart_job_descriptions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    console.log('Clearing employee role assignments...');
    const { error: employeeError } = await supabase
      .from('xlsmart_employees')
      .update({
        standard_role_id: null,
        ai_suggested_role_id: null,
        original_role_title: null,
        role_assignment_status: 'pending',
        assigned_by: null,
        assignment_notes: null
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

    console.log('Deleting XL roles data...');
    const { error: xlError } = await supabase
      .from('xl_roles_data')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    console.log('Deleting SMART roles data...');
    const { error: smartError } = await supabase
      .from('smart_roles_data')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    console.log('Deleting role catalogs...');
    const { error: catalogError } = await supabase
      .from('xlsmart_role_catalogs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    console.log('Deleting upload sessions...');
    const { error: sessionsError } = await supabase
      .from('xlsmart_upload_sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    // Check for any errors
    const errors = [mappingsError, jdError, employeeError, xlError, smartError, catalogError, sessionsError]
      .filter(error => error !== null);

    if (errors.length > 0) {
      console.error('Errors during cleanup:', errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          errors: errors.map(e => e?.message),
          message: 'Some deletions failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get final counts
    console.log('Getting final counts...');
    const [xlCount, smartCount, mappingsCount, sessionsCount, catalogsCount] = await Promise.all([
      supabase.from('xl_roles_data').select('*', { count: 'exact', head: true }),
      supabase.from('smart_roles_data').select('*', { count: 'exact', head: true }),
      supabase.from('xlsmart_role_mappings').select('*', { count: 'exact', head: true }),
      supabase.from('xlsmart_upload_sessions').select('*', { count: 'exact', head: true }),
      supabase.from('xlsmart_role_catalogs').select('*', { count: 'exact', head: true })
    ]);

    const result = {
      success: true,
      message: 'Database cleared successfully! 🎉',
      finalCounts: {
        xl_roles_data: xlCount.count || 0,
        smart_roles_data: smartCount.count || 0,
        xlsmart_role_mappings: mappingsCount.count || 0,
        xlsmart_upload_sessions: sessionsCount.count || 0,
        xlsmart_role_catalogs: catalogsCount.count || 0
      }
    };

    console.log('✅ Cleanup completed:', result);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error during cleanup:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        message: 'Database cleanup failed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
