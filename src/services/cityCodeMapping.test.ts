/**
 * Manual test file for city code mapping
 * Run this in browser console by importing the functions
 */

import { getCityCode, getCityCodes, searchCities, getCityCount } from './cityCodeMapping';

export async function testCityMapping() {
  console.log('🧪 [TEST] Starting city mapping tests...\n');

  // Test 1: Common cities (with and without accents)
  console.log('Test 1: Common cities');
  try {
    console.log('  Cancún →', await getCityCode('Cancún'));
    console.log('  cancun →', await getCityCode('cancun'));
    console.log('  CANCUN →', await getCityCode('CANCUN'));
    console.log('✅ Test 1 passed\n');
  } catch (e) {
    console.error('❌ Test 1 failed:', e);
  }

  // Test 2: Cities with multiple matches (disambiguation)
  console.log('Test 2: Ambiguous cities (need country hint)');
  try {
    console.log('  Córdoba (no hint) →', await getCityCode('Córdoba'));
    console.log('  Córdoba, España →', await getCityCode('Córdoba', 'España'));
    console.log('  Córdoba, Argentina →', await getCityCode('Córdoba', 'Argentina'));
    console.log('✅ Test 2 passed\n');
  } catch (e) {
    console.error('❌ Test 2 failed:', e);
  }

  // Test 3: Multi-word cities
  console.log('Test 3: Multi-word cities');
  try {
    console.log('  Punta Cana →', await getCityCode('Punta Cana'));
    console.log('  punta cana →', await getCityCode('punta cana'));
    console.log('  Buenos Aires →', await getCityCode('Buenos Aires'));
    console.log('  São Paulo →', await getCityCode('São Paulo'));
    console.log('  Sao Paulo →', await getCityCode('Sao Paulo'));
    console.log('✅ Test 3 passed\n');
  } catch (e) {
    console.error('❌ Test 3 failed:', e);
  }

  // Test 4: Partial matches
  console.log('Test 4: Partial matches');
  try {
    console.log('  Barcelon →', await getCityCode('Barcelon'));
    console.log('  Madri →', await getCityCode('Madri'));
    console.log('✅ Test 4 passed\n');
  } catch (e) {
    console.error('❌ Test 4 failed:', e);
  }

  // Test 5: Get full city codes (with country)
  console.log('Test 5: Get full city information');
  try {
    const puntaCana = await getCityCodes('Punta Cana');
    console.log('  Punta Cana full data:', puntaCana);
    console.log('✅ Test 5 passed\n');
  } catch (e) {
    console.error('❌ Test 5 failed:', e);
  }

  // Test 6: Search/autocomplete
  console.log('Test 6: Search cities (autocomplete)');
  try {
    const results = searchCities('bar');
    console.log('  Search "bar" →', results.map(c => `${c.cityName} (${c.cityCode})`));
    console.log('✅ Test 6 passed\n');
  } catch (e) {
    console.error('❌ Test 6 failed:', e);
  }

  // Test 7: Non-existent city (should throw error)
  console.log('Test 7: Non-existent city (error handling)');
  try {
    await getCityCode('Ciudad Inventada Que No Existe');
    console.error('❌ Test 7 failed: Should have thrown error');
  } catch (e) {
    console.log('  ✅ Correctly threw error:', e.message);
    console.log('✅ Test 7 passed\n');
  }

  // Test 8: City count
  console.log('Test 8: Total cities available');
  const count = getCityCount();
  console.log(`  Total cities in database: ${count}`);
  console.log('✅ Test 8 passed\n');

  console.log('🎉 All tests completed!');
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  (window as any).testCityMapping = testCityMapping;
  console.log('💡 Run tests by calling: testCityMapping()');
}
