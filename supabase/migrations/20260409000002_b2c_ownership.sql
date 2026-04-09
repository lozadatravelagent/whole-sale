-- ============================================================
-- Phase 1.1.a (Migration B): B2C Ownership
-- Date: 2026-04-09
-- Depends on: 20260409000001_add_consumer_role_value.sql
--
-- TRANSACTIONAL: This entire migration runs within a single
-- PostgreSQL transaction. Every operation is atomic — if any
-- step fails, everything rolls back automatically.
-- No statement in this file breaks transactional atomicity.
-- (The ALTER TYPE ADD VALUE for CONSUMER lives in Migration A.)
--
-- The DROP POLICY + CREATE POLICY pair in Section 11 executes
-- within the same transaction, so there is no window where the
-- policy does not exist.
-- ============================================================


-- ============================================================
-- SECTION 0: Sentinel system user
-- ============================================================
-- A well-known UUID used as FK target for owner_user_id backfill
-- on trips where created_by IS NULL.
-- Cannot authenticate: empty password, internal-only email.
--
-- Rollback:
--   DELETE FROM public.users WHERE id = '00000000-0000-0000-0000-000000000000';
--   DELETE FROM auth.users  WHERE id = '00000000-0000-0000-0000-000000000000';
-- ============================================================

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'system@wholesale.internal', '',
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"],"user_role":"OWNER","account_type":"agent"}'::jsonb,
  '{"name":"System"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Note: inserted BEFORE account_type column exists.
-- The DEFAULT 'agent' from Section 1 will backfill automatically.
INSERT INTO public.users (id, email, name, role, provider)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system@wholesale.internal',
  'System',
  'OWNER',
  'email'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 1: Add account_type to public.users
-- ============================================================
-- PG 11+ applies the DEFAULT to all existing rows without
-- rewriting the table (for non-volatile defaults). All existing
-- users become 'agent' with zero backfill needed.
--
-- Rollback:
--   ALTER TABLE public.users DROP COLUMN IF EXISTS account_type;
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'agent';


