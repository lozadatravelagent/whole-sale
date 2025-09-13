import { HotelData, HotelRoom } from '@/types';

export function parseHotelsFromMessage(messageText: string): HotelData[] {
  const hotels: HotelData[] = [];

  // Split by hotel options using --- as primary separator
  let hotelBlocks = messageText.split(/---+/).filter(block => block.trim().length > 0);

  // Remove the header block if it doesn't contain hotel details
  hotelBlocks = hotelBlocks.filter(block => {
    return block.includes('Precio:') && (block.includes('🏨') || block.includes('Hotel'));
  });



  for (let i = 0; i < hotelBlocks.length; i++) {
    const block = hotelBlocks[i];
    try {
      const hotel = parseHotelBlock(block);
      if (hotel) {
        hotels.push(hotel);
      } else {

      }
    } catch (error) {

    }
  }

  return hotels;
}

function parseHotelBlock(block: string): HotelData | null {

  // Extract hotel name - look for pattern after 🏨 or Hotel
  const hotelNameMatch = block.match(/🏨\s*[^-]*-\s*([^\n*]+?)(?:\s*\*+|\s*🏨|$)/) ||
    block.match(/Hotel:\s*([^\n]+)/i) ||
    block.match(/\*\*([^*]+Hotel[^*]*)\*\*/);

  if (!hotelNameMatch) {
    return null;
  }

  // Clean up hotel name - remove markdown formatting
  const hotelName = hotelNameMatch[1].replace(/\*+/g, '').trim();


  // Extract location/city
  const locationMatch = block.match(/📍\s*Ubicación:\s*([^\n]+)/i) ||
    block.match(/Ciudad:\s*([^\n]+)/i) ||
    block.match(/Ubicación:\s*([^\n]+)/i);
  const location = locationMatch ? locationMatch[1].trim() : '';

  // Extract category/stars
  const categoryMatch = block.match(/⭐\s*Categoría:\s*([^\n]+)/i) ||
    block.match(/Estrellas:\s*([^\n]+)/i) ||
    block.match(/(\d+\*+)/);
  const category = categoryMatch ? categoryMatch[1].trim() : '';

  // Extract check-in and check-out dates
  const checkInMatch = block.match(/🛏️\s*Check-in:\s*([^\n]+)/iu) ||
    block.match(/Entrada:\s*([^\n🛏️]+)/iu);
  const checkOutMatch = block.match(/🚪\s*Check-out:\s*([^\n]+)/iu) ||
    block.match(/Salida:\s*([^\n🚪]+)/iu);

  const checkIn = checkInMatch ? checkInMatch[1].trim() : '';
  const checkOut = checkOutMatch ? checkOutMatch[1].trim() : '';

  // Extract address if available
  const addressMatch = block.match(/📧\s*Dirección:\s*([^\n]+)/i) ||
    block.match(/Dirección:\s*([^\n]+)/i);
  const address = addressMatch ? addressMatch[1].trim() : '';

  // Extract phone if available
  const phoneMatch = block.match(/📞\s*Teléfono:\s*([^\n]+)/i) ||
    block.match(/Tel:\s*([^\n]+)/i);
  const phone = phoneMatch ? phoneMatch[1].trim() : '';

  // Extract description
  const descriptionMatch = block.match(/📝\s*Descripción:\s*([^\n]+)/iu) ||
    block.match(/Descripción:\s*([^\n💰🏨]+)/iu);
  const description = descriptionMatch ? descriptionMatch[1].trim() : '';

  // Extract rooms information
  const rooms = parseHotelRooms(block);

  if (rooms.length === 0) {
    return null;
  }

  // Calculate nights
  const nights = calculateNights(checkIn, checkOut);

  // Generate unique ID
  const hotelId = `hotel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const uniqueId = `PARSED_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  const hotelData: HotelData = {
    id: hotelId,
    unique_id: uniqueId,
    name: hotelName,
    category: category,
    city: location,
    address: address || undefined,
    phone: phone || undefined,
    description: description || undefined,
    images: [],
    rooms,
    check_in: checkIn,
    check_out: checkOut,
    nights,
    policy_cancellation: extractCancellationPolicy(block),
    policy_lodging: extractLodgingPolicy(block)
  };

  return hotelData;
}

