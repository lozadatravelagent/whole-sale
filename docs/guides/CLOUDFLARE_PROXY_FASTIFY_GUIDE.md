# Cloudflare Proxy para Fastify API Gateway

Configurar dominio personalizado `vibook.ai` para el Fastify API Gateway en Railway usando Cloudflare.

## Arquitectura Actual

```
Cliente → https://api.vibook.ai/search → Cloudflare → Supabase Edge Functions
```

## Arquitectura Objetivo

### Opción A: Rutas Separadas (Recomendada)

```
Cliente → https://api.vibook.ai/search       → Cloudflare → Supabase Edge Functions
Cliente → https://api.vibook.ai/v1/search    → Cloudflare → Railway Fastify API
```

### Opción B: Subdominio Separado

```
Cliente → https://api.vibook.ai/search           → Cloudflare → Supabase Edge Functions
Cliente → https://gateway.vibook.ai/v1/search    → Cloudflare → Railway Fastify API
```

---

## Opción A: Configurar Rutas Separadas

### Paso 1: Crear Cloudflare Worker

1. Ve a **Cloudflare Dashboard** → **Workers & Pages**
2. Click **Create Application** → **Create Worker**
3. Nombre: `vibook-api-router`
4. Click **Deploy**

### Paso 2: Configurar Worker Script

Reemplaza el código del Worker con:

```javascript
/**
 * Cloudflare Worker: API Router
 *
 * Routes:
 * - /search → Supabase Edge Functions (legacy)
 * - /v1/* → Railway Fastify API (new)
 */

const SUPABASE_URL = 'https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search';
const RAILWAY_URL = 'https://whole-sale-production.up.railway.app';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check del worker
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'vibook-api-router',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Ruta /v1/* → Railway Fastify API
    if (url.pathname.startsWith('/v1/')) {
      return proxyToRailway(request, url);
    }

    // Ruta /search → Supabase Edge Functions (legacy)
    if (url.pathname === '/search') {
      return proxyToSupabase(request);
    }

    // 404 para rutas no reconocidas
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'Valid routes: /search (legacy), /v1/search (new), /v1/health'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Proxy request to Railway Fastify API
 */
async function proxyToRailway(request, url) {
  const targetUrl = new URL(url.pathname + url.search, RAILWAY_URL);

  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  const response = await fetch(modifiedRequest);

  // Add custom header to identify source
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-Proxy-Source', 'cloudflare-worker');
  newHeaders.set('X-Gateway', 'railway-fastify');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Proxy request to Supabase Edge Functions (legacy)
 */
async function proxyToSupabase(request) {
  const headers = new Headers(request.headers);

  // Add Supabase anon key if needed
  if (!headers.has('apikey')) {
    headers.set('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA');
  }
  if (!headers.has('Authorization')) {
    headers.set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA');
  }

  const modifiedRequest = new Request(SUPABASE_URL, {
    method: request.method,
    headers: headers,
    body: request.body,
  });

  const response = await fetch(modifiedRequest);

  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-Proxy-Source', 'cloudflare-worker');
  newHeaders.set('X-Gateway', 'supabase-edge-functions');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
```

### Paso 3: Deploy Worker

1. Click **Save and Deploy**
2. Espera unos segundos para que se despliegue

### Paso 4: Configurar Custom Domain

1. En el Worker → **Settings** → **Triggers** → **Custom Domains**
2. Click **Add Custom Domain**
3. Ingresa: `api.vibook.ai`
4. Click **Add Custom Domain**

Cloudflare automáticamente:
- Creará el registro DNS necesario
- Configurará SSL/TLS
- Enrutará el tráfico al Worker

### Paso 5: Verificar Configuración

