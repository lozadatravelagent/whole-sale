-- Enable RLS on users table (if not already enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own data
DROP POLICY IF EXISTS "users can read own data" ON public.users;
CREATE POLICY "users can read own data"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Allow OWNER to see all users
DROP POLICY IF EXISTS "owner can read all users" ON public.users;
CREATE POLICY "owner can read all users"
  ON public.users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
  );

-- Allow SUPERADMIN to see users in their tenant
DROP POLICY IF EXISTS "superadmin can read tenant users" ON public.users;
CREATE POLICY "superadmin can read tenant users"
  ON public.users FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid() AND role = 'SUPERADMIN'::public.user_role
    )
  );

-- Allow ADMIN to see users in their agency
DROP POLICY IF EXISTS "admin can read agency users" ON public.users;
CREATE POLICY "admin can read agency users"
  ON public.users FOR SELECT TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'::public.user_role
    )
  );
