import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Get the authorization header to forward user context
    const authHeader = req.headers.get('authorization');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            authorization: authHeader,
          },
        },
      }
    );

    const { sessionId } = await req.json();

    console.log('Starting to fix existing upload for session:', sessionId);

    // Get the upload session
    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    console.log('Found session:', session.session_name);

    // Get the raw data from the session
    const rawData = session.ai_analysis?.raw_data;
    if (!rawData) {
      throw new Error('No raw data found in session');
    }

    console.log('Processing raw data files:', rawData.length);

    let totalFixed = 0;

    // Process each file in the raw data
    for (const fileData of rawData) {
      const { fileName, headers, rows } = fileData;
      
      console.log(`Processing file: ${fileName}`);
      console.log('Headers:', headers);

      // Find the title column
      let titleColumnIndex = -1;
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (header && (
          header.toLowerCase().includes('title') ||
          header.toLowerCase().includes('name') ||
          header.toLowerCase().includes('position') ||
          header.toLowerCase().includes('role')
        )) {
          titleColumnIndex = i;
          console.log(`Found title column at index ${i}: "${header}"`);
          break;
        }
      }

      if (titleColumnIndex === -1) {
        console.log('No title column found, using first column');
        titleColumnIndex = 0;
      }

      // Extract titles from rows
      const titles = rows.map((row: any[]) => {
        if (row && row[titleColumnIndex]) {
          return String(row[titleColumnIndex]).trim();
        }
        return null;
      }).filter(title => title && title !== '' && title !== 'null');

      console.log(`Extracted ${titles.length} titles from file`);

      // Update XL roles data
      if (titles.length > 0) {
        const { data: xlRoles, error: xlError } = await supabase
          .from('xl_roles_data')
          .select('id, role_title')
          .eq('session_id', sessionId)
          .eq('role_title', 'Unknown Role');

        if (xlError) {
          console.error('Error fetching XL roles:', xlError);
        } else if (xlRoles && xlRoles.length > 0) {
          console.log(`Found ${xlRoles.length} XL roles with "Unknown Role"`);

          // Update each role with a title from the extracted list
          for (let i = 0; i < Math.min(xlRoles.length, titles.length); i++) {
            const { error: updateError } = await supabase
              .from('xl_roles_data')
              .update({ role_title: titles[i] })
              .eq('id', xlRoles[i].id);

            if (updateError) {
              console.error('Error updating XL role:', updateError);
            } else {
              totalFixed++;
              console.log(`Updated XL role ${xlRoles[i].id} with title: "${titles[i]}"`);
            }
          }
        }
      }

      // Update SMART roles data
      if (titles.length > 0) {
        const { data: smartRoles, error: smartError } = await supabase
          .from('smart_roles_data')
          .select('id, role_title')
          .eq('session_id', sessionId)
          .eq('role_title', 'Unknown Role');

        if (smartError) {
          console.error('Error fetching SMART roles:', smartError);
        } else if (smartRoles && smartRoles.length > 0) {
          console.log(`Found ${smartRoles.length} SMART roles with "Unknown Role"`);

          // Update each role with a title from the extracted list
          for (let i = 0; i < Math.min(smartRoles.length, titles.length); i++) {
            const { error: updateError } = await supabase
              .from('smart_roles_data')
              .update({ role_title: titles[i] })
              .eq('id', smartRoles[i].id);

            if (updateError) {
              console.error('Error updating SMART role:', updateError);
            } else {
              totalFixed++;
              console.log(`Updated SMART role ${smartRoles[i].id} with title: "${titles[i]}"`);
            }
          }
        }
      }
    }

    console.log(`Fixed ${totalFixed} roles total`);

    return new Response(JSON.stringify({
      success: true,
      totalFixed,
      message: `Successfully fixed ${totalFixed} roles with "Unknown Role" titles`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fix-existing-uploads function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});






