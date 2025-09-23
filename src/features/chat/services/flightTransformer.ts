import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import type { FlightData } from '../types/chat';
import { formatDuration, getCityNameFromCode, getTaxDescription, calculateConnectionTime } from '../utils/flightHelpers';

export const transformStarlingResults = (tvcData: any, parsedRequest?: ParsedTravelRequest): FlightData[] => {
  console.log('🔄 Transforming TVC API results:', tvcData);

  // TVC API returns fares in Fares array, not Recommendations
  const fares = tvcData?.Fares || [];
  console.log(`📊 Processing ${fares.length} fares from TVC API`);

  // First transform all flights, then sort by price and limit to 5
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

    // Calculate connections (segment changes)
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
      isDirect: totalStops === 0,
      explanation: totalStops === 0 ? 'Vuelo directo' :
        totalConnections > 0 ? `${totalConnections} conexión(es)` +
          (totalTechnicalStops > 0 ? ` + ${totalTechnicalStops} escala(s) técnica(s)` : '') :
          `${totalTechnicalStops} escala(s) técnica(s)`
    });

    // Get baggage info from first segment
    const baggageInfo = firstSegment.Baggage || '';
    const hasFreeBaggage = baggageInfo.includes('PC') || baggageInfo.includes('KG');

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
        direct: totalStops === 0
      },
      baggage: {
        included: hasFreeBaggage,
        details: baggageInfo,
        carryOn: firstSegment.CarryOnBagInfo?.Quantity || 'Standard',
        carryOnQuantity: firstSegment.CarryOnBagInfo?.Quantity || '1',
        carryOnWeight: firstSegment.CarryOnBagInfo?.Weight || null,
        carryOnDimensions: firstSegment.CarryOnBagInfo?.Dimensions || null
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

  // Sort by price (lowest first) and limit to 5
  const transformedFlights = allTransformedFlights
    .sort((a, b) => (a.price.amount || 0) - (b.price.amount || 0))
    .slice(0, 5);

  console.log(`✅ Transformation complete. Generated ${allTransformedFlights.length} flight objects`);
  console.log(`💰 Sorted by price and limited to ${transformedFlights.length} cheapest flights`);
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
        itinerary += `   💺 Clase: ${segment.cabinClass} (${segment.brandName})\n`;
        itinerary += `   ✈️ Equipo: ${segment.equipment}\n`;
      } else {
        // Vuelo con conexiones
        itinerary += `   🔄 **Vuelo con ${segments.length - 1} Conexión(es):**\n\n`;

        segments.forEach((segment, segIndex) => {
          itinerary += `   **Segmento ${segIndex + 1}:** ${segment.airline}${segment.flightNumber}\n`;
          itinerary += `   📍 ${segment.departure.airportCode} ${segment.departure.time} → ${segment.arrival.airportCode} ${segment.arrival.time}\n`;
          itinerary += `   ⏱️ ${formatDuration(segment.duration)} | 💺 ${segment.cabinClass} | ✈️ ${segment.equipment}\n`;

          // Mostrar conexión si no es el último segmento
          if (segIndex < segments.length - 1) {
            const nextSegment = segments[segIndex + 1];
            const connectionTime = calculateConnectionTime(segment, nextSegment);
            const connectionAirport = segment.arrival.airportCode;
            const connectionCity = getCityNameFromCode(connectionAirport);

            itinerary += `\n   🔄 **Conexión en ${connectionCity} (${connectionAirport}):**\n`;
            itinerary += `   ⏰ Tiempo de conexión: ${connectionTime}\n`;
            itinerary += `   🚶 Cambio de terminal/puerta\n\n`;
          }
        });
      }
    });
  });

  return itinerary;
};