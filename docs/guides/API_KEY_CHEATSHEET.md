# 🔑 API Key Cheatsheet - WholeSale Connect AI

> **Comandos rápidos para gestión de API keys en producción**

---

## 🚀 Quick Start

### 1. Aplicar Migraciones

```bash
cd supabase
supabase db push
```

### 2. Generar Primera API Key

```sql
-- Ejecutar en Supabase SQL Editor
SELECT * FROM generate_api_key(
  p_tenant_id := '<TENANT_UUID>',
  p_name := 'Producción - Cliente XYZ',
  p_environment := 'production',
  p_scopes := ARRAY['search:*']
);
```

**⚠️ COPIAR LA KEY INMEDIATAMENTE - NO SE VOLVERÁ A MOSTRAR**

### 3. Test con curl

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/api-search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <TU_API_KEY>" \
  -d '{
    "request_id": "test_001",
    "prompt": "vuelo a miami del 15 al 22 de enero, 2 adultos"
  }'
```

---

## 📋 Comandos Frecuentes

### Generar API Key

```sql
-- Producción (alta capacidad)
SELECT * FROM generate_api_key(
  p_tenant_id := '<TENANT_UUID>',
  p_name := 'Cliente XYZ - Producción',
  p_environment := 'production',
  p_scopes := ARRAY['search:*'],
  p_rate_limit_per_minute := 200,
  p_rate_limit_per_hour := 5000,
  p_rate_limit_per_day := 50000
);

-- Desarrollo
SELECT * FROM generate_api_key(
  p_tenant_id := '<TENANT_UUID>',
  p_name := 'Testing Interno',
  p_environment := 'development',
  p_scopes := ARRAY['search:*'],
  p_rate_limit_per_minute := 50,
  p_rate_limit_per_hour := 500,
  p_rate_limit_per_day := 2000,
  p_expires_at := NOW() + INTERVAL '30 days'
);
```

### Listar API Keys

```sql
-- Ver todas las keys de un tenant
SELECT * FROM list_api_keys('<TENANT_UUID>');

-- Ver solo keys activas
SELECT key_prefix, name, environment, last_used_at, usage_count
FROM api_keys
WHERE tenant_id = '<TENANT_UUID>' AND is_active = true
ORDER BY created_at DESC;
```

### Revocar API Key

```sql
-- Revocar por ID
SELECT revoke_api_key('<API_KEY_UUID>');

-- Revocar por prefijo (búsqueda manual)
UPDATE api_keys SET is_active = false
WHERE key_prefix = 'wsk_prod_abc12345';
```

### Rotar API Key

```sql
-- Rotar (genera nueva, revoca anterior)
SELECT * FROM rotate_api_key('<OLD_API_KEY_UUID>');
```

### Ver Uso de una Key

```sql
SELECT
  key_prefix,
  name,
  usage_count,
  last_used_at,
  created_at,
  ROUND(usage_count / EXTRACT(EPOCH FROM (NOW() - created_at)) * 86400, 2) AS avg_requests_per_day
FROM api_keys
WHERE id = '<API_KEY_UUID>';
```

---

## 🔍 Monitoreo

### Keys más usadas (últimos 7 días)

```sql
SELECT
  key_prefix,
  name,
  environment,
  usage_count,
  last_used_at,
  rate_limit_per_day
FROM api_keys
WHERE last_used_at > NOW() - INTERVAL '7 days'
ORDER BY usage_count DESC
LIMIT 10;
```

### Keys inactivas (>30 días)

```sql
SELECT
  key_prefix,
  name,
  created_at,
  last_used_at,
  is_active
FROM api_keys
WHERE
  is_active = true
  AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '30 days')
ORDER BY created_at DESC;
```

### Cache Hit Rate (idempotencia)

```sql
SELECT
  COUNT(*) AS total_cached_requests,
  COUNT(DISTINCT request_id) AS unique_requests,
  ROUND(100.0 * (COUNT(*) - COUNT(DISTINCT request_id)) / NULLIF(COUNT(*), 0), 2) AS cache_hit_rate_pct
FROM api_request_cache
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Uso por Tenant

