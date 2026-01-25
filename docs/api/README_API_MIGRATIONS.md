# Migraciones de API para Chat de Terceros

## Archivos de Migración

### 1. `20251208000001_create_api_keys_table.sql`
Crea la tabla `api_keys` para gestionar API keys de terceros.

**Campos principales**:
- `key_prefix`: Primeros 8 chars (ej: `wsk_prod_abc123...`)
- `key_hash`: SHA-256 hash de la key completa
- `tenant_id`, `agency_id`: Ownership
- `scopes`: Array de permisos (`search:flights`, `search:hotels`, `search:*`)
- `rate_limit_per_minute/hour/day`: Límites configurables
- `is_active`, `expires_at`: Lifecycle management
- `usage_count`, `last_used_at`: Audit trail

**Políticas RLS**:
- Solo OWNER y SUPERADMIN pueden ver/gestionar keys
- Solo OWNER puede eliminar keys

### 2. `20251208000002_create_api_request_cache_table.sql`
Crea la tabla `api_request_cache` para idempotencia con TTL 5 minutos.

**Características**:
- TTL automático: 5 minutos desde `created_at`
- Función `cleanup_expired_request_cache()` para limpieza
- Auto-schedule con pg_cron (si está disponible)
- RLS: Solo accesible por service_role (Edge Functions)

### 3. `20251213000001_create_api_key_generator.sql`
Crea funciones SQL para generar, revocar y rotar API keys de forma segura.

**Funciones incluidas**:
- `generate_random_string(length)`: Genera strings aleatorios seguros
- `hash_api_key(api_key)`: Hash SHA-256 de API keys
- `generate_api_key(...)`: Genera una nueva API key y devuelve el token UNA SOLA VEZ
- `revoke_api_key(key_id)`: Revoca (desactiva) una API key
- `rotate_api_key(old_key_id)`: Rota una API key (revoca anterior, genera nueva)
- `list_api_keys(tenant_id)`: Lista API keys de un tenant (sin mostrar tokens)

**Características de seguridad**:
- Formato de key: `wsk_<env>_<random40chars>`
- Solo devuelve el token completo UNA VEZ al generarlo
- Base de datos solo almacena el hash SHA-256
- Prefijo identificable (`wsk_prod_`, `wsk_dev_`, `wsk_stg_`)

---

## Cómo Aplicar las Migraciones

### Opción 1: Supabase CLI (Recomendado)

```bash
# 1. Verificar que estás en el directorio correcto
cd C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai

# 2. Aplicar migraciones
supabase db push

# 3. Verificar que se aplicaron correctamente
supabase db diff
```

### Opción 2: Supabase Dashboard

1. Ve a tu proyecto en https://app.supabase.com
2. Navega a **Database** → **Migrations**
3. Copia y pega el contenido de cada archivo SQL
4. Ejecuta en orden:
   - Primero: `20251208000001_create_api_keys_table.sql`
   - Segundo: `20251208000002_create_api_request_cache_table.sql`

### Opción 3: SQL Editor

1. Abre **SQL Editor** en Supabase Dashboard
2. Crea un nuevo snippet
3. Copia y pega el contenido de cada migración
4. Ejecuta (Run)

---

## Verificación Post-Migración

### 1. Verificar tablas creadas

```sql
-- Verificar que las tablas existen
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('api_keys', 'api_request_cache');
```

**Resultado esperado**: 2 filas (api_keys, api_request_cache)

### 2. Verificar estructura de api_keys

```sql
-- Verificar columnas de api_keys
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;
```

**Resultado esperado**: 16 columnas (id, key_prefix, key_hash, tenant_id, agency_id, created_by, scopes, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day, name, environment, is_active, expires_at, created_at, last_used_at, usage_count, metadata)

### 3. Verificar índices

```sql
-- Verificar índices de api_keys
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'api_keys';
```

**Resultado esperado**: 5 índices (hash, tenant, agency, active, expires)

### 4. Verificar políticas RLS

```sql
-- Verificar políticas RLS de api_keys
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'api_keys';
```

**Resultado esperado**: 4 políticas (SELECT, INSERT, UPDATE, DELETE)

### 5. Verificar función de cleanup

```sql
-- Verificar que la función existe
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'cleanup_expired_request_cache';
```

**Resultado esperado**: 1 fila con la función

### 6. Verificar job de cleanup (opcional)

```sql
-- Verificar si el job está programado (requiere pg_cron)
SELECT jobname, schedule, command
FROM cron.job
WHERE jobname = 'cleanup-api-request-cache';
```

**Nota**: Este query solo funciona si pg_cron está habilitado.

---

## Pruebas Básicas

### 1. Generar una API key usando la función SQL (RECOMENDADO)

```sql
-- Generar API key de desarrollo
SELECT * FROM generate_api_key(
  p_tenant_id := (SELECT id FROM tenants LIMIT 1),
  p_name := 'Test API Key - Development',
  p_environment := 'development',
  p_scopes := ARRAY['search:*'],
  p_rate_limit_per_minute := 50,
  p_rate_limit_per_hour := 500,
  p_rate_limit_per_day := 2000
);
```

