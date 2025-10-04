-- Cleanup: Remove temporary and conflicting policies before applying new role hierarchy

-- Drop temporary development policy if exists
DROP POLICY IF EXISTS "temp_dev_policy_all_leads" ON public.leads;

-- Drop old conflicting policies
DROP POLICY IF EXISTS "users can access their leads" ON public.leads;
DROP POLICY IF EXISTS "admins can read leads of their agency" ON public.leads;
DROP POLICY IF EXISTS "admins can write leads of their agency" ON public.leads;
DROP POLICY IF EXISTS "admins can update leads of their agency" ON public.leads;
DROP POLICY IF EXISTS "superadmins can manage leads in tenant" ON public.leads;

-- Also clean up old sellers policies if they exist
DROP POLICY IF EXISTS "sellers can select their assigned leads" ON public.leads;
DROP POLICY IF EXISTS "sellers can update their assigned leads" ON public.leads;
DROP POLICY IF EXISTS "sellers can select conversations of their leads" ON public.conversations;
DROP POLICY IF EXISTS "sellers can select messages of their leads" ON public.messages;
DROP POLICY IF EXISTS "sellers can insert messages in their conversations" ON public.messages;

-- Clean up owner policies if they already exist
DROP POLICY IF EXISTS "owner can select all tenants" ON public.tenants;
DROP POLICY IF EXISTS "owner can manage all tenants" ON public.tenants;
DROP POLICY IF EXISTS "owner can select all agencies" ON public.agencies;
DROP POLICY IF EXISTS "owner can manage all agencies" ON public.agencies;
DROP POLICY IF EXISTS "owner can select all users" ON public.users;
DROP POLICY IF EXISTS "owner can manage all users" ON public.users;
DROP POLICY IF EXISTS "owner can select all conversations" ON public.conversations;
DROP POLICY IF EXISTS "owner can select all messages" ON public.messages;
DROP POLICY IF EXISTS "owner can select all leads" ON public.leads;
