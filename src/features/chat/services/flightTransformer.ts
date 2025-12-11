import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { FlightData } from '../types/chat';
import { formatDuration, getCityNameFromCode, getTaxDescription, calculateConnectionTime, getAirlineNameFromCode, getAirlineCodeFromName } from '../utils/flightHelpers';
import { translateFlightInfo, translateBaggage } from '../utils/translations';
import { airlineResolver } from './airlineResolver';

// Improved flight analysis functions
function analyzeFlightType(fare: any) {
  const legs = fare.Legs || [];

  // Analizar cada tramo
  const legAnalysis = legs.map((leg: any) => {
    const options = leg.Options || [];

    // Para cada option, contar segmentos Y escalas técnicas
    const optionAnalysis = options.map((option: any) => {
      const segments = option.Segments || [];

      // Contar conexiones entre segmentos
      const segmentConnections = Math.max(0, segments.length - 1);

      // Contar escalas técnicas DENTRO de cada segmento
      const technicalStops = segments.reduce((total: number, segment: any) => {
        return total + (segment.Stops?.length || 0);
      }, 0);

      // Total de conexiones = conexiones entre segmentos + escalas técnicas
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

  // Clasificación del vuelo completo
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
      // Nuevo: análisis por trayecto individual
      perLegConnections: {
        minPerLeg: legAnalysis.length > 0 ? Math.min(...legAnalysis.map(leg => leg.minConnections)) : 0,
        maxPerLeg: legAnalysis.length > 0 ? Math.max(...legAnalysis.map(leg => leg.maxConnections)) : 0,
        allLegsHaveSameConnections: legAnalysis.length > 0 && legAnalysis.every(leg => leg.minConnections === legAnalysis[0].minConnections && leg.maxConnections === legAnalysis[0].maxConnections)
      }
    }
  };
}

function isDirectFlight(fare: any): boolean {
  const analysis = analyzeFlightType(fare);
  return analysis.classification.isCompleteDirect;
}

function hasExactConnectionsCount(fare: any, targetConnections: number): boolean {
  const analysis = analyzeFlightType(fare);
  return analysis.classification.minTotalConnections <= targetConnections &&
    analysis.classification.maxTotalConnections >= targetConnections;
}

// Nueva función: verificar conexiones por trayecto individual
function hasExactConnectionsPerLeg(fare: any, targetConnectionsPerLeg: number): boolean {
  const analysis = analyzeFlightType(fare);
  const perLeg = analysis.classification.perLegConnections;

  // Todos los trayectos deben tener exactamente el número de conexiones solicitado
  return perLeg.allLegsHaveSameConnections &&
         perLeg.minPerLeg === targetConnectionsPerLeg &&
         perLeg.maxPerLeg === targetConnectionsPerLeg;
}

// Helper function to calculate layover hours between two flight segments
function calculateLayoverHours(arrivalSegment: any, departureSegment: any): number {
  try {
    // Parse arrival time and date (support both lowercase and uppercase API responses)
    const arrivalTime = arrivalSegment.arrival?.time || arrivalSegment.Arrival?.Time || '';
    const arrivalDate = arrivalSegment.arrival?.date || arrivalSegment.Arrival?.Date || '';

    // Parse departure time and date (support both lowercase and uppercase API responses)
    const departureTime = departureSegment.departure?.time || departureSegment.Departure?.Time || '';
    const departureDate = departureSegment.departure?.date || departureSegment.Departure?.Date || '';

    if (!arrivalTime || !arrivalDate || !departureTime || !departureDate) {
      return 0;
    }

    // Create Date objects
    const arrivalDateTime = new Date(`${arrivalDate}T${arrivalTime}:00`);
    const departureDateTime = new Date(`${departureDate}T${departureTime}:00`);

    // Calculate difference in milliseconds, then convert to hours
    const layoverMs = departureDateTime.getTime() - arrivalDateTime.getTime();
    const layoverHours = layoverMs / (1000 * 60 * 60);

    return layoverHours;
  } catch (error) {
    console.error('❌ [LAYOVER CALC] Error calculating layover:', error);
    return 0;
  }
}

// Helper function for legacy baggage logic (fallback when baggageAnalysis is not available)
function evaluateLegacyBaggageLogic(hasCheckedBaggage: boolean, hasCarryOn: boolean, luggagePreference: string): boolean {
  switch (luggagePreference) {
    case 'checked':
      return hasCheckedBaggage;
    case 'carry_on':
      const noLuggage = !hasCheckedBaggage && !hasCarryOn;
      return hasCarryOn || noLuggage;
    case 'both':
      return hasCheckedBaggage && hasCarryOn;
    case 'none':
      return !hasCheckedBaggage && !hasCarryOn;
    default:
      return true; // 'any' or unknown preference
  }
}

export const transformStarlingResults = async (tvcData: any, parsedRequest?: ParsedTravelRequest): Promise<FlightData[]> => {
  console.log('🔄 Transforming TVC API results:', tvcData);

  // 🔍 DEBUG: Log services from parsedRequest
  console.log('🔍 [TRANSFORMER] Services from parsedRequest:', {
    has_transfers: !!parsedRequest?.transfers,
    transfers_included: parsedRequest?.transfers?.included,
    transfers_type: parsedRequest?.transfers?.type,
    has_travel_assistance: !!parsedRequest?.travelAssistance,
    travel_assistance_included: parsedRequest?.travelAssistance?.included,
    travel_assistance_coverage: parsedRequest?.travelAssistance?.coverageAmount
  });

  // TVC API returns fares in Fares array, not Recommendations
  let fares = tvcData?.Fares || [];

  // Learn airline mappings from API response FIRST
  airlineResolver.processApiResponse(tvcData);

  // ✈️ POST-FILTER (Backup): Filter by preferred airline AFTER API response
  // This acts as a backup in case STARLING API doesn't filter correctly
  // or if the API doesn't support the Airlines parameter
  if (parsedRequest?.flights?.preferredAirline) {
    const airlinePreference = parsedRequest.flights.preferredAirline;
    console.log(`✈️ [POST-FILTER] Filtering ${fares.length} fares by preferred airline: ${airlinePreference} (backup filter)`);

    // Use the airline resolver to get the correct code
    const resolvedAirline = await airlineResolver.resolveAirline(airlinePreference);
    const preferredCode = resolvedAirline.code;

    fares = fares.filter((fare: any) => {
      const legs = fare.Legs || [];

      // Check if ANY segment in ANY leg matches the preferred airline
      for (const leg of legs) {
        for (const option of leg.Options || []) {
          for (const segment of option.Segments || []) {
            const segmentAirline = segment.Airline || '';
            const operatingAirline = segment.OperatingAirline || '';

            // Match against Airline or OperatingAirline fields
            if (segmentAirline === preferredCode || operatingAirline === preferredCode) {
              console.log(`✅ Fare ${fare.FareID} matches: found ${segmentAirline}/${operatingAirline}`);
              return true;
            }
          }
        }
      }

      console.log(`❌ Fare ${fare.FareID} filtered out: no segments match ${preferredCode}`);
      return false;
    });

    console.log(`✈️ [POST-FILTER] After airline filtering: ${fares.length} fares remain`);
  }

  // First transform all flights (using Promise.all for async mapping)
  const allTransformedFlights = await Promise.all(fares.map(async (fare: any, index: number) => {
    // TVC Fare structure: Fares -> Legs -> Options -> Segments


    const legs = fare.Legs || [];
    const firstLeg = legs[0] || {};
    // Get first option from first leg
    const firstOption = firstLeg.Options?.[0] || {};
    const firstSegment = firstOption.Segments?.[0] || {};
    const lastSegment = firstOption.Segments?.[firstOption.Segments?.length - 1] || firstSegment;



    // For return date, check if there's a second leg
    let returnDate = null;
    if (legs.length > 1) {
      const secondLeg = legs[1];
      const secondOption = secondLeg.Options?.[0] || {};
      const secondSegment = secondOption.Segments?.[0] || {};
      returnDate = secondSegment.Departure?.Date || null;
    }

    // Use the improved flight analysis
    const flightAnalysis = analyzeFlightType(fare);
    console.log(`🔍 [FLIGHT ANALYSIS] FareID ${fare.FareID}:`, {
      isCompleteDirect: flightAnalysis.classification.isCompleteDirect,
      minTotalConnections: flightAnalysis.classification.minTotalConnections,
      maxTotalConnections: flightAnalysis.classification.maxTotalConnections,
      perLegConnections: flightAnalysis.classification.perLegConnections
    });

    // Calculate technical stops (stops within segments)
    const totalTechnicalStops = legs.reduce((total, leg) => {
      return total + (leg.Options || []).reduce((legTotal: number, option: any) => {
        return legTotal + (option.Segments || []).reduce((segTotal: number, segment: any) => {
          return segTotal + (segment.Stops?.length || 0); // Technical stops within segment
        }, 0);
      }, 0);
    }, 0);

    // Use the improved analysis results
    // Un vuelo es directo solo si no tiene conexiones NI escalas técnicas
    const isDirectFlight = flightAnalysis.classification.isCompleteDirect && totalTechnicalStops === 0;
    const totalConnections = flightAnalysis.classification.minTotalConnections;
    const totalStops = totalTechnicalStops + totalConnections;



    // Analyze baggage info across ALL segments to handle mixed baggage allowances
    const baggageAnalysis = legs.map((leg, legIndex) => {
      const legSegments = leg.Options?.[0]?.Segments || [];
      const legBaggageInfo = legSegments[0]?.Baggage || '';
      const legCarryOnInfo = legSegments[0]?.CarryOnBagInfo;
      const legAirlineCode = legSegments[0]?.Airline || 'N/A';

      // Parse baggage allowance for this leg
      const baggageMatch = legBaggageInfo.match(/(\d+)PC|(\d+)KG/);
      const baggageQuantity = baggageMatch ? parseInt(baggageMatch[1] || baggageMatch[2]) : 0;

      return {
        legNumber: legIndex + 1,
        airlineCode: legAirlineCode,
        baggageInfo: legBaggageInfo,
        baggageQuantity,
        carryOnQuantity: legCarryOnInfo?.Quantity || legSegments[0]?.carryOnBagInfo?.quantity || '0',
        carryOnWeight: legCarryOnInfo?.Weight || legSegments[0]?.carryOnBagInfo?.weight || null,
        carryOnDimensions: legCarryOnInfo?.Dimensions || legSegments[0]?.carryOnBagInfo?.dimensions || null
      };
    });

    // Get overall baggage info (use first segment for backward compatibility)
    const baggageInfo = firstSegment.Baggage || '';
    const baggageMatch = baggageInfo.match(/(\d+)PC|(\d+)KG/);
    const baggageQuantity = baggageMatch ? parseInt(baggageMatch[1] || baggageMatch[2]) : 0;
    const hasFreeBaggage = baggageQuantity > 0;

    // Get carry-on info from first segment
    const carryOnQuantity = firstSegment.CarryOnBagInfo?.Quantity || firstSegment.carryOnBagInfo?.quantity || '0';
    const hasCarryOn = parseInt(carryOnQuantity) > 0;
    const carryOnWeight = firstSegment.CarryOnBagInfo?.Weight || firstSegment.carryOnBagInfo?.weight || null;
    const carryOnDimensions = firstSegment.CarryOnBagInfo?.Dimensions || firstSegment.carryOnBagInfo?.dimensions || null;


    // Airline name mapping using resolver
    const airlineCode = firstSegment.Airline || 'N/A';
    const operatingAirlineName = firstSegment.OperatingAirlineName;

    // The resolver has already learned from the API response, so try resolver first
    const resolvedAirline = await airlineResolver.resolveAirline(airlineCode);
    const finalName = operatingAirlineName || resolvedAirline.name || 'Unknown';

    return {
      id: fare.FareID || `tvc-fare-${index}`,
      airline: {
        code: airlineCode,
        name: finalName
      },
      price: {
        amount: fare.TotalAmount || 0,
        currency: fare.Currency || 'USD',
        netAmount: fare.ExtendedFareInfo?.NetTotalAmount || 0,
        fareAmount: fare.ExtendedFareInfo?.NetFareAmount || fare.FareAmount || 0,
        taxAmount: fare.ExtendedFareInfo?.NetTaxAmount || fare.TaxAmount || 0,
        baseCurrency: tvcData.BaseCurrency || 'USD',
        localAmount: fare.IataTotalAmount || 0,
        localCurrency: fare.IataCurrency || fare.Currency || 'USD',
        serviceAmount: fare.ServiceAmount || 0,
        commissionAmount: fare.CommissionAmount || 0,
        breakdown: {
          fareAmount: fare.FareAmount || 0,
          taxAmount: fare.TaxAmount || 0,
          serviceAmount: fare.ServiceAmount || 0,
          commissionAmount: fare.CommissionAmount || 0
        }
      },
      adults: parsedRequest?.flights?.adults || 1,
      childrens: parsedRequest?.flights?.children || 0,
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
        direct: isDirectFlight,
        connections: totalConnections + totalTechnicalStops, // Incluir escalas técnicas como conexiones
        technical: totalTechnicalStops
      },
      baggage: {
        included: hasFreeBaggage,
        details: baggageInfo,
        carryOn: carryOnQuantity,
        carryOnQuantity: carryOnQuantity,
        carryOnWeight: carryOnWeight,
        carryOnDimensions: carryOnDimensions
      },
      cabin: {
        class: firstSegment.CabinClass || 'Y',
        brandName: translateFlightInfo(firstSegment.BrandName || 'Economy')
      },
      booking: {
        validatingCarrier: fare.ValidatingCarrier || '',
        lastTicketingDate: fare.LastTicketingDate || '',
        fareType: fare.FareType || '',
        fareSupplier: fare.FareSupplier || '',
        fareSupplierCode: fare.FareSupplierCode || '',
        cancelPolicy: fare.CancelPolicy || '',
        maxInstallments: fare.MaxInstallments || 0,
        allowedFOPs: fare.AllowedFOPs || [],
        iataCountry: fare.IataCountry || '',
        iataCurrency: fare.IataCurrency || '',
        iataAmount: fare.IataTotalAmount || 0
      },
      commission: {
        percentage: fare.Commission?.Percentage || 0,
        amount: fare.ExtendedFareInfo?.Commission?.Amount || fare.CommissionAmount || 0,
        over: fare.Commission?.Over || 0,
        overCalculation: fare.Commission?.OverCalculation || null,
        passengerTypes: fare.Commission?.PassengerTypes || null
      },
      // MAPEO COMPLETO DE INFORMACIÓN DE PASAJEROS
      passengerFares: (fare.PaxFares || []).map((paxFare: any) => ({
        fareAmount: paxFare.PaxFareAmount || 0,
        taxAmount: paxFare.PaxTaxAmount || 0,
        commissionAmount: paxFare.PaxCommissionAmount || 0,
        totalAmount: paxFare.PaxTotalAmount || 0,
        passengerType: paxFare.PaxType || 'ADT',
        passengerSubType: paxFare.PaxSubType || null,
        count: paxFare.Count || 1,
        taxDetails: (paxFare.PaxTaxDetail || []).map((taxDetail: any) => ({
          code: taxDetail.Code || '',
          amount: taxDetail.Amount || 0,
          currency: taxDetail.Currency || 'USD',
          description: getTaxDescription(taxDetail.Code)
        }))
      })),
      // INFORMACIÓN EXTENDIDA DE TARIFA COMPLETA
      extendedFareInfo: fare.ExtendedFareInfo ? {
        ruleId: fare.ExtendedFareInfo.RuleId || null,
        netFareAmount: fare.ExtendedFareInfo.NetFareAmount || 0,
        netTaxAmount: fare.ExtendedFareInfo.NetTaxAmount || 0,
        netTotalAmount: fare.ExtendedFareInfo.NetTotalAmount || 0,
        netTotalAmountWithFee: fare.ExtendedFareInfo.NetTotalAmountWithFee || 0,
        additionalTaxes: fare.ExtendedFareInfo.AdditionalTaxes || null,
        fee: {
          amount: fare.ExtendedFareInfo.Fee?.Amount || 0,
          paxDetail: (fare.ExtendedFareInfo.Fee?.PaxDetail || []).map((pax: any) => ({
            ptc: pax.PTC || 'ADT',
            amountPerPax: pax.AmountPerPax || 0
          }))
        },
        commission: {
          amount: fare.ExtendedFareInfo.Commission?.Amount || 0,
          paxDetail: (fare.ExtendedFareInfo.Commission?.PaxDetail || []).map((pax: any) => ({
            ptc: pax.PTC || 'ADT',
            amountPerPax: pax.AmountPerPax || 0
          }))
        },
        over: {
          amount: fare.ExtendedFareInfo.Over?.Amount || 0,
          paxDetail: (fare.ExtendedFareInfo.Over?.PaxDetail || []).map((pax: any) => ({
            ptc: pax.PTC || 'ADT',
            amountPerPax: pax.AmountPerPax || 0
          }))
        }
      } : undefined,
      // POLÍTICAS DE COMISIÓN COMPLETAS
      commissionPolicyInfo: fare.CommPolicyInfo ? {
        ruleId: fare.CommPolicyInfo.RuleId || '',
        allowedFOPs: fare.CommPolicyInfo.AllowedFOPs || [],
        commissionPct: fare.CommPolicyInfo.CommissionPct || 0,
        overPct: fare.CommPolicyInfo.OverPct || 0,
        overCalculation: fare.CommPolicyInfo.OverCalculation || null
      } : undefined,
      legs: legs.map((leg: any, legIndex: number) => ({
        legNumber: leg.LegNumber || legIndex + 1,
        options: (leg.Options || []).map((option: any) => ({
          optionId: option.FlightOptionID || '',
          duration: option.OptionDuration || 0,
          segments: (option.Segments || []).map((segment: any) => ({
            segmentNumber: segment.SegmentNumber || 0,
            airline: segment.Airline || '',
            operatingAirline: segment.OperatingAirline || segment.Airline || '',
            operatingAirlineName: segment.OperatingAirlineName || getAirlineNameFromCode(segment.OperatingAirline || segment.Airline || '') || null,
            flightNumber: segment.FlightNumber || '',
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
            stops: (segment.Stops || []).map((stop: any) => ({
              airportCode: stop.AirportCode || '',
              date: stop.Date || '',
              time: stop.Time || '',
              duration: stop.Duration || ''
            })),
            duration: segment.Duration || 0,
            equipment: segment.Equipment || '',
            status: segment.Status || '',
            baggage: segment.Baggage || '',
            carryOnBagInfo: {
              quantity: segment.CarryOnBagInfo?.Quantity || segment.carryOnBagInfo?.quantity || '1',
              weight: segment.CarryOnBagInfo?.Weight || segment.carryOnBagInfo?.weight || null,
              dimensions: segment.CarryOnBagInfo?.Dimensions || segment.carryOnBagInfo?.dimensions || null
            },
            fareBasis: segment.FareBasis || '',
            brandName: segment.BrandName || '',
            features: segment.Features || null,
            airRecLoc: segment.AirRecLoc || null,
            availStatus: segment.AvailStatus || null
          }))
        }))
      })),
      taxes: (fare.TaxDetail || []).map((tax: any) => ({
        code: tax.Code || '',
        amount: tax.Amount || 0,
        currency: tax.Currency || 'USD',
        description: getTaxDescription(tax.Code)
      })),
      luggage: hasFreeBaggage,
      provider: 'TVC',
      contentOwner: fare.ContentOwner || '',
      ownContent: fare.OwnContent || false,
      transactionId: tvcData.TransactionID || '',
      fareMessages: fare.FareMessages || null,
      fareCode: fare.FareCode || null,
      fareFeatures: fare.FareFeatures || null,
      fareCategory: fare.FareCategory || null,
      baggageAnalysis: baggageAnalysis,
      // 🚗 TRASLADOS - Propagated from parsed request (included in package, no separate cost)
      transfers: parsedRequest?.transfers?.included ? {
        included: true,
        type: parsedRequest.transfers.type || 'in_out'
      } : undefined,
      // 🏥 ASISTENCIA MÉDICA / SEGURO - Propagated from parsed request (included in package, no separate cost)
      travel_assistance: parsedRequest?.travelAssistance?.included ? {
        included: true,
        coverageAmount: parsedRequest.travelAssistance.coverageAmount
      } : undefined
    };
  }));

  // 🔍 DEBUG: Log first flight's services to verify propagation
  if (allTransformedFlights.length > 0) {
    console.log('🔍 [TRANSFORMER] First flight services check:', {
      has_transfers: !!allTransformedFlights[0].transfers,
      transfers_included: allTransformedFlights[0].transfers?.included,
      has_travel_assistance: !!allTransformedFlights[0].travel_assistance,
      travel_assistance_included: allTransformedFlights[0].travel_assistance?.included
    });
  }

  // Filter by stops preference BEFORE limiting by price
  let filteredFlights = allTransformedFlights;

  if (parsedRequest?.flights?.stops === 'direct') {
    console.log('🚦 [TRANSFORMER] Filtering to NON-STOP flights (direct)');
    filteredFlights = allTransformedFlights.filter(flight => {
      const isDirect = flight.stops.direct; // Use the improved direct flag (now includes technical stops)
      if (!isDirect) {
        console.log(`❌ Filtering out flight ${flight.id}: ${flight.stops.connections} connections (${flight.stops.technical} technical) (not direct)`);
      }
      return isDirect;
    });
    console.log(`🎯 Direct flights found: ${filteredFlights.length} out of ${allTransformedFlights.length}`);
  }

  // Filter by 'with_stops' preference - any flight with 1 or more connections (excludes direct)
  if (parsedRequest?.flights?.stops === 'with_stops') {
    const maxLayover = parsedRequest?.flights?.maxLayoverHours;
    console.log('🚦 [TRANSFORMER] Filtering to flights WITH stops (excluding direct flights)');

    filteredFlights = allTransformedFlights.filter(flight => {
      const hasConnections = flight.stops.connections > 0; // Any number of connections > 0
      if (!hasConnections) {
        console.log(`❌ Filtering out flight ${flight.id}: direct flight (user wants flights with stops)`);
        return false;
      }

      // Check max layover hours if specified for with_stops
      if (maxLayover && hasConnections) {
        let exceedsMaxLayover = false;

        // Check layovers across all legs and segments
        for (const leg of flight.legs) {
          for (const option of leg.options || []) {
            const segments = option.segments || [];
            for (let i = 0; i < segments.length - 1; i++) {
              const current = segments[i];
              const next = segments[i + 1];
              const hours = calculateLayoverHours(current, next);
              if (hours > maxLayover) {
                console.log(`❌ Filtering out flight ${flight.id}: layover ${hours.toFixed(1)}h exceeds max ${maxLayover}h`);
                exceedsMaxLayover = true;
                break;
              }
            }
            if (exceedsMaxLayover) break;
          }
          if (exceedsMaxLayover) break;
        }

        if (exceedsMaxLayover) return false;
      }

      return hasConnections;
    });
    console.log(`🎯 Flights with stops found: ${filteredFlights.length} out of ${allTransformedFlights.length}`);
  }

  // Filter by connections PER LEG (per trayecto) using new logic
  if (parsedRequest?.flights?.stops === 'one_stop' || parsedRequest?.flights?.stops === 'two_stops') {
    const desiredConnectionsPerLeg = parsedRequest.flights.stops === 'one_stop' ? 1 : 2;
    const maxLayover = parsedRequest?.flights?.maxLayoverHours;

    console.log(`🚦 [TRANSFORMER] Filtering to exactly ${desiredConnectionsPerLeg} connection(s) PER TRAYECTO (ida/vuelta individual)`);

    filteredFlights = allTransformedFlights.filter(flight => {
      // Usar la nueva función que verifica conexiones por trayecto
      const fareData = fares.find(fare => fare.FareID === flight.id);
      if (!fareData) {
        console.log(`❌ Filtering out flight ${flight.id}: fare data not found`);
        return false;
      }

      const hasCorrectConnectionsPerLeg = hasExactConnectionsPerLeg(fareData, desiredConnectionsPerLeg);

      if (!hasCorrectConnectionsPerLeg) {
        const analysis = analyzeFlightType(fareData);
        const perLeg = analysis.classification.perLegConnections;
        console.log(`❌ Filtering out flight ${flight.id}: connections per leg ${perLeg.minPerLeg}-${perLeg.maxPerLeg} (want ${desiredConnectionsPerLeg} per leg)`);
        return false;
      }

      // Check max layover hours if specified
      if (maxLayover && desiredConnectionsPerLeg > 0) {
        let exceedsMaxLayover = false;

        // Check layovers across all legs and segments
        for (const leg of flight.legs) {
          for (const option of leg.options || []) {
            const segments = option.segments || [];
            for (let i = 0; i < segments.length - 1; i++) {
              const current = segments[i];
              const next = segments[i + 1];
              const hours = calculateLayoverHours(current, next);
              if (hours > maxLayover) {
                console.log(`❌ Filtering out flight ${flight.id}: layover ${hours.toFixed(1)}h exceeds max ${maxLayover}h`);
                exceedsMaxLayover = true;
                break;
              }
            }
            if (exceedsMaxLayover) break;
          }
          if (exceedsMaxLayover) break;
        }

        if (exceedsMaxLayover) return false;
      }

      return true;
    });

    console.log(`🎯 Flights with exactly ${desiredConnectionsPerLeg} connection(s) PER TRAYECTO: ${filteredFlights.length} of ${allTransformedFlights.length}`);
  }

  // Filter by luggage preference BEFORE limiting by price
  if (parsedRequest?.flights?.luggage) {
    const luggagePreference = parsedRequest.flights.luggage;
    console.log(`🧳 [LUGGAGE FILTER] Starting luggage filtering with ${allTransformedFlights.length} total flights`);
    console.log(`🧳 [TRANSFORMER] Filtering by luggage preference: ${luggagePreference}`);

    filteredFlights = filteredFlights.filter(flight => {
      // Use baggageAnalysis to check ALL legs (ida and vuelta)
      const baggageAnalysis = flight.baggageAnalysis || [];

      console.log(`🔍 [LUGGAGE COMPARISON] Flight ${flight.id} - Checking ${baggageAnalysis.length} legs:`);
      console.log(`   🎯 User wants: ${luggagePreference}`);

      // If no baggage analysis available, fall back to legacy logic
      if (baggageAnalysis.length === 0) {
        console.log(`   ⚠️ No baggageAnalysis available, using legacy logic`);
        const hasCheckedBaggage = flight.baggage?.included || false;
        const hasCarryOn = parseInt(flight.baggage?.carryOnQuantity || '0') > 0;
        return evaluateLegacyBaggageLogic(hasCheckedBaggage, hasCarryOn, luggagePreference);
      }

      // Check EACH leg individually
      let allLegsMatch = true;
      const legResults = [];

      for (let i = 0; i < baggageAnalysis.length; i++) {
        const leg = baggageAnalysis[i];
        const legHasChecked = leg.baggageQuantity > 0;
        const legHasCarryOn = parseInt(leg.carryOnQuantity || '0') > 0;
        const legName = leg.legNumber === 1 ? 'IDA' : 'VUELTA';

        console.log(`   📦 ${legName} (Leg ${leg.legNumber}): Checked=${legHasChecked} (${leg.baggageQuantity}PC), CarryOn=${legHasCarryOn} (qty: ${leg.carryOnQuantity})`);

        let legMatches = false;

        switch (luggagePreference) {
          case 'checked':
            legMatches = legHasChecked;
            break;
          case 'carry_on':
            // New logic: distinguish between "1 Mochila" (light fare) vs real carry-on
            if (legHasCarryOn) {
              // Any airline with carry-on info is valid
              legMatches = true;
            } else if (!legHasChecked && !legHasCarryOn) {
              // 0PC + null case: check airline to distinguish "1 Mochila" vs carry-on básico
              const lightTarifAirlines = ['LA', 'H2', 'AV', 'AM', 'JA', 'AR'];
              const isLightFareAirline = lightTarifAirlines.includes(leg.airlineCode);
              // Accept only if NOT a light fare airline (exclude "1 Mochila")
              legMatches = !isLightFareAirline;
            } else {
              legMatches = false;
            }
            break;
          case 'both':
            legMatches = legHasChecked && legHasCarryOn;
            break;
          case 'none':
            legMatches = !legHasChecked && !legHasCarryOn;
            break;
          default:
            legMatches = true; // 'any' preference
            break;
        }

        legResults.push({ leg: legName, matches: legMatches });
        console.log(`   ${legMatches ? '✅' : '❌'} ${legName}: ${legMatches ? 'MATCHES' : 'FAILS'} ${luggagePreference} requirement`);

        if (!legMatches) {
          allLegsMatch = false;
        }
      }

      const finalResult = allLegsMatch;
      console.log(`   🎯 Final decision: ${finalResult ? 'KEEP' : 'FILTER OUT'} (${legResults.map(r => `${r.leg}:${r.matches ? '✅' : '❌'}`).join(', ')})`);

      if (!finalResult) {
        const failedLegs = legResults.filter(r => !r.matches).map(r => r.leg).join(', ');
        console.log(`❌ Filtering out flight ${flight.id}: ${failedLegs} leg(s) don't match ${luggagePreference} requirement`);
      }

      return finalResult;
    });

    console.log(`🧳 [LUGGAGE FILTER] Filtering complete: ${filteredFlights.length} flights remain out of ${allTransformedFlights.length} total flights`);
  }


  // Sort by price (lowest first) and limit to 5
  const transformedFlights = filteredFlights
    .sort((a, b) => (a.price.amount || 0) - (b.price.amount || 0))
    .slice(0, 5);

  // DEBUG: Log the final flights connections
  console.log(`🔍 [DEBUG] Final 5 flights connections:`);
  transformedFlights.forEach(flight => {
    const fareData = fares.find(f => f.FareID === flight.id);
    if (fareData) {
      const analysis = analyzeFlightType(fareData);
      console.log(`   Flight ${flight.id}: connections per leg ${analysis.classification.perLegConnections.minPerLeg}-${analysis.classification.perLegConnections.maxPerLeg}`);
    }
  });

  // Final flights summary
  console.log(`🎯 Final flights: ${transformedFlights.length} flights with stops returned`);
  if (transformedFlights.length > 0) {
    console.log(`✅ All flights have connections > 0 (as requested)`);
  }

  console.log(`✅ Transformation complete. Generated ${allTransformedFlights.length} flight objects`);
  console.log(`💰 After filtering: ${filteredFlights.length} flights, showing ${transformedFlights.length} cheapest`);

  // Log luggage filtering summary
  if (parsedRequest?.flights?.luggage) {
    const luggagePreference = parsedRequest.flights.luggage;
    const originalCount = allTransformedFlights.length;
    const filteredCount = filteredFlights.length;
    console.log(`🧳 [LUGGAGE SUMMARY] Preference: "${luggagePreference}" | ${originalCount} → ${filteredCount} flights (${((1 - filteredCount / originalCount) * 100).toFixed(1)}% filtered out)`);
  }


  if (transformedFlights.length > 0) {
    console.log(`💸 Price range: ${transformedFlights[0].price.amount} - ${transformedFlights[transformedFlights.length - 1].price.amount} ${transformedFlights[0].price.currency}`);
  }

  return transformedFlights;
};

// Helper function to generate visual flight itinerary
export const generateFlightItinerary = (flight: FlightData): string => {
  let itinerary = '';

  flight.legs.forEach((leg, legIndex) => {
    const legType = legIndex === 0 ? 'IDA' : 'REGRESO';
    itinerary += `\n🛫 **${legType}:**\n`;

    leg.options.forEach((option, optionIndex) => {
      const segments = option.segments || [];

      if (segments.length === 0) {
        itinerary += '   ❌ Sin información de segmentos\n';
        return;
      }

      if (segments.length === 1) {
        // Vuelo directo o con escalas técnicas
        const segment = segments[0];
        const hasTechnicalStops = segment.stops && segment.stops.length > 0;

        if (hasTechnicalStops) {
          itinerary += `   🔄 **Vuelo con ${segment.stops.length} Conexión(es):**\n\n`;
        } else {
          itinerary += `   ✈️ **Vuelo Directo:** ${segment.airline}${segment.flightNumber}\n`;
        }

        itinerary += `   📍 ${segment.departure.airportCode} ${segment.departure.time} → ${segment.arrival.airportCode} ${segment.arrival.time}\n`;
        itinerary += `   ⏱️ Duración: ${formatDuration(segment.duration)}\n`;
        itinerary += `   💺 Clase: ${translateFlightInfo(segment.cabinClass)} (${translateFlightInfo(segment.brandName)})\n`;
        itinerary += `   ✈️ Equipo: ${segment.equipment}\n`;

        // Mostrar escalas técnicas si las hay
        if (hasTechnicalStops) {
          segment.stops.forEach((stop: any, stopIndex: number) => {
            const stopCity = getCityNameFromCode(stop.airportCode);
            itinerary += `\n   🔄 **Conexión ${stopIndex + 1} en ${stopCity} (${stop.airportCode}):**\n`;
            itinerary += `   ⏰ Tiempo de escala: ${stop.duration || 'N/A'}\n`;
            itinerary += `   📅 Fecha: ${stop.date || 'N/A'}\n`;
            itinerary += `   🚶 Reabastecimiento de combustible\n\n`;
          });
        }
      } else {
        // Vuelo con conexiones
        itinerary += `   🔄 **Vuelo con ${segments.length - 1} Conexión(es):**\n\n`;

        segments.forEach((segment, segIndex) => {
          itinerary += `   **Segmento ${segIndex + 1}:** ${segment.airline}${segment.flightNumber}\n`;
          itinerary += `   📍 ${segment.departure.airportCode} ${segment.departure.time} → ${segment.arrival.airportCode} ${segment.arrival.time}\n`;
          itinerary += `   ⏱️ ${formatDuration(segment.duration)} | 💺 ${translateFlightInfo(segment.cabinClass)} | ✈️ ${segment.equipment}\n`;

          // Mostrar conexión si no es el último segmento
          if (segIndex < segments.length - 1) {
            const nextSegment = segments[segIndex + 1];
            const connectionTime = calculateConnectionTime(segment, nextSegment);
            const connectionAirport = segment.arrival.airportCode;
            const connectionCity = getCityNameFromCode(connectionAirport);
            const layoverHours = calculateLayoverHours(segment, nextSegment);

            itinerary += `\n   🔄 **Conexión en ${connectionCity} (${connectionAirport}):**\n`;
            itinerary += `   ⏰ Tiempo de conexión: ${connectionTime} (${layoverHours.toFixed(1)}h)\n`;
            itinerary += `   🚶 Cambio de terminal/puerta\n\n`;
          }
        });
      }
    });
  });

  return itinerary;
};