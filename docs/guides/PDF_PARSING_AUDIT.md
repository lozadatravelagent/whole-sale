# 📄 Auditoría Completa del Sistema de Parseo de PDFs

## 🎯 Resumen Ejecutivo

Este documento audita el sistema de procesamiento de PDFs de **WholeSale Connect AI**, identificando el pipeline completo desde ingesta hasta modelo interno, validaciones, y gaps críticos.

---

## 1️⃣ Detección de Template

### 1.1 Estrategia de Detección

El sistema detecta qué template se aplicó mediante **doble verificación**:

**A) Por Nombre de Archivo** (`pdfProcessor.ts:240-261`)
```javascript
// Patrones de nombre de archivo
/viaje-combinado-cotizacion/i
/wholesale-connect/i
/cotizacion.*pdf/i
/vuelos-cotizacion/i
```

**B) Por Contenido** (`pdfProcessor.ts:266-291`)
```javascript
// Indicadores únicos del template (mínimo 2 coincidencias)
"PRESUPUESTO DE VIAJE"
"Para confirmar tu reserva.*contactanos por WhatsApp"
"Documentación y requisitos de ingreso.*responsabilidad del pasajero"
"DETALLE DEL VUELO"
"Vuelo de ida.*Vuelo de regreso"
"Equipaje de bodega incluido.*Carry On incluido"
```

### 1.2 Clasificación de Templates

**Template Combinado** (`3E8394AC-84D4-4286-A1CD-A12D1AB001D5`)
- Trigger: `"PRESUPUESTO DE VIAJE"` || `"Hotel Recomendado"`
- Contenido: Vuelos + Hoteles

**Template Vuelos Complejos** (`30B142BF-1DD9-432D-8261-5287556DC9FC`)
- Trigger: Round trip + layovers || 2+ opciones de vuelo
- Contenido: Ida + Vuelta con escalas

**Template Vuelos Simples** (`67B7F3A5-7BFE-4F52-BE6B-110371CB9376`)
- Trigger: 1 vuelo simple, sin escalas
- Contenido: Un solo tramo

### 1.3 🔴 Problemas Detectados en Detección

| # | Problema | Severidad | Impacto |
|---|----------|-----------|---------|
| 1 | **Ambigüedad multi-template**: Un PDF con "PRESUPUESTO" + round trip podría matchear 2 templates | 🔴 ALTA | Template incorrecto aplicado |
| 2 | **Heurística débil**: Solo 2 coincidencias requeridas para clasificar | 🟡 MEDIA | Falsos positivos |
| 3 | **Hardcoded IDs**: Template IDs hardcoded, no versionados | 🟡 MEDIA | Mantenimiento difícil |
| 4 | **PDFs externos**: No hay detección de proveedor externo (e.g., SOFTUR, Despegar) | 🟠 ALTA | Parsing genérico menos preciso |

---

## 2️⃣ Pipeline Completo de Procesamiento

### 2.1 Flujo de Datos

```
┌─────────────────┐
│  1. INGESTA     │  File → ArrayBuffer → Uint8Array
│  uploadPdfFile  │  → Supabase Storage (/documents)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. EXTRACCIÓN  │  Supabase Edge Function: pdf-text-extractor
│  analyzePdfContent│  → Extrae texto raw del PDF
└────────┬────────┘  → Sanitiza \u0000 y caracteres de control
         │
         ▼
┌─────────────────┐
│  3. DETECCIÓN   │  isPdfMonkeyTemplate(filename, content)
│  Template       │  → Si match: extractPdfMonkeyDataFromContent
└────────┬────────┘  → Si no: parseExtractedTravelData
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  4. NORMALIZACIÓN (bifurcación por origen)              │
├──────────────────────┬──────────────────────────────────┤
│  PDFMonkey Template  │  PDFs Externos                   │
│  ─────────────────── │  ────────────────────────────   │
│  extractFlightsFrom  │  extractFlightInfo (genérico)   │
│  extractHotelsFrom   │  extractHotelInfo (genérico)    │
│  extractTotalPrice   │  extractTotalPrice (fallback)   │
│  extractPassengers   │  extractPassengerCount          │
│  extractCurrency     │  extractCurrency                │
└──────────────────────┴──────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  5. VALIDACIÓN  │  ⚠️ NO EXISTE VALIDACIÓN FORMAL ⚠️
│  (Missing)      │  → Los datos se usan directamente
└────────┬────────┘  → No hay confidence scores
         │            → No hay mandatory field checks
         ▼
┌─────────────────┐
│  6. MAPEO       │  Transformación a modelo interno
│  (types/index)  │  → FlightData, HotelData, etc.
└────────┬────────┘  → Retorna PdfAnalysisResult
         │
         ▼
┌─────────────────┐
│  7. PRESENTACIÓN│  generatePriceChangeSuggestions
│  (UX Feedback)  │  → Mensaje formateado para el usuario
└─────────────────┘  → Cards con vuelos/hoteles extraídos
```

### 2.2 Transformaciones por Etapa

#### Etapa 2: Extracción Raw
```typescript
// Input: File (binary PDF)
// Output: string (texto plano)
const extractionResult = await supabase.functions.invoke('pdf-text-extractor', {
  body: { pdfData: Array.from(uint8Array), fileName: file.name }
});

// Sanitización:
text = text.replace(/\u0000/g, '')              // Remove NULL
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '') // Control chars
          .trim();
```

#### Etapa 4: Normalización (PDFMonkey)
```typescript
// Input: string (texto extraído)
// Output: Array<{ airline, route, price, dates, legs }>

// Ejemplo de transformación de VUELO:
// PDF: "✈ Vuelos AA American Airlines EZE Buenos Aires 08:00 MIA Miami 16:00"
// → { airline: "AA American Airlines", route: "EZE → MIA", ... }
```

#### Etapa 6: Mapeo Final
```typescript
// Input: Datos normalizados
// Output: PdfAnalysisResult

interface PdfAnalysisResult {
  success: boolean;
  content?: {
    flights?: Array<{...}>   // Ver sección 3.1
    hotels?: Array<{...}>    // Ver sección 3.2
    totalPrice?: number;
    currency?: string;
    passengers?: number;
    originalTemplate?: string;
    needsComplexTemplate?: boolean;
    extractedFromPdfMonkey?: boolean;
  };
  suggestions?: string[];
  error?: string;
}
```

---

## 3️⃣ Mapa de Mapeo: PDF → Modelo Interno

### 3.1 Sección VUELOS

#### A) Template PDFMonkey → FlightData

