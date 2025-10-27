# 📋 Resumen: Problema SUPERADMIN y Solución

## 🐛 Problema Identificado

**Usuario:** `superadmin@superadmin.com`

**Síntoma:**
- El SUPERADMIN está asignado SOLO a "lozada agency" ✅
- PERO ve usuarios de "Agency Team" que NO es su agencia ❌
- Ve: `agency@agency.com`, `seller@seller.com`, `seller2@seller2.com`

**Comportamiento esperado:**
- Solo debería ver usuarios de "lozada agency"

---

## 🔍 Causa Raíz

### ⚠️ Problema Real Descubierto:

**La tabla `superadmin_agency_assignments` NO EXISTE en Supabase**

Cuando ejecutamos:
```sql
SELECT * FROM superadmin_agency_assignments;
```

Error:
```
ERROR: 42P01: relation "superadmin_agency_assignments" does not exist
LINE 37: FROM superadmin_agency_assignments saa
```

### ¿Por qué ocurre esto?

1. **Migración local existe** (`20251005100000_superadmin_multiple_agencies.sql`)
   - Crea tabla `superadmin_agency_assignments`
   - Implementa asignaciones múltiples para SUPERADMIN
   - Cambia política RLS para usar `get_superadmin_agency_ids()`

2. **Migración NO se aplicó en Supabase remota**
   - Tabla NO existe
   - Función NO existe o falla
   - Política RLS puede estar corrupta

3. **Resultado:**
   - RLS intenta usar tabla inexistente
   - Filtrado falla silenciosamente
   - SUPERADMIN ve usuarios incorrectos

---

## ✅ Solución INMEDIATA

### 📄 Ejecutar: [`FIX_SUPERADMIN_RLS_URGENTE.sql`](FIX_SUPERADMIN_RLS_URGENTE.sql)

**Qué hace:**
- Revierte política RLS a usar `users.agency_id` (modelo simple)
- No requiere tabla adicional
- Funciona inmediatamente

**Cómo ejecutar:**

1. **Abrir Supabase Dashboard** → SQL Editor
2. **Copiar y pegar el siguiente código:**

```sql
-- VERIFICAR PROBLEMA
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'superadmin_agency_assignments'
  ) THEN
    RAISE NOTICE '❌ CONFIRMADO: Tabla NO existe';
  ELSE
    RAISE NOTICE '✅ Tabla existe';
  END IF;
END $$;

-- FIX: Revertir política RLS
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_owner()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = public.get_user_agency_id()  -- Usa users.agency_id ✅
  )
  OR (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

-- Actualizar INSERT policy
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    public.is_owner()
    OR (
      public.get_user_role() = 'SUPERADMIN'
      AND agency_id = public.get_user_agency_id()
    )
    OR (
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);

-- VERIFICAR FIX
SELECT '✅ FIX APLICADO' as resultado;
```

3. **Ejecutar el script** (botón "Run")

4. **Verificar resultado:**
```sql
-- Usuarios visibles para superadmin@superadmin.com
SELECT
  u.email,
  u.role,
  a.name as agency_name
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE u.agency_id = (SELECT agency_id FROM users WHERE email = 'superadmin@superadmin.com')
   OR u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com');
```

**Resultado esperado:**
```
email                     | role       | agency_name
--------------------------|------------|-------------
superadmin@superadmin.com | SUPERADMIN | lozada agency
[otros de lozada agency]  | ...        | lozada agency
```

**NO debería aparecer:**
```
❌ agency@agency.com    | ADMIN  | Agency Team
❌ seller@seller.com    | SELLER | Agency Team
❌ seller2@seller2.com  | SELLER | Agency Team
```

---

## 🧪 Verificación Post-Fix

### 1. En SQL Editor de Supabase:

```sql
-- Test 1: Ver política RLS actual
SELECT
  policyname,
  pg_get_expr(polqual, polrelid) as policy_definition
FROM pg_policy
WHERE polname = 'users_select_policy'
  AND polrelid = 'public.users'::regclass;

-- Debe mostrar: (... AND (agency_id = public.get_user_agency_id()))
-- NO debe mostrar: (... AND (agency_id = ANY(public.get_superadmin_agency_ids())))

-- Test 2: Simular visibilidad de superadmin@superadmin.com
SELECT
  u.email,
  u.role,
  a.name as agency,
  CASE
    WHEN u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') THEN 'Self ✅'
    WHEN u.agency_id = (SELECT agency_id FROM users WHERE email = 'superadmin@superadmin.com') THEN 'Same Agency ✅'
    ELSE 'Other Agency ❌'
  END as visibilidad
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
ORDER BY visibilidad;
```

### 2. En Frontend (`/users`):

