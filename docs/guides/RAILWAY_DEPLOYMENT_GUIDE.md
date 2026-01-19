# Railway Deployment Guide - Fastify API

## Configuración: Desplegar Solo el Directorio `/api`

El repositorio contiene dos proyectos:
1. **React/Vite** (raíz del repo) - No debe desplegarse en Railway
2. **Fastify API** (directorio `/api`) - Esto es lo que queremos desplegar

## Solución: Configurar Root Directory en Railway

### Paso 1: Configurar Root Directory

1. Ve a **Railway Dashboard** → Tu proyecto → **Settings**
2. Busca la sección **"Root Directory"** o **"Source"**
3. Establece Root Directory como: **`api`**
4. Guarda los cambios

Esto le dice a Railway que ignore todo fuera de `/api` y solo despliegue el API Gateway.

### Paso 2: Verificar Variables de Entorno

En Railway Dashboard → Variables:

```bash
SUPABASE_URL=https://ujigyazketblwlzcomve.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<tu_service_role_key>
UPSTASH_REDIS_REST_URL=https://measured-magpie-21357.upstash.io
UPSTASH_REDIS_REST_TOKEN=<tu_redis_token>
NODE_ENV=production
LOG_LEVEL=info
```

**IMPORTANTE**: No configures `PORT` - Railway lo asigna automáticamente.

### Paso 3: Re-Desplegar

1. Railway Dashboard → Deployments
2. Click "Deploy" o haz push a GitHub
3. Railway detectará `railway.toml` y usará:
   - Dockerfile en `api/Dockerfile`
   - Health check en `/v1/health`
   - Build context correcto

## Configuración Actual (railway.toml)

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"  # Relativo a Root Directory (api/)
watchPatterns = ["**"]

[deploy]
startCommand = "node dist/server.js"
healthcheckPath = "/v1/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[environments.production]
variables = { NODE_ENV = "production" }
```

**Nota**: Con Root Directory = `api`, Railway buscará el Dockerfile en `api/Dockerfile` automáticamente.

## Verificación Post-Deploy

Una vez desplegado, verifica:

```bash
# Health check básico
curl https://tu-app.railway.app/v1/health

# Health check detallado
curl https://tu-app.railway.app/v1/health/detailed

# Test de búsqueda (placeholder por ahora)
curl -X POST https://tu-app.railway.app/v1/search \
  -H 'X-API-Key: wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg' \
  -H 'Content-Type: application/json' \
  -d '{"request_id": "req_railway_test_001", "prompt": "test railway deployment"}'
```

## Troubleshooting

### Error: "Cannot find Dockerfile"
- ✅ **SOLUCIÓN**: Configura Root Directory = `api` en Railway Dashboard
- ✅ Verifica que `railway.toml` tiene `dockerfilePath = "Dockerfile"`
- ❌ NO dejes Root Directory vacío (desplegará el proyecto React por error)

### Error: Health check failing
- Verifica que las variables de entorno están configuradas
- Revisa logs: Railway Dashboard → Deployments → Ver logs

### Error: Port binding
- NO configures PORT manualmente - Railway lo asigna automáticamente
- El Dockerfile expone puerto 3000 pero Railway lo mapea dinámicamente

## Logs en Railway

Busca estos mensajes para confirmar que todo funciona:

```json
{"level":"info","msg":"🚀 Fastify API Gateway listening on http://0.0.0.0:3000"}
{"level":"info","msg":"📊 Health check: http://0.0.0.0:3000/v1/health"}
```

## Next Steps Después del Deploy

1. **Obtener URL pública** de Railway
2. **Configurar proxy en Edge Function** (Fase 2.4):
   - Agregar variable `FASTIFY_URL=https://tu-app.railway.app`
   - Modificar `api-search/index.ts` para proxear requests
3. **Testing gradual**: Activar proxy para % de tráfico
