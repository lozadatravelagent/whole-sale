# 📊 Tabla de Mapeo Completa: PDF → Modelo Interno

## 🛫 SECCIÓN VUELOS (PDFMonkey Template)

### Campos Principales

| Campo PDF | Patrón Regex | Campo Interno | Tipo | Transformación | Default/Fallback | Confidence | Notas |
|-----------|--------------|---------------|------|----------------|------------------|------------|-------|
| **Código Aerolínea** | `✈\s*Vuelos\s+([A-Z0-9]{2,3})` | `airline.code` | string | Captura grupo 1, toUpperCase() | N/A (requerido) | 0.95 | Ej: "AA", "LA", "AV" |
| **Nombre Aerolínea** | `✈\s*Vuelos\s+[A-Z0-9]{2,3}\s+([A-Z][A-Za-z\s\.]+?)` | `airline.name` | string | Captura grupo 2, trim() | `resolveAirlineName(code)` | 0.90 | Ej: "American Airlines" |
| **Código Aeropuerto Origen** | `([A-Z]{3})\s+([A-Za-z\s]+?)\s+(\d{1,2}:\d{2})` | `legs[].departure.city_code` | string | Captura grupo 1 | N/A (requerido) | 0.98 | IATA 3 letras |
| **Ciudad Origen** | Mismo patrón ↑ | `legs[].departure.city_name` | string | Captura grupo 2 | `mapCodeToCity(code)` | 0.95 | Ej: "Buenos Aires" |
| **Hora Salida** | Mismo patrón ↑ | `legs[].departure.time` | string | Captura grupo 3, formato HH:MM | "08:00" | 0.98 | 24h format |
| **Código Aeropuerto Destino** | Mismo patrón ↑ (último match) | `legs[].arrival.city_code` | string | Captura grupo 1 del último match | N/A (requerido) | 0.98 | IATA 3 letras |
| **Ciudad Destino** | Mismo patrón ↑ (último match) | `legs[].arrival.city_name` | string | Captura grupo 2 | `mapCodeToCity(code)` | 0.95 | Ej: "Miami" |
| **Hora Llegada** | Mismo patrón ↑ (último match) | `legs[].arrival.time` | string | Captura grupo 3 | "18:00" | 0.98 | 24h format |
| **Fecha Ida** | `Vuelo de ida\s+(\d{4}-\d{2}-\d{2})` | `departure_date` | string | ISO 8601 format | `new Date(+7 days).toISOString()` | 0.90 | YYYY-MM-DD |
| **Fecha Vuelta** | `Vuelo de regreso\s+(\d{4}-\d{2}-\d{2})` | `return_date` | string? | ISO 8601 format | `undefined` (one-way) | 0.90 | YYYY-MM-DD o undefined |
| **Precio Total Vuelo** | `(\d{1,10}(?:[.,]\d{1,3})+\|\d+)\s*USD\s*Precio\s*total` | `price.amount` | number | `parsePrice()` → float | 0 | 0.85 | Puede ser suma de legs |
| **Moneda** | Contexto de precio ("USD") | `price.currency` | string | Literal del match | "USD" | 0.99 | USD por defecto |
| **Tipo de Vuelo** | Inferido de sección (ida/regreso) | `legs[].flight_type` | enum | "outbound" si "Vuelo de ida", "return" si "Vuelo de regreso" | "outbound" | 0.95 | "outbound" \| "return" |
| **Duración** | Calculado de horas | `legs[].duration` | string | `calculateFlightDuration(depTime, arrTime)` | "10h" | 0.70 | Formato: "Xh Ym" |
| **Equipaje** | `Equipaje de bodega incluido` | `luggage` | boolean | Presencia de texto → true | false | 0.99 | true si texto presente |
| **Adultos** | `(\d+)\s*adultos?` | `adults` | number | parseInt(grupo 1) | 1 | 0.90 | >= 1 |
| **Niños** | `(\d+)\s*niños?` | `childrens` | number | parseInt(grupo 1) | 0 | 0.90 | >= 0 |

### Campos de Escala (Layovers)

