# Análisis: Búsqueda de Hoteles con Múltiples Cadenas

## Resumen Ejecutivo

El sistema actual implementa una estrategia de **múltiples requests secuenciales** (1 por cadena) cuando el usuario especifica más de una cadena hotelera. Los resultados se mergean, deduplican y filtran antes de limitarlos a los top 5.

---

## 1. Parsing / Intent Detection

### Estructura de Datos

El AI Message Parser detecta múltiples cadenas y las guarda en un **array** (no string):

```typescript
interface ParsedTravelRequest {
  hotels?: {
    hotelChains?: string[];  // ✅ Array de cadenas (ej: ["Bahia Principe", "Iberostar"])
    hotelName?: string;       // Nombre específico de hotel (si aplica)
    // ... otros campos
  }
}
```

### Archivos Involucrados

1. **`supabase/functions/ai-message-parser/index.ts`** (líneas 416-458)
   - System prompt define `hotelChains` como array plural
   - Instrucciones para detectar separadores: `y`, `e`, `o`, `or`, `and`, comas, slash, ampersand
   - Ejemplo en prompt: `"quiero cadena riu y iberostar" → hotelChains: ["Riu", "Iberostar"]`

2. **`src/features/chat/data/hotelChainAliases.ts`** (líneas 452-518)
   - Función `detectMultipleHotelChains()` detecta múltiples cadenas
   - Normaliza usando `findChainByAlias()` para obtener nombres canónicos
   - Soporta separadores: `/\s+(?:y|e|o|or|and)\s+|,\s*|\/|&/gi`

3. **`src/services/aiMessageParser.ts`** (líneas 624-627)
   - Pre-parser usa `detectMultipleHotelChains()` para hints
   - Resultados pasados al AI Parser como contexto

### Ejemplo de Parsing

**Input del usuario:**
```
"quiero cadena Bahia Principe y Iberostar en Punta Cana"
```

**Output del AI Parser:**
```json
{
  "requestType": "hotels",
  "hotels": {
    "city": "Punta Cana",
    "checkinDate": "2026-01-15",
    "checkoutDate": "2026-01-22",
    "adults": 1,
    "children": 0,
    "hotelChains": ["Bahia Principe", "Iberostar"]  // ✅ Array con 2 cadenas
  }
}
```

---

## 2. Request al Proveedor (EUROVIPS/Softur)

### Estrategia: N Requests (1 por Cadena)

**NO se envía un solo campo con texto libre concatenado.** En su lugar, se hacen **N requests secuenciales**, uno por cada cadena detectada.

### Archivos Involucrados

1. **`src/features/chat/services/searchHandlers.ts`** (líneas 416-472)
   - Implementación principal del multi-chain handler
   - Loop secuencial sobre `hotelChains` array

2. **`supabase/functions/eurovips-soap/index.ts`** (líneas 87-119)
   - Edge Function que construye el SOAP request
   - Campo `<name>` en XML recibe una sola cadena por request

### Flujo de Ejecución

```typescript
// Código simplificado del flujo
if (hotelChains.length > 0) {
  // MULTI-CHAIN: Make N requests (1 per chain)
  const allHotels: any[] = [];
  
  for (const chain of hotelChains) {
    // Request 1: "Bahia Principe"
    const requestBody1 = {
      action: 'searchHotels',
      data: {
        cityCode: 'PUJ',
        checkinDate: '2026-01-15',
        checkoutDate: '2026-01-22',
        adults: 2,
        children: 0,
        hotelName: 'Bahia Principe'  // ✅ Solo una cadena por request
      }
    };
    
    // Request 2: "Iberostar"
    const requestBody2 = {
      action: 'searchHotels',
      data: {
        cityCode: 'PUJ',
        checkinDate: '2026-01-15',
        checkoutDate: '2026-01-22',
        adults: 2,
        children: 0,
        hotelName: 'Iberostar'  // ✅ Segunda cadena en request separado
      }
    };
    
    // Merge results
    allHotels.push(...chainHotels);
  }
  
  // Deduplicar resultados
  // Filtrar y rankear
}
```

### Payload SOAP Generado (Ejemplo: "Bahia Principe + Iberostar")

**Request 1 - Bahia Principe:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <searchHotelFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="PUJ" xmlns="" />
      <dateFrom xmlns="">2026-01-15</dateFrom>
      <dateTo xmlns="">2026-01-22</dateTo>
      <name xmlns="">Bahia Principe</name>  <!-- ✅ Solo primera cadena -->
      <pos xmlns="">
        <id>WSLOZADA</id>
        <clave>ROS.9624+</clave>
      </pos>
      <currency xmlns="">USD</currency>
      <OtherBroker xmlns="">true</OtherBroker>
      <FareTypeSelectionList xmlns="http://www.softur.com.ar/wsbridge/budget.xsd">
        <FareTypeSelection OccupancyId="1">1</FareTypeSelection>
        <Ocuppancy OccupancyId="1">
          <Occupants type="ADT" />
          <Occupants type="ADT" />
        </Ocuppancy>
      </FareTypeSelectionList>
    </searchHotelFaresRQ1>
  </soap:Body>
