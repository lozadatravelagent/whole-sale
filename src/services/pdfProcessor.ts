/**
 * PDF Processor Service
 * Handles PDF upload, reading, and content analysis for travel quotations
 */

import { supabase } from '@/integrations/supabase/client';
import { searchAirFares, type AirfareSearchParams } from './airfareSearch';
import type { FlightData } from '@/types';
import { getAirlineNameFromCode, getAirlineCodeFromName } from '@/features/chat/utils/flightHelpers';

export interface PdfAnalysisResult {
    success: boolean;
    content?: {
        flights?: Array<{
            airline: string;
            route: string;
            price: number;
            dates: string;
        }>;
        hotels?: Array<{
            name: string;
            location: string;
            price: number;
            nights: number;
        }>;
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

export interface PdfUploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

export interface CheaperFlightSearchResult {
    success: boolean;
    originalFlights?: Array<{
        airline: string;
        route: string;
        price: number;
        dates: string;
    }>;
    alternativeFlights?: FlightData[];
    savings?: number;
    message?: string;
    error?: string;
}

/**
 * Smart price parser that handles both US and EU/Latino number formats
 * US Format: 2,549.32 (comma = thousands, dot = decimal)
 * EU/Latino Format: 2.549,32 (dot = thousands, comma = decimal)
 *
 * @param priceStr - The price string to parse (e.g., "2.549,32" or "2,549.32" or "2549.32")
 * @returns The parsed number as a float
 */
function parsePrice(priceStr: string): number {
    if (!priceStr) return 0;

    // Remove currency symbols and whitespace
    let cleaned = priceStr.replace(/[^\d.,]/g, '');

    if (!cleaned) return 0;

    console.log('💰 [PARSE PRICE] Input:', priceStr, '→ Cleaned:', cleaned);

    // Count dots and commas to determine format
    const dotCount = (cleaned.match(/\./g) || []).length;
    const commaCount = (cleaned.match(/,/g) || []).length;
    const lastDotIndex = cleaned.lastIndexOf('.');
    const lastCommaIndex = cleaned.lastIndexOf(',');

    // No separators - simple case
    if (dotCount === 0 && commaCount === 0) {
        const result = parseFloat(cleaned);
        console.log('💰 [PARSE PRICE] No separators:', result);
        return result;
    }

    // Only dots - check if it's decimal or thousands separator
    if (dotCount > 0 && commaCount === 0) {
        // LATINO/EU FORMAT DETECTION:
        // - If there are 3 digits after the dot AND total length > 4: it's thousands (1.485)
        // - If there are 1-2 digits after the dot: it's decimal (10.50)
        // - If dot is NOT in last 3 positions: it's thousands (1.500.000)

        const digitsAfterDot = cleaned.length - lastDotIndex - 1;
        console.log('💰 [PARSE PRICE] Dots only - digitsAfterDot:', digitsAfterDot, 'lastDotIndex:', lastDotIndex, 'length:', cleaned.length);

        // Explicit Latino format check: X.XXX (e.g., 1.485, 2.500)
        if (digitsAfterDot === 3 && lastDotIndex > 0 && cleaned.length >= 5) {
            // Latino format: dot is thousands separator
            const result = parseFloat(cleaned.replace(/\./g, ''));
            console.log('💰 [PARSE PRICE] Latino format (X.XXX):', result);
            return result;
        }

        // Decimal format: dot in last 1-2 positions (e.g., 10.5, 100.50)
        if (lastDotIndex >= cleaned.length - 3 && dotCount === 1 && digitsAfterDot <= 2) {
            const result = parseFloat(cleaned);
            console.log('💰 [PARSE PRICE] Decimal format:', result);
            return result;
        }

        // Multiple dots or dot not in decimal position = thousands separator
        const result = parseFloat(cleaned.replace(/\./g, ''));
        console.log('💰 [PARSE PRICE] Thousands separator:', result);
        return result;
    }

    // Only commas - check if it's decimal or thousands separator
    if (commaCount > 0 && dotCount === 0) {
        const digitsAfterComma = cleaned.length - lastCommaIndex - 1;

        // EU format with comma as decimal: X,XX (e.g., 10,50)
        if (lastCommaIndex >= cleaned.length - 3 && commaCount === 1 && digitsAfterComma <= 2) {
            const result = parseFloat(cleaned.replace(',', '.'));
            console.log('💰 [PARSE PRICE] EU decimal format:', result);
            return result;
        }

        // US thousands separator: X,XXX (e.g., 1,485)
        if (digitsAfterComma === 3 && lastCommaIndex > 0 && cleaned.length >= 5) {
            const result = parseFloat(cleaned.replace(/,/g, ''));
            console.log('💰 [PARSE PRICE] US thousands format:', result);
            return result;
        }

        // Multiple commas = thousands separator
        const result = parseFloat(cleaned.replace(/,/g, ''));
        console.log('💰 [PARSE PRICE] Multiple commas:', result);
        return result;
    }

    // Both dots and commas present - determine which comes last
    if (lastCommaIndex > lastDotIndex) {
        // Comma comes after dot = EU/Latino format (2.549,32)
        // Dots are thousands, comma is decimal
        const result = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        console.log('💰 [PARSE PRICE] EU/Latino format (X.XXX,XX):', result);
        return result;
    } else {
        // Dot comes after comma = US format (2,549.32)
        // Commas are thousands, dot is decimal
        const result = parseFloat(cleaned.replace(/,/g, ''));
        console.log('💰 [PARSE PRICE] US format (X,XXX.XX):', result);
        return result;
    }
}

/**
 * Helper function to resolve airline name from code or partial name
 * Uses static mappings for synchronous resolution in PDF processing
 */
function resolveAirlineName(airlineInput: string | undefined): string {
    if (!airlineInput || airlineInput.trim() === '') {
        return 'Aerolínea no especificada';
    }

    const input = airlineInput.trim();

    // If it looks like a 2-3 letter code, try to resolve it
    if (input.length <= 3 && /^[A-Z0-9]{2,3}$/i.test(input)) {
        const resolved = getAirlineNameFromCode(input.toUpperCase());
        // If resolution returned the same code, it wasn't found
        if (resolved !== input.toUpperCase()) {
            return resolved;
        }
    }

    // If it's a name, try to get the code and then the full name
    const code = getAirlineCodeFromName(input);
    if (code !== input.toUpperCase()) {
        const fullName = getAirlineNameFromCode(code);
        if (fullName !== code) {
            return fullName;
        }
    }

    // If input already looks like a full name (more than 3 chars), return as is
    if (input.length > 3) {
        return input;
    }

    return 'Aerolínea no especificada';
}

/**
 * Upload PDF file to Supabase storage
 */
export async function uploadPdfFile(file: File, conversationId: string): Promise<PdfUploadResult> {
    try {
        const fileName = `pdf-uploads/${conversationId}/${Date.now()}-${file.name}`;

        const { data, error } = await supabase.storage
            .from('documents')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Error uploading PDF:', error);
            return {
                success: false,
                error: error.message
            };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(fileName);

        return {
            success: true,
            url: urlData.publicUrl
        };

    } catch (error) {
        console.error('Error in uploadPdfFile:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Check if PDF was generated by our PdfMonkey template
 */
function isPdfMonkeyTemplate(fileName: string, content?: string): boolean {
    // Check filename patterns that suggest it's our generated PDF
    const pdfMonkeyPatterns = [
        /viaje-combinado-cotizacion/i,
        /wholesale-connect/i,
        /cotizacion.*pdf/i,
        /vuelos-cotizacion/i
    ];

    // First check filename
    const filenameMatch = pdfMonkeyPatterns.some(pattern => pattern.test(fileName));
    if (filenameMatch) {
        return true;
    }

    // If content is available, check for template-specific patterns
    if (content) {
        return isPdfMonkeyTemplateByContent(content);
    }

    return false;
}

/**
 * Detect PdfMonkey template by analyzing PDF content
 */
function isPdfMonkeyTemplateByContent(content: string): boolean {
    // Patterns that are unique to our templates
    const templateIndicators = [
        // From combined-flight-hotel.html template
        /PRESUPUESTO DE VIAJE/i,
        /Para confirmar tu reserva.*contactanos por WhatsApp/i,
        /Documentación y requisitos de ingreso.*responsabilidad del pasajero/i,
        /Tarifa sujeta a disponibilidad al momento de reservar/i,

        // From flights-simple.html and flights-multiple.html templates
        /DETALLE DEL VUELO/i,
        /Vuelo de ida.*Vuelo de regreso/i,
        /Equipaje de bodega incluido.*Carry On incluido/i,

        // General template patterns
        /wholesale-connect/i,
        /Tiempo de espera.*en.*\([A-Z]{3}\)/i, // Layover pattern
        /adultos.*niños/i // Passenger pattern
    ];

    // Check if content contains multiple template indicators
    const matchCount = templateIndicators.filter(pattern => pattern.test(content)).length;

    // If we find 2 or more indicators, it's likely our template
    return matchCount >= 2;
}

/**
 * Extract structured data from our PdfMonkey template using real content
 * Since we know the exact structure, we can extract data more precisely
 */
function extractPdfMonkeyDataFromContent(fileName: string, content: string): PdfAnalysisResult {
    console.log('🎯 Extracting structured data from PdfMonkey template content');

    // Determine which template was used based on content
    const isCombinedTemplate = content.includes('PRESUPUESTO DE VIAJE') || content.includes('Hotel Recomendado');

    // More flexible detection for flights template - look for flight-related patterns
    const hasFlightPatterns = /Vuelo de (ida|regreso)|adultos.*niños|USD.*Precio total|Escala en|Tiempo de espera/i.test(content);
    const isRoundTrip = /Vuelo de ida/i.test(content) && /Vuelo de regreso/i.test(content);
    const hasLayovers = /Escala en/i.test(content);

    // For round trips or flights with layovers, we need flights-multiple template
    const isFlightsOnlyTemplate = hasFlightPatterns && !isCombinedTemplate;
    const needsComplexTemplate = isRoundTrip || hasLayovers;

    console.log('📋 Template detection:', {
        isCombinedTemplate,
        hasFlightPatterns,
        isRoundTrip,
        hasLayovers,
        isFlightsOnlyTemplate,
        needsComplexTemplate
    });

    console.log('📋 Template type detected:', isCombinedTemplate ? 'Combined (combined-flight-hotel.html)' :
        needsComplexTemplate ? 'Complex flights (flights-multiple.html)' :
            isFlightsOnlyTemplate ? 'Simple flights (flights-simple.html)' : 'Unknown');

    // Extract flight information from our template structure
    const flights = extractFlightsFromPdfMonkeyTemplate(content);

    // Extract hotel information (only for combined template)
    const hotels = isCombinedTemplate ? extractHotelsFromPdfMonkeyTemplate(content) : [];

    // Calculate total price from individual flight prices
    let calculatedFlightPrice = 0;
    if (flights && flights.length > 0) {
        calculatedFlightPrice = flights.reduce((sum, flight) => sum + (flight.price || 0), 0);
        console.log('💰 Calculated flight price from individual flights:', calculatedFlightPrice);
    }

    // Calculate hotel total
    let calculatedHotelPrice = 0;
    if (hotels && hotels.length > 0) {
        // NEW: Check if hotels are package options (not multiple hotels in same package)
        const arePackageOptions = hotels.length >= 2 &&
            hotels.every(h => /\(Opción\s+\d+\)/i.test(h.name));

        if (arePackageOptions) {
            // For package options, use the CHEAPEST option (economic) for price calculation
            // The other options are alternatives, not additions
            calculatedHotelPrice = Math.min(...hotels.map(h => h.price));
            console.log('💰 [PACKAGE OPTIONS] Using cheapest hotel price:', calculatedHotelPrice, {
                hotels_count: hotels.length,
                allPrices: hotels.map(h => ({ name: h.name, price: h.price })),
                note: 'Options are mutually exclusive, not additive'
            });
        } else {
            // Traditional behavior: sum all hotels (for actual multiple hotels in same package)
            // hotel.price is already the TOTAL price for the hotel (from "Precio: $XXX USD" in PDF)
            // Do NOT multiply by nights - the price extracted is the total price
            calculatedHotelPrice = hotels.reduce((sum, hotel) => sum + hotel.price, 0);
            console.log('💰 Calculated hotel price (sum of all hotels):', calculatedHotelPrice, {
                hotels_count: hotels.length,
                hotels: hotels.map(h => ({ name: h.name, price: h.price, nights: h.nights }))
            });
        }
    }

    // CORRECCIÓN: Si hay 2+ hoteles, el precio extraído como "vuelo" podría ser en realidad
    // el precio de la "Opción Económica" completa (vuelo + hotel más barato).
    // Corregir el precio del vuelo si es necesario.
    if (hotels && hotels.length >= 2 && calculatedFlightPrice > 0 && flights && flights.length > 0) {
        // Obtener el hotel más barato
        const cheapestHotelPrice = Math.min(...hotels.map(h => h.price));

        // Si el precio del vuelo es mayor que el hotel más barato,
        // probablemente capturamos "Opción Económica $X" en vez del precio del vuelo solo
        if (calculatedFlightPrice > cheapestHotelPrice) {
            const originalFlightPrice = calculatedFlightPrice;
            // Corregir: precio_vuelo_real = precio_capturado - hotel_mas_barato
            calculatedFlightPrice = calculatedFlightPrice - cheapestHotelPrice;
            console.log(`🔧 [PRICE CORRECTION] Detected flight price was actually economic package price. Corrected from $${originalFlightPrice} to $${calculatedFlightPrice} (subtracted cheapest hotel: $${cheapestHotelPrice})`);

            // Actualizar el precio de cada vuelo individual proporcionalmente
            const priceRatio = calculatedFlightPrice / originalFlightPrice;
            flights.forEach((flight, index) => {
                const correctedPrice = flight.price * priceRatio;
                console.log(`🔧 [FLIGHT PRICE UPDATE] Flight ${index + 1}: $${flight.price.toFixed(2)} → $${correctedPrice.toFixed(2)}`);
                flight.price = correctedPrice;
            });
        }
    }

    // Extract total price from PDF (fallback)
    const extractedTotalPrice = extractTotalPriceFromPdfMonkeyTemplate(content);

    // Use calculated price if available, otherwise use extracted price
    const totalPrice = (calculatedFlightPrice > 0 || calculatedHotelPrice > 0)
        ? calculatedFlightPrice + calculatedHotelPrice
        : extractedTotalPrice;

    console.log('💰 Final total price:', totalPrice, {
        flightPrice: calculatedFlightPrice,
        hotelPrice: calculatedHotelPrice,
        extractedPrice: extractedTotalPrice
    });

    // Extract passenger information
    const passengers = extractPassengersFromPdfMonkeyTemplate(content);

    // Extract currency
    const currency = extractCurrencyFromPdfMonkeyTemplate(content);

    // Determine original template ID based on content
    const originalTemplate = isCombinedTemplate ?
        "3E8394AC-84D4-4286-A1CD-A12D1AB001D5" : // COMBINED_TEMPLATE_ID
        needsComplexTemplate ?
            "30B142BF-1DD9-432D-8261-5287556DC9FC" : // FLIGHTS2_TEMPLATE_ID (complex flights)
            "67B7F3A5-7BFE-4F52-BE6B-110371CB9376";   // FLIGHT_TEMPLATE_ID (simple flights)

    return {
        success: true,
        content: {
            flights,
            hotels,
            totalPrice,
            currency,
            passengers,
            // Additional metadata for regeneration
            originalTemplate,
            needsComplexTemplate,
            extractedFromPdfMonkey: true
        },
        suggestions: [
            "Como este PDF fue generado por nuestro sistema, puedo regenerarlo con cualquier precio que especifiques",
            "Mantendré todos los detalles originales: vuelos, hoteles, fechas, pasajeros",
            "Solo cambiaré los precios según tu solicitud",
            "El nuevo PDF tendrá la misma calidad y formato profesional"
        ]
    };
}

/**
 * Analyze PDF content using AI or structured extraction
 */
export async function analyzePdfContent(file: File): Promise<PdfAnalysisResult> {
    try {
        console.log('📄 Analyzing PDF:', file.name);

        // Always extract text content first to determine if it's our template
        console.log('📋 Extracting PDF content for analysis');

        // Convert file to array buffer for PDF processing
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Extract text content from PDF using Supabase Edge Function
        const { data: extractionResult, error } = await supabase.functions.invoke('pdf-text-extractor', {
            body: {
                pdfData: Array.from(uint8Array),
                fileName: file.name
            }
        });

        if (error) {
            console.error('❌ PDF extraction error:', error);
            throw new Error(`PDF extraction failed: ${error.message}`);
        }

        if (!extractionResult?.success) {
            throw new Error(extractionResult?.error || 'PDF extraction failed');
        }

        let extractedText = extractionResult.text;

        // Sanitize text: Remove NULL characters and other problematic Unicode characters
        // PostgreSQL doesn't allow \u0000 in text fields
        if (extractedText) {
            extractedText = extractedText
                .replace(/\u0000/g, '') // Remove NULL characters
                .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '') // Remove other control characters
                .trim();
            console.log('✅ Text sanitized, removed NULL and control characters');
        }

        console.log('📄 Extracted PDF text:', extractedText.substring(0, 500) + '...');

        // Check if this is a PDF generated by our PdfMonkey template using both filename and content
        if (isPdfMonkeyTemplate(file.name, extractedText)) {
            console.log('🎯 PDF recognized as PdfMonkey template - using structured extraction');

            return extractPdfMonkeyDataFromContent(file.name, extractedText);
        }

        // For external PDFs, parse the extracted content
        console.log('📋 External PDF detected - parsing extracted content');

        // Parse extracted text to find travel information
        const parsedData = parseExtractedTravelData(extractedText);

        return {
            success: true,
            content: parsedData,
            suggestions: [
                "Puedo buscar vuelos con mejores horarios o conexiones más cortas",
                "Hay hoteles con mejor ubicación disponibles en las mismas fechas",
                "Podría encontrar opciones más económicas con fechas flexibles",
                "¿Te interesa agregar servicios adicionales como traslados o seguro de viaje?"
            ]
        };

    } catch (error) {
        console.error('Error analyzing PDF:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error analyzing PDF content'
        };
    }
}

/**
 * Generate price change suggestions based on PDF content
 */
export function generatePriceChangeSuggestions(analysis: PdfAnalysisResult): string {
    if (!analysis.success || !analysis.content) {
        return generateManualDataEntryPrompt();
    }

    const { content, suggestions } = analysis;

    // Check if we have meaningful data extracted
    const hasValidData = (content.flights && content.flights.length > 0 && content.flights[0].price > 0) ||
        (content.hotels && content.hotels.length > 0 && content.hotels[0].price > 0) ||
        (content.totalPrice && content.totalPrice > 0);

    if (!hasValidData) {
        return generateManualDataEntryPrompt();
    }

    let response = `📄 **Análisis de tu Cotización**\n\n`;

    // Flight information
    if (content.flights && content.flights.length > 0) {
        response += `✈️ **Vuelos Encontrados:**\n\n`;

        content.flights.forEach((flight, index) => {
            // Airline, route and date on the same line
            response += `${flight.airline} - ${flight.route} 📅 ${flight.dates}`;

            // Show price if available
            if (flight.price > 0) {
                response += ` | 💰 $${flight.price}\n\n`;
            } else {
                response += `\n💡 _Precio incluido en el total del paquete_\n\n`;
            }

            // Add extra blank line after every pair of flights (odd indices: 1, 3, 5...)
            if (index % 2 === 1) {
                response += `\n`;
            }
        });

        // Add final line break after all flights
        response += `\n`;
    }

    // Hotel information
    if (content.hotels && content.hotels.length > 0) {
        response += `🏨 **Hoteles Encontrados:**\n\n`;
        content.hotels.forEach((hotel, index) => {
            response += `${hotel.name} - ${hotel.location}\n`;

            // Only show price breakdown if we have a valid hotel price
            if (hotel.price > 0) {
                // hotel.price is the TOTAL price for all nights, calculate per-night if needed
                const pricePerNight = hotel.nights > 0 ? (hotel.price / hotel.nights).toFixed(2) : hotel.price.toFixed(2);
                const totalPrice = hotel.price.toFixed(2);
                response += `🌙 ${hotel.nights} ${hotel.nights === 1 ? 'noche' : 'noches'} | 💰 $${totalPrice} total ($${pricePerNight}/noche)\n\n`;
            } else {
                // No individual hotel price available - show nights only
                response += `🌙 ${hotel.nights} ${hotel.nights === 1 ? 'noche' : 'noches'}\n`;
                response += `💡 _Precio incluido en el total del paquete_\n\n`;
            }
        });
    }

    // NUEVO: Mostrar Precio Económico/Premium cuando hay 2+ hoteles
    if (content.hotels && content.hotels.length >= 2 && content.flights && content.flights.length > 0) {
        // Check if hotels have package prices (from multi-option PDFs)
        const option1Hotel = content.hotels.find((h: any) => h.name.match(/\(Opción\s+1\)/i));
        const option2Hotel = content.hotels.find((h: any) => h.name.match(/\(Opción\s+2\)/i));

        let precioEconomico: number;
        let precioPremium: number;
        let cheapestHotel: any;
        let mostExpensiveHotel: any;

        if (option1Hotel?.packagePrice !== undefined && option2Hotel?.packagePrice !== undefined) {
            // Use packagePrice directly from options (for regenerated PDFs)
            precioEconomico = option1Hotel.packagePrice;
            precioPremium = option2Hotel.packagePrice;
            cheapestHotel = option1Hotel;
            mostExpensiveHotel = option2Hotel;
        } else {
            // Calculate by summing flights + hotel (original behavior)
            const hotelsSortedByPrice = [...content.hotels].sort((a, b) => a.price - b.price);
            cheapestHotel = hotelsSortedByPrice[0];
            mostExpensiveHotel = hotelsSortedByPrice[hotelsSortedByPrice.length - 1];

            const flightsTotalPrice = content.flights.reduce((sum, f) => sum + f.price, 0);
            precioEconomico = flightsTotalPrice + cheapestHotel.price;
            precioPremium = flightsTotalPrice + mostExpensiveHotel.price;
        }

        // Mostrar opciones
        response += `💰 **Opciones de Precio:**\n\n`;
        response += `• **Opción 1:** $${precioEconomico.toFixed(2)} ${content.currency || 'USD'}\n`;
        response += `  (${cheapestHotel.name} - $${cheapestHotel.price.toFixed(2)})\n\n`;
        response += `• **Opción 2:** $${precioPremium.toFixed(2)} ${content.currency || 'USD'}\n`;
        response += `  (${mostExpensiveHotel.name} - $${mostExpensiveHotel.price.toFixed(2)})\n\n`;
    } else if (content.totalPrice) {
        // Comportamiento original para 0-1 hoteles
        response += `💰 **Precio Total:** $${content.totalPrice} ${content.currency || 'USD'}  \n`;
    }

    // Pasajeros (común a ambos casos)
    if (content.passengers) {
        response += `👥 **Pasajeros:** ${content.passengers}\n\n`;
    }

    response += `💬 **¿Qué te gustaría modificar?**\n\n`;
    response += `Puedes pedirme:\n\n`;

    if (content.hotels && content.hotels.length >= 2) {
        response += `• "Cambia el precio de la opción 1 a [cantidad]"\n`;
        response += `• "Cambia el precio de la opción 2 a [cantidad]"\n`;
        response += `• "Cambia el precio total a [cantidad]"\n\n`;
    } else {
        response += `• "Cambia el precio total a [cantidad]"\n\n`;
    }

    return response;
}

/**
 * Generate manual data entry prompt when PDF analysis fails
 */
function generateManualDataEntryPrompt(): string {
    return `📄 **PDF Analizado - Datos Manuales Requeridos**\n\n` +
        `He analizado tu PDF pero no pude extraer automáticamente los datos estructurados (el PDF está comprimido). Sin embargo, puedo ayudarte de varias maneras:\n\n` +
        `💰 **Para cambiar precios:**\n` +
        `• Dime el precio total actual y el nuevo precio que quieres\n` +
        `• Ejemplo: "El PDF tiene un total de $1200, quiero cambiarlo a $1000"\n` +
        `• Ejemplo: "Cambiar precio a $800"\n\n` +
        `📋 **Para análisis completo:**\n` +
        `• Comparte los detalles principales: origen, destino, fechas, pasajeros\n` +
        `• Ejemplo: "Vuelo EZE-MAD del 15/11 al 22/11 para 2 personas, precio $1200"\n\n` +
        `🔄 **Opciones disponibles:**\n` +
        `• "Cambiar precio a $[cantidad]" - Genero un nuevo PDF profesional con ese precio\n` +
        `• "Buscar alternativas más baratas" - Busco opciones similares\n` +
        `• "Regenerar PDF con precio $[cantidad]" - Creo un PDF completamente nuevo\n\n` +
        `💡 **¿Qué información tienes del PDF o qué precio quieres?**`;
}

/**
 * Extract price from user message
 * Supports both US format (2,549.32) and EU/Latino format (2.549,32)
 */
function extractPriceFromMessage(message: string): number | null {
    // Look for patterns like: $1200, 1200 USD, 1200 dólares, 2.549,32 USD, etc.
    // Updated regex to capture complete numbers with flexible separators
    // IMPORTANT: More specific patterns first (precio total, cambia precio total) to avoid partial matches
    const pricePatterns = [
        // Most specific patterns first - these include "total" or "precio" context
        /(?:cambia|cambiar|modifica|modificar|actualiza|actualizar|ajusta|ajustar|pon|poner)(?:\s+el)?\s+precio\s+total\s+(?:a|en|por)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /precio\s+total\s+(?:a|en|por|de)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /total\s+(?:a|en|por|de)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        // Specific pattern for "opción 1/2 a PRICE" - MUST come before generic "cambia precio"
        /(?:opci[oó]n|opcion)\s+[12]\s+(?:a|en)\s+(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /(?:cambia|cambiar|modifica|modificar|actualiza|actualizar|ajusta|ajustar|pon|poner)(?:\s+el)?\s+precio\s+(?:a|en|por)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /precio\s+(?:a|en|por|de)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        // Currency patterns
        /\$\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/g,
        /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*(?:USD|usd|dólares?|dolares?)/gi,
        // Generic context patterns (less specific)
        /cambia.*?(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /por\s+(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi
    ];

    // First try to find numbers with context (more specific patterns)
    // Use matchAll to properly capture groups
    for (const pattern of pricePatterns) {
        const matches = [...message.matchAll(pattern)];
        if (matches.length > 0) {
            for (const match of matches) {
                // match[1] contains the captured group (the number)
                const priceStr = match[1];
                if (priceStr) {
                    const price = parsePrice(priceStr);
                    if (price > 0 && price < 100000) { // Reasonable price range
                        console.log('💰 [PRICE EXTRACTION] Found price with context:', price, 'from match:', match[0], 'raw:', priceStr);
                        return price;
                    }
                }
            }
        }
    }

    // If no contextual match, look for standalone numbers (including numbers with thousand separators)
    // Updated regex to capture numbers with or without thousand separators
    const standalonePattern = /\b(\d{1,10}(?:[.,]\d{3})+|\d{3,6})\b/g;
    const standaloneMatches = message.match(standalonePattern);

    if (standaloneMatches) {
        console.log('💰 [PRICE EXTRACTION] Found standalone matches:', standaloneMatches);

        // Parse each match and filter by reasonable price range
        const parsedPrices = standaloneMatches
            .map(numStr => {
                const price = parsePrice(numStr);
                console.log('💰 [PRICE EXTRACTION] Parsing standalone:', numStr, '→', price);
                return price;
            })
            .filter(price => price >= 100 && price <= 50000); // Reasonable price range

        if (parsedPrices.length > 0) {
            // Take the largest number found (most likely to be the price)
            const maxPrice = Math.max(...parsedPrices);
            console.log('💰 [PRICE EXTRACTION] Found standalone number:', maxPrice);
            return maxPrice;
        }
    }

    console.log('💰 [PRICE EXTRACTION] No price found in message:', message);
    return null;
}

/**
 * Extract multiple prices with positions from message
 * Detects patterns like: "primer precio a $1500 segundo a $2000" or "precio 1: $1800, precio 2: $2200"
 */
function extractMultiplePricesFromMessage(message: string): Array<{ position: number, price: number }> | null {
    console.log('🔍 [MULTIPLE PRICES V6] Extracting multiple prices from:', message);
    const normalizedMessage = message.toLowerCase();
    const priceChanges: Array<{ position: number, price: number }> = [];

    const positionMapping: Record<string, number> = {
        'primer': 1, 'primera': 1, 'primero': 1,
        'segund': 2, 'segundo': 2, 'segunda': 2,
        'tercer': 3, 'tercera': 3, 'tercero': 3,
        'cuart': 4, 'cuarto': 4, 'cuarta': 4,
        '1': 1, '2': 2, '3': 3, '4': 4
    };

    // Strategy 1: Look for explicit "al [position] [price]" patterns
    // Examples: "al primer 1000", "al segundo 2000", "al 1 1000", "al 2 2000"
    // Updated regex to capture complete numbers with flexible separators
    const explicitPattern = /al\s+(primer[ao]?|primero|segundo?[ao]?|tercer[ao]?|tercero|cuarto?[ao]?|[1-4])\s+(?:vuelo\s+)?(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi;
    let explicitMatches = [...normalizedMessage.matchAll(explicitPattern)];

    console.log('🔍 [EXPLICIT PATTERN] Found matches:', explicitMatches.length);

    for (const match of explicitMatches) {
        console.log(`🔍 [EXPLICIT] Processing match: "${match[0]}"`, match);
        const positionStr = match[1].toLowerCase().replace(/[ao]$/, '');
        const position = positionMapping[positionStr] || parseInt(positionStr);
        const priceStr = match[2];

        console.log(`🔍 [EXPLICIT] Parsed - position: ${position}, priceStr: "${priceStr}"`);

        if (position > 0 && priceStr) {
            const price = parsePrice(priceStr);
            console.log(`🔍 [EXPLICIT] Price value: ${price}, valid range: ${price >= 100 && price <= 50000}`);

            if (price >= 100 && price <= 50000) {
                const existingIndex = priceChanges.findIndex(pc => pc.position === position);
                console.log(`🔍 [EXPLICIT] Existing index for position ${position}: ${existingIndex}`);

                if (existingIndex === -1) {
                    priceChanges.push({ position, price });
                    console.log(`💰 [EXPLICIT] Position ${position}: $${price} from "${match[0]}"`);
                } else {
                    console.log(`⚠️ [EXPLICIT] Skipped duplicate position ${position}`);
                }
            } else {
                console.log(`⚠️ [EXPLICIT] Price ${price} out of range [100, 50000]`);
            }
        } else {
            console.log(`⚠️ [EXPLICIT] Invalid position (${position}) or priceStr ("${priceStr}")`);
        }
    }

    // Strategy 2: Look for "precio [position] [price]" patterns
    // Examples: "precio 1 1000", "precio al segundo 2000"
    const pricePositionPattern = /precio\s+(?:al\s+)?(primer[ao]?|primero|segundo?[ao]?|tercer[ao]?|tercero|cuarto?[ao]?|[1-4])\s+(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi;
    let pricePositionMatches = [...normalizedMessage.matchAll(pricePositionPattern)];

    console.log('🔍 [PRICE POSITION PATTERN] Found matches:', pricePositionMatches.length);

    for (const match of pricePositionMatches) {
        const positionStr = match[1].toLowerCase().replace(/[ao]$/, '');
        const position = positionMapping[positionStr] || parseInt(positionStr);
        const priceStr = match[2];

        if (position > 0 && priceStr) {
            const price = parsePrice(priceStr);
            if (price >= 100 && price <= 50000) {
                const existingIndex = priceChanges.findIndex(pc => pc.position === position);
                if (existingIndex === -1) {
                    priceChanges.push({ position, price });
                    console.log(`💰 [PRICE POSITION] Position ${position}: $${price} from "${match[0]}"`);
                }
            }
        }
    }

    // Strategy 3: Original clause-based pattern (fallback)
    const clauses = normalizedMessage.split(/\s+y\s+|,\s*/);
    console.log('🔍 [CLAUSE SPLIT] Clauses:', clauses);

    const clausePattern = /(primer[ao]?|primero|segundo?[ao]?|tercer[ao]?|tercero|cuarto?[ao]?|[1-4]).*?(\d{1,10}(?:[.,]\d{1,3})+|\d+)/i;

    for (const rawClause of clauses) {
        const clause = rawClause.trim();
        if (!clause) continue;

        const match = clause.match(clausePattern);

        if (match) {
            const positionStr = match[1].toLowerCase().replace(/[ao]$/, '');
            const position = positionMapping[positionStr] || parseInt(positionStr);
            const priceStr = match[2];

            // CRITICAL: Validate that the position digit is not part of a larger number
            // Examples:
            //   - "cambia el precio a 1.500" should NOT be position 1, price 500
            //   - "cambia el precio a 1400" should NOT be position 1, price 400
            //   - "cambia el precio a 2350 usd" should NOT be position 2, price 350
            if (position >= 1 && position <= 4 && /^[1-4]$/.test(positionStr)) {
                // Check if this "position" is actually part of a larger number
                const positionIndex = clause.indexOf(positionStr);
                const nextChar = clause[positionIndex + 1];

                // If the digit is immediately followed by a dot and 3 digits, it's a Latino number, not a position
                if (nextChar === '.' && /^\d{3}/.test(clause.substring(positionIndex + 2))) {
                    console.log(`⚠️ [CLAUSE] Skipping - "${positionStr}" is part of Latino number format (e.g., ${positionStr}.XXX)`);
                    continue;
                }

                // If the digit is immediately followed by more digits (no space), it's a complete number, not a position
                // Examples: 1400, 2350, 3999, 4200
                if (nextChar && /\d/.test(nextChar)) {
                    console.log(`⚠️ [CLAUSE] Skipping - "${positionStr}" is part of complete number (e.g., ${positionStr}${nextChar}...)`);
                    continue;
                }

                // Also check if there's a pattern like "precio a 1.500" or "total a 2.485" or "precio a 1400"
                if (/\b(precio|total|cuesta|cueste)\s+a\s+[1-4][\.\d]/.test(clause)) {
                    console.log(`⚠️ [CLAUSE] Skipping - detected "precio/total a X..." pattern`);
                    continue;
                }
            }

            if (position > 0 && priceStr) {
                const price = parsePrice(priceStr);
                if (price >= 100 && price <= 50000) {
                    const existingIndex = priceChanges.findIndex(pc => pc.position === position);
                    if (existingIndex === -1) {
                        priceChanges.push({ position, price });
                        console.log(`💰 [CLAUSE] Position ${position}: $${price} from clause "${clause}"`);
                    }
                }
            }
        }
    }

    // Sort by position to ensure correct order
    priceChanges.sort((a, b) => a.position - b.position);

    if (priceChanges.length > 0) {
        console.log('✅ [MULTIPLE PRICES] Total extracted:', priceChanges.length, priceChanges);
        return priceChanges;
    }

    console.log('❌ [MULTIPLE PRICES] No positional prices found');
    return null;
}

/**
 * Extract dual option price changes (opción 1 AND opción 2 in the same message)
 * Returns { option1Price, option2Price } if both are found, null otherwise
 */
function extractDualOptionPrices(message: string): { option1Price: number; option2Price: number } | null {
    console.log('🔄 [DUAL OPTIONS] Checking for dual option price changes:', message);

    // Patterns for option 1
    const option1Patterns = [
        /(?:el\s+)?precio\s+de\s+(?:la\s+)?opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /(?:la\s+)?opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /primera?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
    ];

    // Patterns for option 2
    const option2Patterns = [
        /(?:el\s+)?precio\s+de\s+(?:la\s+)?opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /(?:la\s+)?opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /segunda?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
    ];

    let option1Price: number | null = null;
    let option2Price: number | null = null;

    // Try to match option 1
    for (const pattern of option1Patterns) {
        const match = message.match(pattern);
        if (match) {
            const price = parsePrice(match[1]);
            if (price >= 100 && price <= 50000) {
                option1Price = price;
                console.log('💰 [DUAL OPTIONS] Option 1 price found:', price);
                break;
            }
        }
    }

    // Try to match option 2
    for (const pattern of option2Patterns) {
        const match = message.match(pattern);
        if (match) {
            const price = parsePrice(match[1]);
            if (price >= 100 && price <= 50000) {
                option2Price = price;
                console.log('💰 [DUAL OPTIONS] Option 2 price found:', price);
                break;
            }
        }
    }

    // Only return if BOTH options were found
    if (option1Price !== null && option2Price !== null) {
        console.log('✅ [DUAL OPTIONS] Both options found:', { option1Price, option2Price });
        return { option1Price, option2Price };
    }

    console.log('❌ [DUAL OPTIONS] Not a dual option change (found only one or none)');
    return null;
}

/**
 * Extract multiple hotel prices from message
 * Supports: position (primer/segundo), price order (más barato/caro), chain name (RIU, Iberostar)
 */
function extractMultipleHotelPricesFromMessage(
    message: string,
    hotels: Array<{ name: string; price: number; nights?: number }>
): Array<{ hotelIndex: number; hotelName?: string; referenceType: 'position' | 'name' | 'price_order'; newPrice: number }> {
    console.log('🏨 [MULTIPLE HOTEL PRICES] Extracting from:', message);
    console.log('🏨 [MULTIPLE HOTEL PRICES] Hotels available:', hotels.length);

    const changes: Array<{ hotelIndex: number; hotelName?: string; referenceType: 'position' | 'name' | 'price_order'; newPrice: number }> = [];
    const norm = message.toLowerCase();

    if (hotels.length === 0) {
        console.log('❌ [MULTIPLE HOTEL PRICES] No hotels available');
        return changes;
    }

    // Sort hotels by price for "más barato/caro" references
    const sortedByPrice = [...hotels].sort((a, b) => a.price - b.price);

    // Pattern 0: By package option "opción 1 a 5000", "opción 2 a 6000"
    const optionPatterns = [
        { regex: /opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /primera?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /segunda?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /la\s+opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /la\s+opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /(?:el\s+)?precio\s+de\s+la\s+opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /(?:el\s+)?precio\s+de\s+la\s+opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /(?:el\s+)?precio\s+de\s+opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /(?:el\s+)?precio\s+de\s+opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
    ];

    for (const { regex, position } of optionPatterns) {
        const match = message.match(regex);
        if (match && position <= hotels.length) {
            const newPrice = parsePrice(match[1]);
            if (newPrice >= 100 && newPrice <= 50000) {
                // Check if we already have a change for this hotel index
                const existingChange = changes.find(c => c.hotelIndex === position - 1);
                if (!existingChange) {
                    changes.push({
                        hotelIndex: position - 1,
                        referenceType: 'position',
                        newPrice
                    });
                    console.log(`💰 [OPTION PRICE] Opción ${position}: $${newPrice}`);
                }
            }
        }
    }

    // Pattern 1: By position "primer hotel a 1000"
    const positionPatterns = [
        { regex: /primer(?:o)?\s+hotel\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /segundo?\s+hotel\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /hotel\s+(?:#|n[uú]mero?\s*)1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /hotel\s+(?:#|n[uú]mero?\s*)2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
    ];

    for (const { regex, position } of positionPatterns) {
        const match = message.match(regex);
        if (match && position <= hotels.length) {
            const newPrice = parsePrice(match[1]);
            if (newPrice >= 100 && newPrice <= 50000) {
                // Check if we already have a change for this hotel index
                const existingChange = changes.find(c => c.hotelIndex === position - 1);
                if (!existingChange) {
                    changes.push({
                        hotelIndex: position - 1,
                        referenceType: 'position',
                        newPrice
                    });
                    console.log(`💰 [HOTEL POSITION] Hotel ${position}: $${newPrice}`);
                }
            }
        }
    }

    // Pattern 2: By price order "el más barato a 900"
    const priceOrderPatterns = [
        { regex: /(?:el\s+)?m[aá]s\s+barato\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, order: 'cheapest' },
        { regex: /(?:el\s+)?m[aá]s\s+caro\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, order: 'expensive' },
        { regex: /(?:el\s+)?econ[oó]mico\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, order: 'cheapest' },
    ];

    for (const { regex, order } of priceOrderPatterns) {
        const match = message.match(regex);
        if (match) {
            const newPrice = parsePrice(match[1]);
            if (newPrice >= 100 && newPrice <= 50000) {
                const targetHotel = order === 'cheapest' ? sortedByPrice[0] : sortedByPrice[sortedByPrice.length - 1];
                const originalIndex = hotels.findIndex(h => h.name === targetHotel.name);

                if (originalIndex >= 0) {
                    // Check if we already have a change for this hotel index
                    const existingChange = changes.find(c => c.hotelIndex === originalIndex);
                    if (!existingChange) {
                        changes.push({
                            hotelIndex: originalIndex,
                            hotelName: targetHotel.name,
                            referenceType: 'price_order',
                            newPrice
                        });
                        console.log(`💰 [HOTEL PRICE ORDER] ${order}: ${targetHotel.name} → $${newPrice}`);
                    }
                }
            }
        }
    }

    // Pattern 3: By chain name "el RIU a 1200", "Iberostar a 1400"
    const chainPattern = /(?:(?:el|hotel)\s+)?(riu|iberostar|bahia|barcelo|meli[aá]|nh|hilton|marriott)\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/gi;
    let chainMatch;

    while ((chainMatch = chainPattern.exec(message)) !== null) {
        const chainName = chainMatch[1].toLowerCase();
        const newPrice = parsePrice(chainMatch[2]);

        if (newPrice >= 100 && newPrice <= 50000) {
            const hotelIndex = hotels.findIndex(h => h.name.toLowerCase().includes(chainName));

            if (hotelIndex >= 0) {
                // Check if we already have a change for this hotel index
                const existingChange = changes.find(c => c.hotelIndex === hotelIndex);
                if (!existingChange) {
                    changes.push({
                        hotelIndex,
                        hotelName: hotels[hotelIndex].name,
                        referenceType: 'name',
                        newPrice
                    });
                    console.log(`💰 [HOTEL CHAIN] ${chainName}: ${hotels[hotelIndex].name} → $${newPrice}`);
                }
            }
        }
    }

    if (changes.length > 0) {
        console.log(`✅ [MULTIPLE HOTEL PRICES] Total extracted: ${changes.length}`, changes);
    } else {
        console.log('❌ [MULTIPLE HOTEL PRICES] No hotel prices found');
    }

    return changes;
}

/**
 * Reconstruct FlightData from extracted PDF data
 */
function reconstructFlightData(analysis: PdfAnalysisResult, newPrice: number): any[] {
    if (!analysis.content?.flights) return [];

    const originalPrice = analysis.content.totalPrice || 0;
    const priceRatio = originalPrice > 0 ? newPrice / originalPrice : 1;
    const flights = analysis.content.flights;

    // Group flights into pairs (same airline, consecutive in array)
    const flightGroups: any[][] = [];
    for (let i = 0; i < flights.length; i += 2) {
        if (i + 1 < flights.length && flights[i].airline === flights[i + 1].airline) {
            // Pair: ida + vuelta
            flightGroups.push([flights[i], flights[i + 1]]);
        } else {
            // Single flight (solo ida)
            flightGroups.push([flights[i]]);
        }
    }

    console.log(`📦 Grouped ${flights.length} flights into ${flightGroups.length} option(s)`);

    return flightGroups.map((group, groupIndex) => {
        const firstFlight = group[0];
        const hasReturn = group.length === 2;

        // Calculate total price for this group
        const groupOriginalPrice = group.reduce((sum, f) => sum + f.price, 0);
        const groupNewPrice = parseFloat((groupOriginalPrice * priceRatio).toFixed(2));

        console.log(`✈️ Group ${groupIndex + 1}: ${firstFlight.airline} - ${group.length} flight(s), price: $${groupNewPrice}`);

        // Collect all legs from both outbound and return
        const allLegs: any[] = [];
        group.forEach((flight, flightIndex) => {
            console.log(`🔍 [RECONSTRUCT] Processing flight ${flightIndex + 1} in group ${groupIndex + 1}:`, {
                has_legs: !!(flight as any).legs,
                legs_count: (flight as any).legs?.length || 0,
                legs_preview: (flight as any).legs?.map((leg: any, legIndex: number) => ({
                    leg_index: legIndex,
                    flight_type: leg.flight_type,
                    route: `${leg.departure?.city_code} → ${leg.arrival?.city_code}`,
                    has_layovers: !!(leg.layovers),
                    layovers_count: leg.layovers?.length || 0,
                    layovers: leg.layovers || []
                }))
            });

            if ((flight as any).legs && (flight as any).legs.length > 0) {
                // Explicitly preserve all leg properties including layovers
                (flight as any).legs.forEach((leg: any) => {
                    allLegs.push({
                        ...leg,
                        // Ensure layovers are explicitly preserved
                        layovers: leg.layovers || []
                    });
                });
            }
        });

        console.log(`🔍 [RECONSTRUCT] Collected ${allLegs.length} total legs for group ${groupIndex + 1}:`, {
            legs: allLegs.map((leg, i) => ({
                index: i,
                flight_type: leg.flight_type,
                route: `${leg.departure?.city_code} → ${leg.arrival?.city_code}`,
                layovers_count: leg.layovers?.length || 0,
                layovers: leg.layovers || []
            }))
        });

        if (allLegs.length === 0) {
            throw new Error('No leg data found in PDF for flight reconstruction');
        }

        // Parse dates
        const flight = group[0];
        const lastFlight = group[group.length - 1];

        console.log(`📅 [RECONSTRUCT DATES] Group ${groupIndex + 1}:`, {
            hasReturn,
            firstFlight_dates: flight.dates,
            lastFlight_dates: lastFlight.dates,
            group_length: group.length
        });

        let departureDate, returnDate;
        if (flight.dates.includes(' / ')) {
            const [dep, ret] = flight.dates.split(' / ');
            departureDate = dep.trim();
            returnDate = ret.trim();
        } else {
            const parsed = parseDateRange(flight.dates);
            departureDate = parsed.departureDate;
            returnDate = parsed.returnDate;
        }

        console.log(`📅 [DATES PARSED] After first parse:`, { departureDate, returnDate });

        // If we have a return flight, use its date
        if (hasReturn && lastFlight.dates) {
            if (lastFlight.dates.includes(' / ')) {
                // If last flight has date range, take the return part
                returnDate = lastFlight.dates.split(' / ')[1].trim();
            } else {
                // If last flight has single date, use it directly
                returnDate = lastFlight.dates.trim();
            }
            console.log(`📅 [DATES CORRECTED] After using lastFlight:`, { returnDate });
        }

        console.log(`📅 [FINAL DATES]`, { departureDate, returnDate });

        // Get airline code
        const airlineCode = extractAirlineCode(firstFlight.airline);

        return {
            id: `regenerated-${Date.now()}-${groupIndex}`,
            airline: {
                code: airlineCode,
                name: firstFlight.airline
            },
            price: {
                amount: parseFloat(groupNewPrice.toFixed(2)),
                currency: analysis.content?.currency || 'USD',
                breakdown: {
                    fareAmount: parseFloat((groupNewPrice * 0.75).toFixed(2)),
                    taxAmount: parseFloat((groupNewPrice * 0.25).toFixed(2)),
                    serviceAmount: 0,
                    commissionAmount: 0
                }
            },
            adults: analysis.content?.passengers || 1,
            childrens: 0,
            departure_date: departureDate,
            return_date: returnDate,
            departure_time: allLegs[0].departure.time,
            arrival_time: allLegs[allLegs.length - 1].arrival.time,
            duration: { formatted: allLegs[0].duration },
            stops: {
                direct: allLegs.length <= 2,
                count: Math.max(0, allLegs.length - 2)
            },
            baggage: {
                included: true,
                details: '2PC'
            },
            cabin: {
                class: 'Economy',
                brandName: 'Economy Flexible'
            },
            booking: {
                lastTicketingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                validatingCarrier: airlineCode,
                fareType: 'P'
            },
            legs: allLegs // All legs from ida + vuelta
        };
    }).map((flight, index) => {
        // Verify legs are properly preserved before returning
        console.log(`✅ [RECONSTRUCT] Final flight ${index + 1} structure:`, {
            airline: flight.airline.name,
            price: flight.price.amount,
            legs_count: flight.legs.length,
            legs_detail: flight.legs.map((leg: any, legIdx: number) => ({
                index: legIdx,
                flight_type: leg.flight_type,
                route: `${leg.departure.city_code} → ${leg.arrival.city_code}`,
                layovers_count: leg.layovers?.length || 0,
                layovers: leg.layovers || []
            }))
        });
        return flight;
    });
}

/**
 * Reconstruct HotelData from extracted PDF data  
 */
function reconstructHotelData(analysis: PdfAnalysisResult, newPrice: number, targetOption?: 1 | 2): any[] {
    if (!analysis.content?.hotels) return [];

    // Check if hotels are package options
    const arePackageOptions = analysis.content.hotels.length >= 2 &&
        analysis.content.hotels.every(h => /\(Opción\s+\d+\)/i.test(h.name));

    console.log(`🏨 [RECONSTRUCT] Hotels: ${analysis.content.hotels.length}, arePackageOptions: ${arePackageOptions}, targetOption: ${targetOption}`);

    // Check if hotels have _packageMetadata (from dual price change)
    const hasPackageMetadata = analysis.content.hotels.some((h: any) => h._packageMetadata);
    if (hasPackageMetadata) {
        console.log('📦 [RECONSTRUCT] Detected _packageMetadata - preserving it');
    }

    const originalPrice = analysis.content.totalPrice || 0;
    const priceRatio = originalPrice > 0 ? newPrice / originalPrice : 1;

    return analysis.content.hotels.map((hotel, index) => {
        let adjustedNightlyPrice: number;
        let adjustedTotalPrice: number;
        let packageMetadata: any = undefined;

        // PRIORITY 1: If hotel has _packageMetadata, use it (from dual price change)
        if ((hotel as any)._packageMetadata) {
            const metadata = (hotel as any)._packageMetadata;
            adjustedNightlyPrice = hotel.price;
            adjustedTotalPrice = hotel.price;
            packageMetadata = metadata;
            console.log(`📦 [RECONSTRUCT] Using _packageMetadata for ${hotel.name}:`, metadata);
        }
        // PRIORITY 2: If this is a package option PDF and targetOption is specified
        else if (arePackageOptions && targetOption) {
            // Extract option number from hotel name (e.g., "RIU LUPITA (Opción 1)" -> 1)
            const optionMatch = hotel.name.match(/\(Opción\s+(\d+)\)/i);
            const hotelOptionNumber = optionMatch ? parseInt(optionMatch[1]) : undefined;

            if (hotelOptionNumber === targetOption) {
                // This is the hotel to modify - calculate new price based on package price
                const flightsPrice = (analysis.content.flights || []).reduce((sum, f) => sum + f.price, 0);
                const newHotelPrice = newPrice - flightsPrice;

                adjustedNightlyPrice = newHotelPrice;
                adjustedTotalPrice = newHotelPrice;

                console.log(`🏨 [RECONSTRUCT] Modified hotel ${hotel.name}: $${hotel.price} → $${adjustedTotalPrice} (flights: $${flightsPrice}, package: $${newPrice})`);
            } else {
                // This is NOT the target hotel - keep original price
                adjustedNightlyPrice = hotel.price;
                adjustedTotalPrice = hotel.price;
                console.log(`🏨 [RECONSTRUCT] Kept original for ${hotel.name}: $${hotel.price}`);
            }
        } else {
            // Standard behavior: adjust all hotels proportionally
            adjustedNightlyPrice = parseFloat((hotel.price * priceRatio).toFixed(2));
            adjustedTotalPrice = parseFloat((adjustedNightlyPrice * hotel.nights).toFixed(2));
        }

        // Extract check-in and check-out dates from flights - NO MOCK DATA
        let checkIn = '';
        let checkOut = '';

        if (analysis.content?.flights && analysis.content.flights.length > 0) {
            const firstFlight = analysis.content.flights[0];
            const lastFlight = analysis.content.flights[analysis.content.flights.length - 1];

            // Get check-in date from first flight
            if (firstFlight.dates) {
                if (firstFlight.dates.includes(' / ')) {
                    checkIn = firstFlight.dates.split(' / ')[0].trim();
                } else if (firstFlight.dates.includes(' | ')) {
                    checkIn = firstFlight.dates.split(' | ')[0].replace('📅', '').trim();
                } else {
                    checkIn = firstFlight.dates.replace('📅', '').trim();
                }
            }

            // Get check-out date from last flight
            if (lastFlight.dates && analysis.content.flights.length > 1) {
                if (lastFlight.dates.includes(' / ')) {
                    checkOut = lastFlight.dates.split(' / ')[1]?.trim() || '';
                } else if (lastFlight.dates.includes(' | ')) {
                    checkOut = lastFlight.dates.split(' | ')[0].replace('📅', '').trim();
                } else {
                    checkOut = lastFlight.dates.replace('📅', '').trim();
                }
            } else if (hotel.nights > 0 && checkIn) {
                // Calculate check-out based on nights only if we have checkIn
                const checkInDate = new Date(checkIn);
                checkInDate.setDate(checkInDate.getDate() + hotel.nights);
                checkOut = checkInDate.toISOString().split('T')[0];
            }
        }

        const hotelId = `regenerated-hotel-${Date.now()}-${index}`;
        const hotelData: any = {
            id: hotelId,
            unique_id: hotelId,
            name: hotel.name,
            city: hotel.location,
            address: hotel.location,
            category: "4",
            nights: hotel.nights,
            check_in: checkIn,
            check_out: checkOut,
            rooms: [{
                type: 'Standard',
                description: 'Habitación estándar',
                price_per_night: adjustedNightlyPrice,
                total_price: adjustedTotalPrice,
                currency: analysis.content?.currency || 'USD',
                availability: 5,
                occupancy_id: `room-${index}-modified`
            }]
        };

        // Add _packageMetadata if present (for dual price changes)
        if (packageMetadata) {
            hotelData._packageMetadata = packageMetadata;
            console.log(`✅ [RECONSTRUCT] Added _packageMetadata to ${hotel.name}:`, packageMetadata);
        }

        return hotelData;
    });
}

/**
 * Generate modified PDF with individual flight prices
 */
export async function generateModifiedPdfWithIndividualPrices(
    analysis: PdfAnalysisResult,
    priceChanges: Array<{ position: number, price: number }>,
    conversationId: string
): Promise<{ success: boolean; pdfUrl?: string; error?: string }> {
    try {
        console.log('🔄 Generating modified PDF with individual prices:', priceChanges);

        // Import the PDF generation services
        const { generateCombinedTravelPdf, generateFlightPdf } = await import('./pdfMonkey');

        if (!analysis.content) {
            throw new Error('No content available from PDF analysis');
        }

        // Get original flights
        const originalFlights = analysis.content.flights || [];

        if (originalFlights.length === 0) {
            throw new Error('No flights found in PDF analysis');
        }

        console.log(`📊 Original flights count: ${originalFlights.length}`);

        // Group flights into pairs (outbound + return by airline/dates)
        const flightPairs: Array<{ outbound: any, return: any, originalPrice: number }> = [];

        for (let i = 0; i < originalFlights.length; i += 2) {
            if (i + 1 < originalFlights.length) {
                const outbound = originalFlights[i];
                const returnFlight = originalFlights[i + 1];
                const pairPrice = outbound.price + returnFlight.price;

                flightPairs.push({
                    outbound,
                    return: returnFlight,
                    originalPrice: pairPrice
                });

                console.log(`🔗 Pair ${flightPairs.length}: ${outbound.airline} (${outbound.route}) + (${returnFlight.route}) = $${pairPrice}`);
            }
        }

        console.log(`📊 Flight pairs detected: ${flightPairs.length}`);

        // Validate positions against pairs (not individual flights)
        for (const change of priceChanges) {
            if (change.position < 1 || change.position > flightPairs.length) {
                throw new Error(`Invalid position: ${change.position}. PDF only has ${flightPairs.length} flight option(s).`);
            }
        }

        // Apply price changes to pairs
        let newTotalPrice = 0;
        const modifiedFlights: any[] = [];

        flightPairs.forEach((pair, pairIndex) => {
            const pairPosition = pairIndex + 1; // 1-based position
            const priceChange = priceChanges.find(pc => pc.position === pairPosition);

            if (priceChange) {
                // User specified a new price for this pair
                const newPairPrice = priceChange.price;

                // Divide price 50/50 between outbound and return for internal calculation
                const halfPrice = newPairPrice / 2;

                modifiedFlights.push({
                    ...pair.outbound,
                    price: halfPrice
                });

                modifiedFlights.push({
                    ...pair.return,
                    price: halfPrice
                });

                newTotalPrice += newPairPrice;

                console.log(`✏️ Modifying pair ${pairPosition}: ${pair.outbound.airline} - New total: $${newPairPrice} (split: $${halfPrice} each)`);
            } else {
                // Keep original prices
                modifiedFlights.push({ ...pair.outbound });
                modifiedFlights.push({ ...pair.return });

                newTotalPrice += pair.originalPrice;

                console.log(`➡️ Keeping pair ${pairPosition}: ${pair.outbound.airline} - Original total: $${pair.originalPrice}`);
            }
        });

        console.log(`💰 New total price: $${newTotalPrice}`);

        // Create modified analysis with updated flights and total
        const modifiedAnalysis: PdfAnalysisResult = {
            ...analysis,
            content: {
                ...analysis.content!,
                flights: modifiedFlights,
                totalPrice: newTotalPrice
            }
        };

        // Use reconstructFlightData to transform to full structure
        // Pass the same total as the analysis to get ratio = 1 (no price adjustment)
        const reconstructedFlights = reconstructFlightData(modifiedAnalysis, modifiedAnalysis.content!.totalPrice!);

        // Get hotels if any
        const hotels = analysis.content.hotels || [];
        const reconstructedHotels = hotels.length > 0 ? reconstructHotelData(analysis, newTotalPrice) : [];

        // Generate PDF based on what content we have
        let pdfResult: { success: boolean; document_url?: string; error?: string };

        if (reconstructedHotels.length > 0) {
            console.log('🏨 Generating combined PDF (flights + hotels)');
            pdfResult = await generateCombinedTravelPdf(reconstructedFlights, reconstructedHotels);
        } else {
            console.log('✈️ Generating flights-only PDF');
            pdfResult = await generateFlightPdf(reconstructedFlights);
        }

        if (!pdfResult.success || !pdfResult.document_url) {
            throw new Error(pdfResult.error || 'Failed to generate PDF');
        }

        console.log('✅ Modified PDF generated successfully:', pdfResult.document_url);

        return {
            success: true,
            pdfUrl: pdfResult.document_url
        };

    } catch (error) {
        console.error('❌ Error generating modified PDF with individual prices:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Generate modified PDF with new hotel price (keeping flight prices unchanged)
 */
export async function generateModifiedPdfWithHotelPrice(
    analysis: PdfAnalysisResult,
    newHotelPrice: number,
    conversationId: string
): Promise<{ success: boolean; pdfUrl?: string; totalPrice?: number; error?: string }> {
    try {
        console.log('🏨 Generating modified PDF with new hotel price:', newHotelPrice);

        const { generateCombinedTravelPdf } = await import('./pdfMonkey');

        if (!analysis.content) {
            throw new Error('No content available from PDF analysis');
        }

        if (!analysis.content.hotels || analysis.content.hotels.length === 0) {
            throw new Error('No hotel information available');
        }

        // Keep flight prices unchanged
        const adjustedFlights = analysis.content.flights?.map((flight, index) => {
            if ((flight as any).legs && (flight as any).legs.length > 0) {
                return {
                    id: `hotel-modified-${Date.now()}-${index}`,
                    airline: {
                        code: extractAirlineCode(flight.airline),
                        name: flight.airline
                    },
                    price: {
                        amount: flight.price, // Keep original flight price
                        currency: analysis.content?.currency || 'USD'
                    },
                    adults: analysis.content?.passengers || 1,
                    childrens: 0,
                    departure_date: flight.dates.includes(' / ') ?
                        flight.dates.split(' / ')[0].trim() :
                        parseDateRange(flight.dates).departureDate,
                    return_date: flight.dates.includes(' / ') ?
                        flight.dates.split(' / ')[1].trim() :
                        parseDateRange(flight.dates).returnDate,
                    legs: (flight as any).legs
                };
            }
            return null;
        }).filter(flight => flight !== null) || [];

        // Update hotel price
        const adjustedHotels = analysis.content.hotels?.map((hotel, index) => {
            // Extract check-in and check-out dates from flights
            let checkIn = '2025-11-01';
            let checkOut = '2025-11-15';

            if (analysis.content?.flights && analysis.content.flights.length > 0) {
                const firstFlight = analysis.content.flights[0];
                const lastFlight = analysis.content.flights[analysis.content.flights.length - 1];

                // Get check-in date from first flight
                if (firstFlight.dates) {
                    if (firstFlight.dates.includes(' / ')) {
                        checkIn = firstFlight.dates.split(' / ')[0].trim();
                    } else if (firstFlight.dates.includes(' | ')) {
                        checkIn = firstFlight.dates.split(' | ')[0].replace('📅', '').trim();
                    } else {
                        checkIn = firstFlight.dates.replace('📅', '').trim();
                    }
                }

                // Get check-out date from last flight
                if (lastFlight.dates && analysis.content.flights.length > 1) {
                    if (lastFlight.dates.includes(' / ')) {
                        checkOut = lastFlight.dates.split(' / ')[1]?.trim() || lastFlight.dates.split(' / ')[0].trim();
                    } else if (lastFlight.dates.includes(' | ')) {
                        checkOut = lastFlight.dates.split(' | ')[0].replace('📅', '').trim();
                    } else {
                        checkOut = lastFlight.dates.replace('📅', '').trim();
                    }
                } else if (hotel.nights > 0) {
                    // Calculate check-out based on nights
                    const checkInDate = new Date(checkIn);
                    checkInDate.setDate(checkInDate.getDate() + hotel.nights);
                    checkOut = checkInDate.toISOString().split('T')[0];
                }
            }

            const hotelId = `hotel-price-modified-${Date.now()}-${index}`;
            return {
                id: hotelId,
                unique_id: hotelId,
                name: hotel.name,
                city: hotel.location,
                address: hotel.location,
                category: '5', // Default category
                check_in: checkIn,
                check_out: checkOut,
                nights: hotel.nights || 7,
                rooms: [{
                    type: 'Standard',
                    description: 'Habitación estándar - precio modificado',
                    price_per_night: parseFloat((newHotelPrice / (hotel.nights || 7)).toFixed(2)),
                    total_price: newHotelPrice, // New hotel price
                    currency: analysis.content?.currency || 'USD',
                    availability: 5,
                    occupancy_id: `room-${index}`
                }],
                selectedRoom: {
                    type: 'Standard',
                    description: 'Habitación estándar - precio modificado',
                    price_per_night: parseFloat((newHotelPrice / (hotel.nights || 7)).toFixed(2)),
                    total_price: newHotelPrice,
                    currency: analysis.content?.currency || 'USD',
                    availability: 5,
                    occupancy_id: `room-${index}`
                }
            };
        }) || [];

        // Calculate new total (flights + modified hotel)
        const flightsTotal = adjustedFlights.reduce((sum, f) => sum + (f.price?.amount || 0), 0);
        const hotelsTotal = newHotelPrice;
        const newTotalPrice = flightsTotal + hotelsTotal;

        console.log('💰 Price breakdown:', {
            flightsTotal,
            hotelsTotal: newHotelPrice,
            newTotalPrice
        });

        // Generate PDF with combined travel data
        const result = await generateCombinedTravelPdf(
            adjustedFlights,
            adjustedHotels,
            conversationId
        );

        if (result.success && result.document_url) {
            return {
                success: true,
                pdfUrl: result.document_url,
                totalPrice: newTotalPrice
            };
        } else {
            return {
                success: false,
                error: result.error || 'Failed to generate modified PDF'
            };
        }
    } catch (error) {
        console.error('❌ Error generating modified PDF with hotel price:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Generate modified PDF with multiple hotel price changes
 * Supports changing prices for specific hotels by position, name, or price order
 */
async function generateModifiedPdfWithMultipleHotelPrices(
    analysis: PdfAnalysisResult,
    hotelChanges: Array<{ hotelIndex: number; hotelName?: string; referenceType: 'position' | 'name' | 'price_order'; newPrice: number }>,
    conversationId: string
): Promise<{ success: boolean; pdfUrl?: string; totalPrice?: number; error?: string }> {
    try {
        console.log('🏨🏨 Generating modified PDF with multiple hotel price changes:', hotelChanges);

        const { generateCombinedTravelPdf } = await import('./pdfMonkey');

        if (!analysis.content) {
            throw new Error('No content available from PDF analysis');
        }

        if (!analysis.content.hotels || analysis.content.hotels.length === 0) {
            throw new Error('No hotel information available');
        }

        // Keep flight prices unchanged
        const adjustedFlights = analysis.content.flights?.map((flight, index) => {
            if ((flight as any).legs && (flight as any).legs.length > 0) {
                return {
                    id: `multi-hotel-modified-${Date.now()}-${index}`,
                    airline: {
                        code: extractAirlineCode(flight.airline),
                        name: flight.airline
                    },
                    price: {
                        amount: flight.price, // Keep original flight price
                        currency: analysis.content?.currency || 'USD'
                    },
                    adults: analysis.content?.passengers || 1,
                    childrens: 0,
                    departure_date: flight.dates.includes(' / ') ?
                        flight.dates.split(' / ')[0].trim() :
                        parseDateRange(flight.dates).departureDate,
                    return_date: flight.dates.includes(' / ') ?
                        flight.dates.split(' / ')[1].trim() :
                        parseDateRange(flight.dates).returnDate,
                    legs: (flight as any).legs
                };
            }
            return null;
        }).filter(flight => flight !== null) || [];

        // Apply price changes to hotels
        const adjustedHotels = analysis.content.hotels?.map((hotel, index) => {
            // Check if this hotel has a price change
            const priceChange = hotelChanges.find(change => change.hotelIndex === index);
            const finalPrice = priceChange ? priceChange.newPrice : hotel.price;

            // Extract check-in and check-out dates from flights
            let checkIn = '2025-11-01';
            let checkOut = '2025-11-15';

            if (analysis.content?.flights && analysis.content.flights.length > 0) {
                const firstFlight = analysis.content.flights[0];
                const lastFlight = analysis.content.flights[analysis.content.flights.length - 1];

                // Get check-in date from first flight
                if (firstFlight.dates) {
                    if (firstFlight.dates.includes(' / ')) {
                        checkIn = firstFlight.dates.split(' / ')[0].trim();
                    } else if (firstFlight.dates.includes(' | ')) {
                        checkIn = firstFlight.dates.split(' | ')[0].replace('📅', '').trim();
                    } else {
                        checkIn = firstFlight.dates.replace('📅', '').trim();
                    }
                }

                // Get check-out date from last flight
                if (lastFlight.dates && analysis.content.flights.length > 1) {
                    if (lastFlight.dates.includes(' / ')) {
                        checkOut = lastFlight.dates.split(' / ')[1]?.trim() || lastFlight.dates.split(' / ')[0].trim();
                    } else if (lastFlight.dates.includes(' | ')) {
                        checkOut = lastFlight.dates.split(' | ')[0].replace('📅', '').trim();
                    } else {
                        checkOut = lastFlight.dates.replace('📅', '').trim();
                    }
                } else if (hotel.nights > 0) {
                    // Calculate check-out based on nights
                    const checkInDate = new Date(checkIn);
                    checkInDate.setDate(checkInDate.getDate() + hotel.nights);
                    checkOut = checkInDate.toISOString().split('T')[0];
                }
            }

            const hotelId = `multi-hotel-modified-${Date.now()}-${index}`;
            const pricePerNight = parseFloat((finalPrice / (hotel.nights || 7)).toFixed(2));

            return {
                id: hotelId,
                unique_id: hotelId,
                name: hotel.name,
                city: hotel.location,
                address: hotel.location,
                category: '5', // Default category
                check_in: checkIn,
                check_out: checkOut,
                nights: hotel.nights || 7,
                rooms: [{
                    type: 'Standard',
                    description: priceChange ? 'Precio modificado' : 'Precio original',
                    price_per_night: pricePerNight,
                    total_price: finalPrice,
                    currency: analysis.content?.currency || 'USD',
                    availability: 5,
                    occupancy_id: `room-${index}`
                }],
                selectedRoom: {
                    type: 'Standard',
                    description: priceChange ? 'Precio modificado' : 'Precio original',
                    price_per_night: pricePerNight,
                    total_price: finalPrice,
                    currency: analysis.content?.currency || 'USD',
                    availability: 5,
                    occupancy_id: `room-${index}`
                }
            };
        }) || [];

        // Calculate new total (flights + modified hotels)
        const flightsTotal = adjustedFlights.reduce((sum, f) => sum + (f.price?.amount || 0), 0);
        const hotelsTotal = adjustedHotels.reduce((sum, h) => sum + (h.selectedRoom?.total_price || 0), 0);
        const newTotalPrice = flightsTotal + hotelsTotal;

        console.log('💰 Price breakdown (multi-hotel):', {
            flightsTotal,
            hotelsTotal,
            newTotalPrice,
            hotelPrices: adjustedHotels.map(h => ({ name: h.name, price: h.selectedRoom?.total_price }))
        });

        // Generate PDF with combined travel data
        const result = await generateCombinedTravelPdf(
            adjustedFlights,
            adjustedHotels,
            conversationId
        );

        if (result.success && result.document_url) {
            return {
                success: true,
                pdfUrl: result.document_url,
                totalPrice: newTotalPrice
            };
        } else {
            return {
                success: false,
                error: result.error || 'Failed to generate modified PDF'
            };
        }
    } catch (error) {
        console.error('❌ Error generating modified PDF with multiple hotel prices:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Generate modified PDF with new price
 */
export async function generateModifiedPdf(
    analysis: PdfAnalysisResult,
    newPrice: number,
    conversationId: string,
    targetOption?: 1 | 2 // Optional: which package option to modify (for multi-option PDFs)
): Promise<{ success: boolean; pdfUrl?: string; error?: string }> {
    try {
        console.log('🔄 Generating modified PDF with new price:', newPrice);
        console.log('🎯 PDF source:', analysis.content?.extractedFromPdfMonkey ? 'PdfMonkey Template' : 'External PDF');

        // Import the PDF generation services
        const { generateCombinedTravelPdf, generateFlightPdf } = await import('./pdfMonkey');

        if (!analysis.content) {
            throw new Error('No content available from PDF analysis');
        }

        // Calculate price adjustment details
        const originalPrice = analysis.content.totalPrice || 0;
        const priceAdjustment = newPrice - originalPrice;
        const adjustmentPercentage = originalPrice > 0 ? (priceAdjustment / originalPrice) * 100 : 0;

        console.log('📊 Price adjustment details:', {
            originalPrice,
            newPrice,
            adjustment: priceAdjustment,
            percentage: adjustmentPercentage.toFixed(2) + '%',
            isPdfMonkeyTemplate: analysis.content.extractedFromPdfMonkey
        });

        let adjustedFlights: any[];
        let adjustedHotels: any[];

        if (analysis.content.extractedFromPdfMonkey) {
            // For our own PDFs, use reconstructFlightData which maintains the original template structure
            console.log('🏗️ Reconstructing flight data from PdfMonkey template');
            console.log('📊 [MODIFY PDF] Input analysis flights:', {
                flights_count: analysis.content.flights?.length || 0,
                flights_preview: analysis.content.flights?.map((f: any, idx: number) => ({
                    index: idx,
                    airline: f.airline,
                    legs_count: f.legs?.length || 0,
                    legs_with_layovers: f.legs?.map((leg: any) => ({
                        flight_type: leg.flight_type,
                        route: `${leg.departure?.city_code} → ${leg.arrival?.city_code}`,
                        layovers_count: leg.layovers?.length || 0,
                        layovers: leg.layovers || []
                    }))
                }))
            });

            adjustedFlights = reconstructFlightData(analysis, newPrice);

            console.log('✅ [MODIFY PDF] Reconstructed flights:', {
                flights_count: adjustedFlights.length,
                flights_preview: adjustedFlights.map((f: any, idx: number) => ({
                    index: idx,
                    airline: f.airline?.name || f.airline,
                    legs_count: f.legs?.length || 0,
                    legs_with_layovers: f.legs?.map((leg: any) => ({
                        flight_type: leg.flight_type,
                        route: `${leg.departure?.city_code} → ${leg.arrival?.city_code}`,
                        layovers_count: leg.layovers?.length || 0,
                        layovers: leg.layovers || []
                    }))
                }))
            });

            adjustedHotels = reconstructHotelData(analysis, newPrice, targetOption);

            // Add metadata for package options to preserve original prices
            if (targetOption && analysis.content.hotels) {
                const arePackageOptions = analysis.content.hotels.length >= 2 &&
                    analysis.content.hotels.every(h => /\(Opción\s+\d+\)/i.test(h.name));

                if (arePackageOptions) {
                    console.log('📦 [METADATA] Adding package metadata to hotels');

                    // Get original flight price (before modification)
                    const originalFlightPrice = analysis.content.flights?.reduce((sum, f) => sum + f.price, 0) || 0;
                    console.log(`✈️ [METADATA] Original flight price: $${originalFlightPrice}`);

                    adjustedHotels = adjustedHotels.map((hotel: any) => {
                        const optionMatch = hotel.name.match(/\(Opción\s+(\d+)\)/i);
                        if (optionMatch) {
                            const optionNumber = parseInt(optionMatch[1]);

                            // Calculate total package price for this option
                            let packagePrice: number;
                            if (optionNumber === targetOption) {
                                // Modified option: use requested price
                                packagePrice = newPrice;
                                console.log(`📦 [METADATA] Option ${optionNumber} (MODIFIED): $${packagePrice}`);
                            } else {
                                // Original option: vuelo original + hotel original
                                const originalHotelData = analysis.content.hotels?.find(h =>
                                    h.name.includes(`(Opción ${optionNumber})`)
                                );
                                packagePrice = originalFlightPrice + (originalHotelData?.price || 0);
                                console.log(`📦 [METADATA] Option ${optionNumber} (ORIGINAL): flight $${originalFlightPrice} + hotel $${originalHotelData?.price} = $${packagePrice}`);
                            }

                            return {
                                ...hotel,
                                _packageMetadata: {
                                    optionNumber,
                                    totalPackagePrice: packagePrice,
                                    isModified: targetOption === optionNumber
                                }
                            };
                        }
                        return hotel;
                    });
                }
            }
        } else {
            // For external PDFs, use ONLY real data from PDF
            console.log('🔄 Adapting external PDF data with real data only');
            const priceRatio = originalPrice > 0 ? newPrice / originalPrice : 1;

            adjustedFlights = analysis.content.flights?.map((flight, index) => {
                // Use ONLY real leg data from PDF - no mock data
                if ((flight as any).legs && (flight as any).legs.length > 0) {
                    console.log(`✅ [EXTERNAL] Flight ${index + 1} leg data:`, {
                        legs_count: (flight as any).legs.length,
                        legs: (flight as any).legs.map((leg: any) => ({
                            flight_type: leg.flight_type,
                            route: `${leg.departure?.city_code} → ${leg.arrival?.city_code}`,
                            layovers_count: leg.layovers?.length || 0,
                            layovers: leg.layovers || []
                        }))
                    });

                    return {
                        id: `external-modified-${Date.now()}-${index}`,
                        airline: {
                            code: extractAirlineCode(flight.airline),
                            name: flight.airline
                        },
                        price: {
                            amount: parseFloat((flight.price * priceRatio).toFixed(2)),
                            currency: analysis.content?.currency || 'USD'
                        },
                        adults: analysis.content?.passengers || 1,
                        childrens: 0,
                        departure_date: flight.dates.includes(' / ') ?
                            flight.dates.split(' / ')[0].trim() :
                            parseDateRange(flight.dates).departureDate,
                        return_date: flight.dates.includes(' / ') ?
                            flight.dates.split(' / ')[1].trim() :
                            parseDateRange(flight.dates).returnDate,
                        legs: (flight as any).legs // Use real legs from PDF with layovers preserved
                    };
                } else {
                    console.warn('⚠️ External PDF has no leg data - skipping flight');
                    return null;
                }
            }).filter(flight => flight !== null) || [];

            adjustedHotels = analysis.content.hotels?.map((hotel, index) => {
                // Extract check-in and check-out dates from flights
                let checkIn = '2025-11-01';
                let checkOut = '2025-11-15';

                if (analysis.content?.flights && analysis.content.flights.length > 0) {
                    const firstFlight = analysis.content.flights[0];
                    const lastFlight = analysis.content.flights[analysis.content.flights.length - 1];

                    // Get check-in date from first flight (outbound)
                    if (firstFlight.dates) {
                        if (firstFlight.dates.includes(' / ')) {
                            checkIn = firstFlight.dates.split(' / ')[0].trim();
                        } else if (firstFlight.dates.includes(' | ')) {
                            checkIn = firstFlight.dates.split(' | ')[0].replace('📅', '').trim();
                        } else {
                            checkIn = firstFlight.dates.replace('📅', '').trim();
                        }
                    }

                    // Get check-out date from last flight (return)
                    if (lastFlight.dates && analysis.content.flights.length > 1) {
                        if (lastFlight.dates.includes(' / ')) {
                            checkOut = lastFlight.dates.split(' / ')[1]?.trim() || lastFlight.dates.split(' / ')[0].trim();
                        } else if (lastFlight.dates.includes(' | ')) {
                            checkOut = lastFlight.dates.split(' | ')[0].replace('📅', '').trim();
                        } else {
                            checkOut = lastFlight.dates.replace('📅', '').trim();
                        }
                    } else if (hotel.nights > 0) {
                        // Calculate check-out based on nights
                        const checkInDate = new Date(checkIn);
                        checkInDate.setDate(checkInDate.getDate() + hotel.nights);
                        checkOut = checkInDate.toISOString().split('T')[0];
                    }
                }

                console.log(`🏨 Hotel dates: check_in=${checkIn}, check_out=${checkOut}, nights=${hotel.nights}`);

                const hotelId = `external-modified-hotel-${Date.now()}-${index}`;

                // CRITICAL: Check if hotel has _packageMetadata from dual price change
                // If it does, use the specific package price instead of global priceRatio
                let roomTotalPrice: number;
                if ((hotel as any)._packageMetadata) {
                    // For dual price changes, use the hotel price directly (already calculated with correct ratio)
                    roomTotalPrice = parseFloat((hotel.price * hotel.nights).toFixed(2));
                    console.log(`💰 [EXTERNAL PDF] Using specific price for ${hotel.name}: $${roomTotalPrice} (from _packageMetadata)`);
                } else {
                    // For regular price changes, use global priceRatio
                    roomTotalPrice = parseFloat((hotel.price * hotel.nights * priceRatio).toFixed(2));
                }

                const hotelData: any = {
                    id: hotelId,
                    unique_id: hotelId,
                    name: hotel.name,
                    city: hotel.location,
                    address: hotel.location,
                    category: '4',
                    nights: hotel.nights || 0,
                    check_in: checkIn,
                    check_out: checkOut,
                    rooms: [{
                        type: 'Standard',
                        description: 'Habitación estándar modificada',
                        total_price: roomTotalPrice,
                        currency: analysis.content?.currency || 'USD',
                        availability: 5,
                        occupancy_id: `external-room-${index}`
                    }]
                };

                // Preserve _packageMetadata if it exists (from dual price change)
                if ((hotel as any)._packageMetadata) {
                    hotelData._packageMetadata = (hotel as any)._packageMetadata;
                    console.log(`✅ [EXTERNAL PDF] Preserved _packageMetadata for ${hotel.name}:`, (hotel as any)._packageMetadata);
                }

                return hotelData;
            }) || [];
        }

        // Ensure exact total equals the requested newPrice by applying a final delta adjustment
        const currentFlightsTotal = adjustedFlights.reduce((sum, f) => sum + (f.price?.amount || 0), 0);
        const currentHotelsTotal = adjustedHotels.reduce((sum, h) => sum + (h.rooms?.[0]?.total_price || 0), 0);
        const currentTotal = currentFlightsTotal + currentHotelsTotal;
        const deltaToTarget = parseFloat((newPrice - currentTotal).toFixed(2));

        if (deltaToTarget !== 0) {
            // Prefer adjusting hotels (room total) to keep flight fares intact; otherwise adjust last flight amount
            if (adjustedHotels.length > 0 && adjustedHotels[adjustedHotels.length - 1]?.rooms?.[0]) {
                const lastHotel = adjustedHotels[adjustedHotels.length - 1];
                const room = lastHotel.rooms[0];
                const newTotalPrice = parseFloat(Math.max(0, (room.total_price || 0) + deltaToTarget).toFixed(2));
                room.total_price = newTotalPrice;
            } else if (adjustedFlights.length > 0) {
                const lastFlight = adjustedFlights[adjustedFlights.length - 1];
                const newAmount = parseFloat(Math.max(0, (lastFlight.price?.amount || 0) + deltaToTarget).toFixed(2));
                lastFlight.price = {
                    ...(lastFlight.price || {}),
                    amount: newAmount,
                    currency: analysis.content?.currency || 'USD'
                };
            }
        }

        console.log('📋 Regenerating PDF with adjusted data:', {
            flights: adjustedFlights.length,
            hotels: adjustedHotels.length,
            totalFlightPrice: adjustedFlights.reduce((sum, f) => sum + (f.price?.amount || 0), 0),
            totalHotelPrice: adjustedHotels.reduce((sum, h) => sum + (h.rooms?.[0]?.total_price || 0), 0),
            targetTotal: newPrice
        });

        // Generate the modified PDF using the appropriate service based on content
        console.log('📄 Generating PDF with:', {
            flights: adjustedFlights.length,
            hotels: adjustedHotels.length,
            totalPrice: newPrice
        });

        let pdfResult;

        // Use the appropriate PDF generation service based on content type
        if (adjustedHotels.length > 0) {
            // Combined PDF (flights + hotels)
            console.log('📄 Using combined PDF generation (flights + hotels)');
            pdfResult = await generateCombinedTravelPdf(adjustedFlights, adjustedHotels, undefined, true);
        } else {
            // Flights-only PDF - let generateFlightPdf decide the best template
            console.log('📄 Using flights-only PDF generation with intelligent template selection');
            pdfResult = await generateFlightPdf(adjustedFlights);
        }

        if (pdfResult.success && pdfResult.document_url) {
            console.log('✅ Modified PDF generated successfully:', pdfResult.document_url);
            return {
                success: true,
                pdfUrl: pdfResult.document_url
            };
        } else {
            throw new Error(pdfResult.error || 'Failed to generate PDF');
        }

    } catch (error) {
        console.error('❌ Error generating modified PDF:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Process price change request based on PDF analysis
 */
export async function processPriceChangeRequest(
    request: string,
    analysis: PdfAnalysisResult,
    conversationId: string
): Promise<{ response: string; modifiedPdfUrl?: string }> {
    try {
        console.log('🔄 Processing price change request:', request);
        console.log('📊 Analysis data:', analysis);

        const lowerRequest = request.toLowerCase();

        // Import the extractPriceChangeTarget function
        const { extractPriceChangeTarget, extractRelativeAdjustment } = await import('../features/chat/utils/intentDetection');

        // Detect what type of price change the user wants
        const changeTarget = extractPriceChangeTarget(request);
        console.log('🎯 Price change target detected:', changeTarget);

        // NUEVO: Check for DUAL option price changes (opción 1 AND opción 2 in the same message)
        const dualOptions = extractDualOptionPrices(request);
        if (dualOptions) {
            console.log('💎 [DUAL OPTIONS] Processing dual option price change:', dualOptions);

            // Validate we have 2+ hotels
            if (!analysis.success || !analysis.content ||
                !analysis.content.hotels || analysis.content.hotels.length < 2) {
                return {
                    response: `❌ No puedo modificar ambas opciones porque el PDF no contiene 2 o más hoteles. Esta función solo está disponible para PDFs con múltiples opciones de hotel.`
                };
            }

            // Identify option 1 and option 2 hotels by name
            const option1Hotel = analysis.content.hotels.find((h: any) => h.name.match(/\(Opción\s+1\)/i));
            const option2Hotel = analysis.content.hotels.find((h: any) => h.name.match(/\(Opción\s+2\)/i));

            if (!option1Hotel || !option2Hotel) {
                console.log('❌ [DUAL OPTIONS] Could not identify option 1/2 hotels by name');
                return {
                    response: `❌ No pude identificar las opciones 1 y 2 en el PDF. Verifica que el PDF tenga hoteles con "(Opción 1)" y "(Opción 2)" en el nombre.`
                };
            }

            console.log('🏨 [DUAL OPTIONS] Option 1 hotel:', option1Hotel.name);
            console.log('🏨 [DUAL OPTIONS] Option 2 hotel:', option2Hotel.name);

            // Get original package prices from each option
            // Use packagePrice if available (from extraction), otherwise calculate
            const option1OriginalPrice = (option1Hotel as any).packagePrice || analysis.content.totalPrice || 0;
            const option2OriginalPrice = (option2Hotel as any).packagePrice || analysis.content.totalPrice || 0;

            console.log(`📦 [DUAL OPTIONS] Option 1 original package price: $${option1OriginalPrice}`);
            console.log(`📦 [DUAL OPTIONS] Option 2 original package price: $${option2OriginalPrice}`);

            // Calculate proportional adjustments for each option
            const option1Ratio = dualOptions.option1Price / option1OriginalPrice;
            const option2Ratio = dualOptions.option2Price / option2OriginalPrice;

            console.log(`📊 [DUAL OPTIONS] Option 1: ${option1OriginalPrice} → ${dualOptions.option1Price} (ratio: ${option1Ratio.toFixed(4)})`);
            console.log(`📊 [DUAL OPTIONS] Option 2: ${option2OriginalPrice} → ${dualOptions.option2Price} (ratio: ${option2Ratio.toFixed(4)})`);

            // Create modified analysis with BOTH option prices updated
            const modifiedAnalysis = { ...analysis };
            if (modifiedAnalysis.content) {
                // Clone hotels array and update prices
                modifiedAnalysis.content = {
                    ...modifiedAnalysis.content,
                    hotels: analysis.content.hotels?.map((hotel) => {
                        const isOption1 = hotel.name === option1Hotel.name;
                        const isOption2 = hotel.name === option2Hotel.name;

                        if (isOption1) {
                            // Calculate new hotel price for option 1
                            // If hotel price is 0, it means it's included in package price
                            const newHotelPrice = option1Hotel.price > 0
                                ? option1Hotel.price * option1Ratio
                                : 0;

                            console.log(`🏨 [DUAL] Updating Option 1 hotel: ${hotel.name}`);
                            console.log(`   Package price: $${option1OriginalPrice} → $${dualOptions.option1Price}`);
                            console.log(`   Hotel price: $${hotel.price} → $${newHotelPrice.toFixed(2)}`);

                            return {
                                ...hotel,
                                price: parseFloat(newHotelPrice.toFixed(2)),
                                packagePrice: dualOptions.option1Price, // Update package price
                                _packageMetadata: {
                                    optionNumber: 1,
                                    totalPackagePrice: dualOptions.option1Price,
                                    isModified: true
                                }
                            };
                        } else if (isOption2) {
                            // Calculate new hotel price for option 2
                            const newHotelPrice = option2Hotel.price > 0
                                ? option2Hotel.price * option2Ratio
                                : 0;

                            console.log(`🏨 [DUAL] Updating Option 2 hotel: ${hotel.name}`);
                            console.log(`   Package price: $${option2OriginalPrice} → $${dualOptions.option2Price}`);
                            console.log(`   Hotel price: $${hotel.price} → $${newHotelPrice.toFixed(2)}`);

                            return {
                                ...hotel,
                                price: parseFloat(newHotelPrice.toFixed(2)),
                                packagePrice: dualOptions.option2Price, // Update package price
                                _packageMetadata: {
                                    optionNumber: 2,
                                    totalPackagePrice: dualOptions.option2Price,
                                    isModified: true
                                }
                            };
                        }

                        return hotel;
                    })
                };

                // Update flights to use average price (for template display)
                const flightsPrice = (analysis.content.flights || []).reduce((sum, f) => sum + f.price, 0);
                modifiedAnalysis.content.totalPrice = (dualOptions.option1Price + dualOptions.option2Price) / 2;

                // Also update flights array with proportional pricing
                if (modifiedAnalysis.content.flights) {
                    const avgRatio = ((option1Ratio + option2Ratio) / 2);
                    modifiedAnalysis.content.flights = modifiedAnalysis.content.flights.map((flight: any) => ({
                        ...flight,
                        price: parseFloat((flight.price * avgRatio).toFixed(2))
                    }));
                }
            }

            // Generate single PDF with BOTH modified options
            // We'll use the average price to maintain the template structure
            const avgPrice = (dualOptions.option1Price + dualOptions.option2Price) / 2;
            const result = await generateModifiedPdf(
                modifiedAnalysis,
                avgPrice,
                conversationId
            );

            if (!result.success || !result.pdfUrl) {
                return {
                    response: `❌ **Error generando PDF**\n\nNo pude generar el PDF con ambas opciones modificadas. Error: ${result.error || 'desconocido'}\n\n¿Podrías intentar nuevamente?`
                };
            }

            return {
                response: `✅ **Ambas Opciones Modificadas**\n\n` +
                    `📦 **Opción 1:**\n` +
                    `🏨 Hotel: ${option1Hotel.name}\n` +
                    `💰 Precio total paquete: $${dualOptions.option1Price.toFixed(2)} USD\n` +
                    `   (modificado desde $${option1OriginalPrice.toFixed(2)})\n\n` +
                    `📦 **Opción 2:**\n` +
                    `🏨 Hotel: ${option2Hotel.name}\n` +
                    `💰 Precio total paquete: $${dualOptions.option2Price.toFixed(2)} USD\n` +
                    `   (modificado desde $${option2OriginalPrice.toFixed(2)})\n\n` +
                    `📄 PDF adjunto con ambas opciones actualizadas.`,
                modifiedPdfUrl: result.pdfUrl
            };
        }

        // NUEVO: Check for relative adjustments (sumale, restale, +X%, etc.)
        const relativeAdj = extractRelativeAdjustment(request);
        if (relativeAdj) {
            console.log('📊 Relative adjustment detected:', relativeAdj);

            // Calculate current price based on target
            let currentPrice = analysis.content?.totalPrice || 0;

            if (relativeAdj.target === 'hotel' && analysis.content?.hotels?.[0]) {
                currentPrice = analysis.content.hotels[0].price;
            } else if (relativeAdj.target === 'flights') {
                currentPrice = (analysis.content?.flights || []).reduce((sum, f) => sum + f.price, 0);
            }

            // Calculate new price
            let newPrice: number;
            switch (relativeAdj.operation) {
                case 'add':
                    newPrice = currentPrice + relativeAdj.value;
                    break;
                case 'subtract':
                    newPrice = Math.max(100, currentPrice - relativeAdj.value); // Ensure minimum price
                    break;
                case 'percent_add':
                    newPrice = currentPrice * (1 + relativeAdj.value / 100);
                    break;
                case 'percent_subtract':
                    newPrice = currentPrice * (1 - relativeAdj.value / 100);
                    break;
            }

            console.log(`💰 Relative adjustment: ${currentPrice} → ${newPrice} (${relativeAdj.operation})`);

            // Apply change based on target
            if (relativeAdj.target === 'hotel') {
                const result = await generateModifiedPdfWithHotelPrice(analysis, newPrice, conversationId);

                if (result.success && result.pdfUrl) {
                    return {
                        response: `✅ **Precio del Hotel Modificado**\n\n` +
                            `📊 **Cambio aplicado:**\n` +
                            `• Precio anterior: $${currentPrice.toFixed(2)} USD\n` +
                            `• Precio nuevo: $${newPrice.toFixed(2)} USD\n` +
                            `• Diferencia: ${relativeAdj.operation.includes('add') || relativeAdj.operation === 'percent_add' ? '+' : '-'}$${Math.abs(newPrice - currentPrice).toFixed(2)} USD\n\n` +
                            `💰 **Total actualizado:** $${result.totalPrice.toFixed(2)} USD\n\n` +
                            `📄 PDF adjunto con los cambios.`,
                        modifiedPdfUrl: result.pdfUrl
                    };
                }
            } else {
                // Apply to total or flights
                const result = await generateModifiedPdf(analysis, newPrice, conversationId);

                if (result.success && result.pdfUrl) {
                    return {
                        response: `✅ **Precio Modificado**\n\n` +
                            `📊 **Cambio aplicado:**\n` +
                            `• Precio anterior: $${currentPrice.toFixed(2)} USD\n` +
                            `• Precio nuevo: $${newPrice.toFixed(2)} USD\n` +
                            `• Diferencia: ${relativeAdj.operation.includes('add') || relativeAdj.operation === 'percent_add' ? '+' : '-'}$${Math.abs(newPrice - currentPrice).toFixed(2)} USD\n\n` +
                            `📄 PDF adjunto con los cambios.`,
                        modifiedPdfUrl: result.pdfUrl
                    };
                }
            }
        }

        // NUEVO: Handler para cambios de precio económico/premium (MOVED UP - must execute before extractMultipleHotelPricesFromMessage)
        if (changeTarget === 'economico' || changeTarget === 'premium') {
            console.log(`💰 Processing ${changeTarget} price change`);

            // Validar que hay 2+ hoteles
            if (!analysis.success || !analysis.content ||
                !analysis.content.hotels || analysis.content.hotels.length < 2) {
                const label = changeTarget === 'economico' ? 'Opción 1' : 'Opción 2';
                return {
                    response: `❌ No puedo modificar la ${label} porque el PDF no contiene 2 o más hoteles. Esta opción solo está disponible para PDFs con múltiples opciones de hotel.`
                };
            }

            // Extraer precio solicitado
            const requestedPrice = extractPriceFromMessage(request);
            if (!requestedPrice) {
                const label = changeTarget === 'economico' ? 'Opción 1' : 'Opción 2';
                return {
                    response: `❌ No pude identificar el precio. Por favor especifica un monto, por ejemplo: "cambia la ${label.toLowerCase()} a 2000"`
                };
            }

            // Ordenar hoteles por precio
            const hotelsSortedByPrice = [...analysis.content.hotels].sort((a, b) => a.price - b.price);
            const targetHotel = changeTarget === 'economico'
                ? hotelsSortedByPrice[0]
                : hotelsSortedByPrice[hotelsSortedByPrice.length - 1];

            // Encontrar índice original del hotel
            const targetHotelIndex = analysis.content.hotels.findIndex(h => h.name === targetHotel.name);

            if (targetHotelIndex < 0) {
                const label = changeTarget === 'economico' ? 'Opción 1' : 'Opción 2';
                return {
                    response: `❌ Error interno: no pude identificar el hotel para la ${label}.`
                };
            }

            // NUEVA LÓGICA: Ajustar proporcionalmente TODO el paquete (vuelo + hotel)
            // El precio económico/premium representa el PAQUETE COMPLETO, no solo el hotel

            const flightsPrice = (analysis.content.flights || []).reduce((sum, f) => sum + f.price, 0);
            const originalPackagePrice = flightsPrice + targetHotel.price;

            console.log(`📊 Original package price (${changeTarget}): $${originalPackagePrice} (flights: $${flightsPrice} + hotel: $${targetHotel.price})`);

            // Calcular ratio de ajuste proporcional
            const adjustmentRatio = requestedPrice / originalPackagePrice;
            console.log(`🔧 Adjustment ratio: ${adjustmentRatio.toFixed(4)} (${requestedPrice} / ${originalPackagePrice})`);

            // Calcular nuevos precios proporcionalmente
            const newFlightsPrice = flightsPrice * adjustmentRatio;
            const newHotelPrice = targetHotel.price * adjustmentRatio;

            console.log(`💰 New prices: flights=$${newFlightsPrice.toFixed(2)}, hotel=$${newHotelPrice.toFixed(2)}, total=$${(newFlightsPrice + newHotelPrice).toFixed(2)}`);

            // Generar PDF modificado solo para la opción solicitada
            const optionNumber = changeTarget === 'economico' ? 1 : 2;
            const result = await generateModifiedPdf(
                analysis,
                requestedPrice, // Precio total del paquete
                conversationId,
                optionNumber as 1 | 2 // Solo modificar esta opción
            );

            if (result.success && result.pdfUrl) {
                const label = changeTarget === 'economico' ? 'Opción 1' : 'Opción 2';
                const nights = targetHotel.nights || 7;
                const pricePerNight = (newHotelPrice / nights).toFixed(2);

                return {
                    response: `✅ **${label} Modificada**\n\n` +
                        `📦 **Paquete completo ajustado proporcionalmente:**\n\n` +
                        `✈️ **Nuevo precio:** $${newFlightsPrice.toFixed(2)} USD\n` +
                        `   (ajustado desde $${flightsPrice.toFixed(2)})\n\n` +
                        `🏨 **Hotel (${label}):** ${targetHotel.name}\n` +
                        `📍 **Ubicación:** ${targetHotel.location}\n` +
                        `📄 **TOTAL PAQUETE (${label.toUpperCase()}):** $${requestedPrice.toFixed(2)} USD\n\n` +
                        `Puedes descargar el PDF actualizado desde el archivo adjunto.`,
                    modifiedPdfUrl: result.pdfUrl
                };
            } else {
                const label = changeTarget === 'economico' ? 'Opción 1' : 'Opción 2';
                return {
                    response: `❌ **Error generando PDF**\n\nNo pude generar el PDF con la nueva ${label}. Error: ${result.error || 'desconocido'}\n\n¿Podrías intentar nuevamente?`
                };
            }
        }

        // NUEVO: Check for multiple hotel price changes
        if (analysis.content?.hotels && analysis.content.hotels.length > 0) {
            const multiHotelChanges = extractMultipleHotelPricesFromMessage(
                request,
                analysis.content.hotels
            );

            if (multiHotelChanges.length > 0) {
                console.log('🏨🏨 Multiple hotel price changes:', multiHotelChanges);

                // Validate we have enough hotels
                if (analysis.content.hotels.length < Math.max(...multiHotelChanges.map(c => c.hotelIndex + 1))) {
                    return {
                        response: `❌ No hay suficientes hoteles en el PDF. El PDF contiene ${analysis.content.hotels.length} hotel(es).`
                    };
                }

                // Generate modified PDF with multiple hotel prices
                const result = await generateModifiedPdfWithMultipleHotelPrices(analysis, multiHotelChanges, conversationId);

                if (result.success && result.pdfUrl) {
                    // Build response message
                    const changesDescription = multiHotelChanges.map(change => {
                        const hotel = analysis.content!.hotels![change.hotelIndex];
                        const hotelName = change.hotelName || hotel.name;
                        return `• ${hotelName}: $${change.newPrice.toFixed(2)} USD`;
                    }).join('\n');

                    return {
                        response: `✅ He modificado los precios de los hoteles seleccionados:\n\n${changesDescription}\n\n💰 **Precio Total Actualizado**: $${result.totalPrice.toFixed(2)} USD\n\n📄 Puedes descargar el PDF actualizado desde el archivo adjunto.`,
                        modifiedPdfUrl: result.pdfUrl
                    };
                } else {
                    return {
                        response: `❌ No pude generar el PDF modificado: ${result.error || 'Error desconocido'}`
                    };
                }
            }
        }

        // First, check if user is specifying multiple individual prices
        const multiplePrices = extractMultiplePricesFromMessage(request);

        if (multiplePrices && multiplePrices.length > 0) {
            console.log('💰💰 User requested multiple individual prices:', multiplePrices);

            // Validate that we have PDF analysis with flights
            if (!analysis.success || !analysis.content || !analysis.content.flights || analysis.content.flights.length === 0) {
                return {
                    response: '❌ No puedo modificar precios individuales porque no hay un PDF con vuelos analizados en esta conversación. Por favor, primero envía o arrastra un PDF con cotización de vuelos.'
                };
            }

            // Generate PDF with individual price changes
            const result = await generateModifiedPdfWithIndividualPrices(analysis, multiplePrices, conversationId);

            if (result.success && result.pdfUrl) {
                // Build response message showing pairs
                const changesDescription = multiplePrices.map(pc => {
                    // Get the pair info (each position represents a pair now)
                    const pairIndex = (pc.position - 1) * 2;
                    if (pairIndex < analysis.content!.flights!.length) {
                        const outboundFlight = analysis.content!.flights![pairIndex];
                        return `• Opción ${pc.position} (${outboundFlight.airline}): $${pc.price.toFixed(2)} USD`;
                    }
                    return `• Opción ${pc.position}: $${pc.price.toFixed(2)} USD`;
                }).join('\n');

                // Calculate final total considering pairs
                // The priceChanges array already has the new prices per position (pair)
                // We need to sum all new prices from priceChanges + unchanged pairs from original
                let finalTotal = 0;

                // Count how many pairs we have in the original flights
                const totalPairs = Math.floor((analysis.content!.flights || []).length / 2);

                for (let pairIndex = 1; pairIndex <= totalPairs; pairIndex++) {
                    const priceChange = multiplePrices.find(pc => pc.position === pairIndex);

                    if (priceChange) {
                        // Use the new price specified by user
                        finalTotal += priceChange.price;
                        console.log(`💰 Adding modified price for pair ${pairIndex}: $${priceChange.price}`);
                    } else {
                        // Use original price from flights (sum of outbound + return)
                        const outboundIndex = (pairIndex - 1) * 2;
                        const returnIndex = outboundIndex + 1;
                        const originalFlights = analysis.content!.flights || [];

                        if (returnIndex < originalFlights.length) {
                            const pairOriginalPrice = originalFlights[outboundIndex].price + originalFlights[returnIndex].price;
                            finalTotal += pairOriginalPrice;
                            console.log(`💰 Adding original price for pair ${pairIndex}: $${pairOriginalPrice}`);
                        }
                    }
                }

                return {
                    response: `✅ He modificado los precios de las opciones de vuelo seleccionadas:\n\n${changesDescription}\n\n💰 **Precio Total Actualizado**: $${finalTotal.toFixed(2)} USD\n\n📄 Puedes descargar el PDF actualizado desde el archivo adjunto.`,
                    modifiedPdfUrl: result.pdfUrl
                };
            } else {
                return {
                    response: `❌ No pude generar el PDF modificado: ${result.error || 'Error desconocido'}`
                };
            }
        }

        // If no multiple prices, check for single price change
        const requestedPrice = extractPriceFromMessage(request);

        if (requestedPrice) {
            console.log('💰 User requested specific price:', requestedPrice, 'for target:', changeTarget);

            // Handle hotel-specific price change
            if (changeTarget === 'hotel') {
                console.log('🏨 Processing hotel-specific price change');

                // Validate that we have hotels in the analysis
                if (!analysis.success || !analysis.content || !analysis.content.hotels || analysis.content.hotels.length === 0) {
                    return {
                        response: '❌ No puedo modificar el precio del hotel porque no hay información de hotel en el PDF analizado. Por favor, asegúrate de que el PDF contenga información de hotel.'
                    };
                }

                // Generate modified PDF with new hotel price
                const result = await generateModifiedPdfWithHotelPrice(analysis, requestedPrice, conversationId);

                if (result.success && result.pdfUrl) {
                    const hotel = analysis.content.hotels[0];
                    const nights = hotel.nights || 7;
                    const pricePerNight = (requestedPrice / nights).toFixed(2);

                    return {
                        response: `✅ **Precio del Hotel Modificado**\n\n` +
                            `🏨 **Hotel:** ${hotel.name}\n` +
                            `📍 **Ubicación:** ${hotel.location}\n` +
                            `💰 **Nuevo precio total:** $${requestedPrice.toFixed(2)} USD (${nights} ${nights === 1 ? 'noche' : 'noches'})\n` +
                            `💵 **Precio por noche:** $${pricePerNight} USD\n\n` +
                            `📄 **Precio total del paquete:** $${result.totalPrice.toFixed(2)} USD\n\n` +
                            `Puedes descargar el PDF actualizado desde el archivo adjunto.`,
                        modifiedPdfUrl: result.pdfUrl
                    };
                } else {
                    return {
                        response: `❌ **Error generando PDF modificado**\n\nNo pude generar el PDF con el nuevo precio del hotel de ${requestedPrice}. Error: ${result.error}\n\n¿Podrías intentar nuevamente?`
                    };
                }
            }

            // If we have analysis data, use it; otherwise create a basic analysis
            let effectiveAnalysis = analysis;

            if (!analysis.success || !analysis.content || !analysis.content.totalPrice) {
                console.log('📋 Creating basic analysis from request...');

                // Try to extract some basic info from the original request if available
                const lowerRequest = request.toLowerCase();
                const hasFlight = lowerRequest.includes('vuelo') || lowerRequest.includes('flight');
                const hasHotel = lowerRequest.includes('hotel') || lowerRequest.includes('alojamiento');
                const isCombined = hasFlight && hasHotel;

                // Create realistic flight data
                const flights = [{
                    airline: 'Aerolínea',
                    route: 'Origen - Destino',
                    price: isCombined ? parseFloat((requestedPrice * 0.7).toFixed(2)) : parseFloat(requestedPrice.toFixed(2)),
                    dates: 'Fecha de viaje'
                }];

                // Create hotel data if it's a combined request
                const hotels = isCombined ? [{
                    name: 'Hotel Recomendado',
                    location: 'Destino',
                    price: parseFloat((requestedPrice * 0.3 / 7).toFixed(2)), // Assume 7 nights
                    nights: 7
                }] : [];

                effectiveAnalysis = {
                    success: true,
                    content: {
                        totalPrice: requestedPrice,
                        currency: 'USD',
                        passengers: 1,
                        flights,
                        hotels,
                        extractedFromPdfMonkey: false
                    }
                };
            }

            // Generate modified PDF with the new price
            const pdfResult = await generateModifiedPdf(effectiveAnalysis, requestedPrice, conversationId);

            if (pdfResult.success && pdfResult.pdfUrl) {
                const response = `💰 **Precio Modificado Exitosamente**\n\n` +
                    `📄 He generado un nuevo PDF con tu precio solicitado:\n\n` +
                    `• **Precio solicitado:** ${requestedPrice.toLocaleString()} ${effectiveAnalysis.content?.currency || 'USD'}\n` +
                    `• **Pasajeros:** ${effectiveAnalysis.content?.passengers || 1}`;

                return {
                    response,
                    modifiedPdfUrl: pdfResult.pdfUrl
                };
            } else {
                return {
                    response: `❌ **Error generando PDF modificado**\n\nNo pude generar el PDF con el nuevo precio de ${requestedPrice}. Error: ${pdfResult.error}\n\n¿Podrías intentar nuevamente?`
                };
            }
        }

        // Handle other types of requests (existing functionality)
        if (lowerRequest.includes('más barato') || lowerRequest.includes('menor precio')) {
            return {
                response: `🔍 **Buscando opciones más económicas...**\n\nHe encontrado las siguientes alternativas:\n\n✈️ **Vuelos más baratos:**\n• Copa Airlines: EZE → PTY → PUJ - $645 USD (ahorro: $80)\n• JetBlue: EZE → FLL → PUJ - $689 USD (ahorro: $36)\n\n🏨 **Hoteles más económicos:**\n• Hotel Marien Puerto Playa: $32/noche (ahorro: $13/noche)\n• Casa Colonial Beach & Spa: $38/noche (ahorro: $7/noche)\n\n💰 **Nuevo total estimado:** $1,180 USD (ahorro: $175)\n\n¿Te interesan estas opciones? O si tienes un precio específico en mente, dímelo y genero un PDF con ese precio exacto.`
            };
        }

        if (lowerRequest.includes('fecha') || lowerRequest.includes('cambiar')) {
            return {
                response: `📅 **Opciones con fechas flexibles:**\n\nSi cambias las fechas, puedo conseguir mejores precios:\n\n• **Noviembre 8-22:** $1,245 USD (ahorro: $110)\n• **Noviembre 15-29:** $1,189 USD (ahorro: $166)\n• **Diciembre 1-15:** $1,425 USD (+$70)\n\n¿Cuáles fechas prefieres? O si tienes un precio objetivo, puedo generar un PDF con ese precio específico.`
            };
        }

        if (lowerRequest.includes('hotel') && lowerRequest.includes('estrella')) {
            return {
                response: `⭐ **Opciones de hoteles por categoría:**\n\n🏨 **4 Estrellas:**\n• Iberostar Selection Bávaro: $55/noche\n• Dreams Macao Beach: $48/noche\n\n🏨 **3 Estrellas:**\n• Tropical Princess Beach: $35/noche\n• Be Live Collection Marien: $42/noche\n\n¿Qué categoría prefieres? También puedes decirme un precio específico y genero un PDF con ese monto.`
            };
        }

        // Default response with price modification hint
        return {
            response: `🤔 **Entendido tu solicitud**\n\nPuedo ayudarte de varias maneras:\n\n💰 **Cambio de precio específico:**\n• Dime: "Cambia el precio total a $1200" o "Quiero que cueste $800"\n• Generaré un nuevo PDF con el precio exacto que solicites\n\n🔍 **Búsqueda de alternativas:**\n• ¿Qué aspecto quieres cambiar? (vuelos, hoteles, fechas)\n• ¿Tienes un presupuesto específico en mente?\n• ¿Las fechas son flexibles?\n\n**Ejemplo:** "Cambia el precio total a $1100 USD" y te genero el PDF modificado inmediatamente.`
        };

    } catch (error) {
        console.error('Error processing price change request:', error);
        return {
            response: `❌ Hubo un error procesando tu solicitud. ¿Podrías intentarlo nuevamente con más detalles?`
        };
    }
}

/**
 * Search for cheaper flight alternatives based on PDF analysis
 */
export async function searchCheaperFlights(pdfAnalysis: PdfAnalysisResult): Promise<CheaperFlightSearchResult> {
    try {
        console.log('🔍 Starting cheaper flight search from PDF analysis');

        if (!pdfAnalysis.success || !pdfAnalysis.content?.flights) {
            return {
                success: false,
                error: 'No flight information found in PDF analysis'
            };
        }

        const originalFlights = pdfAnalysis.content.flights;
        console.log('✈️ Original flights from PDF:', originalFlights);

        // Extract search parameters from the first flight
        const firstFlight = originalFlights[0];
        if (!firstFlight) {
            return {
                success: false,
                error: 'No flight data available'
            };
        }

        // Parse route to get origin and destination
        const { origin, destination } = parseFlightRoute(firstFlight.route);
        if (!origin || !destination) {
            return {
                success: false,
                error: 'Could not parse flight route from PDF'
            };
        }

        // Parse dates (assuming format from PDF)
        const dateRange = firstFlight.dates;
        const dates = dateRange.split(' - ');
        const departureDate = parseDate(dates[0]);
        const returnDate = dates.length > 1 ? parseDate(dates[1]) : undefined;

        const searchParams: AirfareSearchParams = {
            origin,
            destination,
            departureDate,
            returnDate,
            adults: pdfAnalysis.content.passengers || 1,
            children: 0
        };

        console.log('🔍 Searching with parameters:', searchParams);

        // Convert to Starling format for flight search
        const starlingRequest = formatParsedDataForStarling({
            requestType: 'flights',
            flights: {
                origin,
                destination,
                departureDate,
                returnDate,
                adults: searchParams.adults || 1,
                children: searchParams.children || 0
            }
        } as any);

        console.log('🔍 Starling request format:', starlingRequest);

        // Search for alternative flights using Starling API
        const alternativeFlights = await searchFlightsWithStarling(starlingRequest);

        if (alternativeFlights.length === 0) {
            return {
                success: true,
                originalFlights,
                alternativeFlights: [],
                message: 'No se encontraron vuelos alternativos para estas fechas y destino.'
            };
        }

        // Calculate potential savings
        const originalTotalPrice = originalFlights.reduce((sum, flight) => sum + flight.price, 0);
        const cheapestAlternative = alternativeFlights.reduce((cheapest, current) =>
            (current.price?.amount || 0) < (cheapest.price?.amount || 0) ? current : cheapest
        );

        const potentialSavings = originalTotalPrice - (cheapestAlternative.price?.amount || 0);

        console.log('💰 Price comparison:', {
            original: originalTotalPrice,
            cheapest: cheapestAlternative.price?.amount,
            savings: potentialSavings
        });

        return {
            success: true,
            originalFlights,
            alternativeFlights,
            savings: potentialSavings > 0 ? potentialSavings : 0,
            message: potentialSavings > 0
                ? `¡Encontré opciones más baratas! Puedes ahorrar hasta $${potentialSavings.toFixed(2)} USD`
                : 'Los precios del PDF son competitivos, pero aquí tienes más opciones disponibles.'
        };

    } catch (error) {
        console.error('❌ Error searching for cheaper flights:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error searching for alternative flights'
        };
    }
}

/**
 * Helper function to parse date from PDF text
 */
function parseDate(dateStr: string): string {
    try {
        // Handle different date formats from PDF
        dateStr = dateStr.trim();

        // If already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }

        // Handle DD/MM/YYYY format
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Handle DD-MM-YYYY format
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('-');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Handle text dates like "15 Nov 2024"
        const months = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
            'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
            'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };

        const dateMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
        if (dateMatch) {
            const [, day, monthName, year] = dateMatch;
            const monthNum = months[monthName.toLowerCase().substring(0, 3)];
            if (monthNum) {
                return `${year}-${monthNum}-${day.padStart(2, '0')}`;
            }
        }

        // Fallback: use current date + 7 days
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + 7);
        return fallbackDate.toISOString().split('T')[0];

    } catch (error) {
        console.warn('Could not parse date:', dateStr, error);
        // Return date 7 days from now as fallback
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + 7);
        return fallbackDate.toISOString().split('T')[0];
    }
}

/**
 * Parse extracted PDF text to find travel information
 */
function parseExtractedTravelData(text: string): PdfAnalysisResult['content'] {
    console.log('🔍 Parsing extracted PDF text for travel data');
    console.log('📄 Full text to analyze:', text);

    const flights = extractFlightInfo(text);
    const hotels = extractHotelInfo(text);
    const totalPrice = extractTotalPrice(text);
    const passengers = extractPassengerCount(text);
    const currency = extractCurrency(text);

    console.log('📊 Extracted data summary:', {
        flights: flights.length,
        hotels: hotels.length,
        totalPrice,
        passengers,
        currency
    });

    return {
        flights,
        hotels,
        totalPrice,
        currency,
        passengers,
        extractedFromPdfMonkey: false
    };
}

/**
 * Extract flight information from PDF text with detailed parsing
 */
function extractFlightInfo(text: string): Array<{
    airline: string,
    route: string,
    price: number,
    dates: string,
    departureTime?: string,
    arrivalTime?: string,
    originCode?: string,
    destinationCode?: string,
    originCity?: string,
    destinationCity?: string,
    legs?: Array<{
        from: string,
        to: string,
        departureTime?: string,
        arrivalTime?: string,
        flightNumber?: string
    }>
}> {
    const flights: Array<{
        airline: string,
        route: string,
        price: number,
        dates: string,
        departureTime?: string,
        arrivalTime?: string,
        originCode?: string,
        destinationCode?: string,
        originCity?: string,
        destinationCity?: string,
        legs?: Array<{
            from: string,
            to: string,
            departureTime?: string,
            arrivalTime?: string,
            flightNumber?: string
        }>
    }> = [];

    // Enhanced patterns for detailed flight information
    const airlinePatterns = [
        /(?:LATAM|Aerolíneas Argentinas|American Airlines|United|Delta|Air France|Iberia|AVIANCA|JetSmart|Flybondi|Copa Airlines|LAN|TAM|Avianca|Iberia|Air France|British Airways|Lufthansa|KLM|Alitalia|Swiss|Austrian)/gi,
        /(?:AA|UA|DL|AF|IB|AV|LAN|TAM|CM|BA|LH|KL|AZ|LX|OS)/gi
    ];

    // Enhanced patterns for routes with more detail
    const routePatterns = [
        /([A-Z]{3})\s*[-–→→→]\s*([A-Z]{3})/g, // EZE - MIA
        /([A-Z]{3})\s*[-–→→→]\s*([A-Z]{3})\s*[-–→→→]\s*([A-Z]{3})/g, // EZE - MIA - PUJ
        /(Buenos Aires|Madrid|Barcelona|Miami|Punta Cana|Cancún|Nueva York|London|Paris|Rome|Amsterdam|Frankfurt|São Paulo|Río de Janeiro|Lima|Bogotá|Santiago|México|Toronto|Montreal)\s*[-–→→→]\s*(Buenos Aires|Madrid|Barcelona|Miami|Punta Cana|Cancún|Nueva York|London|Paris|Rome|Amsterdam|Frankfurt|São Paulo|Río de Janeiro|Lima|Bogotá|Santiago|México|Toronto|Montreal)/gi,

        // Airport code patterns with city names
        /(Ezeiza|Jorge Newbery|Aeroparque|Barajas|El Prat|Miami International|Punta Cana International|Cancún International|John F\. Kennedy|LaGuardia|Newark|Heathrow|Gatwick|Charles de Gaulle|Orly|Fiumicino|Ciampino|Schiphol|Frankfurt|Zurich|Vienna|Guarulhos|Galeão|Jorge Chávez|El Dorado|Arturo Merino Benítez|Benito Juárez|Pearson|Trudeau)/gi
    ];

    // Enhanced patterns for dates
    const datePatterns = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/g, // DD/MM/YYYY - DD/MM/YYYY
        /(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})/gi,
        /(\d{4})-(\d{2})-(\d{2})\s*[-–]\s*(\d{4})-(\d{2})-(\d{2})/g // YYYY-MM-DD - YYYY-MM-DD
    ];

    // Patterns for flight times
    const timePatterns = [
        /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g, // 07:35 - 17:35
        /(?:salida|departure|dep).*?(\d{1,2}):(\d{2})/gi,
        /(?:llegada|arrival|arr).*?(\d{1,2}):(\d{2})/gi,
        /(\d{1,2}):(\d{2})\s*(?:AM|PM|am|pm)?/g // General time pattern
    ];

    // Patterns for flight numbers
    const flightNumberPatterns = [
        /(?:vuelo|flight|voo)\s*(?:n[oº°]?\.?\s*)?([A-Z]{2}\d{2,4})/gi,
        /([A-Z]{2}\s?\d{2,4})/g // AA 1234 or AA1234
    ];

    // Enhanced patterns for prices with flexible number formats
    const pricePatterns = [
        /(?:USD|US\$|\$)\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*(?:USD|US\$|\$)/gi
    ];

    // Extract airlines
    const airlines = [];
    for (const pattern of airlinePatterns) {
        const matches = [...text.matchAll(pattern)];
        airlines.push(...matches.map(m => m[0]));
    }

    // Extract routes with detailed parsing
    const routes = [];
    const routeDetails = [];
    for (const pattern of routePatterns) {
        const matches = [...text.matchAll(pattern)];
        routes.push(...matches.map(m => m[0]));

        // Parse route details for origin/destination
        matches.forEach(match => {
            if (match.length >= 3) {
                // Route with connection: EZE - MIA - PUJ
                const origin = match[1];
                const destination = match[3] || match[2];
                const connection = match[3] ? match[2] : null;
                routeDetails.push({ origin, destination, connection, fullRoute: match[0] });
            } else if (match.length >= 2) {
                // Direct route: EZE - PUJ
                routeDetails.push({
                    origin: match[1],
                    destination: match[2],
                    connection: null,
                    fullRoute: match[0]
                });
            }
        });
    }

    // Extract dates
    const dates = [];
    for (const pattern of datePatterns) {
        const matches = [...text.matchAll(pattern)];
        dates.push(...matches.map(m => m[0]));
    }

    // Extract flight times
    const times = [];
    const departureTime = [];
    const arrivalTimes = [];
    for (const pattern of timePatterns) {
        const matches = [...text.matchAll(pattern)];
        times.push(...matches.map(m => m[0]));

        // Try to separate departure and arrival times
        matches.forEach(match => {
            if (match.length >= 4) {
                // Time range: 07:35 - 17:35
                departureTime.push(`${match[1]}:${match[2]}`);
                arrivalTimes.push(`${match[3]}:${match[4]}`);
            } else if (match.length >= 3) {
                // Single time
                times.push(`${match[1]}:${match[2]}`);
            }
        });
    }

    // Extract flight numbers
    const flightNumbers = [];
    for (const pattern of flightNumberPatterns) {
        const matches = [...text.matchAll(pattern)];
        flightNumbers.push(...matches.map(m => m[1] || m[0]));
    }

    // Extract prices using smart parser
    const prices = [];
    for (const pattern of pricePatterns) {
        const matches = [...text.matchAll(pattern)];
        prices.push(...matches.map(m => {
            const priceStr = m[1] || m[0];
            const price = parsePrice(priceStr);
            console.log(`💰 [FLIGHT INFO PARSE] "${priceStr}" → ${price}`);
            return price;
        }));
    }

    // Combine extracted information with enhanced details
    const maxEntries = Math.max(airlines.length, routes.length, dates.length, prices.length, 1);

    for (let i = 0; i < maxEntries; i++) {
        const routeDetail = routeDetails[i];
        const flight = {
            airline: resolveAirlineName(airlines[i]),
            route: routes[i] || 'Ruta no especificada',
            price: prices[i] || 0,
            dates: dates[i] || 'Fechas no especificadas',
            departureTime: departureTime[i],
            arrivalTime: arrivalTimes[i],
            originCode: routeDetail?.origin,
            destinationCode: routeDetail?.destination,
            originCity: mapCodeToCity(routeDetail?.origin || ''),
            destinationCity: mapCodeToCity(routeDetail?.destination || ''),
            legs: []
        };

        // Create legs based on route details
        if (routeDetail) {
            // Outbound leg
            flight.legs.push({
                from: routeDetail.origin,
                to: routeDetail.connection || routeDetail.destination,
                departureTime: departureTime[i * 2],
                arrivalTime: arrivalTimes[i * 2],
                flightNumber: flightNumbers[i * 2]
            });

            // If there's a connection, add second leg
            if (routeDetail.connection) {
                flight.legs.push({
                    from: routeDetail.connection,
                    to: routeDetail.destination,
                    departureTime: departureTime[i * 2 + 1],
                    arrivalTime: arrivalTimes[i * 2 + 1],
                    flightNumber: flightNumbers[i * 2 + 1]
                });
            }

            // For round trip, create return legs (reverse the outbound)
            if (dates[i] && dates[i].includes('-') || dates[i].includes('/')) {
                // Return leg (reverse)
                flight.legs.push({
                    from: routeDetail.destination,
                    to: routeDetail.connection || routeDetail.origin,
                    departureTime: departureTime[i * 2 + 2],
                    arrivalTime: arrivalTimes[i * 2 + 2],
                    flightNumber: flightNumbers[i * 2 + 2]
                });

                // If there was a connection on outbound, add connection on return
                if (routeDetail.connection) {
                    flight.legs.push({
                        from: routeDetail.connection,
                        to: routeDetail.origin,
                        departureTime: departureTime[i * 2 + 3],
                        arrivalTime: arrivalTimes[i * 2 + 3],
                        flightNumber: flightNumbers[i * 2 + 3]
                    });
                }
            }
        }

        flights.push(flight);
    }

    console.log('✈️ Extracted flights:', flights);
    return flights.slice(0, 3); // Limit to 3 flights max
}

/**
 * Extract hotel information from PDF text
 */
function extractHotelInfo(text: string): Array<{ name: string, location: string, price: number, nights: number }> {
    const hotels: Array<{ name: string, location: string, price: number, nights: number }> = [];

    // Patterns for hotel names
    const hotelPatterns = [
        /(?:Hotel|Resort|Aparthotel|Inn|Lodge|Suites?)\s+([A-Za-z\s]+)/gi,
        /([A-Za-z\s]+)\s+(?:Hotel|Resort|Aparthotel|Inn|Lodge|Suites?)/gi
    ];

    // Patterns for locations/cities
    const locationPatterns = [
        /(Punta Cana|Cancún|Miami|Madrid|Barcelona|Buenos Aires|Río de Janeiro|São Paulo)/gi,
        /(?:en|in)\s+([A-Za-z\s]+)/gi
    ];

    // Patterns for nightly rates and nights
    const nightlyRatePatterns = [
        /(\d+)\s*(?:USD|US\$|\$)\s*(?:por noche|per night|\/night)/gi,
        /(?:por noche|per night|\/night)\s*(\d+)\s*(?:USD|US\$|\$)/gi
    ];

    const nightsPatterns = [
        /(\d+)\s*(?:noches?|nights?)/gi,
        /(?:noches?|nights?)\s*(\d+)/gi
    ];

    // Extract hotel names
    const hotelNames = [];
    for (const pattern of hotelPatterns) {
        const matches = [...text.matchAll(pattern)];
        hotelNames.push(...matches.map(m => m[1]?.trim()).filter(Boolean));
    }

    // Extract locations
    const locations = [];
    for (const pattern of locationPatterns) {
        const matches = [...text.matchAll(pattern)];
        locations.push(...matches.map(m => m[1]?.trim()).filter(Boolean));
    }

    // Extract nightly rates
    const nightlyRates = [];
    for (const pattern of nightlyRatePatterns) {
        const matches = [...text.matchAll(pattern)];
        nightlyRates.push(...matches.map(m => parseFloat(m[1])));
    }

    // Extract nights
    const nightsArray = [];
    for (const pattern of nightsPatterns) {
        const matches = [...text.matchAll(pattern)];
        nightsArray.push(...matches.map(m => parseInt(m[1])));
    }

    // Combine extracted information
    const maxEntries = Math.max(hotelNames.length, locations.length, nightlyRates.length, nightsArray.length, 1);

    for (let i = 0; i < maxEntries; i++) {
        hotels.push({
            name: hotelNames[i] || 'Hotel no especificado',
            location: locations[i] || 'Ubicación no especificada',
            price: nightlyRates[i] || 0,
            nights: nightsArray[i] || 0
        });
    }

    console.log('🏨 Extracted hotels:', hotels);
    return hotels.slice(0, 3); // Limit to 3 hotels max
}

/**
 * Extract total price from PDF text
 */
function extractTotalPrice(text: string): number {
    console.log('💰 Searching for total price in text...');

    // Enhanced patterns for total price extraction with flexible number formats
    const totalPatterns = [
        // Spanish patterns
        /(?:total|precio total|total price|grand total|total general|precio final|monto total|importe total)\s*:?\s*(?:USD|US\$|\$)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /(?:USD|US\$|\$)\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*(?:total|precio total|total price|grand total)/gi,

        // Direct price patterns
        /\$\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*(?:USD|usd)?/gi,
        /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*(?:USD|US\$|\$)/gi,

        // Price at end of line or paragraph
        /(?:precio|price|total|costo|cost)\s*:?\s*\$?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,

        // Currency patterns
        /(?:USD|US\$|\$)\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi
    ];

    let bestMatch = { price: 0, confidence: 0 };

    for (const pattern of totalPatterns) {
        const matches = [...text.matchAll(pattern)];
        console.log(`💰 Pattern "${pattern.source}" found ${matches.length} matches`);

        for (const match of matches) {
            const priceStr = match[1] || match[0];
            const price = parsePrice(priceStr);

            if (!isNaN(price) && price > 0 && price < 50000) { // Reasonable price range
                console.log(`💰 [EXTERNAL PDF PARSE] "${priceStr}" → ${price} from match: "${match[0]}"`);

                // Higher confidence for "total" keywords
                const confidence = match[0].toLowerCase().includes('total') ? 2 : 1;

                if (confidence > bestMatch.confidence || (confidence === bestMatch.confidence && price > bestMatch.price)) {
                    bestMatch = { price, confidence };
                }
            }
        }
    }

    if (bestMatch.price > 0) {
        console.log('💰 Final extracted total price:', bestMatch.price, 'confidence:', bestMatch.confidence);
        return bestMatch.price;
    }

    console.log('💰 No total price found');
    return 0;
}

/**
 * Extract passenger count from PDF text
 */
function extractPassengerCount(text: string): number {
    const passengerPatterns = [
        /(\d+)\s*(?:pasajeros?|passengers?|adultos?|adults?|personas?|people)/gi,
        /(?:pasajeros?|passengers?|adultos?|adults?|personas?|people)\s*:?\s*(\d+)/gi
    ];

    for (const pattern of passengerPatterns) {
        const match = text.match(pattern);
        if (match) {
            const count = parseInt(match[1]);
            if (!isNaN(count) && count > 0) {
                console.log('👥 Extracted passenger count:', count);
                return count;
            }
        }
    }

    console.log('👥 No passenger count found, defaulting to 1');
    return 1;
}

/**
 * Extract currency from PDF text
 */
function extractCurrency(text: string): string {
    const currencyPatterns = [
        /\b(USD|US\$|EUR|ARS|BRL)\b/gi,
        /\$([\d,]+(?:\.\d{2})?)/g
    ];

    for (const pattern of currencyPatterns) {
        const match = text.match(pattern);
        if (match) {
            const currency = match[1]?.toUpperCase() || 'USD';
            console.log('💱 Extracted currency:', currency);
            return currency === 'US$' ? 'USD' : currency;
        }
    }

    console.log('💱 No currency found, defaulting to USD');
    return 'USD';
}

/**
 * Parse flight route string to extract origin and destination
 */
function parseFlightRoute(route: string): { origin: string; destination: string } {
    console.log('🛫 Parsing route:', route);

    // Remove common separators and clean the route
    const cleanRoute = route.replace(/[→–-]/g, '-').trim();

    // Pattern 1: EZE - MIA - PUJ (with connection)
    const connectionMatch = cleanRoute.match(/([A-Z]{3})\s*-\s*[A-Z]{3}\s*-\s*([A-Z]{3})/);
    if (connectionMatch) {
        return {
            origin: connectionMatch[1],
            destination: connectionMatch[2]
        };
    }

    // Pattern 2: EZE - PUJ (direct)
    const directMatch = cleanRoute.match(/([A-Z]{3})\s*-\s*([A-Z]{3})/);
    if (directMatch) {
        return {
            origin: directMatch[1],
            destination: directMatch[2]
        };
    }

    // Pattern 3: City names
    const cityMatch = cleanRoute.match(/(Buenos Aires|Madrid|Barcelona|Miami|Punta Cana|Cancún|Nueva York)\s*-\s*(Buenos Aires|Madrid|Barcelona|Miami|Punta Cana|Cancún|Nueva York)/i);
    if (cityMatch) {
        return {
            origin: mapCityToCode(cityMatch[1]),
            destination: mapCityToCode(cityMatch[2])
        };
    }

    console.warn('⚠️ Could not parse route:', route);
    return { origin: '', destination: '' };
}

/**
 * Map city names to airport codes
 */
function mapCityToCode(cityName: string): string {
    const cityMap: Record<string, string> = {
        'Buenos Aires': 'EZE',
        'Ezeiza': 'EZE',
        'Jorge Newbery': 'AEP',
        'Aeroparque': 'AEP',
        'Madrid': 'MAD',
        'Barcelona': 'BCN',
        'Miami': 'MIA',
        'Punta Cana': 'PUJ',
        'Cancún': 'CUN',
        'Nueva York': 'JFK'
    };

    return cityMap[cityName] || cityName;
}

/**
 * Map airport codes to city names
 */
function mapCodeToCity(airportCode: string): string {
    const codeMap: Record<string, string> = {
        'BUE': 'Buenos Aires',
        'EZE': 'Buenos Aires',
        'AEP': 'Buenos Aires',
        'MAD': 'Madrid',
        'BCN': 'Barcelona',
        'MIA': 'Miami',
        'PUJ': 'Punta Cana',
        'CUN': 'Cancún',
        'JFK': 'Nueva York',
        'LGA': 'Nueva York',
        'EWR': 'Nueva York',
        'PTY': 'Ciudad de Panamá',
        'FLL': 'Fort Lauderdale',
        'BOG': 'Bogotá',
        'LIM': 'Lima',
        'SCL': 'Santiago',
        'GRU': 'São Paulo',
        'GIG': 'Río de Janeiro'
    };

    return codeMap[airportCode] || airportCode;
}

/**
 * Parse date range from PDF text (e.g., "01/11/2025 - 15/11/2025")
 */
function parseDateRange(dateString: string): { departureDate: string; returnDate?: string } {
    if (!dateString) {
        return { departureDate: '2025-11-01' };
    }

    // Handle different separators
    const separators = [' - ', ' / ', ' – ', ' — ', ' to ', ' al '];
    let dates: string[] = [dateString];

    for (const separator of separators) {
        if (dateString.includes(separator)) {
            dates = dateString.split(separator);
            break;
        }
    }

    const departureDate = parseDate(dates[0]?.trim() || '');
    const returnDate = dates.length > 1 ? parseDate(dates[1]?.trim() || '') : undefined;

    return {
        departureDate,
        returnDate
    };
}

/**
 * Extract airline code from airline name
 */
function extractAirlineCode(airlineName: string): string {
    const airlineCodes: Record<string, string> = {
        'American Airlines': 'AA',
        'United Airlines': 'UA',
        'Delta Air Lines': 'DL',
        'LATAM': 'LA',
        'Aerolíneas Argentinas': 'AR',
        'Copa Airlines': 'CM',
        'Avianca': 'AV',
        'Air France': 'AF',
        'Iberia': 'IB',
        'JetSmart': 'JA',
        'Flybondi': 'FO'
    };

    // First try exact match
    if (airlineCodes[airlineName]) {
        return airlineCodes[airlineName];
    }

    // Try partial match
    for (const [name, code] of Object.entries(airlineCodes)) {
        if (airlineName.toLowerCase().includes(name.toLowerCase())) {
            return code;
        }
    }

    // If already looks like a code (2-3 uppercase letters), return it
    if (/^[A-Z]{2,3}$/.test(airlineName)) {
        return airlineName;
    }

    // Fallback: take first 2 letters and uppercase
    return airlineName.substring(0, 2).toUpperCase();
}

/**
 * Calculate flight duration between two times
 */
function calculateFlightDuration(departureTime?: string, arrivalTime?: string): string | null {
    if (!departureTime || !arrivalTime) return null;

    try {
        // Parse times (assuming same day for simplicity)
        const [depHour, depMin] = departureTime.split(':').map(Number);
        const [arrHour, arrMin] = arrivalTime.split(':').map(Number);

        let depMinutes = depHour * 60 + depMin;
        let arrMinutes = arrHour * 60 + arrMin;

        // Handle next day arrival
        if (arrMinutes < depMinutes) {
            arrMinutes += 24 * 60;
        }

        const durationMinutes = arrMinutes - depMinutes;
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;

        return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    } catch {
        return null;
    }
}

/**
 * Extract flight information from PdfMonkey template content
 */
function extractFlightsFromPdfMonkeyTemplate(content: string): Array<{
    airline: string,
    route: string,
    price: number,
    dates: string,
    departureTime?: string,
    arrivalTime?: string,
    originCode?: string,
    destinationCode?: string,
    originCity?: string,
    destinationCity?: string,
    legs?: Array<{
        departure: { city_code: string, city_name: string, time: string },
        arrival: { city_code: string, city_name: string, time: string },
        duration: string,
        flight_type: string,
        airline?: string,
        price?: number,
        layovers?: Array<{
            destination_city: string,
            destination_code: string,
            waiting_time: string
        }>
    }>
}> {
    const flights = [];

    // Helper function to extract airline name from section content
    const extractAirlineName = (sectionContent: string): string => {
        console.log('🔍 [AIRLINE EXTRACTION] Starting airline extraction...');

        const airlinePatterns = [
            // Pattern 0: "✈Vuelos [CODE] [FULL NAME]" format (HIGHEST PRIORITY - extracts name from PDF as-is)
            // Stops before Title Case words (Buenos), airport codes (EZE), or lowercase words (outbound)
            /✈?\s*[Vv]uelos\s+([A-Z0-9]{2,3})\s+([A-Z][A-Za-z\s\.]+?)(?=\s+[A-Z][a-z]+|\s+[a-z]+|$)/m,
            // Pattern 1: DETALLE DEL VUELO followed by code + name (most specific)
            /DETALLE\s+DEL\s+VUELO\s+([A-Z]{2,3})\s+([A-Z][A-Za-z\sñÑáéíóúÁÉÍÓÚ\.]+?)(?:\s+Ocupación)/i,
            // Pattern 2: Code + name just before Ocupación
            /\n\s*([A-Z]{2,3})\s+([A-Z][A-Za-z\sñÑáéíóúÁÉÍÓÚ\.]+?)\s+Ocupación/i,
            // Pattern 3: After DETALLE with any spacing until Ocupación
            /DETALLE\s+DEL\s+VUELO[^\n]*\n\s*([A-Z]{2,3})\s+([A-Za-z\sñÑáéíóúÁÉÍÓÚ\.]+?)\s+Ocupación/im,
            // Pattern 4: Fallback - look for airline code followed by capitalized name near start
            /^[^\n]{0,200}?([A-Z]{2,3})\s+([A-Z][A-Za-z\s]+)(?:\s+Ocupación|\s+\d+\s+adultos)/im,

            // ========== EXTENDED PATTERNS (added for complex airline names) ==========
            // Pattern 5: Code + name with corporate suffixes (S.A., INC., LTD., CORP.) before "Ocupación:"
            // Handles: "AV AVIANCA ECUADOR S.A. Ocupación:"
            /([A-Z]{2,3})\s+([A-Z][A-Z\s\.]+?(?:S\.A\.|INC\.|LTD\.|CORP\.|GROUP)?)\s+Ocupación:/i,

            // Pattern 6: Code + extended name with special chars (dots, commas, parentheses) before "Ocupación:" or "Ocupación"
            // Handles: "AV AVIANCA ECUADOR S.A. Ocupación:" or "LA LATAM AIRLINES GROUP Ocupación"
            /([A-Z]{2,3})\s+([A-Z][A-Za-z\s\.\(\),&-]+?)\s+Ocupación[:]/i,

            // Pattern 7: Code + very permissive name capture until "Ocupación:" (last resort for complex formats)
            // Captures any uppercase text after code until "Ocupación:" appears
            // Handles: "Y4 VOLARIS AIRLINES, S.A. DE C.V. Ocupación:"
            /([A-Z]{2,3})\s+([A-Z][^\n\r]+?)\s+Ocupación[:]/i,

            // Pattern 8: Code + name without newline requirement (more flexible than Pattern 2)
            // Handles cases where there's no \n before the code
            /([A-Z]{2,3})\s+([A-Z][A-Za-z\sñÑáéíóúÁÉÍÓÚ\.]+?)\s+Ocupación/i,
        ];

        for (let i = 0; i < airlinePatterns.length; i++) {
            const match = sectionContent.match(airlinePatterns[i]);
            if (match) {
                console.log(`✅ [AIRLINE EXTRACTION] Pattern ${i + 1} matched`);
                // For patterns with two capture groups, combine code and name
                if (match[2]) {
                    const code = match[1].trim();
                    const name = match[2].trim();

                    // Pattern 0 (Vuelos format): Return ONLY the name as-is from PDF
                    if (i === 0) {
                        console.log(`✅ [AIRLINE EXTRACTION] Found from "Vuelos" format: "${name}"`);
                        return name;
                    }

                    // Other patterns: Combine code + name
                    const fullName = `${code} ${name}`;
                    console.log(`✅ [AIRLINE EXTRACTION] Found: "${fullName}"`);
                    return fullName;
                } else if (match[1]) {
                    const code = match[1].trim();
                    console.log(`✅ [AIRLINE EXTRACTION] Found (code only): "${code}"`);
                    // Try to resolve the code to a full name
                    const resolved = resolveAirlineName(code);
                    console.log(`✅ [AIRLINE EXTRACTION] Resolved to: "${resolved}"`);
                    return resolved;
                }
            } else {
                console.log(`❌ [AIRLINE EXTRACTION] Pattern ${i + 1} did not match`);
            }
        }

        console.warn('⚠️ [AIRLINE EXTRACTION] No patterns matched, returning default');
        return resolveAirlineName(undefined);
    };

    // Extract all airport codes and times from the content
    // Pattern should capture: CODE CityName TIME
    const airportPattern = /([A-Z]{3})\s+([A-Za-zÀ-ÿ\s]+?)\s+(\d{1,2}:\d{2})/g;
    const airportMatches = [...content.matchAll(airportPattern)];

    console.log('🔍 Found airport matches:', airportMatches.map(m => ({
        code: m[1],
        city: m[2].trim(),
        time: m[3]
    })));

    // Extract layover information
    // Flexible regex: (.+?) captures both IATA codes (PTY, ATL) and city names (Bogotá, Ciudad de Panamá)
    // The non-greedy .+? stops at "Tiempo de espera", ensuring correct capture for all formats
    const layoverPattern = /Escala en (.+?)\s+Tiempo de espera:\s*(\d+h\s*\d*m?)\s+en\s+([A-Z]{3})\s*\(([^)]+)\)/g;
    const layoverMatches = [...content.matchAll(layoverPattern)];

    console.log('🔍 Found layover matches:', layoverMatches.map(m => ({
        city: m[1].trim(),
        waiting_time: m[2].trim(),
        code: m[3],
        full_city: m[4].trim()
    })));

    // Build flight legs with layovers
    const legs = [];
    let originCode = '';
    let destinationCode = '';
    let departureTime = '';
    let arrivalTime = '';

    // Check if this is a round trip (ida y vuelta)
    const hasOutbound = /Vuelo de ida/i.test(content);
    const hasReturn = /Vuelo de regreso/i.test(content);
    const isRoundTrip = hasOutbound && hasReturn;

    console.log('🔍 Flight type analysis:', {
        hasOutbound,
        hasReturn,
        isRoundTrip,
        airportMatchesCount: airportMatches.length,
        layoverMatchesCount: layoverMatches.length
    });

    // Check if we have multiple flight options (multiple "Precio total" markers)
    // Updated regex to capture complete numbers with flexible separators
    const priceMarkerPattern = /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD\s*Precio\s*total/gi;
    const priceMarkerMatches = [...content.matchAll(priceMarkerPattern)];

    console.log('🔍 Found flight options (Precio total markers):', priceMarkerMatches.length);
    priceMarkerMatches.forEach((match, i) => {
        console.log(`  Match ${i + 1}: "${match[0]}" at position ${match.index}`);
    });

    // Process round trips with structured flight details
    // This handles both: multiple flight options (2+ prices) OR single round trip with 4+ airports
    if (priceMarkerMatches.length >= 2 || (isRoundTrip && airportMatches.length >= 4) || (isRoundTrip && airportMatches.length >= 2)) {
        // Multiple flight options OR round trip with airport details
        console.log('🔍 Processing round trip with flight details...');
        console.log('  isRoundTrip:', isRoundTrip, 'priceMarkers:', priceMarkerMatches.length, 'airports:', airportMatches.length);

        // Build sections: each section includes the price and goes until the next price marker
        const flightSections = [];

        // If no price markers but is round trip, treat entire content as one section
        if (priceMarkerMatches.length === 0 && isRoundTrip) {
            console.log('🔍 No price markers found, using entire content as single section');
            const returnFlightIndex = content.toLowerCase().indexOf('vuelo de regreso');

            if (returnFlightIndex > 0) {
                flightSections.push({
                    fullContent: content,
                    outboundContent: content.substring(0, returnFlightIndex),
                    returnContent: content.substring(returnFlightIndex)
                });
            } else {
                flightSections.push({
                    fullContent: content,
                    outboundContent: content,
                    returnContent: ''
                });
            }
        } else {
            // Process each price marker as a separate section
            for (let i = 0; i < priceMarkerMatches.length; i++) {
                // Start from the previous "Precio total" (or beginning) to capture airline name
                // Airline name appears before the price, so we need to look back
                let sectionStart: number;
                if (i === 0) {
                    // First section: start from beginning
                    sectionStart = 0;
                } else {
                    // Other sections: start from after the previous "Vuelo de ida" to capture the airline
                    // Look for the airline name which appears before the price
                    const previousMatchEnd = priceMarkerMatches[i - 1].index! + priceMarkerMatches[i - 1][0].length;
                    sectionStart = previousMatchEnd;
                }

                // End at the start of the next price pattern (or end of content)
                const sectionEnd = priceMarkerMatches[i + 1]?.index || content.length;

                const fullSection = content.substring(sectionStart, sectionEnd);

                // Split this section into outbound and return parts
                const returnFlightIndex = fullSection.toLowerCase().indexOf('vuelo de regreso');

                if (returnFlightIndex > 0) {
                    // Section has both outbound and return
                    flightSections.push({
                        fullContent: fullSection,
                        outboundContent: fullSection.substring(0, returnFlightIndex),
                        returnContent: fullSection.substring(returnFlightIndex)
                    });
                } else {
                    // Section has only outbound (one-way flight)
                    flightSections.push({
                        fullContent: fullSection,
                        outboundContent: fullSection,
                        returnContent: ''
                    });
                }
            }
        }

        console.log('🔍 Processing', flightSections.length, 'flight section(s)');

        // Store leg prices for each section
        const legPrices: number[] = [];

        // Process each section
        flightSections.forEach((section, sectionIndex) => {
            console.log(`🔍 Processing section ${sectionIndex + 1}/${flightSections.length}`);

            // Extract the total price for this entire flight option (at the beginning, before "Vuelo de ida")
            // Pattern: "XXX.XX USD Precio total" or "XXX.XX USD\s*Precio total"
            // The text might have: "1429.86 USD Precio total" or "1429.86 USDPrecio total"
            // Updated regex to capture complete numbers with flexible separators
            const totalPricePattern = /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD\s*Precio\s*total/i;
            const totalPriceMatch = section.fullContent.match(totalPricePattern);
            let sectionTotalPrice = 0;

            console.log(`🔍 Section ${sectionIndex + 1} fullContent preview:`, section.fullContent.substring(0, 150));

            if (totalPriceMatch) {
                sectionTotalPrice = parsePrice(totalPriceMatch[1]);
                console.log(`💰 [SECTION PRICE PARSE] Section ${sectionIndex + 1} "${totalPriceMatch[1]}" → ${sectionTotalPrice} (ida + vuelta) from: "${totalPriceMatch[0]}"`);
            } else {
                console.warn(`⚠️ Section ${sectionIndex + 1}: Could not find price with pattern. Trying alternative...`);

                // Fallback: buscar cualquier número antes de "Precio total"
                const fallbackPattern = /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/i;
                const fallbackMatch = section.fullContent.match(fallbackPattern);
                if (fallbackMatch) {
                    sectionTotalPrice = parsePrice(fallbackMatch[1]);
                    console.log(`💰 [SECTION FALLBACK PARSE] Section ${sectionIndex + 1} "${fallbackMatch[1]}" → ${sectionTotalPrice}`);
                }
            }

            // Extract airline name for this section
            const sectionAirline = extractAirlineName(section.fullContent);
            console.log(`✈️ Section ${sectionIndex + 1} airline:`, sectionAirline);

            // Determine if this section has both outbound and return
            const sectionHasReturn = section.returnContent.trim().length > 0;

            // Split price only if section has both outbound and return
            const outboundPrice = sectionHasReturn ? sectionTotalPrice / 2 : sectionTotalPrice;
            const returnPrice = sectionHasReturn ? sectionTotalPrice / 2 : 0;

            console.log(`💰 Price for section ${sectionIndex + 1}: ${sectionHasReturn ? 'split' : 'full'} - outbound=$${outboundPrice}, return=$${returnPrice}`);

            // Extract outbound airports
            const outboundAirportPattern = /([A-Z]{3})\s+([A-Za-zÀ-ÿ\s]+?)\s+(\d{1,2}:\d{2})/g;
            const outboundAirports = [...section.outboundContent.matchAll(outboundAirportPattern)];

            // Extract return airports
            const returnAirportPattern = /([A-Z]{3})\s+([A-Za-zÀ-ÿ\s]+?)\s+(\d{1,2}:\d{2})/g;
            const returnAirports = [...section.returnContent.matchAll(returnAirportPattern)];

            console.log('🔍 Section airports:', {
                outbound: outboundAirports.map(a => ({ code: a[1], city: a[2].trim(), time: a[3] })),
                return: returnAirports.map(a => ({ code: a[1], city: a[2].trim(), time: a[3] }))
            });

            // Extract layovers for this section
            // Flexible regex: (.+?) captures both IATA codes (PTY, ATL) and city names (Bogotá, Ciudad de Panamá)
            const outboundLayoverPattern = /Escala en (.+?)\s+Tiempo de espera:\s*(\d+h\s*\d*m?)\s+en\s+([A-Z]{3})\s*\(([^)]+)\)/g;
            const outboundLayovers = [...section.outboundContent.matchAll(outboundLayoverPattern)];

            const returnLayoverPattern = /Escala en (.+?)\s+Tiempo de espera:\s*(\d+h\s*\d*m?)\s+en\s+([A-Z]{3})\s*\(([^)]+)\)/g;
            const returnLayovers = [...section.returnContent.matchAll(returnLayoverPattern)];

            // Build outbound leg for this section
            if (outboundAirports.length >= 2) {
                const outboundOrigin = outboundAirports[0];
                const outboundDest = outboundAirports[outboundAirports.length - 1];

                const outboundLeg = {
                    departure: {
                        city_code: outboundOrigin[1],
                        city_name: outboundOrigin[2].trim(),
                        time: outboundOrigin[3]
                    },
                    arrival: {
                        city_code: outboundDest[1],
                        city_name: outboundDest[2].trim(),
                        time: outboundDest[3]
                    },
                    duration: calculateFlightDuration(outboundOrigin[3], outboundDest[3]) || '10h',
                    flight_type: 'outbound',
                    price: outboundPrice,
                    airline: sectionAirline, // Add airline to leg
                    layovers: outboundLayovers.map(layover => ({
                        destination_city: layover[4].trim(),
                        destination_code: layover[3],
                        waiting_time: layover[2].trim()
                    }))
                };

                legs.push(outboundLeg);
                legPrices.push(outboundPrice);
                console.log(`✅ Outbound leg ${sectionIndex + 1} created: ${sectionAirline} - $${outboundPrice}`);
            }

            // Build return leg for this section
            if (returnAirports.length >= 2) {
                const returnOrigin = returnAirports[0];
                const returnDest = returnAirports[returnAirports.length - 1];

                const returnLeg = {
                    departure: {
                        city_code: returnOrigin[1],
                        city_name: returnOrigin[2].trim(),
                        time: returnOrigin[3]
                    },
                    arrival: {
                        city_code: returnDest[1],
                        city_name: returnDest[2].trim(),
                        time: returnDest[3]
                    },
                    duration: calculateFlightDuration(returnOrigin[3], returnDest[3]) || '10h',
                    flight_type: 'return',
                    price: returnPrice,
                    airline: sectionAirline, // Add airline to leg
                    layovers: returnLayovers.map(layover => ({
                        destination_city: layover[4].trim(),
                        destination_code: layover[3],
                        waiting_time: layover[2].trim()
                    }))
                };

                legs.push(returnLeg);
                legPrices.push(returnPrice);
                console.log(`✅ Return leg ${sectionIndex + 1} created: ${sectionAirline} - $${returnPrice}`);
            }
        });

        // Set main route info from first outbound leg
        if (legs.length > 0) {
            const firstOutboundLeg = legs.find(leg => leg.flight_type === 'outbound');
            if (firstOutboundLeg) {
                originCode = firstOutboundLeg.departure.city_code;
                destinationCode = firstOutboundLeg.arrival.city_code;
                departureTime = firstOutboundLeg.departure.time;
                arrivalTime = firstOutboundLeg.arrival.time;
            }
        }

    } else if (airportMatches.length >= 2) {
        // One-way flight: use all airports for single leg
        originCode = airportMatches[0][1];
        departureTime = airportMatches[0][3];

        destinationCode = airportMatches[airportMatches.length - 1][1];
        arrivalTime = airportMatches[airportMatches.length - 1][3];

        // Create main leg (origin to destination)
        const mainLeg = {
            departure: {
                city_code: originCode,
                city_name: airportMatches[0][2].trim(),
                time: departureTime
            },
            arrival: {
                city_code: destinationCode,
                city_name: airportMatches[airportMatches.length - 1][2].trim(),
                time: arrivalTime
            },
            duration: calculateFlightDuration(departureTime, arrivalTime) || '10h',
            flight_type: 'outbound',
            layovers: []
        };

        // Add layovers if found
        if (layoverMatches.length > 0) {
            mainLeg.layovers = layoverMatches.map(layover => ({
                destination_city: layover[4].trim(),
                destination_code: layover[3],
                waiting_time: layover[2].trim()
            }));
        }

        legs.push(mainLeg);
    } else {
        // Fallback: look for simple route patterns (e.g., "EZE -- PUJ" or "EZE → PUJ")
        // This is common in summary sections like "DESTINO EZE -- PUJ"
        console.log('🔍 [ROUTE EXTRACTION] Using fallback route extraction...');
        console.log('🔍 [ROUTE EXTRACTION] No structured airport+time matches found');
        console.log('🔍 [ROUTE EXTRACTION] Looking for simple route patterns (XXX -- XXX)');

        const simpleRouteMatch = content.match(/([A-Z]{3})\s*(?:--|->|→|⇄)\s*([A-Z]{3})/);
        if (simpleRouteMatch) {
            originCode = simpleRouteMatch[1];
            destinationCode = simpleRouteMatch[2];

            console.log(`✅ [ROUTE EXTRACTION] Found simple route pattern: ${originCode} → ${destinationCode}`);

            // Try to extract times from the first two airport mentions
            console.log(`🔍 [ROUTE EXTRACTION] Looking for departure time for ${originCode}...`);
            const firstAirportTime = content.match(new RegExp(`${originCode}[^\\d]+(\\d{1,2}:\\d{2})`));
            if (firstAirportTime) {
                departureTime = firstAirportTime[1];
                console.log(`✅ [ROUTE EXTRACTION] Found departure time: ${departureTime}`);
            } else {
                console.log(`⚠️ [ROUTE EXTRACTION] No departure time found for ${originCode}`);
            }

            console.log(`🔍 [ROUTE EXTRACTION] Looking for arrival time for ${destinationCode}...`);
            const secondAirportTime = content.match(new RegExp(`${destinationCode}[^\\d]+(\\d{1,2}:\\d{2})`));
            if (secondAirportTime) {
                arrivalTime = secondAirportTime[1];
                console.log(`✅ [ROUTE EXTRACTION] Found arrival time: ${arrivalTime}`);
            } else {
                console.log(`⚠️ [ROUTE EXTRACTION] No arrival time found for ${destinationCode}`);
            }

            legs.push({
                departure: {
                    city_code: originCode,
                    city_name: mapCodeToCity(originCode),
                    time: departureTime || '08:00'
                },
                arrival: {
                    city_code: destinationCode,
                    city_name: mapCodeToCity(destinationCode),
                    time: arrivalTime || '18:00'
                },
                duration: calculateFlightDuration(departureTime, arrivalTime) || '10h',
                flight_type: 'outbound',
                layovers: []
            });

            console.log(`✅ [ROUTE EXTRACTION] Created fallback route: ${originCode} → ${destinationCode}`);
        } else {
            console.error('❌ [ROUTE EXTRACTION] No route patterns found in content');
            console.log('📄 [ROUTE EXTRACTION] Content preview:', content.substring(0, 500));
        }
    }

    // Extract dates - look for specific date patterns for outbound and return
    const outboundDateMatch = content.match(/Vuelo de ida\s+(\d{4}-\d{2}-\d{2})/i);
    const returnDateMatch = content.match(/Vuelo de regreso\s+(\d{4}-\d{2}-\d{2})/i);

    let departureDate = '2025-11-01';
    let returnDate = undefined;

    if (outboundDateMatch) {
        departureDate = outboundDateMatch[1];
    }

    if (returnDateMatch) {
        returnDate = returnDateMatch[1];
    }

    // Extract price - look for price patterns with USD
    // Updated regex to capture complete numbers with flexible separators
    const priceMatches = content.match(/(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/i) ||
        content.match(/\$?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*(?:USD|US\$|\$)/gi);
    let price = 0;
    if (priceMatches) {
        const priceStr = priceMatches[0].match(/(\d{1,10}(?:[.,]\d{1,3})+|\d+)/);
        if (priceStr) {
            price = parsePrice(priceStr[1]);
            console.log(`💰 [FLIGHT LEG PRICE PARSE] "${priceStr[1]}" → ${price}`);
        }
    }

    // If we have legs, create separate flight objects for each leg
    if (legs.length > 0) {
        const outboundLegs = legs.filter(leg => leg.flight_type === 'outbound');
        const returnLegs = legs.filter(leg => leg.flight_type === 'return');

        console.log('🔍 Creating flight objects:', {
            outboundLegs: outboundLegs.length,
            returnLegs: returnLegs.length,
            isRoundTrip
        });

        if (isRoundTrip && returnLegs.length > 0) {
            // Round trip: pair each outbound with its corresponding return leg
            const maxPairs = Math.max(outboundLegs.length, returnLegs.length);

            for (let i = 0; i < maxPairs; i++) {
                // Add outbound flight
                if (i < outboundLegs.length) {
                    const outboundLeg = outboundLegs[i];
                    flights.push({
                        airline: resolveAirlineName(outboundLeg.airline),
                        route: `${outboundLeg.departure.city_code} → ${outboundLeg.arrival.city_code}`,
                        price: outboundLeg.price || 0,
                        dates: departureDate,
                        departureTime: outboundLeg.departure.time,
                        arrivalTime: outboundLeg.arrival.time,
                        originCode: outboundLeg.departure.city_code,
                        destinationCode: outboundLeg.arrival.city_code,
                        originCity: outboundLeg.departure.city_name,
                        destinationCity: outboundLeg.arrival.city_name,
                        legs: [outboundLeg]
                    });
                    console.log(`✅ Created outbound flight ${i + 1}: ${outboundLeg.airline} - $${outboundLeg.price || 0}`);
                }

                // Add return flight immediately after its outbound
                if (i < returnLegs.length) {
                    const returnLeg = returnLegs[i];
                    flights.push({
                        airline: resolveAirlineName(returnLeg.airline),
                        route: `${returnLeg.departure.city_code} → ${returnLeg.arrival.city_code}`,
                        price: returnLeg.price || 0,
                        dates: returnDate || departureDate,
                        departureTime: returnLeg.departure.time,
                        arrivalTime: returnLeg.arrival.time,
                        originCode: returnLeg.departure.city_code,
                        destinationCode: returnLeg.arrival.city_code,
                        originCity: returnLeg.departure.city_name,
                        destinationCity: returnLeg.arrival.city_name,
                        legs: [returnLeg]
                    });
                    console.log(`✅ Created return flight ${i + 1}: ${returnLeg.airline} - $${returnLeg.price || 0}`);
                }
            }
        } else {
            // One-way flights: create a flight object for each outbound leg
            outboundLegs.forEach((outboundLeg, i) => {
                flights.push({
                    airline: resolveAirlineName(outboundLeg.airline),
                    route: `${outboundLeg.departure.city_code} → ${outboundLeg.arrival.city_code}`,
                    price: outboundLeg.price || 0,
                    dates: departureDate,
                    departureTime: outboundLeg.departure.time,
                    arrivalTime: outboundLeg.arrival.time,
                    originCode: outboundLeg.departure.city_code,
                    destinationCode: outboundLeg.arrival.city_code,
                    originCity: outboundLeg.departure.city_name,
                    destinationCity: outboundLeg.arrival.city_name,
                    legs: [outboundLeg]
                });
                console.log(`✅ Created one-way flight ${i + 1}: ${outboundLeg.airline} - $${outboundLeg.price || 0}`);
            });
        }
    } else {
        // Single flight or one-way
        const route = originCode && destinationCode ? `${originCode} → ${destinationCode}` : 'Ruta no especificada';
        const dates = returnDate && returnDate !== departureDate ? `${departureDate} / ${returnDate}` : departureDate;

        // Get airline from first leg if available, otherwise extract from content
        let airlineName = resolveAirlineName(undefined);
        if (legs.length > 0 && legs[0].airline) {
            airlineName = resolveAirlineName(legs[0].airline);
        } else {
            // Try to extract airline from content
            const extracted = extractAirlineName(content);
            airlineName = resolveAirlineName(extracted);
            console.log('🔍 Extracted airline for single flight:', airlineName);
        }

        flights.push({
            airline: airlineName,
            route,
            price,
            dates,
            departureTime: departureTime || undefined,
            arrivalTime: arrivalTime || undefined,
            originCode,
            destinationCode,
            originCity: mapCodeToCity(originCode),
            destinationCity: mapCodeToCity(destinationCode),
            legs: legs.length > 0 ? legs : undefined
        });
    }

    console.log('✈️ Extracted flights from PdfMonkey template:', flights);
    return flights;
}

/**
 * Extract hotel information from PdfMonkey template content  
 * NOW SUPPORTS MULTIPLE HOTELS - iterates over all hotel sections
 */
function extractHotelsFromPdfMonkeyTemplate(content: string): Array<{
    name: string,
    location: string,
    price: number,
    nights: number,
    packagePrice?: number
}> {
    const hotels: Array<{
        name: string,
        location: string,
        price: number,
        nights: number,
        packagePrice?: number
    }> = [];

    // Extract nights duration (shared across all hotels typically)
    const nightsMatch = content.match(/(\d+)\s*(?:Noche|Noches|noche|noches)/i);
    const nights = nightsMatch ? parseInt(nightsMatch[1]) : 0;

    console.log(`🏨 [MULTI-HOTEL EXTRACTION] Starting extraction, nights: ${nights}`);

    // NEW: Detect package options pattern (Opción 1, Opción 2, Opción Económica, Opción Premium, etc.)
    // This handles PDFs with multiple package options using the SAME hotel but different prices
    const optionPattern = /Opci[oó]n\s+(1|2|\d+|Econ[oó]mica|Premium)\s+\$?(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/gi;
    const optionMatches = [...content.matchAll(optionPattern)];

    if (optionMatches.length >= 2) {
        console.log(`📦 [PACKAGE OPTIONS] Detected ${optionMatches.length} package options - using option-based extraction`);

        // Extract data for each option
        for (let i = 0; i < optionMatches.length; i++) {
            const optionMatch = optionMatches[i];
            const optionLabel = optionMatch[1]; // Can be "1", "2", "Económica", "Premium", etc.

            // Normalize option label to number
            let optionNumber: number;
            if (optionLabel.match(/^(Econ[oó]mica)$/i)) {
                optionNumber = 1;
            } else if (optionLabel.match(/^Premium$/i)) {
                optionNumber = 2;
            } else {
                optionNumber = parseInt(optionLabel);
            }

            const packagePrice = parsePrice(optionMatch[2]);
            const optionStartPos = optionMatch.index || 0;

            // Define section boundaries
            const optionEndPos = i < optionMatches.length - 1
                ? optionMatches[i + 1].index || content.length
                : content.length;

            const optionContent = content.substring(optionStartPos, optionEndPos);

            console.log(`📦 [OPTION ${optionNumber}] Extracting data (package price: $${packagePrice})`);

            // Extract hotel name from this option
            let hotelName = 'Hotel no especificado';
            let stars = 0;

            // Try multiple patterns to find hotel name
            const hotelPatterns = [
                /🏨\s*Hotel\s*\n?\s*([A-Z][A-Za-z\s\-\'\.]+?)\s+(\d+)\s*estrellas/i,
                /([A-Z][A-Za-z\s\-\'\.,]+?)\s+(\d+)\s*estrellas/i,
                /🏨\s*Hotel\s*\n?\s*([A-Z][A-Za-z\s\-\'\.]+?)(?=\s*(?:📍|⭐|DETALLE|Precio))/i
            ];

            for (const pattern of hotelPatterns) {
                const match = optionContent.match(pattern);
                if (match) {
                    hotelName = match[1].trim();
                    if (match[2]) {
                        stars = parseInt(match[2]);
                    }
                    break;
                }
            }

            // Extract location
            let location = 'Ubicación no especificada';
            const locationPatterns = [
                /(\d+)\s*estrellas\s*([A-Za-zÀ-ÿ\s,\(\)]+?)(?=\s*(?:DETALLE|Precio:|outbound|return))/i,
                /📍\s*(?:Ubicación:)?\s*([A-Za-zÀ-ÿ\s,\(\)]+?)(?=\s*(?:⭐|👥|DETALLE|Precio))/i
            ];

            for (const pattern of locationPatterns) {
                const match = optionContent.match(pattern);
                if (match) {
                    location = (match[2] || match[1]).trim();
                    break;
                }
            }

            // Extract hotel price (not package price)
            let hotelPrice = 0;
            const hotelPricePattern = /(?:🏨\s*Hotel[\s\S]{0,300}?)Precio:\s*\$?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/i;
            const hotelPriceMatch = optionContent.match(hotelPricePattern);
            if (hotelPriceMatch) {
                hotelPrice = parsePrice(hotelPriceMatch[1]);
            }

            // Create unique hotel name with option label
            const uniqueHotelName = `${hotelName} (Opción ${optionNumber})`;

            hotels.push({
                name: uniqueHotelName,
                location,
                price: hotelPrice,
                nights,
                packagePrice: packagePrice  // ✅ Guardar packagePrice para opciones
            });

            console.log(`📦 [OPTION ${optionNumber} EXTRACTED]`, {
                name: uniqueHotelName,
                location,
                hotelPrice,
                packagePrice,
                nights
            });
        }

        // Return early with option-based extraction
        console.log(`✅ [PACKAGE OPTIONS] Successfully extracted ${hotels.length} package options`);
        return hotels;
    }

    console.log(`📦 [PACKAGE OPTIONS] No multi-option pattern detected, using standard extraction`);

    // Strategy: Find ALL hotel sections by looking for hotel name patterns
    // Pattern 1: Find all sections with "🏨 Hotel" or "Hotel" followed by a capitalized name
    // Pattern 2: Find all hotel names before "X estrellas"
    // Pattern 3: Find all sections with "Hotel Recomendado" or standalone hotel names

    // Extract ALL hotel names from the document
    const hotelNamePatterns = [
        // Pattern 1: "Hotel Recomendado" followed by name
        /(?:🏨\s*)?Hotel\s*Recomendado\s+([A-Z][A-Z\s]+?)(?=\s*\d+\s*estrellas|DETALLE|Precio:|🏨\s*Hotel|📍|⭐)/gi,
        // Pattern 2: "🏨 Hotel" on one line, name on next line (for individual hotel pages)
        // Captures hotel name that appears after "🏨 Hotel" on the same or next line
        /🏨\s*Hotel\s*\n?\s*([A-Z][A-Za-z\s\-\'\.]+?)(?=\s*(?:📍|⭐|👥|DETALLE|Tarifa|Para confirmar|Ocupación|estrellas|\n\n|\n🏨))/gi,
        // Pattern 3: Capitalized name before "X estrellas" (most reliable for individual pages)
        /([A-Z][A-Za-z\s\-\'\.,]+?)\s+(\d+)\s*estrellas/gi,
        // Pattern 4: Standalone capitalized hotel names (RESORT, HOTEL, etc.) on their own line
        // This catches hotels like "SOLYMAR BEACH RESORT" that appear as titles
        /^([A-Z][A-Z\s]+(?:RESORT|HOTEL|BEACH|SUITES|INN|LODGE)[A-Z\s]*?)(?=\s*(?:📍|⭐|👥|🏨|DETALLE|Tarifa|Para confirmar|Ocupación|\n\n))/gim,
        // Pattern 5: Hotel name as a title (all caps, multiple words, before location/price info)
        // Matches patterns like "SOLYMAR BEACH RESORT" followed by location or price
        /([A-Z]{2,}(?:\s+[A-Z]{2,}){1,4})(?=\s*(?:📍|⭐|👥|🏨|DETALLE|Tarifa|Para confirmar|Ocupación|Ubicación|Precio|\d+\s*estrellas|\n\n))/g
    ];

    const foundHotels: Array<{ name: string, position: number, stars?: number }> = [];

    // Collect all hotel names with their positions
    for (const pattern of hotelNamePatterns) {
        const matches = [...content.matchAll(pattern)];
        for (const match of matches) {
            const hotelName = match[1]?.trim();
            const stars = match[2] ? parseInt(match[2]) : undefined;

            if (hotelName && hotelName.length > 2) {
                // Avoid duplicates and filter out common false positives
                const isDuplicate = foundHotels.some(h =>
                    h.name.toLowerCase() === hotelName.toLowerCase() ||
                    hotelName.toLowerCase().includes(h.name.toLowerCase()) ||
                    h.name.toLowerCase().includes(hotelName.toLowerCase())
                );

                // Filter out false positives (common words that aren't hotel names)
                const falsePositives = ['DETALLE', 'Precio', 'Ubicación', 'Categoría', 'Ocupación', 'Tarifa', 'VUELO', 'VUELOS', 'ADULTOS', 'NIÑOS', 'PASAJEROS', 'DURACIÓN', 'INCLUYE', 'PRESUPUESTO', 'VIAJE', 'DESTINO', 'FECHAS'];
                const isFalsePositive = falsePositives.some(fp => hotelName.includes(fp));

                // Additional validation: hotel name should be at least 3 characters and not just common words
                const minLength = 3;
                const isTooShort = hotelName.length < minLength;

                // Check if it looks like a hotel name (contains common hotel keywords or is multi-word)
                const hasHotelKeywords = /\b(RESORT|HOTEL|BEACH|SUITES|INN|LODGE|PALACE|GRAND|PLAZA|PARK|CLUB|VILLA)\b/i.test(hotelName);
                const isMultiWord = hotelName.trim().split(/\s+/).length >= 2;
                const looksLikeHotelName = hasHotelKeywords || isMultiWord;

                if (!isDuplicate && !isFalsePositive && !isTooShort && looksLikeHotelName) {
                    foundHotels.push({
                        name: hotelName,
                        position: match.index || 0,
                        stars
                    });
                    console.log(`🏨 [FOUND HOTEL] "${hotelName}" at position ${match.index}, stars: ${stars || 'N/A'}`);
                } else {
                    console.log(`🏨 [SKIPPED] "${hotelName}" - duplicate: ${isDuplicate}, falsePositive: ${isFalsePositive}, tooShort: ${isTooShort}, looksLikeHotel: ${looksLikeHotelName}`);
                }
            }
        }
    }

    // Sort by position in document (to maintain order)
    foundHotels.sort((a, b) => a.position - b.position);

    console.log(`🏨 [MULTI-HOTEL] Found ${foundHotels.length} unique hotels:`, foundHotels.map(h => h.name));

    // If no hotels found with patterns, try fallback: look for "Hotel Recomendado" (original behavior)
    if (foundHotels.length === 0) {
        console.log(`🏨 [FALLBACK] No hotels found with multi-pattern, trying original single-hotel extraction`);

        let hotelName = 'Hotel no especificado';
        const hotelNamePattern1 = /(?:🏨\s*)?Hotel\s*Recomendado\s+([A-Z][A-Z\s]+?)(?=\s*\d+\s*estrellas|DETALLE|Precio:|🏨\s*Hotel|📍|⭐)/i;
        const hotelNameMatch1 = content.match(hotelNamePattern1);
        if (hotelNameMatch1) {
            hotelName = hotelNameMatch1[1].trim();
            foundHotels.push({ name: hotelName, position: 0 });
        }
    }

    // Extract data for each hotel found
    for (let i = 0; i < foundHotels.length; i++) {
        const hotelInfo = foundHotels[i];
        const hotelName = hotelInfo.name;

        // Find the section for this hotel (from its position to next hotel or end)
        const startPos = hotelInfo.position;
        const nextHotelPos = i < foundHotels.length - 1 ? foundHotels[i + 1].position : content.length;
        const hotelSection = content.substring(startPos, Math.min(startPos + 2000, nextHotelPos));

        console.log(`🏨 [EXTRACTING HOTEL ${i + 1}] "${hotelName}" (section length: ${hotelSection.length})`);

        // Extract location for this specific hotel
        let location = 'Ubicación no especificada';

        // Pattern 1: After stars rating in this hotel's section
        const locationPattern1 = /(\d+)\s*estrellas\s*([A-Za-zÀ-ÿ\s,]+?)(?=\s*(?:DETALLE|Precio:|🏨|📍|⭐|👥|Tarifa|Para confirmar|Ocupación))/i;
        const locationMatch1 = hotelSection.match(locationPattern1);
        if (locationMatch1) {
            location = locationMatch1[2].trim();
        } else {
            // Pattern 2: Look for "📍 Ubicación:" pattern
            const locationPattern2 = /📍\s*Ubicación:\s*([A-Za-zÀ-ÿ\s,]+?)(?=\s*(?:⭐|👥|DETALLE|Tarifa|Para confirmar|Ocupación|estrellas))/i;
            const locationMatch2 = hotelSection.match(locationPattern2);
            if (locationMatch2) {
                location = locationMatch2[1].trim();
            } else {
                // Pattern 3: Known locations in this section
                const knownLocations = /([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s,]*(?:Punta\s+Cana|PUNTA\s+CANA|Buenos\s+Aires|BUENOS\s+AIRES|Madrid|Barcelona|Miami|Cancún|CANCÚN|República\s+Dominicana)[A-Za-zÀ-ÿ\s,]*?)(?=\s*(?:DETALLE|Precio:|🏨|📍|⭐|👥|Tarifa|Ocupación))/i;
                const locationMatch3 = hotelSection.match(knownLocations);
                if (locationMatch3) {
                    location = locationMatch3[1].trim();
                }
            }
        }

        // Extract price for this specific hotel
        let hotelPrice = 0;

        // Pattern 1: "Precio: $XXX USD" in this hotel's section
        const pricePattern1 = /Precio:\s*\$?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/i;
        const priceMatch1 = hotelSection.match(pricePattern1);
        if (priceMatch1) {
            hotelPrice = parsePrice(priceMatch1[1]);
            console.log(`🏨 [HOTEL ${i + 1} PRICE] Pattern 1: "${priceMatch1[1]}" → ${hotelPrice}`);
        }

        // Pattern 2: Price without spaces
        if (hotelPrice === 0) {
            const pricePattern2 = /Precio:\$?(\d{1,10}(?:[.,]\d{1,3})+|\d+)USD/i;
            const priceMatch2 = hotelSection.match(pricePattern2);
            if (priceMatch2) {
                hotelPrice = parsePrice(priceMatch2[1]);
                console.log(`🏨 [HOTEL ${i + 1} PRICE] Pattern 2: "${priceMatch2[1]}" → ${hotelPrice}`);
            }
        }

        // Pattern 3: Any USD price in this hotel's section (if multiple, take the one closest to hotel name)
        if (hotelPrice === 0) {
            const allPricesInSection = [...hotelSection.matchAll(/(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/gi)];
            if (allPricesInSection.length > 0) {
                // Take the first price found in this section (closest to hotel name)
                hotelPrice = parsePrice(allPricesInSection[0][1]);
                console.log(`🏨 [HOTEL ${i + 1} PRICE] Pattern 3: "${allPricesInSection[0][1]}" → ${hotelPrice}`);
            }
        }

        // If still no price, try to extract from the "Hotel Recomendado" section (first hotel only)
        if (hotelPrice === 0 && i === 0) {
            // Fallback: look in the main "Hotel Recomendado" section
            const mainHotelSection = content.match(/Hotel Recomendado[\s\S]{0,500}?(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/i);
            if (mainHotelSection) {
                hotelPrice = parsePrice(mainHotelSection[1]);
                console.log(`🏨 [HOTEL ${i + 1} PRICE] Fallback from main section: "${mainHotelSection[1]}" → ${hotelPrice}`);
            }
        }

        hotels.push({
            name: hotelName,
            location,
            price: hotelPrice,
            nights
        });

        console.log(`🏨 [HOTEL ${i + 1} EXTRACTED]`, {
            name: hotelName,
            location,
            price: hotelPrice,
            nights
        });
    }

    // If still no hotels found, return empty array (don't create fake data)
    if (hotels.length === 0) {
        console.log(`⚠️ [MULTI-HOTEL] No hotels extracted from PDF`);
    } else {
        console.log(`✅ [MULTI-HOTEL] Successfully extracted ${hotels.length} hotel(s):`, hotels.map(h => h.name));
    }

    return hotels;
}

/**
 * Extract total price from PdfMonkey template content
 */
function extractTotalPriceFromPdfMonkeyTemplate(content: string): number {
    // Look for ALL "Precio total" patterns in case there are multiple flight options
    // Updated regex to capture complete numbers with flexible separators
    const totalPricePattern = /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD\s*Precio\s*total/gi;
    const totalMatches = [...content.matchAll(totalPricePattern)];

    if (totalMatches.length > 0) {
        // Sum all prices found using smart parser
        const totalPrice = totalMatches.reduce((sum, match) => {
            const price = parsePrice(match[1]);
            console.log(`💰 [PRICE PARSE] "${match[1]}" → ${price}`);
            return sum + price;
        }, 0);

        console.log('💰 Extracted total price from PdfMonkey template (from "Precio total"):', totalPrice,
            `(${totalMatches.length} price(s) found)`);
        return totalPrice;
    }

    // Fallback: Look for all price patterns and return the highest
    const allPricePatterns = [
        /\$?(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/g,
        /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*(?:USD|US\$)/g
    ];

    const allPrices = [];
    for (const pattern of allPricePatterns) {
        const matches = [...content.matchAll(pattern)];
        matches.forEach(match => {
            const price = parsePrice(match[1]);
            if (!isNaN(price) && price > 0) {
                console.log(`💰 [FALLBACK PARSE] "${match[1]}" → ${price}`);
                allPrices.push(price);
            }
        });
    }

    // Return the highest price found (likely the total)
    const totalPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
    console.log('💰 Extracted total price from PdfMonkey template (fallback):', totalPrice, 'from prices:', allPrices);
    return totalPrice;
}

/**
 * Extract passenger count from PdfMonkey template content
 */
function extractPassengersFromPdfMonkeyTemplate(content: string): number {
    const passengerMatch = content.match(/(\d+)\s*(?:Adulto|Adultos|adulto|adultos)/i);
    const passengers = passengerMatch ? parseInt(passengerMatch[1]) : 1;
    console.log('👥 Extracted passengers from PdfMonkey template:', passengers);
    return passengers;
}

/**
 * Extract currency from PdfMonkey template content
 */
function extractCurrencyFromPdfMonkeyTemplate(content: string): string {
    const currencyMatch = content.match(/\b(USD|US\$|EUR|ARS)\b/i);
    const currency = currencyMatch ? currencyMatch[1].toUpperCase().replace('US$', 'USD') : 'USD';
    console.log('💱 Extracted currency from PdfMonkey template:', currency);
    return currency;
}

/**
 * Format parsed data for Starling API
 */
function formatParsedDataForStarling(parsed: any) {
    if (!parsed.flights) return null;

    // Create passenger array for TVC API format
    const passengers = [];
    if ((parsed.flights.adults || 1) > 0) {
        passengers.push({
            Count: parsed.flights.adults || 1,
            Type: 'ADT'
        });
    }
    if ((parsed.flights.children || 0) > 0) {
        passengers.push({
            Count: parsed.flights.children,
            Type: 'CHD'
        });
    }

    // Create legs array for TVC API format
    const legs = [
        {
            DepartureAirportCity: parsed.flights.origin,
            ArrivalAirportCity: parsed.flights.destination,
            FlightDate: parsed.flights.departureDate
        }
    ];

    // Add return leg if this is a round trip
    if (parsed.flights.returnDate) {
        legs.push({
            DepartureAirportCity: parsed.flights.destination,
            ArrivalAirportCity: parsed.flights.origin,
            FlightDate: parsed.flights.returnDate
        });
    }

    return {
        Passengers: passengers,
        Legs: legs,
        Airlines: null
    };
}

/**
 * Search flights using existing Starling/TVC API through Supabase Edge Function
 */
async function searchFlightsWithStarling(starlingRequest: any): Promise<FlightData[]> {
    try {
        console.log('🚀 Calling existing starling-flights function');
        console.log('📋 Request format:', JSON.stringify(starlingRequest, null, 2));

        // Use the existing starling-flights function with 'searchFlights' action
        const { data, error } = await supabase.functions.invoke('starling-flights', {
            body: {
                action: 'searchFlights',
                data: starlingRequest
            }
        });

        if (error) {
            console.error('❌ Starling flights function error:', error);
            throw new Error(`Starling flights error: ${error.message}`);
        }

        if (!data?.success) {
            throw new Error(data?.error || 'Starling flights search failed');
        }

        // Extract flight data from TVC response format
        const tvcFlights = data.data?.Recommendations || [];
        console.log('✅ TVC API response:', tvcFlights.length, 'recommendations found');

        // Transform TVC recommendations to our FlightData format
        const transformedFlights = transformTvcRecommendationsToFlightData(tvcFlights, starlingRequest);

        console.log('✅ Transformed flights:', transformedFlights.length, 'flights ready');
        return transformedFlights;

    } catch (error) {
        console.error('❌ Error calling starling-flights function:', error);
        // Fallback to EUROVIPS if Starling fails
        console.log('🔄 Falling back to EUROVIPS search');
        return await searchAirFares({
            origin: starlingRequest.Legs[0]?.DepartureAirportCity || '',
            destination: starlingRequest.Legs[0]?.ArrivalAirportCity || '',
            departureDate: starlingRequest.Legs[0]?.FlightDate || '',
            returnDate: starlingRequest.Legs[1]?.FlightDate,
            adults: starlingRequest.Passengers?.find((p: any) => p.Type === 'ADT')?.Count || 1,
            children: starlingRequest.Passengers?.find((p: any) => p.Type === 'CHD')?.Count || 0
        });
    }
}

/**
 * Transform TVC Recommendations to FlightData format
 */
function transformTvcRecommendationsToFlightData(recommendations: any[], originalRequest: any): FlightData[] {
    const flights: FlightData[] = [];

    if (!Array.isArray(recommendations)) {
        console.warn('⚠️ TVC recommendations is not an array');
        return flights;
    }

    recommendations.forEach((recommendation, index) => {
        try {
            // Extract basic flight information
            const flightGroups = recommendation.FlightGroups || [];
            const firstGroup = flightGroups[0];

            if (!firstGroup?.Flights?.[0]) {
                console.warn(`⚠️ No flights in recommendation ${index}`);
                return;
            }

            const firstFlight = firstGroup.Flights[0];
            const lastFlight = flightGroups[flightGroups.length - 1]?.Flights?.[0] || firstFlight;

            // Calculate total price
            const totalPrice = recommendation.TotalFare?.TotalPrice || 0;
            const currency = recommendation.TotalFare?.Currency || 'USD';

            // Extract passenger counts
            const adultCount = originalRequest.Passengers?.find((p: any) => p.Type === 'ADT')?.Count || 1;
            const childCount = originalRequest.Passengers?.find((p: any) => p.Type === 'CHD')?.Count || 0;

            // Build flight legs
            const legs = flightGroups.map((group: any) => {
                const flight = group.Flights[0];
                return {
                    departure: {
                        airport_code: flight.OriginAirport || '',
                        city_name: flight.OriginCity || '',
                        datetime: flight.DepartureDateTime || '',
                        terminal: flight.OriginTerminal || ''
                    },
                    arrival: {
                        airport_code: flight.DestinationAirport || '',
                        city_name: flight.DestinationCity || '',
                        datetime: flight.ArrivalDateTime || '',
                        terminal: flight.DestinationTerminal || ''
                    },
                    duration: flight.FlightDuration || '',
                    flight_number: flight.FlightNumber || '',
                    aircraft: flight.AircraftType || '',
                    airline_code: flight.AirlineCode || ''
                };
            });

            const transformedFlight: FlightData = {
                id: `tvc_${recommendation.RecommendationId || index}`,
                airline: {
                    code: firstFlight.AirlineCode || '',
                    name: firstFlight.AirlineName || 'Unknown Airline'
                },
                price: {
                    amount: totalPrice,
                    currency: currency
                },
                departure_date: originalRequest.Legs[0]?.FlightDate || '',
                return_date: originalRequest.Legs[1]?.FlightDate,
                adults: adultCount,
                childrens: childCount,
                legs: legs
            };

            flights.push(transformedFlight);

        } catch (err) {
            console.error(`❌ Error transforming TVC recommendation ${index}:`, err);
        }
    });

    console.log(`✅ Successfully transformed ${flights.length} flights from ${recommendations.length} TVC recommendations`);
    return flights;
}

/**
 * Calculate total flight duration from legs
 */
function calculateTotalDuration(legs: any[]): string {
    if (!legs || legs.length === 0) return '';

    // Simple implementation - just return the duration of the first leg
    // In a real implementation, you'd calculate the total travel time including layovers
    return legs[0]?.duration || '';
}

/**
 * Extract baggage information from TVC recommendation
 */
function extractBaggageInfo(recommendation: any): string {
    // Extract baggage info if available in the TVC response
    const baggage = recommendation.BaggageAllowance || recommendation.Baggage;
    if (baggage) {
        if (typeof baggage === 'string') return baggage;
        if (baggage.CheckedBaggage) return `${baggage.CheckedBaggage} checked`;
        if (baggage.CabinBaggage) return `${baggage.CabinBaggage} cabin`;
    }
    return 'Standard baggage allowance';
}