-- ============================================================
-- SECTION 2: CHECK constraints on public.users
-- ============================================================
-- 2a: Valid account_type values
-- 2b: Agent/consumer XOR linked to role enum
--
-- Rollback:
--   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_type_check;
--   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_type_role_check;
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_account_type_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_account_type_check
      CHECK (account_type IN ('agent', 'consumer'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_account_type_role_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_account_type_role_check CHECK (
      (account_type = 'agent'    AND role IN ('OWNER', 'SUPERADMIN', 'ADMIN', 'SELLER'))
      OR
      (account_type = 'consumer' AND role = 'CONSUMER')
    );
  END IF;
END $$;


-- ============================================================
-- SECTION 3: Add owner_user_id to trips
-- ============================================================
-- Nullable during this step; becomes NOT NULL after backfill (S4.1).
--
-- Rollback:
--   ALTER TABLE trips DROP COLUMN IF EXISTS owner_user_id;
-- ============================================================

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS owner_user_id UUID
    REFERENCES users(id) ON DELETE SET NULL;


-- ============================================================
-- SECTION 4: Backfill owner_user_id
-- ============================================================
-- COALESCE chain: created_by -> last_edited_by -> sentinel.
-- Idempotent: only touches rows where owner_user_id IS NULL.
--
-- Rollback (data loss):
--   UPDATE trips SET owner_user_id = NULL;
-- ============================================================

UPDATE trips
SET owner_user_id = COALESCE(
  created_by,
  last_edited_by,
  '00000000-0000-0000-0000-000000000000'
)
WHERE owner_user_id IS NULL;


-- ============================================================
-- SECTION 4.1: Enforce owner_user_id NOT NULL
-- ============================================================
-- Every trip must have an owner. Runs AFTER the backfill
-- guarantees no NULLs remain. If a future use case needs
-- pre-owner trips, it will be addressed in a new migration.
--
-- Rollback:
--   ALTER TABLE trips ALTER COLUMN owner_user_id DROP NOT NULL;
-- ============================================================

ALTER TABLE trips ALTER COLUMN owner_user_id SET NOT NULL;


-- ============================================================
-- SECTION 5: Add account_type to trips
-- ============================================================
-- DEFAULT 'agent' auto-backfills all existing trips.
--
-- Rollback:
--   ALTER TABLE trips DROP COLUMN IF EXISTS account_type;
-- ============================================================

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'agent';


-- ============================================================
-- SECTION 6: CHECK on trips.account_type
-- ============================================================
-- Rollback:
--   ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_account_type_check;
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'trips'::regclass
      AND conname = 'trips_account_type_check'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_account_type_check
      CHECK (account_type IN ('agent', 'consumer'));
  END IF;
END $$;


-- ============================================================
-- SECTION 7: Expand trips.status CHECK
-- ============================================================
-- Adds 'exploring' and 'shared' for B2C flows.
-- The inline CHECK from CREATE TABLE is auto-named trips_status_check.
-- Dynamic lookup for safety.
--
-- Rollback:
--   ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;
--   ALTER TABLE trips ADD CONSTRAINT trips_status_check
--     CHECK (status IN ('draft','ready','quoted','confirmed','archived'));
-- ============================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'trips'::regclass
      AND conname = 'trips_status_check'
  ) THEN
    ALTER TABLE trips DROP CONSTRAINT trips_status_check;
  END IF;
END $$;

ALTER TABLE trips ADD CONSTRAINT trips_status_check
  CHECK (status IN (
    'draft', 'ready', 'quoted', 'confirmed', 'archived',
    'exploring', 'shared'
  ));


-- ============================================================
-- SECTION 8: Change FK cascade on trips (CASCADE -> SET NULL)
-- ============================================================
-- Makes agency_id/tenant_id nullable for consumer trips.
-- Uses dynamic FK name lookup (safety against auto-naming).
--
-- Note: CHECK (account_type='agent' -> agency_id NOT NULL) is
-- intentionally omitted because ON DELETE SET NULL could make
-- agency_id NULL for agent trips when an agency is deleted.
-- The "agent cannot create trip without agency_id" invariant is
-- enforced via the RLS INSERT policy (Section 11), not a CHECK.
--
-- Rollback:
--   ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_agency_id_fkey;
--   ALTER TABLE trips ADD CONSTRAINT trips_agency_id_fkey
--     FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
--   ALTER TABLE trips ALTER COLUMN agency_id SET NOT NULL;
--   ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_tenant_id_fkey;
--   ALTER TABLE trips ADD CONSTRAINT trips_tenant_id_fkey
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
--   ALTER TABLE trips ALTER COLUMN tenant_id SET NOT NULL;
-- ============================================================

ALTER TABLE trips ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE trips ALTER COLUMN tenant_id DROP NOT NULL;

-- agency_id FK
DO $$
DECLARE fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'trips'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'agency_id';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE trips DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE trips ADD CONSTRAINT trips_agency_id_fkey
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;

-- tenant_id FK
DO $$
DECLARE fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'trips'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE trips DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE trips ADD CONSTRAINT trips_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;


-- ============================================================
-- SECTION 9: Indexes for new columns
-- ============================================================
-- Rollback:
--   DROP INDEX IF EXISTS idx_trips_owner_user_id;
--   DROP INDEX IF EXISTS idx_trips_account_type;
--   DROP INDEX IF EXISTS idx_users_account_type;
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_trips_owner_user_id ON trips(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_trips_account_type  ON trips(account_type);
CREATE INDEX IF NOT EXISTS idx_users_account_type  ON public.users(account_type);


-- ============================================================
-- SECTION 10: Consumer RLS policies on trips
-- ============================================================
-- Naming convention: consumer_ prefix (per decision).
-- No DELETE policy for consumers (not a consumer action).
--
-- Rollback:
--   DROP POLICY IF EXISTS "consumer_select_own_trips" ON trips;
--   DROP POLICY IF EXISTS "consumer_insert_own_trips" ON trips;
--   DROP POLICY IF EXISTS "consumer_update_own_trips" ON trips;
-- ============================================================

CREATE POLICY "consumer_select_own_trips"
  ON trips FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'CONSUMER'
    AND owner_user_id = auth.uid()
  );

CREATE POLICY "consumer_insert_own_trips"
  ON trips FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'CONSUMER'
    AND owner_user_id = auth.uid()
    AND account_type = 'consumer'
  );

