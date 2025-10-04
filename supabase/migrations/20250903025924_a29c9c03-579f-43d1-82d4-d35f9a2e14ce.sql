-- Temporary development policies to allow chat functionality without full auth
-- We'll replace these with proper auth-based policies later

-- Drop existing restrictive policies for conversations and messages during development
DROP POLICY IF EXISTS "users can access their conversations" ON public.conversations;
DROP POLICY IF EXISTS "admins can read conversations of their agency" ON public.conversations;
DROP POLICY IF EXISTS "admins can write conversations of their agency" ON public.conversations;
DROP POLICY IF EXISTS "admins can update conversations of their agency" ON public.conversations;
DROP POLICY IF EXISTS "superadmins can manage conversations in tenant" ON public.conversations;

DROP POLICY IF EXISTS "users can access messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "admins can read messages of their agency" ON public.messages;
DROP POLICY IF EXISTS "admins can write messages of their agency" ON public.messages;
DROP POLICY IF EXISTS "superadmins can manage messages in tenant" ON public.messages;

-- Create temporary permissive policies for development
DROP POLICY IF EXISTS "temp_dev_policy_all_conversations" ON public.conversations;
CREATE POLICY "temp_dev_policy_all_conversations"
ON public.conversations
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "temp_dev_policy_all_messages" ON public.messages;
CREATE POLICY "temp_dev_policy_all_messages"
ON public.messages
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert basic data for development without foreign key constraints
INSERT INTO public.tenants (id, name, status) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'VBOOK Travel', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agencies (id, tenant_id, name, status, phones, branding) VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Demo Travel Agency', 'active', ARRAY['123-456-7890'], jsonb_build_object(
    'logoUrl', '',
    'primaryColor', '#3b82f6',
    'secondaryColor', '#10b981',
    'contact', jsonb_build_object(
      'name', 'Demo Agency',
      'email', 'demo@agency.com',
      'phone', '123-456-7890'
    )
  ))
ON CONFLICT (id) DO NOTHING;