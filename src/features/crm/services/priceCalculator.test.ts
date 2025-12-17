/**
 * Manual test file for price calculator service
 * Run this in browser console by importing the function
 *
 * Usage:
 * import { testPriceCalculator } from '@/features/crm/services/priceCalculator.test';
 * await testPriceCalculator();
 */

import {
  extractRoomForCalculation,
  calculateHotelPrice,
  calculateFlightPrice,
  calculateTotalPrice
} from './priceCalculator';
import type { HotelData, HotelDataWithSelectedRoom, FlightData, HotelRoom } from '@/types';

export async function testPriceCalculator() {
  console.log('🧪 [TEST] Starting price calculator tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Helper function to assert
  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`✅ ${message}`);
      testsPassed++;
    } else {
      console.error(`❌ ${message}`);
      testsFailed++;
    }
  };

  // ========================================================================
  // Test 1: Single hotel with selectedRoom property (HotelDataWithSelectedRoom)
  // ========================================================================
  console.log('Test 1: Hotel with selectedRoom property');
  try {
    const hotel: HotelDataWithSelectedRoom = {
      id: 'hotel-1',
      unique_id: 'unique-1',
      name: 'Test Hotel 1',
      category: '5 stars',
      city: 'Cancún',
      address: '123 Beach St',
      check_in: '2025-01-15',
      check_out: '2025-01-20',
      nights: 5,
      rooms: [
        {
          occupancy_id: 'room-1',
          type: 'DBL',
          description: 'Double room',
          total_price: 800,
          price_per_night: 160,
          currency: 'USD',
          availability: 5
        } as HotelRoom,
        {
          occupancy_id: 'room-2',
          type: 'TPL',
          description: 'Triple room',
          total_price: 1200,
          price_per_night: 240,
          currency: 'USD',
          availability: 3
        } as HotelRoom
      ],
      selectedRoom: {
        occupancy_id: 'room-2',
        type: 'TPL',
        description: 'Triple room',
        total_price: 1200,
        price_per_night: 240,
        currency: 'USD',
        availability: 3
      } as HotelRoom
    };

    const result = calculateHotelPrice(hotel);
    assert(result.total === 1200, 'Test 1.1: Total should be 1200');
    assert(result.source === 'selected', 'Test 1.2: Source should be "selected"');
    assert(result.room.type === 'TPL', 'Test 1.3: Room type should be TPL');
    console.log('');
  } catch (e) {
    console.error('❌ Test 1 failed:', e);
    testsFailed += 3;
  }

  // ========================================================================
  // Test 2: Single hotel without selectedRoom (cheapest fallback)
  // ========================================================================
  console.log('Test 2: Hotel without selectedRoom (cheapest fallback)');
  try {
    const hotel: HotelData = {
      id: 'hotel-2',
      unique_id: 'unique-2',
      name: 'Test Hotel 2',
      category: '4 stars',
      city: 'Punta Cana',
      address: '456 Resort Rd',
      check_in: '2025-02-01',
      check_out: '2025-02-08',
      nights: 7,
      rooms: [
        {
          occupancy_id: 'room-3',
          type: 'SGL',
          description: 'Single room',
          total_price: 500,
          price_per_night: 71.43,
          currency: 'USD',
          availability: 10
        } as HotelRoom,
        {
          occupancy_id: 'room-4',
          type: 'DBL',
          description: 'Double room',
          total_price: 800,
          price_per_night: 114.29,
          currency: 'USD',
          availability: 5
        } as HotelRoom,
        {
          occupancy_id: 'room-5',
          type: 'TPL',
          description: 'Triple room',
          total_price: 1200,
          price_per_night: 171.43,
          currency: 'USD',
          availability: 2
        } as HotelRoom
      ]
    };

    const result = calculateHotelPrice(hotel);
    assert(result.total === 500, 'Test 2.1: Total should be 500 (cheapest room)');
    assert(result.source === 'cheapest', 'Test 2.2: Source should be "cheapest"');
    assert(result.room.type === 'SGL', 'Test 2.3: Room type should be SGL');
    console.log('');
  } catch (e) {
    console.error('❌ Test 2 failed:', e);
    testsFailed += 3;
  }

  // ========================================================================
  // Test 3: Hotel with selectedRoomId parameter
  // ========================================================================
  console.log('Test 3: Hotel with selectedRoomId parameter');
  try {
    const hotel: HotelData = {
      id: 'hotel-3',
      unique_id: 'unique-3',
      name: 'Test Hotel 3',
      category: '5 stars',
      city: 'Cancún',
      address: '789 Beach Blvd',
      check_in: '2025-03-01',
      check_out: '2025-03-05',
      nights: 4,
      rooms: [
        {
          occupancy_id: 'room-6',
          type: 'DBL',
          description: 'Double room',
          total_price: 600,
          price_per_night: 150,
          currency: 'USD',
          availability: 5
        } as HotelRoom,
        {
          occupancy_id: 'room-7',
          type: 'TPL',
          description: 'Triple room',
          total_price: 900,
          price_per_night: 225,
          currency: 'USD',
          availability: 3
        } as HotelRoom
      ]
    };

    const result = calculateHotelPrice(hotel, 'room-7');
    assert(result.total === 900, 'Test 3.1: Total should be 900 (selected by ID)');
    assert(result.source === 'selected', 'Test 3.2: Source should be "selected"');
    assert(result.room.occupancy_id === 'room-7', 'Test 3.3: Should use room-7');
    console.log('');
  } catch (e) {
    console.error('❌ Test 3 failed:', e);
    testsFailed += 3;
  }

  // ========================================================================
  // Test 4: Multiple hotels with mixed selection
  // ========================================================================
  console.log('Test 4: Multiple hotels with mixed selection');
  try {
    const hotel1: HotelDataWithSelectedRoom = {
      id: 'hotel-4',
      unique_id: 'unique-4',
      name: 'Hotel A',
      category: '5 stars',
      city: 'Cancún',
      address: '111 Palm St',
      check_in: '2025-04-01',
      check_out: '2025-04-08',
      nights: 7,
      rooms: [
        { occupancy_id: 'r1', type: 'SGL', total_price: 700, price_per_night: 100, currency: 'USD', availability: 5, description: '' } as HotelRoom,
        { occupancy_id: 'r2', type: 'TPL', total_price: 1200, price_per_night: 171.43, currency: 'USD', availability: 2, description: '' } as HotelRoom
      ],
      selectedRoom: { occupancy_id: 'r2', type: 'TPL', total_price: 1200, price_per_night: 171.43, currency: 'USD', availability: 2, description: '' } as HotelRoom
    };

    const hotel2: HotelData = {
      id: 'hotel-5',
      unique_id: 'unique-5',
      name: 'Hotel B',
      category: '4 stars',
      city: 'Punta Cana',
      address: '222 Ocean Dr',
      check_in: '2025-04-01',
      check_out: '2025-04-08',
      nights: 7,
      rooms: [
        { occupancy_id: 'r3', type: 'DBL', total_price: 600, price_per_night: 85.71, currency: 'USD', availability: 8, description: '' } as HotelRoom,
        { occupancy_id: 'r4', type: 'TPL', total_price: 900, price_per_night: 128.57, currency: 'USD', availability: 3, description: '' } as HotelRoom
      ]
    };

    const breakdown = calculateTotalPrice([], [hotel1, hotel2]);
    assert(breakdown.hotelSubtotal === 1800, 'Test 4.1: Hotel subtotal should be 1800 (1200 + 600)');
    assert(breakdown.hotels.length === 2, 'Test 4.2: Should have 2 hotel results');
    assert(breakdown.hotels[0].source === 'selected', 'Test 4.3: First hotel should be "selected"');
    assert(breakdown.hotels[1].source === 'cheapest', 'Test 4.4: Second hotel should be "cheapest"');
    console.log('');
  } catch (e) {
    console.error('❌ Test 4 failed:', e);
    testsFailed += 4;
  }

  // ========================================================================
  // Test 5: Hotel with null/undefined price (edge case)
  // ========================================================================
  console.log('Test 5: Hotel with null/undefined price');
  try {
    const hotel: HotelData = {
      id: 'hotel-6',
      unique_id: 'unique-6',
      name: 'Hotel Null Price',
      category: '3 stars',
      city: 'Test City',
      address: '333 Test St',
      check_in: '2025-05-01',
      check_out: '2025-05-05',
      nights: 4,
      rooms: [
        { occupancy_id: 'r5', type: 'DBL', total_price: null as any, price_per_night: 0, currency: 'USD', availability: 5, description: '' } as HotelRoom
      ]
    };

    const result = calculateHotelPrice(hotel);
    assert(result.total === 0, 'Test 5.1: Total should be 0 for null price');
    console.log('');
  } catch (e) {
    console.error('❌ Test 5 failed:', e);
    testsFailed++;
  }

  // ========================================================================
  // Test 6: Flight with number price
  // ========================================================================
  console.log('Test 6: Flight with number price');
  try {
    const flight: FlightData = {
      id: 'flight-1',
      airline: { code: 'LA', name: 'LATAM' },
      price: { amount: 1234.56, currency: 'USD' },
      adults: 2,
      childrens: 0,
      departure_date: '2025-01-15',
      legs: []
    } as FlightData;

    const result = calculateFlightPrice(flight);
    assert(result.total === 1234.56, 'Test 6.1: Total should be 1234.56');
    assert(result.currency === 'USD', 'Test 6.2: Currency should be USD');
    console.log('');
  } catch (e) {
    console.error('❌ Test 6 failed:', e);
    testsFailed += 2;
  }

  // ========================================================================
  // Test 7: Flight with string price
  // ========================================================================
  console.log('Test 7: Flight with string price');
  try {
    const flight: FlightData = {
      id: 'flight-2',
      airline: { code: 'AV', name: 'Avianca' },
      price: { amount: '$2,345.67' as any, currency: 'USD' },
      adults: 1,
      childrens: 0,
      departure_date: '2025-02-01',
      legs: []
    } as FlightData;

    const result = calculateFlightPrice(flight);
    assert(result.total === 2345.67, 'Test 7.1: Total should be 2345.67 (parsed from string)');
    console.log('');
  } catch (e) {
    console.error('❌ Test 7 failed:', e);
    testsFailed++;
  }

  // ========================================================================
  // Test 8: Combined calculation (2 flights + 2 hotels)
  // ========================================================================
  console.log('Test 8: Combined calculation (2 flights + 2 hotels)');
  try {
    const flights: FlightData[] = [
      {
        id: 'f1',
        airline: { code: 'LA', name: 'LATAM' },
        price: { amount: 800, currency: 'USD' },
        adults: 2,
        childrens: 0,
        departure_date: '2025-01-15',
        legs: []
      } as FlightData,
      {
        id: 'f2',
        airline: { code: 'AV', name: 'Avianca' },
        price: { amount: 1000, currency: 'USD' },
        adults: 2,
        childrens: 0,
        departure_date: '2025-01-20',
        legs: []
      } as FlightData
    ];

    const hotels: HotelData[] = [
      {
        id: 'h1',
        unique_id: 'u1',
        name: 'Hotel Combined 1',
        category: '5',
        city: 'Cancún',
        address: 'Addr 1',
        check_in: '2025-01-15',
        check_out: '2025-01-20',
        nights: 5,
        rooms: [{ occupancy_id: 'r1', type: 'DBL', total_price: 600, price_per_night: 120, currency: 'USD', availability: 5, description: '' } as HotelRoom]
      },
      {
        id: 'h2',
        unique_id: 'u2',
        name: 'Hotel Combined 2',
        category: '4',
        city: 'Punta Cana',
        address: 'Addr 2',
        check_in: '2025-01-15',
        check_out: '2025-01-20',
        nights: 5,
        rooms: [{ occupancy_id: 'r2', type: 'TPL', total_price: 800, price_per_night: 160, currency: 'USD', availability: 3, description: '' } as HotelRoom]
      }
    ];

    const breakdown = calculateTotalPrice(flights, hotels);
    assert(breakdown.flightSubtotal === 1800, 'Test 8.1: Flight subtotal should be 1800');
    assert(breakdown.hotelSubtotal === 1400, 'Test 8.2: Hotel subtotal should be 1400');
    assert(breakdown.grandTotal === 3200, 'Test 8.3: Grand total should be 3200');
    assert(breakdown.currency === 'USD', 'Test 8.4: Currency should be USD');
    console.log('');
  } catch (e) {
    console.error('❌ Test 8 failed:', e);
    testsFailed += 4;
  }

  // ========================================================================
  // Test 9: Mixed currencies warning
  // ========================================================================
  console.log('Test 9: Mixed currencies warning');
  try {
    const hotels: HotelData[] = [
      {
        id: 'h-usd',
        unique_id: 'u-usd',
        name: 'Hotel USD',
        category: '5',
        city: 'Miami',
        address: 'USD St',
        check_in: '2025-01-15',
        check_out: '2025-01-20',
        nights: 5,
        rooms: [{ occupancy_id: 'r-usd', type: 'DBL', total_price: 600, price_per_night: 120, currency: 'USD', availability: 5, description: '' } as HotelRoom]
      },
      {
        id: 'h-eur',
        unique_id: 'u-eur',
        name: 'Hotel EUR',
        category: '5',
        city: 'Madrid',
        address: 'EUR St',
        check_in: '2025-01-15',
        check_out: '2025-01-20',
        nights: 5,
        rooms: [{ occupancy_id: 'r-eur', type: 'DBL', total_price: 550, price_per_night: 110, currency: 'EUR', availability: 5, description: '' } as HotelRoom]
      }
    ];

    const breakdown = calculateTotalPrice([], hotels);
    assert(breakdown.warnings.length > 0, 'Test 9.1: Should have warnings');
    assert(breakdown.warnings.some(w => w.includes('Mixed currencies')), 'Test 9.2: Warning should mention mixed currencies');
    console.log('');
  } catch (e) {
    console.error('❌ Test 9 failed:', e);
    testsFailed += 2;
  }

  // ========================================================================
  // Test 10: Hotel with no rooms (should throw)
  // ========================================================================
  console.log('Test 10: Hotel with no rooms (should throw error)');
  try {
    const hotel: HotelData = {
      id: 'hotel-no-rooms',
      unique_id: 'u-no-rooms',
      name: 'Hotel No Rooms',
      category: '3',
      city: 'Test',
      address: 'Test',
      check_in: '2025-01-15',
      check_out: '2025-01-20',
      nights: 5,
      rooms: []
    };

    let errorThrown = false;
    try {
      extractRoomForCalculation(hotel);
    } catch (error) {
      errorThrown = true;
      assert(error instanceof Error && error.message.includes('no rooms available'), 'Test 10.1: Error message should mention no rooms');
    }

    assert(errorThrown, 'Test 10.2: Should throw error for hotel with no rooms');
    console.log('');
  } catch (e) {
    console.error('❌ Test 10 failed:', e);
    testsFailed += 2;
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('================================================================================');
  console.log(`🧪 [TEST] Test Summary: ${testsPassed} passed, ${testsFailed} failed`);
  if (testsFailed === 0) {
    console.log('✅ All tests passed!');
  } else {
    console.error(`❌ ${testsFailed} test(s) failed`);
  }
  console.log('================================================================================');
}
