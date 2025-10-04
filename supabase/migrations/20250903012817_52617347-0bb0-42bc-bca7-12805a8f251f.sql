-- Crear políticas temporales para desarrollo sin autenticación
-- IMPORTANTE: Estas políticas deben ser removidas cuando se implemente autenticación

-- Desactivar temporalmente las políticas existentes para leads
DROP POLICY IF EXISTS "users can access their leads" ON public.leads;
DROP POLICY IF EXISTS "admins can read leads of their agency" ON public.leads;
DROP POLICY IF EXISTS "admins can write leads of their agency" ON public.leads;
DROP POLICY IF EXISTS "admins can update leads of their agency" ON public.leads;
DROP POLICY IF EXISTS "superadmins can manage leads in tenant" ON public.leads;

-- Crear política temporal permisiva para desarrollo
DROP POLICY IF EXISTS "temp_dev_policy_all_leads" ON public.leads;
CREATE POLICY "temp_dev_policy_all_leads" 
ON public.leads 
FOR ALL 
TO public
USING (true)
WITH CHECK (true);

-- También necesitamos políticas temporales para users si no existen datos
DROP POLICY IF EXISTS "superadmins can manage users in tenant" ON public.users;
DROP POLICY IF EXISTS "user can select self" ON public.users;
DROP POLICY IF EXISTS "superadmins can select users in tenant" ON public.users;
DROP POLICY IF EXISTS "superadmins can insert users" ON public.users;
DROP POLICY IF EXISTS "user can update self" ON public.users;
DROP POLICY IF EXISTS "superadmins can update users in tenant" ON public.users;
DROP POLICY IF EXISTS "superadmins can delete users in tenant" ON public.users;

DROP POLICY IF EXISTS "temp_dev_policy_all_users" ON public.users;
CREATE POLICY "temp_dev_policy_all_users" 
ON public.users 
FOR ALL 
TO public
USING (true)
WITH CHECK (true);

-- Insertar datos de prueba para desarrollo
INSERT INTO public.tenants (id, name, status) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Tenant Demo', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agencies (id, tenant_id, name, phones, branding, status)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Agencia Demo', ARRAY['123456789'], '{}', 'active')
ON CONFLICT (id) DO NOTHING;