# 🏗️ Modelo Correcto: TENANT → SUPERADMIN → AGENCIES

## 🎯 Arquitectura Correcta

```
OWNER (Sistema Global)
  ↓ crea
TENANT (Mayorista/Organización)
  ↓ tiene
SUPERADMIN (Administrador del Tenant)
  ↓ gestiona TODAS
AGENCIES (Agencias del Tenant)
  ↓ tienen
ADMINS y SELLERS
```

---

## 📊 Modelo de Datos

### Tabla: `users`

| Campo | OWNER | SUPERADMIN | ADMIN | SELLER |
|-------|-------|------------|-------|--------|
| `tenant_id` | `NULL` | `tenant-uuid` ✅ | `tenant-uuid` | `tenant-uuid` |
| `agency_id` | `NULL` | `NULL` ✅ | `agency-uuid` | `agency-uuid` |

**Regla clave:**
- ✅ **SUPERADMIN tiene `tenant_id` pero `agency_id = NULL`**
- ✅ **ADMIN/SELLER tienen AMBOS `tenant_id` Y `agency_id`**

---

## 🔐 Políticas RLS Correctas

### SELECT Policy

```sql
CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()                    -- Ve sí mismo
  OR public.is_owner()               -- OWNER ve todo
  OR (
    -- SUPERADMIN ve usuarios de SU TENANT (todas las agencias)
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()  -- ← KEY: Filtra por TENANT
  )
  OR (
    -- ADMIN ve SELLERS de su agencia
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);
```

**Explicación:**
- SUPERADMIN: `WHERE tenant_id = 'mi-tenant-uuid'` → Ve TODAS las agencias del tenant
- ADMIN: `WHERE agency_id = 'mi-agency-uuid'` → Ve solo SU agencia

---

## 👥 Ejemplos Prácticos

### Escenario: Sistema con 2 Tenants

```
📦 Base de datos:

tenants:
┌──────────────┬─────────────────┬────────┐
│ id           │ name            │ status │
├──────────────┼─────────────────┼────────┤
│ tenant-esp   │ Mayorista ESP   │ active │
│ tenant-mex   │ Mayorista MEX   │ active │
└──────────────┴─────────────────┴────────┘

agencies:
┌──────────────┬────────────────┬────────────┐
│ id           │ name           │ tenant_id  │
├──────────────┼────────────────┼────────────┤
│ agency-loza  │ lozada agency  │ tenant-esp │
│ agency-team  │ Agency Team    │ tenant-esp │
│ agency-canc  │ Viajes Cancún  │ tenant-mex │
└──────────────┴────────────────┴────────────┘

users:
┌───────────────────────────┬────────────┬────────────┬────────────┐
│ email                     │ role       │ tenant_id  │ agency_id  │
├───────────────────────────┼────────────┼────────────┼────────────┤
│ owner@system.com          │ OWNER      │ NULL       │ NULL       │
│ superadmin@superadmin.com │ SUPERADMIN │ tenant-esp │ NULL ✅    │
│ admin@lozada.com          │ ADMIN      │ tenant-esp │ agency-loza│
│ seller1@lozada.com        │ SELLER     │ tenant-esp │ agency-loza│
│ admin@agency.com          │ ADMIN      │ tenant-esp │ agency-team│
│ seller@seller.com         │ SELLER     │ tenant-esp │ agency-team│
│ superadmin-mex@mex.com    │ SUPERADMIN │ tenant-mex │ NULL ✅    │
│ admin@cancun.com          │ ADMIN      │ tenant-mex │ agency-canc│
└───────────────────────────┴────────────┴────────────┴────────────┘
```

---

## 🎯 ¿Qué ve cada SUPERADMIN en `/users`?

### `superadmin@superadmin.com` (Tenant: Mayorista ESP)

**Ve TODOS los usuarios del tenant "Mayorista ESP":**

```
Users List
6 users visible

Email                     | Role       | Agency        | Tenant
--------------------------|------------|---------------|---------------
superadmin@superadmin.com | SUPERADMIN | -             | Mayorista ESP ✅
admin@lozada.com          | ADMIN      | lozada agency | Mayorista ESP ✅
seller1@lozada.com        | SELLER     | lozada agency | Mayorista ESP ✅
admin@agency.com          | ADMIN      | Agency Team   | Mayorista ESP ✅
seller@seller.com         | SELLER     | Agency Team   | Mayorista ESP ✅
seller2@seller2.com       | SELLER     | Agency Team   | Mayorista ESP ✅
```

