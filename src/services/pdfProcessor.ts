/**
 * PDF Processor Service
 * Handles PDF upload, reading, and content analysis for travel quotations
 */

import { supabase } from '@/integrations/supabase/client';
import { searchAirFares, type AirfareSearchParams } from './airfareSearch';
import type { FlightData } from '@/types';

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

    // Count dots and commas to determine format
    const dotCount = (cleaned.match(/\./g) || []).length;
    const commaCount = (cleaned.match(/,/g) || []).length;
    const lastDotIndex = cleaned.lastIndexOf('.');
    const lastCommaIndex = cleaned.lastIndexOf(',');

    // No separators - simple case
    if (dotCount === 0 && commaCount === 0) {
        return parseFloat(cleaned);
    }

    // Only dots - check if it's decimal or thousands separator
    if (dotCount > 0 && commaCount === 0) {
        // If dot is in the last 3 positions and there's more than one dot, it's decimal
        // Otherwise if there's only one dot and it's in last 3 chars, it's decimal
        // Otherwise dots are thousands separators
        if (lastDotIndex >= cleaned.length - 3 && dotCount === 1) {
            // Single dot in last 3 positions = decimal separator
            return parseFloat(cleaned);
        } else {
            // Multiple dots or dot not in decimal position = thousands separator
            return parseFloat(cleaned.replace(/\./g, ''));
        }
    }

    // Only commas - check if it's decimal or thousands separator
    if (commaCount > 0 && dotCount === 0) {
        // If comma is in the last 3 positions and there's only one comma, it's decimal
        if (lastCommaIndex >= cleaned.length - 3 && commaCount === 1) {
            // Single comma in last 3 positions = decimal separator (EU format)
            return parseFloat(cleaned.replace(',', '.'));
        } else {
            // Multiple commas or comma not in decimal position = thousands separator (US)
            return parseFloat(cleaned.replace(/,/g, ''));
        }
    }

    // Both dots and commas present - determine which comes last
    if (lastCommaIndex > lastDotIndex) {
        // Comma comes after dot = EU/Latino format (2.549,32)
        // Dots are thousands, comma is decimal
        return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
        // Dot comes after comma = US format (2,549.32)
        // Commas are thousands, dot is decimal
        return parseFloat(cleaned.replace(/,/g, ''));
    }
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
        calculatedHotelPrice = hotels.reduce((sum, hotel) => sum + (hotel.price * hotel.nights), 0);
        console.log('💰 Calculated hotel price:', calculatedHotelPrice);
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

    // Total price - this should be the sum of all components
    if (content.totalPrice) {
        response += `💰 **Precio Total:** $${content.totalPrice} ${content.currency || 'USD'}  \n`;
        response += `👥 **Pasajeros:** ${content.passengers || 1}\n\n`;
    }

    response += `💬 **¿Qué te gustaría modificar?**\n\n`;
    response += `Puedes pedirme:\n\n`;
    response += `• "Quiero modificarle el precio a [cantidad]"  \n`;
    response += `• "Cambia el precio del primer vuelo a [cantidad] y el segundo a [cantidad]"\n\n`;

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
    const pricePatterns = [
        /\$\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/g,
        /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*(?:USD|usd|dólares?|dolares?)/gi,
        /precio.*?(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /total.*?(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /cambia.*?(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /por\s+(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi
    ];

    // First try to find numbers with context (more specific patterns)
    for (const pattern of pricePatterns) {
        const matches = message.match(pattern);
        if (matches) {
            for (const match of matches) {
                const numberMatch = match.match(/(\d{1,10}(?:[.,]\d{1,3})+|\d+)/);
                if (numberMatch) {
                    const price = parsePrice(numberMatch[1]);
                    if (price > 0 && price < 100000) { // Reasonable price range
                        console.log('💰 [PRICE EXTRACTION] Found price with context:', price, 'from match:', match, 'raw:', numberMatch[1]);
                        return price;
                    }
                }
            }
        }
    }

    // If no contextual match, look for standalone numbers (but be more careful)
    const standaloneNumbers = message.match(/\b(\d{3,6})\b/g);
    if (standaloneNumbers) {
        // Filter out common non-price numbers
        const filteredNumbers = standaloneNumbers.filter(num => {
            const value = parseInt(num);
            return value >= 100 && value <= 50000; // Reasonable price range
        });

        if (filteredNumbers.length > 0) {
            // Take the largest number found (most likely to be the price)
            const maxPrice = Math.max(...filteredNumbers.map(n => parseInt(n)));
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
        group.forEach(flight => {
            if ((flight as any).legs && (flight as any).legs.length > 0) {
                allLegs.push(...(flight as any).legs);
            }
        });

        if (allLegs.length === 0) {
            throw new Error('No leg data found in PDF for flight reconstruction');
        }

        // Parse dates
        const flight = group[0];
        const lastFlight = group[group.length - 1];

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

        // If we have a return flight, use its date
        if (hasReturn && lastFlight.dates) {
            if (lastFlight.dates.includes(' / ')) {
                returnDate = lastFlight.dates.split(' / ')[0].trim();
            }
        }

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
    });
}

/**
 * Reconstruct HotelData from extracted PDF data  
 */
function reconstructHotelData(analysis: PdfAnalysisResult, newPrice: number): any[] {
    if (!analysis.content?.hotels) return [];

    const originalPrice = analysis.content.totalPrice || 0;
    const priceRatio = originalPrice > 0 ? newPrice / originalPrice : 1;

    return analysis.content.hotels.map((hotel, index) => {
        const adjustedNightlyPrice = parseFloat((hotel.price * priceRatio).toFixed(2));
        const adjustedTotalPrice = parseFloat((adjustedNightlyPrice * hotel.nights).toFixed(2));

        return {
            id: `regenerated-hotel-${Date.now()}-${index}`,
            name: hotel.name,
            city: hotel.location,
            address: hotel.location,
            category: "4",
            nights: hotel.nights,
            check_in: analysis.content?.flights?.[0]?.dates.split(' / ')[0] || '2025-11-01',
            check_out: analysis.content?.flights?.[0]?.dates.split(' / ')[1] || '2025-11-15',
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
 * Generate modified PDF with new price
 */
export async function generateModifiedPdf(
    analysis: PdfAnalysisResult,
    newPrice: number,
    conversationId: string
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
            adjustedFlights = reconstructFlightData(analysis, newPrice);
            adjustedHotels = reconstructHotelData(analysis, newPrice);
        } else {
            // For external PDFs, use ONLY real data from PDF
            console.log('🔄 Adapting external PDF data with real data only');
            const priceRatio = originalPrice > 0 ? newPrice / originalPrice : 1;

            adjustedFlights = analysis.content.flights?.map((flight, index) => {
                // Use ONLY real leg data from PDF - no mock data
                if ((flight as any).legs && (flight as any).legs.length > 0) {
                    console.log('✅ Using REAL external PDF leg data:', (flight as any).legs);

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
                        legs: (flight as any).legs // Use real legs from PDF
                    };
                } else {
                    console.warn('⚠️ External PDF has no leg data - skipping flight');
                    return null;
                }
            }).filter(flight => flight !== null) || [];

            adjustedHotels = analysis.content.hotels?.map((hotel, index) => ({
                id: `external-modified-hotel-${Date.now()}-${index}`,
                name: hotel.name,
                city: hotel.location,
                address: hotel.location,
                check_in: analysis.content?.flights?.[0]?.dates.split(' / ')[0] || '2025-11-01',
                check_out: analysis.content?.flights?.[0]?.dates.split(' / ')[1] || '2025-11-15',
                rooms: [{
                    type: 'Standard',
                    description: 'Habitación estándar modificada',
                    total_price: parseFloat((hotel.price * hotel.nights * priceRatio).toFixed(2)),
                    currency: analysis.content?.currency || 'USD',
                    availability: 5,
                    occupancy_id: `external-room-${index}`
                }]
            })) || [];
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
            pdfResult = await generateCombinedTravelPdf(adjustedFlights, adjustedHotels);
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

        // If no multiple prices, check for single total price (existing behavior)
        const requestedPrice = extractPriceFromMessage(request);

        if (requestedPrice) {
            console.log('💰 User requested specific price:', requestedPrice);

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
            airline: airlines[i] || 'Aerolínea no especificada',
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
        // Only use location-specific patterns - don't use generic airline name patterns
        const airlinePatterns = [
            // Pattern 1: DETALLE DEL VUELO followed by code + name (most specific)
            /DETALLE\s+DEL\s+VUELO\s+([A-Z]{2,3})\s+([A-Z][A-Za-z\sñÑáéíóúÁÉÍÓÚ\.]+?)(?:\s+Ocupación)/i,
            // Pattern 2: Code + name just before Ocupación
            /\n\s*([A-Z]{2,3})\s+([A-Z][A-Za-z\sñÑáéíóúÁÉÍÓÚ\.]+?)\s+Ocupación/i,
            // Pattern 3: After DETALLE with any spacing until Ocupación
            /DETALLE\s+DEL\s+VUELO[^\n]*\n\s*([A-Z]{2,3})\s+([A-Za-z\sñÑáéíóúÁÉÍÓÚ\.]+?)\s+Ocupación/im,
        ];

        for (const pattern of airlinePatterns) {
            const match = sectionContent.match(pattern);
            if (match) {
                // For patterns with two capture groups, combine code and name
                if (match[2]) {
                    const code = match[1].trim();
                    const name = match[2].trim();
                    return `${code} ${name}`;
                } else if (match[1]) {
                    return match[1].trim();
                }
            }
        }
        return 'Aerolínea no especificada';
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
    const layoverPattern = /Escala en ([^T]+?)\s+Tiempo de espera:\s*([^e]+?)\s+en\s+([A-Z]{3})\s*\(([^)]+)\)/g;
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
            const outboundLayoverPattern = /Escala en ([^T]+?)\s+Tiempo de espera:\s*([^e]+?)\s+en\s+([A-Z]{3})\s*\(([^)]+)\)/g;
            const outboundLayovers = [...section.outboundContent.matchAll(outboundLayoverPattern)];

            const returnLayoverPattern = /Escala en ([^T]+?)\s+Tiempo de espera:\s*([^e]+?)\s+en\s+([A-Z]{3})\s*\(([^)]+)\)/g;
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
        console.log('🔍 Using fallback route extraction...');

        const simpleRouteMatch = content.match(/([A-Z]{3})\s*(?:--|->|→|⇄)\s*([A-Z]{3})/);
        if (simpleRouteMatch) {
            originCode = simpleRouteMatch[1];
            destinationCode = simpleRouteMatch[2];

            console.log(`🔍 Found simple route pattern: ${originCode} → ${destinationCode}`);

            // Try to extract times from the first two airport mentions
            const firstAirportTime = content.match(new RegExp(`${originCode}[^\\d]+(\\d{1,2}:\\d{2})`));
            const secondAirportTime = content.match(new RegExp(`${destinationCode}[^\\d]+(\\d{1,2}:\\d{2})`));

            if (firstAirportTime) departureTime = firstAirportTime[1];
            if (secondAirportTime) arrivalTime = secondAirportTime[1];

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

            console.log(`✅ Created fallback route: ${originCode} → ${destinationCode}`);
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
                        airline: outboundLeg.airline || 'Aerolínea no especificada',
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
                        airline: returnLeg.airline || 'Aerolínea no especificada',
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
                    airline: outboundLeg.airline || 'Aerolínea no especificada',
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
        let airlineName = 'Aerolínea no especificada';
        if (legs.length > 0 && legs[0].airline) {
            airlineName = legs[0].airline;
        } else {
            // Try to extract airline from content
            airlineName = extractAirlineName(content);
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
 */
function extractHotelsFromPdfMonkeyTemplate(content: string): Array<{
    name: string,
    location: string,
    price: number,
    nights: number
}> {
    const hotels = [];

    // Extract hotel name from template - multiple patterns
    let hotelName = 'Hotel no especificado';

    // Pattern 1: Look for hotel name after "Hotel Recomendado" or "🏨 Hotel Recomendado"
    // Match everything until we find digits (like "5 estrellas") or certain keywords
    const hotelNamePattern1 = /(?:🏨\s*)?Hotel\s*Recomendado\s+([A-Z][A-Z\s]+?)(?=\s*\d+\s*estrellas|DETALLE|Precio:|🏨\s*Hotel|📍|⭐)/i;
    const hotelNameMatch1 = content.match(hotelNamePattern1);
    if (hotelNameMatch1) {
        hotelName = hotelNameMatch1[1].trim();
        console.log(`🏨 [HOTEL NAME - Pattern 1] "${hotelName}"`);
    } else {
        // Pattern 2: Look for text containing "Hotel", "Resort", "Aparthotel" that appears before "estrellas"
        const hotelNamePattern2 = /([A-Z][A-Z\s]*(?:HOTEL|RESORT|APARTHOTEL|INN|SUITES)[A-Z\s]*?)(?=\s*\d+\s*estrellas|DETALLE|🏨\s*Hotel|📍)/i;
        const hotelNameMatch2 = content.match(hotelNamePattern2);
        if (hotelNameMatch2) {
            hotelName = hotelNameMatch2[1].trim();
            console.log(`🏨 [HOTEL NAME - Pattern 2] "${hotelName}"`);
        }
    }

    // Extract location - more flexible pattern
    let location = 'Ubicación no especificada';

    // Pattern 1: After stars rating, look for location until we hit keywords that indicate end of location
    const locationPattern1 = /(\d+)\s*estrellas\s*([A-Za-zÀ-ÿ\s,]+?)(?=\s*(?:DETALLE|Precio:|🏨|📍|⭐|👥|Tarifa|Para confirmar|Ocupación))/i;
    const locationMatch1 = content.match(locationPattern1);
    if (locationMatch1) {
        location = locationMatch1[2].trim();
        console.log(`🏨 [LOCATION - Pattern 1] "${location}"`);
    } else {
        // Pattern 2: Look for specific known locations
        const knownLocations = /([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s,]*(?:Punta\s+Cana|PUNTA\s+CANA|Buenos\s+Aires|BUENOS\s+AIRES|Madrid|Barcelona|Miami|Cancún|CANCÚN|República\s+Dominicana)[A-Za-zÀ-ÿ\s,]*?)(?=\s*(?:DETALLE|Precio:|🏨|📍|⭐|👥|Tarifa|Ocupación))/i;
        const locationMatch2 = content.match(knownLocations);
        if (locationMatch2) {
            location = locationMatch2[1].trim();
            console.log(`🏨 [LOCATION - Pattern 2] "${location}"`);
        }
    }

    // Extract nights duration
    const nightsMatch = content.match(/(\d+)\s*(?:Noche|Noches|noche|noches)/i);
    const nights = nightsMatch ? parseInt(nightsMatch[1]) : 0;

    // Extract hotel price - try multiple patterns
    let hotelPrice = 0;

    // Pattern 1: Look for "Precio: $XXX USD" near Hotel section (with flexible spacing)
    const pricePattern1 = /Precio:\s*\$?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/i;
    const priceMatch1 = content.match(pricePattern1);
    if (priceMatch1) {
        hotelPrice = parsePrice(priceMatch1[1]);
        console.log(`🏨 [HOTEL PRICE PARSE - Pattern 1] "${priceMatch1[1]}" → ${hotelPrice}`);
    }

    // Pattern 1b: Try without spaces (for when PDF text is concatenated)
    if (hotelPrice === 0) {
        const pricePattern1b = /Precio:\$?(\d{1,10}(?:[.,]\d{1,3})+|\d+)USD/i;
        const priceMatch1b = content.match(pricePattern1b);
        if (priceMatch1b) {
            hotelPrice = parsePrice(priceMatch1b[1]);
            console.log(`🏨 [HOTEL PRICE PARSE - Pattern 1b No Spaces] "${priceMatch1b[1]}" → ${hotelPrice}`);
        }
    }

    // Pattern 2: Look for price after hotel name in the hotel section
    if (hotelPrice === 0) {
        const hotelSection = content.match(/Hotel Recomendado[\s\S]{0,500}?(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/i);
        if (hotelSection) {
            hotelPrice = parsePrice(hotelSection[1]);
            console.log(`🏨 [HOTEL PRICE PARSE - Pattern 2] "${hotelSection[1]}" → ${hotelPrice}`);
        }
    }

    // Pattern 3: If still not found, look for any USD price that's not the total
    if (hotelPrice === 0) {
        const allPrices = [...content.matchAll(/(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/gi)];
        console.log(`🏨 [HOTEL PRICE PARSE - Pattern 3] Found ${allPrices.length} USD prices in document`);

        // Filter out the total price (usually the largest one or marked as "Precio total")
        const prices = allPrices
            .map(m => ({ text: m[1], value: parsePrice(m[1]) }))
            .filter(p => p.value > 0 && p.value < 100000); // Reasonable range

        if (prices.length >= 2) {
            // If we have multiple prices, the hotel is likely the smaller one (not the total)
            prices.sort((a, b) => a.value - b.value);
            hotelPrice = prices[0].value; // Take the smallest (likely hotel per night or total)
            console.log(`🏨 [HOTEL PRICE PARSE - Pattern 3] Using smallest price: ${hotelPrice}`);
        }
    }

    // Pattern 4: Calculate hotel price from total - flight price (FALLBACK CALCULATION)
    // This is useful when the PDF has total price but not individual hotel price
    if (hotelPrice === 0) {
        console.log(`🏨 [HOTEL PRICE PARSE - Pattern 4] Attempting calculation from total - flight`);

        // Extract ALL prices from the entire document
        const allUsdPrices = [...content.matchAll(/\$?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/gi)];
        const parsedPrices = allUsdPrices
            .map(m => parsePrice(m[1]))
            .filter(p => p > 0 && p < 100000);

        console.log(`💰 [ALL PRICES] Found ${parsedPrices.length} USD prices:`, parsedPrices);

        if (parsedPrices.length === 1) {
            // Only one price found - this is the total package price
            // We can't separate hotel from flight, so return 0 for hotel
            // The total will be shown in the analysis
            console.log(`⚠️ [HOTEL PRICE] Only total price found: ${parsedPrices[0]}. Cannot determine hotel price separately.`);
            hotelPrice = 0; // Will show total in analysis instead
        } else if (parsedPrices.length >= 2) {
            // Multiple prices found
            const totalPrice = Math.max(...parsedPrices); // Largest is likely the total
            const otherPrices = parsedPrices.filter(p => p !== totalPrice);

            console.log(`💰 [TOTAL PRICE] Identified as largest: ${totalPrice}`);
            console.log(`💰 [OTHER PRICES] ${otherPrices.join(', ')}`);

            // Try to find flight price more intelligently
            let flightPrice = 0;

            // Strategy 1: Look for price near flight-related keywords
            const flightSection = content.match(/(?:Vuelos?|✈️|Copa|Aerolínea|Flight)[\s\S]{0,200}?\$?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*USD/i);
            if (flightSection) {
                const possibleFlightPrice = parsePrice(flightSection[1]);
                if (possibleFlightPrice < totalPrice && otherPrices.includes(possibleFlightPrice)) {
                    flightPrice = possibleFlightPrice;
                    console.log(`✈️ [FLIGHT PRICE - Strategy 1] Found near flight keywords: ${flightPrice}`);
                }
            }

            // Strategy 2: If still no flight price, check if we have exactly 2 prices (flight + hotel)
            if (flightPrice === 0 && otherPrices.length === 1) {
                // Assume the other price is the flight price
                flightPrice = otherPrices[0];
                console.log(`✈️ [FLIGHT PRICE - Strategy 2] Assumed from pair: ${flightPrice}`);
            }

            // Calculate hotel price
            if (totalPrice > 0 && flightPrice > 0 && totalPrice > flightPrice) {
                hotelPrice = totalPrice - flightPrice;
                console.log(`🏨 [HOTEL PRICE CALC] Calculated: ${totalPrice} - ${flightPrice} = ${hotelPrice}`);
            } else {
                console.log(`⚠️ [HOTEL PRICE] Could not reliably calculate hotel price from available data`);
            }
        }
    }

    hotels.push({
        name: hotelName,
        location,
        price: hotelPrice,
        nights
    });

    console.log('🏨 Extracted hotels from PdfMonkey template:', hotels);
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
