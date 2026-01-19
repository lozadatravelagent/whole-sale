# 🧪 Testing de API Search

Guía completa para probar el endpoint `api-search`.

## 📋 Pre-requisitos

### 1. Crear la API Key de Testing

Antes de ejecutar los tests, necesitás crear la API key en la base de datos:

```bash
# En Supabase SQL Editor, ejecutá:
scripts/create-test-api-key.sql
```

Esto creará la API key: `wsk_dev_test123456789012345678901234`

### 2. Verificar que la API Key existe

```sql
SELECT 
  key_prefix,
  name,
  environment,
  is_active,
  scopes,
  rate_limit_per_minute
FROM api_keys 
WHERE key_prefix = 'wsk_dev_';
```

Deberías ver:
- ✅ `key_prefix`: `wsk_dev_`
- ✅ `is_active`: `true`
- ✅ `scopes`: `{search:*}`

## 🚀 Ejecutar Tests

### Opción 1: Suite Completa (Recomendado)

```powershell
.\scripts\test-api-search.ps1
```

Esto ejecuta todos los tests en orden:
1. ✅ Health Check
2. ✈️ Búsqueda Completa de Vuelos
3. 🔄 Idempotencia (Cache)
4. 🌴 Punta Cana Whitelist
5. 🧳 Light Fare Detection
6. ❌ Error: Invalid API Key
7. ❌ Error: Missing request_id

### Opción 2: Test Individual

```powershell
# Solo health check
$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$API_KEY = "wsk_dev_test123456789012345678901234"

$body = @{
    request_id = "req_test_001"
    prompt = "vuelo a miami"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "$SUPABASE_URL/functions/v1/api-search" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $API_KEY"
        "Content-Type" = "application/json"
    } `
    -Body $body
```

## 📊 Tests Incluidos

### TEST 1: Health Check ✅
- **Objetivo**: Verificar que la API responde
- **Request**: Prompt simple "vuelo a miami"
- **Esperado**: `status: completed` o `incomplete`

### TEST 2: Búsqueda Completa ✈️
- **Objetivo**: Búsqueda con todos los parámetros
- **Request**: "vuelo de buenos aires a miami 15 de marzo por 10 dias para 2 personas"
- **Esperado**: 
  - Parsed request con todos los campos
  - Results con vuelos
  - Metadata completa

### TEST 3: Idempotencia 🔄
- **Objetivo**: Verificar que el cache funciona
- **Request**: Mismo `request_id` que TEST 2
- **Esperado**: 
  - `is_retry: true`
  - `cached_at` timestamp
  - Mismos resultados que TEST 2

### TEST 4: Punta Cana Whitelist 🌴
- **Objetivo**: Verificar whitelist de hoteles
- **Request**: "hotel todo incluido en punta cana"
- **Esperado**:
  - `metadata.destination_rules.type = "quality_whitelist"`
  - `whitelist_matches` > 0
  - Hoteles filtrados por whitelist

### TEST 5: Light Fare Detection 🧳
- **Objetivo**: Verificar exclusión de light fares
- **Request**: "vuelo con equipaje de mano"
- **Esperado**:
  - `metadata.light_fares_excluded` > 0
  - `light_fare_airlines` lista de aerolíneas

### TEST 6: Invalid API Key ❌
- **Objetivo**: Verificar rechazo de keys inválidas
- **Request**: API key incorrecta
- **Esperado**: `401 INVALID_API_KEY`

### TEST 7: Missing request_id ❌
- **Objetivo**: Verificar validación de request_id
- **Request**: Sin `request_id`
- **Esperado**: `400 MISSING_REQUEST_ID`

## 🔍 Interpretar Resultados

### ✅ Success Response

```json
{
  "request_id": "req_test_001",
  "search_id": "srch_abc123",
  "is_retry": false,
  "status": "completed",
  "parsed_request": {
    "type": "flights",
    "flights": { ... }
  },
  "results": {
    "flights": {
      "count": 25,
      "items": [ ... ]
    }
  },
  "metadata": {
    "search_time_ms": 1250,
    "ai_parsing_time_ms": 450
  }
}
```

### ❌ Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid or expired API key",
    "status": 401
  }
}
```

### ⚠️ Incomplete Response (422)

```json
{
  "request_id": "req_test_001",
  "search_id": "srch_abc123",
  "status": "incomplete",
  "error": {
    "type": "missing_info",
    "message": "Necesito más información",
    "missing_fields": ["destination", "dates"]
  },
  "context_management": {
    "action": "request_clarification",
    "save_context": true
  }
}
```

## 🐛 Troubleshooting

### Error: "INVALID_API_KEY"
**Causa**: La API key no existe en la base de datos
**Solución**: Ejecutá `create-test-api-key.sql`

### Error: "INSUFFICIENT_SCOPE"
**Causa**: La API key no tiene permisos de búsqueda
**Solución**: Verificá que `scopes` incluya `search:*`

### Error: "RATE_LIMIT_EXCEEDED"
**Causa**: Superaste el límite de requests
**Solución**: Esperá un minuto o aumentá los límites en la BD

### Error: Connection refused
**Causa**: El Edge Function no está deployed
**Solución**: 
```bash
supabase functions deploy api-search
```

## 📈 Métricas a Observar

### Performance
- **search_time_ms**: < 2000ms (OK), > 5000ms (lento)
- **ai_parsing_time_ms**: < 500ms (OK), > 1000ms (lento)

### Rate Limiting
- **X-RateLimit-Remaining**: Requests restantes
- **X-RateLimit-Reset**: Timestamp de reset

### Cache Hit Rate
- **is_retry: true**: Request servido desde cache
- **cached_at**: Timestamp del cache original

## 🔗 Links Útiles

- [Supabase Dashboard - Edge Functions](https://supabase.com/dashboard/project/ujigyazketblwlzcomve/functions)
- [Supabase Dashboard - Logs](https://supabase.com/dashboard/project/ujigyazketblwlzcomve/logs/edge-functions)
- [API Keys Table](https://supabase.com/dashboard/project/ujigyazketblwlzcomve/editor)

## 🎯 Siguiente Paso

Después de que todos los tests pasen:
1. Crear API keys de producción con `environment = 'production'`
2. Documentar el endpoint para clientes externos
3. Configurar monitoring y alertas
4. Implementar webhooks para notificaciones
