CREATE POLICY "consumer_update_own_trips"
  ON trips FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'CONSUMER'
    AND owner_user_id = auth.uid()
  )
  WITH CHECK (
    public.get_user_role() = 'CONSUMER'
    AND owner_user_id = auth.uid()
  );


-- ============================================================
-- SECTION 11: Reinforce agent INSERT policy
-- ============================================================
-- Adds account_type = 'agent' to prevent an agent from creating
-- a consumer trip. No functional change for existing B2B flow:
-- account_type defaults to 'agent', and existing code never
-- sends account_type explicitly.
--
-- The policy name is preserved exactly.
-- DROP + CREATE within the same transaction is atomic — there is
-- no window where the policy does not exist.
--
-- Rollback:
--   DROP POLICY IF EXISTS "Users can create trips in their agency" ON trips;
--   CREATE POLICY "Users can create trips in their agency"
--     ON trips FOR INSERT TO authenticated
--     WITH CHECK (
--       EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()
--               AND users.agency_id = trips.agency_id)
--     );
-- ============================================================

DROP POLICY IF EXISTS "Users can create trips in their agency" ON trips;
CREATE POLICY "Users can create trips in their agency"
  ON trips FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.agency_id = trips.agency_id
    )
    AND trips.account_type = 'agent'
  );


-- ============================================================
-- SECTION 12: Update JWT trigger to include account_type
-- ============================================================
-- Rollback:
--   CREATE OR REPLACE FUNCTION public.handle_user_metadata_update()
--   RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
--   BEGIN
--     UPDATE auth.users SET raw_app_meta_data = jsonb_build_object(
--       'user_role', NEW.role::text,
--       'agency_id', NEW.agency_id::text,
--       'tenant_id', NEW.tenant_id::text
--     ) WHERE id = NEW.id;
--     RETURN NEW;
--   END; $$;
--   DROP TRIGGER IF EXISTS update_user_metadata_trigger ON public.users;
--   CREATE TRIGGER update_user_metadata_trigger
--     AFTER INSERT OR UPDATE OF role, agency_id, tenant_id ON public.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_user_metadata_update();
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_user_metadata_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_build_object(
    'user_role', NEW.role::text,
    'agency_id', NEW.agency_id::text,
    'tenant_id', NEW.tenant_id::text,
    'account_type', NEW.account_type
  )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_metadata_trigger ON public.users;
CREATE TRIGGER update_user_metadata_trigger
  AFTER INSERT OR UPDATE OF role, agency_id, tenant_id, account_type
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_metadata_update();


-- ============================================================
-- SECTION 13: Backfill JWT claims (include account_type)
-- ============================================================
-- Re-syncs all users' JWT claims to include the new field.
-- Idempotent: re-executing overwrites with identical values.
--
-- Rollback: re-run original trigger function without account_type
--           (see Section 12 rollback).
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, role, agency_id, tenant_id, account_type FROM public.users LOOP
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_build_object(
      'user_role', r.role::text,
      'agency_id', r.agency_id::text,
      'tenant_id', r.tenant_id::text,
      'account_type', r.account_type
    )
    WHERE id = r.id;
  END LOOP;
END $$;


-- ============================================================
-- SECTION 14: Helper function get_user_account_type()
-- ============================================================
-- Reads from JWT claims first, falls back to users table.
-- Follows the same pattern as get_user_role(), get_user_agency_id().
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_user_account_type();
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_account_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'account_type',
    (SELECT account_type FROM public.users WHERE id = auth.uid())
  );
$$;


-- ============================================================
-- SECTION 15: Backfill verification assertions
-- ============================================================
-- Run within the transaction. If any assertion fails, the entire
-- migration rolls back.
-- ============================================================