| Campo PDF | Patrón de Extracción | Campo Interno | Transformación | Default/Fallback |
|-----------|---------------------|---------------|----------------|------------------|
| **Aerolínea** | `✈\s*Vuelos\s+([A-Z0-9]{2,3})\s+([A-Z][A-Za-z\s\.]+?)` | `airline.code`, `airline.name` | Split código + nombre | "Aerolínea no especificada" |
| **Código Aeropuerto** | `([A-Z]{3})\s+([A-Za-z\s]+?)\s+(\d{1,2}:\d{2})` | `legs[].departure.city_code`, `legs[].arrival.city_code` | Captura directa | N/A (requerido) |
| **Ciudad** | Mismo patrón ↑ | `legs[].departure.city_name`, `legs[].arrival.city_name` | Captura grupo 2 | `mapCodeToCity(code)` |
| **Hora Salida/Llegada** | Mismo patrón ↑ (grupo 3) | `legs[].departure.time`, `legs[].arrival.time` | Captura HH:MM | "08:00" / "18:00" |
| **Escalas** | `Escala en (.+?)\s+Tiempo de espera:\s*(\d+h\s*\d*m?)\s+en\s+([A-Z]{3})\s*\(([^)]+)\)` | `legs[].layovers[]` | Crea objeto LayoverInfo | `[]` (array vacío) |
| **Fecha Ida** | `Vuelo de ida\s+(\d{4}-\d{2}-\d{2})` | `departure_date` | Formato ISO | "2025-11-01" |
| **Fecha Vuelta** | `Vuelo de regreso\s+(\d{4}-\d{2}-\d{2})` | `return_date` | Formato ISO | `undefined` (one-way) |
| **Precio Total** | `(\d{1,10}(?:[.,]\d{1,3})+\|\d+)\s*USD\s*Precio\s*total` | `price.amount` | `parsePrice()` → Float | 0 |
| **Moneda** | Captura de contexto "USD" | `price.currency` | String literal | "USD" |
| **Tipo de Vuelo** | Inferido (ida/vuelta) | `legs[].flight_type` | "outbound" / "return" | "outbound" |
| **Duración** | Calculado desde horas | `legs[].duration` | `calculateFlightDuration(dep, arr)` | "10h" |
| **Equipaje** | `Equipaje de bodega incluido` (boolean) | `luggage` | Presencia del texto | `false` |
| **Pasajeros** | `(\d+)\s*adultos`, `(\d+)\s*niños` | `adults`, `childrens` | parseInt() | 1, 0 |
| **Asistencia Médica** | `travel_assistance` flag | `travel_assistance.included` | Boolean | `false` |
| **Traslados** | `transfers` flag | `transfers.included` | Boolean | `false` |

#### B) Reglas de Transformación Especiales

**Corrección de Precio Multi-Hotel** (Líneas 369-389):
```typescript
// Si hay 2+ hoteles, el precio de vuelo capturado podría ser en realidad
// el precio del paquete económico (vuelo + hotel más barato)
if (hotels.length >= 2 && calculatedFlightPrice > 0) {
  const cheapestHotelPrice = Math.min(...hotels.map(h => h.price));
  if (calculatedFlightPrice > cheapestHotelPrice) {
    // Corregir: precio_vuelo_real = precio_capturado - hotel_mas_barato
    calculatedFlightPrice = calculatedFlightPrice - cheapestHotelPrice;
  }
}
```

**División de Precio Ida/Vuelta** (Líneas 3543-3544):
```typescript
const outboundPrice = sectionHasReturn ? sectionTotalPrice / 2 : sectionTotalPrice;
const returnPrice = sectionHasReturn ? sectionTotalPrice / 2 : 0;
```

### 3.2 Sección HOTELES

#### A) Template PDFMonkey → HotelData

| Campo PDF | Patrón de Extracción | Campo Interno | Transformación | Default/Fallback |
|-----------|---------------------|---------------|----------------|------------------|
| **Nombre Hotel** | `🏨\s*Hotel\s*\n?\s*([A-Z][A-Za-z\s\-\'\.]+?)` | `name` | Captura directa | "Hotel no especificado" |
| **Estrellas** | `([A-Za-z\s]+?)\s+(\d+)\s*estrellas` | `category` / `stars` | parseInt(grupo 2) | "5" |
| **Ubicación** | `(\d+)\s*estrellas\s*([A-Za-zÀ-ÿ\s,\(\)]+?)` | `location` / `address` | Captura después de estrellas | "Ubicación no especificada" |
| **Precio Hotel** | `Precio:\s*\$?\s*(\d{1,10}(?:[.,]\d{1,3})+\|\d+)\s*USD` | `rooms[].total_price` | `parsePrice()` → Float | 0 |
| **Noches** | `(\d+)\s*(?:Noche\|Noches)` | `nights` | parseInt() | 0 |
| **Check-in/Check-out** | Inferido de fechas de vuelo | `check_in`, `check_out` | Fecha vuelo + lógica | Vuelo ±1 día |

#### B) Detección de Opciones de Paquete (Multi-Hotel)

**Patrón de Opciones** (Líneas 3890-3992):
```typescript
// Detecta: "Opción 1 $X USD", "Opción Económica $Y USD", etc.
const optionPattern = /Opci[oó]n\s+(1|2|\d+|Econ[oó]mica|Premium)\s+\$?(\d+[.,\d]*)\s*USD/gi;

if (optionMatches.length >= 2) {
  // Crea hoteles separados: "Hotel (Opción 1)", "Hotel (Opción 2)"
  // NO suma precios, son alternativas mutuamente exclusivas
  calculatedHotelPrice = Math.min(...hotels.map(h => h.price)); // Usa el más barato
}
```

**Normalización de Etiquetas**:
- "Opción Económica" → Opción 1
- "Opción Premium" → Opción 2
- "Opción 3", "Opción 4" → Números directos

### 3.3 Sección PRECIO TOTAL

| Fuente | Patrón | Prioridad | Lógica |
|--------|--------|-----------|--------|
| **Calculado** | `sum(flights) + sum(hotels)` | 🥇 Alta | Usado si > 0 |
| **Extraído** | `(\d+[.,\d]*)\s*USD\s*Precio\s*total` | 🥈 Media | Fallback si calculado = 0 |
| **Inferido** | Max price en todo el documento | 🥉 Baja | Último recurso |

### 3.4 Parser de Precios Inteligente

**Función:** `parsePrice(priceStr)` (Líneas 65-157)

