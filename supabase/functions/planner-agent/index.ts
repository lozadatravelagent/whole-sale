import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rateLimit.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { runAgentLoop } from "./agentLoop.ts";
import { buildToolRegistry } from "./tools/registry.ts";
import type { AgentContext } from "./types.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return await withRateLimit(
    req,
    supabase,
    { action: 'message', resource: 'planner-agent' },
    async () => {
      try {
        const { message, conversationId, conversationHistory = [], previousContext = null, userContext = null } = await req.json();

        if (!message) {
          throw new Error('Message is required');
        }

        console.log('[PLANNER AGENT] Processing message:', message);
        console.log('[PLANNER AGENT] Conversation:', conversationId);
        console.log('[PLANNER AGENT] History length:', conversationHistory.length);

        let resolvedUserContext = userContext;
        if (!resolvedUserContext?.currentCity) {
          const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('cf-connecting-ip')
            || '';
          let detectedCity = 'Buenos Aires';
          let detectedCountry = 'Argentina';
          if (ip && ip !== '127.0.0.1' && !ip.startsWith('192.168.')) {
            try {
              const geoResp = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,status&lang=es`);
              const geoData = await geoResp.json();
              if (geoData.status === 'success' && geoData.city) {
                detectedCity = geoData.city;
                detectedCountry = geoData.country || detectedCountry;
              }
            } catch { /* use default */ }
          }
          resolvedUserContext = { currentCity: detectedCity, country: detectedCountry };
        }

        const tools = buildToolRegistry(supabase);

        const context: AgentContext = {
          userMessage: message,
          conversationHistory,
          previousContext,
          userContext: resolvedUserContext,
          tools,
        };

        const result = await runAgentLoop(context);

        console.log('[PLANNER AGENT] Result:', {
          responseLength: result.response.length,
          hasStructuredData: Boolean(result.structuredData),
          stepsCount: result.steps.length,
          needsInput: result.needsInput,
        });

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[PLANNER AGENT] Error:', error);
        return new Response(JSON.stringify({
          response: 'Ocurrió un error procesando tu solicitud. Por favor, intenta de nuevo.',
          steps: [],
          error: error.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  );
});
