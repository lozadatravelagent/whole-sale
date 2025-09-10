import { FlightData, FlightLeg, AirportInfo, LayoverInfo } from '@/types';

export function parseFlightsFromMessage(messageText: string): FlightData[] {
  console.log('🔄 Parsing flights from message...');
  const flights: FlightData[] = [];
  
  // Split by flight options using --- as primary separator
  let flightBlocks = messageText.split(/---+/).filter(block => block.trim().length > 0);
  
  // Remove the header block if it doesn't contain flight details
  flightBlocks = flightBlocks.filter(block => {
    return block.includes('Precio:') && block.includes('✈️');
  });
  console.log('🔢 Found flight blocks:', flightBlocks.length);
  
  for (let i = 0; i < flightBlocks.length; i++) {
    const block = flightBlocks[i];
    console.log(`🔍 Processing block ${i + 1}:`, block.substring(0, 200));
    
    try {
      const flight = parseFlightBlock(block);
      if (flight) {
        console.log('✅ Successfully parsed flight:', flight.airline.name, flight.price.amount);
        flights.push(flight);
      } else {
        console.log('❌ Failed to parse flight block');
      }
    } catch (error) {
      console.warn('⚠️ Error parsing flight block:', error, block.substring(0, 100));
    }
  }
  
  
  console.log('📊 Total flights parsed:', flights.length);
  return flights;
}

