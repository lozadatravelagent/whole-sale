# Railway Deployment Guide - Fastify API

## Problema Detectado

Railway está intentando usar `root_dir=api` pero no encuentra el Dockerfile. El error es:
```
couldn't locate a dockerfile at path /api/Dockerfile in code archive
```

## Solución: Configurar Railway Dashboard

### Paso 1: Eliminar Root Directory Override

1. Ve a Railway Dashboard → Tu proyecto → Settings
2. Busca la sección **"Root Directory"** o **"Source"**
3. **ELIMINA** cualquier valor en "Root Directory" (debe estar vacío o en "/")
4. Guarda los cambios

Railway usará el `railway.toml` que ya configuré correctamente.

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
dockerfilePath = "api/Dockerfile"
watchPatterns = ["api/**"]

[deploy]
startCommand = "node dist/server.js"
healthcheckPath = "/v1/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[environments.production]
variables = { NODE_ENV = "production" }
```

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
- Verifica que NO hay Root Directory configurado en Railway Dashboard
- Confirma que `railway.toml` tiene `dockerfilePath = "api/Dockerfile"`

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
