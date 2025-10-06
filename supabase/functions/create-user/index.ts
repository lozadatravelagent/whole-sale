import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // Get authorization header (JWT token)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('❌ [CREATE-USER] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔑 [CREATE-USER] Auth header received');

    const { email, password, name, role, agency_id, tenant_id } = await req.json();

    // Validate required parameters
    if (!email || !password || !role) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: email, password, role'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Create admin client for auth operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate JWT token (ensure requester is authenticated)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      console.error('❌ [CREATE-USER] Invalid JWT token:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [CREATE-USER] Authenticated user:', requestingUser.id);

    // Get requesting user's role from public.users
    const { data: requestingUserData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, agency_id, tenant_id')
      .eq('id', requestingUser.id)
      .single();

    if (userError || !requestingUserData) {
      console.error('❌ [CREATE-USER] Could not fetch requesting user data:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found in database' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 [CREATE-USER] Requesting user role:', requestingUserData.role);

    // Validate permissions directly (instead of using RPC to avoid RLS issues)
    let canCreate = false;

    if (requestingUserData.role === 'OWNER') {
      canCreate = true; // OWNER can create any role
    } else if (requestingUserData.role === 'SUPERADMIN' && ['SUPERADMIN', 'ADMIN', 'SELLER'].includes(role)) {
      canCreate = true; // SUPERADMIN can create SUPERADMIN, ADMIN, SELLER
    } else if (requestingUserData.role === 'ADMIN' && role === 'SELLER') {
      canCreate = true; // ADMIN can only create SELLER
    }

    if (!canCreate) {
      console.error('❌ [CREATE-USER] Permission denied. User role:', requestingUserData.role, 'Target role:', role);
      return new Response(
        JSON.stringify({ error: 'No tienes permisos para crear usuarios con este rol' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [CREATE-USER] Permission granted to create role:', role);

    // Determine tenant_id (if not OWNER, use requesting user's tenant)
    let finalTenantId = tenant_id;
    if (requestingUserData.role !== 'OWNER') {
      finalTenantId = requestingUserData.tenant_id;
    }

    // Create user in auth.users with admin privileges
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification
      user_metadata: { name, role }
    });

    if (createError) {
      console.error('❌ [CREATE-USER] Error creating auth user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message || 'Error creating user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [CREATE-USER] Auth user created:', newUser.user.id);

    // Create public.users record
    const { data: publicUser, error: publicError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUser.user.id,
        email,
        name: name || null,
        role,
        agency_id: agency_id || null,
        tenant_id: finalTenantId || null,
        provider: 'email'
      })
      .select()
      .single();

    if (publicError) {
      console.error('❌ [CREATE-USER] Error creating public user:', publicError);

      // Rollback: delete auth user if public user creation fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);

      return new Response(
        JSON.stringify({ error: publicError.message || 'Error creating user profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [CREATE-USER] Public user created successfully');

    // Update app_metadata with role, agency_id, tenant_id for JWT claims
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      newUser.user.id,
      {
        app_metadata: {
          user_role: role,
          agency_id: agency_id || null,
          tenant_id: finalTenantId || null
        }
      }
    );

    if (metadataError) {
      console.error('⚠️ [CREATE-USER] Warning: Could not update app_metadata:', metadataError);
      // Don't fail the request, just log the warning
    } else {
      console.log('✅ [CREATE-USER] App metadata updated with JWT claims');
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: publicUser
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ [CREATE-USER] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