**Capacidades:**
- ✅ Formato US: `2,549.32` → 2549.32
- ✅ Formato EU/Latino: `2.549,32` → 2549.32
- ✅ Sin separadores: `2549` → 2549
- ✅ Solo decimales: `10.5` → 10.5
- ✅ Latino ambiguo: `1.485` → 1485 (detecta que son miles)

**Lógica de Decisión:**
```typescript
// Cuenta posición del último punto vs. última coma
if (lastCommaIndex > lastDotIndex) {
  // EU: 2.549,32 → remove dots, replace comma with dot
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
} else {
  // US: 2,549.32 → remove commas
  return parseFloat(str.replace(/,/g, ''));
}
```

---

## 4️⃣ Schema JSON del Modelo Resultante

### 4.1 Estructura Completa

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PdfAnalysisResult",
  "type": "object",
  "required": ["success"],
  "properties": {
    "success": {
      "type": "boolean",
      "description": "Indica si el parsing fue exitoso"
    },
    "content": {
      "type": "object",
      "required": [],
      "properties": {
        "flights": {
          "type": "array",
          "items": { "$ref": "#/definitions/ExtractedFlight" },
          "description": "Vuelos extraídos del PDF"
        },
        "hotels": {
          "type": "array",
          "items": { "$ref": "#/definitions/ExtractedHotel" },
          "description": "Hoteles extraídos del PDF"
        },
        "totalPrice": {
          "type": "number",
          "minimum": 0,
          "description": "Precio total calculado o extraído"
        },
        "currency": {
          "type": "string",
          "enum": ["USD", "EUR", "ARS", "BRL"],
          "default": "USD"
        },
        "passengers": {
          "type": "integer",
          "minimum": 1,
          "default": 1
        },
        "originalTemplate": {
          "type": "string",
          "enum": [
            "3E8394AC-84D4-4286-A1CD-A12D1AB001D5",
            "30B142BF-1DD9-432D-8261-5287556DC9FC",
            "67B7F3A5-7BFE-4F52-BE6B-110371CB9376"
          ],
          "description": "ID del template PDFMonkey usado originalmente"
        },
        "needsComplexTemplate": {
          "type": "boolean",
          "description": "Si el PDF requiere template complejo (ida+vuelta+escalas)"
        },
        "extractedFromPdfMonkey": {
          "type": "boolean",
          "description": "true = nuestro template, false = PDF externo"
        }
      }
    },
    "suggestions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Sugerencias contextuales para el usuario"
    },
    "error": {
      "type": "string",
      "description": "Mensaje de error si success = false"
    }
  },
  "definitions": {
    "ExtractedFlight": {
      "type": "object",
      "required": ["airline", "route", "price", "dates"],
      "properties": {
        "airline": { "type": "string" },
        "route": { "type": "string", "pattern": "^[A-Z]{3} → [A-Z]{3}$" },
        "price": { "type": "number", "minimum": 0 },
        "dates": { "type": "string" },
        "departureTime": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" },
        "arrivalTime": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" },
        "originCode": { "type": "string", "pattern": "^[A-Z]{3}$" },
        "destinationCode": { "type": "string", "pattern": "^[A-Z]{3}$" },
        "originCity": { "type": "string" },
        "destinationCity": { "type": "string" },
        "legs": {
          "type": "array",
          "items": { "$ref": "#/definitions/FlightLeg" }
        }
      }
    },
    "FlightLeg": {
      "type": "object",
      "required": ["departure", "arrival", "duration", "flight_type"],
      "properties": {
        "departure": { "$ref": "#/definitions/AirportInfo" },
        "arrival": { "$ref": "#/definitions/AirportInfo" },
        "duration": { "type": "string", "pattern": "^\\d+h(\\s*\\d+m)?$" },
        "flight_type": { "type": "string", "enum": ["outbound", "return"] },
        "price": { "type": "number", "minimum": 0 },
        "airline": { "type": "string" },
        "layovers": {
          "type": "array",
          "items": { "$ref": "#/definitions/LayoverInfo" }
        }
      }
    },
    "AirportInfo": {
      "type": "object",
      "required": ["city_code", "city_name", "time"],
      "properties": {
        "city_code": { "type": "string", "pattern": "^[A-Z]{3}$" },
        "city_name": { "type": "string", "minLength": 1 },
        "time": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" }
      }
    },
    "LayoverInfo": {
      "type": "object",
      "required": ["destination_city", "destination_code", "waiting_time"],
      "properties": {
        "destination_city": { "type": "string", "minLength": 1 },
        "destination_code": { "type": "string", "pattern": "^[A-Z]{3}$" },
        "waiting_time": { "type": "string", "pattern": "^\\d+h(\\s*\\d+m)?$" }
      }
    },
    "ExtractedHotel": {
      "type": "object",
      "required": ["name", "location", "price", "nights"],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "location": { "type": "string", "minLength": 1 },
        "price": { "type": "number", "minimum": 0 },
        "nights": { "type": "integer", "minimum": 0 }
      }
    }
  }
}
```

### 4.2 Ejemplo de Datos Válidos

```json
{
  "success": true,
  "content": {
    "flights": [
      {
        "airline": "AA American Airlines",
        "route": "EZE → MIA",
        "price": 714.93,
        "dates": "2025-01-15",
        "departureTime": "08:35",
        "arrivalTime": "16:40",
        "originCode": "EZE",
        "destinationCode": "MIA",
        "originCity": "Buenos Aires",
        "destinationCity": "Miami",
        "legs": [
          {
            "departure": {
              "city_code": "EZE",
              "city_name": "Buenos Aires",
              "time": "08:35"
            },
            "arrival": {
              "city_code": "MIA",
              "city_name": "Miami",
              "time": "16:40"
            },
            "duration": "8h 5m",
            "flight_type": "outbound",
            "price": 714.93,
            "airline": "AA American Airlines",
            "layovers": []
          }
        ]
      }
    ],
    "hotels": [
      {
        "name": "SOLYMAR BEACH RESORT (Opción 1)",
        "location": "Punta Cana, República Dominicana",
        "price": 450.50,
        "nights": 7
      },
      {
        "name": "GRAND PALLADIUM (Opción 2)",
        "location": "Punta Cana, República Dominicana",
        "price": 680.00,
        "nights": 7
      }
    ],
    "totalPrice": 1165.43,
    "currency": "USD",
    "passengers": 2,
    "originalTemplate": "3E8394AC-84D4-4286-A1CD-A12D1AB001D5",
    "needsComplexTemplate": false,
    "extractedFromPdfMonkey": true
  },
  "suggestions": [
    "Como este PDF fue generado por nuestro sistema, puedo regenerarlo con cualquier precio que especifiques",
    "Mantendré todos los detalles originales: vuelos, hoteles, fechas, pasajeros",
    "Solo cambiaré los precios según tu solicitud"
  ]
}
```

---

## 5️⃣ Validaciones Propuestas

### 5.1 Estado Actual: ⚠️ NO HAY VALIDACIONES FORMALES

**Problemas Críticos:**
- ✅ Datos se usan directamente sin verificar integridad
- ✅ No hay confidence scores por campo
- ✅ No hay distinción entre errores recuperables vs fatales
- ✅ Campos opcionales vs obligatorios no están definidos formalmente

### 5.2 Sistema de Validación Propuesto

#### A) Categorías de Errores

```typescript
enum ValidationSeverity {
  FATAL = 'fatal',       // Bloquea procesamiento
  RECOVERABLE = 'recoverable', // Permite continuar con defaults
  WARNING = 'warning'    // Informativo, no bloquea
}

