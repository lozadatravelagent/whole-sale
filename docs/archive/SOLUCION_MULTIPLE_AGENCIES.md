# 🔧 Solución: SUPERADMIN con Múltiples Agencias

## 🎯 Problema Real Identificado

**`superadmin@superadmin.com` tiene `agency_id = NULL`** porque el diseño es que un SUPERADMIN pueda gestionar **múltiples agencias** mediante la tabla `superadmin_agency_assignments`.

**PERO** esa tabla NO existe en Supabase (migración no aplicada).

---

## 📊 Dos Soluciones Posibles

### ✅ Opción A: Aplicar Migración Completa (MÚLTIPLES AGENCIAS) - RECOMENDADO

**Ventajas:**
- SUPERADMIN puede gestionar múltiples agencias ✅
- Arquitectura escalable ✅
- Usa el modelo diseñado ✅

**Pasos:**

#### 1. Crear la tabla de asignaciones

```sql
-- Crear tabla para asignaciones múltiples
CREATE TABLE IF NOT EXISTS public.superadmin_agency_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  UNIQUE(superadmin_id, agency_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_superadmin_assignments_superadmin
  ON public.superadmin_agency_assignments(superadmin_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_assignments_agency
  ON public.superadmin_agency_assignments(agency_id);

-- Habilitar RLS
ALTER TABLE public.superadmin_agency_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "owner_can_view_all_assignments"
  ON public.superadmin_agency_assignments FOR SELECT
  TO authenticated
  USING (public.is_owner());

CREATE POLICY "superadmin_can_view_own_assignments"
  ON public.superadmin_agency_assignments FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'SUPERADMIN'
    AND superadmin_id = auth.uid()
  );

CREATE POLICY "owner_can_manage_assignments"
  ON public.superadmin_agency_assignments FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());
```

#### 2. Crear función helper

```sql
-- Función para obtener agencias asignadas al SUPERADMIN
CREATE OR REPLACE FUNCTION public.get_superadmin_agency_ids()
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.user_role;
  agency_ids UUID[];
BEGIN
  -- Get current user's role
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();

  -- If not SUPERADMIN, return empty array
  IF user_role != 'SUPERADMIN' THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  -- Get assigned agency IDs
  SELECT ARRAY_AGG(agency_id) INTO agency_ids
  FROM public.superadmin_agency_assignments
  WHERE superadmin_id = auth.uid();

  RETURN COALESCE(agency_ids, ARRAY[]::UUID[]);
END;
$$;
```

#### 3. Actualizar política RLS

```sql
-- Política SELECT con múltiples agencias
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_owner()
  OR (
    -- SUPERADMIN ve usuarios de TODAS sus agencias asignadas
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = ANY(public.get_superadmin_agency_ids())
  )
  OR (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

-- Política INSERT
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    public.is_owner()
    OR (
      -- SUPERADMIN puede crear en sus agencias asignadas
      public.get_user_role() = 'SUPERADMIN'
      AND agency_id = ANY(public.get_superadmin_agency_ids())
    )
    OR (
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);
```

#### 4. Asignar agencias a superadmin@superadmin.com

```sql
-- Ver agencias disponibles
SELECT id, name, status FROM agencies ORDER BY name;

-- Asignar "lozada agency" (reemplaza con el ID real)
INSERT INTO public.superadmin_agency_assignments (superadmin_id, agency_id, assigned_by)
VALUES (
  (SELECT id FROM users WHERE email = 'superadmin@superadmin.com'),
  (SELECT id FROM agencies WHERE name = 'lozada agency'),
  (SELECT id FROM users WHERE role = 'OWNER' LIMIT 1)
);

-- Opción: Asignar MÚLTIPLES agencias
-- INSERT INTO public.superadmin_agency_assignments (superadmin_id, agency_id, assigned_by)
-- VALUES
--   ((SELECT id FROM users WHERE email = 'superadmin@superadmin.com'), 'agency-1-uuid', owner_id),
--   ((SELECT id FROM users WHERE email = 'superadmin@superadmin.com'), 'agency-2-uuid', owner_id),
--   ((SELECT id FROM users WHERE email = 'superadmin@superadmin.com'), 'agency-3-uuid', owner_id);
```

