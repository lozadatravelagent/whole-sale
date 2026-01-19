# 🧪 GUÍA DE TESTING: RLS EN TABLA USERS

## ⚠️ PREREQUISITOS

Antes de comenzar los tests, asegúrate de haber ejecutado:
1. ✅ `FIX_DATA_BEFORE_RLS.sql` - Corregir datos
2. ✅ `ENABLE_RLS_MIGRATION.sql` - Habilitar RLS

---

## 📋 TESTS A REALIZAR

### **Test 1: Verificar RLS en Base de Datos** ✅

Ejecutar en Supabase SQL Editor:

```sql
-- Debe devolver rls_enabled = true
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'users' AND schemaname = 'public';

-- Debe devolver 4 policies
SELECT COUNT(*) AS total_policies
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public';

-- NO debe devolver ninguna policy temporal
SELECT policyname
FROM pg_policies
WHERE tablename = 'users'
  AND schemaname = 'public'
  AND policyname LIKE '%temp%';
```

**Resultado esperado:**
- `rls_enabled = true` ✅
- `total_policies = 4` ✅
- 0 policies temporales ✅

---

### **Test 2: Login como OWNER** 🔑

1. **Login:**
   - Email: `lozadatravelagent@gmail.com`
   - Ir a `/users`

2. **Verificar:**
   - ✅ Debe ver **TODOS** los 12 usuarios
   - ✅ Debe ver usuarios OWNER, SUPERADMIN, ADMIN y SELLER
   - ✅ Puede hacer click en "Editar" en cualquier usuario
   - ✅ Puede crear usuarios con cualquier rol (OWNER, SUPERADMIN, ADMIN, SELLER)

3. **Test de creación:**
   - Intentar crear un usuario SUPERADMIN → ✅ Debe funcionar
   - Intentar crear un usuario OWNER → ✅ Debe funcionar

---

### **Test 3: Login como SUPERADMIN** 🔐

1. **Login:**
   - Email: `superadmin@superadmin.com`
   - Ir a `/users`

2. **Verificar:**
   - ❌ **NO debe ver** usuarios con rol OWNER
   - ✅ Debe ver solo usuarios de su tenant
   - ✅ Debe ver SUPERADMIN, ADMIN y SELLERS de su tenant

3. **Contar usuarios visibles:**
```sql
-- Ejecutar en SQL Editor como SUPERADMIN (simular)
-- Debe devolver usuarios filtrados por tenant
SELECT role, COUNT(*)
FROM public.users
WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE email = 'superadmin@superadmin.com')
GROUP BY role;
```

4. **Test de creación:**
   - Intentar crear OWNER → ❌ Rol OWNER NO debe aparecer en dropdown
   - Intentar crear SUPERADMIN → ✅ Debe funcionar
   - Intentar crear ADMIN → ✅ Debe funcionar
   - Intentar crear SELLER → ✅ Debe funcionar

5. **Test de edición:**
   - Intentar editar usuario OWNER → ❌ Botón "Editar" NO debe aparecer
   - Editar ADMIN de su tenant → ✅ Debe funcionar

---

### **Test 4: Login como ADMIN** 👤

1. **Login:**
   - Email: `agency@agency.com`
   - Ir a `/users`

2. **Verificar:**
   - ❌ **NO debe ver** usuarios OWNER
   - ❌ **NO debe ver** usuarios SUPERADMIN
   - ❌ **NO debe ver** usuarios ADMIN de otras agencias
   - ✅ Solo debe ver SELLERS de su agencia

3. **Test de creación:**
   - Dropdown de roles debe mostrar solo: **SELLER** ✅
   - Intentar crear SELLER → ✅ Debe funcionar
   - NO debe poder crear ADMIN, SUPERADMIN ni OWNER ✅

4. **Test de edición:**
   - Editar SELLER de su agencia → ✅ Debe funcionar
   - NO debe ver botón "Editar" para roles superiores ✅

---

### **Test 5: Verificar Queries de Reportes** 📊

1. **Login como cada rol y verificar `/reports`:**
   - OWNER → ✅ Ve métricas de todos los tenants y agencias
   - SUPERADMIN → ✅ Ve solo su tenant y sus agencias
   - ADMIN → ✅ Ve solo su agencia y sus sellers

2. **Verificar que no hay errores en consola:**
   - Abrir DevTools → Console
   - No debe haber errores de "permission denied" en queries normales ✅

---

### **Test 6: Verificar `useAuthUser` Hook** 🔧

1. **Login como cualquier rol**
2. **Verificar en React DevTools o console:**

```javascript
// Desde la consola del navegador
// Debe devolver los datos del usuario autenticado
console.log(window.localStorage.getItem('supabase.auth.token'));
```

3. **Verificar que el hook carga correctamente:**
   - No hay loops infinitos de requests
   - El usuario se carga en < 500ms
   - `loading` pasa a `false` después de cargar

---

### **Test 7: Intentar Bypass de RLS (Security Test)** 🛡️

**Este test simula un ataque. SOLO ejecutar en ambiente de desarrollo.**