interface ValidationError {
  field: string;
  severity: ValidationSeverity;
  message: string;
  suggestedFix?: string;
}
```

#### B) Reglas de Validación por Campo

| Campo | Regla | Severidad | Acción si Falla |
|-------|-------|-----------|-----------------|
| `success` | `=== true` | FATAL | Retornar error inmediato |
| `content` | `!== undefined` | FATAL | "No se pudo extraer datos del PDF" |
| `flights[].airline` | String no vacío | RECOVERABLE | Default: "Aerolínea no especificada" |
| `flights[].route` | Patrón `XXX → XXX` | FATAL | "Ruta de vuelo inválida" |
| `flights[].price` | `>= 0` | RECOVERABLE | Default: 0 (warning: precio no encontrado) |
| `flights[].originCode` | IATA 3 letras | FATAL | "Código de origen inválido" |
| `flights[].legs` | Array no vacío | RECOVERABLE | Crear leg genérico desde route |
| `hotels[].name` | String no vacío | RECOVERABLE | Default: "Hotel no especificado" |
| `hotels[].price` | `>= 0` | RECOVERABLE | Default: 0 (warning) |
| `hotels[].nights` | `>= 0` | RECOVERABLE | Default: 0 (calcular desde fechas) |
| `totalPrice` | `>= 0 && < 50000` | WARNING | Si > 50k: "Precio sospechosamente alto" |
| `passengers` | `>= 1 && <= 20` | RECOVERABLE | Default: 1 |
| `currency` | Enum válido | RECOVERABLE | Default: "USD" |

#### C) Confidence Score por Campo

```typescript
interface FieldConfidence {
  field: string;
  value: any;
  confidence: number; // 0.0 - 1.0
  extractionMethod: 'pattern_match' | 'fallback' | 'inferred' | 'calculated';
  source?: string; // Qué patrón/función extrajo el dato
}

// Ejemplo:
{
  field: 'flights[0].airline',
  value: 'AA American Airlines',
  confidence: 0.95,
  extractionMethod: 'pattern_match',
  source: 'Pattern 0: ✈\\s*Vuelos\\s+([A-Z0-9]{2,3})...'
}

{
  field: 'hotels[0].price',
  value: 450.50,
  confidence: 0.70,
  extractionMethod: 'fallback',
  source: 'Pattern 3: Any USD price in section'
}
```

**Escalas de Confianza:**
- **0.9-1.0**: Extracción directa del template conocido
- **0.7-0.89**: Patrón robusto (múltiples validaciones)
- **0.5-0.69**: Fallback pattern (1 validación)
- **0.3-0.49**: Inferido (defaults aplicados)
- **0.0-0.29**: Dato placeholder (no extraído)

#### D) Validador de Schema

```typescript
async function validatePdfAnalysisResult(
  result: PdfAnalysisResult
): Promise<{
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  confidenceScores: FieldConfidence[];
  overallConfidence: number; // Promedio ponderado
}> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const confidenceScores: FieldConfidence[] = [];

  // 1. Validar estructura básica
  if (!result.success) {
    errors.push({
      field: 'root',
      severity: ValidationSeverity.FATAL,
      message: result.error || 'PDF processing failed'
    });
    return {
      isValid: false,
      errors,
      warnings,
      confidenceScores,
      overallConfidence: 0
    };
  }

  // 2. Validar campos obligatorios
  if (!result.content) {
    errors.push({
      field: 'content',
      severity: ValidationSeverity.FATAL,
      message: 'No content extracted from PDF'
    });
  }

  // 3. Validar vuelos
  if (result.content?.flights) {
    result.content.flights.forEach((flight, idx) => {
      // Validar ruta
      if (!flight.route || !/^[A-Z]{3} → [A-Z]{3}$/.test(flight.route)) {
        errors.push({
          field: `flights[${idx}].route`,
          severity: ValidationSeverity.FATAL,
          message: `Invalid route format: "${flight.route}"`,
          suggestedFix: 'Verify airport codes are valid IATA codes'
        });
      }

      // Confidence score para precio
      if (flight.price > 0) {
        confidenceScores.push({
          field: `flights[${idx}].price`,
          value: flight.price,
          confidence: flight.legs?.length > 0 ? 0.9 : 0.6,
          extractionMethod: flight.legs?.length > 0 ? 'calculated' : 'pattern_match'
        });
      } else {
        warnings.push({
          field: `flights[${idx}].price`,
          severity: ValidationSeverity.WARNING,
          message: 'Price not found for flight'
        });
      }
    });
  }

  // 4. Validar hoteles
  if (result.content?.hotels) {
    result.content.hotels.forEach((hotel, idx) => {
      if (!hotel.name || hotel.name === 'Hotel no especificado') {
        warnings.push({
          field: `hotels[${idx}].name`,
          severity: ValidationSeverity.WARNING,
          message: 'Hotel name not extracted, using default'
        });
      }

      if (hotel.price === 0) {
        warnings.push({
          field: `hotels[${idx}].price`,
          severity: ValidationSeverity.WARNING,
          message: 'Hotel price not found'
        });
      }
    });
  }

  // 5. Calcular confianza general
  const overallConfidence = confidenceScores.length > 0
    ? confidenceScores.reduce((sum, c) => sum + c.confidence, 0) / confidenceScores.length
    : 0;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidenceScores,
    overallConfidence
  };
}
```

### 5.3 Missing Fields Detector

```typescript
interface MissingFieldReport {
  category: 'flights' | 'hotels' | 'pricing' | 'passengers';
  requiredFields: string[];
  missingFields: string[];
  optionalFieldsMissing: string[];
  impact: 'critical' | 'moderate' | 'low';
}

