# 🛠️ FIX: Mensajes Duplicados en Chat - Implementación Completa

## 📋 Resumen

Este fix elimina los mensajes duplicados en el feature Chat implementando:
1. **De-dupe robusto en FE** con `client_id` único
2. **Propagación end-to-end** del `client_id` (FE → Edge → DB)
3. **Constraint UNIQUE** en DB + `ON CONFLICT` para idempotencia

---

## ✅ Checklist de Implementación

- [x] **PASO 1**: De-dupe FE con `client_id`
  - [x] Generar `client_id` (uuid v4) en `useMessageHandler.ts`
  - [x] UI optimista con `temp-${clientId}`
  - [x] Reconciliación por `client_id` en Realtime (5 pasos)

- [x] **PASO 2**: Propagar `client_id` end-to-end
  - [x] `messageService.ts` incluye `client_id` en tipo y logs
  - [x] Edge Function valida y propaga `client_id`
  - [x] Idempotencia lógica temporal (check previo al INSERT)

- [x] **PASO 3**: UNIQUE constraint + ON CONFLICT
  - [x] Migración SQL creada: `20251028000001_add_client_id_idempotency.sql`
  - [x] Edge Function usa `.maybeSingle()` y maneja duplicados
  - [x] Logs de trazabilidad completos

- [ ] **Tests**: Unit + E2E
- [ ] **Verificación**: Funcionamiento end-to-end

---

## 🚀 Aplicar la Migración

### Opción 1: Supabase CLI (Recomendado)

```bash
# 1. Asegúrate de estar en la raíz del proyecto
cd C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai

# 2. Aplica la migración
npx supabase db push

# 3. Verifica que se aplicó correctamente
npx supabase db diff

# 4. (Opcional) Ejecuta queries de verificación
npx supabase db execute --file supabase/migrations/20251028000001_add_client_id_idempotency.sql --dry-run
```

### Opción 2: Supabase Dashboard (Manual)

1. Ve a tu proyecto en https://supabase.com/dashboard
2. Navega a **SQL Editor**
3. Copia el contenido de `supabase/migrations/20251028000001_add_client_id_idempotency.sql`
4. Ejecuta el script
5. Verifica con:
   ```sql
   -- Check columna agregada
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'messages' AND column_name = 'client_id';

   -- Check índices creados
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'messages' AND indexname LIKE '%client%';
   ```

---

## 🧪 Tests Rápidos

### Test Manual 1: Envío Simple

1. **Abrir app en 2 tabs** (mismo navegador)
2. **Login** como mismo usuario
3. **Tab 1**: Crear conversación nueva
4. **Tab 1**: Enviar mensaje "Test 1"
5. **Verificar**:
   - ✅ Aparece 1 vez en Tab 1
   - ✅ Aparece 1 vez en Tab 2 (Realtime)
   - ✅ Logs muestran `client_id` único

### Test Manual 2: Doble Click

1. **Login** en la app
2. **Crear conversación**
3. **Enviar mensaje** haciendo **doble click rápido** en el botón
4. **Verificar**:
   - ✅ Solo aparece 1 vez en UI
   - ✅ Logs muestran mismo `client_id`
   - ✅ Edge Function logs: `IDEMPOTENCY - Message already exists`

### Test Manual 3: Red Lenta (Simular Retry)

1. **Chrome DevTools** → Network → Throttling: **Slow 3G**
2. **Enviar mensaje**
3. **Verificar**:
   - ✅ UI optimista muestra mensaje inmediatamente
   - ✅ Cuando llega respuesta del servidor, reemplaza (no duplica)
   - ✅ Logs: `Replacing optimistic message with real one (matched by client_id)`

---

## 📊 Logs de Trazabilidad

### Frontend (useMessageHandler.ts)
```
🔑 [IDEMPOTENCY] Generated client_id: a1b2c3d4-...
⚡ [OPTIMISTIC UI] Adding user message to UI instantly
📤 [MESSAGE FLOW] Step 2: Saving user message to database
```

### Service (messageService.ts)
```
📤 [SUPABASE FUNCTION] About to call add-message function
🔑 [IDEMPOTENCY] client_id: a1b2c3d4-...
```

### Edge Function (add-message/index.ts)
```
🔑 [IDEMPOTENCY] client_id: a1b2c3d4-...
📋 [TRACE] conversation_id: conv-123, role: user
🔍 [IDEMPOTENCY] Checking for existing message with client_id: a1b2c3d4-...
💾 [INSERT] Attempting to insert message with client_id: a1b2c3d4-...
✅ [ADD-MESSAGE] Message inserted successfully: msg-456
🔑 [TRACE] Final message - id: msg-456, client_id: a1b2c3d4-...
```

### Realtime (useChat.ts)
```
🔔 [REALTIME] Global message event received: INSERT for conversation: conv-123
📨 [REALTIME] Message for this conversation: INSERT {...}
🔒 [REALTIME] Message with client_id already exists, skipping: a1b2c3d4-...
```

**Si hay duplicado detectado**:
```
✅ [IDEMPOTENCY] Message already exists, returning existing: msg-456
```

---

## 🐛 Troubleshooting

### Problema: Mensajes aún duplicados

**Diagnóstico**:
1. Verificar migración aplicada:
   ```sql
   SELECT * FROM information_schema.columns
   WHERE table_name = 'messages' AND column_name = 'client_id';
   ```
