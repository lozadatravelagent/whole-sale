# Fase 1: Variables de Entorno Redis

## Variables Requeridas en Supabase Edge Functions

Para activar la integración con Redis en la Fase 1, necesitas configurar las siguientes variables de entorno en el **Supabase Dashboard** → **Edge Functions** → **Environment Variables**:

### Redis Upstash (Obligatorio)

```bash
# URL REST de Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx-xxxxx.upstash.io

# Token de autenticación Upstash Redis
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Feature Flags (Obligatorio)

```bash
# Activar rate limiting basado en Redis (reemplaza 3 queries COUNT a PostgreSQL)
USE_REDIS_RATE_LIMIT=true

# Activar cache de idempotencia basado en Redis (TTL 5 minutos)
USE_REDIS_IDEMPOTENCY=true
```

---

## Cómo Obtener Credenciales de Upstash Redis

1. **Crear cuenta en Upstash** (gratis)
   - Visita: https://upstash.com
   - Crea una cuenta gratuita (10,000 requests/día)

2. **Crear base de datos Redis**
   - Dashboard → Create Database
   - **Region**: Selecciona la región más cercana a Railway (ej: US East)
   - **Type**: Regional (global solo si necesitas multi-región)
   - **Plan**: Free tier es suficiente para Fase 1

3. **Obtener credenciales REST**
   - Ve a tu database → REST API tab
   - Copia:
     - `UPSTASH_REDIS_REST_URL`
     - `UPSTASH_REDIS_REST_TOKEN`

---

## Configurar en Supabase

### Opción A: Via Dashboard (Recomendado)

1. Ve a: https://app.supabase.com/project/ujigyazketblwlzcomve/functions
2. Click en `api-search` Edge Function
3. Secrets tab → Add new secret
4. Agrega las 4 variables (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, USE_REDIS_RATE_LIMIT, USE_REDIS_IDEMPOTENCY)

### Opción B: Via CLI

```bash
# Setear variables de entorno para Edge Functions
supabase secrets set UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
supabase secrets set UPSTASH_REDIS_REST_TOKEN="AXxxx..."
supabase secrets set USE_REDIS_RATE_LIMIT="true"
supabase secrets set USE_REDIS_IDEMPOTENCY="true"

# Verificar
supabase secrets list
```

---

## Testing

### Verificar que Redis está funcionando

```bash
# Test con feature flags desactivados (usa PostgreSQL)
curl -X POST 'https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search' \
  -H 'X-API-Key: your_api_key' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_test_001", "prompt": "vuelo a miami"}'

# Revisar logs → debe mostrar: "Checking rate limit (Redis: false)"
```

### Activar Redis y verificar

1. Setear `USE_REDIS_RATE_LIMIT=true` y `USE_REDIS_IDEMPOTENCY=true`
2. Re-desplegar Edge Function (si es necesario)
3. Ejecutar mismo curl
4. Revisar logs → debe mostrar: "Checking rate limit (Redis: true)"

### Verificar latencia mejorada

**Antes (PostgreSQL)**:
- Rate limit check: ~100-200ms (3 queries COUNT)

**Después (Redis)**:
- Rate limit check: ~20-40ms (1 pipeline INCR+EXPIRE)

**Ganancia esperada**: ~80-150ms por request

---

## Rollback (si algo falla)

Si experimentas problemas con Redis:

```bash
# Desactivar feature flags (vuelve a PostgreSQL)
supabase secrets set USE_REDIS_RATE_LIMIT="false"
supabase secrets set USE_REDIS_IDEMPOTENCY="false"
```

La aplicación continuará funcionando con PostgreSQL sin interrupciones.

---

## Monitoreo

### Logs en Supabase Dashboard

Busca estos mensajes en los logs de `api-search`:

```json
{
  "level": "INFO",
  "type": "RATE_LIMIT_CHECK",
  "message": "Checking rate limit (Redis: true)",
  "correlation_id": "uuid..."
}

{
  "level": "INFO",
  "type": "CACHE_HIT",
  "message": "Returning cached response for request_id: req_123",
  "correlation_id": "uuid...",
  "metadata": {
    "cached_at": "2025-12-15T10:30:00Z"
  }
}
```

### Metrics en Upstash Dashboard

- **Commands/sec**: Monitorea throughput
- **Latency P99**: Debe ser < 50ms para requests desde misma región
- **Hit rate**: ~70-80% para requests con mismo request_id (retry scenarios)

---

## Costos Estimados

### Upstash Free Tier
- **Límite**: 10,000 requests/día
- **Storage**: 256 MB
- **Costo**: $0/mes

### Para Escalar
Si superas free tier:
- **Pay-as-you-go**: $0.20 per 100K requests
- **Pro ($120/año)**: 1M requests/día

**Recomendación**: Free tier es suficiente para Fase 1 y primeros clientes. Migra a Pro cuando superes 5-10 clientes activos.
