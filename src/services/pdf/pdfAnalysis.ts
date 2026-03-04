import { supabase } from '@/integrations/supabase/client';
import type { AirfareSearchParams } from '../airfareSearch';
import type { PdfAnalysisResult, PdfUploadResult, CheaperFlightSearchResult } from './pdfTypes';
import { isPdfMonkeyTemplate, extractPdfMonkeyDataFromContent, parseExtractedTravelData } from './pdfExtraction';
import { extractPriceFromMessage, extractMultiplePricesFromMessage, extractDualOptionPrices, extractMultipleHotelPricesFromMessage } from './pdfPriceParser';
import { generateModifiedPdf, generateModifiedPdfWithIndividualPrices, generateModifiedPdfWithHotelPrice, generateModifiedPdfWithMultipleHotelPrices } from './pdfGeneration';
import { getCityNameFromCode, parseFlightRoute, parseDate } from './pdfParsingUtils';
import { formatParsedDataForStarling, searchFlightsWithStarling } from './pdfFlightSearch';

/**
 * Upload a PDF file to Supabase Storage
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
 * Analyze PDF content - extract text, use AI analyzer, fallback to regex
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

        // Use AI-powered extraction for better accuracy
        console.log('🤖 Sending PDF text to AI analyzer for structured extraction...');

        const { data: aiResult, error: aiError } = await supabase.functions.invoke('pdf-ai-analyzer', {
            body: {
                pdfText: extractedText,
                fileName: file.name
            }
        });

        if (aiError) {
            console.warn('⚠️ AI analyzer error, falling back to regex extraction:', aiError);
            // Fallback to regex-based extraction
            if (isPdfMonkeyTemplate(file.name, extractedText)) {
                return extractPdfMonkeyDataFromContent(file.name, extractedText);
            }
            const parsedData = parseExtractedTravelData(extractedText);
            return {
                success: true,
                content: parsedData,
                suggestions: generateDefaultSuggestions()
            };
        }

        if (aiResult?.success && aiResult?.data) {
            console.log('✅ AI extraction successful:', JSON.stringify(aiResult.data, null, 2));

            // Convert AI response to our expected format
            const aiData = aiResult.data;

            // Get passenger counts
            const adults = aiData.passengers?.adults || 2;
            const children = aiData.passengers?.children || 0;
            const totalPassengers = aiData.passengers?.total || adults + children;

            // Build flights array with full structure including legs
            const flights = (aiData.flights || []).map((f: any) => {
                const origin = f.origin || 'XXX';
                const destination = f.destination || 'XXX';
                const date = f.date || '';

                // Get city names from AI or use lookup table as fallback
                const originCity = f.originCity || getCityNameFromCode(origin);
                const destinationCity = f.destinationCity || getCityNameFromCode(destination);

                // Get times and duration from AI (with fallbacks)
                const departureTime = f.departureTime || '00:00';
                const arrivalTime = f.arrivalTime || '00:00';
                const duration = f.duration || '0h 0m';

                // Process layovers from AI
                const layovers = (f.layovers || []).map((l: any) => ({
                    airport: {
                        code: l.airport || '',
                        city: l.city || getCityNameFromCode(l.airport || '')
                    },
                    duration: l.waitTime || '0h 0m'
                }));

                // Create leg structure with complete data from AI
                const leg = {
                    departure: {
                        city_code: origin,
                        city_name: originCity,
                        time: departureTime
                    },
                    arrival: {
                        city_code: destination,
                        city_name: destinationCity,
                        time: arrivalTime
                    },
                    duration: duration,
                    flight_type: f.direction === 'return' ? 'return' : 'outbound',
                    layovers: layovers
                };

                console.log(`✈️ [AI] Flight ${f.direction}: ${originCity} (${origin}) → ${destinationCity} (${destination}), ${departureTime}-${arrivalTime}, duration: ${duration}, layovers: ${layovers.length}`);

                return {
                    airline: f.airline || 'Aerolínea no especificada',
                    airlineCode: f.airlineCode || '',
                    route: f.route || `${origin} → ${destination}`,
                    origin: origin,
                    destination: destination,
                    originCity: originCity,
                    destinationCity: destinationCity,
                    price: f.price || 0,
                    dates: date,
                    direction: f.direction || 'outbound',
                    departureTime: departureTime,
                    arrivalTime: arrivalTime,
                    duration: duration,
                    // Include leg structure for PDF generation
                    legs: [leg],
                    adults: adults,
                    childrens: children
                };
            });

            // Build hotels array with proper structure
            const hotels = (aiData.hotels || []).map((h: any) => {
                // Use address from AI if available, otherwise use location
                const address = h.address || h.location || '';
                const location = h.location || '';

                console.log(`🏨 [AI] Hotel "${h.name}": location="${location}", address="${address}"`);

                return {
                    name: h.name || 'Hotel no especificado',
                    location: location,
                    address: address, // Full address for PDF
                    price: 0, // Individual hotel price not available when bundled
                    nights: h.nights || aiData.nights || 7,
                    category: h.stars ? String(h.stars) : undefined,
                    packagePrice: h.packagePrice || 0,
                    roomDescription: h.roomType || undefined,
                    roomType: h.roomType || undefined,
                    mealPlan: h.mealPlan || undefined,
                    optionNumber: h.optionNumber || 0,
                    // Use per-hotel dates from AI if available, otherwise fall back to global dates
                    check_in: h.checkIn || aiData.dates?.departure || '',
                    check_out: h.checkOut || aiData.dates?.return || '',
                    segmentCity: location || undefined
                };
            });

            // Calculate destination from flights (use route format)
            let destination = '';
            if (aiData.flights && aiData.flights.length > 0) {
                const outbound = aiData.flights.find((f: any) => f.direction === 'outbound') || aiData.flights[0];
                destination = `${outbound.origin || '???'} -- ${outbound.destination || '???'}`;
            }

            // Find total price - prefer AI-extracted totalPrice, then max packagePrice, then sum of flight prices
            const totalPrice = aiData.totalPrice && aiData.totalPrice > 0
                ? aiData.totalPrice
                : (hotels.length > 0
                    ? Math.max(...hotels.map((h: any) => h.packagePrice || 0))
                    : flights.reduce((sum: number, f: any) => sum + (f.price || 0), 0));

            console.log('🚗 [ANALYZE PDF] Transfers from AI:', aiData.hasTransfers);
            console.log('🏥 [ANALYZE PDF] Travel assistance from AI:', aiData.hasTravelAssistance);

            return {
                success: true,
                content: {
                    flights,
                    hotels,
                    totalPrice,
                    currency: aiData.currency || 'USD',
                    passengers: totalPassengers,
                    adults: adults,
                    children: children,
                    destination,
                    extractedFromAI: true,
                    // Store dates for PDF generation
                    dates: aiData.dates,
                    // Preserve transfers and travel assistance from AI extraction
                    hasTransfers: aiData.hasTransfers || false,
                    hasTravelAssistance: aiData.hasTravelAssistance || false
                },
                suggestions: generateDefaultSuggestions()
            };
        }

        // Fallback to regex-based extraction if AI fails
        console.warn('⚠️ AI extraction returned no data, falling back to regex extraction');

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
            suggestions: generateDefaultSuggestions()
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

    const { content } = analysis;

    // Check if we have meaningful data extracted - also check for packagePrice in hotels (AI extraction)
    const hasHotelsWithPackagePrice = content.hotels && content.hotels.some((h: any) => h.packagePrice > 0);
    const hasValidData = (content.flights && content.flights.length > 0 && content.flights[0].price > 0) ||
        (content.hotels && content.hotels.length > 0 && content.hotels[0].price > 0) ||
        hasHotelsWithPackagePrice ||
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
            response += `${flight.airline} - ${flight.route}`;

            if (flight.dates) {
                response += ` 📅 ${flight.dates}`;
            }

            // Show price if available
            if (flight.price > 0) {
                response += ` | 💰 $${flight.price.toFixed(2)}\n\n`;
            } else {
                response += `\n💡 _Precio incluido en el total del paquete_\n\n`;
            }
        });

        response += `\n`;
    }

    // Hotel information - handle both AI-extracted (with optionNumber) and regex-extracted data
    if (content.hotels && content.hotels.length > 0) {
        response += `🏨 **Hoteles Encontrados:**\n\n`;

        // Sort hotels by optionNumber if available, otherwise keep original order
        const sortedHotels = [...content.hotels].sort((a: any, b: any) => {
            if (a.optionNumber && b.optionNumber) {
                return a.optionNumber - b.optionNumber;
            }
            return 0;
        });

        sortedHotels.forEach((hotel: any) => {
            // Clean hotel name - remove "(Opción X)" suffix if present
            const cleanName = hotel.name.replace(/\s*\(Opción\s+\d+\)/i, '');

            // Build hotel line with category (stars) if available
            let hotelLine = cleanName;
            if (hotel.category) {
                hotelLine += ` ⭐ ${hotel.category} estrellas`;
            }
            if (hotel.location && hotel.location !== 'Ubicación no especificada') {
                hotelLine += ` - ${hotel.location}`;
            }
            response += `${hotelLine}\n`;

            // Show room type and meal plan if available (AI extraction)
            if (hotel.roomType || hotel.roomDescription) {
                response += `🛏️ ${hotel.roomType || hotel.roomDescription}\n`;
            }
            if (hotel.mealPlan) {
                response += `🍽️ ${hotel.mealPlan}\n`;
            }

            // Show nights
            if (hotel.nights > 0) {
                response += `🌙 ${hotel.nights} ${hotel.nights === 1 ? 'noche' : 'noches'}\n`;
            }

            // Only show price if we have a valid individual hotel price
            if (hotel.price > 0) {
                const pricePerNight = hotel.nights > 0 ? (hotel.price / hotel.nights).toFixed(2) : hotel.price.toFixed(2);
                response += `💰 $${hotel.price.toFixed(2)} total ($${pricePerNight}/noche)\n`;
            } else {
                response += `💡 _Precio incluido en el total del paquete_\n`;
            }

            response += `\n`;
        });
    }

    // Show price options when there are multiple hotels with package prices
    const hotelsWithPackagePrice = (content.hotels || []).filter((h: any) => h.packagePrice > 0);

    if (hotelsWithPackagePrice.length >= 2) {
        // Sort by optionNumber or packagePrice
        const sortedOptions = [...hotelsWithPackagePrice].sort((a: any, b: any) => {
            if (a.optionNumber && b.optionNumber) return a.optionNumber - b.optionNumber;
            return a.packagePrice - b.packagePrice;
        });

        response += `💰 **Opciones de Precio:**\n\n`;

        sortedOptions.forEach((hotel: any, idx: number) => {
            const optionNum = hotel.optionNumber || (idx + 1);
            const cleanName = hotel.name.replace(/\s*\(Opción\s+\d+\)/i, '');
            response += `• **Opción ${optionNum}:** $${hotel.packagePrice.toFixed(2)} ${content.currency || 'USD'} (${cleanName})\n\n`;
        });
    } else if (content.totalPrice && content.totalPrice > 0) {
        // Single price display for simple quotes
        response += `💰 **Precio Total:** $${content.totalPrice.toFixed(2)} ${content.currency || 'USD'}\n\n`;
    }

    // Passengers
    if (content.passengers) {
        response += `👥 **Pasajeros:** ${content.passengers}\n\n`;
    }

    // Price change suggestions
    response += `💬 **¿Qué te gustaría modificar?**\n\n`;
    response += `Puedes pedirme:\n\n`;

    if (hotelsWithPackagePrice.length >= 3) {
        response += `• "Cambia el precio de la opción 1 a [cantidad]"\n`;
        response += `• "Cambia el precio de la opción 2 a [cantidad]"\n`;
        response += `• "Cambia el precio de la opción 3 a [cantidad]"\n`;
        response += `• "Cambia el precio total a [cantidad]"\n`;
    } else if (hotelsWithPackagePrice.length >= 2) {
        response += `• "Cambia el precio de la opción 1 a [cantidad]"\n`;
        response += `• "Cambia el precio de la opción 2 a [cantidad]"\n`;
        response += `• "Cambia el precio total a [cantidad]"\n`;
    } else {
        response += `• "Cambia el precio total a [cantidad]"\n`;
    }

    return response;
}

/**
 * Generate default suggestions for PDF analysis
 */
