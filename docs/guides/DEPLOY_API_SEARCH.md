# Deploy api-search Edge Function

## Opción 1: Usando Supabase CLI (Recomendado)

```bash
# Instalar Supabase CLI (si no lo tenés)
npm install -g supabase

# Login a Supabase
supabase login

# Link a tu proyecto
supabase link --project-ref ujigyazketblwlzcomve

# Deploy SOLO api-search
supabase functions deploy api-search

# Deploy todas las shared dependencies
supabase functions deploy api-search --no-verify-jwt
```

## Opción 2: Deploy Manual (Supabase Dashboard)

1. Ve a https://app.supabase.com/project/ujigyazketblwlzcomve/functions
2. Click en **Deploy new function**
3. Nombre: `api-search`
4. Copiar el contenido completo de:
   - `supabase/functions/api-search/index.ts` (código principal)
   - `supabase/functions/api-search/deno.json` (config)

5. Configurar **Environment Variables**:
   - No necesita variables especiales (usa las del proyecto)

6. Configurar **Settings**:
   - **Verify JWT**: ❌ DESACTIVAR (importante!)
   - **Import map**: Usar `import_map.json`

7. Click **Deploy**

## Opción 3: Deploy via API (Script Automatizado)

Si tenés un token de Supabase Management API:

```bash
# Ver archivo: scripts/deploy-edge-function.sh
./scripts/deploy-edge-function.sh api-search
```

## Verificación Post-Deploy

### 1. Verificar que esté deployado

Ve a: https://app.supabase.com/project/ujigyazketblwlzcomve/functions

Debe aparecer `api-search` en la lista.

### 2. Test directo (sin proxy)

```bash
curl -X POST https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_..." \
  -d '{
    "request_id": "test_direct_001",
    "prompt": "vuelo a miami"
  }'
```

**Response esperado**: 200 OK o 422 (si falta info)

### 3. Test via proxy (Cloudflare)

```bash
curl -X POST https://api.vibook.ai/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_..." \
  -d '{
    "request_id": "test_proxy_001",
    "prompt": "vuelo a miami"
  }'
```

**Response esperado**: 200 OK o 422

## Troubleshooting

### Error: "Invalid JWT"

**Causa**: El Edge Function está configurado con "Verify JWT" activado.

**Solución**:
1. Ve a Edge Functions → api-search → Settings
2. Desactiva "Verify JWT"
3. Redeploy

### Error: "Function not found"

**Causa**: El Edge Function no está deployado o el nombre es incorrecto.

**Solución**:
1. Verifica el nombre exacto: `api-search` (con guión)
2. Redeploy usando Supabase CLI o Dashboard

### Error: "Missing dependencies"

**Causa**: Los archivos `_shared` no están disponibles.

**Solución**:
1. Asegurate de que `supabase/functions/_shared/` contenga:
   - `apiKeyAuth.ts`
   - `idempotency.ts`
   - `validation.ts`
   - `contextManagement.ts`
   - `buildMetadata.ts`
   - `searchExecutor.ts`

2. Deploy con flag `--import-map`:
   ```bash
   supabase functions deploy api-search --import-map supabase/functions/import_map.json
   ```

## Logs en Tiempo Real

Para ver logs del Edge Function:

```bash
# Via CLI
supabase functions logs api-search --tail

# Via Dashboard
https://app.supabase.com/project/ujigyazketblwlzcomve/functions/api-search/logs
```
