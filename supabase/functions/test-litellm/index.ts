import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('Testing LiteLLM proxy connection...');

    // Get the API key from Supabase secrets - try both old and new
    let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');
    }
    
    console.log('All environment variables:', Object.keys(Deno.env.toObject()));
    console.log('API key found:', !!openAIApiKey);
    
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not found in environment variables');
    }

    const { message = "Hello, how are you?" } = await req.json().catch(() => ({}));

    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure/gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Respond concisely.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    console.log('LiteLLM Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiteLLM Error:', errorText);
      throw new Error(`LiteLLM API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('LiteLLM Response received successfully');

    const aiResponse = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      success: true,
      message: aiResponse,
      model: 'azure/gpt-4.1',
      proxy: 'proxyllm.ximplify.id/v1'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-litellm function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      details: 'Failed to connect to LiteLLM proxy'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});