1. **Abrir DevTools → Console**
2. **Intentar query directa a Supabase:**

```javascript
// Intento de bypass: Intentar ver todos los usuarios sin filtro
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('role', 'OWNER');  // Intentar ver usuarios OWNER como SUPERADMIN

console.log('Usuarios OWNER visibles:', data);
console.log('Error (esperado):', error);
```

**Resultado esperado:**
- Como SUPERADMIN: `data = []` o `data = null` ✅
- Como OWNER: `data = [array con usuarios OWNER]` ✅

3. **Intentar crear usuario con rol superior:**

```javascript
// Como ADMIN, intentar crear SUPERADMIN
const { data, error } = await supabase
  .from('users')
  .insert({
    email: 'hacker@test.com',
    role: 'SUPERADMIN',  // ← Intentar escalar privilegios
    agency_id: 'agency-uuid',
    tenant_id: 'tenant-uuid'
  });

console.log('Error esperado:', error);
```

**Resultado esperado:**
- Error: `new row violates row-level security policy` ✅

---

### **Test 8: Performance y Latencia** ⚡

1. **Abrir DevTools → Network**
2. **Ir a `/users` con cada rol**
3. **Medir tiempo de carga del request a Supabase:**
   - Request a `users` o `users_with_details`
   - Tiempo total debe ser < 200ms ✅

4. **Ejecutar benchmark en SQL Editor:**

```sql
-- Benchmark: SELECT como SUPERADMIN (simular)
EXPLAIN ANALYZE
SELECT *
FROM public.users
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND (
    id = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPERADMIN'
  );
```

**Resultado esperado:**
- Execution time: < 5ms ✅
- Usa índice `idx_users_tenant_agency_role` ✅

---

## 📊 CHECKLIST FINAL

Después de todos los tests:

- [ ] RLS está habilitado en tabla `users`
- [ ] 0 policies temporales existen
- [ ] 4 policies productivas funcionando
- [ ] OWNER ve todos los usuarios
- [ ] SUPERADMIN NO ve usuarios OWNER
- [ ] ADMIN solo ve SELLERS de su agencia
- [ ] Creación de usuarios respeta jerarquía de roles
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en logs de Supabase
- [ ] Performance de queries < 200ms
- [ ] Tests de bypass fallan correctamente (security OK)
- [ ] Reportes muestran datos correctos por rol

---

## 🚨 SI ALGO FALLA

### **Síntoma: Usuarios no pueden ver nada**

**Causa probable:** RLS habilitado pero policies mal configuradas

**Solución:**
```sql
-- Verificar que las functions helper existen
SELECT proname FROM pg_proc
WHERE proname IN ('is_owner', 'get_user_role', 'get_user_tenant_id', 'get_user_agency_id')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Si faltan funciones, ejecutar:
-- supabase/migrations/20251005000002_user_management_helpers.sql
```

---

### **Síntoma: "permission denied for table users"**

**Causa probable:** Usuario sin `tenant_id` asignado

**Solución:**
```sql
-- Identificar usuarios sin tenant
SELECT id, email, role, tenant_id
FROM public.users
WHERE tenant_id IS NULL;

-- Asignarles tenant manualmente (reemplazar UUIDs)
UPDATE public.users
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;
```

---

### **Síntoma: SUPERADMIN ve usuarios OWNER**

**Causa probable:** Policy no filtra correctamente

**Solución:**
```sql
-- Verificar expresión de la policy
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'users' AND policyname = 'users_select_policy';

-- La expresión debe contener:
-- ((get_user_role() = 'SUPERADMIN'::text) AND (tenant_id = get_user_tenant_id()))
-- Y NO debe tener bypass para ver OWNER
```

---

### **Síntoma: Performance muy lenta (> 1 segundo)**

**Causa probable:** Falta índice o policy usa función lenta

**Solución:**
```sql
-- Verificar índices
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users' AND schemaname = 'public';

-- Crear índice faltante si es necesario
CREATE INDEX IF NOT EXISTS idx_users_tenant_agency_role
ON public.users(tenant_id, agency_id, role);
```

---

### **Rollback de emergencia (último recurso)**

Si todo falla y necesitas restaurar acceso:

```sql
-- DESHABILITAR RLS TEMPORALMENTE
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- ⚠️ ESTO DEJA LA APP SIN SEGURIDAD
-- Úsalo solo para investigar el problema
-- Revertir apenas encuentres la causa raíz
```

---

## 📞 CONTACTO DE SOPORTE

Si necesitas ayuda:
1. Copia el output de `INSPECT_RLS_STATUS.sql`
2. Copia los errores de la consola del navegador
3. Copia los logs de Supabase (Dashboard → Logs)
4. Describe qué test falló y con qué rol

---

## ✅ MIGRACIÓN EXITOSA

Si todos los tests pasan:
- 🎉 **RLS está correctamente configurado**
- 🔒 **Tu aplicación es multi-tenant segura**
- ⚡ **Performance es óptima**
- 📋 **Documentación actualizada**

**SIGUIENTE PASO:** Elimina los archivos de migración SQL del repositorio para evitar ejecuciones accidentales.
