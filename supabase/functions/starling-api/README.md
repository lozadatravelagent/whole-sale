# Starling TVC API - Supabase Edge Function

Complete TVC API integration deployed as a Supabase Edge Function.

## 🔧 Setup Instructions

### 1. Install Supabase CLI

**Windows (PowerShell):**
```powershell
# Using Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or using npm
npm install -g supabase
```

**Alternative (Direct Download):**
- Download from: https://github.com/supabase/cli/releases
- Add to PATH

### 2. Login to Supabase

```bash
supabase login
```

### 3. Initialize Supabase (if not already done)

```bash
cd wholesale-connect-ai
supabase init
supabase link --project-ref YOUR_PROJECT_REF
```

### 4. Configure TVC Credentials as Secrets

```bash
# Set TVC API credentials (replace with actual values)
supabase secrets set TVC_USERNAME=your_tvc_username
supabase secrets set TVC_PASSWORD=your_tvc_password

# Set API environment (test or production)
supabase secrets set TVC_BASE_URL=https://testapi.webtravelcaster.com

# Optional: Set custom timeout
supabase secrets set TVC_TIMEOUT=30000
```

### 5. Deploy the Edge Function

```bash
supabase functions deploy starling-api
```

### 6. Test the Deployment

```bash
# Test connection
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/starling-api' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "testConnection",
    "data": {}
  }'
```

## 📋 API Endpoints

### Base URL
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/starling-api
```

### Authentication
```javascript
headers: {
  'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
  'Content-Type': 'application/json'
}
```

### Available Actions

#### 1. Test Connection
```json
{
  "action": "testConnection",
  "data": {}
}
```

#### 2. Search Flights
```json
{
  "action": "searchFlights",
  "data": {
    "Passengers": [
      { "Count": 2, "Type": "ADT" }
    ],
    "Legs": [
      {
        "DepartureAirportCity": "LON",
        "ArrivalAirportCity": "BOS",
        "FlightDate": "2025-04-16"
      }
    ],
    "Airlines": null
  }
}
```

#### 3. Confirm Availability
```json
{
  "action": "confirmAvailability",
  "data": {
    "RecommendationID": "rec_123",
    "FareID": "fare_456",
    "OptionID": ["opt_789"]
  }
}
```

#### 4. Book Flight
```json
{
  "action": "bookFlight",
  "data": {
    "RecommendationID": "rec_123",
    "TransactionID": "trans_456",
    "Passengers": [{
      "Count": 0,
      "DateOfBirth": "1990-01-01",
      "FirstName": "JOHN",
      "LastName": "DOE",
      "Gender": "MR",
      "Type": "ADT",
      "Number": 1
    }],
    "BookingFare": { /* fare data from confirmation */ },
    "CreditCardInfo": {
      "CardType": "VI",
      "CardNumber": "4242424242424242",
      "SecurityCode": "123",
      "NameOnCard": "JOHN DOE",
      "ExpirationDate": "2026-12"
    },
    "Buyer": {
      "City": "London",
      "Country": "GB",
      "FirstName": "JOHN",
      "LastName": "DOE",
      "TelephoneCountry": "44",
      "Telephone": "1234567890",
      "Email": "john.doe@example.com"
    }
  }
}
```

#### 5. Issue Booking
```json
{
  "action": "issueBooking",
  "data": {
    "BookingNumber": "ABC123"
  }
}
```

#### 6. Retrieve Booking
```json
{
  "action": "retrieveBooking",
  "data": {
    "BookingNumber": "ABC123"
  }
}
```

#### 7. Get Fare Options
```json
{
  "action": "getFareOptions",
  "data": {
    "RecommendationID": "rec_123",
    "FareID": "fare_456",
    "OptionID": ["opt_789"]
  }
}
```

#### 8. List Bookings
```json
{
  "action": "listBookings",
  "data": {
    "FromDate": "2025-01-01",
    "ToDate": "2025-01-31"
  }
}
```

#### 9. Create Search Request (Utility)
```json
{
  "action": "createSearchRequest",
  "data": {
    "from": "LON",
    "to": "BOS",
    "date": "2025-04-16",
    "adults": 2,
    "children": 1,
    "infants": 0
  }
}
```

## 🔨 Usage from Frontend

### JavaScript/TypeScript
```javascript
const response = await fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/starling-api', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'searchFlights',
    data: {
      Passengers: [{ Count: 2, Type: 'ADT' }],
      Legs: [{
        DepartureAirportCity: 'LON',
        ArrivalAirportCity: 'BOS',
        FlightDate: '2025-04-16'
      }],
      Airlines: null
    }
  })
});

const result = await response.json();
console.log(result);
```

### Response Format
```json
{
  "success": true,
  "data": { /* TVC API response */ },
  "provider": "TVC",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "provider": "TVC",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## 🛠️ Development & Debugging

### View Logs
```bash
supabase functions logs starling-api
```

### Local Testing
```bash
# Serve functions locally
supabase start
supabase functions serve

# Test locally
curl -X POST 'http://localhost:54321/functions/v1/starling-api' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{"action": "testConnection", "data": {}}'
```

### Update Secrets
```bash
# Update credentials
supabase secrets set TVC_USERNAME=new_username
supabase secrets set TVC_PASSWORD=new_password

# Redeploy after secret changes
supabase functions deploy starling-api
```

## 🔒 Security Considerations

1. **Never expose TVC credentials** in client-side code
2. **Use Supabase RLS** to restrict access to the Edge Function
3. **Implement rate limiting** if needed
4. **Use HTTPS only** for all API calls
5. **Validate all inputs** before sending to TVC API

## 📊 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TVC_USERNAME` | TVC API username | `your_username` |
| `TVC_PASSWORD` | TVC API password | `your_password` |
| `TVC_BASE_URL` | TVC API base URL | `https://testapi.webtravelcaster.com` |
| `TVC_TIMEOUT` | Request timeout (ms) | `30000` |

## 🚀 Production Deployment

### 1. Update to Production Environment
```bash
supabase secrets set TVC_BASE_URL=https://api.webtravelcaster.com
supabase secrets set TVC_USERNAME=production_username
supabase secrets set TVC_PASSWORD=production_password
```

### 2. Deploy Production Function
```bash
supabase functions deploy starling-api --project-ref PRODUCTION_PROJECT_REF
```

### 3. Test Production Deployment
```bash
curl -X POST 'https://PRODUCTION_PROJECT_REF.supabase.co/functions/v1/starling-api' \
  -H 'Authorization: Bearer PRODUCTION_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"action": "testConnection", "data": {}}'
```

## 📈 Monitoring

- **Function Logs**: Monitor in Supabase Dashboard
- **Error Tracking**: All errors are logged with timestamps
- **Performance**: Track response times in logs
- **Usage**: Monitor API calls in Supabase metrics

## 🔄 Integration with Existing App

### Add to existing service
```typescript
// Add to your existing service files
const tvcApiCall = async (action: string, data: any) => {
  const response = await supabase.functions.invoke('starling-api', {
    body: { action, data }
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data;
};

// Example usage
const searchFlights = async (searchParams) => {
  return await tvcApiCall('searchFlights', searchParams);
};
```

---

**Ready to integrate TVC API into your WholeSale Connect AI application!** 🎉