# Análisis End-to-End: Sistema de PDF con Múltiples Hoteles

**Tech Lead & QA Analysis**  
**Fecha**: Diciembre 2025  
**Objetivo**: Detectar problemas en el procesamiento de búsquedas Vuelo + Hotel cuando hay 1, 2 o más hoteles

---

## 1. Flujo Completo del Sistema

### 1.1 Flujo de Datos: Búsqueda → Payload → Render HTML → PDF

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. BÚSQUEDA COMBINADA (handleCombinedSearch)                   │
│    └─> handleFlightSearch() → FlightData[]                      │
│    └─> handleHotelSearch() → HotelData[]                       │
│    └─> CombinedTravelResults { flights, hotels }                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. SELECCIÓN DE HOTELES (CombinedTravelSelector)                │
│    └─> Usuario selecciona hoteles y habitaciones               │
│    └─> selectedHotelDataWithRooms: HotelDataWithSelectedRoom[] │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. PREPARACIÓN DE DATOS (prepareCombinedPdfData)              │
│    └─> hotels.map() → best_hotels[]                            │
│    └─> Calcula total_price (suma todos los hoteles)             │
│    └─> Extrae checkin/checkout del primer hotel                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. GENERACIÓN DE PDF (PDFMonkey API)                           │
│    └─> Template: combined-flight-hotel.html                  │
│    └─> Payload: { selected_flights, best_hotels, ... }          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. RENDER HTML (Liquid Template Engine)                        │
│    └─> Loop: {% for best_hotel in best_hotels %}              │
│    └─> Resumen: best_hotels[0] (HARDCODED)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Archivos Clave del Flujo

| Etapa | Archivo | Función Principal |
|-------|---------|-------------------|
| Búsqueda | `src/features/chat/services/searchHandlers.ts` | `handleCombinedSearch()` |
| Selección | `src/components/crm/CombinedTravelSelector.tsx` | `handleGeneratePdf()` |
| Preparación | `src/services/pdfMonkey.ts` | `prepareCombinedPdfData()` |
| Template | `src/templates/pdf/combined-flight-hotel.html` | Render HTML con Liquid |
| Generación | `src/services/pdfMonkey.ts` | `generateCombinedTravelPdf()` |

---

## 2. Análisis del Template HTML

### 2.1 Estructura del Template

**Archivo**: `src/templates/pdf/combined-flight-hotel.html`

#### 2.1.1 Página de Resumen (Summary Page)

**Líneas 21-329**: Página inicial con resumen del viaje

**🔴 PROBLEMA CRÍTICO #1: Hardcode a `best_hotels[0]`**

```58:134:src/templates/pdf/combined-flight-hotel.html
{% if best_hotels[0] %}
<div class="package-card best-deal">
  <!-- ... -->
  <div class="sc-text">{{ best_hotels[0].name }}</div>
  <div class="sc-text">{{ best_hotels[0].stars }} estrellas</div>
  <div class="sc-text">{{ best_hotels[0].location }}</div>
  <div class="sc-text">Precio: ${{ best_hotels[0].price }} {{ selected_flights[0].price.currency }}</div>
</div>
{% endif %}
```

**Análisis**:
- ✅ El template verifica si existe `best_hotels[0]`
- ❌ **Solo muestra el primer hotel** en el resumen, ignorando hoteles adicionales
- ❌ Si hay 2+ hoteles, solo se muestra el primero en la página de resumen
- ✅ El precio total (`total_price`) sí suma todos los hoteles (calculado en `prepareCombinedPdfData`)

#### 2.1.2 Alternativas de Hotel (Package Options 2 y 3)

**Líneas 171-321**: Paquetes alternativos basados en `best_hotels[0].alternatives`

**🔴 PROBLEMA CRÍTICO #2: Alternativas solo del primer hotel**

```172:201:src/templates/pdf/combined-flight-hotel.html
{% if best_hotels[0] and best_hotels[0].alternatives and best_hotels[0].alternatives[0] %}
<div class="package-card">
  <!-- Package Option 2: Alternative Hotel 1 -->
  {{ best_hotels[0].alternatives[0].name }}<br>
  <!-- ... -->
</div>
{% endif %}
```

