/**
 * Flight Transformer for API Search
 *
 * Adapted from src/features/chat/services/flightTransformer.ts
 * Provides advanced flight analysis including:
 * - Per-leg connections analysis
 * - Technical stops detection
 * - Baggage analysis per leg
 * - Extended price breakdown
 * - Segment details (bookingClass, equipment, fareBasis)
 */

import { formatDuration, getTaxDescription, getAirlineNameFromCode, calculateLayoverHours } from './flightHelpers.js';
import { analyzeBaggagePerLeg, getBaggageType, type PerLegBaggageInfo } from './baggageUtils.js';

// =============================================================================
// FLIGHT ANALYSIS TYPES
// =============================================================================

export interface FlightAnalysis {
    legs: LegAnalysis[];
    classification: FlightClassification;
}

export interface LegAnalysis {
    legNumber: number;
    options: OptionAnalysis[];
    hasDirectOptions: boolean;
    hasConnectionOptions: boolean;
    minConnections: number;
    maxConnections: number;
}

export interface OptionAnalysis {
    optionId: string;
    segmentCount: number;
    isDirect: boolean;
    connections: number;
    segmentConnections: number;
    technicalStops: number;
}

export interface FlightClassification {
    isCompleteDirect: boolean;
    hasDirectOptions: boolean;
    hasConnectionOptions: boolean;
    minTotalConnections: number;
    maxTotalConnections: number;
    perLegConnections: {
        minPerLeg: number;
        maxPerLeg: number;
        allLegsHaveSameConnections: boolean;
    };
}

export interface PerLegConnectionsInfo {
    minPerLeg: number;
    maxPerLeg: number;
    allLegsHaveSameConnections: boolean;
}

// =============================================================================
// FLIGHT ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Analyze flight type including per-leg connections and technical stops
 */
export function analyzeFlightType(fare: any): FlightAnalysis {
    const legs = fare.Legs || [];

    // Analyze each leg
    const legAnalysis: LegAnalysis[] = legs.map((leg: any) => {
        const options = leg.Options || [];

        // For each option, count segments AND technical stops
        const optionAnalysis: OptionAnalysis[] = options.map((option: any) => {
            const segments = option.Segments || [];

            // Count connections between segments
            const segmentConnections = Math.max(0, segments.length - 1);

            // Count technical stops WITHIN each segment
            const technicalStops = segments.reduce((total: number, segment: any) => {
                return total + (segment.Stops?.length || 0);
            }, 0);

            // Total connections = segment connections + technical stops
            const totalConnections = segmentConnections + technicalStops;

            return {
                optionId: option.FlightOptionID,
                segmentCount: segments.length,
                isDirect: segments.length === 1 && technicalStops === 0,
                connections: totalConnections,
                segmentConnections: segmentConnections,
                technicalStops: technicalStops
            };
        });

        return {
            legNumber: leg.LegNumber,
            options: optionAnalysis,
            hasDirectOptions: optionAnalysis.some(opt => opt.isDirect),
            hasConnectionOptions: optionAnalysis.some(opt => !opt.isDirect),
            minConnections: Math.min(...optionAnalysis.map(opt => opt.connections)),
            maxConnections: Math.max(...optionAnalysis.map(opt => opt.connections))
        };
    });

    // Flight classification
    const isCompleteDirect = legAnalysis.every(leg => leg.hasDirectOptions && !leg.hasConnectionOptions);
    const hasAnyConnections = legAnalysis.some(leg => leg.hasConnectionOptions);
    const totalMinConnections = legAnalysis.reduce((sum, leg) => sum + leg.minConnections, 0);
    const totalMaxConnections = legAnalysis.reduce((sum, leg) => sum + leg.maxConnections, 0);

    return {
        legs: legAnalysis,
        classification: {
            isCompleteDirect: isCompleteDirect,
            hasDirectOptions: legAnalysis.every(leg => leg.hasDirectOptions),
            hasConnectionOptions: hasAnyConnections,
            minTotalConnections: totalMinConnections,
            maxTotalConnections: totalMaxConnections,
            perLegConnections: {
                minPerLeg: legAnalysis.length > 0 ? Math.min(...legAnalysis.map(leg => leg.minConnections)) : 0,
                maxPerLeg: legAnalysis.length > 0 ? Math.max(...legAnalysis.map(leg => leg.maxConnections)) : 0,
                allLegsHaveSameConnections: legAnalysis.length > 0 && legAnalysis.every(leg =>
                    leg.minConnections === legAnalysis[0].minConnections &&
                    leg.maxConnections === legAnalysis[0].maxConnections
                )
            }
        }
    };
}