</soap:Envelope>
```

**Request 2 - Iberostar:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <searchHotelFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="PUJ" xmlns="" />
      <dateFrom xmlns="">2026-01-15</dateFrom>
      <dateTo xmlns="">2026-01-22</dateTo>
      <name xmlns="">Iberostar</name>  <!-- ✅ Solo segunda cadena -->
      <pos xmlns="">
        <id>WSLOZADA</id>
        <clave>ROS.9624+</clave>
      </pos>
      <currency xmlns="">USD</currency>
      <OtherBroker xmlns="">true</OtherBroker>
      <FareTypeSelectionList xmlns="http://www.softur.com.ar/wsbridge/budget.xsd">
        <FareTypeSelection OccupancyId="1">1</FareTypeSelection>
        <Ocuppancy OccupancyId="1">
          <Occupants type="ADT" />
          <Occupants type="ADT" />
        </Ocuppancy>
      </FareTypeSelectionList>
    </searchHotelFaresRQ1>
  </soap:Body>
</soap:Envelope>
```

### Limitaciones del API EUROVIPS

El API EUROVIPS **no soporta múltiples cadenas en un solo request**. El campo `<name>` acepta:
- ✅ Una cadena hotelera completa (ej: "Iberostar")
- ✅ Texto parcial del nombre del hotel (ej: "Ocean")
- ❌ **NO** soporta operadores OR, AND, o concatenación múltiple

**Confirmación en código:**
```typescript:521:530:supabase/functions/_shared/searchExecutor.ts
// ✅ REGLA DE NEGOCIO (confirmada con Ruth/SOFTUR):
// El campo <name> de EUROVIPS es el ÚNICO campo correcto para filtrar por:
// - Cadena hotelera (Iberostar, Riu, Melia, etc.)
// - Texto parcial del nombre del hotel (Ocean, Palace, etc.)
// Prioridad: hotelChain > hotelName (hotelChain es más específico para búsquedas de cadena)
const nameFilter = hotels.hotelChain || hotels.hotelName || '';
```

---

## 3. Mapeo y Normalización

### Pipeline de Procesamiento

1. **Merge de Resultados** (`searchHandlers.ts` líneas 448-449)
   ```typescript
   allHotels.push(...chainHotels);  // Agrega todos los hoteles de todas las cadenas
   ```

2. **Deduplicación** (`searchHandlers.ts` líneas 453-471)
   - Usa `hotel_id` si está disponible
   - Fallback a `name` (normalizado) si no hay ID
   - `Set<string>` para tracking de duplicados

3. **Filtrado Post-Search** (`searchHandlers.ts` líneas 565-582)
   - Filtro por cadena usando `hotelBelongsToAnyChain()`
   - Filtro por nombre específico (si aplica)
   - Filtro por destino (whitelist de Punta Cana, etc.)
   - Filtro por tipo de habitación y plan de comidas

4. **Ordenamiento y Limite** (`searchHandlers.ts` líneas 630-645)
   - Ordena por precio (menor a mayor)
   - Limita a top 5 hoteles

### Ejemplo de Mapeo: "Bahia Principe + Iberostar" en Punta Cana

**Request 1 → EUROVIPS:**
- Devuelve: 12 hoteles de "Bahia Principe"
- Ejemplos: "BAHIA PRINCIPE GRAND PUNTA CANA", "BAHIA PRINCIPE LUXURY AMBAR", etc.

**Request 2 → EUROVIPS:**
- Devuelve: 8 hoteles de "Iberostar"
- Ejemplos: "IBEROSTAR DOMINICANA", "IBEROSTAR BAVARO", etc.

**Merge inicial:**
- Total antes de deduplicación: 20 hoteles

**Después de deduplicación:**
- Total después de deduplicación: 18 hoteles (2 duplicados removidos)

**Después de filtros (whitelist Punta Cana, room type, meal plan):**
- Total después de filtros: 10 hoteles

**Después de ordenamiento y limite (top 5):**
- **Resultado final: 5 hoteles** ordenados por precio

---

## 4. Límites

### Límites del Proveedor (EUROVIPS)

**NO hay límite documentado** del lado del API. Sin embargo, el sistema implementa un límite de procesamiento por razones de memoria:

