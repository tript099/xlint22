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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const litellmApiKey = Deno.env.get('LITELLM_API_KEY');
    
    console.log('=== Environment Variables Test ===');
    console.log('OPENAI_API_KEY exists:', !!openAIApiKey);
    console.log('OPENAI_API_KEY length:', openAIApiKey?.length || 0);
    console.log('OPENAI_API_KEY first 10 chars:', openAIApiKey?.substring(0, 10) || 'N/A');
    console.log('LITELLM_API_KEY exists:', !!litellmApiKey);
    console.log('LITELLM_API_KEY length:', litellmApiKey?.length || 0);

    if (!openAIApiKey) {
      return new Response(JSON.stringify({ 
        error: 'OPENAI_API_KEY not found',
        allEnvVars: Object.keys(Deno.env.toObject()).filter(key => key.includes('API'))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test the LiteLLM proxy connection with actual key
    const testResponse = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          { role: 'system', content: 'You are a test assistant.' },
          { role: 'user', content: 'Respond with just "API test successful" and nothing else.' }
        ],
        max_completion_tokens: 20,
        temperature: 0.7,
      }),
    });

    const testData = await testResponse.json();
    
    if (!testResponse.ok) {
      return new Response(JSON.stringify({
        error: 'LiteLLM API test failed',
        status: testResponse.status,
        statusText: testResponse.statusText,
        apiError: testData,
        keyExists: true
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      keyExists: true,
      keyLength: openAIApiKey.length,
      apiTestResponse: testData.choices?.[0]?.message?.content || 'No response content'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Test failed:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});