**Análisis**:
- ❌ **Solo busca alternativas en `best_hotels[0]`**
- ❌ Si el usuario selecciona 2 hoteles diferentes, el segundo hotel nunca aparece en alternativas
- ❌ El campo `alternatives` no se está populando en `prepareCombinedPdfData` (ver sección 3.2)

#### 2.1.3 Loop de Páginas Individuales de Hoteles

**Líneas 450-519**: Genera una página por cada hotel

**✅ FUNCIONA CORRECTAMENTE**

```451:519:src/templates/pdf/combined-flight-hotel.html
{% for best_hotel in best_hotels %}
<div class="page">
  <div class="quote-container">
    <h1 class="hotel-title">{{ best_hotel.name }}</h1>
    <div class="detail-row">
      <span class="detail-value">{{ best_hotel.location }}</span>
    </div>
    <div class="detail-row">
      <span class="detail-value">{{ best_hotel.stars }} estrellas</span>
    </div>
    <!-- ... -->
  </div>
</div>
{% endfor %}
```

**Análisis**:
- ✅ **El loop itera correctamente sobre todos los hoteles**
- ✅ Cada hotel genera su propia página con sus datos específicos
- ✅ No hay pisado de datos entre hoteles en las páginas individuales

---

## 3. Análisis de la Preparación de Datos

### 3.1 Función `prepareCombinedPdfData`

**Archivo**: `src/services/pdfMonkey.ts` (líneas 576-852)

#### 3.1.1 Mapeo de Hoteles

**✅ FUNCIONA CORRECTAMENTE: Mapea todos los hoteles**

```633:674:src/services/pdfMonkey.ts
const best_hotels = hotels.map((hotel, index) => {
  console.log(`🔧 Processing hotel ${index + 1} for template:`, {
    name: hotel.name,
    city: hotel.city,
    nights: hotel.nights,
    rooms_count: hotel.rooms?.length || 0,
    has_selected_room: !!(hotel as HotelDataWithSelectedRoom).selectedRoom
  });

  // Use the selected room if available, otherwise find the cheapest room
  const hotelWithRoom = hotel as HotelDataWithSelectedRoom;
  const roomToUse = hotelWithRoom.selectedRoom || hotel.rooms.reduce((cheapest, room) =>
    room.total_price < cheapest.total_price ? room : cheapest
  );

  return {
    name: hotel.name,
    stars: hotel.category || "5",
    location: hotel.address || `${hotel.city}, República Dominicana`,
    price: formatPriceForTemplate(priceForAllNights),
    link: `https://wholesale-connect.com/hotel/${hotel.id}`
  };
});
```

**Análisis**:
- ✅ **Mapea correctamente todos los hoteles** del array `hotels`
- ✅ Cada hotel mantiene sus datos independientes (name, stars, location, price)
- ✅ Usa la habitación seleccionada o la más barata como fallback
- ❌ **No incluye campo `alternatives`** (ver problema #2)

#### 3.1.2 Extracción de Fechas

**🔴 PROBLEMA CRÍTICO #3: Fechas solo del primer hotel**

```676:681:src/services/pdfMonkey.ts
// Extract key dates from first hotel or flight
const firstHotel = hotels[0];
const firstFlight = flights[0];

const checkin = firstHotel?.check_in || firstFlight?.departure_date || new Date().toISOString().split('T')[0];
const checkout = firstHotel?.check_out || firstFlight?.return_date || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
```

**Análisis**:
- ❌ **Solo toma fechas del primer hotel** (`hotels[0]`)
- ❌ Si hay múltiples hoteles con diferentes fechas, solo se usa el primero
- ⚠️ **Impacto**: El resumen del PDF mostrará fechas incorrectas si hay hoteles con fechas diferentes

#### 3.1.3 Cálculo de Precio Total

**✅ FUNCIONA CORRECTAMENTE: Suma todos los hoteles**

```692:724:src/services/pdfMonkey.ts
// Calculate total price (flights + hotels)
let totalFlightPrice = 0;
let totalHotelPrice = 0;

// Sum all flight prices
flights.forEach(flight => {
  const flightPrice = typeof flight.price.amount === 'string' ? parseFloat(flight.price.amount) : flight.price.amount;
  totalFlightPrice += flightPrice || 0;
});

