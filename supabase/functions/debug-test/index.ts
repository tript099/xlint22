import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== SIMPLE TEST FUNCTION STARTED ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing request...');
    
    // Check environment variables
    const litellmApiKey = Deno.env.get('LITELLM_API_KEY');
    console.log('LiteLLM API key found:', !!litellmApiKey);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    console.log('Supabase URL found:', !!supabaseUrl);
    console.log('Supabase Service Key found:', !!supabaseServiceKey);

    // Parse request body
    let requestBody = {};
    try {
      requestBody = await req.json();
      console.log('Request body parsed:', JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.log('No JSON body or parse error:', parseError.message);
    }

    // Test LiteLLM API call
    if (litellmApiKey) {
      console.log('Testing LiteLLM API call...');
      
      const response = await fetch('https://proxyllm.ximplify.id/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${litellmApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'azure/gpt-4.1',
          messages: [
            { role: 'system', content: 'You are a test assistant.' },
            { role: 'user', content: 'Say "Hello from edge function test!"' }
          ],
          temperature: 0.3,
          max_tokens: 50,
        }),
      });

      console.log('LiteLLM response status:', response.status);
      
      if (response.ok) {
        const aiData = await response.json();
        console.log('LiteLLM response received successfully');
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Function test completed successfully',
          litellmResponse: aiData.choices[0].message.content,
          environmentCheck: {
            litellmApiKey: !!litellmApiKey,
            supabaseUrl: !!supabaseUrl,
            supabaseServiceKey: !!supabaseServiceKey
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        const errorText = await response.text();
        console.error('LiteLLM API error:', errorText);
        
        return new Response(JSON.stringify({
          success: false,
          error: `LiteLLM API error: ${response.status} ${response.statusText}`,
          details: errorText
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'LITELLM_API_KEY not found',
        environmentCheck: {
          litellmApiKey: !!litellmApiKey,
          supabaseUrl: !!supabaseUrl,
          supabaseServiceKey: !!supabaseServiceKey
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('=== CRITICAL ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});