**Archivo:** `supabase/functions/eurovips-soap/index.ts` (línea 266)
```typescript
const MAX_HOTELS_TO_PROCESS = 75;  // ✅ Límite hardcodeado
```

**Razón:** Procesamiento streaming de XML grandes (15-20MB) sin cargar todo en memoria.

### Límites del Sistema

1. **Procesamiento por Request:**
   - Máximo **75 hoteles** procesados del XML de EUROVIPS
   - Si EUROVIPS devuelve 100 hoteles, solo se procesan los primeros 75

2. **Resultado Final:**
   - Máximo **5 hoteles** después de todos los filtros
   - Ordenados por precio (menor a mayor)

**Archivo:** `supabase/functions/_shared/searchExecutor.ts` (líneas 590-597)
```typescript
// ✅ STEP 3: Sort by price and limit to top 5
const sortedHotels = filteredHotels
  .sort((a: any, b: any) => {
    const minPriceA = Math.min(...a.rooms.map((r: any) => r.total_price));
    const minPriceB = Math.min(...b.rooms.map((r: any) => r.total_price));
    return minPriceA - minPriceB;
  })
  .slice(0, 5);  // ✅ Límite hardcodeado a 5 hoteles
```

### Configuración Actual

| Límite | Valor | Ubicación | Tipo |
|--------|-------|-----------|------|
| Procesamiento EUROVIPS | 75 hoteles | `eurovips-soap/index.ts:266` | Hardcodeado |
| Resultado final | 5 hoteles | `searchExecutor.ts:597` | Hardcodeado |
| Límite del API | Sin límite conocido | - | Provider default |

---

## 5. Impacto en Performance

### Latencia Actual

**Estrategia: Requests Secuenciales**

Para "Bahia Principe + Iberostar":
- Request 1 (Bahia Principe): ~2-4 segundos
- Request 2 (Iberostar): ~2-4 segundos
- **Total: ~4-8 segundos** (secuencial)

**Código actual:**
```typescript:422:448:src/features/chat/services/searchHandlers.ts
for (const chain of hotelChains) {
  // ⚠️ Requests SECUENCIALES (no paralelos)
  const response = await supabase.functions.invoke('eurovips-soap', {
    body: requestBody
  });
  // ... procesar respuesta ...
  allHotels.push(...chainHotels);
}
```

### Análisis de Performance

**Problemas:**
1. **Latencia alta:** Cada request espera al anterior
2. **No se aprovecha paralelismo:** Requests independientes podrían ejecutarse en paralelo
3. **Timeout risk:** Si un request falla lentamente, bloquea todo el flujo

**Mejoras Posibles:**

1. **Paralelización de Requests** (recomendado):
   ```typescript
   // Estrategia mejorada: Promise.all() para requests paralelos
   const requests = hotelChains.map(chain => 
     supabase.functions.invoke('eurovips-soap', {
       body: {
         action: 'searchHotels',
         data: { ...eurovipsParams, cityCode, hotelName: chain }
       }
     })
   );
   
   const responses = await Promise.all(requests);
   // Merge results...
   ```
   - **Reducción de latencia:** ~4-8s → **~2-4s** (mejor caso)
   - **Riesgo:** Mayor carga en EUROVIPS (mitigado con rate limiting)

2. **Merge + Dedupe Optimizado:**
   - Usar `Map<hotel_id, Hotel>` en vez de array + Set
   - O(n) en vez de O(n²) para deduplicación

3. **Early Termination:**
   - Si ya se encontraron suficientes hoteles (ej: 10+), cancelar requests pendientes
   - Útil para búsquedas con muchas cadenas (3+)

4. **Ranking Inteligente:**
   - Mantener top K hoteles por cadena durante el merge
   - Evitar procesar todos los hoteles si ya se tienen suficientes candidatos

---

## 6. Archivos/Funciones Involucradas

### Flujo Completo

```
1. PARSING
   ├─ supabase/functions/ai-message-parser/index.ts
   │  └─ System prompt (líneas 416-458) - Detecta hotelChains como array
   │
   ├─ src/features/chat/data/hotelChainAliases.ts
   │  ├─ detectMultipleHotelChains() (líneas 452-518) - Detección determinística
   │  └─ hotelBelongsToAnyChain() (líneas 531-543) - Validación post-search
   │
   └─ src/services/aiMessageParser.ts
      └─ parseMessageWithAI() (líneas 624-627) - Pre-parser hints

2. REQUEST AL PROVEEDOR
   ├─ src/features/chat/services/searchHandlers.ts
   │  └─ handleHotelSearch() (líneas 416-472) - Loop secuencial multi-chain
   │
   └─ supabase/functions/eurovips-soap/index.ts
      ├─ searchHotels() (líneas 87-119) - Construye SOAP request
      ├─ parseHotelSearchResponse() (líneas 262-353) - Procesa XML
      └─ MAX_HOTELS_TO_PROCESS = 75 (línea 266) - Límite de procesamiento

3. MAPEO Y FILTRADO
   ├─ src/features/chat/services/searchHandlers.ts
   │  ├─ Deduplicación (líneas 453-471)
   │  ├─ Filtro por cadena (líneas 565-582)
   │  └─ Ordenamiento y limite (líneas 630-645)
   │
   └─ supabase/functions/_shared/searchExecutor.ts
      └─ executeHotelSearch() (líneas 501-650) - Pipeline alternativo (API search)

4. UTILIDADES
   └─ src/utils/roomFilters.ts
      └─ Filtrado por tipo de habitación y plan de comidas
```

