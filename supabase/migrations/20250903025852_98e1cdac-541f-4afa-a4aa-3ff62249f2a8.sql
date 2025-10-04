-- Insert basic tenant and agency data for development
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

-- Create a basic user for development
-- NOTE: Users must first exist in auth.users before being added to public.users
-- This insert is commented out as it requires auth.users entry first
-- You need to create the user through Supabase Auth first, then add them to public.users
/*
INSERT INTO public.users (id, tenant_id, agency_id, email, role, provider) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'demo@vbook.com', 'ADMIN', 'email')
ON CONFLICT (id) DO NOTHING;
*/