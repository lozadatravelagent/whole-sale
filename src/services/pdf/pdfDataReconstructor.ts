import { parseDateRange } from './pdfParsingUtils';
import type { PdfAnalysisResult } from './pdfTypes';

/**
 * Extract airline code from airline name
 */
export function extractAirlineCode(airlineName: string): string {
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

    if (airlineCodes[airlineName]) {
        return airlineCodes[airlineName];
    }

    for (const [name, code] of Object.entries(airlineCodes)) {
        if (airlineName.toLowerCase().includes(name.toLowerCase())) {
            return code;
        }
    }

    if (/^[A-Z]{2,3}$/.test(airlineName)) {
        return airlineName;
    }

    return airlineName.substring(0, 2).toUpperCase();
}

/**
 * Reconstruct FlightData from extracted PDF data
 */
export function reconstructFlightData(analysis: PdfAnalysisResult, newPrice: number): any[] {
    if (!analysis.content?.flights) return [];

    const originalPrice = analysis.content.totalPrice || 0;
    const priceRatio = originalPrice > 0 ? newPrice / originalPrice : 1;
    const flights = analysis.content.flights;

    const hasValidLegData = flights.some(f => (f as any).legs && (f as any).legs.length > 0);
    if (!hasValidLegData) {
        console.log('⚠️ [RECONSTRUCT] No valid leg data found - this appears to be a hotel-only PDF');
        return [];
    }

    const flightGroups: any[][] = [];
    for (let i = 0; i < flights.length; i += 2) {
        if (i + 1 < flights.length && flights[i].airline === flights[i + 1].airline) {
            flightGroups.push([flights[i], flights[i + 1]]);
        } else {
            flightGroups.push([flights[i]]);
        }
    }

    console.log(`📦 Grouped ${flights.length} flights into ${flightGroups.length} option(s)`);

    return flightGroups.map((group, groupIndex) => {
        const firstFlight = group[0];
        const hasReturn = group.length === 2;

        const groupOriginalPrice = group.reduce((sum, f) => sum + f.price, 0);
        const groupNewPrice = parseFloat((groupOriginalPrice * priceRatio).toFixed(2));

        console.log(`✈️ Group ${groupIndex + 1}: ${firstFlight.airline} - ${group.length} flight(s), price: $${groupNewPrice}`);

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
                (flight as any).legs.forEach((leg: any) => {
                    allLegs.push({
                        ...leg,
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
            console.log(`⚠️ [RECONSTRUCT] Skipping group ${groupIndex + 1} - no leg data`);
            return null;
        }

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

        if (hasReturn && lastFlight.dates) {
            if (lastFlight.dates.includes(' / ')) {
                returnDate = lastFlight.dates.split(' / ')[1].trim();
            } else {
                returnDate = lastFlight.dates.trim();
            }
            console.log(`📅 [DATES CORRECTED] After using lastFlight:`, { returnDate });
        }

        console.log(`📅 [FINAL DATES]`, { departureDate, returnDate });

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
            adults: analysis.content?.adults ?? analysis.content?.passengers ?? 1,
            childrens: analysis.content?.childrens ?? 0,
            infants: analysis.content?.infants ?? 0,
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
            legs: allLegs,
            transfers: analysis.content?.hasTransfers ? {
                included: true,
                type: 'in_out' as const
            } : undefined,
            travel_assistance: analysis.content?.hasTravelAssistance ? {
                included: true
            } : undefined
        };
    }).filter(Boolean).map((flight, index) => {
        console.log(`✅ [RECONSTRUCT] Final flight ${index + 1} structure:`, {
            airline: flight.airline.name,
            price: flight.price.amount,
            legs_count: flight.legs.length,
            has_transfers: !!flight.transfers?.included,
            has_travel_assistance: !!flight.travel_assistance?.included,
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
export function reconstructHotelData(analysis: PdfAnalysisResult, newPrice: number, targetOption?: 1 | 2 | 3): any[] {
    if (!analysis.content?.hotels) return [];

    const arePackageOptions = analysis.content.hotels.length >= 2 &&
        analysis.content.hotels.every(h =>
            (h as any).optionNumber !== undefined || /\(Opción\s+\d+\)/i.test(h.name)
        );

    console.log(`🏨 [RECONSTRUCT] Hotels: ${analysis.content.hotels.length}, arePackageOptions: ${arePackageOptions}, targetOption: ${targetOption}`);

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

        if ((hotel as any)._packageMetadata) {
            const metadata = (hotel as any)._packageMetadata;
            adjustedNightlyPrice = hotel.price;
            adjustedTotalPrice = hotel.price;
            packageMetadata = metadata;
            console.log(`📦 [RECONSTRUCT] Using _packageMetadata for ${hotel.name}:`, metadata);
        } else if (arePackageOptions && targetOption) {
            const hotelOptionNumber = (hotel as any).optionNumber ||
                (hotel.name.match(/\(Opción\s+(\d+)\)/i)?.[1] ? parseInt(hotel.name.match(/\(Opción\s+(\d+)\)/i)![1]) : undefined);

            if (hotelOptionNumber === targetOption) {
                const flightsPrice = (analysis.content!.flights || []).reduce((sum, f) => sum + f.price, 0);
                const newHotelPrice = newPrice - flightsPrice;

                adjustedNightlyPrice = newHotelPrice;
                adjustedTotalPrice = newHotelPrice;

                console.log(`🏨 [RECONSTRUCT] Modified hotel ${hotel.name}: $${hotel.price} → $${adjustedTotalPrice} (flights: $${flightsPrice}, package: $${newPrice})`);
            } else {
                adjustedNightlyPrice = hotel.price;
                adjustedTotalPrice = hotel.price;
                console.log(`🏨 [RECONSTRUCT] Kept original for ${hotel.name}: $${hotel.price}`);
            }
        } else {
            adjustedNightlyPrice = parseFloat((hotel.price * priceRatio).toFixed(2));
            adjustedTotalPrice = parseFloat((adjustedNightlyPrice * hotel.nights).toFixed(2));
        }

        let checkIn = '';
        let checkOut = '';

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
                    checkOut = lastFlight.dates.split(' / ')[1]?.trim() || '';
                } else if (lastFlight.dates.includes(' | ')) {
                    checkOut = lastFlight.dates.split(' | ')[0].replace('📅', '').trim();
                } else {
                    checkOut = lastFlight.dates.replace('📅', '').trim();
                }
            } else if (hotel.nights > 0 && checkIn) {
                const checkInDate = new Date(checkIn);
                checkInDate.setDate(checkInDate.getDate() + hotel.nights);
                checkOut = checkInDate.toISOString().split('T')[0];
            }
        }

        const hotelId = `regenerated-hotel-${Date.now()}-${index}`;

        const roomDescription = hotel.roomDescription || hotel.roomType || 'Habitación estándar';
        const roomType = hotel.roomType || hotel.roomDescription || 'Standard';
        const mealPlan = (hotel as any).mealPlan || undefined;
        const optionNumber = (hotel as any).optionNumber || undefined;

        const hotelLocation = hotel.location && hotel.location !== 'Ubicación no especificada'
            ? hotel.location.substring(0, 20)
            : 'Ubicación no especificada';

        const hotelCategory = hotel.category || "5";

        console.log(`🏨 [RECONSTRUCT] Preserving hotel data for ${hotel.name}:`, {
            location: hotelLocation,
            category: hotelCategory,
            roomDescription,
            roomType,
            mealPlan,
            optionNumber
        });

        const hotelData: any = {
            id: hotelId,
            unique_id: hotelId,
            name: hotel.name,
            city: hotelLocation,
            address: hotelLocation,
            category: hotelCategory,
            nights: hotel.nights,
            check_in: checkIn,
            check_out: checkOut,
            rooms: [{
                type: roomType,
                description: roomDescription,
                price_per_night: adjustedNightlyPrice,
                total_price: adjustedTotalPrice,
                currency: analysis.content?.currency || 'USD',
                availability: 5,
                occupancy_id: `room-${index}-modified`
            }]
        };

        if (mealPlan) {
            hotelData.mealPlan = mealPlan;
        }

        if (optionNumber !== undefined) {
            hotelData.optionNumber = optionNumber;
        }

        if (packageMetadata) {
            hotelData._packageMetadata = packageMetadata;
            console.log(`✅ [RECONSTRUCT] Added _packageMetadata to ${hotel.name}:`, packageMetadata);
        }

        return hotelData;
    });
}
