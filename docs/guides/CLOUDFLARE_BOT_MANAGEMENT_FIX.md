# 🔧 Solución: Error 403 Cloudflare Bot Management

## 🐛 Problema

Cuando un cliente externo hace peticiones a `https://api.vibook.ai/search` desde un servidor backend, Cloudflare devuelve un **403 Forbidden** con una página HTML de desafío "Just a moment...".

### Síntomas:
- Status code: `403 Forbidden`
- Response body: HTML con JavaScript de Cloudflare challenge
- Headers: `cf-mitigated: challenge`
- Error: "Error no es JSON válido" (porque espera JSON pero recibe HTML)

### Causa:
Cloudflare Bot Management está detectando las peticiones del servidor backend como bots y requiere un desafío JavaScript que los servidores no pueden resolver.

---

## ✅ Soluciones

### Solución 1: Agregar User-Agent (Recomendado - Inmediata)

El cliente debe enviar un **User-Agent** válido en todas las peticiones:

```http
POST https://api.vibook.ai/search
Content-Type: application/json
X-API-Key: wsk_prod_...
User-Agent: Emilia-API-Client/1.0 (https://www.maxevagestion.com)
Origin: https://www.maxevagestion.com
```

#### Ejemplo en Python (requests):
```python
import requests

headers = {
    'Content-Type': 'application/json',
    'X-API-Key': 'wsk_prod_...',
    'User-Agent': 'Emilia-API-Client/1.0 (https://www.maxevagestion.com)',
    'Origin': 'https://www.maxevagestion.com'
}

response = requests.post(
    'https://api.vibook.ai/search',
    headers=headers,
    json={
        'request_id': 'req_123',
        'prompt': 'vuelo a barcelona'
    }
)
```

#### Ejemplo en Node.js (fetch):
```javascript
const response = await fetch('https://api.vibook.ai/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'wsk_prod_...',
    'User-Agent': 'Emilia-API-Client/1.0 (https://www.maxevagestion.com)',
    'Origin': 'https://www.maxevagestion.com'
  },
  body: JSON.stringify({
    request_id: 'req_123',
    prompt: 'vuelo a barcelona'
  })
});
```

#### Ejemplo en cURL:
```bash
curl -X POST https://api.vibook.ai/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_..." \
  -H "User-Agent: Emilia-API-Client/1.0 (https://www.maxevagestion.com)" \
  -H "Origin: https://www.maxevagestion.com" \
  -d '{
    "request_id": "req_123",
    "prompt": "vuelo a barcelona"
  }'
```

---

### Solución 2: Configurar Cloudflare WAF (Recomendado - Permanente)

Crear una regla en Cloudflare para permitir peticiones con API keys válidas al endpoint `/search`.

#### Paso 1: Ir a Cloudflare Dashboard
1. Inicia sesión en [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Selecciona el dominio `vibook.ai`
3. Ve a **Security** → **WAF** → **Custom rules**

#### Paso 2: Crear regla para bypass de Bot Management

**Nombre**: `Allow API Search with API Key`

**Expression** (usando el editor visual de Cloudflare):

**Campo 1**:
- Field: `URI Path`
- Operator: `contains`
- Value: `/search`

**Campo 2** (AND):
- Field: `Header`
- Header name: `x-api-key`
- Operator: `starts with`
- Value: `wsk_prod_`

**Expression resultante** (debe verse así):
```
(http.request.uri.path contains "/search") and 
(any(starts_with(http.request.headers["x-api-key"][*], "wsk_prod_")))
```

⚠️ **IMPORTANTE**: Usa `AND` (no `OR`). La expresión debe requerir AMBAS condiciones:
1. El path contiene `/search`
2. Y el header `x-api-key` empieza con `wsk_prod_`

**Action**: `Skip` → Seleccionar:
- ✅ All remaining custom rules
- ✅ All rate limiting rules
- ✅ All managed rules
- ✅ All Super Bot Fight Mode Rules

**Place at**: `First` (alta prioridad)

**Description**: Permite peticiones al endpoint /search que tengan un API key de producción válido, saltándose el Bot Management y otras reglas de seguridad.

---

### Solución 3: Desactivar Bot Management para /search (Alternativa)

Si la Solución 2 no funciona, puedes desactivar el Bot Management específicamente para el endpoint `/search`:

1. Ve a **Security** → **Bots**
2. Click en **Configure Super Bot Fight Mode** o **Bot Management**
3. Crea una excepción:
   - **Path**: `/search`
   - **Action**: `Allow` o `Log only`

---

### Solución 4: Usar endpoint directo de Supabase (Temporal)

Como solución temporal, el cliente puede usar el endpoint directo de Supabase que no pasa por Cloudflare:

```http
POST https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search
Content-Type: application/json
X-API-Key: wsk_prod_...
```

**Nota**: Este endpoint no tiene protección de Cloudflare, pero funciona inmediatamente.

---

## 🔍 Verificación

### Test con User-Agent:
```bash
curl -X POST https://api.vibook.ai/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_..." \
  -H "User-Agent: Emilia-API-Client/1.0" \
  -H "Origin: https://www.maxevagestion.com" \
  -v
```

**Respuesta esperada**:
- ✅ Status `200` o `422` (no `403`)
- ✅ Response body es JSON (no HTML)
- ✅ No hay header `cf-mitigated: challenge`

---

## 📋 Checklist para el Cliente

El cliente debe asegurarse de enviar estos headers:

- [x] `Content-Type: application/json`
- [x] `X-API-Key: wsk_prod_...` (su API key)
- [x] `User-Agent: [Nombre del cliente]-API-Client/1.0` (NUEVO - REQUERIDO)
- [x] `Origin: https://www.maxevagestion.com` (opcional pero recomendado)

---

## 🚨 Si el problema persiste

1. **Verificar que el User-Agent esté presente** en los logs del cliente
2. **Verificar la configuración de Cloudflare** (reglas WAF activas)
3. **Contactar soporte de Cloudflare** si es necesario ajustar el nivel de seguridad
4. **Usar endpoint directo de Supabase** como workaround temporal

---

## 📝 Notas Técnicas

- Cloudflare Bot Management analiza múltiples señales: User-Agent, headers, IP reputation, comportamiento, etc.
- Los servidores backend sin User-Agent válido son marcados como bots automáticamente
- La regla WAF personalizada permite bypassear el Bot Management para peticiones legítimas con API keys
- El endpoint directo de Supabase (`*.supabase.co`) no pasa por Cloudflare, por lo que no tiene este problema