**⚠️ IMPORTANTE**: Guarda el `api_key` retornado INMEDIATAMENTE. No se volverá a mostrar.

### 2. Listar API keys de un tenant

```sql
-- Listar todas las API keys de un tenant
SELECT * FROM list_api_keys((SELECT id FROM tenants LIMIT 1));
```

### 3. Insertar una API key de prueba (método manual - NO RECOMENDADO)

```sql
-- Insertar API key de prueba MANUALMENTE (solo para debugging)
INSERT INTO api_keys (
  key_prefix,
  key_hash,
  tenant_id,
  scopes,
  name,
  environment
) VALUES (
  'wsk_dev_',
  encode(sha256('test-key-12345678901234567890123456789012'::bytea), 'hex'),
  (SELECT id FROM tenants LIMIT 1),  -- Usar primer tenant
  ARRAY['search:*'],
  'Test API Key',
  'development'
)
RETURNING id, key_prefix, scopes, rate_limit_per_minute;
```

### 2. Insertar entrada de cache de prueba

```sql
-- Insertar cache de prueba
INSERT INTO api_request_cache (
  request_id,
  search_id,
  response_data,
  api_key_id
) VALUES (
  'req_test_12345',
  'srch_test_67890',
  '{"status": "completed", "test": true}'::jsonb,
  (SELECT id FROM api_keys LIMIT 1)  -- Usar primer API key
)
RETURNING request_id, search_id, expires_at;
```

### 3. Verificar que el cache expira correctamente

```sql
-- Verificar entradas de cache (antes de expirar)
SELECT request_id, search_id,
       expires_at > NOW() as is_valid,
       EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry
FROM api_request_cache;
```

### 4. Ejecutar cleanup manual

```sql
-- Ejecutar cleanup de entradas expiradas
SELECT cleanup_expired_request_cache();

-- Verificar que se eliminaron
SELECT COUNT(*) as expired_entries_remaining
FROM api_request_cache
WHERE expires_at < NOW();
```

**Resultado esperado**: 0 entradas expiradas restantes

### 5. Revocar una API key

```sql
-- Revocar API key por su ID
SELECT revoke_api_key('<API_KEY_UUID>');
```

### 6. Rotar una API key (generar nueva, revocar anterior)

```sql
-- Rotar API key (devuelve la nueva key UNA SOLA VEZ)
SELECT * FROM rotate_api_key('<OLD_API_KEY_UUID>');
```

**⚠️ IMPORTANTE**: La función devuelve la nueva API key. Guárdala inmediatamente.

---

## Rollback (si es necesario)

Si necesitas revertir las migraciones:

```sql
-- 1. Eliminar job de cleanup (si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-api-request-cache');
  END IF;
END;
$$;

-- 2. Eliminar funciones SQL (migration 3)
DROP FUNCTION IF EXISTS list_api_keys(UUID);
DROP FUNCTION IF EXISTS rotate_api_key(UUID);
DROP FUNCTION IF EXISTS revoke_api_key(UUID);
DROP FUNCTION IF EXISTS generate_api_key(UUID, UUID, UUID, TEXT, TEXT, TEXT[], INTEGER, INTEGER, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS hash_api_key(TEXT);
DROP FUNCTION IF EXISTS generate_random_string(INTEGER);

-- 3. Eliminar función de cleanup (migration 2)
DROP FUNCTION IF EXISTS cleanup_expired_request_cache();

-- 4. Eliminar tablas (en orden inverso)
DROP TABLE IF EXISTS api_request_cache;
DROP TABLE IF EXISTS api_keys;
```

---

## Próximos Pasos

Una vez aplicadas estas migraciones, continuar con:

1. **Fase 2**: Implementar Edge Functions
   - `api-auth/index.ts`
   - `api-search/index.ts`
   - Helpers en `_shared/`

2. **Fase 3**: Agregar metadata extendida en `searchHandlers.ts`

3. **Fase 4**: Documentar en OpenAPI spec

4. **Fase 5**: Crear UI Dashboard para gestión de API keys

---

## Notas Importantes

1. **pg_cron**: Si no está habilitado en tu proyecto de Supabase, el job de cleanup no se programará automáticamente. Deberás ejecutar `cleanup_expired_request_cache()` manualmente o vía cron externo.

2. **RLS Policies**: Las políticas están configuradas para que solo OWNER y SUPERADMIN gestionen API keys. Ajusta según tus necesidades.

3. **Rate Limits**: Los valores por defecto son:
   - 100 req/min
   - 1000 req/hour
   - 10000 req/day

   Puedes ajustarlos por API key según necesidades.

4. **Formato de API Keys**: El formato recomendado es `wsk_<env>_<random32chars>`:
   - Ejemplo: `wsk_prod_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
   - Solo se almacena el hash SHA-256 en la BD por seguridad