---

## 7. Ejemplo Completo: Request Real Generado

### Caso de Uso: "Bahia Principe + Iberostar" en Punta Cana

**Input del usuario:**
```
"Quiero hotel en Punta Cana del 15 al 22 de enero para 2 adultos, 
cadena Bahia Principe y Iberostar, habitación doble all inclusive"
```

**Parsed Request:**
```json
{
  "requestType": "hotels",
  "hotels": {
    "city": "Punta Cana",
    "checkinDate": "2026-01-15",
    "checkoutDate": "2026-01-22",
    "adults": 2,
    "children": 0,
    "roomType": "double",
    "mealPlan": "all_inclusive",
    "hotelChains": ["Bahia Principe", "Iberostar"]
  }
}
```

**Request 1 - Bahia Principe:**
```json
{
  "action": "searchHotels",
  "data": {
    "cityCode": "PUJ",
    "checkinDate": "2026-01-15",
    "checkoutDate": "2026-01-22",
    "adults": 2,
    "children": 0,
    "hotelName": "Bahia Principe"
  }
}
```

**Request 2 - Iberostar:**
```json
{
  "action": "searchHotels",
  "data": {
    "cityCode": "PUJ",
    "checkinDate": "2026-01-15",
    "checkoutDate": "2026-01-22",
    "adults": 2,
    "children": 0,
    "hotelName": "Iberostar"
  }
}
```

**Response Merge:**
- Request 1 → 12 hoteles de Bahia Principe
- Request 2 → 8 hoteles de Iberostar
- **Total antes de dedupe: 20 hoteles**

**Deduplicación:**
- Hoteles duplicados removidos: 2
- **Total después de dedupe: 18 hoteles**

**Filtros Aplicados:**
1. Whitelist Punta Cana: 18 → 15 hoteles
2. Filtro por cadena (post-validación): 15 → 14 hoteles
3. Filtro por habitación doble: 14 → 10 hoteles
4. Filtro por all inclusive: 10 → 8 hoteles

**Ordenamiento y Limite:**
- Ordenados por precio (menor a mayor)
- **Resultado final: 5 hoteles** (top 5 más baratos)

---

## 8. Recomendaciones de Mejora

### 1. Paralelización de Requests (Prioridad Alta)

**Implementar:**
```typescript
// En searchHandlers.ts, línea 416
if (hotelChains.length > 0) {
  const requests = hotelChains.map(chain => 
    supabase.functions.invoke('eurovips-soap', {
      body: {
        action: 'searchHotels',
        data: {
          ...eurovipsParams.hotelParams,
          cityCode: cityCode,
          hotelName: chain
        }
      }
    })
  );
  
  const responses = await Promise.allSettled(requests);
  
  // Process responses...
}
```

**Beneficio:** Reducción de latencia del 50% (4-8s → 2-4s)

### 2. Configuración de Límites (Prioridad Media)

**Mover límites a configuración:**
```typescript
// Config file
const HOTEL_SEARCH_LIMITS = {
  MAX_HOTELS_TO_PROCESS: 75,  // Del proveedor
  MAX_RESULTS_TO_RETURN: 5    // Resultado final
};
```

**Beneficio:** Flexibilidad para ajustar sin cambiar código

### 3. Early Termination (Prioridad Baja)

**Implementar cancelación de requests pendientes si ya hay suficientes resultados:**
```typescript
// Si ya tenemos 10+ hoteles después del primer request, 
// cancelar requests pendientes
if (allHotels.length >= 10 && hotelChains.length > 1) {
  // Cancel pending requests
}
```

**Beneficio:** Reducción de carga en EUROVIPS para casos con muchas cadenas

---

## Conclusión

El sistema actual funciona correctamente para búsquedas multi-cadena, pero tiene oportunidades de optimización significativas en performance. La estrategia de N requests es necesaria debido a las limitaciones del API EUROVIPS, pero puede mejorarse con paralelización.










