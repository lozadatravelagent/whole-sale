# Fix: Filtro de Escalas por Horas en API

## ✅ IMPLEMENTACIÓN COMPLETADA

Se ha corregido el bug donde el filtro `maxLayoverHours` no se aplicaba en búsquedas vía API.

---

## 📝 CAMBIOS REALIZADOS

### Archivo: `supabase/functions/_shared/searchExecutor.ts`

#### 1. **Nueva función helper** (líneas 36-62)
```typescript
function calculateLayoverHours(arrivalSegment: any, departureSegment: any): number
```
- Calcula la duración de escalas entre segmentos consecutivos
- Maneja casos edge (datos faltantes, errores)
- Retorna 0 si faltan datos de tiempo/fecha

#### 2. **Bloque de filtrado** (líneas 344-383)
- Filtra vuelos ANTES de aplicar limit top 5
- Verifica CADA segmento de CADA leg de CADA opción
- Rechaza vuelos si CUALQUIER layover excede `maxLayoverHours`
- Logging detallado para debugging

#### 3. **Metadata extendida** (líneas 418-424)
- Nuevo campo: `layover_filter_applied`
  - `max_hours`: valor de filtro solicitado
  - `excluded_count`: cantidad de vuelos excluidos

---

## 🧪 TESTING

### Request de Prueba (reproducir input problemático)

**Endpoint**: `POST /v1/search`

**Headers**:
```json
{
  "X-API-Key": "tu_api_key_aqui",
  "Content-Type": "application/json"
}
```

**Body**:
```json
{
  "request_id": "test-maxlayover-combined-001",
  "prompt": "quiero un vuelo de buenos aires a punta cana saliendo la primera semana de enero 2026 durante 8 noches. con una escala de menos de 3 horas para 2 adultos tambien quiero un hotel playa del carmen para las mismas fechas all inclusive habitacion doble cadena riu.",
  "options": {
    "language": "es",
    "include_metadata": true
  }
}
```

---

## ✅ VERIFICACIÓN ESPERADA

### 1. **Logs del servidor** (revisar en Supabase Dashboard → Functions → api-search)

Deberías ver:
```
[FLIGHT_SEARCH] Transformed 15 flights from TVC
⏰ [LAYOVER FILTER] Filtering for layovers <= 3 hours
❌ [LAYOVER FILTER] Excluding flight tvc-fare-2: layover 5.2h > max 3h
❌ [LAYOVER FILTER] Excluding flight tvc-fare-5: layover 4.8h > max 3h
❌ [LAYOVER FILTER] Excluding flight tvc-fare-8: layover 6.1h > max 3h
📊 [LAYOVER FILTER] Flights: 15 → 12 (excluded: 3 flights with layovers > 3h)
```

### 2. **Response JSON**

Verificar estructura:
```json
{
  "request_id": "test-maxlayover-combined-001",
  "search_id": "search_...",
  "status": "completed",
  "parsed_request": {
    "type": "combined",
    "flights": {
      "origin": "Buenos Aires",
      "destination": "Punta Cana",
      "departureDate": "2026-01-05",
      "returnDate": "2026-01-13",
      "adults": 2,
      "children": 0,
      "maxLayoverHours": 3  // ← Debe estar presente
    },
    "hotels": { ... }
  },
  "results": {
    "type": "combined",
    "flights": {
      "count": 5,  // O menos si no hay suficientes con layovers < 3h
      "items": [
        {
          "id": "...",
          "legs": [
            {
              "options": [
                {
                  "segments": [
                    // Verificar manualmente layovers < 3h
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "hotels": { ... }
  },
  "metadata": {
    "layover_filter_applied": {
      "max_hours": 3,
      "excluded_count": 3  // Cantidad de vuelos excluidos
    },
    // ... otros metadatos
  }
}
```

### 3. **Verificación Manual de Layovers**

Para CADA vuelo en `results.flights.items`:

```javascript
// Pseudo-código para verificar
for (const flight of results.flights.items) {
  for (const leg of flight.legs) {
    for (const option of leg.options) {
      const segments = option.segments;
      for (let i = 0; i < segments.length - 1; i++) {
        const arrivalTime = new Date(`${segments[i].arrival.date}T${segments[i].arrival.time}`);
        const departureTime = new Date(`${segments[i+1].departure.date}T${segments[i+1].departure.time}`);
        const layoverHours = (departureTime - arrivalTime) / (1000 * 60 * 60);

        assert(layoverHours <= 3, `Layover ${layoverHours}h excede máximo de 3h`);
      }
    }
  }
}
```

---

## 🔍 CASOS EDGE A TESTEAR

### Test Case 1: Sin maxLayoverHours
```json
{
  "request_id": "test-no-maxlayover-001",
  "prompt": "vuelo buenos aires a miami 15 enero 2026"
}
```
**Esperado**: NO debe aparecer `layover_filter_applied` en metadata

---

### Test Case 2: maxLayoverHours con vuelos directos disponibles
```json
{
  "request_id": "test-direct-available-001",
  "prompt": "vuelo buenos aires a sao paulo 20 enero con escala de menos de 2 horas"
}
```
**Esperado**:
- Debe incluir vuelos directos (layover = 0)
- Debe incluir vuelos con conexiones < 2h
- Debe excluir vuelos con conexiones >= 2h

---

### Test Case 3: maxLayoverHours muy restrictivo (ej: 1 hora)
```json
{
  "request_id": "test-restrictive-001",
  "prompt": "vuelo buenos aires a madrid con escalas de menos de 1 hora"
}
```
**Esperado**:
- Probablemente retorne 0 resultados (muy restrictivo)
- Metadata: `excluded_count` alto
- Response: `results.flights.count: 0`

---

### Test Case 4: Búsqueda combinada (vuelo + hotel) con maxLayoverHours
```json
{
  "request_id": "test-combined-001",
  "prompt": "vuelo y hotel punta cana enero 2026 con escala de menos de 4 horas habitacion doble"
}
```
**Esperado**:
- `parsed_request.type`: "combined"
- Filtro de layover aplicado solo a vuelos, no a hoteles
- Metadata incluye `layover_filter_applied`

---

## 🐛 DEBUGGING

Si el filtro NO funciona:

1. **Verificar que `maxLayoverHours` se extrajo del prompt**:
   - Revisar `parsed_request.flights.maxLayoverHours` en response
   - Si es `null` o `undefined` → problema en el parser AI

2. **Verificar logs del servidor**:
   - Buscar línea: `⏰ [LAYOVER FILTER] Filtering for layovers <= X hours`
   - Si NO aparece → `maxLayoverHours` no llegó a `executeFlightSearch`

3. **Verificar estructura de segments**:
   - Revisar que `segments[i].arrival.time` y `segments[i].arrival.date` existan
   - Si faltan → `calculateLayoverHours` retorna 0 (no filtra)

---

## 📊 COMPARACIÓN: ANTES vs DESPUÉS

### ANTES (bug)
```
INPUT: "con una escala de menos de 3 horas"
API Response: 5 vuelos (algunos con layovers de 5h, 6h, etc.)
Metadata: No layover filter info
```

### DESPUÉS (fix)
```
INPUT: "con una escala de menos de 3 horas"
API Response: 5 vuelos (TODOS con layovers < 3h)
Metadata: {
  "layover_filter_applied": {
    "max_hours": 3,
    "excluded_count": 7
  }
}
```

---

## 🔗 ARCHIVOS MODIFICADOS

- `supabase/functions/_shared/searchExecutor.ts`:
  - Líneas 36-62: Nueva función `calculateLayoverHours()`
  - Líneas 344-383: Bloque de filtrado por `maxLayoverHours`
  - Líneas 418-424: Metadata extendida

---

## ✅ CHECKLIST FINAL

- [x] Función `calculateLayoverHours()` implementada
- [x] Bloque de filtrado agregado ANTES de limit top 5
- [x] Metadata `layover_filter_applied` incluida en response
- [x] Logging detallado para debugging
- [x] Manejo de edge cases (datos faltantes, errores)
- [x] Documentación de testing completa

---

## 📞 SOPORTE

Si encuentras algún issue:
1. Captura el `request_id` de la búsqueda problemática
2. Revisa logs en Supabase Dashboard
3. Verifica que `maxLayoverHours` esté en `parsed_request.flights`
4. Reporta con el JSON completo del request/response