/**
 * Check if flight is completely direct (no connections, no technical stops)
 */
export function isDirectFlight(fare: any): boolean {
    const analysis = analyzeFlightType(fare);
    return analysis.classification.isCompleteDirect;
}

/**
 * Check if flight has exact number of connections
 */
export function hasExactConnectionsCount(fare: any, targetConnections: number): boolean {
    const analysis = analyzeFlightType(fare);
    return analysis.classification.minTotalConnections <= targetConnections &&
        analysis.classification.maxTotalConnections >= targetConnections;
}

/**
 * Check if each leg has exactly the specified number of connections
 */
export function hasExactConnectionsPerLeg(fare: any, targetConnectionsPerLeg: number): boolean {
    const analysis = analyzeFlightType(fare);
    const perLeg = analysis.classification.perLegConnections;

    return perLeg.allLegsHaveSameConnections &&
        perLeg.minPerLeg === targetConnectionsPerLeg &&
        perLeg.maxPerLeg === targetConnectionsPerLeg;
}

// =============================================================================
// FLIGHT TRANSFORMATION
// =============================================================================

export interface TransformOptions {
    adults?: number;
    children?: number;
    infants?: number;
    baseCurrency?: string;
}

/**
 * Transform TVC/Starling fare to standard flight format with extended information
 */
