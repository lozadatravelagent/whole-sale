# Actualizar Cloudflare Worker para Railway Fastify API

## Cambio: De Supabase Edge Functions → Railway Fastify API Gateway

Ya tienes un worker llamado `vibook-api-proxy` que actualmente apunta a Supabase.
Vamos a actualizarlo para que apunte al nuevo Fastify API Gateway en Railway.

---

## Pasos de Actualización

### Paso 1: Abrir el Worker

1. Ve a **Cloudflare Dashboard**: https://dash.cloudflare.com
2. Selecciona tu dominio **vibook.ai**
3. En el menú lateral: **Workers & Pages**
4. Click en tu worker existente: **`vibook-api-proxy`**
5. Click **Quick Edit**

### Paso 2: Reemplazar el Código

1. **Selecciona TODO el código** actual (Ctrl+A o Cmd+A)
2. **Borra** el código actual
3. Abre el archivo: `cloudflare-worker-railway-only.js`
4. **Copia TODO el contenido** del archivo
5. **Pega** en el editor de Cloudflare
6. Click **Save and Deploy**

### Paso 3: Verificar Configuración

Asegúrate de que tu worker tiene el custom domain configurado:

1. En el worker → **Settings** → **Triggers** → **Custom Domains**
2. Debe aparecer: **`api.vibook.ai`**
3. Si no está, agrégalo:
   - Click **Add Custom Domain**
   - Ingresa: `api.vibook.ai`
   - Click **Add Custom Domain**

---

## Cambios Clave

### Antes (Supabase)
```javascript
const SUPABASE_URL = 'https://ujigyazketblwlzcomve.supabase.co/functions/v1';
// Proxy a Supabase Edge Functions
```

### Después (Railway Fastify)
```javascript
const RAILWAY_URL = 'https://whole-sale-production.up.railway.app';
// Proxy a Railway Fastify API Gateway
```

### Mapeo de Rutas Actualizado

| URL Cliente | Worker Transforma | Destino Final |
|-------------|-------------------|---------------|
| `api.vibook.ai/search` | → `/v1/search` | Railway Fastify |
| `api.vibook.ai/v1/search` | → `/v1/search` | Railway Fastify |
| `api.vibook.ai/v1/health` | → `/v1/health` | Railway Fastify |
| `api.vibook.ai/health` | → Health del Worker | Cloudflare Worker |

---

## Testing Completo

Una vez actualizado, ejecuta estos tests:

```bash
# 1. Health check del Worker (Cloudflare)
curl https://api.vibook.ai/health

# Esperado:
{
  "status": "ok",
  "worker": "vibook-api-proxy",
  "version": "2.0.0",
  "backend": "Railway Fastify API Gateway"
}

# 2. Health check de Fastify (Railway)
curl https://api.vibook.ai/v1/health

# Esperado:
{
  "status": "ok",
  "timestamp": "2025-12-15T...",
  "uptime": 123.45,
  "version": "1.0.0"
}

# 3. Health check detallado (Redis + Supabase)
curl https://api.vibook.ai/v1/health/detailed

# Esperado:
{
  "status": "ok",
  "checks": {
    "redis": true,
    "supabase": true
  }
}

# 4. Endpoint de búsqueda (ruta legacy /search)
curl -X POST https://api.vibook.ai/search \
  -H 'X-API-Key: wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_worker_test_001", "prompt": "vuelo a miami"}'

# Esperado: Response con placeholder de Fastify
# Headers: X-Gateway: railway-fastify, X-Proxy-Source: cloudflare-worker

# 5. Endpoint de búsqueda (ruta v1)
curl -X POST https://api.vibook.ai/v1/search \
  -H 'X-API-Key: wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_worker_v1_test_001", "prompt": "vuelo a madrid"}'

# Esperado: Response con placeholder de Fastify
# Headers: X-Gateway: railway-fastify

# 6. Verificar CORS
curl -X OPTIONS https://api.vibook.ai/v1/search \
  -H 'Origin: https://app.vibook.ai' \
  -H 'Access-Control-Request-Method: POST' \
  -i

# Esperado: Headers CORS apropiados
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS

# 7. Verificar Rate Limiting
curl -X POST https://api.vibook.ai/v1/search \
  -H 'X-API-Key: wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_rate_001", "prompt": "test"}' \
  -v 2>&1 | grep -i "ratelimit"

# Esperado:
# X-Ratelimit-Limit: 100
# X-Ratelimit-Remaining: 99
# X-Ratelimit-Reset: ...
# X-Ratelimit-Window: minute

# 8. Verificar Idempotencia (retry con mismo request_id)
curl -X POST https://api.vibook.ai/v1/search \
  -H 'X-API-Key: wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_rate_001", "prompt": "RETRY"}' \
  -s | grep "is_retry"

# Esperado:
# "is_retry": true
# "cached_at": "2025-12-15T..."
```

---

## Ventajas del Nuevo Setup

### ✅ Performance
- **Rate Limiting**: PostgreSQL 3 queries (~100-200ms) → Redis pipeline (~20-40ms)
- **Idempotency**: ~20-30s nueva búsqueda → <1s cached retry
- **Menos Latencia**: Railway Fastify es más rápido que Edge Functions

### ✅ Features
- **Correlation IDs**: Trazabilidad end-to-end
- **Structured Logging**: JSON logs con Pino
- **Health Checks**: Verifica Redis + Supabase
- **Better Error Handling**: Mensajes de error detallados