function parseFlightBlock(block: string): FlightData | null {
  console.log('🧩 Parsing individual flight block...');
  
  // Extract airline name - much simpler approach
  const airlineMatch = block.match(/✈️\s*[^-]*-\s*([^\n🛫*]+?)(?:\s*\*+|\s*🛫|$)/);
  if (!airlineMatch) {
    console.log('❌ No airline match found');
    return null;
  }
  
  // Clean up airline name - remove markdown formatting
  const airlineName = airlineMatch[1].replace(/\*+/g, '').trim();
  const airlineCode = extractAirlineCode(airlineName);
  console.log('✈️ Airline:', airlineName, '(' + airlineCode + ')');
  
  // Extract price - simple and direct
  const priceMatch = block.match(/💰\s*Precio:\s*([\d,.]+)\s*(\w+)/);
  if (!priceMatch) {
    console.log('❌ No price match found');
    return null;
  }
  
  const price = {
    amount: parseFloat(priceMatch[1].replace('.', '').replace(',', '.')),
    currency: priceMatch[2]
  };
  console.log('💰 Price:', price.amount, price.currency);
  
  // Extract departure date from "Ida (date)"
  const departureMatch = block.match(/🛫\s*Ida\s*\(([^)]+)\)/);
  const departureDate = departureMatch ? departureMatch[1].trim() : '';
  
  // Extract return date from "Regreso (date)"
  const returnMatch = block.match(/🛬\s*Regreso\s*\(([^)]+)\)/);
  const returnDate = returnMatch ? returnMatch[1].trim() : undefined;
  
  console.log('📅 Dates - Departure:', departureDate, 'Return:', returnDate);
  
  // Extract outbound flight info - handle markdown formatting
  const outboundOriginMatch = block.match(/\*?Origen\*?:\s*([^\n🕒🎯]+?)(?:\s*🕒|$)/);
  const outboundTimeMatch = block.match(/\*?Salida\*?:\s*([^\n🎯🕓]+?)(?:\s*🎯|$)/);
  const outboundDestMatch = block.match(/\*?Destino\*?:\s*([^\n🕓⏱️]+?)(?:\s*🕓|$)/);
  const outboundArrivalMatch = block.match(/\*?Llegada\*?:\s*([^\n⏱️🛬]+?)(?:\s*⏱️|$)/);
  const outboundDurationMatch = block.match(/\*?Duración\*?:\s*([^\n🛬💰]+?)(?:\s*🛬|\s*💰|\n|$)/);
  
  if (!outboundOriginMatch || !outboundTimeMatch || !outboundDestMatch || !outboundArrivalMatch || !outboundDurationMatch) {
    console.log('❌ Missing outbound flight info');
    console.log('🔍 Origin match:', outboundOriginMatch ? 'FOUND' : 'MISSING');
    console.log('🔍 Time match:', outboundTimeMatch ? 'FOUND' : 'MISSING');
    console.log('🔍 Dest match:', outboundDestMatch ? 'FOUND' : 'MISSING');
    console.log('🔍 Arrival match:', outboundArrivalMatch ? 'FOUND' : 'MISSING');
    console.log('🔍 Duration match:', outboundDurationMatch ? 'FOUND' : 'MISSING');
    
    // Let's see what we can find with looser regex
    console.log('🔍 Looking for any Origen:', block.match(/Origen/gi));
    console.log('🔍 Looking for any Salida:', block.match(/Salida/gi));
    console.log('🔍 Looking for any Destino:', block.match(/Destino/gi));
    
    return null;
  }
  
  const legs: FlightLeg[] = [];
  
  // Create outbound leg
  const outboundLeg: FlightLeg = {
    departure: parseAirportInfo(outboundOriginMatch[1], outboundTimeMatch[1]),
    arrival: parseAirportInfo(outboundDestMatch[1], outboundArrivalMatch[1]),
    duration: outboundDurationMatch[1].trim(),
    flight_type: 'outbound',
    layovers: []
  };
  
  legs.push(outboundLeg);
  
  // If there's a return date, try to parse return flight
  if (returnDate) {
    const returnOriginMatch = block.match(/🛬\s*Regreso[\s\S]*?\*?Origen\*?:\s*([^\n🕒🎯]+?)(?:\s*🕒|$)/);
    const returnTimeMatch = block.match(/🛬\s*Regreso[\s\S]*?\*?Salida\*?:\s*([^\n🎯🕓]+?)(?:\s*🎯|$)/);
    const returnDestMatch = block.match(/🛬\s*Regreso[\s\S]*?\*?Destino\*?:\s*([^\n🕓⏱️]+?)(?:\s*🕓|$)/);
    const returnArrivalMatch = block.match(/🛬\s*Regreso[\s\S]*?\*?Llegada\*?:\s*([^\n⏱️💰]+?)(?:\s*⏱️|$)/);
    const returnDurationMatch = block.match(/🛬\s*Regreso[\s\S]*?\*?Duración\*?:\s*([^\n💰]+?)(?:\s*💰|\n|$)/);
    
    if (returnOriginMatch && returnTimeMatch && returnDestMatch && returnArrivalMatch && returnDurationMatch) {
      const returnLeg: FlightLeg = {
        departure: parseAirportInfo(returnOriginMatch[1], returnTimeMatch[1]),
        arrival: parseAirportInfo(returnDestMatch[1], returnArrivalMatch[1]),
        duration: returnDurationMatch[1].trim(),
        flight_type: 'return',
        layovers: []
      };
      
      legs.push(returnLeg);
      console.log('✅ Return flight parsed');
    } else {
      console.log('⚠️ Return date found but could not parse return flight details');
    }
  }
  
  // Generate unique ID
  const flightId = `flight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const flightData: FlightData = {
    id: flightId,
    airline: {
      code: airlineCode,
      name: airlineName
    },
    price,
    adults: 1, // Default
    childrens: 0, // Default
    departure_date: departureDate,
    return_date: returnDate,
    legs,
    luggage: false,
    travel_assistance: 0,
    transfers: 0
  };
  
  console.log('✅ Flight data created:', flightData);
  return flightData;
}

function parseAirportInfo(locationText: string, timeText: string): AirportInfo {
  console.log('🛫 Parsing airport info - Location:', locationText, 'Time:', timeText);
  
  // Clean up text - remove markdown and extra spaces
  const cleanLocation = locationText.replace(/\*+/g, '').trim();
  const cleanTime = timeText.replace(/\*+/g, '').trim();
  
  // Extract city code and name from format "CITY NAME (CODE)" or "CITY NAME"
  const codeMatch = cleanLocation.match(/\(([^)]+)\)/);
  const cityCode = codeMatch ? codeMatch[1] : extractCityCode(cleanLocation);
  
  // Clean up city name
  const cityName = cleanLocation.replace(/\s*\([^)]*\)\s*/, '').trim();
  
  const result = {
    city_code: cityCode,
    city_name: cityName,
    time: cleanTime
  };
  
  console.log('🛫 Parsed airport:', result);
  return result;
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
  console.log('🔍 Checking if message is flight message:', messageText.substring(0, 100));
  
  // Check if message contains flight indicators
  const flightIndicators = [
    '✈️',
    'vuelos',
    'flight',
    '🛫',
    '🛬', 
    'Precio:',
    'USD',
    'Ida (',
    'Regreso (',
    'Duración',
    'Origen:',
    'Destino:',
    'opciones de vuelos'
  ];
  
  const hasIndicators = flightIndicators.some(indicator => 
    messageText.toLowerCase().includes(indicator.toLowerCase())
  );
  
  console.log('🔍 Flight indicators found:', hasIndicators);
  return hasIndicators;
}