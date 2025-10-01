# Cloudflare Rate Limiting Setup Guide

## ✅ Rate Limiting System Implemented

Este proyecto tiene un sistema de rate limiting en **3 capas**:

```
Usuario
  ↓
1. CLOUDFLARE (Infraestructura) - DDoS + Rate limit por IP
  ↓
2. SUPABASE EDGE FUNCTIONS (Aplicación) - Rate limit por usuario/tenant
  ↓
3. RAILWAY (Frontend) - Protegido por capas anteriores
```

---

## Capa 1: Cloudflare - Configuración Manual

### Prerrequisitos:
1. Dominio registrado
2. Cuenta Cloudflare (Free tier funciona)
3. Proyecto Supabase desplegado

### Paso 1: Configurar dominio custom en Supabase

1. Ve a Supabase Dashboard → Settings → Custom Domains
2. Agrega tu dominio (ej: `api.wholesale.com`)
3. Copia los registros DNS que te proporciona Supabase

### Paso 2: Configurar DNS en Cloudflare

1. Inicia sesión en [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Selecciona tu dominio
3. Ve a **DNS** → **Records**
4. Agrega los registros DNS de Supabase:
   - Type: `CNAME`
   - Name: `api` (o el subdominio que elijas)
   - Target: Tu URL de Supabase (`ujigyazketblwlzcomve.supabase.co`)
   - Proxy status: **Proxied** (nube naranja)

### Paso 3: Crear reglas de Rate Limiting

#### Regla 1: Protección DDoS básica

```
Dashboard → Security → WAF → Rate limiting rules → Create rule

Nombre: "DDoS Protection - General"
Características:
  - If: (All incoming requests)
  - And: (Request count) > 100 requests
  - In: 1 minute
  - Then: Block
  - Duration: 10 minutes
  - Response code: 429
```

**Configuración detallada:**
- **Expression**: `true` (aplica a todas las requests)
- **Requests**: 100
- **Period**: 60 seconds
- **Action**: Block
- **Duration**: 600 seconds (10 minutos)

#### Regla 2: Protección Edge Functions

```
Nombre: "Edge Functions Rate Limit"
Características:
  - If: (URI Path) contains "/functions/"
  - And: (Request count) > 30 requests
  - In: 1 minute
  - Then: Challenge (CAPTCHA)
  - Duration: 5 minutes
```

**Configuración detallada:**
```
Expression:
  (http.request.uri.path contains "/functions/")

Requests: 30
Period: 60 seconds
Action: Managed Challenge
Duration: 300 seconds
```

#### Regla 3: Protección de Auth/Login

```
Nombre: "Login Brute Force Protection"
Características:
  - If: (URI Path) contains "/auth/v1/token"
  - And: (Response status) equals 401 OR 403
  - And: (Request count) > 5 requests
  - In: 5 minutes
  - Then: Block
  - Duration: 1 hour
```

**Configuración detallada:**
```
Expression:
  (http.request.uri.path contains "/auth/v1/token") and
  (http.response.code in {401 403})

Requests: 5
Period: 300 seconds (5 minutos)
Action: Block
Duration: 3600 seconds (1 hora)
```

#### Regla 4: API Search Protection (Específica)

```
Nombre: "Search API Rate Limit"
Características:
  - If: (URI Path) contains "/functions/starling-flights" OR "/functions/eurovips-soap"
  - And: (Request count) > 15 requests
  - In: 1 hour
  - Then: Block
  - Duration: 30 minutes
```

**Configuración detallada:**
```
Expression:
  (http.request.uri.path contains "/functions/starling-flights") or
  (http.request.uri.path contains "/functions/eurovips-soap")

Requests: 15
Period: 3600 seconds (1 hora)
Action: Block
Duration: 1800 seconds (30 minutos)
```

---

## Capa 2: Supabase Edge Functions (Ya implementado)

### Configuración actual:

**Rate limits por plan:**

| Plan | Búsquedas/hora | Búsquedas/día | Mensajes/hora | Mensajes/día |
|------|----------------|---------------|---------------|--------------|
| Free | 100 | 500 | 200 | 1000 |
| Pro | 500 | 2500 | 1000 | 5000 |
| Enterprise | Sin límite | Sin límite | Sin límite | Sin límite |

### Tabla de configuración:

La tabla `rate_limit_config` controla los límites por tenant:

```sql
SELECT * FROM rate_limit_config WHERE tenant_id = 'xxx';
```

### Actualizar límites para un tenant:

```sql
UPDATE rate_limit_config
SET
  plan_type = 'pro',
  max_searches_per_hour = 100,
  max_searches_per_day = 500
WHERE tenant_id = 'xxx';
```

---

## Headers de Rate Limiting

Las Edge Functions ahora retornan headers estándar de rate limiting:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 2025-09-30T15:00:00Z
```

**Cuando se excede el límite:**
```
HTTP 429 Too Many Requests
Retry-After: 3600

{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "You have exceeded your rate limit of 10 requests...",
  "limit": 10,
  "current": 10,
  "remaining": 0,
  "reset_at": "2025-09-30T15:00:00Z",
  "retry_after": 3600
}
```

---

## Monitoreo y Analytics

### Ver uso actual de un usuario:

```sql
SELECT
  action,
  SUM(request_count) as total_requests,
  window_start
FROM rate_limit_usage
WHERE user_id = 'xxx'
AND window_start > now() - interval '24 hours'
GROUP BY action, window_start
ORDER BY window_start DESC;
```

### Ver estadísticas por tenant:

```sql
SELECT
  t.name as tenant_name,
  rl.action,
  COUNT(*) as total_requests,
  MAX(rl.window_start) as last_request
FROM rate_limit_usage rl
JOIN tenants t ON t.id = rl.tenant_id
WHERE rl.window_start > now() - interval '7 days'
GROUP BY t.name, rl.action
ORDER BY total_requests DESC;
```

### Limpiar registros antiguos:

```sql
-- Ejecutar manualmente o via cron
SELECT cleanup_old_rate_limit_usage();
```

---

## Testing del Rate Limiting

### Test 1: Exceder límite en Edge Function

```bash
# Hacer 11 búsquedas en menos de 1 hora (límite free = 10)
for i in {1..11}; do
  curl -X POST https://api.wholesale.com/functions/v1/starling-flights \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"action":"searchFlights","data":{...}}'
  echo "Request $i"
  sleep 1
done

# La request #11 debería retornar 429
```

### Test 2: Verificar Cloudflare

```bash
# Hacer 101 requests rápidas (límite = 100/min)
for i in {1..101}; do
  curl https://api.wholesale.com/health &
done
wait

# Algunas deberían bloquearse por Cloudflare
```

---

## Troubleshooting

### Problema: Rate limit no funciona

1. **Verificar que la migración SQL se aplicó:**
```sql
SELECT * FROM rate_limit_config LIMIT 1;
```

2. **Verificar que las funciones están deployadas:**
```bash
npx supabase functions list
```

3. **Ver logs de Edge Functions:**
```
Supabase Dashboard → Edge Functions → Logs
```

### Problema: Usuario bloqueado incorrectamente

**Resetear rate limit de un usuario:**
```sql
DELETE FROM rate_limit_usage
WHERE user_id = 'xxx'
AND window_start > now() - interval '1 hour';
```

### Problema: Cloudflare bloqueando usuarios legítimos

1. Ve a Cloudflare Dashboard → Security Events
2. Busca el IP del usuario
3. Agrega a IP Access Rules → Allow

---

## Migración a aplicar

Ejecuta en Supabase SQL Editor:

```sql
-- Archivo: supabase/migrations/20250930000003_rate_limiting.sql
-- (Ver contenido completo en el archivo)
```

---

## Deploy de funciones actualizadas

```bash
# Deploy todas las funciones con rate limiting
npx supabase functions deploy eurovips-soap --no-verify-jwt
npx supabase functions deploy starling-flights --no-verify-jwt
npx supabase functions deploy ai-message-parser --no-verify-jwt
```

---

## Resumen de Protección

| Capa | Protege contra | Límite típico | Acción |
|------|----------------|---------------|--------|
| Cloudflare | DDoS, ataques masivos | 100 req/min por IP | Block 10 min |
| Edge Functions | Abuso de usuario legítimo | 10 búsquedas/hora (free) | 429 + retry-after |
| Database RLS | Acceso no autorizado | N/A | Deny access |

✅ **Tu app ahora puede soportar muchos usuarios sin caerse ni exceder costos de APIs externas.**