function generateDefaultSuggestions(): string[] {
    return [
        "Puedo buscar vuelos con mejores horarios o conexiones más cortas",
        "Hay hoteles con mejor ubicación disponibles en las mismas fechas",
        "Podría encontrar opciones más económicas con fechas flexibles",
        "¿Te interesa agregar servicios adicionales como traslados o seguro de viaje?"
    ];
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
 * Process a price change request from the user
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
        const { extractPriceChangeTarget, extractRelativeAdjustment } = await import('@/features/chat/utils/intentDetection');

        // Detect what type of price change the user wants
        const changeTarget = extractPriceChangeTarget(request);
        console.log('🎯 Price change target detected:', changeTarget);

        // NUEVO: Check for MULTI option price changes (opción 1, 2, and optionally 3 in the same message)
        const multiOptions = extractDualOptionPrices(request);
        if (multiOptions) {
            const hasOption3 = multiOptions.option3Price !== undefined;
            console.log(`💎 [MULTI OPTIONS] Processing ${hasOption3 ? 'triple' : 'dual'} option price change:`, multiOptions);

// Check if we have enough options (hotels OR flights)
            const requiredOptions = hasOption3 ? 3 : 2;
            const hasEnoughHotels = analysis.content?.hotels && analysis.content.hotels.length >= requiredOptions;

            // Calculate flight pairs (outbound + return = 1 option)
            const flightPairs = analysis.content?.flights ?
                Math.floor(analysis.content.flights.length / 2) : 0;
            const hasEnoughFlights = flightPairs >= requiredOptions;

            console.log(`🔍 [OPTION VALIDATION] Required: ${requiredOptions}, Hotels: ${analysis.content?.hotels?.length || 0}, Flight pairs: ${flightPairs}`);

            // First check if analysis failed completely
            if (!analysis.success || !analysis.content) {
                return {
                    response: `❌ No puedo modificar las opciones porque no se pudo analizar el PDF correctamente.`
                };
            }

            // Check if we have neither enough hotels nor flights
            if (!hasEnoughHotels && !hasEnoughFlights) {
                return {
                    response: `❌ No puedo modificar las opciones porque el PDF no contiene ${requiredOptions} o más opciones. Esta función está disponible para:\n\n• PDFs con ${requiredOptions} o más hoteles (opciones de hotel)\n• PDFs con ${requiredOptions} o más pares de vuelos (opciones de vuelo)\n\nVerifica que tu PDF tenga suficientes opciones disponibles.`
                };
            }

            // PRIORITY: If we have enough flights, use flight logic (even if hotels exist)
            // This handles the case where PDF has flight options but no hotel options
            if (hasEnoughFlights && !hasEnoughHotels) {
                // We have flight options but not hotel options - use flight logic
                console.log('✈️ [FLIGHT OPTIONS] Detected flight options without hotel options, using flight price change logic');

                // Convert multi-option prices to individual flight price changes
                const priceChanges: Array<{ position: number, price: number }> = [];
                priceChanges.push({ position: 1, price: multiOptions.option1Price });
                priceChanges.push({ position: 2, price: multiOptions.option2Price });
                if (hasOption3 && multiOptions.option3Price !== undefined) {
                    priceChanges.push({ position: 3, price: multiOptions.option3Price });
                }

                // Use the existing flight price change function
                const result = await generateModifiedPdfWithIndividualPrices(
                    analysis,
                    priceChanges,
                    conversationId
                );

                if (!result.success || !result.pdfUrl) {
                    return {
                        response: `❌ **Error generando PDF**\n\nNo pude generar el PDF con las opciones de vuelo modificadas. Error: ${result.error || 'desconocido'}\n\n¿Podrías intentar nuevamente?`
                    };
                }

                // Build response for flight options
                let responseMsg = `✅ **${hasOption3 ? 'Tres Opciones' : 'Dos Opciones'} de Vuelo Modificadas**\n\n` +
                    `📦 **Opción 1:**\n` +
                    `✈️ Vuelo modificado\n` +
                    `💰 Nuevo precio: $${multiOptions.option1Price.toFixed(2)} USD\n\n` +
                    `📦 **Opción 2:**\n` +
                    `✈️ Vuelo modificado\n` +
                    `💰 Nuevo precio: $${multiOptions.option2Price.toFixed(2)} USD\n\n`;

                if (hasOption3 && multiOptions.option3Price !== undefined) {
                    responseMsg += `📦 **Opción 3:**\n` +
                        `✈️ Vuelo modificado\n` +
                        `💰 Nuevo precio: $${multiOptions.option3Price.toFixed(2)} USD\n\n`;
                }

                responseMsg += `📄 PDF adjunto con ${hasOption3 ? 'las tres opciones' : 'ambas opciones'} de vuelo actualizadas.`;

                return {
                    response: responseMsg,
                    modifiedPdfUrl: result.pdfUrl
                };
            }

            // From here on, we process hotel options (hasEnoughHotels is true)
            // Identify option hotels by optionNumber (AI extraction), then name pattern, then positional index
            let option1Hotel = analysis.content.hotels!.find((h: any) =>
                h.optionNumber === 1 || h.name.match(/\(Opción\s+1\)/i)
            );
            let option2Hotel = analysis.content.hotels!.find((h: any) =>
                h.optionNumber === 2 || h.name.match(/\(Opción\s+2\)/i)
            );
            let option3Hotel = hasOption3 ? analysis.content.hotels!.find((h: any) =>
                h.optionNumber === 3 || h.name.match(/\(Opción\s+3\)/i)
            ) : null;

            // Fallback to positional index if neither optionNumber nor "(Opción N)" format
            if (!option1Hotel && analysis.content.hotels!.length >= 1) {
                option1Hotel = analysis.content.hotels![0];
                console.log('⚠️ [MULTI OPTIONS] Using positional index for Option 1:', option1Hotel.name);
            }
            if (!option2Hotel && analysis.content.hotels!.length >= 2) {
                option2Hotel = analysis.content.hotels![1];
                console.log('⚠️ [MULTI OPTIONS] Using positional index for Option 2:', option2Hotel.name);
            }
            if (hasOption3 && !option3Hotel && analysis.content.hotels!.length >= 3) {
                option3Hotel = analysis.content.hotels![2];
                console.log('⚠️ [MULTI OPTIONS] Using positional index for Option 3:', option3Hotel.name);
            }

            if (!option1Hotel || !option2Hotel || (hasOption3 && !option3Hotel)) {
                console.log('❌ [MULTI OPTIONS] Could not identify all option hotels');
                return {
                    response: `❌ No pude identificar las opciones ${hasOption3 ? '1, 2 y 3' : '1 y 2'} en el PDF. Verifica que el PDF tenga hoteles con "(Opción N)" en el nombre.`
                };
            }

            console.log('🏨 [MULTI OPTIONS] Option 1 hotel:', option1Hotel.name);
            console.log('🏨 [MULTI OPTIONS] Option 2 hotel:', option2Hotel.name);
            if (option3Hotel) {
                console.log('🏨 [MULTI OPTIONS] Option 3 hotel:', option3Hotel.name);
            }

            // Get original package prices from each option
            const option1OriginalPrice = (option1Hotel as any).packagePrice || analysis.content.totalPrice || 0;
            const option2OriginalPrice = (option2Hotel as any).packagePrice || analysis.content.totalPrice || 0;
            const option3OriginalPrice = option3Hotel ? ((option3Hotel as any).packagePrice || analysis.content.totalPrice || 0) : 0;

            console.log(`📦 [MULTI OPTIONS] Option 1 original package price: $${option1OriginalPrice}`);
            console.log(`📦 [MULTI OPTIONS] Option 2 original package price: $${option2OriginalPrice}`);
            if (hasOption3) {
                console.log(`📦 [MULTI OPTIONS] Option 3 original package price: $${option3OriginalPrice}`);
            }

            // Calculate proportional adjustments for each option
            const option1Ratio = multiOptions.option1Price / option1OriginalPrice;
            const option2Ratio = multiOptions.option2Price / option2OriginalPrice;
            const option3Ratio = hasOption3 && option3OriginalPrice > 0 ? multiOptions.option3Price! / option3OriginalPrice : 1;

            console.log(`📊 [MULTI OPTIONS] Option 1: ${option1OriginalPrice} → ${multiOptions.option1Price} (ratio: ${option1Ratio.toFixed(4)})`);
            console.log(`📊 [MULTI OPTIONS] Option 2: ${option2OriginalPrice} → ${multiOptions.option2Price} (ratio: ${option2Ratio.toFixed(4)})`);
            if (hasOption3) {
                console.log(`📊 [MULTI OPTIONS] Option 3: ${option3OriginalPrice} → ${multiOptions.option3Price} (ratio: ${option3Ratio.toFixed(4)})`);
            }

            // Create modified analysis with ALL option prices updated
            // Match by optionNumber (not name) so ALL hotels per option get metadata
            const modifiedAnalysis = { ...analysis };
            if (modifiedAnalysis.content) {
                modifiedAnalysis.content = {
                    ...modifiedAnalysis.content,
                    hotels: analysis.content.hotels?.map((hotel) => {
                        const hotelOptNum = (hotel as any).optionNumber;
                        const isOption1 = hotelOptNum === 1 || (!hotelOptNum && hotel.name === option1Hotel!.name);
                        const isOption2 = hotelOptNum === 2 || (!hotelOptNum && hotel.name === option2Hotel!.name);
                        const isOption3 = hasOption3 && (hotelOptNum === 3 || (!hotelOptNum && option3Hotel && hotel.name === option3Hotel.name));

                        if (isOption1) {
                            const newHotelPrice = hotel.price > 0 ? hotel.price * option1Ratio : 0;
                            console.log(`🏨 [MULTI] Updating Option 1 hotel: ${hotel.name}`);
                            console.log(`   Package price: $${option1OriginalPrice} → $${multiOptions.option1Price}`);
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
                            const newHotelPrice = hotel.price > 0 ? hotel.price * option2Ratio : 0;
                            console.log(`🏨 [MULTI] Updating Option 2 hotel: ${hotel.name}`);
                            console.log(`   Package price: $${option2OriginalPrice} → $${multiOptions.option2Price}`);
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
                            const newHotelPrice = hotel.price > 0 ? hotel.price * option3Ratio : 0;
                            console.log(`🏨 [MULTI] Updating Option 3 hotel: ${hotel.name}`);
                            console.log(`   Package price: $${option3OriginalPrice} → $${multiOptions.option3Price}`);
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
                    })
                };

                // Update flights to use average price (for template display)
                const priceSum = multiOptions.option1Price + multiOptions.option2Price + (multiOptions.option3Price || 0);
                const optionCount = hasOption3 ? 3 : 2;
                modifiedAnalysis.content.totalPrice = priceSum / optionCount;

                // Also update flights array with proportional pricing
                if (modifiedAnalysis.content.flights) {
                    const avgRatio = hasOption3
                        ? (option1Ratio + option2Ratio + option3Ratio) / 3
                        : (option1Ratio + option2Ratio) / 2;
                    modifiedAnalysis.content.flights = modifiedAnalysis.content.flights.map((flight: any) => ({
                        ...flight,
                        price: parseFloat((flight.price * avgRatio).toFixed(2))
                    }));
                }
            }

            // Generate single PDF with ALL modified options
            const priceSum = multiOptions.option1Price + multiOptions.option2Price + (multiOptions.option3Price || 0);
            const avgPrice = priceSum / (hasOption3 ? 3 : 2);
            const result = await generateModifiedPdf(
                modifiedAnalysis,
                avgPrice,
                conversationId
            );

            if (!result.success || !result.pdfUrl) {
                return {
                    response: `❌ **Error generando PDF**\n\nNo pude generar el PDF con las opciones modificadas. Error: ${result.error || 'desconocido'}\n\n¿Podrías intentar nuevamente?`
                };
            }

            // Build response message
            const cleanName1 = option1Hotel.name.replace(/\s*\(Opción\s+\d+\)/i, '');
            const cleanName2 = option2Hotel.name.replace(/\s*\(Opción\s+\d+\)/i, '');
            let responseMsg = `✅ **${hasOption3 ? 'Todas las Opciones' : 'Ambas Opciones'} Modificadas**\n\n` +
                `📦 **Opción 1:**\n` +
                `🏨 Hotel: ${cleanName1}\n` +
                `💰 Nuevo precio: $${multiOptions.option1Price.toFixed(2)} USD\n\n` +
                `📦 **Opción 2:**\n` +
                `🏨 Hotel: ${cleanName2}\n` +
                `💰 Nuevo precio: $${multiOptions.option2Price.toFixed(2)} USD\n\n`;

            if (hasOption3 && option3Hotel) {
                const cleanName3 = option3Hotel.name.replace(/\s*\(Opción\s+\d+\)/i, '');
                responseMsg += `📦 **Opción 3:**\n` +
                    `🏨 Hotel: ${cleanName3}\n` +
                    `💰 Nuevo precio: $${multiOptions.option3Price!.toFixed(2)} USD\n\n`;
            }

            responseMsg += `📄 PDF adjunto con ${hasOption3 ? 'las tres opciones' : 'ambas opciones'} actualizadas.`;

            return {
                response: responseMsg,
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

        // NUEVO: Handler para cambios de precio económico/premium/opcion3 (MOVED UP - must execute before extractMultipleHotelPricesFromMessage)
        if (changeTarget === 'economico' || changeTarget === 'premium' || changeTarget === 'opcion3') {
            console.log(`💰 Processing ${changeTarget} price change`);

            // Validar que hay 2+ hoteles
            if (!analysis.success || !analysis.content ||
                !analysis.content.hotels || analysis.content.hotels.length < 2) {
                const label = changeTarget === 'economico' ? 'Opción 1' : changeTarget === 'premium' ? 'Opción 2' : 'Opción 3';
                return {
                    response: `❌ No puedo modificar la ${label} porque el PDF no contiene 2 o más hoteles. Esta opción solo está disponible para PDFs con múltiples opciones de hotel.`
                };
            }

            // Extraer precio solicitado
            const requestedPrice = extractPriceFromMessage(request);
            if (!requestedPrice) {
                const label = changeTarget === 'economico' ? 'Opción 1' : changeTarget === 'premium' ? 'Opción 2' : 'Opción 3';
                return {
                    response: `❌ No pude identificar el precio. Por favor especifica un monto, por ejemplo: "cambia la ${label.toLowerCase()} a 2000"`
                };
            }

            // Ordenar hoteles por precio
            const hotelsSortedByPrice = [...analysis.content.hotels].sort((a, b) => a.price - b.price);
            let targetHotel;
            if (changeTarget === 'economico') {
                targetHotel = hotelsSortedByPrice[0];
            } else if (changeTarget === 'premium') {
                targetHotel = hotelsSortedByPrice[hotelsSortedByPrice.length - 1];
            } else {
                // opcion3: middle hotel
                const middleIndex = Math.floor(hotelsSortedByPrice.length / 2);
                targetHotel = hotelsSortedByPrice[middleIndex];
            }

            // Encontrar índice original del hotel
            const targetHotelIndex = analysis.content.hotels.findIndex(h => h.name === targetHotel.name);

            if (targetHotelIndex < 0) {
                const label = changeTarget === 'economico' ? 'Opción 1' : changeTarget === 'premium' ? 'Opción 2' : 'Opción 3';
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
            const optionNumber = changeTarget === 'economico' ? 1 : changeTarget === 'premium' ? 2 : changeTarget === 'opcion3' ? 3 : 2;
            const result = await generateModifiedPdf(
                analysis,
                requestedPrice, // Precio total del paquete
                conversationId,
                optionNumber as 1 | 2 | 3 // Solo modificar esta opción
            );

            if (result.success && result.pdfUrl) {
                const label = changeTarget === 'economico' ? 'Opción 1' : changeTarget === 'premium' ? 'Opción 2' : 'Opción 3';
                // Limpiar nombre del hotel (remover sufijo "(Opción X)")
                const cleanHotelName = targetHotel.name.replace(/\s*\(Opción\s+\d+\)/i, '');

                return {
                    response: `✅ **${label} Modificada**\n\n` +
                        `🏨 **Hotel:** ${cleanHotelName}\n` +
                        `💰 **Nuevo precio total:** $${requestedPrice.toFixed(2)} USD\n\n` +
                        `Puedes descargar el PDF actualizado desde el archivo adjunto.`,
                    modifiedPdfUrl: result.pdfUrl
                };
            } else {
                const label = changeTarget === 'economico' ? 'Opción 1' : changeTarget === 'premium' ? 'Opción 2' : 'Opción 3';
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
