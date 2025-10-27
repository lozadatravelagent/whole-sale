-- ============================================================
-- FIX: Assign agency@agency.com (ADMIN) and seller@seller.com (SELLER) to real agency
-- agency@agency.com is the agency admin, seller@seller.com works for that agency
-- ============================================================

DO $$
DECLARE
  agency_user_id uuid := 'a3ac5323-7f05-4bcc-a300-9a132813d5b2'; -- agency@agency.com (ADMIN)
  seller_user_id uuid;
  real_agency_id uuid;
  real_tenant_id uuid;
  mock_agency_id_1 uuid := '00000000-0000-0000-0000-000000000001';
  mock_agency_id_2 uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- Get seller user
  SELECT id INTO seller_user_id
  FROM public.users
  WHERE email = 'seller@seller.com';

  IF seller_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Seller user (seller@seller.com) not found';
  END IF;

  RAISE NOTICE '✅ Found ADMIN user (agency@agency.com): %', agency_user_id;
  RAISE NOTICE '✅ Found SELLER user (seller@seller.com): %', seller_user_id;

  -- Try to find a real agency (not mock)
  SELECT id, tenant_id INTO real_agency_id, real_tenant_id
  FROM public.agencies
  WHERE id NOT IN (mock_agency_id_1, mock_agency_id_2)
  AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no real agency exists, create one
  IF real_agency_id IS NULL THEN
    RAISE NOTICE '⚠️  No real agencies found. Creating agency for agency@agency.com...';

    -- First, ensure we have a tenant
    SELECT id INTO real_tenant_id
    FROM public.tenants
    WHERE status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;

    IF real_tenant_id IS NULL THEN
      RAISE NOTICE '⚠️  No tenants found. Creating default tenant...';
      INSERT INTO public.tenants (name, status)
      VALUES ('Main Tenant', 'active')
      RETURNING id INTO real_tenant_id;
      RAISE NOTICE '✅ Created tenant: %', real_tenant_id;
    END IF;

    -- Create the agency
    INSERT INTO public.agencies (
      tenant_id,
      name,
      status,
      branding,
      phones
    ) VALUES (
      real_tenant_id,
      'Agency Team',
      'active',
      jsonb_build_object(
        'primaryColor', '#3b82f6',
        'secondaryColor', '#8b5cf6',
        'contact', jsonb_build_object(
          'name', 'Agency Team',
          'email', 'agency@agency.com',
          'phone', '+1234567890'
        )
      ),
      ARRAY['+1234567890']
    )
    RETURNING id INTO real_agency_id;

    RAISE NOTICE '✅ Created agency: %', real_agency_id;
  END IF;

  RAISE NOTICE '✅ Using agency_id: %, tenant_id: %', real_agency_id, real_tenant_id;

  -- Assign agency@agency.com (ADMIN) to the agency
  UPDATE public.users
  SET
    agency_id = real_agency_id,
    tenant_id = real_tenant_id
  WHERE id = agency_user_id;

  RAISE NOTICE '✅ Assigned agency@agency.com (ADMIN) to agency';

  -- Assign seller@seller.com (SELLER) to the same agency
  UPDATE public.users
  SET
    agency_id = real_agency_id,
    tenant_id = real_tenant_id
  WHERE id = seller_user_id;

  RAISE NOTICE '✅ Assigned seller@seller.com (SELLER) to same agency';

  -- Update all conversations with mock agencies to use real agency
  UPDATE public.conversations
  SET
    agency_id = real_agency_id,
    tenant_id = real_tenant_id
  WHERE agency_id IN (mock_agency_id_1, mock_agency_id_2);

  RAISE NOTICE '✅ Updated % conversations to real agency', (
    SELECT COUNT(*) FROM public.conversations WHERE agency_id = real_agency_id
  );

  -- Update all leads with mock agencies to use real agency
  UPDATE public.leads
  SET
    agency_id = real_agency_id,
    tenant_id = real_tenant_id
  WHERE agency_id IN (mock_agency_id_1, mock_agency_id_2);

  RAISE NOTICE '✅ Updated % leads to real agency', (
    SELECT COUNT(*) FROM public.leads WHERE agency_id = real_agency_id
  );

  -- Summary
  RAISE NOTICE '==========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETED';
  RAISE NOTICE 'Agency ADMIN (agency@agency.com): %', agency_user_id;
  RAISE NOTICE 'Agency SELLER (seller@seller.com): %', seller_user_id;
  RAISE NOTICE 'Shared agency_id: %', real_agency_id;
  RAISE NOTICE 'Shared tenant_id: %', real_tenant_id;
  RAISE NOTICE '==========================================';

END $$;

-- Verify the assignment
SELECT
  u.email,
  u.role,
  u.agency_id,
  u.tenant_id,
  a.name as agency_name,
  t.name as tenant_name
FROM public.users u
LEFT JOIN public.agencies a ON u.agency_id = a.id
LEFT JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.email IN ('seller@seller.com', 'agency@agency.com')
ORDER BY u.role DESC, u.email;
