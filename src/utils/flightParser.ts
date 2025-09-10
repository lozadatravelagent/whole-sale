import { FlightData, FlightLeg, AirportInfo, LayoverInfo } from '@/types';

export function parseFlightsFromMessage(messageText: string): FlightData[] {
  const flights: FlightData[] = [];
  
  // Split by flight options (numbered list)
  const flightBlocks = messageText.split(/(?=\d+\.\s*✈️)/).filter(block => block.trim().length > 0);
  
  for (const block of flightBlocks) {
    try {
      const flight = parseFlightBlock(block);
      if (flight) {
        flights.push(flight);
      }
    } catch (error) {
      console.warn('Error parsing flight block:', error, block.substring(0, 100));
    }
  }
  
  return flights;
}

function parseFlightBlock(block: string): FlightData | null {
  // Extract basic flight info
  const airlineMatch = block.match(/✈️\s*([^-\n]+)\s*-\s*([^\n🛫]+)/);
  if (!airlineMatch) return null;
  
  const airlineName = airlineMatch[2].trim();
  const airlineCode = extractAirlineCode(airlineName);
  
  // Extract price
  const priceMatch = block.match(/💰\s*Precio:\s*([\d,.]+)\s*(\w+)/);
  if (!priceMatch) return null;
  
  const price = {
    amount: parseFloat(priceMatch[1].replace(',', '.')),
    currency: priceMatch[2]
  };
  
  // Extract passenger info (assume defaults if not found)
  const adults = 1; // Default, could be extracted from context
  const childrens = 0;
  
  // Parse outbound flight - use simple string matching instead of emoji regex
  const outboundMatch = block.match(/Ida\s*\(([^)]+)\)[\s\S]*?Origen:\s*([^\n]*?)(?:Salida|🕒):\s*([^\n]*?)(?:Destino|🎯):\s*([^\n]*?)(?:Llegada|🕓):\s*([^\n]*?)(?:Duración|⏱️):\s*([^\n]*?)(?=(?:Escala|🛬|Regreso|💰|\n\n|$))/);
  
  if (!outboundMatch) return null;
  
  const departureDate = outboundMatch[1].trim();
  const legs: FlightLeg[] = [];
  
  // Parse outbound leg
  const outboundLeg: FlightLeg = {
    departure: parseAirportInfo(outboundMatch[2], outboundMatch[3]),
    arrival: parseAirportInfo(outboundMatch[4], outboundMatch[5]),
    duration: outboundMatch[6].trim(),
    flight_type: 'outbound',
    layovers: []
  };
  
  // Add layover if exists
  if (outboundMatch[7]) {
    const layover: LayoverInfo = {
      destination_city: outboundMatch[7].trim(),
      destination_code: extractCityCode(outboundMatch[8].trim()),
      waiting_time: outboundMatch[10].trim()
    };
    outboundLeg.layovers = [layover];
  }
  
  legs.push(outboundLeg);
  
  // Parse return flight if exists - use simple string matching
  const returnMatch = block.match(/Regreso\s*\(([^)]+)\)[\s\S]*?Origen:\s*([^\n]*?)(?:Salida|🕒):\s*([^\n]*?)(?:Destino|🎯):\s*([^\n]*?)(?:Llegada|🕓):\s*([^\n]*?)(?:Duración|⏱️):\s*([^\n]*?)(?=(?:Escala|💰|\n\n|$))/);
  
  let returnDate: string | undefined;
  
  if (returnMatch) {
    returnDate = returnMatch[1].trim();
    
    const returnLeg: FlightLeg = {
      departure: parseAirportInfo(returnMatch[2], returnMatch[3]),
      arrival: parseAirportInfo(returnMatch[4], returnMatch[5]),
      duration: returnMatch[6].trim(),
      flight_type: 'return',
      layovers: []
    };
    
    // Add return layover if exists
    if (returnMatch[7]) {
      const layover: LayoverInfo = {
        destination_city: returnMatch[7].trim(),
        destination_code: extractCityCode(returnMatch[8].trim()),
        waiting_time: returnMatch[10].trim()
      };
      returnLeg.layovers = [layover];
    }
    
    legs.push(returnLeg);
  }
  
  // Generate unique ID for this flight option
  const flightId = `flight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: flightId,
    airline: {
      code: airlineCode,
      name: airlineName
    },
    price,
    adults,
    childrens,
    departure_date: departureDate,
    return_date: returnDate,
    legs,
    luggage: false, // Default, could be extracted
    travel_assistance: 0,
    transfers: 0
  };
}

function parseAirportInfo(locationText: string, timeText: string): AirportInfo {
  // Extract city code and name from format "CITY NAME (CODE)" or "CITY NAME"
  const codeMatch = locationText.match(/\(([^)]+)\)/);
  const cityCode = codeMatch ? codeMatch[1] : extractCityCode(locationText);
  
  // Clean up city name
  const cityName = locationText.replace(/\s*\([^)]*\)\s*/, '').trim();
  
  return {
    city_code: cityCode,
    city_name: cityName,
    time: timeText.trim()
  };
}

function extractCityCode(text: string): string {
  // Look for 3-letter airport codes in parentheses or common patterns
  const codeMatch = text.match(/\(([A-Z]{3})\)/);
  if (codeMatch) return codeMatch[1];
  
  // Try to extract from common airport patterns
  const patterns = [
    /([A-Z]{3})\s*$/,  // Code at end
    /^([A-Z]{3})\s*/,  // Code at start
    /\s([A-Z]{3})\s/   // Code in middle
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  // Fallback: use first 3 letters of city name in uppercase
  return text.replace(/[^A-Z]/g, '').substring(0, 3) || 'XXX';
}

function extractAirlineCode(airlineName: string): string {
  // Map common airline names to codes
  const airlineCodes: Record<string, string> = {
    'Latam Airlines Group': 'LA',
    'American Airlines': 'AA',
    'Delta Airlines': 'DL',
    'United Airlines': 'UA',
    'British Airways': 'BA',
    'Lufthansa': 'LH',
    'Air France': 'AF',
    'KLM': 'KL'
  };
  
  const code = airlineCodes[airlineName];
  if (code) return code;
  
  // Fallback: use first 2 letters of airline name
  return airlineName.replace(/[^A-Z]/g, '').substring(0, 2) || 'XX';
}

export function isFlightMessage(messageText: string): boolean {
  // Check if message contains flight indicators
  const flightIndicators = [
    '✈️',
    'vuelos',
    'flight',
    '🛫',
    '🛬',
    'Ida (',
    'Regreso (',
    'Duración:',
    'Escala en'
  ];
  
  return flightIndicators.some(indicator => 
    messageText.toLowerCase().includes(indicator.toLowerCase())
  );
}