-- ============================================================================
-- FIX: Actualizar función para mostrar tag según rol del creador
-- ============================================================================

-- OWNER crea conversación → Tag: "Owner"
-- SUPERADMIN crea conversación → Tag: Nombre del Tenant
-- ADMIN crea conversación → Tag: Nombre de la Agencia
-- SELLER crea conversación → Tag: Nombre de la Agencia

-- ============================================================================
-- Actualizar función get_conversations_with_agency
-- ============================================================================

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
    -- Lógica para mostrar el tag correcto según el rol del creador:
    -- OWNER: muestra 'Owner'
    -- SUPERADMIN: muestra el tenant (porque no tiene agencia)
    -- ADMIN/SELLER: muestra la agencia
    CASE
      WHEN u.role = 'OWNER' THEN 'Owner'
      WHEN u.role = 'SUPERADMIN' THEN t.name
      ELSE a.name
    END as agency_name,
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

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Probar la función y verificar los tags
SELECT
  id,
  external_key,
  agency_name as tag_mostrado,
  creator_role,
  state
FROM public.get_conversations_with_agency()
ORDER BY created_at DESC;

-- Resultado esperado:
-- OWNER creó → tag: "Owner"
-- SUPERADMIN creó → tag: "Nombre del Tenant"
-- ADMIN creó → tag: "Nombre de la Agencia"
-- SELLER creó → tag: "Nombre de la Agencia"

-- ============================================================================
-- RESUMEN DE TAGS POR ROL
-- ============================================================================

/*
OWNER crea conversación:
  - tenant_id = NULL
  - agency_id = NULL
  - Tag mostrado: "Owner"

SUPERADMIN crea conversación:
  - tenant_id = UUID del tenant
  - agency_id = NULL
  - Tag mostrado: Nombre del Tenant (ej: "Mayorista España")

ADMIN crea conversación:
  - tenant_id = UUID del tenant
  - agency_id = UUID de su agencia
  - Tag mostrado: Nombre de la Agencia (ej: "Travel Dreams Madrid")

SELLER crea conversación:
  - tenant_id = UUID del tenant
  - agency_id = UUID de su agencia
  - Tag mostrado: Nombre de la Agencia (ej: "Travel Dreams Madrid")
*/