### ✅ Escalabilidad
- **Railway Autoscaling**: Maneja picos de tráfico
- **Redis Caching**: Reduce carga en base de datos
- **Cloudflare CDN**: Cache global

### ✅ Flexibilidad
- **Middleware Chain**: Fácil agregar nuevos middlewares
- **TypeScript**: Type safety en todo el código
- **Docker**: Deploy independiente del código principal

---

## Headers Informativos

Cada response incluirá estos headers para debugging:

```
X-Correlation-ID: uuid              # Tracking de request
X-Gateway: railway-fastify          # Backend usado
X-Proxy-Source: cloudflare-worker   # Proxy usado
X-Ratelimit-Limit: 100              # Rate limit
X-Ratelimit-Remaining: 98           # Requests restantes
X-Ratelimit-Reset: 1765823940       # Timestamp de reset
X-Ratelimit-Window: minute          # Window actual
```

---

## Troubleshooting

### Error: "Gateway Error"

**Causa**: Worker no puede conectar con Railway

**Solución**:
1. Verifica que Railway esté activo: https://whole-sale-production.up.railway.app/v1/health
2. Revisa logs del Worker: Worker Dashboard → Logs → Real-time logs
3. Verifica que `RAILWAY_URL` esté correcto en el código

### Error: "Invalid API Key"

**Causa**: API key no válida o expirada

**Solución**:
1. Verifica que el header `X-API-Key` esté presente
2. Verifica que la API key sea válida en Supabase
3. Revisa que Supabase esté conectado (health/detailed)

### Error: Rate Limit headers no aparecen

**Causa**: Railway no está agregando los headers

**Solución**:
1. Verifica con `-v` en curl para ver todos los headers
2. Los headers son case-insensitive (`X-Ratelimit` vs `X-RateLimit`)
3. Usa `grep -i` para buscar sin case-sensitivity

---

## Monitoreo

### Cloudflare Analytics

Ve a **Cloudflare Dashboard** → **Analytics & Logs** → **Workers**

Métricas disponibles:
- Requests por segundo
- Errores 5xx
- Latencia p50/p95/p99
- CPU time usado
- Países de origen

### Railway Metrics

Ve a **Railway Dashboard** → **Metrics**

Métricas disponibles:
- CPU usage
- Memory usage
- Network I/O
- Request count
- Error rate

### Logs en Tiempo Real

**Cloudflare Worker Logs:**
```bash
# En Cloudflare Dashboard → Workers → vibook-api-proxy → Logs
# Verás los console.log del worker en tiempo real
```

**Railway Fastify Logs:**
```bash
# En Railway Dashboard → Deployments → View logs
# Verás los logs de Pino en formato JSON
```

---

## Rollback (Si es Necesario)

Si necesitas volver al código anterior:

1. Worker Dashboard → **Deployments** → **Rollback**
2. Selecciona el deployment anterior
3. Click **Rollback to this deployment**

O simplemente vuelve a pegar el código anterior y deploy.

---

## Next Steps

Una vez verificado que todo funciona:

1. ✅ **Actualizar documentación de API** para clientes
2. ✅ **Configurar alertas** en Cloudflare y Railway
3. 🔄 **Implementar búsqueda completa** en Fastify (portar de Edge Functions)
4. 🔄 **Agregar Circuit Breakers** (Fase 3)
5. 🔄 **Agregar OpenTelemetry** (Fase 3)

---

## Arquitectura Final

```
┌─────────────────────────────────────────────────────┐
│              EXTERNAL CLIENTS                       │
│        (Apps, Integrations)                         │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│         CLOUDFLARE WORKER (api.vibook.ai)           │
│         vibook-api-proxy v2.0.0                     │
│                                                     │
│  Routes:                                            │
│  • /search        → /v1/search (Railway)           │
│  • /v1/search     → /v1/search (Railway)           │
│  • /v1/health     → /v1/health (Railway)           │
│  • /health        → Worker health check            │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│       RAILWAY FASTIFY API GATEWAY                   │
│       whole-sale-production.up.railway.app          │
│                                                     │
│  Middleware Chain:                                  │
│  CORS → Correlation → Auth → RateLimit → Execute   │
│                                                     │
│  Features:                                          │
│  • Redis rate limiting (sliding window)            │
│  • Redis idempotency cache (5min TTL)              │
│  • Structured JSON logging (Pino)                  │
│  • API key authentication (Supabase)               │
│  • Health checks (Redis + Supabase)                │
└────────────────┬────────────────┬───────────────────┘
                 │                │
                 ▼                ▼
        ┌────────────┐   ┌───────────────┐
        │   REDIS    │   │   SUPABASE    │
        │  (Upstash) │   │ (PostgreSQL)  │
        └────────────┘   └───────────────┘
```

---

## URLs Finales

| Endpoint | URL | Descripción |
|----------|-----|-------------|
| **Worker Health** | `https://api.vibook.ai/health` | Health del Worker (Cloudflare) |
| **API Health** | `https://api.vibook.ai/v1/health` | Health de Fastify (Railway) |
| **API Detailed Health** | `https://api.vibook.ai/v1/health/detailed` | Health de Redis + Supabase |
| **Search (Legacy)** | `https://api.vibook.ai/search` | Endpoint de búsqueda (auto redirige a /v1/search) |
| **Search (V1)** | `https://api.vibook.ai/v1/search` | Endpoint de búsqueda (recomendado) |

Todas las URLs usan **HTTPS** con certificado de Cloudflare y protección DDoS.