| Campo PDF | Patrón Regex | Campo Interno | Tipo | Transformación | Default/Fallback | Confidence |
|-----------|--------------|---------------|------|----------------|------------------|------------|
| **Ciudad Escala** | `Escala en (.+?)\s+Tiempo de espera:` | `legs[].layovers[].destination_city` | string | Captura grupo 1, trim() | N/A | 0.85 |
| **Código Escala** | `\s+en\s+([A-Z]{3})\s*\(([^)]+)\)` | `legs[].layovers[].destination_code` | string | Captura grupo 1 | N/A | 0.95 |
| **Tiempo Espera** | `Tiempo de espera:\s*(\d+h\s*\d*m?)` | `legs[].layovers[].waiting_time` | string | Captura grupo 1 | N/A | 0.95 |

### Campos Opcionales/Adicionales

| Campo PDF | Patrón | Campo Interno | Tipo | Default | Confidence | Notas |
|-----------|--------|---------------|------|---------|------------|-------|
| **Asistencia Médica** | Flag en template | `travel_assistance.included` | boolean | false | 0.99 | Solo para legend en PDF |
| **Traslados** | Flag en template | `transfers.included` | boolean | false | 0.99 | Solo para legend en PDF |
| **Ruta (resumen)** | Calculado | `route` | string | `"${originCode} → ${destCode}"` | 0.95 | Formato: "EZE → MIA" |

---

## 🏨 SECCIÓN HOTELES (PDFMonkey Template)

### Campos Principales

| Campo PDF | Patrón Regex | Campo Interno | Tipo | Transformación | Default/Fallback | Confidence | Notas |
|-----------|--------------|---------------|------|----------------|------------------|------------|-------|
| **Nombre Hotel** | `🏨\s*Hotel\s*\n?\s*([A-Z][A-Za-z\s\-\'\.]+?)` | `name` | string | Captura grupo 1, trim() | "Hotel no especificado" | 0.85 | Puede incluir "(Opción X)" |
| **Estrellas** | `([A-Za-z\s]+?)\s+(\d+)\s*estrellas` | `category` / `stars` | string | parseInt(grupo 2) → string | "5" | 0.90 | Categoría del hotel |
| **Ubicación** | `(\d+)\s*estrellas\s*([A-Za-zÀ-ÿ\s,\(\)]+?)` | `location` / `address` | string | Captura grupo 2, trim() | "Ubicación no especificada" | 0.75 | Ciudad, país |
| **Precio Total** | `Precio:\s*\$?\s*(\d{1,10}(?:[.,]\d{1,3})+\|\d+)\s*USD` | `rooms[].total_price` | number | `parsePrice()` → float | 0 | 0.80 | Precio TOTAL (todas las noches) |
| **Noches** | `(\d+)\s*(?:Noche\|Noches)` | `nights` | number | parseInt(grupo 1) | 0 | 0.95 | Número de noches |
| **Check-in** | Inferido de vuelo | `check_in` | string | `flightDepartureDate` | `new Date().toISOString()` | 0.60 | ISO 8601 |
| **Check-out** | Inferido de vuelo + noches | `check_out` | string | `checkIn + nights días` | `new Date(+7 days).toISOString()` | 0.60 | ISO 8601 |

### Campos Opcionales de Paquete

| Campo PDF | Patrón | Campo Interno | Tipo | Default | Confidence | Notas |
|-----------|--------|---------------|------|---------|------------|-------|
| **Número de Opción** | `Opci[oó]n\s+(1\|2\|\d+\|Econ[oó]mica\|Premium)` | `_packageMetadata.optionNumber` | number | null | 0.90 | 1 = Económica, 2 = Premium |
| **Precio Paquete** | `Opci[oó]n\s+.*?\$?(\d+[.,\d]*)\s*USD` | `_packageMetadata.totalPackagePrice` | number | null | 0.85 | Precio total del paquete (vuelo+hotel) |

---

## 💰 SECCIÓN PRECIOS

### Fuentes de Precio (en orden de prioridad)

