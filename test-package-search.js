// Test script for package search
import { searchPackageFares, testPackageWebService } from './src/services/packageSearch.ts';

async function testPackageSearch() {
  console.log('🧪 Testing Package Search Implementation');
  console.log('=' .repeat(50));

  // Test 1: Basic connectivity
  console.log('\n1️⃣ Testing WebService connectivity...');
  const isConnected = await testPackageWebService();
  console.log(`Connection status: ${isConnected ? '✅ Success' : '❌ Failed'}`);

  // Test 2: Search for specific package
  console.log('\n2️⃣ Searching for packages...');
  const packageParams = {
    city: 'Puerto Madryn',
    dateFrom: '2025-10-15',
    dateTo: '2025-10-25',
    class: 'AEROTERRESTRE',
    adults: 2,
    children: 0
  };

  console.log('Search parameters:', packageParams);
  
  try {
    const packages = await searchPackageFares(packageParams);
    
    if (packages.length > 0) {
      console.log(`\n✅ Found ${packages.length} package(s):`);
      
      packages.forEach((pkg, index) => {
        console.log(`\n📦 Package ${index + 1}:`);
        console.log(`  🏷️  Name: ${pkg.name}`);
        console.log(`  🎯 Destination: ${pkg.destination}`);
        console.log(`  ⭐ Category: ${pkg.category}`);
        console.log(`  🎪 Class: ${pkg.class}`);
        console.log(`  🏨 Lodged: ${pkg.lodgedNights} nights, ${pkg.lodgedDays} days`);
        console.log(`  📅 Operation Days: ${pkg.operationItems.join(', ')}`);
        
        // Show fares
        console.log(`  💰 Available Fares:`);
        pkg.fares.forEach(fare => {
          console.log(`    ${fare.type} (${fare.passengerType}): $${fare.total} ${fare.currency} (Base: $${fare.base}, Taxes: $${fare.taxes.reduce((sum, tax) => sum + tax.amount, 0)})`);
        });
        
        // Show policies
        if (pkg.policies.cancellation) {
          console.log(`  📋 Cancellation: ${pkg.policies.cancellation}`);
        }
        if (pkg.policies.children) {
          console.log(`  👶 Children Policy: ${pkg.policies.children}`);
        }
        
        // Show operation days
        if (pkg.operationDays.length > 0) {
          console.log(`  🗓️  Operation Days: ${pkg.operationDays.length} available`);
          pkg.operationDays.slice(0, 2).forEach((day, dayIndex) => {
            console.log(`    Day ${dayIndex + 1} (${day.date}): ${day.seatAvailable} seats, ${day.roomsAvailable} rooms`);
            
            // Show composition summary
            const { hotels, flights } = day.composition;
            if (hotels.length > 0) {
              console.log(`      🏨 Hotels: ${hotels.map(h => `${h.name} (${h.category})`).join(', ')}`);
            }
            if (flights.length > 0) {
              console.log(`      ✈️  Flights: ${flights.map(f => `${f.airline.name} ${f.flight.number}`).join(', ')}`);
            }
          });
          
          if (pkg.operationDays.length > 2) {
            console.log(`    ... and ${pkg.operationDays.length - 2} more operation days`);
          }
        }
        
        if (pkg.description) {
          console.log(`  📝 Description: ${pkg.description}`);
        }
      });
    } else {
      console.log('\n⚠️ No packages found. Possible reasons:');
      console.log('  - No packages available for the specified destination/dates');
      console.log('  - WebService connectivity issues');
      console.log('  - Invalid city code or parameters');
    }
    
  } catch (error) {
    console.error('\n❌ Error during package search:', error.message);
  }

  // Test 3: Different destinations
  console.log('\n3️⃣ Testing different destinations...');
  const destinations = ['Madrid', 'Barcelona', 'Buenos Aires', 'Bariloche'];
  
  for (const destination of destinations) {
    console.log(`\n🔍 Testing ${destination}...`);
    try {
      const packages = await searchPackageFares({
        city: destination,
        dateFrom: '2025-11-01',
        dateTo: '2025-11-08',
        class: 'TERRESTRE',
        adults: 1
      });
      
      console.log(`  Result: ${packages.length} package(s) found`);
      
      if (packages.length > 0) {
        const firstPackage = packages[0];
        console.log(`  Sample: ${firstPackage.name} - $${firstPackage.price.total} ${firstPackage.price.currency}`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Package search test completed!');
}

// Run the test
testPackageSearch().catch(console.error);