// Sum all hotel prices (using selected rooms and multiplying by nights)
hotels.forEach(hotel => {
  const hotelWithRoom = hotel as HotelDataWithSelectedRoom;
  const roomToUse = hotelWithRoom.selectedRoom || hotel.rooms.reduce((cheapest, room) =>
    room.total_price < cheapest.total_price ? room : cheapest
  );

  const priceForAllNights = roomToUse.total_price;
  totalHotelPrice += priceForAllNights || 0;
});

const totalPrice = totalFlightPrice + totalHotelPrice;
```

**Análisis**:
- ✅ **Suma correctamente todos los precios de hoteles**
- ✅ Usa `forEach` para iterar sobre todos los hoteles
- ✅ El `total_price` en el template refleja la suma correcta

---

## 4. Checklist de Campos por Hotel

### 4.1 Campos en el Template HTML

| Campo | Ubicación en Template | Renderiza por Hotel | Estado |
|-------|---------------------|---------------------|--------|
| **Nombre** | `best_hotel.name` | ✅ Sí (páginas individuales)<br>❌ No (resumen usa `best_hotels[0]`) | ⚠️ Parcial |
| **Estrellas** | `best_hotel.stars` | ✅ Sí (páginas individuales)<br>❌ No (resumen usa `best_hotels[0]`) | ⚠️ Parcial |
| **Ubicación** | `best_hotel.location` | ✅ Sí (páginas individuales)<br>❌ No (resumen usa `best_hotels[0]`) | ⚠️ Parcial |
| **Precio** | `best_hotel.price` | ✅ Sí (páginas individuales)<br>❌ No (resumen usa `best_hotels[0]`) | ⚠️ Parcial |
| **Link** | `best_hotel.link` | ✅ Sí (páginas individuales) | ✅ OK |
| **Ocupación** | `adults` / `childrens` | ❌ Global (no por hotel) | ⚠️ Usa valores del primer vuelo |
| **Fechas** | `checkin` / `checkout` | ❌ Global (no por hotel) | ❌ Solo del primer hotel |
| **Alternativas** | `best_hotel.alternatives` | ❌ No implementado | ❌ No se popula en mapper |

### 4.2 Campos en el Payload JSON

**Estructura generada por `prepareCombinedPdfData`**:

```json
{
  "selected_flights": [...],
  "best_hotels": [
    {
      "name": "Hotel 1",
      "stars": "5",
      "location": "Dirección Hotel 1",
      "price": "1.500,00",
      "link": "https://..."
    },
    {
      "name": "Hotel 2",
      "stars": "4",
      "location": "Dirección Hotel 2",
      "price": "2.000,00",
      "link": "https://..."
    }
  ],
  "checkin": "2025-01-15",  // ⚠️ Solo del primer hotel
  "checkout": "2025-01-22", // ⚠️ Solo del primer hotel
  "adults": 2,              // ⚠️ Solo del primer vuelo
  "childrens": 0,           // ⚠️ Solo del primer vuelo
  "total_price": "3.500,00", // ✅ Suma correcta
  "total_currency": "USD"
}
```

---

## 5. Comparación: 1 vs 2 vs 3+ Hoteles

### 5.1 Escenario: 1 Hotel

**Comportamiento**:
- ✅ Resumen muestra el hotel correctamente
- ✅ Página individual del hotel se genera
- ✅ Precio total es correcto
- ✅ Fechas son correctas

**Estado**: ✅ **FUNCIONA CORRECTAMENTE**

### 5.2 Escenario: 2 Hoteles

**Comportamiento**:
- ❌ **Resumen solo muestra el primer hotel** (`best_hotels[0]`)
- ✅ Páginas individuales se generan para ambos hoteles
- ✅ Precio total suma ambos hoteles correctamente
- ⚠️ **Fechas pueden ser incorrectas** si el segundo hotel tiene fechas diferentes

**Ejemplo de Problema**:
```
Hotel 1: check_in="2025-01-15", check_out="2025-01-22"
Hotel 2: check_in="2025-01-20", check_out="2025-01-27"

