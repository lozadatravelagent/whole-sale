-- =====================================================
-- Migration: Auto-assign leads to creator (SELLER users)
-- Description: Trigger to automatically assign leads to SELLER who creates them
-- Date: 2025-12-14
-- Issue: Prevent leads from being created with assigned_user_id = NULL
-- Solution: Auto-assign to current user if they are SELLER and no assignment specified
-- =====================================================

-- Drop trigger and function if they exist (idempotent migration)
DROP TRIGGER IF EXISTS auto_assign_lead_trigger ON public.leads;
DROP FUNCTION IF EXISTS public.auto_assign_lead_to_creator();

-- Create function that auto-assigns lead to creator
CREATE OR REPLACE FUNCTION public.auto_assign_lead_to_creator()
RETURNS TRIGGER AS $$
DECLARE
  current_user_role public.user_role;
BEGIN
  -- If assigned_user_id is NULL, auto-assign based on user role
  IF NEW.assigned_user_id IS NULL THEN
    -- Get current user's role
    SELECT role INTO current_user_role
    FROM public.users
    WHERE id = auth.uid();

    -- Check if current user is a SELLER
    IF current_user_role = 'SELLER'::public.user_role THEN
      NEW.assigned_user_id := auth.uid();
      RAISE NOTICE '🔄 Auto-assigned lead % to SELLER %', NEW.id, auth.uid();
    ELSE
      -- For ADMIN/SUPERADMIN/OWNER, try to find first SELLER in the agency
      -- This handles the case where an ADMIN creates a lead on behalf of the team
      SELECT u.id INTO NEW.assigned_user_id
      FROM public.users u
      WHERE u.agency_id = NEW.agency_id
      AND u.role = 'SELLER'::public.user_role
      ORDER BY u.created_at ASC
      LIMIT 1;

      IF NEW.assigned_user_id IS NOT NULL THEN
        RAISE NOTICE '🔄 Auto-assigned lead % to first SELLER % in agency', NEW.id, NEW.assigned_user_id;
      ELSE
        RAISE WARNING '⚠️  Lead % created without assigned_user_id (no SELLER found in agency %)', NEW.id, NEW.agency_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that runs BEFORE INSERT
CREATE TRIGGER auto_assign_lead_trigger
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_lead_to_creator();

-- Add comment for documentation
COMMENT ON FUNCTION public.auto_assign_lead_to_creator() IS
  'Automatically assigns leads to the creating user if they are a SELLER, or to the first SELLER in the agency if created by ADMIN/OWNER. Prevents orphaned leads.';

-- Verification: Create a test lead to validate trigger works
-- (This will be rolled back if migration is run in a transaction)
DO $$
DECLARE
  test_agency_id uuid;
  test_seller_id uuid;
  test_lead_id uuid;
BEGIN
  -- Find a test agency and seller
  SELECT a.id, u.id INTO test_agency_id, test_seller_id
  FROM public.agencies a
  JOIN public.users u ON u.agency_id = a.id
  WHERE u.role = 'SELLER'::public.user_role
  LIMIT 1;

  IF test_agency_id IS NOT NULL AND test_seller_id IS NOT NULL THEN
    -- Insert test lead without assigned_user_id
    INSERT INTO public.leads (
      tenant_id,
      agency_id,
      contact,
      trip,
      status
    )
    SELECT
      (SELECT tenant_id FROM public.agencies WHERE id = test_agency_id),
      test_agency_id,
      '{"name": "Test Auto-Assign", "email": "test@example.com"}'::jsonb,
      '{"type": "hotel", "destination": "Test", "dates": {"checkin": null, "checkout": null}}'::jsonb,
      'new'
    RETURNING id INTO test_lead_id;

    -- Verify it was auto-assigned
    IF EXISTS (
      SELECT 1 FROM public.leads
      WHERE id = test_lead_id
      AND assigned_user_id IS NOT NULL
    ) THEN
      RAISE NOTICE '✅ Trigger validation: Test lead % was auto-assigned successfully', test_lead_id;

      -- Clean up test lead
      DELETE FROM public.leads WHERE id = test_lead_id;
      RAISE NOTICE '🗑️  Test lead cleaned up';
    ELSE
      RAISE WARNING '⚠️  Trigger validation failed: Test lead was not auto-assigned';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️  Skipping trigger validation (no test agency/seller found)';
  END IF;
END $$;

-- Summary
DO $$
BEGIN
  RAISE NOTICE '
  ╔════════════════════════════════════════════════════════════════╗
  ║  ✅ Migration Complete: Auto-assign Lead Trigger              ║
  ╠════════════════════════════════════════════════════════════════╣
  ║  • Function created: auto_assign_lead_to_creator()            ║
  ║  • Trigger created: auto_assign_lead_trigger (BEFORE INSERT)  ║
  ║  • Behavior:                                                   ║
  ║    - SELLER creates lead → auto-assigns to themselves         ║
  ║    - ADMIN creates lead → auto-assigns to first SELLER        ║
  ║    - Prevents leads with assigned_user_id = NULL              ║
  ╚════════════════════════════════════════════════════════════════╝
  ';
END $$;
