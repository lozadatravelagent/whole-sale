-- Fix OWNER user access to their own record
-- The existing policies should work, but we're adding an explicit policy for self-access

-- Ensure users table has RLS enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the self-access policy to be more explicit
DROP POLICY IF EXISTS "users can read own data" ON public.users;
CREATE POLICY "users can read own data"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Ensure OWNER policy exists and is correct
DROP POLICY IF EXISTS "owner can read all users" ON public.users;
CREATE POLICY "owner can read all users"
  ON public.users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
  );

-- Add a simplified policy for OWNER to access all users (alternative approach)
DROP POLICY IF EXISTS "owner_full_access" ON public.users;
CREATE POLICY "owner_full_access"
  ON public.users FOR ALL TO authenticated
  USING (
    get_user_role() = 'OWNER'
  );
