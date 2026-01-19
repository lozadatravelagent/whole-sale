# 🚀 Cómo Ejecutar los Tests de API Search

## ⚠️ IMPORTANTE: El Script se Congela

Si el script `test-api-search.ps1` se queda congelado en "TEST 1: Health Check ✅", es porque **la API key NO existe en la base de datos**.

## 📋 Orden Correcto de Ejecución

### **PASO 1: Crear la API Key (PRIMERO)** 🔑

1. **Abrí Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/ujigyazketblwlzcomve/editor
   ```

2. **Click en "SQL Editor"** (menú lateral izquierdo)

3. **Click en "+ New query"**

4. **Copiá y pegá el contenido de:**
   ```
   scripts/01-create-api-key.sql
   ```

5. **Presioná "Run"** (o F5)

6. **Verificá el resultado:**
   Deberías ver algo como:
   ```
   ✅ API Key creada exitosamente
   key_prefix: wsk_dev_
   name: Testing API Key - DEV ONLY
   is_active: true
   ```

### **PASO 2: Verificar que la API Key Existe** ✅

1. **En el mismo SQL Editor, ejecutá:**
   ```
   scripts/02-verify-api-key.sql
   ```

2. **Deberías ver:**
   ```
   status: ✅ API Key EXISTS
   total_keys: 1
   ```

   Si dice `❌ API Key NOT FOUND`, repetí el PASO 1.

### **PASO 3: Test Simple (Antes de la Suite Completa)** 🧪

Este test tiene timeout de 60 segundos y mejor manejo de errores:

```powershell
cd C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai
.\scripts\03-test-api-simple.ps1
```

**Resultado esperado:**
```
✅ SUCCESS - La API respondió!
Response:
{
  "request_id": "req_simple_test_001",
  "status": "incomplete",
  ...
}
```

### **PASO 4: Suite Completa de Tests** 🎯

Una vez que el test simple funcione:

```powershell
.\scripts\test-api-search.ps1
```

---

## 🐛 Troubleshooting

### Problema: Script se Congela

**Causa:** API key no existe en la base de datos

**Solución:**
1. Presioná `Ctrl + C` para cancelar
2. Ejecutá `scripts/01-create-api-key.sql` en Supabase
3. Verificá con `scripts/02-verify-api-key.sql`
4. Reintentá el test

### Problema: Error 401 Unauthorized

**Causa:** API key inválida o desactivada

**Solución:**
```sql
-- En Supabase SQL Editor:
UPDATE api_keys 
SET is_active = true 
WHERE key_prefix = 'wsk_dev_';
```

### Problema: Timeout después de 60 segundos

**Causa:** Cold start (primera ejecución de Edge Function)

**Solución:**
- Es normal en la primera ejecución
- Esperá 2 minutos y reintentá
- La segunda vez será más rápida

### Problema: Error 500 Internal Server Error

**Causa:** Error en la Edge Function

**Solución:**
```powershell
# Ver logs en tiempo real
npx supabase functions logs api-search --follow
```

Ejecutá el test en otra terminal y verás el error completo.

---

## 📊 Orden de Archivos

```
scripts/
├── 01-create-api-key.sql        ← EJECUTAR PRIMERO (Supabase SQL Editor)
├── 02-verify-api-key.sql        ← Verificar que se creó
├── 03-test-api-simple.ps1       ← Test simple con timeout
└── test-api-search.ps1          ← Suite completa (7 tests)
```

---

## ✅ Checklist

Marcá cada paso:

- [ ] ✅ Ejecuté `01-create-api-key.sql` en Supabase
- [ ] ✅ Verifiqué con `02-verify-api-key.sql` que existe
- [ ] ✅ Ejecuté `03-test-api-simple.ps1` y funcionó
- [ ] ✅ Ejecuté `test-api-search.ps1` (suite completa)
- [ ] ✅ Todos los tests pasaron (7/7)

---

## 📞 Próximos Pasos

Una vez que todos los tests pasen:

1. **Revisar metadata extendida** - Verificar que los filtros se aplican
2. **Crear API keys de producción** - Con `environment = 'production'`
3. **Documentar para clientes** - Crear docs de integración
4. **Configurar monitoring** - Alertas de rate limiting

---

## 🔗 Links Útiles

- [Supabase Dashboard](https://supabase.com/dashboard/project/ujigyazketblwlzcomve)
- [SQL Editor](https://supabase.com/dashboard/project/ujigyazketblwlzcomve/editor)
- [Edge Functions Logs](https://supabase.com/dashboard/project/ujigyazketblwlzcomve/logs/edge-functions)
- [API Settings](https://supabase.com/dashboard/project/ujigyazketblwlzcomve/settings/api)
