1. **Iniciar sesión** como `superadmin@superadmin.com`
2. **Ir a** `/users`
3. **Verificar que ve SOLO:**
   - `superadmin@superadmin.com` (self)
   - Usuarios de "lozada agency"

4. **Verificar que NO ve:**
   - `agency@agency.com` (de Agency Team)
   - `seller@seller.com` (de Agency Team)
   - `seller2@seller2.com` (de Agency Team)

---

## 📊 Comparación Antes/Después

### ❌ ANTES del Fix

**Política RLS (ROTA):**
```sql
-- Intenta usar tabla inexistente
public.get_user_role() = 'SUPERADMIN'
AND agency_id = ANY(public.get_superadmin_agency_ids())  -- ❌ Falla
```

**Resultado:**
- Ve usuarios de "Agency Team" ❌
- Ve usuarios que NO debería ver ❌
- Violación de seguridad RLS ❌

### ✅ DESPUÉS del Fix

**Política RLS (CORRECTA):**
```sql
-- Usa users.agency_id directamente
public.get_user_role() = 'SUPERADMIN'
AND agency_id = public.get_user_agency_id()  -- ✅ Funciona
```

**Resultado:**
- Ve solo usuarios de "lozada agency" ✅
- RLS funciona correctamente ✅
- Seguridad restaurada ✅

---

## 🔄 Próximos Pasos (OPCIONAL)

### Si quieres asignaciones múltiples en el futuro:

1. **Primero aplicar el fix urgente** (arriba) ✅
2. **Luego aplicar migración completa:**
   - Ejecutar `20251005100000_superadmin_multiple_agencies.sql` en Supabase
   - Crear tabla `superadmin_agency_assignments`
   - Migrar datos de `users.agency_id` a la nueva tabla
   - Verificar que funciona

3. **O mantener modelo simple:**
   - No hacer nada más
   - SUPERADMIN solo gestiona 1 agencia
   - Más simple y funciona perfectamente

---

## 📚 Archivos de Referencia

### Scripts SQL:
- ✅ **[FIX_SUPERADMIN_RLS_URGENTE.sql](FIX_SUPERADMIN_RLS_URGENTE.sql)** - Solución inmediata
- 📖 **[fix_superadmin_agency_assignments.sql](fix_superadmin_agency_assignments.sql)** - Diagnóstico detallado
- 📋 **[query_users_hierarchy.sql](query_users_hierarchy.sql)** - Consultas de jerarquía

### Documentación:
- 📄 **[PROBLEMA_SUPERADMIN_AGENCIES.md](PROBLEMA_SUPERADMIN_AGENCIES.md)** - Explicación detallada
- 🎯 **[JERARQUIA_ROLES_Y_DASHBOARD.md](JERARQUIA_ROLES_Y_DASHBOARD.md)** - Roles y permisos
- 📊 **[DIAGRAMA_JERARQUIA.md](DIAGRAMA_JERARQUIA.md)** - Diagramas visuales

### Código:
- 🔧 **[useUsers.ts](src/hooks/useUsers.ts)** - Hook de gestión de usuarios
- 🎨 **[Users.tsx](src/pages/Users.tsx)** - Página de usuarios

---

## ✅ Checklist de Ejecución

### Paso 1: Ejecutar Fix
- [ ] Abrir Supabase Dashboard → SQL Editor
- [ ] Copiar código de `FIX_SUPERADMIN_RLS_URGENTE.sql`
- [ ] Ejecutar script
- [ ] Ver mensaje: "✅ FIX APLICADO"

### Paso 2: Verificar en SQL
- [ ] Ejecutar Test 1 (ver política RLS)
- [ ] Confirmar que usa `get_user_agency_id()`
- [ ] Ejecutar Test 2 (simular visibilidad)
- [ ] Confirmar que solo muestra "lozada agency"

### Paso 3: Verificar en Frontend
- [ ] Login como `superadmin@superadmin.com`
- [ ] Ir a `/users`
- [ ] Confirmar que ve solo "lozada agency"
- [ ] Confirmar que NO ve "Agency Team"

### Paso 4: Confirmar Fix
- [ ] ✅ SUPERADMIN ve solo su agencia
- [ ] ✅ RLS funciona correctamente
- [ ] ✅ Problema resuelto

---

## 🎯 Resumen en 3 Puntos

1. **Problema:** Tabla `superadmin_agency_assignments` NO existe → RLS falla
2. **Causa:** Migración NO aplicada en Supabase remota
3. **Solución:** Revertir política RLS a usar `users.agency_id` (simple)

---

**Estado:** 🔴 Pendiente de aplicar fix
**Urgencia:** ⚡ Alta (violación de seguridad RLS)
**Tiempo estimado:** 5 minutos
**Complejidad:** Baja (1 script SQL)

---

**Creado:** 5 de Octubre 2025
**Última actualización:** 5 de Octubre 2025