Resultado en PDF:
- Resumen muestra: "15-22 enero" (solo Hotel 1)
- Página Hotel 1: "15-22 enero" ✅
- Página Hotel 2: "20-27 enero" ✅ (pero no se refleja en resumen)
```

**Estado**: ⚠️ **FUNCIONA PARCIALMENTE** (páginas OK, resumen incorrecto)

### 5.3 Escenario: 3+ Hoteles

**Comportamiento**:
- ❌ **Resumen solo muestra el primer hotel**
- ✅ Páginas individuales se generan para todos los hoteles
- ✅ Precio total suma todos los hoteles correctamente
- ⚠️ **Fechas pueden ser incorrectas** si hay hoteles con fechas diferentes
- ❌ **Alternativas no funcionan** (solo busca en `best_hotels[0].alternatives`)

**Estado**: ⚠️ **FUNCIONA PARCIALMENTE** (páginas OK, resumen incorrecto)

---

## 6. Hallazgos Críticos

### 6.1 Problema #1: Resumen Hardcodeado a `best_hotels[0]`

**Ubicación**: `src/templates/pdf/combined-flight-hotel.html` (líneas 58-134)

**Evidencia**:
```html
{% if best_hotels[0] %}
  <div class="sc-text">{{ best_hotels[0].name }}</div>
  <div class="sc-text">{{ best_hotels[0].stars }} estrellas</div>
  <div class="sc-text">{{ best_hotels[0].location }}</div>
  <div class="sc-text">Precio: ${{ best_hotels[0].price }}</div>
{% endif %}
```

**Impacto**:
- Si hay 2+ hoteles, solo el primero aparece en el resumen
- El usuario no ve información de los otros hoteles en la primera página
- Confusión: el precio total incluye todos los hoteles, pero el resumen solo muestra uno

**Severidad**: 🔴 **ALTA** - Afecta la experiencia del usuario

### 6.2 Problema #2: Alternativas Solo del Primer Hotel

**Ubicación**: `src/templates/pdf/combined-flight-hotel.html` (líneas 172, 248)

**Evidencia**:
```html
{% if best_hotels[0] and best_hotels[0].alternatives and best_hotels[0].alternatives[0] %}
  <!-- Package Option 2 -->
  {{ best_hotels[0].alternatives[0].name }}
{% endif %}
```

**Impacto**:
- Si el usuario selecciona 2 hoteles, el segundo nunca aparece como alternativa
- El campo `alternatives` no se está populando en `prepareCombinedPdfData`
- Las alternativas solo funcionan si están en el primer hotel

**Severidad**: 🟡 **MEDIA** - Funcionalidad no implementada completamente

### 6.3 Problema #3: Fechas Solo del Primer Hotel

**Ubicación**: `src/services/pdfMonkey.ts` (líneas 677-681)

**Evidencia**:
```typescript
const firstHotel = hotels[0];
const checkin = firstHotel?.check_in || firstFlight?.departure_date || ...;
const checkout = firstHotel?.check_out || firstFlight?.return_date || ...;
```

**Impacto**:
- Si hay múltiples hoteles con fechas diferentes, el resumen muestra fechas incorrectas
- Ejemplo: Hotel 1 (15-22 enero) + Hotel 2 (20-27 enero) → Resumen muestra "15-22 enero"

**Severidad**: 🟡 **MEDIA** - Puede causar confusión si hay fechas diferentes

### 6.4 Problema #4: Ocupación Global (No por Hotel)

**Ubicación**: `src/services/pdfMonkey.ts` (líneas 689-690)

**Evidencia**:
```typescript
const adults = firstFlight?.adults || 1;
const childrens = firstFlight?.childrens || 0;
```

**Impacto**:
- La ocupación se toma del primer vuelo, no de cada hotel
- Si diferentes hoteles tienen diferentes ocupaciones, no se refleja

**Severidad**: 🟢 **BAJA** - Generalmente la ocupación es la misma para todos

---

## 7. Reproducción de Problemas

### 7.1 Test Case 1: 2 Hoteles con Mismo Check-in/Check-out

**Input**:
```json
{
  "flights": [{
    "departure_date": "2025-01-15",
    "return_date": "2025-01-22"
  }],
  "hotels": [
    {
      "name": "Hotel RIU Bambu",
      "check_in": "2025-01-15",
      "check_out": "2025-01-22",
      "price": "1.500,00"
    },
    {
      "name": "Hotel Iberostar Dominicana",
      "check_in": "2025-01-15",
      "check_out": "2025-01-22",
      "price": "2.000,00"
    }
  ]
}
```

**Resultado Esperado**:
- Resumen muestra ambos hoteles o al menos menciona "2 hoteles"
- Precio total: 3.500,00

**Resultado Actual**:
- ❌ Resumen solo muestra "Hotel RIU Bambu"
- ✅ Precio total: 3.500,00 (correcto)
- ✅ Páginas individuales: ambas se generan correctamente

### 7.2 Test Case 2: 2 Hoteles con Diferentes Fechas

**Input**:
```json
{
  "hotels": [
    {
      "name": "Hotel 1",
      "check_in": "2025-01-15",
      "check_out": "2025-01-22"
    },
    {
      "name": "Hotel 2",
      "check_in": "2025-01-20",
      "check_out": "2025-01-27"
    }
  ]
}
```

**Resultado Esperado**:
- Resumen muestra rango de fechas: "15-27 enero" o menciona ambos rangos

**Resultado Actual**:
- ❌ Resumen muestra: "15-22 enero" (solo del primer hotel)
- ⚠️ Fechas incorrectas en el resumen

---

## 8. Causa Raíz

### 8.1 Problema #1: Resumen Hardcodeado

**Causa Raíz**:
- El template fue diseñado para mostrar un solo hotel en el resumen
- El loop `{% for best_hotel in best_hotels %}` solo se usa para páginas individuales (línea 451)
- El resumen (líneas 58-134) accede directamente a `best_hotels[0]` sin iterar

**Línea Problemática**:
```58:134:src/templates/pdf/combined-flight-hotel.html
{% if best_hotels[0] %}
  <!-- Hardcoded access to first hotel -->
  {{ best_hotels[0].name }}
{% endif %}
```

### 8.2 Problema #2: Alternativas No Implementadas

**Causa Raíz**:
- El campo `alternatives` no se está populando en `prepareCombinedPdfData`
- El template espera `best_hotels[0].alternatives`, pero el mapper no lo genera
- La estructura de datos de `HotelData` no incluye `alternatives`

**Línea Problemática**:
```667:673:src/services/pdfMonkey.ts
return {
  name: hotel.name,
  stars: hotel.category || "5",
  location: hotel.address || `${hotel.city}, República Dominicana`,
  price: formatPriceForTemplate(priceForAllNights),
  link: `https://wholesale-connect.com/hotel/${hotel.id}`
  // ❌ Missing: alternatives field
};
```

### 8.3 Problema #3: Fechas del Primer Hotel

**Causa Raíz**:
- `prepareCombinedPdfData` asume que todos los hoteles tienen las mismas fechas
- Solo extrae fechas del primer hotel para simplificar el template
- No hay lógica para calcular rango de fechas cuando hay múltiples hoteles

**Línea Problemática**:
```677:681:src/services/pdfMonkey.ts
const firstHotel = hotels[0];
const checkin = firstHotel?.check_in || firstFlight?.departure_date || ...;
const checkout = firstHotel?.check_out || firstFlight?.return_date || ...;
```

---

## 9. Fix Propuesto

### 9.1 Fix #1: Resumen con Múltiples Hoteles

**Opción A: Mostrar Lista de Hoteles en Resumen**

**Cambio en Template** (`src/templates/pdf/combined-flight-hotel.html`):

```html
<!-- ANTES (líneas 112-145) -->
<div class="package-section">
  <div class="section-title">
    <span class="section-icon">🏨</span>
    Hotel Recomendado
  </div>
  <div class="section-content">
    <div class="sc-row">
      <div class="sc-text">{{ best_hotels[0].name }}</div>
    </div>
    <!-- ... solo primer hotel ... -->
  </div>
