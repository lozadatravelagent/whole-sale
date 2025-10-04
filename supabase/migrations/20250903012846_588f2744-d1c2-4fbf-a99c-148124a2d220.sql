-- Eliminar políticas RLS existentes para desarrollo temporal
DROP POLICY IF EXISTS "temp_dev_policy_all_leads" ON public.leads;

-- Crear política temporal permisiva para desarrollo
DROP POLICY IF EXISTS "temp_dev_policy_all_leads" ON public.leads;
CREATE POLICY "temp_dev_policy_all_leads" 
ON public.leads 
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