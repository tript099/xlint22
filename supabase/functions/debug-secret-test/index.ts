import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SECRET DEBUG TEST ===');
    
    // Check all environment variables
    const allEnvVars = Deno.env.toObject();
    const apiKeyVars = Object.keys(allEnvVars).filter(key => key.includes('API'));
    
    console.log('All API-related env vars:', apiKeyVars);
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const litellmApiKey = Deno.env.get('LITELLM_API_KEY');
    
    console.log('OPENAI_API_KEY exists:', !!openAIApiKey);
    console.log('OPENAI_API_KEY type:', typeof openAIApiKey);
    console.log('OPENAI_API_KEY length:', openAIApiKey?.length || 0);
    console.log('LITELLM_API_KEY exists:', !!litellmApiKey);

    if (openAIApiKey) {
      console.log('OPENAI_API_KEY first 10 chars:', openAIApiKey.substring(0, 10));
      console.log('OPENAI_API_KEY starts with sk-:', openAIApiKey.startsWith('sk-'));
    }

    return new Response(JSON.stringify({
      success: true,
      openAIKeyExists: !!openAIApiKey,
      openAIKeyLength: openAIApiKey?.length || 0,
      openAIKeyType: typeof openAIApiKey,
      litellmKeyExists: !!litellmApiKey,
      allApiVars: apiKeyVars,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Debug test error:', error);
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