</div>

<!-- DESPUÉS -->
<div class="package-section">
  <div class="section-title">
    <span class="section-icon">🏨</span>
    {% if best_hotels.size > 1 %}
      Hoteles ({{ best_hotels.size }})
    {% else %}
      Hotel Recomendado
    {% endif %}
  </div>
  <div class="section-content">
    {% for hotel in best_hotels %}
    <div class="sc-row">
      <div class="sc-text">{{ hotel.name }}</div>
    </div>
    <div class="sc-row">
      <div class="sc-text">{{ hotel.stars }} estrellas</div>
    </div>
    <div class="sc-row">
      <div class="sc-text">{{ hotel.location }}</div>
    </div>
    <div class="sc-row">
      <div class="sc-text">Precio: ${{ hotel.price }} {{ selected_flights[0].price.currency }}</div>
    </div>
    {% unless forloop.last %}<br>{% endunless %}
    {% endfor %}
  </div>
</div>
```

**Opción B: Mostrar Solo Cantidad y Precio Total**

```html
<div class="package-section">
  <div class="section-title">
    <span class="section-icon">🏨</span>
    {% if best_hotels.size > 1 %}
      {{ best_hotels.size }} Hoteles
    {% else %}
      Hotel Recomendado: {{ best_hotels[0].name }}
    {% endif %}
  </div>
  <div class="section-content">
    {% if best_hotels.size > 1 %}
      <div class="sc-row">
        <div class="sc-text">Total hoteles: ${{ hotel_price }} {{ total_currency }}</div>
      </div>
      <div class="sc-row">
        <div class="sc-text">Ver detalles en páginas siguientes</div>
      </div>
    {% else %}
      <!-- Mostrar detalles del único hotel -->
      <div class="sc-row">
        <div class="sc-text">{{ best_hotels[0].name }}</div>
      </div>
      <!-- ... resto de campos ... -->
    {% endif %}
  </div>