```bash
# Health check del worker
curl https://api.vibook.ai/health

# Supabase Edge Functions (legacy)
curl https://api.vibook.ai/search \
  -X POST \
  -H 'X-API-Key: wsk_prod_xxx' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_test_legacy", "prompt": "test"}'

# Railway Fastify API (nuevo)
curl https://api.vibook.ai/v1/search \
  -X POST \
  -H 'X-API-Key: wsk_prod_xxx' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_test_v1", "prompt": "test"}'

# Health check de Fastify
curl https://api.vibook.ai/v1/health
```

---

## Opción B: Configurar Subdominio Separado

### Paso 1: Crear DNS Record

1. Ve a **Cloudflare Dashboard** → **DNS** → **Records**
2. Click **Add Record**
3. Configuración:
   - **Type**: CNAME
   - **Name**: `gateway` (quedará como `gateway.vibook.ai`)
   - **Target**: `whole-sale-production.up.railway.app`
   - **Proxy status**: ✅ Proxied (naranja)
   - **TTL**: Auto
4. Click **Save**

### Paso 2: Configurar Custom Domain en Railway

1. Ve a **Railway Dashboard** → Tu proyecto → **Settings**
2. Scroll hasta **Networking** → **Custom Domains**
3. Click **Add Custom Domain**
4. Ingresa: `gateway.vibook.ai`
5. Click **Add Domain**

Railway te dará instrucciones para verificar el dominio (ya configurado en Cloudflare).

### Paso 3: Configurar SSL/TLS en Cloudflare

1. **Cloudflare Dashboard** → **SSL/TLS**
2. Modo de encriptación: **Full (strict)**
3. Esto asegura HTTPS end-to-end

### Paso 4: Configurar Page Rules (Opcional)

Si quieres agregar seguridad extra:

1. **Cloudflare Dashboard** → **Rules** → **Page Rules**
2. Click **Create Page Rule**
3. URL: `gateway.vibook.ai/*`
4. Configuración:
   - **Security Level**: High
   - **Cache Level**: Bypass (para APIs)
   - **Browser Integrity Check**: On
5. Click **Save and Deploy**

### Paso 5: Verificar Configuración

```bash
# Health check
curl https://gateway.vibook.ai/v1/health

# Search endpoint
curl https://gateway.vibook.ai/v1/search \
  -X POST \
  -H 'X-API-Key: wsk_prod_xxx' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_test_gateway", "prompt": "test"}'
```

---

## Comparación de Opciones

| Característica | Opción A (Rutas) | Opción B (Subdominio) |
|----------------|------------------|----------------------|
| **URL Legacy** | `api.vibook.ai/search` | `api.vibook.ai/search` |
| **URL Nuevo** | `api.vibook.ai/v1/search` | `gateway.vibook.ai/v1/search` |
| **Cloudflare Worker** | ✅ Requerido | ❌ No necesario |
| **Complejidad** | Media (Worker routing) | Baja (DNS directo) |
| **Flexibilidad** | Alta (routing logic) | Media |
| **Costo Cloudflare** | Free tier suficiente | Free tier suficiente |
| **Latencia Extra** | ~1-2ms (Worker) | 0ms (DNS directo) |
| **Migración Gradual** | ✅ Fácil (path-based) | ❌ Difícil |
| **Rollback** | ✅ Inmediato (cambiar Worker) | ⏱️ Propaga DNS |

---

## Recomendación

**Opción A (Rutas Separadas)** es mejor porque:

1. ✅ **Backward Compatibility**: `/search` sigue funcionando para clientes existentes
2. ✅ **Versionado**: `/v1/search` deja espacio para `/v2/search` en el futuro
3. ✅ **Migración Gradual**: Puedes mover clientes uno por uno
4. ✅ **A/B Testing**: Fácil probar ambas versiones simultáneamente
5. ✅ **Rollback Rápido**: Cambias el Worker y todos los clientes vuelven a Supabase

---

## Configuración de Seguridad Adicional

### Cloudflare WAF (Web Application Firewall)

1. **Cloudflare Dashboard** → **Security** → **WAF**
2. Crear regla personalizada:

