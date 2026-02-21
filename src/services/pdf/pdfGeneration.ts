import { reconstructFlightData, reconstructHotelData, extractAirlineCode } from './pdfDataReconstructor';
import { parseDateRange } from './pdfParsingUtils';
import type { PdfAnalysisResult } from './pdfTypes';

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

        const { generateCombinedTravelPdf, generateFlightPdf } = await import('../pdfMonkey');

        if (!analysis.content) {
            throw new Error('No content available from PDF analysis');
        }

        const originalFlights = analysis.content.flights || [];

        if (originalFlights.length === 0) {
            throw new Error('No flights found in PDF analysis');
        }

        console.log(`📊 Original flights count: ${originalFlights.length}`);

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

        for (const change of priceChanges) {
            if (change.position < 1 || change.position > flightPairs.length) {
                throw new Error(`Invalid position: ${change.position}. PDF only has ${flightPairs.length} flight option(s).`);
            }
        }

        let newTotalPrice = 0;
        const modifiedFlights: any[] = [];

        flightPairs.forEach((pair, pairIndex) => {
            const pairPosition = pairIndex + 1;
            const priceChange = priceChanges.find(pc => pc.position === pairPosition);

            if (priceChange) {
                const newPairPrice = priceChange.price;
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
                modifiedFlights.push({ ...pair.outbound });
                modifiedFlights.push({ ...pair.return });

                newTotalPrice += pair.originalPrice;

                console.log(`➡️ Keeping pair ${pairPosition}: ${pair.outbound.airline} - Original total: $${pair.originalPrice}`);
            }
        });

        console.log(`💰 New total price: $${newTotalPrice}`);

        const modifiedAnalysis: PdfAnalysisResult = {
            ...analysis,
            content: {
                ...analysis.content!,
                flights: modifiedFlights,
                totalPrice: newTotalPrice
            }
        };

        const reconstructedFlights = reconstructFlightData(modifiedAnalysis, modifiedAnalysis.content!.totalPrice!);

        const hotels = analysis.content.hotels || [];
        const reconstructedHotels = hotels.length > 0 ? reconstructHotelData(analysis, newTotalPrice) : [];

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

        const { generateCombinedTravelPdf } = await import('../pdfMonkey');

        if (!analysis.content) {
            throw new Error('No content available from PDF analysis');
        }

        if (!analysis.content.hotels || analysis.content.hotels.length === 0) {
            throw new Error('No hotel information available');
        }

        const adjustedFlights = analysis.content.flights?.map((flight, index) => {
            if ((flight as any).legs && (flight as any).legs.length > 0) {
                return {
                    id: `hotel-modified-${Date.now()}-${index}`,
                    airline: {
                        code: extractAirlineCode(flight.airline),
                        name: flight.airline
                    },
                    price: {
                        amount: flight.price,
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

        const adjustedHotels = analysis.content.hotels?.map((hotel, index) => {
            let checkIn = '2025-11-01';
            let checkOut = '2025-11-15';

            if (analysis.content?.flights && analysis.content.flights.length > 0) {
                const firstFlight = analysis.content.flights[0];
                const lastFlight = analysis.content.flights[analysis.content.flights.length - 1];

                if (firstFlight.dates) {
                    if (firstFlight.dates.includes(' / ')) {
                        checkIn = firstFlight.dates.split(' / ')[0].trim();
                    } else if (firstFlight.dates.includes(' | ')) {
                        checkIn = firstFlight.dates.split(' | ')[0].replace('📅', '').trim();
                    } else {
                        checkIn = firstFlight.dates.replace('📅', '').trim();
                    }
                }

                if (lastFlight.dates && analysis.content.flights.length > 1) {
                    if (lastFlight.dates.includes(' / ')) {
                        checkOut = lastFlight.dates.split(' / ')[1]?.trim() || lastFlight.dates.split(' / ')[0].trim();
                    } else if (lastFlight.dates.includes(' | ')) {
                        checkOut = lastFlight.dates.split(' | ')[0].replace('📅', '').trim();
                    } else {
                        checkOut = lastFlight.dates.replace('📅', '').trim();
                    }
                } else if (hotel.nights > 0) {
                    const checkInDate = new Date(checkIn);
                    checkInDate.setDate(checkInDate.getDate() + hotel.nights);
                    checkOut = checkInDate.toISOString().split('T')[0];
                }
            }

            const hotelId = `hotel-price-modified-${Date.now()}-${index}`;

            const roomDescription = hotel.roomDescription || 'Habitación estándar';
            const roomType = hotel.roomType || 'Standard';
            const hotelLocation = hotel.location && hotel.location !== 'Ubicación no especificada'
                ? hotel.location.substring(0, 20) : 'Ubicación no especificada';
            const hotelCategory = hotel.category || '5';

            return {
                id: hotelId,
                unique_id: hotelId,
                name: hotel.name,
                city: hotelLocation,
                address: hotelLocation,
                category: hotelCategory,
                check_in: checkIn,
                check_out: checkOut,
                nights: hotel.nights || 7,
                rooms: [{
                    type: roomType,
                    description: roomDescription,
                    price_per_night: parseFloat((newHotelPrice / (hotel.nights || 7)).toFixed(2)),
                    total_price: newHotelPrice,
                    currency: analysis.content?.currency || 'USD',
                    availability: 5,
                    occupancy_id: `room-${index}`
                }],
                selectedRoom: {
                    type: roomType,
                    description: roomDescription,
                    price_per_night: parseFloat((newHotelPrice / (hotel.nights || 7)).toFixed(2)),
                    total_price: newHotelPrice,
                    currency: analysis.content?.currency || 'USD',
                    availability: 5,
                    occupancy_id: `room-${index}`
                }
            };
        }) || [];

        const flightsTotal = adjustedFlights.reduce((sum, f) => sum + (f.price?.amount || 0), 0);
        const hotelsTotal = newHotelPrice;
        const newTotalPrice = flightsTotal + hotelsTotal;

        console.log('💰 Price breakdown:', {
            flightsTotal,
            hotelsTotal: newHotelPrice,
            newTotalPrice
        });

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
 */
export async function generateModifiedPdfWithMultipleHotelPrices(
    analysis: PdfAnalysisResult,
    hotelChanges: Array<{ hotelIndex: number; hotelName?: string; referenceType: 'position' | 'name' | 'price_order'; newPrice: number }>,
    conversationId: string
): Promise<{ success: boolean; pdfUrl?: string; totalPrice?: number; error?: string }> {
    try {
        console.log('🏨🏨 Generating modified PDF with multiple hotel price changes:', hotelChanges);

        const { generateCombinedTravelPdf } = await import('../pdfMonkey');

        if (!analysis.content) {
            throw new Error('No content available from PDF analysis');
        }

        if (!analysis.content.hotels || analysis.content.hotels.length === 0) {
            throw new Error('No hotel information available');
        }

        const adjustedFlights = analysis.content.flights?.map((flight, index) => {
            if ((flight as any).legs && (flight as any).legs.length > 0) {
                return {
                    id: `multi-hotel-modified-${Date.now()}-${index}`,
                    airline: {
                        code: extractAirlineCode(flight.airline),
                        name: flight.airline
                    },
                    price: {
                        amount: flight.price,
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
                    legs: (flight as any).legs,
                    transfers: analysis.content?.hasTransfers ? {
                        included: true,
                        type: 'in_out' as const
                    } : undefined,
                    travel_assistance: analysis.content?.hasTravelAssistance ? {
                        included: true
                    } : undefined
                };
            }
            return null;
        }).filter(flight => flight !== null) || [];

        const adjustedHotels = analysis.content.hotels?.map((hotel, index) => {
            const priceChange = hotelChanges.find(change => change.hotelIndex === index);
            const finalPrice = priceChange ? priceChange.newPrice : hotel.price;

            let checkIn = '2025-11-01';
            let checkOut = '2025-11-15';

            if (analysis.content?.flights && analysis.content.flights.length > 0) {
                const firstFlight = analysis.content.flights[0];
                const lastFlight = analysis.content.flights[analysis.content.flights.length - 1];

                if (firstFlight.dates) {
                    if (firstFlight.dates.includes(' / ')) {
                        checkIn = firstFlight.dates.split(' / ')[0].trim();
                    } else if (firstFlight.dates.includes(' | ')) {
                        checkIn = firstFlight.dates.split(' | ')[0].replace('📅', '').trim();
                    } else {
                        checkIn = firstFlight.dates.replace('📅', '').trim();
                    }
                }

                if (lastFlight.dates && analysis.content.flights.length > 1) {
                    if (lastFlight.dates.includes(' / ')) {
                        checkOut = lastFlight.dates.split(' / ')[1]?.trim() || lastFlight.dates.split(' / ')[0].trim();
                    } else if (lastFlight.dates.includes(' | ')) {
                        checkOut = lastFlight.dates.split(' | ')[0].replace('📅', '').trim();
                    } else {
                        checkOut = lastFlight.dates.replace('📅', '').trim();
                    }
                } else if (hotel.nights > 0) {
                    const checkInDate = new Date(checkIn);
                    checkInDate.setDate(checkInDate.getDate() + hotel.nights);
                    checkOut = checkInDate.toISOString().split('T')[0];
                }
            }

            const hotelId = `multi-hotel-modified-${Date.now()}-${index}`;
            const pricePerNight = parseFloat((finalPrice / (hotel.nights || 7)).toFixed(2));

            const roomDescription = hotel.roomDescription || 'Habitación estándar';
            const roomType = hotel.roomType || 'Standard';
            const hotelLocation = hotel.location && hotel.location !== 'Ubicación no especificada'
                ? hotel.location.substring(0, 20) : 'Ubicación no especificada';
            const hotelCategory = hotel.category || '5';

            return {
                id: hotelId,
                unique_id: hotelId,
                name: hotel.name,
                city: hotelLocation,
                address: hotelLocation,
                category: hotelCategory,
                check_in: checkIn,
                check_out: checkOut,
                nights: hotel.nights || 7,
                rooms: [{
                    type: roomType,
                    description: roomDescription,
                    price_per_night: pricePerNight,
                    total_price: finalPrice,
                    currency: analysis.content?.currency || 'USD',
                    availability: 5,
                    occupancy_id: `room-${index}`
                }],
                selectedRoom: {
                    type: roomType,
                    description: roomDescription,
                    price_per_night: pricePerNight,
                    total_price: finalPrice,
                    currency: analysis.content?.currency || 'USD',
                    availability: 5,
                    occupancy_id: `room-${index}`
                }
            };
        }) || [];

        const flightsTotal = adjustedFlights.reduce((sum, f) => sum + (f.price?.amount || 0), 0);
        const hotelsTotal = adjustedHotels.reduce((sum, h) => sum + (h.selectedRoom?.total_price || 0), 0);
        const newTotalPrice = flightsTotal + hotelsTotal;

        console.log('💰 Price breakdown (multi-hotel):', {
            flightsTotal,
            hotelsTotal,
            newTotalPrice,
            hotelPrices: adjustedHotels.map(h => ({ name: h.name, price: h.selectedRoom?.total_price }))
        });

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
    targetOption?: 1 | 2 | 3
): Promise<{ success: boolean; pdfUrl?: string; error?: string }> {
    try {
        console.log('🔄 Generating modified PDF with new price:', newPrice);
        console.log('🎯 PDF source:', analysis.content?.extractedFromPdfMonkey ? 'PdfMonkey Template' : 'External PDF');

        const { generateCombinedTravelPdf, generateFlightPdf } = await import('../pdfMonkey');

        if (!analysis.content) {
            throw new Error('No content available from PDF analysis');
        }

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

            if (targetOption && analysis.content.hotels) {
                const arePackageOptions = analysis.content.hotels.length >= 2 &&
                    analysis.content.hotels.every(h => /\(Opción\s+\d+\)/i.test(h.name));

                if (arePackageOptions) {
                    console.log('📦 [METADATA] Adding package metadata to hotels');

                    const originalFlightPrice = analysis.content.flights?.reduce((sum, f) => sum + f.price, 0) || 0;
                    console.log(`✈️ [METADATA] Original flight price: $${originalFlightPrice}`);

                    adjustedHotels = adjustedHotels.map((hotel: any) => {
                        const optionMatch = hotel.name.match(/\(Opción\s+(\d+)\)/i);
                        if (optionMatch) {
                            const optionNumber = parseInt(optionMatch[1]);

                            let packagePrice: number;
                            if (optionNumber === targetOption) {
                                packagePrice = newPrice;
                                console.log(`📦 [METADATA] Option ${optionNumber} (MODIFIED): $${packagePrice}`);
                            } else {
                                const originalHotelData = analysis.content!.hotels?.find(h =>
                                    h.name.includes(`(Opción ${optionNumber})`)
                                );

                                if ((originalHotelData as any)?.packagePrice) {
                                    packagePrice = (originalHotelData as any).packagePrice;
                                    console.log(`📦 [METADATA] Option ${optionNumber} (ORIGINAL from packagePrice): $${packagePrice}`);
                                } else {
                                    packagePrice = originalFlightPrice + (originalHotelData?.price || 0);
                                    console.log(`📦 [METADATA] Option ${optionNumber} (ORIGINAL calculated): flight $${originalFlightPrice} + hotel $${originalHotelData?.price} = $${packagePrice}`);
                                }
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
            console.log('🔄 Adapting external PDF data with real data only');
            const priceRatio = originalPrice > 0 ? newPrice / originalPrice : 1;

            const adultsCount = (analysis.content as any)?.adults || analysis.content?.passengers || 2;
            const childrenCount = (analysis.content as any)?.children || 0;

            adjustedFlights = analysis.content.flights?.map((flight, index) => {
                const hasLegs = (flight as any).legs && (flight as any).legs.length > 0;

                if (hasLegs) {
                    console.log(`✅ [EXTERNAL] Flight ${index + 1} has leg data:`, {
                        legs_count: (flight as any).legs.length,
                        legs: (flight as any).legs.map((leg: any) => ({
                            flight_type: leg.flight_type,
                            route: `${leg.departure?.city_code} → ${leg.arrival?.city_code}`,
                            layovers_count: leg.layovers?.length || 0
                        }))
                    });

                    let departureDate = '';
                    let returnDate = '';

                    if (flight.dates) {
                        if (flight.dates.includes(' / ')) {
                            departureDate = flight.dates.split(' / ')[0].trim();
                            returnDate = flight.dates.split(' / ')[1]?.trim() || '';
                        } else {
                            const parsed = parseDateRange(flight.dates);
                            departureDate = parsed.departureDate;
                            returnDate = parsed.returnDate || '';
                        }
                    } else if ((flight as any).dates) {
                        departureDate = flight.dates;
                    }

                    if (!departureDate && (analysis.content as any)?.dates) {
                        departureDate = (analysis.content as any).dates.departure || '';
                        returnDate = (analysis.content as any).dates.return || '';
                    }

                    return {
                        id: `external-modified-${Date.now()}-${index}`,
                        airline: {
                            code: (flight as any).airlineCode || extractAirlineCode(flight.airline),
                            name: flight.airline
                        },
                        price: {
                            amount: parseFloat((flight.price * priceRatio).toFixed(2)),
                            currency: analysis.content?.currency || 'USD'
                        },
                        adults: adultsCount,
                        childrens: childrenCount,
                        departure_date: departureDate,
                        return_date: returnDate || departureDate,
                        legs: (flight as any).legs,
                        origin: (flight as any).origin,
                        destination: (flight as any).destination,
                        direction: (flight as any).direction,
                        transfers: analysis.content?.hasTransfers ? {
                            included: true,
                            type: 'in_out' as const
                        } : undefined,
                        travel_assistance: analysis.content?.hasTravelAssistance ? {
                            included: true
                        } : undefined
                    };
                } else {
                    console.warn('⚠️ External PDF has no leg data - skipping flight');
                    return null;
                }
            }).filter(flight => flight !== null) || [];

            if (adjustedFlights.length === 2) {
                const [flight1, flight2] = adjustedFlights;
                const sameAirline = flight1.airline?.name === flight2.airline?.name;
                const isOutboundReturn =
                    flight1.legs?.[0]?.flight_type === 'outbound' &&
                    flight2.legs?.[0]?.flight_type === 'return';

                if (sameAirline && isOutboundReturn) {
                    console.log('🔗 [EXTERNAL PDF] Combining outbound + return into single flight');

                    const combinedFlight = {
                        ...flight1,
                        return_date: flight2.departure_date,
                        legs: [
                            ...flight1.legs,
                            ...flight2.legs
                        ]
                    };

                    adjustedFlights = [combinedFlight];

                    console.log('✅ [EXTERNAL PDF] Combined flight:', {
                        airline: combinedFlight.airline?.name,
                        departure_date: combinedFlight.departure_date,
                        return_date: combinedFlight.return_date,
                        legs_count: combinedFlight.legs.length,
                        legs: combinedFlight.legs.map((l: any) => ({
                            type: l.flight_type,
                            route: `${l.departure?.city_code} → ${l.arrival?.city_code}`
                        }))
                    });
                }
            }

            adjustedHotels = analysis.content.hotels?.map((hotel, index) => {
                let checkIn = '';
                let checkOut = '';

                if ((analysis.content as any)?.dates) {
                    checkIn = (analysis.content as any).dates.departure || '';
                    checkOut = (analysis.content as any).dates.return || '';
                }

                if (!checkIn && (hotel as any).check_in) {
                    checkIn = (hotel as any).check_in;
                }
                if (!checkOut && (hotel as any).check_out) {
                    checkOut = (hotel as any).check_out;
                }

                if (!checkIn && analysis.content?.flights && analysis.content.flights.length > 0) {
                    const firstFlight = analysis.content.flights[0];
                    const lastFlight = analysis.content.flights[analysis.content.flights.length - 1];

                    if (firstFlight.dates) {
                        if (firstFlight.dates.includes(' / ')) {
                            checkIn = firstFlight.dates.split(' / ')[0].trim();
                        } else if (firstFlight.dates.includes(' | ')) {
                            checkIn = firstFlight.dates.split(' | ')[0].replace('📅', '').trim();
                        } else {
                            checkIn = firstFlight.dates.replace('📅', '').trim();
                        }
                    }

                    if (!checkOut) {
                        if (lastFlight.dates && analysis.content.flights.length > 1) {
                            if (lastFlight.dates.includes(' / ')) {
                                checkOut = lastFlight.dates.split(' / ')[1]?.trim() || lastFlight.dates.split(' / ')[0].trim();
                            } else if (lastFlight.dates.includes(' | ')) {
                                checkOut = lastFlight.dates.split(' | ')[0].replace('📅', '').trim();
                            } else {
                                checkOut = lastFlight.dates.replace('📅', '').trim();
                            }
                        }
                    }
                }

                if (checkIn && !checkOut && hotel.nights > 0) {
                    const checkInDate = new Date(checkIn);
                    checkInDate.setDate(checkInDate.getDate() + hotel.nights);
                    checkOut = checkInDate.toISOString().split('T')[0];
                }

                if (!checkIn) checkIn = new Date().toISOString().split('T')[0];
                if (!checkOut) {
                    const checkOutDate = new Date();
                    checkOutDate.setDate(checkOutDate.getDate() + (hotel.nights || 7));
                    checkOut = checkOutDate.toISOString().split('T')[0];
                }

                console.log(`🏨 Hotel dates: check_in=${checkIn}, check_out=${checkOut}, nights=${hotel.nights}`);

                const hotelId = `external-modified-hotel-${Date.now()}-${index}`;

                let roomTotalPrice: number;
                if ((hotel as any)._packageMetadata) {
                    roomTotalPrice = parseFloat((hotel.price * hotel.nights).toFixed(2));
                    console.log(`💰 [EXTERNAL PDF] Using specific price for ${hotel.name}: $${roomTotalPrice} (from _packageMetadata)`);
                } else {
                    roomTotalPrice = parseFloat((hotel.price * hotel.nights * priceRatio).toFixed(2));
                }

                const roomDescription = hotel.roomDescription || 'Habitación estándar';
                const roomType = hotel.roomType || 'Standard';
                const hotelAddress = (hotel as any).address || hotel.location || '';
                const hotelCity = hotel.location || '';
                const hotelCategory = hotel.category || '5';
                const mealPlan = (hotel as any).mealPlan || undefined;
                const optionNumber = (hotel as any).optionNumber;

                console.log(`🏨 [EXTERNAL] Hotel "${hotel.name}" AI data:`, {
                    city: hotelCity,
                    address: hotelAddress,
                    mealPlan,
                    optionNumber,
                    roomType,
                    packagePrice: (hotel as any).packagePrice
                });

                const hotelData: any = {
                    id: hotelId,
                    unique_id: hotelId,
                    name: hotel.name,
                    city: (hotelCity || hotelAddress).substring(0, 20),
                    address: (hotelAddress || hotelCity).substring(0, 20),
                    category: hotelCategory,
                    nights: hotel.nights || 0,
                    check_in: checkIn,
                    check_out: checkOut,
                    rooms: [{
                        type: roomType,
                        description: roomDescription,
                        total_price: roomTotalPrice,
                        currency: analysis.content?.currency || 'USD',
                        availability: 5,
                        occupancy_id: `external-room-${index}`,
                        meal_plan: mealPlan
                    }],
                    mealPlan: mealPlan,
                    optionNumber: optionNumber
                };

                if ((hotel as any)._packageMetadata) {
                    hotelData._packageMetadata = (hotel as any)._packageMetadata;
                    console.log(`✅ [EXTERNAL PDF] Preserved _packageMetadata for ${hotel.name}:`, (hotel as any)._packageMetadata);
                }

                return hotelData;
            }) || [];
        }

        const currentFlightsTotal = adjustedFlights.reduce((sum, f) => sum + (f.price?.amount || 0), 0);
        const currentHotelsTotal = adjustedHotels.reduce((sum, h) => sum + (h.rooms?.[0]?.total_price || 0), 0);
        const currentTotal = currentFlightsTotal + currentHotelsTotal;
        const deltaToTarget = parseFloat((newPrice - currentTotal).toFixed(2));

        if (deltaToTarget !== 0) {
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

        console.log('📄 Generating PDF with:', {
            flights: adjustedFlights.length,
            hotels: adjustedHotels.length,
            totalPrice: newPrice
        });

        let pdfResult;

        if (adjustedHotels.length > 0) {
            console.log('📄 Using combined PDF generation (flights + hotels)');
            pdfResult = await generateCombinedTravelPdf(adjustedFlights, adjustedHotels, undefined, true);
        } else {
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