| Fuente | Patrón | Prioridad | Confianza | Lógica | Notas |
|--------|--------|-----------|-----------|--------|-------|
| **Calculado (vuelos)** | `sum(flights[].price)` | 🥇 ALTA | 0.90 | Suma de precios individuales de cada vuelo | Usado si > 0 |
| **Calculado (hoteles)** | `sum(hotels[].price)` | 🥇 ALTA | 0.85 | Suma de precios de hoteles (o min si son opciones) | Detecta opciones vs múltiples |
| **Extraído (total)** | `(\d+[.,\d]*)\s*USD\s*Precio\s*total` | 🥈 MEDIA | 0.80 | Primera ocurrencia de "Precio total" | Fallback si calculado = 0 |
| **Inferido (max)** | `max(all prices in PDF)` | 🥉 BAJA | 0.50 | Precio más alto encontrado | Último recurso |

### Transformaciones de Precio

| Transformación | Input | Output | Lógica | Confianza |
|----------------|-------|--------|--------|-----------|
| **Formato US** | "2,549.32" | 2549.32 | Remove commas, parse float | 0.95 |
| **Formato EU** | "2.549,32" | 2549.32 | Remove dots, replace comma with dot | 0.95 |
| **Latino ambiguo** | "1.485" | 1485 | Detecta 3 dígitos después del punto = miles | 0.80 |
| **Decimal simple** | "10.50" | 10.5 | Detecta ≤2 dígitos después del punto = decimal | 0.90 |
| **Sin separadores** | "2549" | 2549 | Parse directo | 0.99 |

### Correcciones de Precio

| Corrección | Condición | Fórmula | Ubicación Código |
|------------|-----------|---------|------------------|
| **Multi-hotel pricing** | `hotels.length >= 2 && flightPrice > cheapestHotel` | `flightPrice - cheapestHotel` | `pdfProcessor.ts:369-389` |
| **Opción económica** | `packageOptions.length >= 2` | `min(options.map(o => o.totalPrice))` | `pdfProcessor.ts:343-353` |
| **División ida/vuelta** | `isRoundTrip && no individual prices` | `totalPrice / 2` | `pdfProcessor.ts:3543-3544` |

---

## 👥 SECCIÓN PASAJEROS

| Campo PDF | Patrón | Campo Interno | Tipo | Default | Confidence | Validación |
|-----------|--------|---------------|------|---------|------------|------------|
| **Adultos** | `(\d+)\s*(?:adultos?\|pasajeros?\|people)` | `adults` / `passengers` | number | 1 | 0.90 | >= 1, <= 20 |
| **Niños** | `(\d+)\s*(?:niños?\|children)` | `childrens` | number | 0 | 0.90 | >= 0, <= 10 |
| **Total** | Calculado | `passengers` | number | `adults + childrens` | 0.95 | - |

---

## 💱 SECCIÓN MONEDA

| Símbolo/Código | Mapeo Interno | Confidence | Notas |
|----------------|---------------|------------|-------|
| USD, US$ | "USD" | 0.99 | Por defecto |
| EUR, € | "EUR" | 0.99 | Euro |
| ARS, $AR | "ARS" | 0.95 | Peso argentino |
| BRL, R$ | "BRL" | 0.95 | Real brasileño |
| MXN, $MX | "MXN" | 0.90 | Peso mexicano |
| COP, $CO | "COP" | 0.90 | Peso colombiano |
| CLP, $CL | "CLP" | 0.90 | Peso chileno |
| PEN, S/ | "PEN" | 0.90 | Sol peruano |

---

## 📋 METADATA DE TEMPLATE

| Campo | Fuente | Tipo | Valores Posibles | Lógica |
|-------|--------|------|------------------|--------|
| `originalTemplate` | Contenido PDF | string | ID de template PDFMonkey | Detectado por patterns únicos |
| `needsComplexTemplate` | Análisis de estructura | boolean | true/false | true si roundtrip || layovers |
| `extractedFromPdfMonkey` | Detección de template | boolean | true/false | true si matchea nuestros templates |

### IDs de Templates

| Nombre | ID | Trigger |
|--------|----|----|
| **Combined** | `3E8394AC-84D4-4286-A1CD-A12D1AB001D5` | "PRESUPUESTO DE VIAJE" || "Hotel Recomendado" |
| **Flights Complex** | `30B142BF-1DD9-432D-8261-5287556DC9FC` | Round trip + layovers || 2+ flight options |
| **Flights Simple** | `67B7F3A5-7BFE-4F52-BE6B-110371CB9376` | Single flight, no layovers |

---

