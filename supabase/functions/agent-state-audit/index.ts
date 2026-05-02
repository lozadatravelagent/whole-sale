// =============================================================================
// agent-state-audit — Phase 8.6 audit endpoint (HTTP entry point)
// =============================================================================
//
// Read-only debugging endpoint that returns a snapshot of the EmiliaState +
// surrounding messages + tool calls + token usage for a given turn.
//
// Auth: requires a valid JWT for the agency that owns the conversation. The
// supabase service-role client is created with the user's `Authorization`
// header forwarded so that RLS still applies on `agent_states`, `messages`,
// and `conversations`. Cross-agency reads return 403.
//
// Wired through `withRateLimit` (action='message') so debugging traffic
// can't pile up on the parser quota.
//
// All data-flow logic lives in `./audit.ts` so vitest can exercise it
// without pulling in Deno-specific URL imports.
//
// Spec: docs/architecture/context-engineering-spec.md (Phase 8 telemetry)
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { withRateLimit } from "../_shared/rateLimit.ts";
import { buildAuditPayload } from "./audit.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // Service-role client used ONLY for the rate-limit RPC and JWT validation.
  // Per-request data queries go through the JWT-bound client below so RLS applies.
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  return await withRateLimit(
    req,
    supabaseAdmin,
    { action: 'message', resource: 'agent-state-audit' },
    async () => {
      try {
        if (req.method !== 'GET') {
          return new Response(
            JSON.stringify({ error: 'method_not_allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        const authHeader = req.headers.get('authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'missing_authorization' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // Validate the JWT once before any DB work.
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userRes?.user) {
          return new Response(
            JSON.stringify({ error: 'unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // RLS-bound client: queries below are filtered by the user's agency
        // via the existing `agent_states_select_policy` and conversation/
        // message policies.
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          global: { headers: { authorization: authHeader } },
          auth: { persistSession: false },
        });

        const url = new URL(req.url);
        const result = await buildAuditPayload(supabase, url);

        if (!result.ok) {
          return new Response(
            JSON.stringify({ error: result.reason }),
            { status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        return new Response(JSON.stringify(result.body), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('[agent-state-audit] error:', err);
        return new Response(
          JSON.stringify({ error: 'internal_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    },
  );
});
