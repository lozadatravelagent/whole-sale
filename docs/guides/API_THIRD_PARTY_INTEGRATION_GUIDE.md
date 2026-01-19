# 🔌 Guía de Integración API - Terceros

> **Guía completa para habilitar acceso de producción vía API al sistema de chat de WholeSale Connect AI**

---

## 📑 Índice

1. [Resumen del Sistema](#resumen-del-sistema)
2. [Generar API Keys](#generar-api-keys)
3. [Esquema de Permisos (Scopes)](#esquema-de-permisos-scopes)
4. [Rate Limits Recomendados](#rate-limits-recomendados)
5. [Uso de la API](#uso-de-la-api)
6. [Rotación y Revocación](#rotación-y-revocación)
7. [Checklist de Verificación en Producción](#checklist-de-verificación-en-producción)
8. [Errores Comunes](#errores-comunes)
9. [Monitoreo y Logs](#monitoreo-y-logs)

---

## Resumen del Sistema

El sistema de API usa **Edge Functions de Supabase** con:

- **Autenticación**: API keys con hash SHA-256 (solo el hash se guarda en BD)
- **Rate Limiting**: 3 niveles (por minuto/hora/día)
- **Idempotencia**: TTL de 5 minutos usando `request_id`
- **Scopes**: Permisos granulares por tipo de búsqueda
- **RLS**: Row Level Security para aislamiento de datos por tenant/agency

### Arquitectura

```
Cliente Tercero
    ↓
    ├─ Header: X-API-Key (o Authorization)
    ├─ Body: { request_id, prompt, ... }
    ↓
Edge Function: api-search
    ↓
    ├─ 1. Validar API key (hash SHA-256)
    ├─ 2. Verificar scopes
    ├─ 3. Check rate limits
    ├─ 4. Check idempotency cache
    ├─ 5. Parsear mensaje con AI (o modo estructurado)
    ├─ 6. Validar campos requeridos
    ├─ 7. Ejecutar búsqueda
    ├─ 8. Guardar en cache (5 min)
    ├─ 9. Actualizar usage stats
    ↓
Response JSON + Rate Limit Headers
```

---

## Generar API Keys

### 1. Aplicar Migraciones

```bash
cd supabase
supabase db push
```

Esto crea:
- Tabla `api_keys` (con RLS habilitado)
- Tabla `api_request_cache` (para idempotencia)
- Funciones SQL: `generate_api_key()`, `revoke_api_key()`, `rotate_api_key()`

### 2. Generar una API Key

Ejecutar en Supabase SQL Editor:

```sql
-- Generar API key para un tenant
SELECT * FROM generate_api_key(
  p_tenant_id := '<TENANT_UUID>',
  p_agency_id := '<AGENCY_UUID>',  -- Opcional
  p_created_by := '<USER_UUID>',    -- Opcional
  p_name := 'Producción - Cliente XYZ',
  p_environment := 'production',    -- 'production' | 'development' | 'staging'
  p_scopes := ARRAY['search:*'],    -- Ver sección de Scopes
  p_rate_limit_per_minute := 100,
  p_rate_limit_per_hour := 1000,
  p_rate_limit_per_day := 10000,
  p_expires_at := NULL               -- NULL = nunca expira
);
```

**⚠️ IMPORTANTE**: La función devuelve el token **UNA SOLA VEZ**. Copialo inmediatamente y guardalo de forma segura.

### 3. Estructura de la API Key

Formato: `wsk_<env>_<random40chars>`

- **wsk** = WholeSale Key
- **env** = `prod`, `dev`, `stg`
- **random40chars** = String aleatorio de 40 caracteres

Ejemplo: `wsk_prod_a8f3k2m9p1x5z7b4n6c8v2d9f1h3j5k7`

### 4. Campos de `api_keys`

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  key_prefix TEXT NOT NULL,              -- "wsk_prod_a8f3k2m9" (primeros 8 chars)
  key_hash TEXT NOT NULL UNIQUE,         -- SHA-256 hash del token completo
  tenant_id UUID REFERENCES tenants(id),
  agency_id UUID REFERENCES agencies(id),
  created_by UUID REFERENCES users(id),
  scopes TEXT[] NOT NULL,                -- ['search:flights', 'search:hotels', ...]
  rate_limit_per_minute INTEGER,
  rate_limit_per_hour INTEGER,
  rate_limit_per_day INTEGER,
  name TEXT,                             -- Nombre descriptivo
  environment TEXT,                      -- 'production' | 'development' | 'staging'
  is_active BOOLEAN,
  expires_at TIMESTAMPTZ,                -- NULL = nunca expira
  created_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count BIGINT,
  metadata JSONB
);
```

---

## Esquema de Permisos (Scopes)

### Scopes Disponibles

| Scope              | Descripción                                    |
|--------------------|------------------------------------------------|
| `search:*`         | Acceso a TODAS las búsquedas (wildcard)        |
| `search:flights`   | Solo búsquedas de vuelos                       |
| `search:hotels`    | Solo búsquedas de hoteles                      |
| `search:combined`  | Búsquedas combinadas (vuelo + hotel)           |
| `search:packages`  | Búsquedas de paquetes                          |
| `search:services`  | Búsquedas de servicios                         |
| `search:itinerary` | Generación de itinerarios con IA               |

### Ejemplos de Configuración

**Acceso completo (recomendado para producción):**
```sql
p_scopes := ARRAY['search:*']
```

**Acceso limitado (solo vuelos y hoteles):**
```sql
p_scopes := ARRAY['search:flights', 'search:hotels']
```

**Acceso solo para búsquedas combinadas:**
```sql
p_scopes := ARRAY['search:combined']
```

---

## Rate Limits Recomendados

### Configuración por Tipo de Cliente

| Tipo de Cliente       | Por Minuto | Por Hora | Por Día  | Uso Recomendado                    |
|-----------------------|------------|----------|----------|------------------------------------|
| **Producción Alta**   | 200        | 5000     | 50000    | Plataforma web con alto tráfico    |
| **Producción Media**  | 100        | 1000     | 10000    | Aplicación standard (default)      |
| **Desarrollo/Testing**| 50         | 500      | 2000     | Ambiente de pruebas                |
| **Interno/Staff**     | 500        | 10000    | 100000   | Uso interno del equipo             |

### Cómo Funcionan los Rate Limits

El sistema verifica **3 ventanas deslizantes**:

1. **Por minuto**: Últimos 60 segundos
2. **Por hora**: Últimas 60 minutos
3. **Por día**: Últimas 24 horas

Si **cualquiera** de los límites se excede, retorna `429 Too Many Requests`.

### Headers de Response

Todas las respuestas incluyen headers de rate limit:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1702425600
X-RateLimit-Window: minute
```

---

## Uso de la API

### Endpoints Disponibles

#### Opción 1: Endpoint Directo de Supabase (Recomendado para desarrollo)

```
POST https://<PROJECT_REF>.supabase.co/functions/v1/api-search
```

**Ventajas**: No pasa por Cloudflare, sin problemas de Bot Management

#### Opción 2: Endpoint via Cloudflare (Recomendado para producción)

```
POST https://api.vibook.ai/search
```

**Ventajas**: Protección DDoS, rate limiting adicional, CDN global

**⚠️ IMPORTANTE**: Si usas el endpoint de Cloudflare, **DEBES** incluir el header `User-Agent` o recibirás un error 403.

### Headers Requeridos

#### Para endpoint directo de Supabase:

```http
Content-Type: application/json
X-API-Key: wsk_prod_a8f3k2m9p1x5z7b4n6c8v2d9f1h3j5k7
```

**O alternativamente** (formato Bearer):

```http
Content-Type: application/json
Authorization: Bearer wsk_prod_a8f3k2m9p1x5z7b4n6c8v2d9f1h3j5k7
```

#### Para endpoint de Cloudflare (api.vibook.ai):

```http
Content-Type: application/json
X-API-Key: wsk_prod_a8f3k2m9p1x5z7b4n6c8v2d9f1h3j5k7
User-Agent: TuCliente-API-Client/1.0 (https://tudominio.com)
Origin: https://tudominio.com
```

**⚠️ El header `User-Agent` es OBLIGATORIO** para evitar que Cloudflare Bot Management bloquee la petición con un 403.

> 📖 Ver guía completa: [`CLOUDFLARE_BOT_MANAGEMENT_FIX.md`](./CLOUDFLARE_BOT_MANAGEMENT_FIX.md)

### Ejemplo 1: Búsqueda con Lenguaje Natural (Modo AI)

#### Usando endpoint directo de Supabase:

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/api-search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_a8f3k2m9p1x5z7b4n6c8v2d9f1h3j5k7" \
  -d '{
    "request_id": "req_abc123def456",
    "prompt": "Vuelo y hotel a Punta Cana del 15 al 22 de enero, 2 adultos, todo incluido",
    "context": {
      "conversation_history": [
        {
          "role": "user",
          "content": "Hola, quiero viajar a Punta Cana",
          "timestamp": "2025-01-10T10:00:00Z"
        },
        {
          "role": "assistant",
          "content": "Perfecto, ¿para cuándo sería el viaje?",
          "timestamp": "2025-01-10T10:00:05Z"
        }
      ]
    },
    "external_conversation_ref": "conv_xyz789",
    "options": {
      "language": "es",
      "max_results": 5,
      "include_metadata": true
    }
  }'
```

#### Usando endpoint de Cloudflare (con User-Agent requerido):

```bash
curl -X POST https://api.vibook.ai/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_a8f3k2m9p1x5z7b4n6c8v2d9f1h3j5k7" \
  -H "User-Agent: MiCliente-API-Client/1.0 (https://midominio.com)" \
  -H "Origin: https://midominio.com" \
  -d '{
    "request_id": "req_abc123def456",
    "prompt": "Vuelo y hotel a Punta Cana del 15 al 22 de enero, 2 adultos, todo incluido",
    "context": {
      "conversation_history": [
        {
          "role": "user",
          "content": "Hola, quiero viajar a Punta Cana",
          "timestamp": "2025-01-10T10:00:00Z"
        },
        {
          "role": "assistant",
          "content": "Perfecto, ¿para cuándo sería el viaje?",
          "timestamp": "2025-01-10T10:05:00Z"
        }
      ]
    },
    "external_conversation_ref": "conv_xyz789",
    "options": {
      "language": "es",
      "max_results": 5,
      "include_metadata": true
    }
  }'
```

### Ejemplo 2: Búsqueda Estructurada (Sin AI)

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/api-search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_a8f3k2m9p1x5z7b4n6c8v2d9f1h3j5k7" \
  -d '{
    "request_id": "req_flight_001",
    "flights": {
      "origin": "EZE",
      "destination": "MIA",
      "departureDate": "2025-01-15",
      "returnDate": "2025-01-22",
      "adults": 2,
      "children": 0,
      "cabin": "ECONOMY",
      "stops": "direct",
      "luggage": "checked"
    }
  }'
```

### Ejemplo 3: Búsqueda Combinada (Vuelo + Hotel)

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/api-search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_a8f3k2m9p1x5z7b4n6c8v2d9f1h3j5k7" \
  -d '{
    "request_id": "req_combined_001",
    "flights": {
      "origin": "EZE",
      "destination": "PUJ",
      "departureDate": "2025-01-15",
      "returnDate": "2025-01-22",
      "adults": 2
    },
    "hotels": {
      "city": "Punta Cana",
      "checkinDate": "2025-01-15",
      "checkoutDate": "2025-01-22",
      "adults": 2,
      "roomType": "double",
      "mealPlan": "all_inclusive",
      "hotelChain": "RIU"
    }
  }'
```

### Response Exitoso (200 OK)

```json
{
  "request_id": "req_abc123def456",
  "search_id": "srch_1702425600_a1b2c3d4e5",
  "is_retry": false,
  "status": "completed",
  "external_conversation_ref": "conv_xyz789",
  "parsed_request": {
    "type": "combined",
    "flights": { ... },
    "hotels": { ... },
    "confidence": 0.95
  },
  "results": {
    "status": "completed",
    "flights": [
      {
        "fare_id": "...",
        "total_price_ars": 850000,
        "airline": "Aerolíneas Argentinas",
        "outbound": { ... },
        "return": { ... }
      }
    ],
    "hotels": [
      {
        "hotel_name": "RIU Palace Punta Cana",
        "total_price_usd": 1200,
        "rooms": [ ... ]
      }
    ]
  },
  "context_management": {
    "action": "save_and_allow_iteration",
    "reason": "Results found - user may want to refine search",
    "iteration_hints": [
      "Cambiar cadena hotelera",
      "Modificar tipo de habitación"
    ]
  },
  "metadata": {
    "search_time_ms": 3542,
    "ai_parsing_time_ms": 890,
    "providers_used": ["starling", "eurovips"],
    "total_results": {
      "flights": 8,
      "hotels": 12
    }
  }
}
```

### Response con Información Faltante (422 Unprocessable Entity)

```json
{
  "request_id": "req_incomplete_001",
  "search_id": "srch_1702425700_x9y8z7",
  "is_retry": false,
  "status": "incomplete",
  "parsed_request": {
    "type": "flights",
    "flights": {
      "origin": "EZE",
      "destination": null,
      "departureDate": null
    }
  },
  "error": {
    "type": "missing_info",
    "message": "Para buscar vuelos necesito más información",
    "missing_fields": [
      {
        "field": "destination",
        "description": "¿A dónde quieres viajar?",
        "examples": ["Miami", "Madrid", "Cancún"]
      },
      {
        "field": "departureDate",
        "description": "¿Cuándo quieres viajar?",
        "examples": ["15 de diciembre", "2025-12-15"]
      }
    ]
  },
  "context_management": {
    "action": "request_missing_info",
    "reason": "Incomplete parameters - need destination and dates"
  }
}
```

### Idempotencia (Cache de 5 Minutos)

Si reintentás una request con el mismo `request_id` dentro de 5 minutos:

```json
{
  "request_id": "req_abc123def456",
  "search_id": "srch_1702425600_a1b2c3d4e5",
  "is_retry": true,
  "cached_at": "2025-01-15T14:30:00Z",
  "status": "completed",
  "results": { ... }
}
```

---

## Rotación y Revocación

### Listar API Keys de un Tenant

```sql
SELECT * FROM list_api_keys('<TENANT_UUID>');
```

### Revocar una API Key

```sql
SELECT revoke_api_key('<API_KEY_UUID>');
```

**Efecto**: Marca `is_active = false`. La key deja de funcionar inmediatamente.

### Rotar una API Key (Recomendado)

```sql
SELECT * FROM rotate_api_key('<OLD_API_KEY_UUID>');
```

**Efecto**:
1. Revoca la key anterior (`is_active = false`)
2. Genera una nueva key con los **mismos permisos**
3. Devuelve el nuevo token **UNA SOLA VEZ**

**Proceso de rotación seguro:**

1. **Generar nueva key**:
   ```sql
   SELECT * FROM rotate_api_key('<OLD_KEY_UUID>');
   ```

2. **Entregar nueva key al cliente** (vía canal seguro: email cifrado, secretos compartidos, etc.)

3. **Período de transición**: Durante 24-48h, ambas keys funcionan (la anterior aún está activa)

4. **Verificar que el cliente migró**:
   ```sql
   SELECT key_prefix, last_used_at FROM api_keys WHERE id = '<OLD_KEY_UUID>';
   ```

5. **Revocar definitivamente la anterior**:
   ```sql
   SELECT revoke_api_key('<OLD_KEY_UUID>');
   ```

### Cuándo Rotar

**Rotación programada** (recomendado):
- Cada **90 días** para clientes en producción
- Cada **30 días** para clientes de alto riesgo

**Rotación forzada** (inmediata):
- Sospecha de compromiso de la key
- Empleado con acceso dejó la empresa
- Auditoría de seguridad detectó uso anormal

---

## Checklist de Verificación en Producción

### ✅ Pre-Deployment

- [ ] Migraciones aplicadas correctamente
  ```bash
  supabase db push
  ```
- [ ] Tabla `api_keys` tiene RLS habilitado
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'api_keys';
  ```
- [ ] Policies de RLS funcionando (solo OWNER/SUPERADMIN ven las keys)
- [ ] Función `generate_api_key()` creada y testeada
- [ ] Edge Function `api-search` deployada
  ```bash
  supabase functions deploy api-search
  ```

### ✅ Post-Deployment

- [ ] Generar API key de prueba (environment=staging)
- [ ] Test de autenticación:
  ```bash
  curl -X POST <API_URL> \
    -H "X-API-Key: <TEST_KEY>" \
    -d '{"request_id": "test_001", "prompt": "vuelo a miami"}'
  ```
- [ ] Verificar rate limits funcionando (enviar 101 requests en 1 minuto)
- [ ] Verificar idempotencia (mismo `request_id` retorna cache)
- [ ] Verificar logs en Supabase Dashboard → Edge Functions → api-search
- [ ] Configurar alertas de uso anormal (Supabase Metrics)

### ✅ Monitoreo Continuo

- [ ] Revisar `usage_count` y `last_used_at` semanalmente
- [ ] Auditar keys expiradas o inactivas mensualmente
- [ ] Verificar que no haya keys con scopes excesivos
- [ ] Rotar keys cada 90 días (o según política de seguridad)

---

## Errores Comunes

### 401 Unauthorized

#### `MISSING_API_KEY`
```json
{
  "error": {
    "code": "MISSING_API_KEY",
    "message": "API key is required in X-API-Key or Authorization header",
    "status": 401
  }
}
```
**Solución**: Agregar header `X-API-Key` o `Authorization: Bearer <key>`

#### `INVALID_API_KEY`
```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid or expired API key",
    "status": 401
  }
}
```
**Solución**: Verificar que la key sea correcta. Si fue revocada, generar una nueva.

#### `INACTIVE_API_KEY`
```json
{
  "error": {
    "code": "INACTIVE_API_KEY",
    "message": "API key has been revoked",
    "status": 401
  }
}
```
**Solución**: La key fue revocada. Contactar al administrador para generar una nueva.

#### `EXPIRED_API_KEY`
```json
{
  "error": {
    "code": "EXPIRED_API_KEY",
    "message": "API key has expired",
    "status": 401
  }
}
```
**Solución**: Generar una nueva key o extender la fecha de expiración (si es posible).

---

### 403 Forbidden

#### `INSUFFICIENT_SCOPE`
```json
{
  "error": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "API key does not have search permissions",
    "status": 403
  }
}
```
**Solución**: Actualizar los scopes de la API key:
```sql
UPDATE api_keys
SET scopes = ARRAY['search:*']
WHERE id = '<KEY_UUID>';
```

#### `403 Forbidden - Cloudflare Bot Management` (Solo endpoint api.vibook.ai)

**Síntomas**:
- Status code: `403 Forbidden`
- Response body: HTML con JavaScript (página "Just a moment...")
- Headers: `cf-mitigated: challenge`
- Error en logs: "Error no es JSON válido"

**Causa**: Cloudflare Bot Management está bloqueando peticiones de servidores backend sin User-Agent válido.

**Solución**:
1. **Agregar header `User-Agent`** en todas las peticiones:
   ```http
   User-Agent: TuCliente-API-Client/1.0 (https://tudominio.com)
   ```

2. **Ejemplo completo**:
   ```bash
   curl -X POST https://api.vibook.ai/search \
     -H "Content-Type: application/json" \
     -H "X-API-Key: wsk_prod_..." \
     -H "User-Agent: MiCliente-API-Client/1.0 (https://midominio.com)" \
     -d '{ "request_id": "req_123", "prompt": "vuelo a miami" }'
   ```

3. **Alternativa**: Usar el endpoint directo de Supabase que no pasa por Cloudflare:
   ```
   https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search
   ```

> 📖 Ver guía completa: [`CLOUDFLARE_BOT_MANAGEMENT_FIX.md`](./CLOUDFLARE_BOT_MANAGEMENT_FIX.md)

---

### 429 Too Many Requests

#### `RATE_LIMIT_EXCEEDED`
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded: 100 requests per minute",
    "status": 429
  }
}
```

**Headers**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1702425660
X-RateLimit-Window: minute
Retry-After: 42
```

**Solución**:
1. Implementar exponential backoff en el cliente
2. Respetar el header `Retry-After` (segundos hasta que se resetea)
3. Si es persistente, solicitar aumento de límites:
   ```sql
   UPDATE api_keys
   SET rate_limit_per_minute = 200
   WHERE id = '<KEY_UUID>';
   ```

---

### 400 Bad Request

#### `MISSING_REQUEST_ID`
```json
{
  "error": {
    "code": "MISSING_REQUEST_ID",
    "message": "request_id is required for idempotency",
    "status": 400
  }
}
```
**Solución**: Agregar `request_id` al body (UUID o formato `req_<string>`)

#### `INVALID_REQUEST_ID`
```json
{
  "error": {
    "code": "INVALID_REQUEST_ID",
    "message": "request_id must be a valid UUID or format 'req_<string>'",
    "status": 400
  }
}
```
**Solución**: Usar UUID válido o formato `req_` + 10+ caracteres alfanuméricos

#### `MISSING_INPUT`
```json
{
  "error": {
    "code": "MISSING_INPUT",
    "message": "Either 'prompt' or structured data (flights/hotels/etc) is required",
    "status": 400
  }
}
```
**Solución**: Proveer `prompt` (modo AI) O `flights`/`hotels`/etc (modo estructurado)

---

### 500 Internal Server Error

#### `AI_PARSING_ERROR`
```json
{
  "error": {
    "code": "AI_PARSING_ERROR",
    "message": "Failed to parse message with AI",
    "status": 500
  }
}
```
**Solución**: El servicio de AI falló. Reintentar o usar modo estructurado.

#### `SEARCH_ERROR`
```json
{
  "error": {
    "code": "SEARCH_ERROR",
    "message": "Search execution failed",
    "status": 500
  }
}
```
**Solución**: Proveedor externo (Starling/EUROVIPS) falló. Revisar logs de Edge Functions.

---

## Monitoreo y Logs

### Supabase Dashboard

1. **Edge Functions → api-search → Logs**
   - Ver requests en tiempo real
   - Filtrar por error codes
   - Buscar por `request_id` o `search_id`

2. **Database → API Keys Table**
   - Ver `usage_count` y `last_used_at`
   - Identificar keys inactivas o sospechosas

3. **Database → API Request Cache**
   - Monitorear tasa de cache hits (idempotencia funcionando)
   - Ver TTL funcionando (entries auto-expiradas)

### Queries Útiles de Monitoreo

**Keys más usadas en últimos 7 días:**
```sql
SELECT
  key_prefix,
  name,
  usage_count,
  last_used_at,
  rate_limit_per_day
FROM api_keys
WHERE last_used_at > NOW() - INTERVAL '7 days'
ORDER BY usage_count DESC
LIMIT 10;
```

**Keys inactivas (>30 días sin uso):**
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

**Tasa de cache hits (idempotencia):**
```sql
SELECT
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS total_requests_cached,
  COUNT(DISTINCT request_id) AS unique_request_ids,
  ROUND(
    100.0 * (COUNT(*) - COUNT(DISTINCT request_id)) / NULLIF(COUNT(*), 0),
    2
  ) AS cache_hit_rate_pct
FROM api_request_cache
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Uso por tenant (top 5):**
```sql
SELECT
  t.name AS tenant_name,
  COUNT(k.id) AS total_keys,
  SUM(k.usage_count) AS total_requests
FROM api_keys k
JOIN tenants t ON t.id = k.tenant_id
GROUP BY t.id, t.name
ORDER BY total_requests DESC
LIMIT 5;
```

---

## 📌 Resumen Rápido

| Acción                     | Comando SQL                                                                 |
|----------------------------|-----------------------------------------------------------------------------|
| **Generar key**            | `SELECT * FROM generate_api_key('<TENANT_ID>', ...)`                        |
| **Listar keys de tenant**  | `SELECT * FROM list_api_keys('<TENANT_ID>')`                                |
| **Revocar key**            | `SELECT revoke_api_key('<KEY_ID>')`                                         |
| **Rotar key**              | `SELECT * FROM rotate_api_key('<OLD_KEY_ID>')`                              |
| **Ver uso de una key**     | `SELECT usage_count, last_used_at FROM api_keys WHERE id = '<KEY_ID>'`     |

---

## 🔐 Mejores Prácticas de Seguridad

1. **Nunca loguear API keys completas** - Solo loguear el `key_prefix`
2. **Rotación programada** - Cada 90 días mínimo
3. **Principio de mínimo privilegio** - Solo dar scopes necesarios
4. **Monitoreo de uso anormal** - Alertas si `usage_count` crece > 200% en 24h
5. **Expiración obligatoria para desarrollo** - Keys de dev/staging deben tener `expires_at`
6. **Canal seguro para entrega** - Email cifrado, secretos compartidos, nunca por Slack/WhatsApp
7. **Auditoría trimestral** - Revisar keys inactivas y revocar

---

## 🆘 Soporte

**Documentación técnica**: `/docs/guides/API_THIRD_PARTY_INTEGRATION_GUIDE.md`

**Migraciones SQL**:
- `supabase/migrations/20251208000001_create_api_keys_table.sql`
- `supabase/migrations/20251208000002_create_api_request_cache_table.sql`
- `supabase/migrations/20251213000001_create_api_key_generator.sql`

**Edge Functions**:
- `supabase/functions/api-auth/index.ts` (validación de keys)
- `supabase/functions/api-search/index.ts` (endpoint principal)

**Helpers compartidos**:
- `supabase/functions/_shared/apiKeyAuth.ts` (auth + rate limiting)
- `supabase/functions/_shared/idempotency.ts` (cache de 5 min)
- `supabase/functions/_shared/validation.ts` (validación de campos)