```sql
SELECT
  t.name AS tenant_name,
  COUNT(k.id) AS total_keys,
  SUM(k.usage_count) AS total_requests,
  MAX(k.last_used_at) AS last_activity
FROM api_keys k
JOIN tenants t ON t.id = k.tenant_id
GROUP BY t.id, t.name
ORDER BY total_requests DESC;
```

---

## 🔐 Scopes Disponibles

| Scope              | Uso                                |
|--------------------|------------------------------------|
| `search:*`         | Acceso a TODAS las búsquedas       |
| `search:flights`   | Solo vuelos                        |
| `search:hotels`    | Solo hoteles                       |
| `search:combined`  | Vuelo + hotel                      |
| `search:packages`  | Paquetes                           |
| `search:services`  | Servicios (transfers, tours, etc.) |

---

## 🚨 Rate Limits Recomendados

| Tipo Cliente      | /min | /hora | /día   |
|-------------------|------|-------|--------|
| Producción Alta   | 200  | 5000  | 50000  |
| Producción Media  | 100  | 1000  | 10000  |
| Desarrollo        | 50   | 500   | 2000   |
| Interno/Staff     | 500  | 10000 | 100000 |

---

## 🧪 Testing

### Script de testing completo

```bash
# Hacer ejecutable
chmod +x scripts/test-api-key.sh

# Ejecutar
./scripts/test-api-key.sh <API_KEY> <PROJECT_REF>
```

### Test manual rápido

```bash
# Test 1: Auth OK
curl -X POST https://<PROJECT>.supabase.co/functions/v1/api-search \
  -H "X-API-Key: <KEY>" \
  -d '{"request_id": "test_001", "prompt": "vuelo a miami"}'

# Test 2: Invalid key (debe dar 401)
curl -X POST https://<PROJECT>.supabase.co/functions/v1/api-search \
  -H "X-API-Key: wsk_prod_INVALID" \
  -d '{"request_id": "test_002", "prompt": "vuelo a miami"}'

# Test 3: Idempotencia (mismo request_id debe dar is_retry=true)
curl -X POST https://<PROJECT>.supabase.co/functions/v1/api-search \
  -H "X-API-Key: <KEY>" \
  -d '{"request_id": "test_001", "prompt": "vuelo a miami"}'
```

---

## 🛠️ Troubleshooting

### Error 401: INVALID_API_KEY

```sql
-- Verificar que la key existe y está activa
SELECT key_prefix, is_active, expires_at
FROM api_keys
WHERE key_hash = encode(sha256('<API_KEY_COMPLETA>'::bytea), 'hex');
```

### Error 429: Rate Limit Exceeded

```sql
-- Ver límites de la key
SELECT key_prefix, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day
FROM api_keys
WHERE id = '<KEY_UUID>';

-- Aumentar límites
UPDATE api_keys
SET
  rate_limit_per_minute = 200,
  rate_limit_per_hour = 5000
WHERE id = '<KEY_UUID>';
```

### Key no registra last_used_at

```sql
-- Verificar función updateUsageStats está siendo llamada
-- Ver logs en Supabase Dashboard → Edge Functions → api-search
```

---

## 📚 Documentación Completa

- **Guía completa**: `/docs/guides/API_THIRD_PARTY_INTEGRATION_GUIDE.md`
- **Migraciones**: `/supabase/migrations/README_API_MIGRATIONS.md`
- **Edge Function**: `/supabase/functions/api-search/index.ts`

---

## 🔄 Ciclo de Vida de una Key

```
1. CREAR
   ↓ generate_api_key()

2. USAR
   ↓ api-search valida y actualiza usage_count

3. MONITOREAR
   ↓ list_api_keys(), revisar usage_count

4. ROTAR (cada 90 días)
   ↓ rotate_api_key()

5. REVOCAR (si es comprometida)
   ↓ revoke_api_key()
```

---

## ✅ Checklist Pre-Producción

- [ ] Migraciones aplicadas (`supabase db push`)
- [ ] Función `generate_api_key()` funciona
- [ ] Edge Function `api-search` deployada
- [ ] Test de autenticación OK
- [ ] Test de rate limiting OK
- [ ] Test de idempotencia OK
- [ ] RLS policies activas
- [ ] Logs configurados en Supabase
- [ ] Alertas de uso anormal configuradas