2. Verificar índice único:
   ```sql
   SELECT * FROM pg_indexes
   WHERE tablename = 'messages' AND indexname = 'idx_messages_conversation_client_unique';
   ```
3. Verificar logs en browser console (buscar `client_id`)
4. Verificar logs en Supabase Edge Functions

**Solución**:
- Si migración no aplicada → ejecutar migración
- Si `client_id` es `null` en logs → verificar que FE genere UUID
- Si duplicados persisten → revisar Realtime subscription (debe estar en `useEffect` con deps correctas)

### Problema: Error "unique constraint violation"

**Esto es CORRECTO** - significa que el sistema está funcionando.

El error `23505` se captura en la Edge Function y retorna el mensaje existente (idempotencia).

### Problema: `client_id` undefined en Edge logs

**Diagnóstico**:
- Verificar que FE incluya `client_id` en `meta`
- Verificar que `messageService.ts` propague `meta` completo

**Solución**:
```typescript
// En useMessageHandler.ts, línea 290 y 304
meta: { status: 'sending', client_id: clientId }
```

---

## 📈 Métricas de Éxito

Después del fix, deberías ver:

- ✅ **0 mensajes duplicados** en UI
- ✅ **Logs de idempotencia** cuando hay retry
- ✅ **1 fila en DB** por `client_id` único
- ✅ **Realtime sincroniza** sin duplicar

### Query para verificar duplicados

```sql
-- Buscar mensajes con mismo client_id (NO debería haber duplicados)
SELECT
  client_id,
  conversation_id,
  COUNT(*) as count,
  array_agg(id) as message_ids
FROM public.messages
WHERE client_id IS NOT NULL
GROUP BY client_id, conversation_id
HAVING COUNT(*) > 1;

-- Si retorna filas, hay duplicados (malo)
-- Si retorna 0 filas, todo bien (bueno)
```

---

## 🧬 Arquitectura de la Solución

```
USER CLICK
    ↓
[1] Generate client_id (uuid v4)
    ↓
[2] Optimistic UI (temp-${clientId})
    ↓
[3] POST /add-message
    ├─ [4] Edge: Check existing by client_id
    ├─ [5] Edge: INSERT with client_id
    └─ [6] DB: UNIQUE constraint prevents duplicate
    ↓
[7] Return: existing or new message
    ↓
[8] Realtime: Broadcast INSERT event
    ↓
[9] FE: De-dupe by client_id (5 steps)
    ├─ Check by client_id ✅ (strongest)
    ├─ Check by id
    ├─ Reconcile optimistic by client_id ✅ (priority)
    ├─ Heuristic fallback (legacy)
    └─ Add as new (only if no match)
    ↓
RESULT: 1 mensaje en UI
```

---

## 📚 Archivos Modificados

### Frontend
- ✅ `src/features/chat/hooks/useMessageHandler.ts` - Genera `client_id`
- ✅ `src/hooks/useChat.ts` - De-dupe robusto en Realtime
- ✅ `src/features/chat/services/messageService.ts` - Propaga `client_id`

### Backend (Supabase)
- ✅ `supabase/functions/add-message/index.ts` - Validación e idempotencia
- ✅ `supabase/migrations/20251028000001_add_client_id_idempotency.sql` - UNIQUE constraint

### Dependencias
- ✅ `package.json` - Agregado `uuid` y `@types/uuid`

---

## 🎯 Próximos Pasos

1. **Aplicar migración** (ver sección "Aplicar la Migración")
2. **Test manual** (ver sección "Tests Rápidos")
3. **Agregar tests unitarios** (opcional, ver sección siguiente)
4. **Deploy a producción**

---

## 🧪 Tests Unitarios (Opcional)

### Test: De-dupe por client_id

```typescript
// tests/unit/useMessages.dedupe.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessages } from '@/hooks/useChat';

describe('Message de-dupe by client_id', () => {
  it('should not duplicate message with same client_id', () => {
    const conversationId = 'test-conv';
    const clientId = 'client-123';

    const { result } = renderHook(() => useMessages(conversationId));

    // Add optimistic message
    act(() => {
      result.current.addOptimisticMessage({
        id: `temp-${clientId}`,
        conversation_id: conversationId,
        role: 'user',
        content: { text: 'Hello' },
        meta: { client_id: clientId },
        created_at: new Date().toISOString()
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe(`temp-${clientId}`);

    // Simulate realtime event with real ID but same client_id
    act(() => {
      window.dispatchEvent(new CustomEvent('supabase-message', {
        detail: {
          payload: {
            eventType: 'INSERT',
            new: {
              id: 'real-456',
              conversation_id: conversationId,
              role: 'user',
              content: { text: 'Hello' },
              meta: { client_id: clientId },
              created_at: new Date().toISOString()
            }
          }
        }
      }));
    });

    // Should replace, not add
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe('real-456');
  });
});
```

---

## 💡 Notas Finales

- **client_id es generado en FE**, no en BE (permite UI optimista)
- **UNIQUE constraint en DB** es la barrera definitiva (previene race conditions)
- **De-dupe en FE** mejora UX (evita parpadeos)
- **Idempotencia en Edge** previene duplicados en retry
- **Logs completos** facilitan debugging

**Si tienes dudas, revisa los logs en consola del browser y en Supabase Edge Functions.**
