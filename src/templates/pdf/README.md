# PDF Templates

This folder contains HTML templates used by PDFMonkey to generate travel quote PDFs. These templates use **Liquid syntax** for dynamic data rendering.

## 📋 Available Templates

### 1. flights-simple.html
**Original**: `flights.html`
**PDFMonkey Template ID**: `67B7F3A5-7BFE-4F52-BE6B-110371CB9376`

**Used for**:
- Single flight bookings
- Simple round-trip flights (2 legs: outbound + return)
- Direct flights without complex layovers

**Template Structure**:
```liquid
{
  "airline": { "code": "LA", "name": "LATAM" },
  "price": { "amount": 500, "currency": "USD" },
  "adults": 1,
  "childrens": 0,
  "departure_date": "2025-11-01",
  "return_date": "2025-11-10",
  "luggage": true,
  "legs": [
    {
      "flight_type": "outbound",
      "departure": { "city_code": "EZE", "city_name": "Buenos Aires", "time": "10:00" },
      "arrival": { "city_code": "MAD", "city_name": "Madrid", "time": "22:00" },
      "duration": "12h 0m",
      "layovers": []
    },
    {
      "flight_type": "return",
      ...
    }
  ]
}
```

**Key Features**:
- Fixed 2-leg layout (outbound/return)
- Layover information per leg
- Luggage status indicator
- Simple, clean design

---

### 2. flights-multiple.html
**Original**: `flights2.html`
**PDFMonkey Template ID**: `30B142BF-1DD9-432D-8261-5287556DC9FC`

**Used for**:
- Multiple flight options (2-4 flights)
- Complex multi-leg flights
- Round-trip flights with multiple segments
- Flights with multiple layovers

**Template Structure**:
```liquid
{
  "selected_flights": [
    {
      "airline": { "code": "LA", "name": "LATAM" },
      "price": { "amount": 500, "currency": "USD" },
      "adults": 1,
      "childrens": 0,
      "departure_date": "2025-11-01",
      "return_date": "2025-11-10",
      "luggage": true,
      "travel_assistance": 50,
      "transfers": 30,
      "legs": [
        { ... },
        { ... }
      ]
    },
    {
      // Second flight option
    }
  ]
}
```

**Key Features**:
- Dynamic loop for any number of flights
- Dynamic loop for any number of legs per flight
- Travel assistance pricing (optional)
- Transfer pricing (optional)
- Each flight on separate page
- Supports 4+ legs per flight

---

### 3. combined-flight-hotel.html
**Original**: `both.html`
**PDFMonkey Template ID**: `3E8394AC-84D4-4286-A1CD-A12D1AB001D5`

**Used for**:
- Combined flight + hotel packages
- Complete travel packages
- Budget summaries

**Template Structure**:
```liquid
{
  "selected_flights": [ ... ],
  "best_hotels": [
    {
      "name": "Hotel Barcelona",
      "location": "Barcelona, España",
      "stars": 4,
      "price": 150,
      "link": "https://..."
    }
  ],
  "checkin": "2025-11-01",
  "checkout": "2025-11-10",
  "adults": 2,
  "childrens": 1,
  "total_price": 2500,
  "total_currency": "USD",
  "flight_price": 1500,
  "hotel_price": 1000,
  "travel_assistance": 50,
  "transfers": 30
}
```

**Key Features**:
- Summary page with total pricing breakdown
- Flight details (same as flights-multiple)
- Hotel recommendations (top 3)
- Check-in/check-out dates
- Travel assistance and transfers pricing

---

## 🔄 Template Selection Logic

The system automatically selects the appropriate template based on the booking data:

```typescript
// In src/services/pdfMonkey.ts

// Combined (flights + hotels)
if (flights.length > 0 && hotels.length > 0) {
  return 'combined-flight-hotel.html';
}

// Multiple flights (2-4)
if (flights.length >= 2) {
  return 'flights-multiple.html';
}

// Single complex flight (round trip with layovers or multi-leg)
if (flights.length === 1 && (
  flights[0].legs.length > 2 ||
  hasLayovers(flights[0])
)) {
  return 'flights-multiple.html';
}

// Simple single flight
return 'flights-simple.html';
```

## 📝 Liquid Syntax Reference

### Common Variables

#### Flight Data
```liquid
{{ airline.code }}          // Airline code (e.g., "LA")
{{ airline.name }}          // Airline name (e.g., "LATAM")
{{ price.amount }}          // Price amount (e.g., 500)
{{ price.currency }}        // Currency (e.g., "USD")
{{ departure_date }}        // Departure date
{{ return_date }}           // Return date
{{ adults }}                // Number of adults
{{ childrens }}             // Number of children
{{ luggage }}               // Boolean: has checked baggage
```

#### Leg Data
```liquid
{{ leg.flight_type }}                 // "outbound" or "return"
{{ leg.departure.city_code }}         // Departure airport code
{{ leg.departure.city_name }}         // Departure city name
{{ leg.departure.time }}              // Departure time
{{ leg.arrival.city_code }}           // Arrival airport code
{{ leg.arrival.city_name }}           // Arrival city name
{{ leg.arrival.time }}                // Arrival time
{{ leg.duration }}                    // Flight duration
```

