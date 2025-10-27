# API Response Examples

This folder contains real API response examples from various travel providers. These examples are useful for:

- **Development**: Testing parsers and transformers without making API calls
- **Debugging**: Comparing actual responses with expected format
- **Documentation**: Understanding API response structure
- **Testing**: Creating test cases and fixtures

## 📁 Folder Structure

### [flight-responses/](./flight-responses/)
Flight search API response examples from Starling TVC API.

## Flight Response Examples

All flight examples are from the **Starling TVC API** (`searchAirFares` endpoint).

### Available Examples

| File | Description | Key Features |
|------|-------------|--------------|
| **starling-response-with-connections.json** | Flight with connections/layovers | Multi-segment legs, connections, LA carrier |
| **starling-response-multi-leg.json** | Round-trip multi-leg flights | Multiple flight options, AV carrier |
| **starling-response-with-commission.json** | Response with commission details | Commission amounts, AC carrier |
| **starling-response-direct-flights.json** | Direct flights only | No connections, IB carrier |
| **starling-response-latam.json** | LATAM Airlines flights | LA carrier specific |
| **starling-response-multi-passenger.json** | Multiple passengers (2 ADT) | Tax breakdown, multi-passenger pricing |
| **starling-response-with-stops.json** | Flights with multiple stops/layovers | Complex routing, stop details (2.4 MB) |

### Response Structure

All flight responses follow this structure:

```json
{
  "RecommendationID": "string",
  "CacheID": "string",
  "Fares": [
    {
      "FareID": "string",
      "FareAmount": number,
      "TaxAmount": number,
      "ServiceAmount": number,
      "CommissionAmount": number,
      "TotalAmount": number,
      "PaxFares": [...],
      "Currency": "USD",
      "LastTicketingDate": "ISO date",
      "ValidatingCarrier": "airline code",
      "Legs": [
        {
          "LegNumber": 1,
          "Options": [
            {
              "Segments": [...]
            }
          ]
        }
      ]
    }
  ]
}
```

### Common Carriers in Examples

- **LA**: LATAM Airlines
- **AV**: Avianca
- **AC**: Air Canada
- **IB**: Iberia

### Use Cases

#### 1. Testing Flight Parser
```typescript
import flightExample from './examples/flight-responses/starling-response-multi-leg.json';

const parsed = transformStarlingResults(flightExample);
console.log(parsed.flights);
```

#### 2. Testing UI Components
```typescript
// Test flight selector with real data
<FlightSelector flights={exampleFlights} />
```

#### 3. Debugging Price Calculations
```typescript
// Verify price calculation logic
const fare = flightExample.Fares[0];
const calculatedTotal = fare.FareAmount + fare.TaxAmount;
assert(calculatedTotal === fare.TotalAmount);
```

#### 4. Testing Edge Cases
- **Connections**: Use `starling-response-with-connections.json`
- **Commission**: Use `starling-response-with-commission.json`
- **Multi-passenger**: Use `starling-response-multi-passenger.json`
- **Direct flights**: Use `starling-response-direct-flights.json`

## Hotel Response Examples

> ⚠️ **TODO**: Add EUROVIPS hotel search response examples

Future examples to add:
- `eurovips-hotel-response-basic.json` - Basic hotel search
- `eurovips-hotel-response-multi-room.json` - Multiple room types
- `eurovips-package-response.json` - Combined package response

## Adding New Examples

When adding new API response examples:

1. **Anonymize**: Remove sensitive data (real passenger names, booking codes)
2. **Name descriptively**: Use pattern `{provider}-{type}-{feature}.json`
3. **Document**: Update this README with description
4. **Validate**: Ensure JSON is valid and formatted
5. **Size**: Keep files under 200KB if possible (use representative subset)

### Naming Convention

```
{provider}-{endpoint}-{feature}.json

Examples:
- starling-searchAirFares-roundtrip.json
- eurovips-searchHotelFares-allInclusive.json
- eurovips-makeBudget-request.json
```

## Related Documentation

- **[Starling API Integration](../../architecture/ASYNC_SEARCH_GUIDE.md)** - How flight search works
- **[EUROVIPS API Guide](../Softur%20-%20API%20GUIDE.md)** - Complete API documentation
- **[API Structure Analysis](../api_structure_analysis.md)** - API patterns and structure

## File Sizes

| File | Size | Lines |
|------|------|-------|
| starling-response-with-connections.json | ~2.4 MB | 49,853 |
| starling-response-multi-leg.json | ~4.5 MB | 92,045 |
| starling-response-with-commission.json | ~1.6 MB | 32,849 |
| starling-response-direct-flights.json | ~2.8 MB | 68,885 |
| starling-response-latam.json | ~2.8 MB | 57,995 |
| starling-response-multi-passenger.json | ~8.2 MB | 167,935 |
| starling-response-with-stops.json | ~2.4 MB | ~50,000 |

> 💡 **Tip**: These are large files. Use `jq` or JSON viewers for easier navigation:
> ```bash
> cat starling-response-multi-leg.json | jq '.Fares[0]'
> ```

## Testing with Examples

### Unit Tests
```typescript
describe('Flight Parser', () => {
  it('should parse multi-leg flights', () => {
    const example = require('./examples/flight-responses/starling-response-multi-leg.json');
    const result = parseFlightResponse(example);
    expect(result.flights).toHaveLength(expect.any(Number));
  });
});
```

### Integration Tests
```typescript
// Mock API with example response
nock('https://api.starling.com')
  .post('/searchAirFares')
  .reply(200, require('./examples/starling-response-latam.json'));
```

## Notes

- ✅ All examples are **real API responses** (anonymized)
- ✅ Examples cover various **edge cases** (connections, multi-passenger, etc.)
- ✅ **Currency**: All examples use USD
- ✅ **Date format**: ISO 8601 (e.g., "2025-09-24T23:59:59.000Z")
- ⚠️ Some examples are **large files** (>5MB) - use with caution in tests
- ⚠️ Examples may contain **outdated dates** - adjust for testing

## Future Enhancements

- [ ] Add EUROVIPS hotel search examples
- [ ] Add EUROVIPS package search examples
- [ ] Add makeBudget request/response examples
- [ ] Add convertToBooking examples
- [ ] Create smaller "minimal" versions for faster tests
- [ ] Add error response examples (4xx, 5xx)

