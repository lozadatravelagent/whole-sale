# 🔑 Generar API Key de Producción para www.maxevagestion.com

Esta guía te muestra cómo generar una API key de producción para consumir el sistema de búsquedas desde `www.maxevagestion.com`.

---

## 📋 Pre-requisitos

1. ✅ Acceso al Dashboard de Supabase: https://app.supabase.com/project/ujigyazketblwlzcomve
2. ✅ Rol de **OWNER** o **SUPERADMIN** en el sistema
3. ✅ Conocer tu email de usuario registrado

---

## 🚀 PASO 1: Generar la API Key

### Opción A: SQL Editor (Recomendado)

1. **Abrí el SQL Editor de Supabase:**
   ```
   https://app.supabase.com/project/ujigyazketblwlzcomve/sql
   ```

2. **Abrí el archivo:**
   ```
   scripts/generate-production-api-key.sql
   ```

3. **Modificá la línea 17:**
   ```sql
   v_user_email TEXT := 'tu-email@ejemplo.com'; -- 🔴 CAMBIAR ESTO POR TU EMAIL
   ```

   Reemplazá con tu email real (el que usás para login).

4. **Copiá todo el contenido del archivo y pegalo en SQL Editor**

5. **Presioná "Run"** (o `Ctrl+Enter`)

6. **⚠️ IMPORTANTE: Guardá la API key que aparece en los logs**

   Verás algo como:
   ```
   🔑 API KEY (guardala AHORA, no se mostrará nuevamente):
   wsk_prod_AbCd1234EfGh5678IjKl9012MnOp3456QrSt
   ```

   **Esta API key se muestra UNA SOLA VEZ.** Guardala inmediatamente en:
   - Variables de entorno de producción
   - Secrets manager (Railway, Vercel, etc.)
   - Password manager (1Password, LastPass, etc.)

---

### Opción B: Función SQL Manual

Si preferís hacerlo paso a paso:

```sql
-- 1. Obtener tu tenant_id
SELECT id, email, tenant_id, role
FROM users
WHERE email = 'tu-email@ejemplo.com';

-- 2. Generar la API key (reemplazá <TENANT_ID> con el UUID del paso anterior)
SELECT * FROM generate_api_key(
  p_tenant_id := '<TENANT_ID>',
  p_name := 'Producción - www.maxevagestion.com',
  p_environment := 'production',
  p_scopes := ARRAY['search:*'],
  p_rate_limit_per_minute := 100,
  p_rate_limit_per_hour := 1000,
  p_rate_limit_per_day := 10000
);

-- 3. Configurar allowed_origins (reemplazá <API_KEY_ID> con el ID devuelto arriba)
UPDATE api_keys
SET metadata = jsonb_build_object(
  'allowed_origins', ARRAY[
    'https://www.maxevagestion.com',
    'https://maxevagestion.com'
  ],
  'description', 'API key de producción para sistema de chat'
)
WHERE id = '<API_KEY_ID>';
```

---

## 🌐 PASO 2: Configurar Variables de Entorno

Agregá estas variables en tu plataforma de deploy (Railway, Vercel, etc.):

### Variables Requeridas

```bash
# API Key generada en el paso anterior
EMILIA_API_KEY=wsk_prod_AbCd1234EfGh5678IjKl9012MnOp3456QrSt

# URL del endpoint (elegí una)
# Opción 1: Via Cloudflare proxy (recomendado)
EMILIA_API_URL=https://api.vibook.ai/search

# Opción 2: Directo a Supabase Edge Function
EMILIA_API_URL=https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search
```

### En Railway

1. Andá al proyecto en Railway Dashboard
2. Click en "Variables"
3. Agregá las variables:
   ```
   EMILIA_API_KEY=wsk_prod_...
   EMILIA_API_URL=https://api.vibook.ai/search
   ```
4. Click "Deploy" para aplicar cambios

### En Vercel

```bash
# Via CLI
vercel env add EMILIA_API_KEY production
# (pegá la API key cuando te lo pida)

vercel env add EMILIA_API_URL production
# (pegá: https://api.vibook.ai/search)

# Redeploy
vercel --prod
```

---

## ✅ PASO 3: Verificar que Funciona

### Opción A: PowerShell Script (Windows)

```powershell
# Ejecutá en PowerShell
.\scripts\test-production-api-key.ps1 -ApiKey "wsk_prod_TuApiKeyAqui"
```

