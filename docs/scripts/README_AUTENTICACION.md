# 🔐 Sistema de Autenticación API Search

## 📋 Cómo Funciona

La API usa **autenticación dual** por requisitos de Supabase:

### **1. Supabase Gateway** (Primera Capa)
- Requiere un JWT válido en el header `Authorization`
- Usa el **ANON KEY** público de Supabase
- Solo para pasar el gateway (no valida permisos)

### **2. API Key Personalizada** (Segunda Capa)
- Nuestra autenticación custom en el header `X-API-Key`
- Valida contra la tabla `api_keys`
- Controla scopes y rate limiting

## 🔑 Headers Requeridos

```http
POST /functions/v1/api-search
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (ANON KEY)
X-API-Key: wsk_dev_test123456789012345678901234              (TU API KEY)
Content-Type: application/json
```

## 📊 Flujo de Autenticación

```
1. Request llega al API Gateway de Supabase
   ↓
2. Gateway valida Authorization header (ANON KEY)
   ↓ [Si válido]
3. Request pasa a Edge Function (api-search)
   ↓
4. Edge Function lee X-API-Key header
   ↓
5. Valida contra tabla api_keys (hash SHA-256)
   ↓
6. Verifica scopes y rate limits
   ↓
7. Ejecuta búsqueda
```

## 💻 Ejemplo PowerShell

```powershell
$SUPABASE_URL = "https://ujigyazketblwlzcomve.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
$API_KEY = "wsk_dev_test123456789012345678901234"

$body = @{
    request_id = "req_001"
    prompt = "vuelo a miami"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "$SUPABASE_URL/functions/v1/api-search" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $ANON_KEY"  # Para Supabase Gateway
        "X-API-Key" = $API_KEY                 # Para nuestra auth
        "Content-Type" = "application/json"
    } `
    -Body $body
```

## 🌐 Ejemplo cURL

```bash
curl -X POST https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-API-Key: wsk_dev_test123456789012345678901234" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req_001",
    "prompt": "vuelo a miami"
  }'
```

## 🔒 Seguridad

### ANON KEY (Público)
- ✅ Puede estar en frontend
- ✅ Solo permite acceso a funciones públicas
- ✅ No da acceso a la base de datos directamente

### API KEY (Privado)
- ❌ NUNCA exponer en frontend
- ✅ Solo usar en backend/servidor
- ✅ Controla permisos específicos (scopes)
- ✅ Tiene rate limiting

## 📍 Dónde Conseguir las Keys

### ANON KEY
1. Supabase Dashboard → Settings → API
2. Copiar "Project API keys" → "anon" → "public"

### API KEY (Custom)
1. Ejecutar SQL: `scripts/01-create-api-key.sql`
2. Usar la key generada: `wsk_dev_test123456789012345678901234`

## 🧪 Testing

### Test Rápido
```powershell
.\scripts\11-test-with-anon-key.ps1
```

### Suite Completa
```powershell
# Primero actualizar test-api-search-fixed.ps1 con ANON_KEY
.\scripts\test-api-search-fixed.ps1
```

## ❓ FAQ

### ¿Por qué necesitamos dos headers?
Supabase Gateway **requiere** autenticación JWT para todas las Edge Functions. No podemos deshabilitarlo. Por eso usamos el ANON KEY (que es público y seguro) para pasar el gateway, y luego nuestra API key personalizada para la autenticación real.

### ¿Es seguro exponer el ANON KEY?
Sí, el ANON KEY es público por diseño. No da acceso a datos sensibles. Los permisos reales están controlados por:
1. Row Level Security (RLS) en la base de datos
2. Nuestra API key personalizada en X-API-Key header

### ¿Puedo usar solo el ANON KEY?
No. El ANON KEY solo sirve para pasar el gateway de Supabase. La validación real de permisos, scopes y rate limiting se hace con nuestra API key en el header X-API-Key.

### ¿Qué pasa si solo mando X-API-Key?
El request es rechazado con 401 por Supabase Gateway ANTES de llegar a nuestra función.

## 🔗 Links Útiles

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Edge Functions Auth](https://supabase.com/docs/guides/functions/auth)
- [API Keys Table](https://supabase.com/dashboard/project/ujigyazketblwlzcomve/editor)
