export function transformFare(fare: any, index: number, tvcData: any, options: TransformOptions = {}) {
    const legs = fare.Legs || [];
    const firstLeg = legs[0] || {};
    const firstOption = firstLeg.Options?.[0] || {};
    const firstSegment = firstOption.Segments?.[0] || {};
    const lastSegment = firstOption.Segments?.[firstOption.Segments?.length - 1] || firstSegment;

    // Return date from second leg if exists
    let returnDate = null;
    if (legs.length > 1) {
        const secondLeg = legs[1];
        const secondOption = secondLeg.Options?.[0] || {};
        const secondSegment = secondOption.Segments?.[0] || {};
        returnDate = secondSegment.Departure?.Date || null;
    }

    // Flight analysis
    const flightAnalysis = analyzeFlightType(fare);

    // Calculate technical stops
    const totalTechnicalStops = legs.reduce((total: number, leg: any) => {
        return total + (leg.Options || []).reduce((legTotal: number, option: any) => {
            return legTotal + (option.Segments || []).reduce((segTotal: number, segment: any) => {
                return segTotal + (segment.Stops?.length || 0);
            }, 0);
        }, 0);
    }, 0);

    const isDirectFlightResult = flightAnalysis.classification.isCompleteDirect && totalTechnicalStops === 0;
    const totalConnections = flightAnalysis.classification.minTotalConnections;
    const totalStops = totalTechnicalStops + totalConnections;

    // Baggage analysis per leg
    const baggageAnalysis = analyzeBaggagePerLeg(legs);

    // Overall baggage info (first segment for backward compatibility)
    const baggageInfo = firstSegment.Baggage || '';
    const baggageMatch = baggageInfo.match(/(\d+)PC|(\d+)KG/);
    const baggageQuantity = baggageMatch ? parseInt(baggageMatch[1] || baggageMatch[2]) : 0;
    const hasFreeBaggage = baggageQuantity > 0;

    // Carry-on info
    const carryOnQuantity = firstSegment.CarryOnBagInfo?.Quantity || firstSegment.carryOnBagInfo?.quantity || '0';
    const hasCarryOn = parseInt(carryOnQuantity) > 0;
    const carryOnWeight = firstSegment.CarryOnBagInfo?.Weight || firstSegment.carryOnBagInfo?.weight || null;
    const carryOnDimensions = firstSegment.CarryOnBagInfo?.Dimensions || firstSegment.carryOnBagInfo?.dimensions || null;

    // Determine baggage type
    const overallBaggageType = getBaggageType(baggageInfo, {
        quantity: carryOnQuantity,
        weight: carryOnWeight,
        dimensions: carryOnDimensions
    });

    // Airline info
    const airlineCode = firstSegment.Airline || 'N/A';
    const operatingAirlineName = firstSegment.OperatingAirlineName;
    const finalName = operatingAirlineName || getAirlineNameFromCode(airlineCode);

    return {
        id: fare.FareID || `tvc-fare-${index}`,
        airline: {
            code: airlineCode,
            name: finalName
        },
        price: {
            amount: fare.TotalAmount || 0,
            currency: fare.Currency || 'USD',
            // NEW: Extended price breakdown
            baseAmount: fare.FareAmount || 0,
            netAmount: fare.ExtendedFareInfo?.NetTotalAmount || fare.TotalAmount || 0,
            fareAmount: fare.ExtendedFareInfo?.NetFareAmount || fare.FareAmount || 0,
            taxAmount: fare.ExtendedFareInfo?.NetTaxAmount || fare.TaxAmount || 0,
            serviceAmount: fare.ServiceAmount || 0,
            commissionAmount: fare.CommissionAmount || 0,
            baseCurrency: tvcData?.BaseCurrency || options.baseCurrency || 'USD',
            localAmount: fare.IataTotalAmount || 0,
            localCurrency: fare.IataCurrency || fare.Currency || 'USD',
            // NEW: Detailed breakdown
            breakdown: {
                fareAmount: fare.FareAmount || 0,
                taxAmount: fare.TaxAmount || 0,
                serviceAmount: fare.ServiceAmount || 0,
                commissionAmount: fare.CommissionAmount || 0
            }
        },
        adults: options.adults || 1,
        children: options.children || 0,
        infants: options.infants || 0,
        departure_date: firstSegment.Departure?.Date || '',
        departure_time: firstSegment.Departure?.Time || '',
        arrival_date: lastSegment.Arrival?.Date || '',
        arrival_time: lastSegment.Arrival?.Time || '',
        return_date: returnDate,
        duration: {
            total: firstOption.OptionDuration || 0,
            formatted: formatDuration(firstOption.OptionDuration || 0)
        },
        stops: {
            count: totalStops,
            direct: isDirectFlightResult,
            connections: totalConnections + totalTechnicalStops,
            // NEW: Technical stops count
            technical: totalTechnicalStops,
            // NEW: Per-leg connections analysis
            perLegConnections: flightAnalysis.classification.perLegConnections
        },
        baggage: {
            included: hasFreeBaggage,
            details: baggageInfo,
            quantity: baggageQuantity,
            // NEW: Baggage type (checked|carryon|backpack|both|none)
            type: overallBaggageType.type,
            carryOn: carryOnQuantity,
            carryOnQuantity: carryOnQuantity,
            carryOnWeight: carryOnWeight,
            carryOnDimensions: carryOnDimensions,
            // NEW: Per-leg baggage analysis
            perLeg: baggageAnalysis.map(leg => ({
                legNumber: leg.legNumber,
                type: leg.type,
                quantity: leg.baggageQuantity,
                carryOnQuantity: leg.carryOnQuantity
            }))
        },
        cabin: {
            class: firstSegment.CabinClass || 'Y',
            brandName: firstSegment.BrandName || 'Economy'
        },
        booking: {
            validatingCarrier: fare.ValidatingCarrier || '',
            lastTicketingDate: fare.LastTicketingDate || '',
            fareType: fare.FareType || '',
            fareSupplier: fare.FareSupplier || '',
            fareSupplierCode: fare.FareSupplierCode || ''
        },
        // NEW: Passenger fares with tax details
        passengerFares: (fare.PaxFares || []).map((paxFare: any) => ({
            fareAmount: paxFare.PaxFareAmount || 0,
            taxAmount: paxFare.PaxTaxAmount || 0,
            commissionAmount: paxFare.PaxCommissionAmount || 0,
            totalAmount: paxFare.PaxTotalAmount || 0,
            passengerType: paxFare.PaxType || 'ADT',
            count: paxFare.Count || 1,
            // Tax details per passenger type
            taxDetails: (paxFare.PaxTaxDetail || []).map((taxDetail: any) => ({
                code: taxDetail.Code || '',
                amount: taxDetail.Amount || 0,
                currency: taxDetail.Currency || 'USD',
                description: getTaxDescription(taxDetail.Code)
            }))
        })),
        // NEW: Taxes array with descriptions
        taxes: (fare.TaxDetail || []).map((tax: any) => ({
            code: tax.Code || '',
            amount: tax.Amount || 0,
            currency: tax.Currency || 'USD',
            description: getTaxDescription(tax.Code)
        })),
        // Full leg structure with segment details
        legs: legs.map((leg: any, legIndex: number) => ({
            legNumber: leg.LegNumber || legIndex + 1,
            options: (leg.Options || []).map((option: any) => ({
                optionId: option.FlightOptionID || '',
                duration: option.OptionDuration || 0,
                segments: (option.Segments || []).map((segment: any) => ({
                    segmentNumber: segment.SegmentNumber || 0,
                    airline: segment.Airline || '',
                    operatingAirline: segment.OperatingAirline || segment.Airline || '',
                    operatingAirlineName: segment.OperatingAirlineName || getAirlineNameFromCode(segment.OperatingAirline || segment.Airline || ''),
                    flightNumber: segment.FlightNumber || '',
                    // NEW: Booking class
                    bookingClass: segment.BookingClass || '',
                    cabinClass: segment.CabinClass || '',
                    departure: {
                        airportCode: segment.Departure?.AirportCode || '',
                        date: segment.Departure?.Date || '',
                        time: segment.Departure?.Time || ''
                    },
                    arrival: {
                        airportCode: segment.Arrival?.AirportCode || '',
                        date: segment.Arrival?.Date || '',
                        time: segment.Arrival?.Time || ''
                    },
                    // Technical stops within segment
                    stops: (segment.Stops || []).map((stop: any) => ({
                        airportCode: stop.AirportCode || '',
                        date: stop.Date || '',
                        time: stop.Time || '',
                        duration: stop.Duration || ''
                    })),
                    duration: segment.Duration || 0,
                    // NEW: Equipment (aircraft type)
                    equipment: segment.Equipment || '',
                    status: segment.Status || '',
                    baggage: segment.Baggage || '',
                    carryOnBagInfo: {
                        quantity: segment.CarryOnBagInfo?.Quantity || segment.carryOnBagInfo?.quantity || '1',
                        weight: segment.CarryOnBagInfo?.Weight || segment.carryOnBagInfo?.weight || null,
                        dimensions: segment.CarryOnBagInfo?.Dimensions || segment.carryOnBagInfo?.dimensions || null
                    },
                    // NEW: Fare basis
                    fareBasis: segment.FareBasis || '',
                    brandName: segment.BrandName || ''
                }))
            }))
        })),
        // Baggage analysis for filtering
        baggageAnalysis: baggageAnalysis,
        provider: 'TVC',
        transactionId: tvcData?.TransactionID || ''
    };
}

/**
 * Transform array of TVC fares
 */
export function transformFares(tvcData: any, options: TransformOptions = {}): any[] {
    const fares = tvcData?.Fares || [];

    return fares.map((fare: any, index: number) =>
        transformFare(fare, index, tvcData, options)
    );
}