function detectMissingFields(result: PdfAnalysisResult): MissingFieldReport[] {
  const reports: MissingFieldReport[] = [];

  // Campos requeridos para vuelos
  if (result.content?.flights) {
    result.content.flights.forEach((flight, idx) => {
      const required = ['airline', 'route', 'dates'];
      const missing = required.filter(f => !flight[f as keyof typeof flight]);

      if (missing.length > 0) {
        reports.push({
          category: 'flights',
          requiredFields: required,
          missingFields: missing,
          optionalFieldsMissing: ['departureTime', 'arrivalTime'].filter(
            f => !flight[f as keyof typeof flight]
          ),
          impact: 'critical'
        });
      }
    });
  }

  // Campos requeridos para hoteles
  if (result.content?.hotels) {
    result.content.hotels.forEach((hotel, idx) => {
      const required = ['name', 'nights'];
      const missing = required.filter(f => !hotel[f as keyof typeof hotel]);

      if (missing.length > 0) {
        reports.push({
          category: 'hotels',
          requiredFields: required,
          missingFields: missing,
          optionalFieldsMissing: ['location', 'price'].filter(
            f => !hotel[f as keyof typeof hotel] || hotel[f as keyof typeof hotel] === 0
          ),
          impact: 'moderate'
        });
      }
    });
  }

  return reports;
}
```

---

## 6️⃣ Bugs y Riesgos Identificados

### 6.1 Lista Priorizada de Problemas

| # | Problema | Severidad | Categoría | Impacto | Ubicación Código |
|---|----------|-----------|-----------|---------|------------------|
| **1** | **División precio ida/vuelta asume 50/50** | 🔴 CRÍTICO | Pricing | Precios incorrectos en asimetrías | `pdfProcessor.ts:3543-3544` |
| **2** | **No valida que código IATA existe** | 🔴 CRÍTICO | Data Integrity | Rutas inválidas aceptadas | `pdfProcessor.ts:3687-3692` |
| **3** | **Parser de precios falla con formatos mixtos** | 🔴 CRÍTICO | Parsing | `"1.485,50 USD"` → 148550 | `pdfProcessor.ts:65-157` |
| **4** | **Corrección de precio multi-hotel solo funciona si flight > hotel** | 🟠 ALTA | Logic Bug | Casos edge no corregidos | `pdfProcessor.ts:375-378` |
| **5** | **Detección de template usa solo 2 indicadores** | 🟠 ALTA | Classification | Falsos positivos | `pdfProcessor.ts:287-290` |
| **6** | **No hay timeout en extracción de texto** | 🟠 ALTA | Performance | PDFs grandes bloquean sistema | `pdfProcessor.ts:455-460` |
| **7** | **Hardcoded template IDs** | 🟡 MEDIA | Maintenance | Dificulta versionado | `pdfMonkey.ts:8-21` |
| **8** | **Escalas (layovers) no se incluyen en precio** | 🟡 MEDIA | Business Logic | Precio total incorrecto | `pdfProcessor.ts:3589-3593` |
| **9** | **Fechas fallback usan +7 días desde hoy** | 🟡 MEDIA | Data Quality | Fechas irreales en PDFs viejos | `pdfProcessor.ts:2634-2637` |
| **10** | **Múltiples hoteles asume pricing aditivo** | 🟡 MEDIA | Logic Bug | Paquetes opcionales sumados | `pdfProcessor.ts:358-362` (Fixed en 343-353) |
| **11** | **No sanitiza nombres de hoteles con caracteres especiales** | 🟢 BAJA | Data Quality | Nombres con emojis/unicode | `pdfProcessor.ts:3939-3945` |
| **12** | **Currency solo soporta 4 monedas** | 🟢 BAJA | Limitation | MXN, COP, etc. no soportados | `pdfProcessor.ts:3072-3089` |

### 6.2 Detalles de Bugs Críticos

#### Bug #1: División Precio Ida/Vuelta Asimétrica

**Código Actual:**
```typescript
const outboundPrice = sectionHasReturn ? sectionTotalPrice / 2 : sectionTotalPrice;
const returnPrice = sectionHasReturn ? sectionTotalPrice / 2 : 0;
```

**Problema:**
- Asume que precio ida = precio vuelta (50/50)
- En realidad, precios pueden variar significativamente (ej: ida $300, vuelta $700)

**Casos de Falla:**
```
Caso 1: Temporada alta/baja
PDF:    Ida (baja): $400, Vuelta (alta): $900
Actual: Ida: $650, Vuelta: $650 ❌
Real:   Ida: $400, Vuelta: $900 ✅

Caso 2: Aerolíneas diferentes
PDF:    Ida (JetSmart): $200, Vuelta (LATAM): $600
Actual: Ida: $400, Vuelta: $400 ❌
Real:   Ida: $200, Vuelta: $600 ✅
```

**Fix Propuesto:**
```typescript
// Extraer precios individuales de cada leg si están disponibles
const outboundPricePattern = /Vuelo de ida[\s\S]{0,500}?(\d+[.,\d]*)\s*USD/i;
const returnPricePattern = /Vuelo de regreso[\s\S]{0,500}?(\d+[.,\d]*)\s*USD/i;

const outboundMatch = section.outboundContent.match(outboundPricePattern);
const returnMatch = section.returnContent.match(returnPricePattern);

let outboundPrice = 0;
let returnPrice = 0;

if (outboundMatch && returnMatch) {
  // Precios individuales encontrados
  outboundPrice = parsePrice(outboundMatch[1]);
  returnPrice = parsePrice(returnMatch[1]);
} else {
  // Fallback: dividir 50/50 con warning
  outboundPrice = sectionTotalPrice / 2;
  returnPrice = sectionTotalPrice / 2;
  console.warn('⚠️ Individual leg prices not found, splitting 50/50');
}
```

#### Bug #2: Código IATA No Validado

**Problema:**
- Acepta cualquier string de 3 letras como código IATA válido
- No valida contra lista oficial de aeropuertos

**Casos de Falla:**
```
Input PDF:  "XXX → YYY" (códigos inventados)
Output:     { originCode: "XXX", destinationCode: "YYY" } ✅ (sin error)
Esperado:   Error: "Invalid IATA code: XXX"
```

**Fix Propuesto:**
```typescript
const VALID_IATA_CODES = new Set([
  'EZE', 'AEP', 'MIA', 'PUJ', 'CUN', 'MAD', 'BCN', 'GRU', 'PTY', // ...etc
]);