### Opción B: cURL Manual

```bash
# Test 1: Supabase directo
curl -X POST https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_TuApiKeyAqui" \
  -d '{
    "request_id": "test_001",
    "prompt": "vuelo a miami del 10 al 20 de enero"
  }'

# Test 2: Cloudflare proxy
curl -X POST https://api.vibook.ai/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_TuApiKeyAqui" \
  -H "User-Agent: Test-Client/1.0 (https://www.maxevagestion.com)" \
  -H "Origin: https://www.maxevagestion.com" \
  -d '{
    "request_id": "test_002",
    "prompt": "vuelo a madrid"
  }'
```

### Resultados Esperados

✅ **Status 200**: Búsqueda completada exitosamente
✅ **Status 422**: Falta información (normal, la búsqueda necesita más datos)

❌ **Status 401**: API key inválida o expirada
❌ **Status 403**: 
  - Sin permisos (verificar scopes y allowed_origins)
  - **Cloudflare Bot Management bloqueando** (ver `docs/guides/CLOUDFLARE_BOT_MANAGEMENT_FIX.md`)
  - **Solución**: Agregar header `User-Agent` en las peticiones
❌ **Status 429**: Rate limit excedido

---

## 📊 PASO 4: Monitorear Uso

### Ver estadísticas de la API key

```sql
-- En Supabase SQL Editor
SELECT
  key_prefix,
  name,
  environment,
  scopes,
  usage_count,
  last_used_at,
  rate_limit_per_hour,
  is_active,
  created_at
FROM api_keys
WHERE environment = 'production'
ORDER BY created_at DESC;
```

### Ver logs de requests

1. Andá a: https://app.supabase.com/project/ujigyazketblwlzcomve/functions/api-search/logs
2. Filtrá por tu API key prefix (ej: `wsk_prod_AbCd1234`)

---

## 🔄 Rotación de API Key

Si necesitás cambiar la API key (por seguridad o compromiso):

```sql
-- Opción 1: Rotar automáticamente (revoca la vieja y genera una nueva)
SELECT * FROM rotate_api_key('<API_KEY_ID>');

-- Opción 2: Revocar manualmente
SELECT revoke_api_key('<API_KEY_ID>');

-- Luego generá una nueva con el script del PASO 1
```

---

## 🚨 Troubleshooting

### Error 403: Forbidden

**Causa**: API key sin permisos o allowed_origins mal configurado

**Solución**:
```sql
-- Verificar scopes
SELECT scopes, metadata
FROM api_keys
WHERE key_prefix LIKE 'wsk_prod_%';

-- Actualizar scopes si es necesario
UPDATE api_keys
SET scopes = ARRAY['search:*']
WHERE key_prefix = 'wsk_prod_AbCd1234';

-- Verificar allowed_origins
SELECT metadata->'allowed_origins'
FROM api_keys
WHERE key_prefix LIKE 'wsk_prod_%';
```

### Error 429: Too Many Requests

**Causa**: Rate limit excedido

**Solución**:
```sql
-- Aumentar límites
UPDATE api_keys
SET
  rate_limit_per_minute = 200,
  rate_limit_per_hour = 2000,
  rate_limit_per_day = 20000
WHERE key_prefix = 'wsk_prod_AbCd1234';
```

### API key no funciona en producción pero sí en local

**Causa**: Cloudflare WAF bloqueando por dominio

**Solución**:
1. Verificá Cloudflare Dashboard → WAF
2. Whitelist `www.maxevagestion.com`
3. Verificá que metadata tenga `allowed_origins` correcto

---

## 📚 Documentación Adicional

- **Sistema de API Keys**: `supabase/migrations/20251208000001_create_api_keys_table.sql`
- **Generador de Keys**: `supabase/migrations/20251213000001_create_api_key_generator.sql`
- **Auth Helper**: `supabase/functions/_shared/apiKeyAuth.ts`
- **API Search Endpoint**: `supabase/functions/api-search/index.ts`

---

## 🆘 Ayuda

Si seguís teniendo problemas:

1. Verificá los logs de Supabase Edge Function
2. Verificá las variables de entorno en tu plataforma de deploy
3. Probá con cURL directo (sin tu app) para aislar el problema
4. Revisá la configuración de CORS/WAF en Cloudflare

---

**¡Listo! 🎉 Tu API key de producción está configurada y lista para usar.**
