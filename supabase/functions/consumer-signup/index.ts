/**
 * consumer-signup — Paso 4 B2C auth
 *
 * Public endpoint (no JWT required) that creates a B2C consumer account.
 * Uses the service role internally to set app_metadata.account_type and
 * role='CONSUMER', which cannot be done from the client via a plain
 * supabase.auth.signUp() call.
 *
 * Parallel to create-user/index.ts but intentionally separate:
 *   - create-user requires an authenticated caller and enforces B2B
 *     permission rules (OWNER → *, ADMIN → SELLER).
 *   - consumer-signup is public self-signup and ONLY creates consumers.
 *     It never accepts an arbitrary role; the CHECK constraint on
 *     public.users enforces (account_type='consumer' AND role='CONSUMER').
 *
 * TODO (follow-up): rate limiting by IP to prevent signup spam / abuse.
 * TODO (follow-up): optional email verification flow when product
 *                   requires trust level enforcement.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: email, password, name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log('📝 [CONSUMER-SIGNUP] Creating consumer account for:', email);

    // Step 1: create the auth.users row with email_confirm=true (skip the
    // email verification loop for MVP) and seed app_metadata with the
    // consumer-specific claims that RLS policies and AuthContext read.
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
        app_metadata: {
          user_role: 'CONSUMER',
          account_type: 'consumer',
        },
      });

    if (createError || !newUser?.user) {
      console.error('❌ [CONSUMER-SIGNUP] Error creating auth user:', createError);
      const message =
        createError?.message?.toLowerCase().includes('already')
          ? 'Ya existe una cuenta con ese email.'
          : createError?.message || 'No se pudo crear la cuenta.';
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [CONSUMER-SIGNUP] Auth user created:', newUser.user.id);

    // Step 2: insert the public.users profile row with role='CONSUMER',
    // account_type='consumer', agency_id=null, tenant_id=null. The CHECK
    // constraint users_account_type_role_check enforces this pairing.
    const { data: publicUser, error: publicError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUser.user.id,
        email,
        name,
        role: 'CONSUMER',
        account_type: 'consumer',
        agency_id: null,
        tenant_id: null,
        provider: 'email',
      })
      .select()
      .single();

    if (publicError) {
      console.error('❌ [CONSUMER-SIGNUP] Error creating public.users row:', publicError);

      // Rollback auth.users so the email is free for a retry.
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);

      return new Response(
        JSON.stringify({ error: publicError.message || 'No se pudo crear el perfil.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [CONSUMER-SIGNUP] Public user created');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: publicUser.id,
          email: publicUser.email,
          name: publicUser.name,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [CONSUMER-SIGNUP] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
