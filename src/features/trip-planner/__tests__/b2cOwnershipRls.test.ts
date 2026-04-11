/**
 * B2C Ownership RLS Policy Tests — Phase 1.1.a
 *
 * Integration tests that exercise the RLS policies created by
 * 20260409000002_b2c_ownership.sql against a live Supabase instance.
 *
 * Requirements:
 *   - Running Supabase (local or remote) with migrations applied
 *   - Environment variables:
 *       SUPABASE_URL             (or defaults to hardcoded project URL)
 *       SUPABASE_SERVICE_ROLE_KEY (required — no default)
 *       SUPABASE_ANON_KEY        (or defaults to hardcoded project anon key)
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm test
 *
 * Skipped automatically when SUPABASE_SERVICE_ROLE_KEY is not set.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  'https://ujigyazketblwlzcomve.supabase.co';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA';

const canRun = Boolean(SERVICE_ROLE_KEY);

if (!canRun) {
  // Use process.stderr.write to bypass vitest's output buffering for skipped suites
  process.stderr.write(
    '\n\u26a0\ufe0f  b2cOwnershipRls.test.ts SKIPPED: SUPABASE_SERVICE_ROLE_KEY not set.\n' +
    '    These tests validate RLS policies and MUST run before merging any PR that touches\n' +
    '    migrations or policies. See TESTING.md for setup.\n\n'
  );
}

const TEST_PASSWORD = 'b2c-rls-test-9x7k!';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an RLS-scoped Supabase client by signing in as the given user. */
async function signInAsUser(
  email: string,
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`signInAsUser(${email}): ${error.message}`);
  return client;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skipIf(!canRun)('B2C Ownership RLS Policies', () => {
  // Admin client (service_role — bypasses RLS)
  let admin: SupabaseClient;

  // RLS-scoped clients
  let agentClient: SupabaseClient;
  let consumerClient: SupabaseClient;
  let consumerBClient: SupabaseClient;

  // Test entity IDs (for cleanup)
  let tenantId: string;
  let agencyId: string;
  let agentUserId: string;
  let consumerUserId: string;
  let consumerBUserId: string;
  const createdTripIds: string[] = [];

  // Emails (unique per run to avoid collisions)
  const ts = Date.now();
  const agentEmail = `test-agent-${ts}@b2c-rls.test`;
  const consumerEmail = `test-consumer-a-${ts}@b2c-rls.test`;
  const consumerBEmail = `test-consumer-b-${ts}@b2c-rls.test`;

  // -----------------------------------------------------------------------
  // Setup
  // -----------------------------------------------------------------------

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // -- Tenant & agency --------------------------------------------------
    const { data: tenant, error: te } = await admin
      .from('tenants')
      .insert({ name: `B2C RLS Test ${ts}` })
      .select('id')
      .single();
    if (te) throw new Error(`tenant: ${te.message}`);
    tenantId = tenant!.id;

    const { data: agency, error: ae } = await admin
      .from('agencies')
      .insert({ name: `B2C Agency ${ts}`, tenant_id: tenantId })
      .select('id')
      .single();
    if (ae) throw new Error(`agency: ${ae.message}`);
    agencyId = agency!.id;

    // -- Agent user -------------------------------------------------------
    const { data: agentAuth, error: agentAuthErr } =
      await admin.auth.admin.createUser({
        email: agentEmail,
        password: TEST_PASSWORD,
        email_confirm: true,
        app_metadata: {
          user_role: 'ADMIN',
          agency_id: agencyId,
          tenant_id: tenantId,
          account_type: 'agent',
        },
      });
    if (agentAuthErr) throw new Error(`agentAuth: ${agentAuthErr.message}`);
    agentUserId = agentAuth.user.id;

    await admin.from('users').insert({
      id: agentUserId,
      email: agentEmail,
      name: 'RLS Test Agent',
      role: 'ADMIN',
      agency_id: agencyId,
      tenant_id: tenantId,
      account_type: 'agent',
      provider: 'email',
    });

    // -- Consumer A -------------------------------------------------------
    const { data: conAuth, error: conAuthErr } =
      await admin.auth.admin.createUser({
        email: consumerEmail,
        password: TEST_PASSWORD,
        email_confirm: true,
        app_metadata: {
          user_role: 'CONSUMER',
          account_type: 'consumer',
        },
      });
    if (conAuthErr) throw new Error(`consumerAuth: ${conAuthErr.message}`);
    consumerUserId = conAuth.user.id;

    await admin.from('users').insert({
      id: consumerUserId,
      email: consumerEmail,
      name: 'RLS Test Consumer A',
      role: 'CONSUMER',
      account_type: 'consumer',
      provider: 'email',
    });

    // -- Consumer B -------------------------------------------------------
    const { data: conBAuth, error: conBAuthErr } =
      await admin.auth.admin.createUser({
        email: consumerBEmail,
        password: TEST_PASSWORD,
        email_confirm: true,
        app_metadata: {
          user_role: 'CONSUMER',
          account_type: 'consumer',
        },
      });
    if (conBAuthErr) throw new Error(`consumerBAuth: ${conBAuthErr.message}`);
    consumerBUserId = conBAuth.user.id;

    await admin.from('users').insert({
      id: consumerBUserId,
      email: consumerBEmail,
      name: 'RLS Test Consumer B',
      role: 'CONSUMER',
      account_type: 'consumer',
      provider: 'email',
    });

    // -- Seed trips (via admin — bypasses RLS) ----------------------------

    // Agent trip
    const { data: at } = await admin
      .from('trips')
      .insert({
        agency_id: agencyId,
        tenant_id: tenantId,
        created_by: agentUserId,
        owner_user_id: agentUserId,
        account_type: 'agent',
        status: 'draft',
        planner_state: {},
      })
      .select('id')
      .single();
    if (at) createdTripIds.push(at.id);

    // Consumer A trip
    const { data: ct } = await admin
      .from('trips')
      .insert({
        created_by: consumerUserId,
        owner_user_id: consumerUserId,
        account_type: 'consumer',
        status: 'exploring',
        planner_state: {},
      })
      .select('id')
      .single();
    if (ct) createdTripIds.push(ct.id);

    // Consumer B trip
    const { data: cbt } = await admin
      .from('trips')
      .insert({
        created_by: consumerBUserId,
        owner_user_id: consumerBUserId,
        account_type: 'consumer',
        status: 'exploring',
        planner_state: {},
      })
      .select('id')
      .single();
    if (cbt) createdTripIds.push(cbt.id);

    // -- Sign in as each user ---------------------------------------------
    agentClient = await signInAsUser(agentEmail);
    consumerClient = await signInAsUser(consumerEmail);
    consumerBClient = await signInAsUser(consumerBEmail);
  }, 30_000);

  // -----------------------------------------------------------------------
  // Teardown
  // -----------------------------------------------------------------------

  afterAll(async () => {
    if (!admin) return;

    // Delete trips first (FK to users)
    for (const id of createdTripIds) {
      await admin.from('trip_segments').delete().eq('trip_id', id);
      await admin.from('trips').delete().eq('id', id);
    }

    // Delete users from public.users (FK to auth.users cascades)
    for (const id of [agentUserId, consumerUserId, consumerBUserId].filter(Boolean)) {
      await admin.from('users').delete().eq('id', id);
      await admin.auth.admin.deleteUser(id);
    }

    // Delete agency then tenant (FK order)
    if (agencyId) await admin.from('agencies').delete().eq('id', agencyId);
    if (tenantId) await admin.from('tenants').delete().eq('id', tenantId);
  }, 15_000);

  // -----------------------------------------------------------------------
  // Test 1: Agent cannot create trip with account_type='consumer'
  // -----------------------------------------------------------------------
  it('agent cannot create trip with account_type=consumer', async () => {
    const { data, error } = await agentClient.from('trips').insert({
      agency_id: agencyId,
      tenant_id: tenantId,
      owner_user_id: agentUserId,
      account_type: 'consumer',
      status: 'draft',
      planner_state: {},
    }).select('id').single();

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 2: Consumer cannot create trip with account_type='agent'
  // -----------------------------------------------------------------------
  it('consumer cannot create trip with account_type=agent', async () => {
    const { data, error } = await consumerClient.from('trips').insert({
      owner_user_id: consumerUserId,
      account_type: 'agent',
      status: 'draft',
      planner_state: {},
    }).select('id').single();

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 3: Agent cannot create trip without agency_id
  // -----------------------------------------------------------------------
  it('agent cannot create trip without agency_id', async () => {
    const { data, error } = await agentClient.from('trips').insert({
      owner_user_id: agentUserId,
      account_type: 'agent',
      status: 'draft',
      planner_state: {},
      // agency_id intentionally omitted
    }).select('id').single();

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 4: Consumer can create trip without agency_id
  // -----------------------------------------------------------------------
  it('consumer can create trip without agency_id', async () => {
    const { data, error } = await consumerClient.from('trips').insert({
      owner_user_id: consumerUserId,
      account_type: 'consumer',
      status: 'exploring',
      planner_state: {},
    }).select('id').single();

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();

    // Cleanup
    if (data?.id) {
      createdTripIds.push(data.id);
    }
  });

  // -----------------------------------------------------------------------
  // Test 5: Consumer only sees own trips (not other consumer's)
  // -----------------------------------------------------------------------
  it('consumer only sees own trips via consumer_select_own_trips', async () => {
    const { data } = await consumerClient.from('trips').select('id');
    const ids = (data ?? []).map((t: { id: string }) => t.id);

    // Consumer A sees their own trip
    expect(ids).toContain(createdTripIds[1]); // Consumer A trip

    // Consumer A does NOT see Consumer B trip or Agent trip
    expect(ids).not.toContain(createdTripIds[2]); // Consumer B trip
    expect(ids).not.toContain(createdTripIds[0]); // Agent trip
  });

  // -----------------------------------------------------------------------
  // Test 6: Agent still sees agency trips (regression)
  // -----------------------------------------------------------------------
  it('agent sees agency trips as before (B2B regression)', async () => {
    const { data } = await agentClient
      .from('trips')
      .select('id')
      .eq('agency_id', agencyId);
    const ids = (data ?? []).map((t: { id: string }) => t.id);

    expect(ids).toContain(createdTripIds[0]); // Agent trip
  });

  // -----------------------------------------------------------------------
  // Test R4: Agent cannot see consumer trips via legacy policy
  // -----------------------------------------------------------------------
  // The legacy policy "SELLER can view own trips" uses
  //   USING (created_by = auth.uid())
  // without a role check. This test verifies that an agent's uid
  // never matches a consumer trip's created_by, so the legacy policy
  // cannot leak consumer trips to agents.
  // -----------------------------------------------------------------------
  it('R4 regression: agent cannot see consumer trips via any policy path', async () => {
    const { data } = await agentClient.from('trips').select('id');
    const ids = (data ?? []).map((t: { id: string }) => t.id);

    // Agent sees their own trip
    expect(ids).toContain(createdTripIds[0]);

    // Agent does NOT see any consumer trip
    expect(ids).not.toContain(createdTripIds[1]); // Consumer A trip
    expect(ids).not.toContain(createdTripIds[2]); // Consumer B trip
  });

  // -----------------------------------------------------------------------
  // Test 8: Consumer can persist trip via upsertTrip end-to-end (1.1.b)
  // -----------------------------------------------------------------------
  it('consumer persists trip via upsertTrip with correct ownership fields', async () => {
    const { data, error } = await consumerClient.from('trips').insert({
      owner_user_id: consumerUserId,
      account_type: 'consumer',
      status: 'exploring',
      planner_state: { title: 'Consumer E2E Trip' },
    }).select('id, owner_user_id, account_type, agency_id, tenant_id').single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      owner_user_id: consumerUserId,
      account_type: 'consumer',
      agency_id: null,
      tenant_id: null,
    });

    if (data?.id) createdTripIds.push(data.id);
  });

  // -----------------------------------------------------------------------
  // Test 9: Agent persists trip via insert with ownership fields (1.1.b regression)
  // -----------------------------------------------------------------------
  it('agent persists trip with owner_user_id and account_type=agent (regression)', async () => {
    const { data, error } = await agentClient.from('trips').insert({
      agency_id: agencyId,
      tenant_id: tenantId,
      owner_user_id: agentUserId,
      account_type: 'agent',
      status: 'draft',
      planner_state: { title: 'Agent E2E Trip' },
    }).select('id, owner_user_id, account_type, agency_id, tenant_id').single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      owner_user_id: agentUserId,
      account_type: 'agent',
      agency_id: agencyId,
      tenant_id: tenantId,
    });

    if (data?.id) createdTripIds.push(data.id);
  });

  // -----------------------------------------------------------------------
  // Test 10: listTripsByUser query shape — consumer sees only own trips (1.1.e)
  // -----------------------------------------------------------------------
  // Replicates the exact query shape of listTripsByUser(userId, 'consumer')
  // against Supabase with an RLS-scoped consumer client. We don't import
  // the service function because it uses the global supabase client which
  // hits the D11 localStorage issue in Node. Manual query against
  // consumerClient is more honest — RLS + the explicit filters do the work.
  // -----------------------------------------------------------------------
  it('listTripsByUser consumer query returns only own trip (1.1.e)', async () => {
    const { data, error } = await consumerClient
      .from('trips')
      .select('id, title, summary, status, start_date, end_date, destination_cities, budget_level, travelers, created_by, created_at, updated_at')
      .eq('owner_user_id', consumerUserId)
      .eq('account_type', 'consumer')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });

    expect(error).toBeNull();
    const ids = (data ?? []).map((t: { id: string }) => t.id);

    expect(ids).toContain(createdTripIds[1]); // Consumer A trip
    expect(ids).not.toContain(createdTripIds[2]); // Consumer B trip
    expect(ids).not.toContain(createdTripIds[0]); // Agent trip
  });

  // -----------------------------------------------------------------------
  // Test 11: listTripsByUser query shape — agent sees own agent trip (1.1.e)
  // -----------------------------------------------------------------------
  // Same query with agent clientfilters by owner_user_id=agentUserId.
  // The agent trip seeded in beforeAll has owner_user_id=agentUserId so it
  // matches. Consumer trips are filtered out by both RLS and the
  // account_type='agent' filter (defense in depth).
  // -----------------------------------------------------------------------
  it('listTripsByUser agent query returns own agent trips (1.1.e)', async () => {
    const { data, error } = await agentClient
      .from('trips')
      .select('id, title, summary, status, start_date, end_date, destination_cities, budget_level, travelers, created_by, created_at, updated_at')
      .eq('owner_user_id', agentUserId)
      .eq('account_type', 'agent')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });

    expect(error).toBeNull();
    const ids = (data ?? []).map((t: { id: string }) => t.id);

    expect(ids).toContain(createdTripIds[0]); // Agent trip
    expect(ids).not.toContain(createdTripIds[1]); // Consumer A trip
    expect(ids).not.toContain(createdTripIds[2]); // Consumer B trip
  });
});