```
Field: Hostname
Operator: equals
Value: api.vibook.ai

AND

Field: Request Method
Operator: does not equal
Value: POST

THEN: Block
```

Esto solo permite POST requests a tu API.

### Rate Limiting en Cloudflare (Opcional)

Si quieres rate limiting adicional en Cloudflare además del de Redis:

1. **Cloudflare Dashboard** → **Security** → **Rate Limiting Rules**
2. Crear regla:
   - **URL**: `api.vibook.ai/*`
   - **Rate**: 1000 requests / 10 minutes por IP
   - **Action**: Challenge (CAPTCHA)

---

## Monitoreo

### Cloudflare Analytics

Ve a **Cloudflare Dashboard** → **Analytics & Logs** para ver:
- Requests por segundo
- Bandwidth usado
- Errores 4xx/5xx
- Países de origen de requests
- Latencia p50/p95/p99

### Railway Metrics

Ve a **Railway Dashboard** → **Metrics** para ver:
- CPU usage
- Memory usage
- Network I/O
- Request count

---

## Testing End-to-End

```bash
# 1. Verificar Worker (Opción A)
curl https://api.vibook.ai/health

# 2. Verificar Legacy Route
curl https://api.vibook.ai/search \
  -X POST \
  -H 'X-API-Key: wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_cf_legacy_001", "prompt": "vuelo a miami"}'

# Verifica header: X-Gateway: supabase-edge-functions

# 3. Verificar Nueva Route (Fastify)
curl https://api.vibook.ai/v1/search \
  -X POST \
  -H 'X-API-Key: wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_cf_v1_001", "prompt": "vuelo a madrid"}'

# Verifica header: X-Gateway: railway-fastify

# 4. Verificar CORS
curl https://api.vibook.ai/v1/search \
  -X OPTIONS \
  -H 'Origin: https://app.vibook.ai' \
  -H 'Access-Control-Request-Method: POST'

# Debe retornar headers CORS apropiados

# 5. Verificar Rate Limiting
for i in {1..5}; do
  echo "Request $i:"
  curl https://api.vibook.ai/v1/search \
    -X POST \
    -H 'X-API-Key: wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg' \
    -H 'Content-Type: application/json' \
    -d "{\"request_id\": \"req_cf_rate_$i\", \"prompt\": \"test\"}" \
    -s -o /dev/null -w "HTTP: %{http_code} | Rate-Remaining: %{header_x_ratelimit_remaining}\n"
done
```

---

## Troubleshooting

### Error: "Too Many Redirects"

**Causa**: SSL/TLS mode incorrecto en Cloudflare

**Solución**:
1. Cloudflare Dashboard → SSL/TLS
2. Cambiar a **Full (strict)**

### Error: "Worker threw exception"

**Causa**: Error en el código del Worker

**Solución**:
1. Worker Dashboard → **Logs**
2. Revisar errores en tiempo real
3. Verificar URLs de SUPABASE_URL y RAILWAY_URL

### Error: "DNS resolution error"

**Causa**: DNS no propagado

**Solución**:
1. Esperar 5-10 minutos
2. Verificar con: `nslookup api.vibook.ai`
3. Debe apuntar a Cloudflare IPs

---

## Costos Estimados

### Cloudflare Worker (Opción A)

**Free Tier:**
- 100,000 requests/día
- 10ms CPU time por request
- Suficiente para: ~3,000 requests/día con margen

**Paid Plan ($5/mes):**
- 10,000,000 requests/mes
- 50ms CPU time por request

### Cloudflare DNS (Opción B)

**Free Tier:**
- Ilimitado (incluido en plan gratuito)

### Railway

**Costo actual:** Según tu plan de Railway (ya configurado)

---

## Next Steps

1. **Elegir Opción A o B**
2. **Seguir pasos de configuración**
3. **Testing completo**
4. **Actualizar documentación de clientes** con nuevas URLs
5. **Migración gradual** de clientes (si usas Opción A)
