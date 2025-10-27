# Test Settings Backend - Checklist de Verificación

## ✅ Estructura de Base de Datos

### 1. Tabla `agencies` tiene campo `branding` (JSONB)
```sql
-- Verificar en Supabase Dashboard o con:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'agencies' AND column_name = 'branding';
```
✅ Confirmado en migraciones: `branding jsonb not null default jsonb_build_object()`

### 2. Tabla `users` tiene campo `name`
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'name';
```
✅ Confirmado en migración `20251003000001_add_owner_seller_roles.sql` línea 10

## ✅ Políticas RLS

### 3. ADMIN puede UPDATE su agencia
```sql
-- Policy: "admins can update their agency"
-- Permite a ADMIN actualizar agencies.branding de su propia agencia
```
✅ Confirmado en `20250902052754_f3e32ba5-105a-4123-860a-c1e8388a623c.sql` líneas 233-236

### 4. SUPERADMIN puede UPDATE agencias de su tenant
```sql
-- Policy: "superadmins can manage agencies"
```
✅ Confirmado en la misma migración líneas 229-232

### 5. OWNER puede UPDATE cualquier agencia
```sql
-- Policy: "owner can manage all agencies"
```
✅ Confirmado en `20251003000001_add_owner_seller_roles.sql` líneas 58-61

### 6. Todos pueden UPDATE su propio user.name
```sql
-- Policy: "user can update self"
```
✅ Confirmado líneas 248-251

## ✅ Storage Bucket

### 7. Bucket `agency-logos` existe y es público
Creado en: `supabase/migrations/20251005000001_create_storage_buckets.sql`

### 8. Políticas de Storage permiten upload/update/delete
- ✅ SELECT: Público (cualquiera puede ver)
- ✅ INSERT: OWNER, SUPERADMIN, ADMIN
- ✅ UPDATE: OWNER, SUPERADMIN, ADMIN
- ✅ DELETE: OWNER, SUPERADMIN, ADMIN

## 🧪 Pruebas Manuales Requeridas

### Test 1: Guardar Branding (ADMIN)
1. Login como ADMIN
2. Ir a Settings > Branding
3. Cambiar Primary Color a `#ff0000`
4. Cambiar Agency Name a "Test Agency"
5. Click "Save Changes"
6. **Verificar en Supabase Dashboard**:
   ```sql
   SELECT branding FROM agencies WHERE id = 'YOUR_AGENCY_ID';
   ```
   Debe retornar:
   ```json
   {
     "logoUrl": "",
     "primaryColor": "#ff0000",
     "secondaryColor": "#1e40af",
     "contact": {
       "name": "Test Agency",
       "email": "...",
       "phone": "..."
     }
   }
   ```

### Test 2: Guardar Profile (cualquier rol)
1. Login con cualquier rol
2. Ir a Settings > Account
3. Cambiar Display Name a "Juan Pérez"
4. Click "Save Profile"
5. **Verificar en Supabase Dashboard**:
   ```sql
   SELECT name FROM users WHERE id = auth.uid();
   ```
   Debe retornar: `"Juan Pérez"`

### Test 3: Cambiar Password (cualquier rol)
1. Login con cualquier rol
2. Ir a Settings > Account > Change Password
3. Ingresar nueva contraseña (mínimo 6 caracteres)
4. Confirmar contraseña
5. Click "Update Password"
6. **Verificar**: Logout y volver a login con nueva contraseña

### Test 4: Upload Logo (ADMIN)
1. Login como ADMIN
2. Ir a Settings > Branding
3. Click "Upload Logo"
4. Seleccionar imagen (PNG/JPG, < 2MB)
5. Esperar upload
6. Click "Save Changes"
7. **Verificar en Supabase Storage Dashboard**:
   - Bucket: `agency-logos`
   - Path: `YOUR_AGENCY_ID/logo-TIMESTAMP.ext`
8. **Verificar en agencies.branding**:
   ```json
   {
     "logoUrl": "https://YOUR_SUPABASE_URL/storage/v1/object/public/agency-logos/...",
     ...
   }
   ```

### Test 5: SELLER no puede editar Branding
1. Login como SELLER
2. Ir a Settings
3. **Verificar**: Tabs "Branding" y "Contact Info" están deshabilitados
4. **Verificar**: Mensaje informativo aparece
5. **Verificar**: Solo puede editar tab "Account"

## 🔍 Debugging

Si algo falla, revisar console logs:
- `[SETTINGS] Agency data loaded:` - Confirma carga de datos
- `[SETTINGS] Branding updated successfully` - Confirma guardado exitoso
- `[SETTINGS] Error updating branding:` - Ver error específico

También revisar Network tab en DevTools:
- Request a `/rest/v1/agencies?id=eq.XXX`
- Payload del PATCH debe incluir `{ "branding": {...} }`
- Response debe ser 200 OK

## 📊 Estructura Esperada en DB

```sql
-- agencies table
CREATE TABLE agencies (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,  -- ⭐ ESTE CAMPO
  phones TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  agency_id UUID,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  name TEXT,  -- ⭐ ESTE CAMPO
  provider auth_provider DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## ✅ Checklist de Implementación

- [x] Hook `useSettings` creado
- [x] Página Settings actualizada con permisos por rol
- [x] Validaciones de formulario implementadas
- [x] Toast notifications para feedback
- [x] Loading states y optimistic UI
- [x] Migración de Storage bucket creada
- [x] RLS policies existentes son correctas
- [ ] **PENDIENTE: Aplicar migración de Storage** (correr: `supabase db push`)
- [ ] **PENDIENTE: Test manual en localhost**
- [ ] **PENDIENTE: Test manual en producción**
