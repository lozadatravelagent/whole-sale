import { supabase } from '@/integrations/supabase/client';
import { searchAirFares } from '../airfareSearch';
import type { FlightData } from '@/types';

/**
 * Format parsed data for Starling API
 */
export function formatParsedDataForStarling(parsed: any) {
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
export async function searchFlightsWithStarling(starlingRequest: any): Promise<FlightData[]> {
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
