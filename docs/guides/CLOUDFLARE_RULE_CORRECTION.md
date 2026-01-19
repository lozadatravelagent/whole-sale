# 🔧 Corrección de Regla Cloudflare WAF

## ❌ Problema con la Regla Actual

Tu regla actual tiene un problema de lógica. La expresión usa `OR` cuando debería usar `AND`:

### Expresión Actual (INCORRECTA):
```
(http.request.uri.path contains "/search") or 
(any(http.request.headers["user-agent"][*] contains "node")) or 
(any(starts_with(http.request.headers["x-api-key"][*], "wsk_prod_")))
```

**Problema**: Esta regla permite:
- ✅ Cualquier request a `/search` (sin importar headers)
- ✅ Cualquier request con user-agent que contenga "node" (a cualquier endpoint)
- ✅ Cualquier request con x-api-key que empiece con "wsk_prod_" (a cualquier endpoint)

Esto es **demasiado permisivo** y puede permitir tráfico no deseado.

---

## ✅ Solución: Regla Corregida

### Expresión Correcta (usando AND):

```
(http.request.uri.path contains "/search") and 
(any(starts_with(http.request.headers["x-api-key"][*], "wsk_prod_")))
```

**Esta regla solo permite**:
- ✅ Requests a `/search` **Y** que tengan un API key de producción válido

---

## 📝 Configuración Paso a Paso

### 1. Editar la Regla en Cloudflare

1. Ve a **Security** → **WAF** → **Custom rules**
2. Click en tu regla "Allow Vercel to /search"
3. Click en **Edit**

### 2. Configurar los Campos

#### Campo 1:
- **Field**: `URI Path`
- **Operator**: `contains`
- **Value**: `/search`

#### Campo 2 (Click en "Add condition" y seleccionar "AND"):
- **Field**: `Header`
- **Header name**: `x-api-key`
- **Operator**: `starts with`
- **Value**: `wsk_prod_`

### 3. Eliminar Condiciones Innecesarias

**Elimina** la condición del `user-agent` que contiene "node". No es necesaria si validamos el API key.

### 4. Verificar la Expression Preview

Debe verse así:
```
(http.request.uri.path contains "/search") and 
(any(starts_with(http.request.headers["x-api-key"][*], "wsk_prod_")))
```

⚠️ **NO debe tener `OR`**, solo `AND`.

### 5. Configurar la Action

**Action**: `Skip`

**WAF components to skip**:
- ✅ All remaining custom rules
- ✅ All rate limiting rules
- ✅ All managed rules
- ✅ **All Super Bot Fight Mode Rules** (IMPORTANTE - esto evita el 403)

### 6. Posición

**Place at**: `First` (para que se evalúe antes que otras reglas)

---

## 🧪 Verificación

### Test 1: Request con API key válido (debe pasar)
```bash
curl -X POST https://api.vibook.ai/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_LHEoIcQ280U..." \
  -d '{"request_id": "test_001", "prompt": "vuelo a miami"}'
```
**Esperado**: Status 200 o 422 (no 403)

### Test 2: Request sin API key (debe ser bloqueado)
```bash
curl -X POST https://api.vibook.ai/search \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test_002", "prompt": "vuelo a miami"}'
```
**Esperado**: Status 403 (bloqueado por Cloudflare)

### Test 3: Request a otro endpoint con API key (no debe ser afectado)
```bash
curl -X POST https://api.vibook.ai/other-endpoint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_LHEoIcQ280U..." \
  -d '{"test": "data"}'
```
**Esperado**: Sigue las reglas normales de Cloudflare (no bypass)

---

## 🔒 Seguridad

### ¿Por qué usar AND en lugar de OR?

- **AND**: Requiere que AMBAS condiciones se cumplan → Más seguro
- **OR**: Permite si CUALQUIERA de las condiciones se cumple → Menos seguro

### ¿Por qué no incluir user-agent?

El header `user-agent` es fácil de falsificar. El API key es más seguro porque:
- Está validado en el backend
- Tiene rate limiting
- Puede ser revocado
- Está asociado a un cliente específico

### Alternativa: Regla más permisiva (si necesitas user-agent como fallback)

Si quieres permitir también requests con user-agent válido (por si acaso), puedes usar:

```
(http.request.uri.path contains "/search") and 
(
  (any(starts_with(http.request.headers["x-api-key"][*], "wsk_prod_"))) or
  (any(http.request.headers["user-agent"][*] contains "Emilia") or
   any(http.request.headers["user-agent"][*] contains "API-Client"))
)
```

Pero la recomendación es **solo validar el API key** para mayor seguridad.

---

## 📊 Resumen de Cambios

| Aspecto | Antes (Incorrecto) | Después (Correcto) |
|---------|-------------------|-------------------|
| Operador lógico | `OR` (demasiado permisivo) | `AND` (más seguro) |
| Condiciones | 3 condiciones con OR | 2 condiciones con AND |
| Scope | Afecta cualquier endpoint | Solo afecta `/search` |
| Validación | User-agent o API key | Solo API key (más seguro) |

---

## ✅ Checklist Final

- [ ] La expresión usa `AND` (no `OR`)
- [ ] Solo tiene 2 condiciones: path y x-api-key
- [ ] La acción es `Skip` con "All Super Bot Fight Mode Rules" activado
- [ ] La regla está en posición `First`
- [ ] Se probó con un request real y funciona (no 403)
- [ ] Se probó sin API key y es bloqueado (403)
