#### Layover Data
```liquid
{% for layover in leg.layovers %}
  {{ layover.destination_code }}      // Layover airport code
  {{ layover.destination_city }}      // Layover city name
  {{ layover.waiting_time }}          // Waiting time (e.g., "2h 30m")
{% endfor %}
```

#### Hotel Data
```liquid
{% for hotel in best_hotels %}
  {{ hotel.name }}                    // Hotel name
  {{ hotel.location }}                // Hotel location
  {{ hotel.stars }}                   // Star rating
  {{ hotel.price }}                   // Price per night
  {{ hotel.link }}                    // Booking link
{% endfor %}
```

### Common Patterns

#### Conditional Rendering
```liquid
{% if luggage %}
  <div>Equipaje de bodega incluido</div>
{% else %}
  <div>Carry On incluido</div>
{% endif %}
```

#### Loops
```liquid
{% for flight in selected_flights %}
  <div>{{ flight.airline.name }}</div>
{% endfor %}
```

#### Array Check
```liquid
{% if leg.layovers and leg.layovers.size > 0 %}
  <div>Has layovers</div>
{% endif %}
```

#### Number Normalization
```liquid
{% assign _ta_str = travel_assistance | default: 0 %}
{% assign _ta_norm = _ta_str | replace: ".", "" | replace: ",", "." | times: 1 %}
```

## 🎨 Customization

### Agency Custom Templates

Agencies can upload custom versions of these templates via Settings → PDF Templates. Custom templates:

- Are stored in PDFMonkey with unique template IDs
- Override default templates when agency_id is present
- Must follow the same data structure
- Can customize HTML/CSS completely
- See [docs/guides/CUSTOM_PDF_TEMPLATES_GUIDE.md](../../../docs/guides/CUSTOM_PDF_TEMPLATES_GUIDE.md)

### Template Types Mapping

| Template Type | File | Custom Field in DB |
|--------------|------|-------------------|
| `flights` | flights-simple.html | `custom_template_ids.flights` |
| `flights2` | flights-multiple.html | `custom_template_ids.flights2` |
| `combined` | combined-flight-hotel.html | `custom_template_ids.combined` |
| `hotels` | combined-flight-hotel.html (with empty flights) | `custom_template_ids.hotels` |

## 🔧 Development

### Testing Templates Locally

1. **Use PDFMonkey Playground**:
   - Go to PDFMonkey dashboard
   - Select template
   - Use "Test" tab with sample JSON

2. **Sample JSON Files**:
   - See [docs/api/examples/](../../../docs/api/examples/) for real API responses
   - Use these to test template rendering

### Updating Templates

1. **Edit locally**: Modify HTML file in this folder
2. **Test in PDFMonkey**: Copy/paste HTML into PDFMonkey template editor
3. **Validate**: Test with real data from examples
4. **Deploy**: Save in PDFMonkey (template ID stays the same)
5. **Commit**: Update local file in git

### Common Issues

**Issue**: Variables not showing in PDF
**Solution**: Check variable names match exactly (case-sensitive)

**Issue**: Loops not working
**Solution**: Verify array exists and has items (`{% if array.size > 0 %}`)

**Issue**: Numbers displaying wrong
**Solution**: Use number normalization pattern (see Liquid Syntax above)

**Issue**: Conditional not working
**Solution**: Use `{% if var %}` not `{% if var == true %}`

## 📂 Related Files

### Code Files
- **[src/services/pdfMonkey.ts](../../services/pdfMonkey.ts)** - Template selection logic
- **[src/services/pdfProcessor.ts](../../services/pdfProcessor.ts)** - Template detection
- **[src/services/pdfMonkeyTemplates.ts](../../services/pdfMonkeyTemplates.ts)** - Custom template management

### Documentation
- **[docs/guides/CUSTOM_PDF_TEMPLATES_GUIDE.md](../../../docs/guides/CUSTOM_PDF_TEMPLATES_GUIDE.md)** - User guide for custom templates
- **[docs/api/examples/](../../../docs/api/examples/)** - Sample API responses for testing

## 🚀 Deployment

These templates are NOT deployed via code. They live in PDFMonkey:

1. Templates are uploaded to PDFMonkey dashboard
2. Each template has a unique ID (hardcoded in `pdfMonkey.ts`)
3. Code references templates by ID, not by file path
4. Local files are for reference/version control only

### Template IDs

```typescript
// From src/services/pdfMonkey.ts
const DEFAULT_FLIGHT_TEMPLATE_ID = '67B7F3A5-7BFE-4F52-BE6B-110371CB9376';  // flights-simple
const DEFAULT_FLIGHTS_TEMPLATE_ID = '30B142BF-1DD9-432D-8261-5287556DC9FC'; // flights-multiple
const DEFAULT_COMBINED_TEMPLATE_ID = '3E8394AC-84D4-4286-A1CD-A12D1AB001D5'; // combined
```

## 📊 Template Usage Statistics

| Template | Use Case | Frequency |
|----------|----------|-----------|
| flights-simple | Simple bookings | ~40% |
| flights-multiple | Complex/multi | ~35% |
| combined | Packages | ~25% |

## 🔮 Future Enhancements

- [ ] Add hotels-only template (currently uses combined)
- [ ] Add multi-language support
- [ ] Add theme customization
- [ ] Add dynamic logo/branding per agency
- [ ] Template preview in UI
- [ ] Template A/B testing

