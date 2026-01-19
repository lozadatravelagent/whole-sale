/**
 * QA Test Script: Price Isolation Validation
 * Tests that modifying one option's price doesn't affect other options
 */

// Mock data structures
interface Hotel {
    name: string;
    price: number;
    nights: number;
    location: string;
    packagePrice?: number;
    _packageMetadata?: {
        optionNumber: number;
        totalPackagePrice: number;
        isModified: boolean;
    };
}

interface Flight {
    airline: string;
    price: number;
}

interface PdfAnalysisContent {
    hotels: Hotel[];
    flights: Flight[];
    totalPrice: number;
    currency: string;
}

// ============================================
// EXTRACTED FUNCTIONS FROM pdfProcessor.ts
// ============================================

function parsePrice(priceStr: string): number {
    const cleaned = priceStr.replace(/[,$\s]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

function extractDualOptionPrices(message: string): { option1Price: number; option2Price: number; option3Price?: number } | null {
    const option1Patterns = [
        /(?:el\s+)?precio\s+de\s+(?:la\s+)?opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /(?:la\s+)?opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /primera?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
    ];

    const option2Patterns = [
        /(?:el\s+)?precio\s+de\s+(?:la\s+)?opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /(?:la\s+)?opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /segunda?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
    ];

    const option3Patterns = [
        /(?:el\s+)?precio\s+de\s+(?:la\s+)?opci[oó]n\s+3\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /opci[oó]n\s+3\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /(?:la\s+)?opci[oó]n\s+3\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /tercera?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
    ];

    let option1Price: number | null = null;
    let option2Price: number | null = null;
    let option3Price: number | null = null;

    for (const pattern of option1Patterns) {
        const match = message.match(pattern);
        if (match) {
            const price = parsePrice(match[1]);
            if (price >= 100 && price <= 50000) {
                option1Price = price;
                break;
            }
        }
    }

    for (const pattern of option2Patterns) {
        const match = message.match(pattern);
        if (match) {
            const price = parsePrice(match[1]);
            if (price >= 100 && price <= 50000) {
                option2Price = price;
                break;
            }
        }
    }

    for (const pattern of option3Patterns) {
        const match = message.match(pattern);
        if (match) {
            const price = parsePrice(match[1]);
            if (price >= 100 && price <= 50000) {
                option3Price = price;
                break;
            }
        }
    }

    if (option1Price !== null && option2Price !== null) {
        const result: { option1Price: number; option2Price: number; option3Price?: number } = {
            option1Price,
            option2Price
        };
        if (option3Price !== null) {
            result.option3Price = option3Price;
        }
        return result;
    }

    return null;
}

// Simulates the multi-option price update logic from pdfProcessor.ts:2325-2398
function simulateMultiOptionPriceUpdate(
    originalHotels: Hotel[],
    originalFlights: Flight[],
    multiOptions: { option1Price: number; option2Price: number; option3Price?: number }
): { hotels: Hotel[]; flights: Flight[] } {
    const hasOption3 = multiOptions.option3Price !== undefined;

    const option1Hotel = originalHotels.find(h => h.name.match(/\(Opción\s+1\)/i));
    const option2Hotel = originalHotels.find(h => h.name.match(/\(Opción\s+2\)/i));
    const option3Hotel = hasOption3 ? originalHotels.find(h => h.name.match(/\(Opción\s+3\)/i)) : null;

    if (!option1Hotel || !option2Hotel || (hasOption3 && !option3Hotel)) {
        throw new Error('Could not identify all option hotels');
    }

    const flightsTotal = originalFlights.reduce((sum, f) => sum + f.price, 0);

    const option1OriginalPrice = option1Hotel.packagePrice || (flightsTotal + option1Hotel.price);
    const option2OriginalPrice = option2Hotel.packagePrice || (flightsTotal + option2Hotel.price);
    const option3OriginalPrice = option3Hotel ? (option3Hotel.packagePrice || (flightsTotal + option3Hotel.price)) : 0;

    const option1Ratio = multiOptions.option1Price / option1OriginalPrice;
    const option2Ratio = multiOptions.option2Price / option2OriginalPrice;
    const option3Ratio = hasOption3 && option3OriginalPrice > 0 ? multiOptions.option3Price! / option3OriginalPrice : 1;

    // Update hotels with INDEPENDENT ratios
    const updatedHotels = originalHotels.map(hotel => {
        const isOption1 = hotel.name === option1Hotel.name;
        const isOption2 = hotel.name === option2Hotel.name;
        const isOption3 = option3Hotel && hotel.name === option3Hotel.name;

        if (isOption1) {
            const newHotelPrice = option1Hotel.price > 0 ? option1Hotel.price * option1Ratio : 0;
            return {
                ...hotel,
                price: parseFloat(newHotelPrice.toFixed(2)),
                packagePrice: multiOptions.option1Price,
                _packageMetadata: {
                    optionNumber: 1,
                    totalPackagePrice: multiOptions.option1Price,
                    isModified: true
                }
            };
        } else if (isOption2) {
            const newHotelPrice = option2Hotel.price > 0 ? option2Hotel.price * option2Ratio : 0;
            return {
                ...hotel,
                price: parseFloat(newHotelPrice.toFixed(2)),
                packagePrice: multiOptions.option2Price,
                _packageMetadata: {
                    optionNumber: 2,
                    totalPackagePrice: multiOptions.option2Price,
                    isModified: true
                }
            };
        } else if (isOption3 && option3Hotel) {
            const newHotelPrice = option3Hotel.price > 0 ? option3Hotel.price * option3Ratio : 0;
            return {
                ...hotel,
                price: parseFloat(newHotelPrice.toFixed(2)),
                packagePrice: multiOptions.option3Price!,
                _packageMetadata: {
                    optionNumber: 3,
                    totalPackagePrice: multiOptions.option3Price!,
                    isModified: true
                }
            };
        }

        return hotel;
    });

    // Update flights with AVERAGE ratio (for display purposes)
    const avgRatio = hasOption3
        ? (option1Ratio + option2Ratio + option3Ratio) / 3
        : (option1Ratio + option2Ratio) / 2;

    const updatedFlights = originalFlights.map(flight => ({
        ...flight,
        price: parseFloat((flight.price * avgRatio).toFixed(2))
    }));

    return { hotels: updatedHotels, flights: updatedFlights };
}

// Simulates single option price update (targetOption logic from pdfProcessor.ts:1999-2036)
function simulateSingleOptionPriceUpdate(
    originalHotels: Hotel[],
    originalFlights: Flight[],
    targetOption: 1 | 2 | 3,
    newPrice: number
): { hotels: Hotel[]; flights: Flight[] } {
    const flightsTotal = originalFlights.reduce((sum, f) => sum + f.price, 0);

    const updatedHotels = originalHotels.map(hotel => {
        const optionMatch = hotel.name.match(/\(Opción\s+(\d+)\)/i);
        if (!optionMatch) return hotel;

        const optionNumber = parseInt(optionMatch[1]);
        let packagePrice: number;

        if (optionNumber === targetOption) {
            // Modified option: use requested price
            packagePrice = newPrice;

            // Calculate ratio for this option
            const originalPackagePrice = hotel.packagePrice || (flightsTotal + hotel.price);
            const ratio = newPrice / originalPackagePrice;
            const newHotelPrice = hotel.price * ratio;

            return {
                ...hotel,
                price: parseFloat(newHotelPrice.toFixed(2)),
                packagePrice: packagePrice,
                _packageMetadata: {
                    optionNumber,
                    totalPackagePrice: packagePrice,
                    isModified: true
                }
            };
        } else {
            // PRESERVE original packagePrice
            packagePrice = hotel.packagePrice || (flightsTotal + hotel.price);
            return {
                ...hotel,
                packagePrice: packagePrice,
                _packageMetadata: {
                    optionNumber,
                    totalPackagePrice: packagePrice,
                    isModified: false
                }
            };
        }
    });

    return { hotels: updatedHotels, flights: originalFlights };
}

// ============================================
// TEST DATA
// ============================================

function createTestData(): { hotels: Hotel[]; flights: Flight[] } {
    return {
        hotels: [
            {
                name: 'Hotel Económico (Opción 1)',
                price: 500,
                nights: 7,
                location: 'Cancún',
                packagePrice: 2000  // flight (1500) + hotel (500)
            },
            {
                name: 'Hotel Standard (Opción 2)',
                price: 1000,
                nights: 7,
                location: 'Cancún',
                packagePrice: 2500  // flight (1500) + hotel (1000)
            },
            {
                name: 'Hotel Premium (Opción 3)',
                price: 1500,
                nights: 7,
                location: 'Cancún',
                packagePrice: 3000  // flight (1500) + hotel (1500)
            }
        ],
        flights: [
            { airline: 'Aeromexico', price: 750 },  // ida
            { airline: 'Aeromexico', price: 750 }   // vuelta
        ]
    };
}

// ============================================
// TEST CASES
// ============================================

interface TestResult {
    name: string;
    passed: boolean;
    details: string;
    expected: any;
    actual: any;
}

const results: TestResult[] = [];

function test(name: string, fn: () => { passed: boolean; expected: any; actual: any; details: string }) {
    try {
        const result = fn();
        results.push({ name, ...result });
    } catch (error) {
        results.push({
            name,
            passed: false,
            details: `Exception: ${error}`,
            expected: 'No exception',
            actual: String(error)
        });
    }
}

// ============================================
// EXECUTE TESTS
// ============================================

console.log('\n' + '='.repeat(60));
console.log('QA TEST: Price Isolation Validation');
console.log('='.repeat(60) + '\n');

// TEST 1: Modify only Option 1
test('CASO 1: Modificar solo Opción 1 (no afecta Opción 2 y 3)', () => {
    const { hotels, flights } = createTestData();
    const result = simulateSingleOptionPriceUpdate(hotels, flights, 1, 2500);

    const option1 = result.hotels.find(h => h.name.includes('Opción 1'));
    const option2 = result.hotels.find(h => h.name.includes('Opción 2'));
    const option3 = result.hotels.find(h => h.name.includes('Opción 3'));

    const option1Correct = option1?.packagePrice === 2500;
    const option2Preserved = option2?.packagePrice === 2500;  // Original
    const option3Preserved = option3?.packagePrice === 3000;  // Original

    return {
        passed: option1Correct && option2Preserved && option3Preserved,
        expected: { opt1: 2500, opt2: 2500, opt3: 3000 },
        actual: { opt1: option1?.packagePrice, opt2: option2?.packagePrice, opt3: option3?.packagePrice },
        details: `Opción 1=${option1?.packagePrice}, Opción 2=${option2?.packagePrice}, Opción 3=${option3?.packagePrice}`
    };
});

// TEST 2: Modify only Option 2
test('CASO 2: Modificar solo Opción 2 (no afecta Opción 1 y 3)', () => {
    const { hotels, flights } = createTestData();
    const result = simulateSingleOptionPriceUpdate(hotels, flights, 2, 3500);

    const option1 = result.hotels.find(h => h.name.includes('Opción 1'));
    const option2 = result.hotels.find(h => h.name.includes('Opción 2'));
    const option3 = result.hotels.find(h => h.name.includes('Opción 3'));

    const option1Preserved = option1?.packagePrice === 2000;
    const option2Correct = option2?.packagePrice === 3500;
    const option3Preserved = option3?.packagePrice === 3000;

    return {
        passed: option1Preserved && option2Correct && option3Preserved,
        expected: { opt1: 2000, opt2: 3500, opt3: 3000 },
        actual: { opt1: option1?.packagePrice, opt2: option2?.packagePrice, opt3: option3?.packagePrice },
        details: `Opción 1=${option1?.packagePrice}, Opción 2=${option2?.packagePrice}, Opción 3=${option3?.packagePrice}`
    };
});

// TEST 3: Modify only Option 3
test('CASO 3: Modificar solo Opción 3 (no afecta Opción 1 y 2)', () => {
    const { hotels, flights } = createTestData();
    const result = simulateSingleOptionPriceUpdate(hotels, flights, 3, 4000);

    const option1 = result.hotels.find(h => h.name.includes('Opción 1'));
    const option2 = result.hotels.find(h => h.name.includes('Opción 2'));
    const option3 = result.hotels.find(h => h.name.includes('Opción 3'));

    const option1Preserved = option1?.packagePrice === 2000;
    const option2Preserved = option2?.packagePrice === 2500;
    const option3Correct = option3?.packagePrice === 4000;

    return {
        passed: option1Preserved && option2Preserved && option3Correct,
        expected: { opt1: 2000, opt2: 2500, opt3: 4000 },
        actual: { opt1: option1?.packagePrice, opt2: option2?.packagePrice, opt3: option3?.packagePrice },
        details: `Opción 1=${option1?.packagePrice}, Opción 2=${option2?.packagePrice}, Opción 3=${option3?.packagePrice}`
    };
});

// TEST 4: Modify all 3 options simultaneously
test('CASO 4: Modificar las 3 opciones simultáneamente', () => {
    const { hotels, flights } = createTestData();
    const multiOptions = { option1Price: 2200, option2Price: 3300, option3Price: 4400 };
    const result = simulateMultiOptionPriceUpdate(hotels, flights, multiOptions);

    const option1 = result.hotels.find(h => h.name.includes('Opción 1'));
    const option2 = result.hotels.find(h => h.name.includes('Opción 2'));
    const option3 = result.hotels.find(h => h.name.includes('Opción 3'));

    const option1Correct = option1?.packagePrice === 2200;
    const option2Correct = option2?.packagePrice === 3300;
    const option3Correct = option3?.packagePrice === 4400;

    // Verify each has correct metadata
    const metadata1Valid = option1?._packageMetadata?.optionNumber === 1 && option1?._packageMetadata?.totalPackagePrice === 2200;
    const metadata2Valid = option2?._packageMetadata?.optionNumber === 2 && option2?._packageMetadata?.totalPackagePrice === 3300;
    const metadata3Valid = option3?._packageMetadata?.optionNumber === 3 && option3?._packageMetadata?.totalPackagePrice === 4400;

    return {
        passed: option1Correct && option2Correct && option3Correct && metadata1Valid && metadata2Valid && metadata3Valid,
        expected: { opt1: 2200, opt2: 3300, opt3: 4400, allMetadataValid: true },
        actual: {
            opt1: option1?.packagePrice,
            opt2: option2?.packagePrice,
            opt3: option3?.packagePrice,
            allMetadataValid: metadata1Valid && metadata2Valid && metadata3Valid
        },
        details: `Opción 1=${option1?.packagePrice} (meta:${metadata1Valid}), Opción 2=${option2?.packagePrice} (meta:${metadata2Valid}), Opción 3=${option3?.packagePrice} (meta:${metadata3Valid})`
    };
});

// TEST 5: Sequential changes (detect erroneous inheritance)
test('CASO 5: Cambio secuencial - Opción 1, luego Opción 3 (sin herencia errónea)', () => {
    const { hotels, flights } = createTestData();

    // First change: Option 1 to 2500
    const afterFirstChange = simulateSingleOptionPriceUpdate(hotels, flights, 1, 2500);

    // Second change: Option 3 to 4500 (using result from first change)
    const afterSecondChange = simulateSingleOptionPriceUpdate(afterFirstChange.hotels, flights, 3, 4500);

    const option1 = afterSecondChange.hotels.find(h => h.name.includes('Opción 1'));
    const option2 = afterSecondChange.hotels.find(h => h.name.includes('Opción 2'));
    const option3 = afterSecondChange.hotels.find(h => h.name.includes('Opción 3'));

    // Option 1 should maintain 2500 from first change
    // Option 2 should maintain original 2500
    // Option 3 should be 4500 from second change
    const option1Maintained = option1?.packagePrice === 2500;
    const option2Preserved = option2?.packagePrice === 2500;
    const option3Updated = option3?.packagePrice === 4500;

    return {
        passed: option1Maintained && option2Preserved && option3Updated,
        expected: { opt1: 2500, opt2: 2500, opt3: 4500 },
        actual: { opt1: option1?.packagePrice, opt2: option2?.packagePrice, opt3: option3?.packagePrice },
        details: `Después de 2 cambios secuenciales: Opción 1=${option1?.packagePrice}, Opción 2=${option2?.packagePrice}, Opción 3=${option3?.packagePrice}`
    };
});

// TEST 6: Parser detection - multi option command
test('CASO 6: Parser detecta comandos multi-opción correctamente', () => {
    const testCases = [
        { input: 'cambia la opción 1 a 3000, la opción 2 a 4000 y la opción 3 a 5500', expected: { opt1: 3000, opt2: 4000, opt3: 5500 } },
        { input: 'opción 1 a 2500, opción 2 a 3500', expected: { opt1: 2500, opt2: 3500, opt3: null } },
        { input: 'el precio de la opción 1 a $2000 y opción 2 a $3000', expected: { opt1: 2000, opt2: 3000, opt3: null } },
    ];

    let allPassed = true;
    const details: string[] = [];

    for (const tc of testCases) {
        const result = extractDualOptionPrices(tc.input);
        const opt1Match = result?.option1Price === tc.expected.opt1;
        const opt2Match = result?.option2Price === tc.expected.opt2;
        const opt3Match = tc.expected.opt3 === null ? result?.option3Price === undefined : result?.option3Price === tc.expected.opt3;

        const passed = opt1Match && opt2Match && opt3Match;
        allPassed = allPassed && passed;
        details.push(`"${tc.input.substring(0, 40)}..." => ${passed ? 'OK' : 'FAIL'}`);
    }

    return {
        passed: allPassed,
        expected: 'All parser tests pass',
        actual: details.join('; '),
        details: details.join('\n')
    };
});

// TEST 7: Independent ratios verification
test('CASO 7: Verificar ratios independientes por opción', () => {
    const { hotels, flights } = createTestData();

    // Original prices: 2000, 2500, 3000
    // New prices: 4000, 2500, 1500 (100% increase, no change, 50% decrease)
    const multiOptions = { option1Price: 4000, option2Price: 2500, option3Price: 1500 };
    const result = simulateMultiOptionPriceUpdate(hotels, flights, multiOptions);

    const option1 = result.hotels.find(h => h.name.includes('Opción 1'));
    const option2 = result.hotels.find(h => h.name.includes('Opción 2'));
    const option3 = result.hotels.find(h => h.name.includes('Opción 3'));

    // Calculate expected hotel prices based on independent ratios
    const ratio1 = 4000 / 2000;  // 2.0
    const ratio2 = 2500 / 2500;  // 1.0
    const ratio3 = 1500 / 3000;  // 0.5

    const expectedHotel1Price = parseFloat((500 * ratio1).toFixed(2));  // 1000
    const expectedHotel2Price = parseFloat((1000 * ratio2).toFixed(2)); // 1000
    const expectedHotel3Price = parseFloat((1500 * ratio3).toFixed(2)); // 750

    const hotel1Correct = Math.abs((option1?.price || 0) - expectedHotel1Price) < 0.01;
    const hotel2Correct = Math.abs((option2?.price || 0) - expectedHotel2Price) < 0.01;
    const hotel3Correct = Math.abs((option3?.price || 0) - expectedHotel3Price) < 0.01;

    return {
        passed: hotel1Correct && hotel2Correct && hotel3Correct,
        expected: { hotel1: expectedHotel1Price, hotel2: expectedHotel2Price, hotel3: expectedHotel3Price },
        actual: { hotel1: option1?.price, hotel2: option2?.price, hotel3: option3?.price },
        details: `Ratios independientes: r1=${ratio1}, r2=${ratio2}, r3=${ratio3}. Hotel prices: ${option1?.price}, ${option2?.price}, ${option3?.price}`
    };
});

// ============================================
// PRINT RESULTS
// ============================================

console.log('\n' + '-'.repeat(60));
console.log('RESULTADOS DE PRUEBAS');
console.log('-'.repeat(60) + '\n');

let passCount = 0;
let failCount = 0;

for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    if (result.passed) passCount++;
    else failCount++;

    console.log(`${status}: ${result.name}`);
    console.log(`   Detalles: ${result.details}`);
    if (!result.passed) {
        console.log(`   Esperado: ${JSON.stringify(result.expected)}`);
        console.log(`   Obtenido: ${JSON.stringify(result.actual)}`);
    }
    console.log('');
}

console.log('='.repeat(60));
console.log(`RESUMEN: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(60));

if (failCount > 0) {
    console.log('\n⚠️  ALERTA: Se detectaron fallos en la validación de aislamiento de precios.');
    console.log('   Revisar la lógica en pdfProcessor.ts líneas 2017-2036 y 2325-2398');
}

// ============================================
// ADDITIONAL EDGE CASE TESTS
// ============================================

console.log('\n' + '='.repeat(60));
console.log('PRUEBAS ADICIONALES: CASOS BORDE');
console.log('='.repeat(60) + '\n');

const edgeCaseResults: TestResult[] = [];

function edgeTest(name: string, fn: () => { passed: boolean; expected: any; actual: any; details: string }) {
    try {
        const result = fn();
        edgeCaseResults.push({ name, ...result });
    } catch (error) {
        edgeCaseResults.push({
            name,
            passed: false,
            details: `Exception: ${error}`,
            expected: 'No exception',
            actual: String(error)
        });
    }
}

// EDGE 1: Very large price change (10x original)
edgeTest('BORDE 1: Cambio de precio extremo (10x original)', () => {
    const { hotels, flights } = createTestData();
    const result = simulateSingleOptionPriceUpdate(hotels, flights, 1, 20000); // 10x the original 2000

    const option1 = result.hotels.find(h => h.name.includes('Opción 1'));
    const option2 = result.hotels.find(h => h.name.includes('Opción 2'));

    // Option 1 should be 20000, Option 2 should remain unchanged
    return {
        passed: option1?.packagePrice === 20000 && option2?.packagePrice === 2500,
        expected: { opt1: 20000, opt2: 2500 },
        actual: { opt1: option1?.packagePrice, opt2: option2?.packagePrice },
        details: `Precio extremo aplicado: Opción 1=${option1?.packagePrice}`
    };
});

// EDGE 2: Price decrease (less than original)
edgeTest('BORDE 2: Disminución de precio (menor al original)', () => {
    const { hotels, flights } = createTestData();
    const result = simulateSingleOptionPriceUpdate(hotels, flights, 2, 1500); // Down from 2500

    const option1 = result.hotels.find(h => h.name.includes('Opción 1'));
    const option2 = result.hotels.find(h => h.name.includes('Opción 2'));

    return {
        passed: option1?.packagePrice === 2000 && option2?.packagePrice === 1500,
        expected: { opt1: 2000, opt2: 1500 },
        actual: { opt1: option1?.packagePrice, opt2: option2?.packagePrice },
        details: `Precio disminuido: Opción 2 de 2500 a ${option2?.packagePrice}`
    };
});

// EDGE 3: Same price as original (no-op)
edgeTest('BORDE 3: Mismo precio que el original (no-op)', () => {
    const { hotels, flights } = createTestData();
    const result = simulateSingleOptionPriceUpdate(hotels, flights, 1, 2000); // Same as original

    const option1 = result.hotels.find(h => h.name.includes('Opción 1'));

    return {
        passed: option1?.packagePrice === 2000,
        expected: { opt1: 2000 },
        actual: { opt1: option1?.packagePrice },
        details: `Precio sin cambio: ${option1?.packagePrice}`
    };
});

// EDGE 4: Parser with different formats
edgeTest('BORDE 4: Parser con formatos de precio variados', () => {
    const testCases = [
        { input: 'opción 1 a $3,500 y opción 2 a $4,500', expected: { opt1: 3500, opt2: 4500 } },
        { input: 'opcion 1 a 2500 opcion 2 a 3500', expected: { opt1: 2500, opt2: 3500 } },
        { input: 'primera opción a 1500 segunda opción a 2500', expected: { opt1: 1500, opt2: 2500 } },
    ];

    let allPassed = true;
    const details: string[] = [];

    for (const tc of testCases) {
        const result = extractDualOptionPrices(tc.input);
        const passed = result?.option1Price === tc.expected.opt1 && result?.option2Price === tc.expected.opt2;
        allPassed = allPassed && passed;
        details.push(`"${tc.input.substring(0, 35)}..." => ${passed ? 'OK' : `FAIL (got ${result?.option1Price}, ${result?.option2Price})`}`);
    }

    return {
        passed: allPassed,
        expected: 'Todos los formatos parseados correctamente',
        actual: details.join('; '),
        details: details.join('\n')
    };
});

// EDGE 5: Metadata integrity after multiple operations
edgeTest('BORDE 5: Integridad de metadata después de operaciones múltiples', () => {
    const { hotels, flights } = createTestData();

    // Chain of operations
    const step1 = simulateSingleOptionPriceUpdate(hotels, flights, 1, 2500);
    const step2 = simulateSingleOptionPriceUpdate(step1.hotels, flights, 2, 3500);
    const step3 = simulateSingleOptionPriceUpdate(step2.hotels, flights, 3, 4500);

    const option1 = step3.hotels.find(h => h.name.includes('Opción 1'));
    const option2 = step3.hotels.find(h => h.name.includes('Opción 2'));
    const option3 = step3.hotels.find(h => h.name.includes('Opción 3'));

    const meta1Valid = option1?._packageMetadata?.optionNumber === 1;
    const meta2Valid = option2?._packageMetadata?.optionNumber === 2;
    const meta3Valid = option3?._packageMetadata?.optionNumber === 3;

    return {
        passed: meta1Valid && meta2Valid && meta3Valid,
        expected: { meta1: 1, meta2: 2, meta3: 3 },
        actual: {
            meta1: option1?._packageMetadata?.optionNumber,
            meta2: option2?._packageMetadata?.optionNumber,
            meta3: option3?._packageMetadata?.optionNumber
        },
        details: `Metadata preservado: opt1=${meta1Valid}, opt2=${meta2Valid}, opt3=${meta3Valid}`
    };
});

// Print edge case results
console.log('-'.repeat(60));
console.log('RESULTADOS CASOS BORDE');
console.log('-'.repeat(60) + '\n');

let edgePassCount = 0;
let edgeFailCount = 0;

for (const result of edgeCaseResults) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    if (result.passed) edgePassCount++;
    else edgeFailCount++;

    console.log(`${status}: ${result.name}`);
    console.log(`   Detalles: ${result.details}`);
    if (!result.passed) {
        console.log(`   Esperado: ${JSON.stringify(result.expected)}`);
        console.log(`   Obtenido: ${JSON.stringify(result.actual)}`);
    }
    console.log('');
}

console.log('='.repeat(60));
console.log(`RESUMEN FINAL:`);
console.log(`  Pruebas principales: ${passCount} passed, ${failCount} failed`);
console.log(`  Casos borde:         ${edgePassCount} passed, ${edgeFailCount} failed`);
console.log(`  TOTAL:               ${passCount + edgePassCount} passed, ${failCount + edgeFailCount} failed`);
console.log('='.repeat(60));

const totalFails = failCount + edgeFailCount;
if (totalFails === 0) {
    console.log('\n✅ VALIDACIÓN COMPLETA: La lógica de aislamiento de precios funciona correctamente.');
    console.log('   No se detectó sincronización errónea entre opciones.');
} else {
    console.log('\n⚠️  ALERTA: Se detectaron fallos en la validación.');
}

process.exit(totalFails > 0 ? 1 : 0);