</div>
```

**Recomendación**: **Opción A** (mostrar lista completa) para transparencia

### 9.2 Fix #2: Populate Alternatives Field

**Cambio en Mapper** (`src/services/pdfMonkey.ts`):

```typescript
// ANTES (línea 667-673)
return {
  name: hotel.name,
  stars: hotel.category || "5",
  location: hotel.address || `${hotel.city}, República Dominicana`,
  price: formatPriceForTemplate(priceForAllNights),
  link: `https://wholesale-connect.com/hotel/${hotel.id}`
};

// DESPUÉS
return {
  name: hotel.name,
  stars: hotel.category || "5",
  location: hotel.address || `${hotel.city}, República Dominicana`,
  price: formatPriceForTemplate(priceForAllNights),
  link: `https://wholesale-connect.com/hotel/${hotel.id}`,
  // ✅ Add alternatives: other hotels in the same city/date range
  alternatives: hotels
    .filter((h, idx) => idx !== index && h.city === hotel.city)
    .slice(0, 2) // Max 2 alternatives
    .map(altHotel => {
      const altRoom = (altHotel as HotelDataWithSelectedRoom).selectedRoom || 
        altHotel.rooms.reduce((cheapest, room) =>
          room.total_price < cheapest.total_price ? room : cheapest
        );
      return {
        name: altHotel.name,
        price: formatPriceForTemplate(altRoom.total_price)
      };
    })
};
```

**Nota**: Esto requiere pasar el array completo de `hotels` al mapper, no solo el hotel individual.

### 9.3 Fix #3: Calcular Rango de Fechas

**Cambio en Mapper** (`src/services/pdfMonkey.ts`):

```typescript
// ANTES (líneas 677-681)
const firstHotel = hotels[0];
const checkin = firstHotel?.check_in || firstFlight?.departure_date || ...;
const checkout = firstHotel?.check_out || firstFlight?.return_date || ...;

// DESPUÉS
// Calculate date range from all hotels
let earliestCheckin: string | null = null;
let latestCheckout: string | null = null;

hotels.forEach(hotel => {
  if (hotel.check_in) {
    if (!earliestCheckin || hotel.check_in < earliestCheckin) {
      earliestCheckin = hotel.check_in;
    }
  }
  if (hotel.check_out) {
    if (!latestCheckout || hotel.check_out > latestCheckout) {
      latestCheckout = hotel.check_out;
    }
  }
});

const checkin = earliestCheckin || firstFlight?.departure_date || new Date().toISOString().split('T')[0];
const checkout = latestCheckout || firstFlight?.return_date || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
```

**Alternativa más simple**: Si todos los hoteles tienen las mismas fechas (caso común), mantener el código actual pero agregar validación:

```typescript
// Validate that all hotels have same dates (common case)
const allSameDates = hotels.every(h => 
  h.check_in === hotels[0].check_in && 
  h.check_out === hotels[0].check_out
);

if (!allSameDates) {
  console.warn('⚠️ Hotels have different dates - using first hotel dates in summary');
}