## ⚠️ CAMPOS CON INFERENCIAS (NO EXTRAÍDOS)

| Campo | Valor Inferido | Justificación | Riesgo |
|-------|----------------|---------------|--------|
| `departure_date` | `new Date(+7 days)` | Mejor que NULL | 🟡 MEDIO |
| `legs[].duration` | "10h" | Placeholder visual | 🟢 BAJO |
| `passengers` | 1 | Asunción común | 🟢 BAJO |
| `currency` | "USD" | Moneda más usada | 🟡 MEDIO |
| `nights` | 0 | Evita NULL | 🟡 MEDIO |
| `check_in` | `flightDate` | Lógica de negocio | 🟡 MEDIO |
| `check_out` | `check_in + nights` | Calculado | 🟡 MEDIO |

---

## 🔄 TRANSFORMACIONES ESPECIALES

### 1. Corrección de Precio Multi-Hotel

**Trigger:** `hotels.length >= 2 && calculatedFlightPrice > cheapestHotelPrice`

**Lógica:**
```typescript
// El precio capturado como "vuelo" es en realidad el paquete económico
const cheapestHotelPrice = Math.min(...hotels.map(h => h.price));
if (calculatedFlightPrice > cheapestHotelPrice) {
  calculatedFlightPrice = calculatedFlightPrice - cheapestHotelPrice;
  // Actualizar precios de legs proporcionalmente
  const ratio = calculatedFlightPrice / originalFlightPrice;
  flights.forEach(f => f.price *= ratio);
}
```

**Ubicación:** `pdfProcessor.ts:369-389`

### 2. Detección de Opciones de Paquete

**Trigger:** `content.match(/Opci[oó]n\s+(1|2|Econ[oó]mica|Premium)/gi).length >= 2`

**Lógica:**
```typescript
// Crear hoteles separados con "(Opción X)" en el nombre
// NO sumar precios, son mutuamente exclusivas
const calculatedHotelPrice = Math.min(...hotels.map(h => h.price));
```

**Normalización de etiquetas:**
- "Opción Económica" → Opción 1
- "Opción Premium" → Opción 2
- "Opción 3", "Opción 4" → Número directo

**Ubicación:** `pdfProcessor.ts:3890-3992`

### 3. División Precio Ida/Vuelta

**Trigger:** `isRoundTrip && !individualPricesFound`

**Lógica Actual:**
```typescript
const outboundPrice = totalPrice / 2;
const returnPrice = totalPrice / 2;
```

**⚠️ BUG:** Asume 50/50, no considera precios asimétricos

**Fix Propuesto:**
```typescript
// Intentar extraer precios individuales primero
const outboundMatch = outboundContent.match(/(\d+[.,\d]*)\s*USD/i);
const returnMatch = returnContent.match(/(\d+[.,\d]*)\s*USD/i);

if (outboundMatch && returnMatch) {
  outboundPrice = parsePrice(outboundMatch[1]);
  returnPrice = parsePrice(returnMatch[1]);
} else {
  // Fallback 50/50 con warning
  outboundPrice = totalPrice / 2;
  returnPrice = totalPrice / 2;
}
```

**Ubicación:** `pdfProcessor.ts:3543-3544`

---

## 📊 Resumen de Confianza por Sección

| Sección | Campos Totales | High Confidence (≥0.9) | Medium (0.7-0.89) | Low (<0.7) | Inferidos |
|---------|----------------|------------------------|-------------------|------------|-----------|
| **Vuelos** | 18 | 12 (67%) | 4 (22%) | 1 (6%) | 1 (6%) |
| **Hoteles** | 7 | 3 (43%) | 2 (29%) | 0 (0%) | 2 (29%) |
| **Precios** | 4 | 2 (50%) | 1 (25%) | 1 (25%) | 0 (0%) |
| **Pasajeros** | 3 | 2 (67%) | 0 (0%) | 0 (0%) | 1 (33%) |
| **Metadata** | 3 | 1 (33%) | 2 (67%) | 0 (0%) | 0 (0%) |
| **TOTAL** | **35** | **20 (57%)** | **9 (26%)** | **2 (6%)** | **4 (11%)** |

---

**Documento generado:** 2025-01-20
**Versión:** 1.0
**Autor:** Claude Code Assistant