function validateIATACode(code: string): boolean {
  return VALID_IATA_CODES.has(code.toUpperCase());
}

// En extracción:
if (!validateIATACode(originCode)) {
  errors.push({
    field: 'originCode',
    severity: ValidationSeverity.FATAL,
    message: `Invalid IATA code: ${originCode}`
  });
}
```

#### Bug #3: Parser de Precios con Formatos Mixtos

**Problema Actual:**
```typescript
// Input: "1.485,50 USD"
const lastDotIndex = 1;
const lastCommaIndex = 5;

if (lastCommaIndex > lastDotIndex) {
  // EU format: remove dots, replace comma with dot
  result = parseFloat("1.485,50".replace(/\./g, '').replace(',', '.'));
  // → parseFloat("148550") → 148550 ❌❌❌
}

// Esperado: 1485.50
```

**Fix Propuesto:**
```typescript
function parsePrice(priceStr: string): number {
  // ... (código existente) ...

  // NUEVO: Validación adicional para EU format
  if (lastCommaIndex > lastDotIndex) {
    // Verificar que la coma esté en posición de decimales (últimos 3 caracteres)
    const commaPosition = cleaned.length - lastCommaIndex - 1;

    if (commaPosition <= 2) {
      // Es decimal: "1.485,50" → remove dots, replace comma
      const result = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      console.log('💰 [PARSE PRICE] EU format (validated):', result);
      return result;
    } else {
      // Coma no está en posición decimal, tratar como error
      console.error('💰 [PARSE PRICE] Ambiguous format:', priceStr);
      return parseFloat(cleaned.replace(/[.,]/g, '')); // Remove all separators
    }
  }

  // ... (resto del código) ...
}
```

---

## 7️⃣ Tests Propuestos

### 7.1 Set Mínimo de PDFs de Test

| ID | Nombre Archivo | Descripción | Template | Expected Output |
|----|----------------|-------------|----------|-----------------|
| **T1** | `test_single_flight_oneway.pdf` | 1 vuelo one-way, sin escalas | Simple Flights | 1 flight, 0 hotels |
| **T2** | `test_roundtrip_direct.pdf` | Ida+Vuelta directo | Complex Flights | 2 flights (ida/vuelta) |
| **T3** | `test_roundtrip_1_layover.pdf` | Ida+Vuelta con 1 escala c/u | Complex Flights | 2 flights, 2 layovers |
| **T4** | `test_flight_hotel_single.pdf` | 1 vuelo + 1 hotel | Combined | 1 flight, 1 hotel |
| **T5** | `test_flight_2hotels_options.pdf` | 1 vuelo + 2 hoteles (opciones) | Combined | 1 flight, 2 hotels (opciones) |
| **T6** | `test_2flights_2hotels.pdf` | 2 vuelos + 2 hoteles (diferentes) | Combined | 2 flights, 2 hotels |
| **T7** | `test_multi_layover_complex.pdf` | 3 escalas, ida+vuelta | Complex Flights | 2 flights, 6 layovers |
| **T8** | `test_price_formats_eu.pdf` | Precios en formato EU: 1.485,50 | Any | Precios parseados correctamente |
| **T9** | `test_price_formats_us.pdf` | Precios en formato US: 1,485.50 | Any | Precios parseados correctamente |
| **T10** | `test_external_pdf_softur.pdf` | PDF de SOFTUR (externo) | N/A | Parsing genérico |
| **T11** | `test_missing_prices.pdf` | Hotel sin precio, vuelo sin precio | Combined | Warnings, defaults aplicados |
| **T12** | `test_invalid_iata_codes.pdf` | Códigos inventados (XXX, YYY) | Any | Errores de validación |

### 7.2 Tests Unitarios

```typescript
describe('PDF Processor - Price Parser', () => {
  test('should parse US format correctly', () => {
    expect(parsePrice('2,549.32')).toBe(2549.32);
    expect(parsePrice('1,485.00')).toBe(1485.00);
  });

  test('should parse EU format correctly', () => {
    expect(parsePrice('2.549,32')).toBe(2549.32);
    expect(parsePrice('1.485,50')).toBe(1485.50);
  });

  test('should parse ambiguous Latino format', () => {
    expect(parsePrice('1.485')).toBe(1485); // Thousands
    expect(parsePrice('10.50')).toBe(10.50); // Decimal
  });

  test('should handle no separators', () => {
    expect(parsePrice('2549')).toBe(2549);
  });

  test('should handle invalid input', () => {
    expect(parsePrice('')).toBe(0);
    expect(parsePrice('abc')).toBe(0);
  });
});

describe('PDF Processor - IATA Validation', () => {
  test('should accept valid IATA codes', () => {
    expect(validateIATACode('EZE')).toBe(true);
    expect(validateIATACode('MIA')).toBe(true);
  });

  test('should reject invalid IATA codes', () => {
    expect(validateIATACode('XXX')).toBe(false);
    expect(validateIATACode('123')).toBe(false);
  });
});

describe('PDF Processor - Template Detection', () => {
  test('should detect PDFMonkey template by content', () => {
    const content = 'PRESUPUESTO DE VIAJE\\n\\nDETALLE DEL VUELO\\n\\nPara confirmar';
    expect(isPdfMonkeyTemplateByContent(content)).toBe(true);
  });

  test('should reject external PDFs', () => {
    const content = 'Cotización generada por SOFTUR\\n\\nVuelo: EZE-MIA';
    expect(isPdfMonkeyTemplateByContent(content)).toBe(false);
  });
});