const firstHotel = hotels[0];
const checkin = firstHotel?.check_in || firstFlight?.departure_date || ...;
const checkout = firstHotel?.check_out || firstFlight?.return_date || ...;
```

**Recomendación**: **Alternativa simple** (validación + warning) si el caso de fechas diferentes es raro

---

## 10. Tests Mínimos para Validar

### 10.1 Test 1: Resumen con 2 Hoteles

```typescript
describe('PDF Generation - Multiple Hotels', () => {
  it('should show both hotels in summary when 2 hotels selected', async () => {
    const hotels = [
      { name: 'Hotel 1', check_in: '2025-01-15', check_out: '2025-01-22', ... },
      { name: 'Hotel 2', check_in: '2025-01-15', check_out: '2025-01-22', ... }
    ];
    
    const pdfData = prepareCombinedPdfData([], hotels);
    
    // Verify both hotels in best_hotels array
    expect(pdfData.best_hotels).toHaveLength(2);
    expect(pdfData.best_hotels[0].name).toBe('Hotel 1');
    expect(pdfData.best_hotels[1].name).toBe('Hotel 2');
    
    // Verify total price includes both
    const totalHotelPrice = hotels.reduce((sum, h) => sum + h.rooms[0].total_price, 0);
    expect(parseFloat(pdfData.total_price.replace(/\./g, '').replace(',', '.'))).toBeCloseTo(totalHotelPrice);
  });
});
```

### 10.2 Test 2: Template Render con Múltiples Hoteles

```typescript
it('should render all hotels in summary section', () => {
  const template = fs.readFileSync('src/templates/pdf/combined-flight-hotel.html', 'utf8');
  const payload = {
    best_hotels: [
      { name: 'Hotel 1', stars: '5', location: 'Location 1', price: '1.500,00' },
      { name: 'Hotel 2', stars: '4', location: 'Location 2', price: '2.000,00' }
    ],
    selected_flights: [{ price: { currency: 'USD' } }]
  };
  
  const rendered = liquidEngine.parseAndRender(template, payload);
  
  // Verify both hotels appear in summary
  expect(rendered).toContain('Hotel 1');
  expect(rendered).toContain('Hotel 2');
  expect(rendered).toContain('1.500,00');
  expect(rendered).toContain('2.000,00');
});
```

### 10.3 Test 3: Fechas con Hoteles Diferentes

```typescript
it('should calculate date range from all hotels', () => {
  const hotels = [
    { check_in: '2025-01-15', check_out: '2025-01-22', ... },
    { check_in: '2025-01-20', check_out: '2025-01-27', ... }
  ];
  
  const pdfData = prepareCombinedPdfData([], hotels);
  
  // Should use earliest checkin and latest checkout
  expect(pdfData.checkin).toBe('2025-01-15');
  expect(pdfData.checkout).toBe('2025-01-27');
});
```

### 10.4 Test 4: Alternativas Populadas

```typescript
it('should populate alternatives field for each hotel', () => {
  const hotels = [
    { name: 'Hotel 1', city: 'Punta Cana', ... },
    { name: 'Hotel 2', city: 'Punta Cana', ... },
    { name: 'Hotel 3', city: 'Punta Cana', ... }
  ];
  
  const pdfData = prepareCombinedPdfData([], hotels);
  
  // Hotel 1 should have Hotel 2 and Hotel 3 as alternatives
  expect(pdfData.best_hotels[0].alternatives).toHaveLength(2);
  expect(pdfData.best_hotels[0].alternatives[0].name).toBe('Hotel 2');
  expect(pdfData.best_hotels[0].alternatives[1].name).toBe('Hotel 3');
});
```

---

## 11. Resumen Ejecutivo

### 11.1 Problemas Detectados

| # | Problema | Severidad | Ubicación | Estado |
|---|----------|-----------|-----------|--------|
| 1 | Resumen hardcodeado a `best_hotels[0]` | 🔴 Alta | Template HTML (línea 58) | ❌ Crítico |
| 2 | Alternativas solo del primer hotel | 🟡 Media | Template HTML (línea 172) + Mapper | ⚠️ No implementado |
| 3 | Fechas solo del primer hotel | 🟡 Media | `pdfMonkey.ts` (línea 677) | ⚠️ Puede causar confusión |
| 4 | Ocupación global (no por hotel) | 🟢 Baja | `pdfMonkey.ts` (línea 689) | ✅ Aceptable |
| 5 | **Extracción de PDF solo detecta 1 hotel** | 🔴 **Alta** | `pdfProcessor.ts` (línea 3190) | ✅ **FIXED** |

### 11.2 Lo que Funciona Correctamente

- ✅ **Loop de páginas individuales**: Genera una página por cada hotel
- ✅ **Cálculo de precio total**: Suma correctamente todos los hoteles
- ✅ **Mapeo de datos**: Todos los hoteles se mapean correctamente en `best_hotels`
- ✅ **Datos independientes**: No hay pisado de datos entre hoteles en páginas individuales
- ✅ **Extracción de múltiples hoteles del PDF**: Ahora detecta todos los hoteles en PDFs arrastrados (FIXED)

### 11.3 Prioridad de Fixes

1. **🔴 PRIORIDAD ALTA**: Fix #1 (Resumen con múltiples hoteles)
2. **🟡 PRIORIDAD MEDIA**: Fix #3 (Rango de fechas) - Solo si hay casos reales con fechas diferentes
3. **🟡 PRIORIDAD MEDIA**: Fix #2 (Alternativas) - Solo si se requiere esta funcionalidad

### 11.4 Impacto en Usuarios

**Escenario Actual (2+ hoteles)**:
- Usuario selecciona 2 hoteles
- PDF muestra solo el primer hotel en el resumen
- Precio total incluye ambos hoteles (confuso)
- Páginas individuales muestran ambos hoteles correctamente

**Escenario Después del Fix**:
- Usuario selecciona 2 hoteles
- PDF muestra ambos hoteles en el resumen
- Precio total y desglose son claros
- Páginas individuales mantienen funcionalidad actual

---

## 12. Problema Adicional: Extracción de PDF con Múltiples Hoteles

### 12.1 Problema Detectado

**Caso de Uso**: Usuario arrastra un PDF que contiene 2 hoteles (IMPERIAL LAS PERLAS y SOLYMAR BEACH RESORT), pero el sistema solo detecta 1 hotel.

**Síntoma**:
- PDF contiene: IMPERIAL LAS PERLAS + SOLYMAR BEACH RESORT
- Sistema detecta: Solo IMPERIAL LAS PERLAS
- Al cambiar precio: Solo regenera PDF con 1 hotel

**Causa Raíz**: `extractHotelsFromPdfMonkeyTemplate()` solo extraía el primer hotel encontrado porque:
- Buscaba solo el primer patrón "Hotel Recomendado"
- No iteraba para encontrar múltiples secciones de hotel
- Solo hacía `hotels.push()` una vez al final

**Ubicación**: `src/services/pdfProcessor.ts` línea 3190

### 12.2 Fix Implementado

**Cambio**: Reescribir `extractHotelsFromPdfMonkeyTemplate()` para:
1. Buscar TODAS las secciones de hotel usando múltiples patrones:
   - "Hotel Recomendado" + nombre
   - "🏨 Hotel" + nombre (páginas individuales)
   - Nombre capitalizado antes de "X estrellas"
2. Extraer datos de cada hotel individualmente (nombre, ubicación, precio)
3. Retornar array con todos los hoteles encontrados

**Resultado**: Ahora detecta correctamente múltiples hoteles en PDFs arrastrados.

### 12.3 Impacto

- ✅ **Antes**: PDF con 2 hoteles → Solo detecta 1 → Regenera PDF con 1 hotel
- ✅ **Después**: PDF con 2 hoteles → Detecta ambos → Regenera PDF con 2 hoteles

---

## 13. Conclusión

El sistema **funciona correctamente** para generar páginas individuales de hoteles y calcular totales, pero tiene **problemas críticos** en el resumen que solo muestra el primer hotel. El fix principal requiere modificar el template HTML para iterar sobre todos los hoteles en la sección de resumen.

**Fixes Implementados**:
- ✅ **Fix #5**: Extracción de múltiples hoteles del PDF (COMPLETADO)

**Fixes Pendientes**:
- 🔴 **Fix #1**: Resumen con múltiples hoteles (PRIORIDAD ALTA)
- 🟡 **Fix #3**: Rango de fechas cuando hay hoteles con fechas diferentes (OPCIONAL)
- 🟡 **Fix #2**: Alternativas de hotel (OPCIONAL - funcionalidad no crítica)

**Recomendación**: Implementar Fix #1 (resumen con múltiples hoteles) como prioridad alta, ya que afecta directamente la experiencia del usuario cuando selecciona múltiples hoteles.

