# Guía: Crear Usuario OWNER

## 📋 Resumen

Para crear un usuario OWNER hay dos métodos:

### Método 1: Si ya tienes un OWNER existente (Recomendado)
Usa la interfaz de la aplicación o la Edge Function.

### Método 2: Si NO tienes ningún OWNER (Bootstrap/Script SQL)
Crea el primer OWNER directamente en la base de datos.

---

## 🔐 Método 1: Crear OWNER desde la aplicación (si ya eres OWNER)

1. **Inicia sesión** como usuario OWNER existente
2. Ve a **Usuarios** (`/users`)
3. Click en **"Crear Usuario"**
4. Completa el formulario:
   - Email: `nuevo-owner@ejemplo.com`
   - Contraseña: (mínimo 8 caracteres)
   - Nombre: (opcional)
   - Rol: Selecciona **"OWNER"**
   - Tenant: Deja en blanco (OWNER no tiene tenant)
   - Agencia: Deja en blanco (OWNER no tiene agencia)
5. Click en **"Crear"**

✅ El usuario OWNER será creado y aparecerá en la lista.

---

## 🛠️ Método 2: Crear primer OWNER vía SQL (Bootstrap)

Si NO tienes ningún OWNER existente, usa este método:

### Paso 1: Crear usuario en Supabase Auth

**Opción A: Desde Supabase Dashboard (Más fácil)**

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **Authentication** > **Users**
3. Click en **"Add User"** > **"Create new user"**
4. Completa:
   - **Email**: `owner@tusistema.com`
   - **Password**: (una contraseña segura, mínimo 8 caracteres)
   - ✅ Marca **"Auto Confirm User"** (importante)
5. Click en **"Create User"**
6. **Copia el User ID** que aparece (necesitarás este UUID)

**Opción B: Desde SQL Editor (Avanzado)**

```sql
-- Ejecuta esto con permisos de service_role
-- Solo funciona si tienes acceso directo a auth schema
SELECT 
  id,
  email 
FROM auth.users 
WHERE email = 'owner@tusistema.com';
```

### Paso 2: Ejecutar script SQL en Supabase SQL Editor

1. Ve a **SQL Editor** en Supabase Dashboard
2. Ejecuta este script (reemplaza `TU_USER_ID_AQUI` con el ID del Paso 1):

```sql
-- Reemplaza estos valores
\set owner_id 'TU_USER_ID_AQUI'  -- UUID del usuario de auth.users
\set owner_email 'owner@tusistema.com'
\set owner_name 'Owner Principal'

-- Crear registro en public.users
INSERT INTO public.users (
  id,
  email,
  name,
  role,
  agency_id,
  tenant_id,
  provider,
  created_at,
  updated_at
)
VALUES (
  :'owner_id'::uuid,
  :'owner_email',
  :'owner_name',
  'OWNER'::public.user_role,
  NULL,  -- OWNER no tiene agency_id
  NULL,  -- OWNER no tiene tenant_id
  'email',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  role = 'OWNER'::public.user_role,
  agency_id = NULL,
  tenant_id = NULL,
  updated_at = NOW();
```

### Paso 3: Actualizar app_metadata del usuario

Necesitas actualizar el `app_metadata` en `auth.users` para que el JWT incluya el rol. Esto puede hacerse de varias formas:

**Opción A: Desde Supabase Dashboard**
- Ve a **Authentication** > **Users**
- Encuentra tu usuario OWNER
- Click en **"..."** > **"Edit User"**
- En **"App Metadata"**, agrega:
  ```json
  {
    "user_role": "OWNER",
    "agency_id": null,
    "tenant_id": null
  }
  ```

**Opción B: Desde código (Edge Function o script)**

```typescript
const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
  ownerUserId,
  {
    app_metadata: {
      user_role: 'OWNER',
      agency_id: null,
      tenant_id: null
    }
  }
);
```

### Paso 4: Verificar

Ejecuta esta query para confirmar:

```sql
SELECT 
  id,
  email,
  name,
  role,
  agency_id,
  tenant_id,
  provider
FROM public.users
WHERE role = 'OWNER'::public.user_role;
```

Debe mostrar:
- ✅ `role = 'OWNER'`
- ✅ `agency_id = NULL`
- ✅ `tenant_id = NULL`

---

## 🔍 Verificar que el OWNER funciona

1. **Cierra sesión** de tu cuenta actual
2. **Inicia sesión** con el email y contraseña del nuevo OWNER
3. Deberías ver:
   - Dashboard con título "Dashboard Global (OWNER)"
   - En **Usuarios**: Puedes ver TODOS los usuarios (incluidos otros OWNERs)
   - En **Usuarios**: Puedes crear usuarios con cualquier rol, incluyendo OWNER
   - En **Settings**: Puedes ver todas las agencias de todos los tenants

---

## ⚠️ Notas Importantes

1. **Seguridad**: Cambia la contraseña después del primer login
2. **app_metadata**: Es CRÍTICO que el `app_metadata` esté actualizado, o el JWT no tendrá el rol correcto
3. **RLS Policies**: Las políticas RLS verifican el rol desde `app_metadata.user_role`
4. **Primer OWNER**: Si ya existe un OWNER, solo ese OWNER puede crear más OWNERs

---

## 🐛 Troubleshooting

### Problema: "No tienes permisos para crear usuarios con este rol"
- **Causa**: No estás logueado como OWNER
- **Solución**: Inicia sesión con una cuenta OWNER existente

### Problema: El usuario OWNER no puede ver otros usuarios
- **Causa**: El `app_metadata` no está actualizado
- **Solución**: Actualiza el `app_metadata` con `user_role: 'OWNER'`

### Problema: RLS bloquea el acceso
- **Causa**: El JWT no tiene el rol en `app_metadata`
- **Solución**: Verifica que `auth.jwt()->'app_metadata'->>'user_role' = 'OWNER'`

---

## 📚 Referencias

- Archivo SQL: `supabase/migrations/CREATE_OWNER_USER.sql`
- Edge Function: `supabase/functions/create-user/index.ts`
- Reglas de negocio: `docs/business-rules/USER_MANAGEMENT_BUSINESS_RULES.md`

