import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { FlightData } from '../types/chat';
import { formatDuration, getCityNameFromCode, getTaxDescription, calculateConnectionTime } from '../utils/flightHelpers';
import { translateFlightInfo, translateBaggage } from '../utils/translations';

// Helper function to calculate layover hours between two flight segments
function calculateLayoverHours(arrivalSegment: any, departureSegment: any): number {
  try {
    // Parse arrival time and date
    const arrivalTime = arrivalSegment.arrival?.time || '';
    const arrivalDate = arrivalSegment.arrival?.date || '';

    // Parse departure time and date  
    const departureTime = departureSegment.departure?.time || '';
    const departureDate = departureSegment.departure?.date || '';

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

export const transformStarlingResults = (tvcData: any, parsedRequest?: ParsedTravelRequest): FlightData[] => {
  console.log('🔄 Transforming TVC API results:', tvcData);

  // TVC API returns fares in Fares array, not Recommendations
  const fares = tvcData?.Fares || [];
  console.log(`📊 Processing ${fares.length} fares from TVC API`);

  // First transform all flights
  const allTransformedFlights = fares.map((fare: any, index: number) => {
    // TVC Fare structure: Fares -> Legs -> Options -> Segments
    console.log(`🔍 Processing fare ${index + 1}:`, {
      fareId: fare.FareID,
      totalAmount: fare.TotalAmount,
      netAmount: fare.ExtendedFareInfo?.NetTotalAmount,
      legsCount: fare.Legs?.length || 0,
      validatingCarrier: fare.ValidatingCarrier,
      lastTicketingDate: fare.LastTicketingDate
    });

    const legs = fare.Legs || [];
    const firstLeg = legs[0] || {};
    // Get first option from first leg
    const firstOption = firstLeg.Options?.[0] || {};
    const firstSegment = firstOption.Segments?.[0] || {};
    const lastSegment = firstOption.Segments?.[firstOption.Segments?.length - 1] || firstSegment;

    console.log(`📊 Fare ${index + 1} structure:`, {
      legs: legs.length,
      firstLegOptions: firstLeg.Options?.length || 0,
      firstOptionSegments: firstOption.Segments?.length || 0,
      totalDuration: firstOption.OptionDuration,
      brandName: firstSegment.BrandName,
      cabinClass: firstSegment.CabinClass,
      segmentDetails: (firstOption.Segments || []).map((seg: any) => ({
        flight: `${seg.Airline}${seg.FlightNumber}`,
        route: `${seg.Departure?.AirportCode} → ${seg.Arrival?.AirportCode}`,
        technicalStops: seg.Stops?.length || 0
      }))
    });

    // For return date, check if there's a second leg
    let returnDate = null;
    if (legs.length > 1) {
      const secondLeg = legs[1];
      const secondOption = secondLeg.Options?.[0] || {};
      const secondSegment = secondOption.Segments?.[0] || {};
      returnDate = secondSegment.Departure?.Date || null;
    }

    // Calculate total connections (stops) count
    // In TVC: Stops = Technical stops within a segment, Connections = Multiple segments in a leg
    const totalTechnicalStops = legs.reduce((total, leg) => {
      return total + (leg.Options || []).reduce((legTotal: number, option: any) => {
        return legTotal + (option.Segments || []).reduce((segTotal: number, segment: any) => {
          return segTotal + (segment.Stops?.length || 0); // Technical stops within segment
        }, 0);
      }, 0);
    }, 0);

    // Calculate connections (segment changes) - for a flight to be "direct", ALL legs must have only 1 segment each
    const isDirectFlight = legs.every(leg => {
      return leg.Options?.every((option: any) => {
        const segments = option.Segments || [];
        return segments.length === 1; // Each leg must have exactly 1 segment to be direct
      });
    });

    // Calculate total connections for reporting
    const totalConnections = legs.reduce((total, leg) => {
      return total + (leg.Options || []).reduce((legTotal: number, option: any) => {
        const segments = option.Segments || [];
        return legTotal + Math.max(0, segments.length - 1); // Connections = segments - 1
      }, 0);
    }, 0);

    // Total stops = technical stops + connections
    const totalStops = totalTechnicalStops + totalConnections;

    console.log(`🛑 Stops analysis for Fare ${index + 1}:`, {
      technicalStops: totalTechnicalStops,
      connections: totalConnections,
      totalStops: totalStops,
      isDirect: isDirectFlight,
      explanation: isDirectFlight ? 'Vuelo directo' :
        totalConnections > 0 ? `${totalConnections} conexión(es)` +
          (totalTechnicalStops > 0 ? ` + ${totalTechnicalStops} escala(s) técnica(s)` : '') :
          `${totalTechnicalStops} escala(s) técnica(s)`
    });

    // Analyze baggage info across ALL segments to handle mixed baggage allowances
    const baggageAnalysis = legs.map((leg, legIndex) => {
      const legSegments = leg.Options?.[0]?.Segments || [];
      const legBaggageInfo = legSegments[0]?.Baggage || '';
      const legCarryOnInfo = legSegments[0]?.CarryOnBagInfo;

      // Parse baggage allowance for this leg
      const baggageMatch = legBaggageInfo.match(/(\d+)PC|(\d+)KG/);
      const baggageQuantity = baggageMatch ? parseInt(baggageMatch[1] || baggageMatch[2]) : 0;

      return {
        legNumber: legIndex + 1,
        baggageInfo: legBaggageInfo,
        baggageQuantity,
        carryOnQuantity: legCarryOnInfo?.Quantity || '0',
        carryOnWeight: legCarryOnInfo?.Weight || null,
        carryOnDimensions: legCarryOnInfo?.Dimensions || null
      };
    });

    // Get overall baggage info (use first segment for backward compatibility)
    const baggageInfo = firstSegment.Baggage || '';
    const baggageMatch = baggageInfo.match(/(\d+)PC|(\d+)KG/);
    const baggageQuantity = baggageMatch ? parseInt(baggageMatch[1] || baggageMatch[2]) : 0;
    const hasFreeBaggage = baggageQuantity > 0;

    // Get carry-on info from first segment
    const carryOnQuantity = firstSegment.CarryOnBagInfo?.Quantity || '0';
    const hasCarryOn = parseInt(carryOnQuantity) > 0;
    const carryOnWeight = firstSegment.CarryOnBagInfo?.Weight || null;
    const carryOnDimensions = firstSegment.CarryOnBagInfo?.Dimensions || null;

    console.log(`🎒 Baggage analysis for Fare ${index + 1}:`, {
      baggageAnalysis, // Show all legs
      overallBaggage: {
        baggageInfo,
        baggageQuantity,
        hasFreeBaggage,
        carryOnQuantity,
        hasCarryOn,
        carryOnWeight,
        carryOnDimensions
      },
      explanation: hasFreeBaggage ? `${baggageQuantity} checked bags` : 'No checked bags',
      carryOnExplanation: hasCarryOn ? `${carryOnQuantity} carry-on bag(s)${carryOnWeight ? ` (${carryOnWeight})` : ''}` : 'No carry-on included',
      legDetails: baggageAnalysis.map(leg =>
        `Leg ${leg.legNumber}: ${leg.baggageQuantity}PC checked, ${leg.carryOnQuantity} carry-on${leg.carryOnWeight ? ` (${leg.carryOnWeight})` : ''}`
      )
    });

    return {
      id: fare.FareID || `tvc-fare-${index}`,
      airline: {
        code: firstSegment.Airline || 'N/A',
        name: firstSegment.AirlineName || firstSegment.Airline || 'Unknown'
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
        connections: totalConnections,
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
            operatingAirlineName: segment.OperatingAirlineName || null,
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
              quantity: segment.CarryOnBagInfo?.Quantity || '1',
              weight: segment.CarryOnBagInfo?.Weight || null,
              dimensions: segment.CarryOnBagInfo?.Dimensions || null
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
      fareCategory: fare.FareCategory || null
    };
  });

  // Filter by stops preference BEFORE limiting by price
  let filteredFlights = allTransformedFlights;

  if (parsedRequest?.flights?.stops === 'direct') {
    console.log('🚦 [TRANSFORMER] Filtering to NON-STOP flights (direct)');
    filteredFlights = allTransformedFlights.filter(flight => {
      const isDirect = flight.stops.direct; // Use the correct direct flag
      if (!isDirect) {
        console.log(`❌ Filtering out flight ${flight.id}: ${flight.stops.count} stops (not direct)`);
      }
      return isDirect;
    });
    console.log(`🎯 Direct flights found: ${filteredFlights.length} out of ${allTransformedFlights.length}`);
  }

  // Per-leg connection filtering: keep flights where EACH leg has at least one option
  // with exactly the requested number of connections (segments - 1). Also enforce
  // max layover hours per connection when provided.
  if (parsedRequest?.flights?.stops === 'one_stop' || parsedRequest?.flights?.stops === 'two_stops') {
    const desiredConnections = parsedRequest.flights.stops === 'one_stop' ? 1 : 2;
    const maxLayover = parsedRequest?.flights?.maxLayoverHours;

    console.log(`🚦 [TRANSFORMER] Filtering per-leg to exactly ${desiredConnections} connection(s)`);

    filteredFlights = allTransformedFlights
      .map(flight => {
        const filteredLegs = flight.legs.map(leg => {
          const options = (leg.options || []).filter(option => {
            const segments = option.segments || [];
            const connections = Math.max(0, segments.length - 1);
            if (connections !== desiredConnections) return false;

            if (maxLayover && connections > 0) {
              for (let i = 0; i < segments.length - 1; i++) {
                const current = segments[i];
                const next = segments[i + 1];
                const hours = calculateLayoverHours(current, next);
                if (hours > maxLayover) {
                  return false;
                }
              }
            }
            return true;
          });
          return { ...leg, options };
        });

        const allLegsHaveOptions = filteredLegs.every(l => (l.options?.length || 0) > 0);
        if (!allLegsHaveOptions) return null;
        return { ...flight, legs: filteredLegs };
      })
      .filter(Boolean) as any[];

    console.log(`🎯 Flights with per-leg ${desiredConnections} connection(s): ${filteredFlights.length} of ${allTransformedFlights.length}`);
  }

  // Filter by luggage preference BEFORE limiting by price
  if (parsedRequest?.flights?.luggage) {
    const luggagePreference = parsedRequest.flights.luggage;
    console.log(`🧳 [TRANSFORMER] Filtering by luggage preference: ${luggagePreference}`);

    filteredFlights = filteredFlights.filter(flight => {
      const hasCheckedBaggage = flight.baggage?.included || false;
      const hasCarryOn = parseInt(flight.baggage?.carryOnQuantity || '0') > 0;

      let matchesPreference = false;

      switch (luggagePreference) {
        case 'checked':
          // User wants checked baggage
          matchesPreference = hasCheckedBaggage;
          if (!matchesPreference) {
            console.log(`❌ Filtering out flight ${flight.id}: No checked baggage (user wants checked)`);
          }
          break;

        case 'carry_on':
          // User wants carry-on (accept flights with carry-on, regardless of checked baggage)
          matchesPreference = hasCarryOn;
          if (!matchesPreference) {
            console.log(`❌ Filtering out flight ${flight.id}: No carry-on available (user wants carry-on)`);
          }
          break;

        case 'both':
          // User wants both checked and carry-on
          matchesPreference = hasCheckedBaggage && hasCarryOn;
          if (!matchesPreference) {
            console.log(`❌ Filtering out flight ${flight.id}: Missing checked baggage or carry-on (user wants both)`);
          }
          break;

        case 'none':
          // User wants no baggage at all
          matchesPreference = !hasCheckedBaggage && !hasCarryOn;
          if (!matchesPreference) {
            console.log(`❌ Filtering out flight ${flight.id}: Has baggage (user wants none)`);
          }
          break;

        default:
          // 'any' or unknown preference - show all flights
          matchesPreference = true;
          break;
      }

      return matchesPreference;
    });

    console.log(`🧳 Luggage-filtered flights found: ${filteredFlights.length} out of ${allTransformedFlights.length}`);
  }

  // Sort by price (lowest first) and limit to 5
  const transformedFlights = filteredFlights
    .sort((a, b) => (a.price.amount || 0) - (b.price.amount || 0))
    .slice(0, 5);

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
        // Vuelo directo
        const segment = segments[0];
        itinerary += `   ✈️ **Vuelo Directo:** ${segment.airline}${segment.flightNumber}\n`;
        itinerary += `   📍 ${segment.departure.airportCode} ${segment.departure.time} → ${segment.arrival.airportCode} ${segment.arrival.time}\n`;
        itinerary += `   ⏱️ Duración: ${formatDuration(segment.duration)}\n`;
        itinerary += `   💺 Clase: ${translateFlightInfo(segment.cabinClass)} (${translateFlightInfo(segment.brandName)})\n`;
        itinerary += `   ✈️ Equipo: ${segment.equipment}\n`;
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