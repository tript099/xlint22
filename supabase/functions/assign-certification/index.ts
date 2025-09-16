import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { employee_id, certification_name, certification_type, provider, issue_date, expiry_date } = await req.json()

    console.log('Assigning certification with service role:', {
      employee_id,
      certification_name,
      certification_type,
      provider,
      issue_date,
      expiry_date
    })

    // Insert with service role privileges
    const { data, error } = await supabaseClient
      .from('employee_certifications')
      .insert({
        employee_id,
        certification_name,
        certification_type: certification_type || 'professional',
        provider: provider || 'Unknown',
        issue_date,
        expiry_date,
        status: 'active'
      })
      .select()

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    console.log('Successfully assigned certification:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in assign-certification function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