DO $$ BEGIN
  -- Test 7: No agent trip should have NULL agency_id
  IF EXISTS (
    SELECT 1 FROM trips
    WHERE account_type = 'agent' AND agency_id IS NULL
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found agent trips with NULL agency_id';
  END IF;

  -- Test 8: No trip should have NULL owner_user_id
  -- (Redundant with the NOT NULL constraint from S4.1, but explicit.)
  IF EXISTS (
    SELECT 1 FROM trips WHERE owner_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Found trips with NULL owner_user_id';
  END IF;

  -- Sentinel user must exist
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = '00000000-0000-0000-0000-000000000000'
  ) THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Sentinel user not found';
  END IF;
END $$;


-- ============================================================
-- FULL ROLLBACK PLAN (execute sections in reverse order)
-- ============================================================
--
-- -- S14: DROP FUNCTION IF EXISTS public.get_user_account_type();
--
-- -- S13: (re-backfill after S12 rollback to remove account_type from JWT)
--
-- -- S12: Restore original JWT trigger (without account_type)
-- CREATE OR REPLACE FUNCTION public.handle_user_metadata_update()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   UPDATE auth.users SET raw_app_meta_data = jsonb_build_object(
--     'user_role', NEW.role::text,
--     'agency_id', NEW.agency_id::text,
--     'tenant_id', NEW.tenant_id::text
--   ) WHERE id = NEW.id;
--   RETURN NEW;
-- END; $$;
-- DROP TRIGGER IF EXISTS update_user_metadata_trigger ON public.users;
-- CREATE TRIGGER update_user_metadata_trigger
--   AFTER INSERT OR UPDATE OF role, agency_id, tenant_id ON public.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_user_metadata_update();
--
-- -- S11: Restore original INSERT policy (without account_type check)
-- DROP POLICY IF EXISTS "Users can create trips in their agency" ON trips;
-- CREATE POLICY "Users can create trips in their agency"
--   ON trips FOR INSERT TO authenticated
--   WITH CHECK (
--     EXISTS (SELECT 1 FROM users
--             WHERE users.id = auth.uid()
--               AND users.agency_id = trips.agency_id)
--   );
--
-- -- S10:
-- DROP POLICY IF EXISTS "consumer_select_own_trips" ON trips;
-- DROP POLICY IF EXISTS "consumer_insert_own_trips" ON trips;
-- DROP POLICY IF EXISTS "consumer_update_own_trips" ON trips;
--
-- -- S9:
-- DROP INDEX IF EXISTS idx_trips_owner_user_id;
-- DROP INDEX IF EXISTS idx_trips_account_type;
-- DROP INDEX IF EXISTS idx_users_account_type;
--
-- -- S8: Restore CASCADE FKs + NOT NULL
-- ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_agency_id_fkey;
-- ALTER TABLE trips ADD CONSTRAINT trips_agency_id_fkey
--   FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
-- ALTER TABLE trips ALTER COLUMN agency_id SET NOT NULL;
-- ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_tenant_id_fkey;
-- ALTER TABLE trips ADD CONSTRAINT trips_tenant_id_fkey
--   FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- ALTER TABLE trips ALTER COLUMN tenant_id SET NOT NULL;
--
-- -- S7: Restore original status CHECK
-- ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;
-- ALTER TABLE trips ADD CONSTRAINT trips_status_check
--   CHECK (status IN ('draft','ready','quoted','confirmed','archived'));
--
-- -- S6:
-- ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_account_type_check;
--
-- -- S5:
-- ALTER TABLE trips DROP COLUMN IF EXISTS account_type;
--
-- -- S4.1:
-- ALTER TABLE trips ALTER COLUMN owner_user_id DROP NOT NULL;
--
-- -- S4: (data loss if reversed)
-- UPDATE trips SET owner_user_id = NULL;
--
-- -- S3:
-- ALTER TABLE trips DROP COLUMN IF EXISTS owner_user_id;
--
-- -- S2:
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_type_role_check;
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_type_check;
--
-- -- S1:
-- ALTER TABLE public.users DROP COLUMN IF EXISTS account_type;
--
-- -- S0:
-- DELETE FROM public.users WHERE id = '00000000-0000-0000-0000-000000000000';
-- DELETE FROM auth.users  WHERE id = '00000000-0000-0000-0000-000000000000';
--
-- -- Migration A: CONSUMER in user_role enum CANNOT be removed.
-- --              It remains as an inert, unreferenced label (harmless).
-- ============================================================