describe('PDF Processor - Multi-Hotel Extraction', () => {
  test('should extract package options correctly', () => {
    const content = `
      Opción 1 $1200 USD
      🏨 Hotel
      SOLYMAR BEACH RESORT
      Precio: $450 USD

      Opción 2 $1500 USD
      🏨 Hotel
      GRAND PALLADIUM
      Precio: $680 USD
    `;

    const hotels = extractHotelsFromPdfMonkeyTemplate(content);

    expect(hotels).toHaveLength(2);
    expect(hotels[0].name).toContain('Opción 1');
    expect(hotels[1].name).toContain('Opción 2');
    expect(hotels[0].price).toBe(450);
    expect(hotels[1].price).toBe(680);
  });

  test('should NOT sum package option prices', () => {
    const content = `
      Opción Económica $1200 USD
      Opción Premium $1500 USD
    `;

    const result = extractPdfMonkeyDataFromContent('test.pdf', content);

    // Debe usar el precio de la opción económica, NO la suma
    expect(result.content?.totalPrice).toBe(1200); // NOT 2700
  });
});
```

### 7.3 Tests de Integración

```typescript
describe('PDF Processor - End-to-End', () => {
  test('E2E: Single flight roundtrip', async () => {
    const file = new File([/* ... */], 'test_roundtrip.pdf');

    const result = await analyzePdfContent(file);

    expect(result.success).toBe(true);
    expect(result.content?.flights).toHaveLength(2); // Ida + Vuelta
    expect(result.content?.flights[0].flight_type).toBe('outbound');
    expect(result.content?.flights[1].flight_type).toBe('return');
  });

  test('E2E: Flight + 2 hotel options', async () => {
    const file = new File([/* ... */], 'test_options.pdf');

    const result = await analyzePdfContent(file);

    expect(result.content?.flights).toHaveLength(1);
    expect(result.content?.hotels).toHaveLength(2);
    expect(result.content?.hotels[0].name).toContain('Opción');

    // Validar que precio total usa opción económica
    const flightPrice = result.content?.flights[0].price || 0;
    const cheapestHotel = Math.min(...(result.content?.hotels.map(h => h.price) || [0]));
    expect(result.content?.totalPrice).toBe(flightPrice + cheapestHotel);
  });

  test('E2E: Validation catches missing required fields', async () => {
    const file = new File([/* ... */], 'test_incomplete.pdf');

    const result = await analyzePdfContent(file);
    const validation = await validatePdfAnalysisResult(result);

    expect(validation.errors).toContainEqual(
      expect.objectContaining({
        severity: ValidationSeverity.FATAL,
        field: expect.stringMatching(/route/)
      })
    );
  });
});
```

---

## 8️⃣ Cambios Concretos Recomendados

### 8.1 Prioridad CRÍTICA (Implementar Primero)

#### 1. Agregar Sistema de Validación

**Archivo:** `src/services/pdfValidator.ts` (NUEVO)

```typescript
export { validatePdfAnalysisResult, ValidationSeverity, ValidationError, FieldConfidence };
```

**Integración en pdfProcessor.ts:**
```typescript
// En analyzePdfContent(), antes de retornar:
const validation = await validatePdfAnalysisResult(result);

if (!validation.isValid) {
  console.error('❌ PDF validation failed:', validation.errors);
  return {
    success: false,
    error: validation.errors.map(e => e.message).join('; ')
  };
}

// Agregar metadata de confianza al resultado
return {
  ...result,
  _validation: {
    overallConfidence: validation.overallConfidence,
    warnings: validation.warnings,
    confidenceScores: validation.confidenceScores
  }
};
```

#### 2. Fix Parser de Precios Mixtos

**Archivo:** `pdfProcessor.ts:65-157`

**Cambio:**
```typescript
// Línea 144-149 (REEMPLAZAR)
if (lastCommaIndex > lastDotIndex) {
  // Verificar posición de coma (debe ser decimal: últimos 3 chars)
  const digitsAfterComma = cleaned.length - lastCommaIndex - 1;

  if (digitsAfterComma <= 2) {
    // ES DECIMAL: "1.485,50"
    const result = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    console.log('💰 [PARSE PRICE] EU format (validated):', result);
    return result;
  } else {
    // AMBIGUO: coma no es decimal
    console.warn('💰 [PARSE PRICE] Ambiguous comma position:', priceStr);
    // Asumir que TODOS son separadores de miles
    const result = parseFloat(cleaned.replace(/[.,]/g, ''));
    console.log('💰 [PARSE PRICE] Removed all separators:', result);
    return result;
  }
}
```

#### 3. Validar Códigos IATA

**Archivo:** `src/utils/iataValidator.ts` (NUEVO)

```typescript
// Lista de códigos IATA válidos (top 200 aeropuertos)
export const VALID_IATA_CODES = new Set([
  'EZE', 'AEP', 'MIA', 'PUJ', 'CUN', 'MAD', 'BCN', 'GRU', 'GIG', 'PTY',
  'ATL', 'LAX', 'ORD', 'DFW', 'JFK', 'LGA', 'CDG', 'LHR', 'FRA', 'AMS',
  'FCO', 'ARN', 'CPH', 'DUB', 'LIS', 'BOG', 'LIM', 'SCL', 'MEX', 'GDL',
  // ... (agregar los ~200 más usados)
]);

export function validateIATACode(code: string): boolean {
  return VALID_IATA_CODES.has(code.toUpperCase());
}

export function suggestIATACode(invalidCode: string): string[] {
  // Sugerencias basadas en Levenshtein distance
  // Ej: "EXE" → ["EZE"]
  return Array.from(VALID_IATA_CODES)
    .filter(valid => levenshteinDistance(invalidCode, valid) <= 1)
    .slice(0, 3);
}
```

**Integración:**
```typescript
// En extractFlightsFromPdfMonkeyTemplate()
if (originCode && !validateIATACode(originCode)) {
  const suggestions = suggestIATACode(originCode);
  console.error(`❌ Invalid origin code: ${originCode}. Did you mean: ${suggestions.join(', ')}?`);
}
```

### 8.2 Prioridad ALTA (Segunda Fase)

#### 4. Extraer Precios Individuales de Ida/Vuelta

**Archivo:** `pdfProcessor.ts:3543-3544`

```typescript
// REEMPLAZAR división 50/50:
function extractIndividualLegPrices(
  outboundContent: string,
  returnContent: string,
  totalPrice: number
): { outboundPrice: number; returnPrice: number } {
  // Intentar extraer precios individuales
  const outboundMatch = outboundContent.match(/(\d+[.,\d]*)\s*USD/i);
  const returnMatch = returnContent.match(/(\d+[.,\d]*)\s*USD/i);

  if (outboundMatch && returnMatch) {
    const ob = parsePrice(outboundMatch[1]);
    const ret = parsePrice(returnMatch[1]);

    // Validar que suman aproximadamente al total (±5%)
    const sum = ob + ret;
    const diff = Math.abs(sum - totalPrice);

    if (diff / totalPrice <= 0.05) {
      console.log(`✅ Individual leg prices found: $${ob} + $${ret} = $${sum}`);
      return { outboundPrice: ob, returnPrice: ret };
    } else {
      console.warn(`⚠️ Leg prices don't match total: $${sum} vs $${totalPrice}`);
    }
  }

  // Fallback: dividir 50/50
  console.warn('⚠️ Splitting 50/50 (individual prices not found)');
  return {
    outboundPrice: totalPrice / 2,
    returnPrice: totalPrice / 2
  };
}
```

#### 5. Agregar Timeout a Extracción de Texto

**Archivo:** `pdfProcessor.ts:455-460`

```typescript
const EXTRACTION_TIMEOUT = 30000; // 30 segundos

