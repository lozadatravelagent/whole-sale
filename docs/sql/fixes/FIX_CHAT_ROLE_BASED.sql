-- ============================================================================
-- FIX: Sistema de Chat con Permisos por Rol y Tags de Agencia
-- ============================================================================

-- Este script implementa el modelo de chat basado en roles:
-- - Cada conversación tiene un 'owner' (created_by)
-- - Cada conversación muestra tag con nombre de agencia
-- - Permisos filtrados por rol (OWNER > SUPERADMIN > ADMIN > SELLER)

-- ============================================================================
-- PASO 1: Agregar campo created_by si no existe
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'conversations'
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.conversations
    ADD COLUMN created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

    RAISE NOTICE '✅ Campo created_by agregado a conversations';
  ELSE
    RAISE NOTICE '⚠️ Campo created_by ya existe en conversations';
  END IF;
END $$;

-- ============================================================================
-- PASO 2: LIMPIAR TODO - Empezar de cero
-- ============================================================================

-- ⚠️ Esto borrará TODAS las conversaciones y mensajes existentes
DELETE FROM public.messages; -- Primero los mensajes (por FK)
DELETE FROM public.conversations; -- Luego las conversaciones

DO $$
BEGIN
  RAISE NOTICE '✅ Todas las conversaciones y mensajes han sido eliminados';
  RAISE NOTICE '🆕 Sistema listo para empezar de cero';
END $$;

-- ============================================================================
-- PASO 3: Hacer created_by NOT NULL
-- ============================================================================

ALTER TABLE public.conversations
ALTER COLUMN created_by SET NOT NULL;

-- ============================================================================
-- PASO 4: Crear índice para performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_conversations_created_by
  ON public.conversations(created_by);

CREATE INDEX IF NOT EXISTS idx_conversations_agency_id
  ON public.conversations(agency_id);

-- ============================================================================
-- PASO 5: Actualizar Políticas RLS de Conversations
-- ============================================================================

-- DROP existing policies
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete_policy" ON public.conversations;

-- SELECT: Cada rol ve según su nivel
CREATE POLICY "conversations_select_policy"
  ON public.conversations FOR SELECT TO authenticated
USING (
  public.is_owner() -- OWNER ve todo
  OR (
    -- SUPERADMIN ve conversaciones de su TENANT (todas las agencias)
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()
  )
  OR (
    -- ADMIN ve conversaciones de su AGENCIA
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
  )
  OR (
    -- SELLER ve solo SUS conversaciones
    public.get_user_role() = 'SELLER'
    AND created_by = auth.uid()
  )
);

-- INSERT: Cada rol crea según su nivel
CREATE POLICY "conversations_insert_policy"
  ON public.conversations FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() -- Debe ser el creador
  AND (
    public.is_owner() -- OWNER crea en cualquier lugar
    OR (
      -- SUPERADMIN crea en su tenant
      public.get_user_role() = 'SUPERADMIN'
      AND tenant_id = public.get_user_tenant_id()
    )
    OR (
      -- ADMIN crea en su agencia
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
    )
    OR (
      -- SELLER crea asignadas a sí mismo
      public.get_user_role() = 'SELLER'
      AND agency_id = public.get_user_agency_id()
      AND created_by = auth.uid()
    )
  )
);

-- UPDATE: Solo el creador o superiores pueden actualizar
CREATE POLICY "conversations_update_policy"
  ON public.conversations FOR UPDATE TO authenticated
USING (
  public.is_owner()
  OR created_by = auth.uid()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()
  )
  OR (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
  )
)
WITH CHECK (
  public.is_owner()
  OR created_by = auth.uid()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()
  )
  OR (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
  )
);

-- DELETE: Solo OWNER o el creador
CREATE POLICY "conversations_delete_policy"
  ON public.conversations FOR DELETE TO authenticated
USING (
  public.is_owner()
  OR created_by = auth.uid()
);

-- ============================================================================
-- PASO 6: Crear vista enriquecida con datos de agencia
-- ============================================================================

CREATE OR REPLACE VIEW public.conversations_with_agency AS
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
LEFT JOIN public.users u ON c.created_by = u.id;

-- Grant access to the view
GRANT SELECT ON public.conversations_with_agency TO authenticated;

-- ============================================================================
-- PASO 7: Verificar que no hay conversaciones
-- ============================================================================

SELECT COUNT(*) as total_conversations FROM public.conversations;
SELECT COUNT(*) as total_messages FROM public.messages;

-- Deberían devolver 0 si la limpieza fue exitosa

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- 1. Ver estructura de conversations
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversations'
ORDER BY ordinal_position;

-- 2. Ver políticas activas
SELECT
  polname as policy_name,
  polcmd as command,
  pg_get_expr(polqual, polrelid) as using_expression
FROM pg_policy
WHERE polrelid = 'public.conversations'::regclass
ORDER BY polname;

-- 3. Ver conversaciones con agencia (usando la vista)
SELECT
  id,
  external_key,
  agency_name,
  tenant_name,
  creator_email,
  state,
  created_at
FROM public.conversations_with_agency
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- MODELO FINAL DE PERMISOS
-- ============================================================================

/*
OWNER:
  - Ve: TODAS las conversaciones
  - Crea: En cualquier tenant/agencia
  - Actualiza: Cualquier conversación
  - Elimina: Cualquier conversación

SUPERADMIN:
  - Ve: Conversaciones de su TENANT (todas las agencias)
  - Crea: En su tenant (cualquier agencia)
  - Actualiza: Conversaciones de su tenant
  - Elimina: NO

ADMIN:
  - Ve: Conversaciones de su AGENCIA
  - Crea: En su agencia
  - Actualiza: Conversaciones de su agencia
  - Elimina: NO

SELLER:
  - Ve: Solo SUS conversaciones (created_by = él)
  - Crea: Conversaciones asignadas a él
  - Actualiza: Solo sus conversaciones
  - Elimina: Solo sus conversaciones
*/

-- ============================================================================
-- TAG DE AGENCIA EN UI
-- ============================================================================

/*
En el frontend, usar la vista conversations_with_agency:

const { data: conversations } = await supabase
  .from('conversations_with_agency')
  .select('*')
  .order('last_message_at', { ascending: false });

Mostrar tag:
<Badge variant="outline">
  {conversation.agency_name || 'Sin agencia'}
</Badge>
*/