**NO ve:**
```
❌ superadmin-mex@mex.com  | SUPERADMIN | -            | Mayorista MEX
❌ admin@cancun.com        | ADMIN      | Viajes Cancún| Mayorista MEX
```

**Razón:** Solo ve usuarios donde `tenant_id = 'tenant-esp'`

---

### `superadmin-mex@mex.com` (Tenant: Mayorista MEX)

**Ve TODOS los usuarios del tenant "Mayorista MEX":**

```
Users List
3 users visible

Email                  | Role       | Agency        | Tenant
-----------------------|------------|---------------|---------------
superadmin-mex@mex.com | SUPERADMIN | -             | Mayorista MEX ✅
admin@cancun.com       | ADMIN      | Viajes Cancún | Mayorista MEX ✅
seller-cancun@canc.com | SELLER     | Viajes Cancún | Mayorista MEX ✅
```

**NO ve:**
```
❌ Ningún usuario de Mayorista ESP
```

---

## 🏗️ Flujo: OWNER crea TENANT con SUPERADMIN

### Modal "Create Tenant" (Propuesta de UI)

```typescript
// Cuando OWNER crea un tenant:

interface CreateTenantInput {
  // Datos del Tenant
  tenant_name: string;
  tenant_status: 'active' | 'suspended';

  // Datos del SUPERADMIN (opcional)
  create_superadmin?: boolean;
  superadmin_email?: string;
  superadmin_password?: string;
  superadmin_name?: string;
}

// Ejemplo:
{
  tenant_name: "Mayorista Argentina",
  tenant_status: "active",
  create_superadmin: true,
  superadmin_email: "admin@mayorista-arg.com",
  superadmin_password: "secure123",
  superadmin_name: "Admin Argentina"
}
```

### Backend: Crear Tenant + SUPERADMIN

```sql
-- 1. Crear Tenant
INSERT INTO tenants (name, status)
VALUES ('Mayorista Argentina', 'active')
RETURNING id INTO tenant_id_var;

-- 2. Crear SUPERADMIN asignado a ese tenant
INSERT INTO auth.users (email, encrypted_password)
VALUES ('admin@mayorista-arg.com', crypt('secure123', gen_salt('bf')))
RETURNING id INTO user_id_var;

INSERT INTO public.users (id, email, role, tenant_id, agency_id)
VALUES (
  user_id_var,
  'admin@mayorista-arg.com',
  'SUPERADMIN',
  tenant_id_var,  -- ✅ Asignado al tenant
  NULL            -- ✅ NO asignado a agencia específica
);
```

### Resultado:

```
El SUPERADMIN admin@mayorista-arg.com puede:
✅ Ver todas las agencias del tenant "Mayorista Argentina"
✅ Crear agencias dentro del tenant
✅ Crear usuarios (ADMIN, SELLER) en esas agencias
✅ Ver métricas agregadas del tenant
❌ NO puede ver otros tenants
```

---

## 📋 Checklist de Configuración

### Para cada SUPERADMIN:

- [ ] ✅ Tiene `tenant_id` asignado (NO NULL)
- [ ] ✅ Tiene `agency_id = NULL` (sin agencia específica)
- [ ] ✅ Puede ver usuarios de TODAS las agencias de su tenant
- [ ] ✅ Puede crear agencias en su tenant
- [ ] ✅ Puede crear usuarios (ADMIN, SELLER) en agencias de su tenant

### Para cada ADMIN:

- [ ] ✅ Tiene `tenant_id` asignado
- [ ] ✅ Tiene `agency_id` asignado (UNA agencia específica)
- [ ] ✅ Solo ve SELLERS de su agencia
- [ ] ✅ Puede crear SELLERS en su agencia

### Para cada SELLER:

- [ ] ✅ Tiene `tenant_id` asignado
- [ ] ✅ Tiene `agency_id` asignado
- [ ] ✅ Solo ve sí mismo
- [ ] ✅ Solo ve sus leads asignados

---

## 🔧 Script de Corrección

**Ejecuta:** [FIX_SUPERADMIN_TENANT_MODEL.sql](FIX_SUPERADMIN_TENANT_MODEL.sql)

**Pasos:**

