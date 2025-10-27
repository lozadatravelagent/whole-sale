-- ============================================================================
-- FIX: Políticas RLS para la vista conversations_with_agency
-- ============================================================================

-- PROBLEMA: Las vistas NO heredan automáticamente las políticas RLS de las tablas base
-- SOLUCIÓN: Aplicar RLS directamente en la vista O usar una función security definer

-- ============================================================================
-- OPCIÓN 1: Eliminar la vista y usar query directa con JOIN (RECOMENDADO)
-- ============================================================================

-- Esta opción es más simple: el frontend hace el JOIN directamente
-- Las políticas RLS de la tabla conversations se aplican automáticamente

-- No necesitamos cambiar SQL, solo actualizar el frontend para usar:
/*
SELECT
  c.*,
  a.name as agency_name,
  t.name as tenant_name,
  u.email as creator_email,
  u.role as creator_role
FROM conversations c
LEFT JOIN agencies a ON c.agency_id = a.id
LEFT JOIN tenants t ON c.tenant_id = t.id
LEFT JOIN users u ON c.created_by = u.id
ORDER BY c.last_message_at DESC
*/

-- ============================================================================
-- OPCIÓN 2: Crear función SECURITY DEFINER (alternativa si queremos mantener la vista)
-- ============================================================================

-- Primero, eliminar la vista existente
DROP VIEW IF EXISTS public.conversations_with_agency;

-- Crear función que retorna conversaciones enriquecidas con RLS aplicado
CREATE OR REPLACE FUNCTION public.get_conversations_with_agency()
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  agency_id uuid,
  channel public.conversation_channel,
  external_key text,
  phone_number_id text,
  state public.conversation_state,
  last_message_at timestamptz,
  created_at timestamptz,
  created_by uuid,
  agency_name text,
  tenant_name text,
  creator_email text,
  creator_role public.user_role
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Esta función ejecuta con permisos elevados pero aplica RLS manualmente
  RETURN QUERY
  SELECT
    c.id,
    c.tenant_id,
    c.agency_id,
    c.channel,
    c.external_key,
    c.phone_number_id,
    c.state,
    c.last_message_at,
    c.created_at,
    c.created_by,
    a.name as agency_name,
    t.name as tenant_name,
    u.email as creator_email,
    u.role as creator_role
  FROM public.conversations c
  LEFT JOIN public.agencies a ON c.agency_id = a.id
  LEFT JOIN public.tenants t ON c.tenant_id = t.id
  LEFT JOIN public.users u ON c.created_by = u.id
  WHERE (
    -- Aplicar las MISMAS reglas RLS que en conversations_select_policy
    public.is_owner() -- OWNER ve todo
    OR (
      -- SUPERADMIN ve conversaciones de su TENANT
      public.get_user_role() = 'SUPERADMIN'
      AND c.tenant_id = public.get_user_tenant_id()
    )
    OR (
      -- ADMIN ve conversaciones de su AGENCIA
      public.get_user_role() = 'ADMIN'
      AND c.agency_id = public.get_user_agency_id()
    )
    OR (
      -- SELLER ve solo SUS conversaciones
      public.get_user_role() = 'SELLER'
      AND c.created_by = auth.uid()
    )
  );
END;
$$;

-- Grant execute a authenticated users
GRANT EXECUTE ON FUNCTION public.get_conversations_with_agency() TO authenticated;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- 1. Probar la función como SELLER
-- (Ejecutar logeado como SELLER)
SELECT * FROM public.get_conversations_with_agency();

-- Debería mostrar SOLO las conversaciones creadas por ese SELLER

-- 2. Probar como ADMIN
-- (Ejecutar logeado como ADMIN)
SELECT * FROM public.get_conversations_with_agency();

-- Debería mostrar SOLO las conversaciones de su agencia

-- 3. Probar como SUPERADMIN
-- (Ejecutar logeado como SUPERADMIN)
SELECT * FROM public.get_conversations_with_agency();

-- Debería mostrar TODAS las conversaciones de su tenant

-- 4. Probar como OWNER
-- (Ejecutar logeado como OWNER)
SELECT * FROM public.get_conversations_with_agency();

-- Debería mostrar TODAS las conversaciones del sistema

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

/*
DESPUÉS DE EJECUTAR ESTE SCRIPT:

1. Actualizar el frontend (useChat.ts) para usar la función:

   const { data, error } = await supabase
     .rpc('get_conversations_with_agency')
     .order('last_message_at', { ascending: false });

2. La función aplica las MISMAS reglas RLS que la tabla conversations

3. Cada rol verá SOLO lo que le corresponde:
   - OWNER: TODO
   - SUPERADMIN: Su tenant
   - ADMIN: Su agencia
   - SELLER: Solo sus conversaciones (created_by = él)
*/
