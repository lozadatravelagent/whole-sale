# 🔑 Generar API Key para Tercero

Este documento explica cómo generar una API key de producción para que un tercero pueda consumir el chat vía API.

## 📋 Opciones Disponibles

### Opción 1: Script SQL Simple (Recomendado)

**Archivo**: `create-production-api-key.sql`

**Pasos**:
1. Abrí Supabase Dashboard → **SQL Editor**
2. Copiá y pegá el contenido completo de `create-production-api-key.sql`
3. Presioná **Run**
4. Buscá en la consola los mensajes `RAISE NOTICE` que muestran la API key completa
5. **⚠️ IMPORTANTE**: Copiá la API key inmediatamente - solo se muestra una vez

**Ventajas**:
- Simple y directo
- No requiere configuración adicional
- La API key se muestra en los logs de PostgreSQL

**Desventajas**:
- La API key aparece en los NOTICE logs, no en el resultado de la query

---

### Opción 2: Script SQL con Función (Mejor para ver resultado)

**Archivo**: `create-production-api-key-v2.sql`

**Pasos**:
1. Abrí Supabase Dashboard → **SQL Editor**
2. Copiá y pegá el contenido completo de `create-production-api-key-v2.sql`
3. Presioná **Run**
4. La API key completa aparecerá en la columna `api_key_completa` del resultado
5. **⚠️ IMPORTANTE**: Copiá la API key inmediatamente

**Ventajas**:
- La API key aparece directamente en el resultado de la query
- Más fácil de copiar
- Puedes reutilizar la función para generar más keys

**Desventajas**:
- Crea una función temporal en la base de datos

---

## 🔧 Configuración de la API Key

### Parámetros por Defecto

- **Formato**: `wsk_prod_<32caracteres>`
- **Scopes**: `search:*` (acceso completo a búsquedas)
- **Rate Limits**:
  - 500 requests/minuto
  - 10,000 requests/hora
  - 100,000 requests/día
- **Expiración**: Sin expiración (NULL)
- **Environment**: `production`

### Personalizar Configuración

Si necesitás ajustar los rate limits o agregar expiración, podés modificar el script antes de ejecutarlo:

```sql
-- Ejemplo: API key con límites más altos y expiración en 1 año
SELECT * FROM generate_api_key_for_third_party(
  p_name := 'API Key Cliente XYZ',
  p_rate_limit_per_minute := 1000,
  p_rate_limit_per_hour := 50000,
  p_rate_limit_per_day := 500000,
  p_expires_at := NOW() + INTERVAL '1 year'
);
```

---

## 📤 Entregar la API Key al Tercero

Una vez generada, compartí con el tercero:

1. **La API key completa** (formato: `wsk_prod_...`)
2. **El endpoint de la API**: 
   ```
   https://<tu-proyecto>.supabase.co/functions/v1/api-search
   ```
3. **La ANON KEY de Supabase** (necesaria para pasar el gateway)
4. **Documentación**: `docs/guides/API_THIRD_PARTY_INTEGRATION_GUIDE.md`

### Ejemplo de Uso (para el tercero)

```bash
curl -X POST https://<proyecto>.supabase.co/functions/v1/api-search \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "X-API-Key: wsk_prod_<la-api-key-generada>" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req_001",
    "prompt": "vuelo a Miami para 2 personas"
  }'
```

---

## 🔍 Verificar API Key Creada

Para verificar que la API key se creó correctamente:

```sql
SELECT 
  key_prefix,
  name,
  environment,
  is_active,
  scopes,
  rate_limit_per_minute,
  rate_limit_per_hour,
  rate_limit_per_day,
  created_at,
  last_used_at,
  usage_count
FROM api_keys 
WHERE environment = 'production'
ORDER BY created_at DESC;
```

---

## 🚫 Revocar una API Key

Para desactivar una API key (sin eliminarla):

```sql
UPDATE api_keys
SET is_active = false
WHERE key_prefix = 'wsk_prod_<prefix>';
```

Para eliminarla completamente (solo OWNER):

```sql
DELETE FROM api_keys
WHERE key_prefix = 'wsk_prod_<prefix>';
```

---

## 📊 Monitorear Uso

Para ver estadísticas de uso de una API key:

```sql
SELECT 
  key_prefix,
  name,
  usage_count,
  last_used_at,
  rate_limit_per_minute,
  rate_limit_per_hour,
  rate_limit_per_day
FROM api_keys
WHERE key_prefix = 'wsk_prod_<prefix>';
```

---

## ⚠️ Seguridad

1. **Nunca compartas la API key en repositorios públicos**
2. **Usá diferentes keys para diferentes entornos** (dev, staging, prod)
3. **Revisá periódicamente las keys activas** y revocá las que no se usen
4. **Configurá rate limits apropiados** según el uso esperado
5. **Considerá agregar expiración** para keys de prueba

---

## 🆘 Troubleshooting

### La API key no funciona

1. Verificá que esté activa: `is_active = true`
2. Verificá que no haya expirado: `expires_at IS NULL OR expires_at > NOW()`
3. Verificá que el hash sea correcto (compará con el script de verificación)
4. Verificá que estés usando el header correcto: `X-API-Key`

### No puedo ver la API key después de generarla

- Las API keys se muestran **solo una vez** al generarlas
- Si la perdiste, tenés que revocar la anterior y crear una nueva
- El hash está en la base de datos, pero la key original no se puede recuperar

---

## 📚 Referencias

- [Guía de Integración API](./../docs/guides/API_THIRD_PARTY_INTEGRATION_GUIDE.md)
- [Documentación de Autenticación](./README_AUTENTICACION.md)
- [Scripts de Testing](./README_TEST_API.md)