const { data: extractionResult, error } = await Promise.race([
  supabase.functions.invoke('pdf-text-extractor', {
    body: { pdfData: Array.from(uint8Array), fileName: file.name }
  }),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('PDF extraction timeout')), EXTRACTION_TIMEOUT)
  )
]);
```

#### 6. Mejorar Detección de Template (3+ Indicadores)

**Archivo:** `pdfProcessor.ts:287-290`

```typescript
// CAMBIAR umbral de 2 a 3 coincidencias:
return matchCount >= 3; // Era: >= 2
```

### 8.3 Prioridad MEDIA (Tercera Fase)

#### 7. Versionado de Templates

**Archivo:** `pdfMonkey.ts:8-21`

```typescript
// Estructura versionada
interface TemplateVersion {
  id: string;
  version: string;
  deprecated: boolean;
}

export const TEMPLATE_VERSIONS = {
  combined: [
    { id: '3E8394AC-84D4-4286-A1CD-A12D1AB001D5', version: 'v2', deprecated: false },
    { id: 'OLD_ID_1', version: 'v1', deprecated: true }
  ],
  flights: [
    { id: '67B7F3A5-7BFE-4F52-BE6B-110371CB9376', version: 'v1', deprecated: false }
  ],
  // ...
};

export function getLatestTemplate(type: string): TemplateVersion {
  return TEMPLATE_VERSIONS[type].find(t => !t.deprecated)!;
}
```

#### 8. Soporte para Más Monedas

**Archivo:** `pdfProcessor.ts:3072-3089`

```typescript
const SUPPORTED_CURRENCIES = {
  'USD': 'USD', 'US$': 'USD',
  'EUR': 'EUR', '€': 'EUR',
  'ARS': 'ARS', '$AR': 'ARS',
  'BRL': 'BRL', 'R$': 'BRL',
  'MXN': 'MXN', '$MX': 'MXN',
  'COP': 'COP', '$CO': 'COP',
  'CLP': 'CLP', '$CL': 'CLP',
  'PEN': 'PEN', 'S/': 'PEN'
};

function extractCurrency(text: string): string {
  for (const [symbol, code] of Object.entries(SUPPORTED_CURRENCIES)) {
    if (text.includes(symbol)) {
      return code;
    }
  }
  return 'USD';
}
```

---

## 9️⃣ Resumen de Gaps Críticos

### 9.1 Pérdida de Información

| Categoría | Datos Perdidos | Ubicación | Impacto |
|-----------|----------------|-----------|---------|
| **Escalas** | Aerolínea de conexión, terminal | Layovers extraction | BAJO - Info secundaria |
| **Hoteles** | Régimen de comidas (All-Inclusive, etc.) | Hotel extraction | MEDIO - Importante para cliente |
| **Vuelos** | Clase de cabina (Economy/Business) | Flight extraction | MEDIO |
| **Vuelos** | Número de vuelo específico | Flight extraction | BAJO |
| **Precios** | Impuestos desglosados | Price extraction | BAJO - Total es suficiente |
| **Servicios** | Detalles de traslados (origen/destino) | Services | MEDIO |

### 9.2 Ambigüedades

| Caso | Situación Actual | Problema | Solución Propuesta |
|------|------------------|----------|-------------------|
| **Opciones vs Múltiples Hoteles** | Se detecta por patrón "Opción X" | Si PDF no usa esta palabra, falla | Agregar heurística: si 2+ hoteles tienen mismo destino/noches → probablemente opciones |
| **Precio Paquete vs Suma** | Depende de detección correcta | Falla si "Opción" está mal escrito | Usar precio total extraído como source of truth, validar contra suma |
| **Formato de Precio** | Parser inteligente con heurísticas | Formatos ambiguos (ej: "1.485") | Agregar metadata de formato detectado en resultado |
| **Template de Ida+Vuelta vs 2 Vuelos** | Usa "Vuelo de ida/regreso" | PDFs externos pueden usar otras palabras | Expandir diccionario de patterns |

### 9.3 Inferencias Sin Evidencia

| Campo | Inferencia | Justificación | Riesgo |
|-------|------------|---------------|--------|
| `departure_date` | +7 días desde hoy si no encuentra | Mejor que NULL | 🟡 MEDIO - Fecha irreal |
| `duration` | "10h" si no calcula | Placeholder visual | 🟢 BAJO - Solo display |
| `passengers` | 1 si no encuentra | Asunción razonable | 🟢 BAJO |
| `currency` | "USD" si no encuentra | Moneda más común | 🟡 MEDIO - Puede ser ARS/EUR |
| `nights` | 0 si no encuentra | Evita NULL | 🟡 MEDIO - 0 noches es inválido |
| `airline.name` | "Aerolínea no especificada" | Fallback | 🟢 BAJO - Obvio que es placeholder |

---

## 🎯 Conclusión y Próximos Pasos

### Estado Actual del Sistema: **7/10**

**Fortalezas:**
- ✅ Parseo robusto para templates propios (PDFMonkey)
- ✅ Parser de precios inteligente con múltiples formatos
- ✅ Soporte avanzado para multi-hotel (opciones de paquete)
- ✅ Corrección automática de precios en casos edge

**Debilidades Críticas:**
- ❌ **NO hay validación formal** de datos extraídos
- ❌ **NO hay confidence scores** por campo
- ❌ **NO valida códigos IATA** contra lista oficial
- ❌ Bug en parser de precios con formatos mixtos EU

### Roadmap de Mejoras

**Fase 1 (2-3 días):**
1. Implementar sistema de validación completo
2. Fix parser de precios mixtos
3. Agregar validación de códigos IATA

**Fase 2 (3-5 días):**
4. Extraer precios individuales de ida/vuelta
5. Agregar timeout a extracción
6. Mejorar detección de template (3 indicadores)
7. Crear suite de tests (12 PDFs de ejemplo)

**Fase 3 (1 semana):**
8. Versionado de templates
9. Soporte para más monedas
10. Mejorar extracción de PDFs externos
11. Documentar API de validación

### Métricas de Éxito

- **Tasa de Éxito**: 95%+ PDFs parseados correctamente
- **Confidence Score**: Promedio > 0.85
- **Errores Fatales**: < 2% de PDFs
- **Tiempo de Extracción**: < 5 segundos (P95)
- **Coverage de Tests**: > 80%

---

**Documento generado:** 2025-01-20
**Versión del código analizado:** Commit `65f1e6b`
**Autor:** Claude Code Assistant
