# 🧪 Casos de Test para Sistema de Parseo de PDFs

## 📋 Índice
1. [Tests Unitarios - Parser de Precios](#1-tests-unitarios---parser-de-precios)
2. [Tests Unitarios - Extracción de Vuelos](#2-tests-unitarios---extracción-de-vuelos)
3. [Tests Unitarios - Extracción de Hoteles](#3-tests-unitarios---extracción-de-hoteles)
4. [Tests de Integración - End-to-End](#4-tests-de-integración---end-to-end)
5. [Tests de Validación](#5-tests-de-validación)
6. [PDFs de Ejemplo Requeridos](#6-pdfs-de-ejemplo-requeridos)

---

## 1. Tests Unitarios - Parser de Precios

### Test Suite: `parsePrice()`

```typescript
describe('PDF Processor - Price Parser', () => {
  describe('US Format', () => {
    test('should parse standard US format with commas', () => {
      expect(parsePrice('2,549.32')).toBe(2549.32);
      expect(parsePrice('1,485.00')).toBe(1485.00);
      expect(parsePrice('15,234.50')).toBe(15234.50);
    });

    test('should parse US format without commas', () => {
      expect(parsePrice('2549.32')).toBe(2549.32);
      expect(parsePrice('100.00')).toBe(100.00);
    });

    test('should parse large US numbers', () => {
      expect(parsePrice('1,234,567.89')).toBe(1234567.89);
    });
  });

  describe('EU/Latino Format', () => {
    test('should parse EU format with dots and comma', () => {
      expect(parsePrice('2.549,32')).toBe(2549.32);
      expect(parsePrice('1.485,50')).toBe(1485.50);
      expect(parsePrice('15.234,75')).toBe(15234.75);
    });

    test('should parse Latino ambiguous format (thousands)', () => {
      expect(parsePrice('1.485')).toBe(1485); // 3 digits after dot = thousands
      expect(parsePrice('2.500')).toBe(2500);
      expect(parsePrice('10.000')).toBe(10000);
    });

    test('should parse decimal format correctly', () => {
      expect(parsePrice('10.50')).toBe(10.5); // 2 digits after dot = decimal
      expect(parsePrice('99.99')).toBe(99.99);
      expect(parsePrice('5.5')).toBe(5.5); // 1 digit after dot = decimal
    });

    test('should parse large EU numbers', () => {
      expect(parsePrice('1.234.567,89')).toBe(1234567.89);
    });
  });

  describe('Edge Cases', () => {
    test('should handle no separators', () => {
      expect(parsePrice('2549')).toBe(2549);
      expect(parsePrice('100')).toBe(100);
    });

    test('should handle currency symbols', () => {
      expect(parsePrice('$2,549.32')).toBe(2549.32);
      expect(parsePrice('USD 1.485,50')).toBe(1485.50);
      expect(parsePrice('2.549,32 USD')).toBe(2549.32);
    });

    test('should handle whitespace', () => {
      expect(parsePrice('  2,549.32  ')).toBe(2549.32);
      expect(parsePrice('USD  1.485,50')).toBe(1485.50);
    });

    test('should handle invalid input gracefully', () => {
      expect(parsePrice('')).toBe(0);
      expect(parsePrice('abc')).toBe(0);
      expect(parsePrice('N/A')).toBe(0);
    });

    test('should handle zero', () => {
      expect(parsePrice('0')).toBe(0);
      expect(parsePrice('0.00')).toBe(0);
      expect(parsePrice('0,00')).toBe(0);
    });
  });

  describe('Mixed Formats (Bug Cases)', () => {
    test('should handle EU format with validation', () => {
      // CRITICAL: This is the bug case
      expect(parsePrice('1.485,50')).toBe(1485.50); // NOT 148550
      expect(parsePrice('2.549,99')).toBe(2549.99); // NOT 254999
    });

    test('should disambiguate based on position', () => {
      expect(parsePrice('1.485')).toBe(1485); // 3 digits = thousands
      expect(parsePrice('1.48')).toBe(1.48);  // 2 digits = decimal
      expect(parsePrice('1.4')).toBe(1.4);    // 1 digit = decimal
    });
  });
});
```

---

## 2. Tests Unitarios - Extracción de Vuelos

### Test Suite: `extractFlightsFromPdfMonkeyTemplate()`

```typescript
describe('PDF Processor - Flight Extraction', () => {
  describe('Single One-Way Flight', () => {
    test('should extract basic flight info', () => {
      const content = `
        ✈ Vuelos AA American Airlines
        Ocupación: 2 adultos

        EZE Buenos Aires 08:35
        MIA Miami 16:40

        Vuelo de ida 2025-01-15

        1429.86 USD Precio total
      `;

      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights).toHaveLength(1);
      expect(flights[0]).toMatchObject({
        airline: expect.stringContaining('American'),
        route: 'EZE → MIA',
        price: 1429.86,
        dates: '2025-01-15',
        departureTime: '08:35',
        arrivalTime: '16:40',
        originCode: 'EZE',
        destinationCode: 'MIA'
      });
    });

    test('should extract airline code and name separately', () => {
      const content = `✈ Vuelos LA LATAM Airlines`;
      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights[0].airline).toContain('LATAM');
    });
  });

  describe('Round Trip Flights', () => {
    test('should extract outbound and return flights', () => {
      const content = `
        ✈ Vuelos AA American Airlines

        Vuelo de ida 2025-01-15
        EZE Buenos Aires 08:35
        MIA Miami 16:40

        Vuelo de regreso 2025-01-22
        MIA Miami 18:00
        EZE Buenos Aires 06:30

        2859.72 USD Precio total
      `;

      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights).toHaveLength(2);

      // Outbound
      expect(flights[0]).toMatchObject({
        route: 'EZE → MIA',
        dates: '2025-01-15'
      });

      // Return
      expect(flights[1]).toMatchObject({
        route: 'MIA → EZE',
        dates: '2025-01-22'
      });
    });

    test('should split price 50/50 if individual prices not found', () => {
      const content = `
        Vuelo de ida 2025-01-15
        EZE Buenos Aires 08:35
        MIA Miami 16:40

        Vuelo de regreso 2025-01-22
        MIA Miami 18:00
        EZE Buenos Aires 06:30

        2000 USD Precio total
      `;

      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights[0].price).toBe(1000); // 2000 / 2
      expect(flights[1].price).toBe(1000);
    });
  });

  describe('Flights with Layovers', () => {
    test('should extract layover information', () => {
      const content = `
        EZE Buenos Aires 08:35
        PTY Panamá 14:20
        MIA Miami 18:45

        Escala en Ciudad de Panamá
        Tiempo de espera: 2h 15m en PTY (Tocumen International)
      `;

      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights[0].legs).toBeDefined();
      expect(flights[0].legs[0].layovers).toHaveLength(1);
      expect(flights[0].legs[0].layovers[0]).toMatchObject({
        destination_city: 'Tocumen International',
        destination_code: 'PTY',
        waiting_time: '2h 15m'
      });
    });

    test('should handle multiple layovers', () => {
      const content = `
        EZE Buenos Aires 10:00
        SCL Santiago 13:30
        PTY Panamá 18:00
        MIA Miami 22:30

        Escala en Santiago
        Tiempo de espera: 1h 30m en SCL (Arturo Merino Benítez)

        Escala en Panamá
        Tiempo de espera: 2h 0m en PTY (Tocumen)
      `;

      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights[0].legs[0].layovers).toHaveLength(2);
    });
  });

  describe('Multiple Flight Options', () => {
    test('should extract 2 flight options', () => {
      const content = `
        ✈ Vuelos AA American Airlines
        EZE Buenos Aires 08:00
        MIA Miami 16:00
        1200 USD Precio total

        ✈ Vuelos LA LATAM Airlines
        EZE Buenos Aires 10:00
        MIA Miami 18:00
        1500 USD Precio total
      `;

      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights).toHaveLength(2);
      expect(flights[0].airline).toContain('American');
      expect(flights[0].price).toBe(1200);
      expect(flights[1].airline).toContain('LATAM');
      expect(flights[1].price).toBe(1500);
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing prices', () => {
      const content = `
        EZE Buenos Aires 08:00
        MIA Miami 16:00
      `;

      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights[0].price).toBe(0);
    });

    test('should handle missing airline name', () => {
      const content = `
        EZE Buenos Aires 08:00
        MIA Miami 16:00
      `;

      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights[0].airline).toBe('Aerolínea no especificada');
    });

    test('should create fallback leg if no structured data', () => {
      const content = `
        DESTINO EZE -- MIA
        Vuelo de ida 2025-01-15
      `;

      const flights = extractFlightsFromPdfMonkeyTemplate(content);

      expect(flights).toHaveLength(1);
      expect(flights[0].route).toBe('EZE → MIA');
    });
  });
});
```

---

## 3. Tests Unitarios - Extracción de Hoteles

### Test Suite: `extractHotelsFromPdfMonkeyTemplate()`

```typescript
describe('PDF Processor - Hotel Extraction', () => {
  describe('Single Hotel', () => {
    test('should extract basic hotel info', () => {
      const content = `
        🏨 Hotel
        SOLYMAR BEACH RESORT
        5 estrellas Punta Cana, República Dominicana

        7 Noches
        Precio: $450.50 USD
      `;

      const hotels = extractHotelsFromPdfMonkeyTemplate(content);

      expect(hotels).toHaveLength(1);
      expect(hotels[0]).toMatchObject({
        name: 'SOLYMAR BEACH RESORT',
        location: expect.stringContaining('Punta Cana'),
        price: 450.50,
        nights: 7
      });
    });

    test('should extract stars rating', () => {
      const content = `
        GRAND PALLADIUM 5 estrellas
        Punta Cana
      `;

      const hotels = extractHotelsFromPdfMonkeyTemplate(content);

      expect(hotels[0].name).toContain('GRAND PALLADIUM');
    });
  });

  describe('Multiple Hotels (Package Options)', () => {
    test('should detect and extract package options', () => {
      const content = `
        Opción 1 $1200 USD
        🏨 Hotel
        SOLYMAR BEACH RESORT
        Precio: $450 USD

        Opción 2 $1500 USD
        🏨 Hotel
        GRAND PALLADIUM
        Precio: $680 USD

        7 Noches
      `;

      const hotels = extractHotelsFromPdfMonkeyTemplate(content);

      expect(hotels).toHaveLength(2);
      expect(hotels[0].name).toContain('Opción 1');
      expect(hotels[1].name).toContain('Opción 2');
      expect(hotels[0].price).toBe(450);
      expect(hotels[1].price).toBe(680);
    });

    test('should normalize option labels', () => {
      const content = `
        Opción Económica $1200 USD
        🏨 Hotel A
        Precio: $400 USD

        Opción Premium $1800 USD
        🏨 Hotel B
        Precio: $700 USD
      `;

      const hotels = extractHotelsFromPdfMonkeyTemplate(content);

      expect(hotels[0].name).toContain('Opción 1'); // Económica → 1
      expect(hotels[1].name).toContain('Opción 2'); // Premium → 2
    });

    test('should use cheapest hotel for total calculation', () => {
      const content = `
        Opción 1 $1200 USD
        Precio: $450 USD

        Opción 2 $1500 USD
        Precio: $680 USD
      `;

      const hotels = extractHotelsFromPdfMonkeyTemplate(content);
      const result = extractPdfMonkeyDataFromContent('test.pdf', content);

      // Total should use cheapest option, NOT sum
      expect(result.content?.totalPrice).toBe(1200); // NOT 1650 or 2700
    });
  });

  describe('Multiple Different Hotels (Not Options)', () => {
    test('should extract multiple hotels in same package', () => {
      const content = `
        🏨 Hotel
        HOTEL MIAMI BEACH
        5 estrellas Miami, USA
        3 Noches
        Precio: $300 USD

        🏨 Hotel
        SOLYMAR BEACH RESORT
        5 estrellas Punta Cana, RD
        7 Noches
        Precio: $450 USD
      `;

      const hotels = extractHotelsFromPdfMonkeyTemplate(content);

      expect(hotels).toHaveLength(2);
      expect(hotels[0].name).toBe('HOTEL MIAMI BEACH');
      expect(hotels[0].nights).toBe(3);
      expect(hotels[1].name).toBe('SOLYMAR BEACH RESORT');
      expect(hotels[1].nights).toBe(7);
    });

    test('should sum prices for multiple hotels', () => {
      const content = `
        Hotel A: $300 USD
        Hotel B: $450 USD
      `;

      // Should sum: 300 + 450 = 750
      const result = extractPdfMonkeyDataFromContent('test.pdf', content);

      // This assumes multi-hotel without "Opción" pattern
      expect(result.content?.hotels).toHaveLength(2);
      // Total should be sum of both
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing hotel name', () => {
      const content = `
        5 estrellas Punta Cana
        Precio: $450 USD
        7 Noches
      `;

      const hotels = extractHotelsFromPdfMonkeyTemplate(content);

      expect(hotels[0].name).toBe('Hotel no especificado');
    });

    test('should handle missing price', () => {
      const content = `
        SOLYMAR BEACH RESORT
        7 Noches
      `;

      const hotels = extractHotelsFromPdfMonkeyTemplate(content);

      expect(hotels[0].price).toBe(0);
    });

    test('should handle missing nights', () => {
      const content = `
        SOLYMAR BEACH RESORT
        Precio: $450 USD
      `;

      const hotels = extractHotelsFromPdfMonkeyTemplate(content);

      expect(hotels[0].nights).toBe(0);
    });
  });
});
```

---

## 4. Tests de Integración - End-to-End

### Test Suite: `analyzePdfContent()`

```typescript
describe('PDF Processor - End-to-End Integration', () => {
  describe('Single Flight One-Way', () => {
    test('E2E: Should parse complete single flight PDF', async () => {
      // Mock PDF file
      const pdfContent = generateMockPDF({
        template: 'flights-simple',
        flights: [{
          airline: 'AA American Airlines',
          route: 'EZE → MIA',
          date: '2025-01-15',
          price: 1200
        }]
      });

      const file = new File([pdfContent], 'test_single_flight.pdf');
      const result = await analyzePdfContent(file);

      expect(result.success).toBe(true);
      expect(result.content?.flights).toHaveLength(1);
      expect(result.content?.hotels).toHaveLength(0);
      expect(result.content?.extractedFromPdfMonkey).toBe(true);
      expect(result.content?.originalTemplate).toBe('67B7F3A5-7BFE-4F52-BE6B-110371CB9376');
    });
  });

  describe('Round Trip with Layovers', () => {
    test('E2E: Should parse round trip with layovers', async () => {
      const pdfContent = generateMockPDF({
        template: 'flights-complex',
        flights: [
          {
            type: 'outbound',
            route: 'EZE → PTY → MIA',
            layovers: [{ city: 'PTY', time: '2h 15m' }]
          },
          {
            type: 'return',
            route: 'MIA → PTY → EZE',
            layovers: [{ city: 'PTY', time: '1h 45m' }]
          }
        ]
      });

      const file = new File([pdfContent], 'test_roundtrip_layovers.pdf');
      const result = await analyzePdfContent(file);

      expect(result.content?.flights).toHaveLength(2);
      expect(result.content?.flights[0].legs[0].layovers).toHaveLength(1);
      expect(result.content?.flights[1].legs[0].layovers).toHaveLength(1);
      expect(result.content?.needsComplexTemplate).toBe(true);
    });
  });

  describe('Combined Flight + Hotel', () => {
    test('E2E: Should parse flight + single hotel', async () => {
      const pdfContent = generateMockPDF({
        template: 'combined',
        flights: [{ route: 'EZE → PUJ', price: 800 }],
        hotels: [{ name: 'SOLYMAR', price: 450, nights: 7 }]
      });

      const file = new File([pdfContent], 'test_combined.pdf');
      const result = await analyzePdfContent(file);

      expect(result.content?.flights).toHaveLength(1);
      expect(result.content?.hotels).toHaveLength(1);
      expect(result.content?.totalPrice).toBe(1250); // 800 + 450
    });

    test('E2E: Should parse flight + 2 hotel options', async () => {
      const pdfContent = generateMockPDF({
        template: 'combined',
        flights: [{ price: 800 }],
        hotels: [
          { name: 'SOLYMAR (Opción 1)', price: 450 },
          { name: 'GRAND PALLADIUM (Opción 2)', price: 680 }
        ],
        packagePrices: [1250, 1480]
      });

      const file = new File([pdfContent], 'test_options.pdf');
      const result = await analyzePdfContent(file);

      expect(result.content?.hotels).toHaveLength(2);
      expect(result.content?.hotels[0].name).toContain('Opción');

      // Should use economic option for total
      expect(result.content?.totalPrice).toBe(1250); // NOT 1930 (sum)
    });
  });

  describe('Price Correction Tests', () => {
    test('E2E: Should correct flight price in multi-hotel scenario', async () => {
      const pdfContent = generateMockPDF({
        template: 'combined',
        // Flight price extracted = 1250 (actually economic package)
        flights: [{ price: 1250 }],
        hotels: [
          { price: 450 }, // Cheapest
          { price: 680 }
        ]
      });

      const file = new File([pdfContent], 'test_price_correction.pdf');
      const result = await analyzePdfContent(file);

      // Should correct: 1250 - 450 = 800 (actual flight price)
      expect(result.content?.flights[0].price).toBe(800);
    });
  });

  describe('External PDF Tests', () => {
    test('E2E: Should parse external PDF with generic extraction', async () => {
      const pdfContent = generateMockPDF({
        template: 'external',
        provider: 'SOFTUR',
        content: 'Vuelo EZE-MIA $1200 USD\\nHotel SOLYMAR $450 USD'
      });

      const file = new File([pdfContent], 'softur_quote.pdf');
      const result = await analyzePdfContent(file);

      expect(result.success).toBe(true);
      expect(result.content?.extractedFromPdfMonkey).toBe(false);
      expect(result.content?.flights.length).toBeGreaterThan(0);
    });
  });
});
```

---

## 5. Tests de Validación

### Test Suite: `validatePdfAnalysisResult()`

```typescript
describe('PDF Processor - Validation', () => {
  describe('Required Fields Validation', () => {
    test('should pass validation for valid result', async () => {
      const result: PdfAnalysisResult = {
        success: true,
        content: {
          flights: [{
            airline: 'AA American Airlines',
            route: 'EZE → MIA',
            price: 1200,
            dates: '2025-01-15',
            originCode: 'EZE',
            destinationCode: 'MIA'
          }],
          totalPrice: 1200,
          currency: 'USD',
          passengers: 2
        }
      };

      const validation = await validatePdfAnalysisResult(result);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.overallConfidence).toBeGreaterThan(0.8);
    });

    test('should fail validation for missing required fields', async () => {
      const result: PdfAnalysisResult = {
        success: true,
        content: {
          flights: [{
            airline: 'AA',
            route: 'INVALID', // Wrong format
            price: 1200,
            dates: '2025-01-15'
          }]
        }
      };

      const validation = await validatePdfAnalysisResult(result);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'flights[0].route',
          severity: ValidationSeverity.FATAL
        })
      );
    });
  });

  describe('IATA Code Validation', () => {
    test('should reject invalid IATA codes', async () => {
      const result: PdfAnalysisResult = {
        success: true,
        content: {
          flights: [{
            airline: 'AA',
            route: 'XXX → YYY', // Invalid codes
            price: 1200,
            dates: '2025-01-15',
            originCode: 'XXX',
            destinationCode: 'YYY'
          }]
        }
      };

      const validation = await validatePdfAnalysisResult(result);

      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: expect.stringMatching(/originCode|destinationCode/),
          severity: ValidationSeverity.FATAL,
          message: expect.stringMatching(/Invalid IATA code/)
        })
      );
    });

    test('should suggest corrections for typos', () => {
      const suggestions = suggestIATACode('EXE'); // Typo for EZE

      expect(suggestions).toContain('EZE');
    });
  });

  describe('Confidence Scores', () => {
    test('should calculate field confidence scores', async () => {
      const result: PdfAnalysisResult = {
        success: true,
        content: {
          flights: [{
            airline: 'AA American Airlines',
            route: 'EZE → MIA',
            price: 1200,
            dates: '2025-01-15',
            legs: [
              {
                departure: { city_code: 'EZE', city_name: 'Buenos Aires', time: '08:00' },
                arrival: { city_code: 'MIA', city_name: 'Miami', time: '16:00' },
                duration: '8h',
                flight_type: 'outbound'
              }
            ]
          }]
        }
      };

      const validation = await validatePdfAnalysisResult(result);

      expect(validation.confidenceScores).toContainEqual(
        expect.objectContaining({
          field: 'flights[0].airline',
          confidence: expect.any(Number),
          extractionMethod: expect.stringMatching(/pattern_match|calculated/)
        })
      );
    });

    test('should flag low confidence extractions', async () => {
      const result: PdfAnalysisResult = {
        success: true,
        content: {
          flights: [{
            airline: 'Aerolínea no especificada', // Default fallback
            route: 'EZE → MIA',
            price: 0, // Not found
            dates: '2025-01-15'
          }]
        }
      };

      const validation = await validatePdfAnalysisResult(result);

      expect(validation.warnings).toContainEqual(
        expect.objectContaining({
          field: expect.stringMatching(/airline|price/),
          severity: ValidationSeverity.WARNING
        })
      );

      expect(validation.overallConfidence).toBeLessThan(0.7);
    });
  });

  describe('Missing Fields Detection', () => {
    test('should detect missing optional fields', () => {
      const result: PdfAnalysisResult = {
        success: true,
        content: {
          flights: [{
            airline: 'AA',
            route: 'EZE → MIA',
            price: 1200,
            dates: '2025-01-15'
            // Missing: departureTime, arrivalTime, legs
          }]
        }
      };

      const missingFields = detectMissingFields(result);

      expect(missingFields).toContainEqual(
        expect.objectContaining({
          category: 'flights',
          optionalFieldsMissing: expect.arrayContaining(['departureTime', 'arrivalTime'])
        })
      );
    });
  });

  describe('Price Validation', () => {
    test('should warn on suspiciously high prices', async () => {
      const result: PdfAnalysisResult = {
        success: true,
        content: {
          flights: [{
            airline: 'AA',
            route: 'EZE → MIA',
            price: 75000, // Suspiciously high
            dates: '2025-01-15'
          }],
          totalPrice: 75000
        }
      };

      const validation = await validatePdfAnalysisResult(result);

      expect(validation.warnings).toContainEqual(
        expect.objectContaining({
          field: 'totalPrice',
          message: expect.stringMatching(/suspiciously high/i)
        })
      );
    });

    test('should validate price sum matches total', async () => {
      const result: PdfAnalysisResult = {
        success: true,
        content: {
          flights: [{ price: 800 }],
          hotels: [{ price: 450 }],
          totalPrice: 2000 // Doesn't match 1250
        }
      };

      const validation = await validatePdfAnalysisResult(result);

      expect(validation.warnings).toContainEqual(
        expect.objectContaining({
          field: 'totalPrice',
          message: expect.stringMatching(/mismatch/)
        })
      );
    });
  });
});
```

---

## 6. PDFs de Ejemplo Requeridos

### 6.1 Set Mínimo (12 PDFs)

| ID | Nombre Archivo | Descripción | Expected Output | Prioridad |
|----|----------------|-------------|-----------------|-----------|
| **T1** | `test_single_flight_oneway.pdf` | 1 vuelo one-way, sin escalas, AA EZE→MIA | `{ flights: 1, hotels: 0, template: simple }` | 🔴 ALTA |
| **T2** | `test_roundtrip_direct.pdf` | Ida+Vuelta directo, LA EZE↔PUJ | `{ flights: 2, hotels: 0, template: complex }` | 🔴 ALTA |
| **T3** | `test_roundtrip_1_layover.pdf` | Ida+Vuelta con 1 escala c/u en PTY | `{ flights: 2, layovers: 2, template: complex }` | 🔴 ALTA |
| **T4** | `test_flight_hotel_single.pdf` | 1 vuelo + 1 hotel (SOLYMAR) | `{ flights: 1, hotels: 1, template: combined }` | 🔴 ALTA |
| **T5** | `test_flight_2hotels_options.pdf` | 1 vuelo + 2 hoteles (Opción 1, Opción 2) | `{ flights: 1, hotels: 2, totalPrice: min_option }` | 🟠 ALTA |
| **T6** | `test_2flights_2hotels.pdf` | 2 vuelos diferentes + 2 hoteles diferentes (NO opciones) | `{ flights: 2, hotels: 2, totalPrice: sum_all }` | 🟡 MEDIA |
| **T7** | `test_multi_layover_complex.pdf` | 3 escalas (EZE→SCL→PTY→MIA), ida+vuelta | `{ layovers: 6, template: complex }` | 🟡 MEDIA |
| **T8** | `test_price_formats_eu.pdf` | Precios formato EU: "1.485,50 USD" | `{ prices_parsed_correctly: true }` | 🟠 ALTA |
| **T9** | `test_price_formats_us.pdf` | Precios formato US: "1,485.50 USD" | `{ prices_parsed_correctly: true }` | 🟠 ALTA |
| **T10** | `test_external_pdf_softur.pdf` | PDF de SOFTUR (externo, no nuestro template) | `{ extractedFromPdfMonkey: false, flights: ≥1 }` | 🟡 MEDIA |
| **T11** | `test_missing_prices.pdf` | Hotel sin precio, vuelo sin precio individual | `{ warnings: ≥2, defaults_applied: true }` | 🟡 MEDIA |
| **T12** | `test_invalid_iata_codes.pdf` | Códigos inventados "XXX → YYY" | `{ errors: ≥1, validation_failed: true }` | 🟢 BAJA |

### 6.2 Estructura de Carpeta de Tests

```
tests/
├── unit/
│   ├── parsePrice.test.ts
│   ├── extractFlights.test.ts
│   ├── extractHotels.test.ts
│   ├── validateIATA.test.ts
│   └── templateDetection.test.ts
│
├── integration/
│   ├── analyzePdfContent.test.ts
│   ├── endToEnd.test.ts
│   └── validation.test.ts
│
├── fixtures/
│   ├── pdfs/
│   │   ├── T1_single_flight_oneway.pdf
│   │   ├── T2_roundtrip_direct.pdf
│   │   ├── T3_roundtrip_1_layover.pdf
│   │   ├── T4_flight_hotel_single.pdf
│   │   ├── T5_flight_2hotels_options.pdf
│   │   ├── T6_2flights_2hotels.pdf
│   │   ├── T7_multi_layover_complex.pdf
│   │   ├── T8_price_formats_eu.pdf
│   │   ├── T9_price_formats_us.pdf
│   │   ├── T10_external_pdf_softur.pdf
│   │   ├── T11_missing_prices.pdf
│   │   └── T12_invalid_iata_codes.pdf
│   │
│   └── expected/
│       ├── T1_expected.json
│       ├── T2_expected.json
│       └── ... (outputs esperados)
│
└── helpers/
    ├── mockPdfGenerator.ts
    ├── testUtils.ts
    └── assertions.ts
```

### 6.3 Ejemplo de Expected Output

**File:** `tests/fixtures/expected/T5_expected.json`

```json
{
  "success": true,
  "content": {
    "flights": [
      {
        "airline": "AA American Airlines",
        "route": "EZE → PUJ",
        "price": 800,
        "dates": "2025-01-15",
        "originCode": "EZE",
        "destinationCode": "PUJ"
      }
    ],
    "hotels": [
      {
        "name": "SOLYMAR BEACH RESORT (Opción 1)",
        "location": "Punta Cana, República Dominicana",
        "price": 450,
        "nights": 7
      },
      {
        "name": "GRAND PALLADIUM (Opción 2)",
        "location": "Punta Cana, República Dominicana",
        "price": 680,
        "nights": 7
      }
    ],
    "totalPrice": 1250,
    "currency": "USD",
    "passengers": 2,
    "originalTemplate": "3E8394AC-84D4-4286-A1CD-A12D1AB001D5",
    "extractedFromPdfMonkey": true
  },
  "_validation": {
    "overallConfidence": 0.88,
    "errors": [],
    "warnings": []
  }
}
```

### 6.4 Helper para Generar PDFs de Test

```typescript
// tests/helpers/mockPdfGenerator.ts

interface MockPdfOptions {
  template: 'flights-simple' | 'flights-complex' | 'combined' | 'external';
  flights?: Array<{
    airline?: string;
    route: string;
    date?: string;
    price?: number;
    layovers?: Array<{ city: string; time: string }>;
  }>;
  hotels?: Array<{
    name: string;
    location?: string;
    price: number;
    nights?: number;
  }>;
  packagePrices?: number[];
  provider?: string;
  content?: string;
}

export function generateMockPDF(options: MockPdfOptions): Uint8Array {
  // Generate PDF content based on options
  // This is a mock implementation - replace with actual PDF generation
  const content = buildPdfContent(options);

  // Convert to PDF binary (using pdf-lib or similar)
  return convertToPDF(content);
}

function buildPdfContent(options: MockPdfOptions): string {
  switch (options.template) {
    case 'flights-simple':
      return buildSimpleFlightContent(options);
    case 'flights-complex':
      return buildComplexFlightContent(options);
    case 'combined':
      return buildCombinedContent(options);
    case 'external':
      return options.content || '';
    default:
      throw new Error(`Unknown template: ${options.template}`);
  }
}

// ... (implementation details)
```

---

## 7. Métricas de Éxito

### 7.1 Criterios de Aceptación

| Métrica | Target | Medición |
|---------|--------|----------|
| **Tasa de Éxito** | ≥ 95% | PDFs parseados sin errores fatales / Total PDFs |
| **Confidence Score Promedio** | ≥ 0.85 | Promedio de todos los confidence scores |
| **Errores Fatales** | < 2% | PDFs con errores fatales / Total PDFs |
| **Tiempo de Extracción (P95)** | < 5s | 95% de PDFs procesados en menos de 5 segundos |
| **Coverage de Tests** | > 80% | Líneas cubiertas por tests / Total líneas |
| **Campos Extraídos** | ≥ 90% | Campos requeridos extraídos / Total campos |

### 7.2 Dashboard de Tests

```typescript
// tests/helpers/testDashboard.ts

interface TestResults {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  coverage: {
    lines: number;
    functions: number;
    branches: number;
  };
  performance: {
    avgTime: number;
    p95Time: number;
    p99Time: number;
  };
  validation: {
    avgConfidence: number;
    fatalErrors: number;
    warnings: number;
  };
}

export function generateTestReport(results: TestResults): void {
  console.log(`
╔═══════════════════════════════════════════════╗
║       PDF PROCESSOR TEST RESULTS              ║
╚═══════════════════════════════════════════════╝

📊 Test Summary:
   Total: ${results.totalTests}
   ✅ Passed: ${results.passed} (${((results.passed / results.totalTests) * 100).toFixed(1)}%)
   ❌ Failed: ${results.failed}
   ⏭️  Skipped: ${results.skipped}

📈 Coverage:
   Lines: ${results.coverage.lines}%
   Functions: ${results.coverage.functions}%
   Branches: ${results.coverage.branches}%

⚡ Performance:
   Avg: ${results.performance.avgTime}ms
   P95: ${results.performance.p95Time}ms
   P99: ${results.performance.p99Time}ms

✅ Validation:
   Avg Confidence: ${(results.validation.avgConfidence * 100).toFixed(1)}%
   Fatal Errors: ${results.validation.fatalErrors}
   Warnings: ${results.validation.warnings}
  `);
}
```

---

**Documento generado:** 2025-01-20
**Versión:** 1.0
**Autor:** Claude Code Assistant