#### 5. Verificar

```sql
-- Ver asignaciones
SELECT
  u.email,
  a.name as agency_name,
  saa.assigned_at
FROM superadmin_agency_assignments saa
JOIN users u ON saa.superadmin_id = u.id
JOIN agencies a ON saa.agency_id = a.id
WHERE u.email = 'superadmin@superadmin.com';

-- Probar función
SELECT public.get_superadmin_agency_ids() as agencias_asignadas;

-- Ver usuarios visibles
SELECT
  u.email,
  u.role,
  a.name as agency_name
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE u.agency_id = ANY(
  SELECT agency_id FROM superadmin_agency_assignments
  WHERE superadmin_id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com')
)
OR u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com');
```

---

### ⚠️ Opción B: Modelo Simple (UNA SOLA AGENCIA)

**Si NO necesitas múltiples agencias**, asigna `agency_id` directamente:

```sql
-- Asignar lozada agency al campo agency_id
UPDATE users
SET agency_id = (SELECT id FROM agencies WHERE name = 'lozada agency')
WHERE email = 'superadmin@superadmin.com';

-- La política RLS ya aplicada (FIX_SIMPLE.sql) funcionará
```

**Ventaja:** Simple, no requiere tabla adicional
**Desventaja:** SUPERADMIN solo puede gestionar 1 agencia

---

## 🎯 ¿Cuál Usar?

### Usa **Opción A** si:
- ✅ SUPERADMIN debe gestionar MÚLTIPLES agencias
- ✅ Quieres la arquitectura escalable
- ✅ Puedes dedicar 10 minutos a configurar todo

### Usa **Opción B** si:
- ✅ SUPERADMIN solo gestiona 1 agencia
- ✅ Quieres la solución más rápida (1 minuto)
- ✅ Simplicidad > Flexibilidad

---

## 📋 Ejemplo: Opción A (Múltiples Agencias)

### Caso de uso:
**`superadmin@superadmin.com` gestiona 3 agencias:**
- lozada agency
- Agency Team
- Otra Agencia más

### Asignaciones:
```sql
INSERT INTO superadmin_agency_assignments (superadmin_id, agency_id)
VALUES
  ((SELECT id FROM users WHERE email = 'superadmin@superadmin.com'),
   (SELECT id FROM agencies WHERE name = 'lozada agency')),

  ((SELECT id FROM users WHERE email = 'superadmin@superadmin.com'),
   (SELECT id FROM agencies WHERE name = 'Agency Team')),

  ((SELECT id FROM users WHERE email = 'superadmin@superadmin.com'),
   (SELECT id FROM agencies WHERE name = 'Otra Agencia'));
```

### Resultado en `/users`:
```
Users List
15 users visible

Email                     | Role       | Agency
--------------------------|------------|------------------
superadmin@superadmin.com | SUPERADMIN | -
admin@lozada.com          | ADMIN      | lozada agency      ← Ve
seller1@lozada.com        | SELLER     | lozada agency      ← Ve
admin@agency.com          | ADMIN      | Agency Team        ← Ve
seller@seller.com         | SELLER     | Agency Team        ← Ve
seller2@seller2.com       | SELLER     | Agency Team        ← Ve
admin@otra.com            | ADMIN      | Otra Agencia       ← Ve
seller3@otra.com          | SELLER     | Otra Agencia       ← Ve
```

---

## 🚀 Script Completo para Opción A

He creado el script completo en: **[APLICAR_MIGRACION_MULTIPLE_AGENCIES.sql](APLICAR_MIGRACION_MULTIPLE_AGENCIES.sql)**

---

## ❓ ¿Qué prefieres?

**Dime:**
1. ¿SUPERADMIN debe gestionar solo "lozada agency"? → **Opción B**
2. ¿SUPERADMIN debe gestionar múltiples agencias? → **Opción A**
3. ¿Qué agencias debe ver `superadmin@superadmin.com`?

Te preparo el script específico según tu respuesta. 🎯