function parseHotelRooms(block: string): HotelRoom[] {
  const rooms: HotelRoom[] = [];

  // Look for room sections - they might be separated by room types or prices
  const roomPatterns = [
    /🛏️\s*Habitación:\s*([^\n]+)[\s\S]*?💰\s*Precio:\s*([\d,.]+)\s*(\w+)/gi,
    /Habitación\s*([^:]+):\s*[\s\S]*?Precio:\s*([\d,.]+)\s*(\w+)/gi,
    /💰\s*Precio:\s*([\d,.]+)\s*(\w+)[\s\S]*?Habitación:\s*([^\n]+)/gi
  ];

  let foundRooms = false;

  for (const pattern of roomPatterns) {
    let match;
    while ((match = pattern.exec(block)) !== null) {
      foundRooms = true;

      let roomType, priceStr, currency;

      // Different match groups based on pattern
      if (match[3]) { // Pattern with room type first
        roomType = match[1];
        priceStr = match[2];
        currency = match[3];
      } else { // Pattern with price first
        priceStr = match[1];
        currency = match[2];
        roomType = match[3] || 'Habitación Estándar';
      }

      const price = parseFloat(priceStr.replace('.', '').replace(',', '.'));

      if (price > 0) {
        const room: HotelRoom = {
          type: roomType.trim(),
          description: roomType.trim(),
          price_per_night: price,
          total_price: price, // Assuming this is total price, could be per night
          currency: currency.toUpperCase(),
          availability: 3, // Default availability
          occupancy_id: (rooms.length + 1).toString()
        };

        rooms.push(room);
      }
    }

    if (foundRooms) break; // If we found rooms with one pattern, don't try others
  }

  // If no specific room patterns found, try to extract general price info
  if (rooms.length === 0) {
    const generalPriceMatch = block.match(/💰\s*Precio:\s*([\d,.]+)\s*(\w+)/i);
    if (generalPriceMatch) {
      const price = parseFloat(generalPriceMatch[1].replace('.', '').replace(',', '.'));
      const currency = generalPriceMatch[2].toUpperCase();

      if (price > 0) {
        const room: HotelRoom = {
          type: 'Habitación Estándar',
          description: 'Habitación Estándar',
          price_per_night: price,
          total_price: price,
          currency: currency,
          availability: 3,
          occupancy_id: '1'
        };

        rooms.push(room);
      }
    }
  }

  return rooms;
}

function extractCancellationPolicy(block: string): string | undefined {
  const policyMatch = block.match(/📋\s*Política de Cancelación:\s*([^\n]+)/i) ||
    block.match(/Cancelación:\s*([^\n]+)/i) ||
    block.match(/Política de cancelación:\s*([^\n]+)/i);
  return policyMatch ? policyMatch[1].trim() : undefined;
}

function extractLodgingPolicy(block: string): string | undefined {
  const policyMatch = block.match(/🏨\s*Política de Alojamiento:\s*([^\n]+)/i) ||
    block.match(/Políticas:\s*([^\n]+)/i) ||
    block.match(/Normas del hotel:\s*([^\n]+)/i);
  return policyMatch ? policyMatch[1].trim() : undefined;
}

function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1;

  try {
    const dateIn = new Date(checkIn);
    const dateOut = new Date(checkOut);
    const diffTime = dateOut.getTime() - dateIn.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  } catch (error) {
    console.warn('⚠️ Error calculating nights:', error);
    return 1;
  }
}

export function isHotelMessage(messageText: string): boolean {
  // Check for hotel trigger phrase and other indicators
  const hotelIndicators = [
    'quiero un hotel',
    'busco hotel',
    'necesito hotel',
    'hotel',
    '🏨',
    'alojamiento',
    'hospedaje',
    'reserva de hotel',
    'habitación',
    'check-in',
    'check-out',
    'huéspedes',
    'ocupación',
    'noches'
  ];

  const messageTextLower = messageText.toLowerCase();
  const hasIndicators = hotelIndicators.some(indicator =>
    messageTextLower.includes(indicator.toLowerCase())
  );

  // Also check for structured hotel information in the message
  const hasStructuredInfo = messageTextLower.includes('precio:') &&
    (messageTextLower.includes('hotel') || messageTextLower.includes('🏨'));

  const isHotelMsg = hasIndicators || hasStructuredInfo;

  return isHotelMsg;
}