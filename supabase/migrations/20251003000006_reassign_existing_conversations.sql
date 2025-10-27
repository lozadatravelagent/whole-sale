-- ============================================================
-- REASSIGN EXISTING CONVERSATIONS TO OWNER'S AGENCY
-- Migrate conversations created with mock agency_id to real agency
-- ============================================================

-- Get the agency_id and tenant_id from the OWNER user (lozadatravelagent@gmail.com)
DO $$
DECLARE
  owner_agency_id uuid;
  owner_tenant_id uuid;
  mock_agency_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Find OWNER's agency and tenant
  SELECT agency_id, tenant_id INTO owner_agency_id, owner_tenant_id
  FROM public.users
  WHERE email = 'lozadatravelagent@gmail.com'
  AND role = 'OWNER'::public.user_role
  LIMIT 1;

  IF owner_agency_id IS NULL THEN
    RAISE NOTICE 'OWNER user not found or has no agency assigned';
    RETURN;
  END IF;

  RAISE NOTICE 'Found OWNER agency_id: %, tenant_id: %', owner_agency_id, owner_tenant_id;

  -- Update conversations with mock agency_id to OWNER's agency
  UPDATE public.conversations
  SET
    agency_id = owner_agency_id,
    tenant_id = owner_tenant_id
  WHERE agency_id = mock_agency_id;

  RAISE NOTICE 'Updated % conversations to OWNER agency', (
    SELECT COUNT(*)
    FROM public.conversations
    WHERE agency_id = owner_agency_id
  );

  -- Also update any conversations with NULL agency_id (orphaned conversations)
  UPDATE public.conversations
  SET
    agency_id = owner_agency_id,
    tenant_id = owner_tenant_id
  WHERE agency_id IS NULL;

  RAISE NOTICE 'Updated % orphaned conversations (NULL agency_id)', (
    SELECT COUNT(*)
    FROM public.conversations
    WHERE agency_id = owner_agency_id
  );

  -- Update leads with mock agency to OWNER's agency (if any exist)
  UPDATE public.leads
  SET
    agency_id = owner_agency_id,
    tenant_id = owner_tenant_id
  WHERE agency_id = mock_agency_id;

  RAISE NOTICE 'Updated % leads to OWNER agency', (
    SELECT COUNT(*)
    FROM public.leads
    WHERE agency_id = owner_agency_id
  );

  -- Update orphaned leads
  UPDATE public.leads
  SET
    agency_id = owner_agency_id,
    tenant_id = owner_tenant_id
  WHERE agency_id IS NULL AND tenant_id IS NULL;

  RAISE NOTICE 'Migration completed successfully';
END $$;

-- Verify the migration results
DO $$
BEGIN
  RAISE NOTICE '=== MIGRATION VERIFICATION ===';
  RAISE NOTICE 'Total conversations: %', (SELECT COUNT(*) FROM public.conversations);
  RAISE NOTICE 'Conversations by agency:';

  FOR rec IN
    SELECT
      c.agency_id,
      a.name as agency_name,
      COUNT(*) as conversation_count
    FROM public.conversations c
    LEFT JOIN public.agencies a ON c.agency_id = a.id
    GROUP BY c.agency_id, a.name
  LOOP
    RAISE NOTICE '  Agency: % (%) - % conversations', rec.agency_name, rec.agency_id, rec.conversation_count;
  END LOOP;
END $$;
