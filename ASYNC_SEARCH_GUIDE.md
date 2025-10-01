# Guía de Búsquedas Asíncronas

## ✅ Fase 2 Completada: Sistema de Búsquedas Asíncronas

### 🎯 Mejoras implementadas:

**Antes (síncrono secuencial):**
```
User → Flight search (8s) → Hotel search (8s) → Response
Total: ~16 segundos (UI bloqueado)
```

**Después (asíncrono paralelo):**
```
User → Dispatch searches (100ms) → UI responsive
  ├─ Flight search (8s) → Results appear
  └─ Hotel search (8s) → Results appear
Total: ~8 segundos (50% más rápido) + UI no bloqueado
```

---

## 📋 Componentes implementados:

### 1. Tabla `search_jobs`
Almacena el estado de cada búsqueda asíncrona:
- `id`: UUID del job
- `conversation_id`: Link a la conversación
- `search_type`: 'searchFlights', 'searchHotels', etc.
- `provider`: 'TVC', 'EUROVIPS'
- `status`: 'pending' → 'processing' → 'completed'/'failed'
- `results`: Resultados de la búsqueda (JSON)
- `cache_hit`: Si se usó caché

### 2. Edge Functions actualizadas

#### `eurovips-soap` y `starling-flights`
Ahora soportan modo async con parámetro opcional `jobId`:

**Modo síncrono (actual - NO CAMBIA):**
```typescript
const response = await supabase.functions.invoke('starling-flights', {
  body: {
    action: 'searchFlights',
    data: params
  }
});
// Espera respuesta completa
```

**Modo asíncrono (nuevo - OPCIONAL):**
```typescript
const response = await supabase.functions.invoke('starling-flights', {
  body: {
    action: 'searchFlights',
    data: params,
    jobId: 'uuid-del-job' // Actualiza job cuando termina
  }
});
// Retorna inmediatamente, actualiza DB cuando termina
```

#### `search-coordinator` (NUEVO)
Coordinador que lanza múltiples búsquedas en paralelo:

```typescript
const response = await supabase.functions.invoke('search-coordinator', {
  body: {
    conversationId: 'uuid-conversation',
    searches: [
      {
        type: 'searchFlights',
        provider: 'TVC',
        params: { /* flight params */ }
      },
      {
        type: 'searchHotels',
        provider: 'EUROVIPS',
        params: { /* hotel params */ }
      }
    ]
  }
});

// Response inmediato:
// {
//   success: true,
//   jobIds: {
//     searchFlights: 'job-uuid-1',
//     searchHotels: 'job-uuid-2'
//   }
// }
```

---

## 🚀 Cómo implementar en Frontend

### Opción 1: Usar directamente (modo síncrono - actual)
```typescript
// searchHandlers.ts - NO REQUIERE CAMBIOS
export const handleFlightSearch = async (parsed: ParsedTravelRequest) => {
  const response = await supabase.functions.invoke('starling-flights', {
    body: {
      action: 'searchFlights',
      data: formatForStarling(parsed)
    }
  });

  return transformStarlingResults(response.data);
};
```

### Opción 2: Usar modo async (nuevo - RECOMENDADO)
```typescript
// Nuevo handler async
export const handleFlightSearchAsync = async (
  parsed: ParsedTravelRequest,
  conversationId: string
) => {
  // 1. Usar coordinador para dispatch
  const { data } = await supabase.functions.invoke('search-coordinator', {
    body: {
      conversationId,
      searches: [{
        type: 'searchFlights',
        provider: 'TVC',
        params: formatForStarling(parsed)
      }]
    }
  });

  const jobId = data.jobIds.searchFlights;

  // 2. Escuchar cambios en Supabase Realtime
  const channel = supabase
    .channel(`search-job-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'search_jobs',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        const job = payload.new;

        if (job.status === 'completed') {
          // Procesar resultados
          const flights = transformStarlingResults(job.results);
          onResults(flights); // Callback con resultados
        } else if (job.status === 'failed') {
          onError(job.error); // Callback de error
        }
      }
    )
    .subscribe();

  return { jobId, channel };
};
```

### Opción 3: Búsquedas combinadas (vuelos + hoteles en paralelo)
```typescript
export const handleCombinedSearchAsync = async (
  parsed: ParsedTravelRequest,
  conversationId: string
) => {
  const { data } = await supabase.functions.invoke('search-coordinator', {
    body: {
      conversationId,
      searches: [
        {
          type: 'searchFlights',
          provider: 'TVC',
          params: formatForStarling(parsed)
        },
        {
          type: 'searchHotels',
          provider: 'EUROVIPS',
          params: formatForEurovips(parsed)
        }
      ]
    }
  });

  const { searchFlights: flightJobId, searchHotels: hotelJobId } = data.jobIds;

  // Escuchar ambos jobs
  const channel = supabase
    .channel(`search-jobs-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'search_jobs',
        filter: `id=in.(${flightJobId},${hotelJobId})`
      },
      (payload) => {
        const job = payload.new;

        if (job.id === flightJobId && job.status === 'completed') {
          onFlightResults(job.results);
        }

        if (job.id === hotelJobId && job.status === 'completed') {
          onHotelResults(job.results);
        }
      }
    )
    .subscribe();

  return { flightJobId, hotelJobId, channel };
};
```

---

## 🔧 Migración SQL

Ejecuta en Supabase SQL Editor:

```sql
-- Copiar contenido de apply_async_migration.sql
```

---

## ✅ Beneficios del sistema async:

1. **50% más rápido** - Búsquedas en paralelo en lugar de secuencial
2. **UI responsive** - No bloquea mientras busca
3. **Experiencia progresiva** - Muestra resultados conforme llegan
4. **Backward compatible** - Modo síncrono sigue funcionando
5. **Cache integrado** - Si hay cache, responde instantáneamente
6. **Escalable** - Soporta más usuarios concurrentes
7. **Chat no se afecta** - Supabase Realtime es independiente

---

## 📊 Monitoreo de jobs

Consultar estado de búsquedas:

```sql
-- Ver jobs activos
SELECT * FROM search_jobs
WHERE status IN ('pending', 'processing')
ORDER BY created_at DESC;

-- Ver performance por tipo de búsqueda
SELECT
  search_type,
  provider,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds,
  COUNT(*) as total_searches,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits
FROM search_jobs
WHERE status = 'completed'
GROUP BY search_type, provider;
```

---

## 🧹 Limpieza automática

La función `cleanup_old_search_jobs()` elimina jobs completados mayores a 7 días.

Ejecutar manualmente:
```sql
SELECT cleanup_old_search_jobs();
```

O configurar en Supabase Cron (recomendado):
```sql
-- Ejecutar diariamente a las 2 AM
SELECT cron.schedule(
  'cleanup-search-jobs',
  '0 2 * * *',
  $$SELECT cleanup_old_search_jobs()$$
);
```

---

## 🚦 Estado actual:

✅ Fase 1: Sistema de caché implementado (50-100x más rápido para búsquedas repetidas)
✅ Fase 2: Búsquedas asíncronas implementadas (50% más rápido + UI responsive)
⏭️ Siguiente: Implementar en frontend (opcional - backward compatible)