1. **Verificar tenants existentes**
2. **Asignar SUPERADMIN a un tenant** (`tenant_id` != NULL, `agency_id` = NULL)
3. **Actualizar políticas RLS** (filtrar por `tenant_id` en vez de `agency_id`)
4. **Verificar** que SUPERADMIN ve todas las agencias de su tenant

---

## 🎯 Ventajas del Modelo Correcto

### ✅ SUPERADMIN asignado a TENANT:

1. **Gestiona TODAS las agencias del tenant** → No necesita asignaciones múltiples
2. **Modelo simple y escalable** → Un tenant puede tener N agencias
3. **Permisos heredados** → SUPERADMIN automáticamente ve todo el tenant
4. **Alineado con la jerarquía** → OWNER > TENANT > SUPERADMIN > AGENCY > ADMIN > SELLER

### ❌ Modelo INCORRECTO (SUPERADMIN con agency_id):

1. Necesita tabla `superadmin_agency_assignments` (complejo)
2. Requiere asignaciones manuales por cada agencia
3. No escala bien si el tenant tiene muchas agencias
4. Rompe la jerarquía TENANT → SUPERADMIN

---

## 📊 Comparación de Modelos

| Aspecto | TENANT Model ✅ | Multiple Agencies Model ❌ |
|---------|----------------|---------------------------|
| **SUPERADMIN.tenant_id** | `tenant-uuid` | `tenant-uuid` |
| **SUPERADMIN.agency_id** | `NULL` | `NULL` |
| **Agencias visibles** | TODAS del tenant | Solo asignadas en tabla adicional |
| **Tabla adicional** | NO necesita | SÍ (`superadmin_agency_assignments`) |
| **RLS Filter** | `tenant_id = user_tenant_id` | `agency_id = ANY(get_assigned_agencies())` |
| **Complejidad** | Baja | Alta |
| **Escalabilidad** | Alta | Media |

---

## 🚀 Implementación Recomendada

### 1. Corregir SUPERADMINs existentes

```sql
-- Asignar a tenant, quitar agency_id
UPDATE users
SET
  tenant_id = (SELECT id FROM tenants WHERE name = 'Mayorista ESP'),
  agency_id = NULL
WHERE role = 'SUPERADMIN'
  AND email = 'superadmin@superadmin.com';
```

### 2. Actualizar RLS policies

```sql
-- Usar filtro por tenant_id
CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  -- ...
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()  -- ← Correcto
  )
  -- ...
);
```

### 3. UI: Modal "Create Tenant"

```typescript
// Componente React
<TenantDialog>
  <Input label="Tenant Name" />
  <Switch label="Create SUPERADMIN" />
  {createSuperadmin && (
    <>
      <Input label="SUPERADMIN Email" />
      <Input label="SUPERADMIN Password" type="password" />
      <Input label="SUPERADMIN Name" />
    </>
  )}
</TenantDialog>
```

### 4. Backend: Crear tenant + superadmin

```typescript
// Edge Function o RPC
async function createTenantWithSuperadmin(input: CreateTenantInput) {
  // 1. Create tenant
  const tenant = await supabase.from('tenants').insert({
    name: input.tenant_name,
    status: input.tenant_status
  }).select().single();

  // 2. Create superadmin if requested
  if (input.create_superadmin) {
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: input.superadmin_email,
      password: input.superadmin_password,
      email_confirm: true
    });

    await supabase.from('users').insert({
      id: authUser.user.id,
      email: input.superadmin_email,
      name: input.superadmin_name,
      role: 'SUPERADMIN',
      tenant_id: tenant.id,      // ✅ Asignado al tenant
      agency_id: null,           // ✅ Sin agencia específica
      provider: 'email'
    });
  }

  return tenant;
}
```

---

## ✅ Resultado Final

**Con el modelo correcto:**

```
superadmin@superadmin.com (Tenant: Mayorista ESP)
├── Ve: lozada agency
│   ├── admin@lozada.com (ADMIN)
│   └── seller1@lozada.com (SELLER)
├── Ve: Agency Team
│   ├── admin@agency.com (ADMIN)
│   ├── seller@seller.com (SELLER)
│   └── seller2@seller2.com (SELLER)
└── NO ve: Mayorista MEX (otro tenant)
```

---

**Fecha:** 6 de Octubre 2025
**Sistema:** WholeSale Connect AI
**Modelo:** TENANT-based SUPERADMIN (Correcto) ✅
