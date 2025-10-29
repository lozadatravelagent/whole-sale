# 🔍 Cómo Verificar si el Código de `add-message` Está Actualizado en Supabase

## Método 1: Usar Supabase Dashboard (Más Fácil) ✅

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **Edge Functions** en el menú lateral
3. Click en **`add-message`**
4. Click en **"View source"** o **"View code"** (si está disponible)
5. Compara el código visualmente con tu archivo local: `supabase/functions/add-message/index.ts`

## Método 2: Usar Supabase CLI (Requiere Docker)

```powershell
# Descargar la función desplegada
npx supabase functions download add-message --legacy-bundle

# Comparar con el archivo local
git diff --no-index supabase/functions/add-message/index.ts [ruta-del-archivo-descargado]
```

**Nota:** Si no tienes Docker Desktop instalado, usa el Método 1 o Método 3.

## Método 3: Verificar por Versión y Fecha

Ya viste que la función está en la versión **13**, actualizada el **2025-10-04 14:20:53**.

Para verificar si tu código local es más reciente:

1. Revisa el historial de git:
```powershell
git log --oneline --since="2025-10-04" -- supabase/functions/add-message/index.ts
```

2. Si hay commits después del 2025-10-04, significa que tu código local es más nuevo y necesita ser desplegado.

3. Para desplegar cambios recientes:
```powershell
npx supabase functions deploy add-message
```

## Método 4: Comparar por Características Específicas

Busca en tu código local estas líneas clave que agregamos:

### ✅ Características del Fix de Duplicados:

1. **Validación de client_id** (línea ~46):
```typescript
if (!meta?.client_id) {
  console.warn('⚠️ [ADD-MESSAGE] Missing client_id - idempotency not guaranteed');
}
```

2. **Check de idempotencia** (línea ~111):
```typescript
if (meta?.client_id) {
  console.log('🔍 [IDEMPOTENCY] Checking for existing message with client_id:', meta.client_id);
  const { data: existingMessage, error: checkError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('meta->>client_id', meta.client_id)
    .maybeSingle();
```

3. **Manejo de ON CONFLICT** (línea ~164):
```typescript
if (!error && !data && meta?.client_id) {
  console.log('🔒 [ON CONFLICT] Duplicate detected via UNIQUE constraint, fetching existing message');
```

Si estas características NO están en Supabase Dashboard, necesitas desplegar.

## Método 5: Test Rápido en Producción

1. Envía un mensaje en producción
2. Revisa los logs de la función en Supabase Dashboard > Edge Functions > add-message > Logs
3. Busca estos logs:
   - `🔑 [IDEMPOTENCY] client_id:` - Debe aparecer
   - `🔍 [IDEMPOTENCY] Checking for existing message` - Debe aparecer
   - `🔒 [ON CONFLICT]` - Puede aparecer si hay duplicados

Si estos logs NO aparecen, tu código local NO está desplegado.

## 🚀 Desplegar Cambios Si Están Diferentes

Si confirmas que el código local es diferente o más nuevo:

```powershell
# Deploy la función
npx supabase functions deploy add-message

# Verificar que se desplegó correctamente
npx supabase functions list | Select-String "add-message"
```

Deberías ver que la versión incrementó (de 13 a 14, etc.) y la fecha se actualizó.

---

## 📋 Checklist Rápido

- [ ] Revisé el código en Supabase Dashboard
- [ ] Comparé con `supabase/functions/add-message/index.ts`
- [ ] Busqué las características del fix (client_id, idempotency)
- [ ] Revisé los logs en producción
- [ ] Si es necesario, desplegué con `npx supabase functions deploy add-message`

---

## ⚡ Solución Rápida: Ver Código en Dashboard

La forma más rápida es:

1. **Supabase Dashboard** → **Edge Functions** → **add-message**
2. No puedes ver el código fuente directamente en el dashboard, pero puedes:
   - Ver los **logs recientes** para verificar que tiene los nuevos logs del fix
   - Revisar la **fecha de última actualización** (2025-10-04 según viste)
   
3. Si tu último commit del archivo fue después del 2025-10-04, necesitas desplegar.

