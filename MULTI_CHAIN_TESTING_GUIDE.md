# Multi-Chain Hotel Filtering - Testing Guide & Acceptance Criteria

## Overview

This document describes the comprehensive testing strategy for the multi-chain hotel filtering feature implemented across the application.

## Implementation Summary

### Files Modified

1. **AI Message Parser** (`supabase/functions/ai-message-parser/index.ts`)
   - Updated prompt to detect multiple chains with separators
   - Changed `hotelChain?: string` to `hotelChains?: string[]`
   - Added examples for multi-chain detection

2. **Context State Types** (`src/features/chat/types/contextState.ts`)
   - Updated `HotelContextParams.hotelChain` → `hotelChains: string[]`

3. **Hotel Chain Aliases** (`src/features/chat/data/hotelChainAliases.ts`)
   - Added `detectMultipleHotelChains(text): string[]` function
   - Added `hotelBelongsToAnyChain(hotelName, chains): boolean` function

4. **Search Handlers** (`src/features/chat/services/searchHandlers.ts`)
   - Implemented N-request strategy (1 per chain) with deduplication
   - Updated client-side filtering to use `hotelBelongsToAnyChain()`
   - Updated Punta Cana whitelist to support multiple chains

5. **Iteration Detection** (`src/features/chat/utils/iterationDetection.ts`)
   - Updated field tracking: `hotels.hotelChains`
   - Updated merge logic to preserve and replace `hotelChains` array
   - Updated flight modification to preserve hotel chains in combined searches

---

## Test Scenarios

### 1. Single Chain (Backward Compatibility)

**Input:**
```
"quiero un hotel de la cadena RIU en Punta Cana del 15 al 22 de enero all inclusive habitación doble"
```

**Expected Behavior:**
- ✅ AI Parser extracts: `hotelChains: ["RIU"]`
- ✅ Search handler makes 1 API request with `hotelName: "RIU"`
- ✅ Client-side filter uses `hotelBelongsToAnyChain()` with `["RIU"]`
- ✅ Only RIU hotels returned
- ✅ Console logs show: `[MULTI-CHAIN] Making 1 API requests (1 per chain): ["RIU"]`

**Verification:**
```javascript
// Check console logs for:
🏨 [MULTI-CHAIN] Making 1 API requests (1 per chain): ["RIU"]
📤 [MULTI-CHAIN] Request 1/1: Searching hotels for chain "RIU"
✅ [MULTI-CHAIN] Chain "RIU": Received X hotels
🔗 [MULTI-CHAIN] Total hotels before deduplication: X
✅ [MULTI-CHAIN] Total hotels after deduplication: X
```

---

### 2. Two Chains with "Y" Separator

**Input:**
```
"quiero cadena riu y iberostar all inclusive habitacion doble"
```

**Expected Behavior:**
- ✅ AI Parser extracts: `hotelChains: ["Riu", "Iberostar"]`
- ✅ Search handler makes 2 API requests:
  - Request 1: `hotelName: "Riu"`
  - Request 2: `hotelName: "Iberostar"`
- ✅ Results merged and deduplicated
- ✅ Client-side filter matches ANY chain in array
- ✅ Both RIU and Iberostar hotels returned

**Verification:**
```javascript
// Check console logs for:
🏨 [MULTI-CHAIN] Making 2 API requests (1 per chain): ["Riu", "Iberostar"]
📤 [MULTI-CHAIN] Request 1/2: Searching hotels for chain "Riu"
✅ [MULTI-CHAIN] Chain "Riu": Received X hotels
📤 [MULTI-CHAIN] Request 2/2: Searching hotels for chain "Iberostar"
✅ [MULTI-CHAIN] Chain "Iberostar": Received Y hotels
🔗 [MULTI-CHAIN] Total hotels before deduplication: X+Y
✅ [MULTI-CHAIN] Total hotels after deduplication: N (where N <= X+Y)
```

---

### 3. Multiple Chains with Comma Separator

**Input:**
```
"hoteles de la cadena Riu, Iberostar, Melia en Cancún"
```

**Expected Behavior:**
- ✅ AI Parser extracts: `hotelChains: ["Riu", "Iberostar", "Melia"]`
- ✅ Search handler makes 3 API requests
- ✅ Deduplication removes duplicates by `hotel_id` or `name`
- ✅ All three chains' hotels returned

**Verification:**
```javascript
🏨 [MULTI-CHAIN] Making 3 API requests (1 per chain): ["Riu", "Iberostar", "Melia"]
// ... 3 separate requests logged
✅ [MULTI-CHAIN] Total hotels after deduplication: N
```

---

### 4. Multiple Chains with Slash Separator

**Input:**
```
"cadena Barcelo/NH en Madrid"
```

**Expected Behavior:**
- ✅ AI Parser extracts: `hotelChains: ["Barcelo", "NH"]`
- ✅ Both chains searched
- ✅ Barceló and NH hotels returned

---

### 5. No Chains Specified (Baseline)

**Input:**
```
"hotel en Cancún todo incluido habitación doble"
```

**Expected Behavior:**
- ✅ AI Parser extracts: NO `hotelChains` field (undefined or empty array)
- ✅ Search handler makes 1 API request with NO name filter
- ✅ All available hotels returned (subject to other filters)
- ✅ Console logs show: `[HOTEL SEARCH] No chain or name filter - searching all hotels`

---

### 6. Combined Flight + Hotel with Multiple Chains

**Input:**
```
"quiero un vuelo de buenos aires a cancun saliendo la ultima semana de abril durante 8 noches para 2 adultos con una escala de menos de 4 horas. tambien quiero un hotel para las mismas fechas all inclusive habitacion doble con la cadena riu y iberostar"
```

**Expected Behavior:**
- ✅ AI Parser extracts:
  - `requestType: "combined"`
  - `flights: { ... }`
  - `hotels: { ..., hotelChains: ["Riu", "Iberostar"] }`
- ✅ Flight search executes normally
- ✅ Hotel search makes 2 API requests (1 per chain)
- ✅ Combined response shows flights + hotels from both chains
- ✅ Deduplication works across chains

**Verification:**
```javascript
// Check response format includes both:
✈️ VUELOS ENCONTRADOS: X opciones
🏨 HOTELES ENCONTRADOS: Y opciones (RIU + Iberostar)
```

---

### 7. Iteration: Adding Chains to Previous Search

**Input:**
```
Turn 1: "hotel en punta cana del 15 al 22 de enero todo incluido habitacion doble"
Turn 2: "lo mismo pero con cadena riu y iberostar"
```

**Expected Behavior:**
- ✅ Turn 1: Hotels searched without chain filter
- ✅ Turn 2: Iteration detected as `hotel_modification`
- ✅ Context merged:
  - Preserves: city, dates, adults, children, roomType, mealPlan
  - Replaces: `hotelChains: ["Riu", "Iberostar"]`
- ✅ New search executes with 2 chains
- ✅ Console logs show: `[MERGE] Hotel modification merge complete`

**Verification:**
```javascript
// Check iteration detection logs:
🔄 [ITERATION] Detected iteration type: hotel_modification
✅ [MERGE] Hotel modification merge complete: {
  requestType: 'combined' or 'hotels',
  hotelsCity: 'Punta Cana',
  hotelChains: ['Riu', 'Iberostar']
}
```

---

### 8. Iteration: Changing Chains in Combined Search

**Input:**
```
Turn 1: "vuelo + hotel a cancun, cadena riu"
Turn 2: "el mismo pero con cadena iberostar y melia"
```

**Expected Behavior:**
- ✅ Turn 1: Search with `hotelChains: ["Riu"]`
- ✅ Turn 2: Iteration detected
- ✅ Context merged:
  - Preserves: flights params
  - Replaces: `hotelChains: ["Iberostar", "Melia"]` (NOT accumulates)
- ✅ New hotel search with Iberostar + Melia

---

### 9. Punta Cana Whitelist with Multiple Chains

**Input:**
```
"hotel en punta cana cadena riu y iberostar"
```

**Expected Behavior:**
- ✅ Punta Cana filter detects requested chains
- ✅ ALL hotels from RIU and Iberostar allowed (bypasses whitelist)
- ✅ Console logs show:
  ```javascript
  🌴 [PUNTA CANA FILTER] Applying special hotel whitelist filter
  🏨 [PUNTA CANA FILTER] User requested chains: Riu, Iberostar - will allow all hotels from these chains
  ✅ [PUNTA CANA FILTER] Allowed (matches requested chain "Riu"): "RIU BAMBU"
  ✅ [PUNTA CANA FILTER] Allowed (matches requested chain "Iberostar"): "IBEROSTAR DOMINICANA"
  ```

---

### 10. Deduplication Test

**Input:**
```
"cadena hilton y hilton en nueva york"
```

**Expected Behavior:**
- ✅ AI Parser extracts: `hotelChains: ["Hilton"]` (deduped by AI or deterministic parser)
- ✅ Search handler makes 1 request (no duplicate requests)
- ✅ If same hotel appears in multiple chains, dedup by `hotel_id` or `name`

**Verification:**
```javascript
// Check deduplication logs:
🗑️ [DEDUP] Removed duplicate: "Hilton Garden Inn" (key: id:12345)
```

---

## Acceptance Criteria

### ✅ Functional Requirements

1. **Parser Detection**
   - [ ] Detects 1 chain: `["RIU"]`
   - [ ] Detects 2+ chains with "y": `["RIU", "Iberostar"]`
   - [ ] Detects 2+ chains with ",": `["RIU", "Iberostar", "Melia"]`
   - [ ] Detects 2+ chains with "/": `["Barcelo", "NH"]`
   - [ ] Detects 2+ chains with "o": `["RIU", "Iberostar"]`
   - [ ] Detects 2+ chains with "&": `["Hilton", "Marriott"]`
   - [ ] No chains detected returns empty array or undefined

2. **API Request Strategy**
   - [ ] 1 chain → 1 API request
   - [ ] N chains → N API requests (sequential or parallel)
   - [ ] Each request uses correct `hotelName` parameter
   - [ ] No chains → 1 API request with empty `hotelName`

3. **Deduplication**
   - [ ] Deduplicates by `hotel_id` if available
   - [ ] Falls back to `name` if no `hotel_id`
   - [ ] Logs duplicate removals to console
   - [ ] Preserves first occurrence of each unique hotel

4. **Client-Side Filtering**
   - [ ] `hotelBelongsToAnyChain()` matches ANY chain in array
   - [ ] Returns true if hotel matches at least one chain
   - [ ] Returns true if chains array is empty (no filter)
   - [ ] Case-insensitive matching

5. **Combined Search**
   - [ ] Flight + Hotel works with multiple chains
   - [ ] Flights execute normally
   - [ ] Hotels filtered by all specified chains
   - [ ] Response format includes both components

6. **Iteration Support**
   - [ ] Context preserves `hotelChains` array
   - [ ] Iteration replaces chains (doesn't accumulate)
   - [ ] Works with `hotel_modification` intent
   - [ ] Works with `combined` → `combined` iteration
   - [ ] Flight modifications preserve hotel chains

7. **Punta Cana Whitelist**
   - [ ] Multiple chains bypass whitelist correctly
   - [ ] ALL hotels from requested chains allowed
   - [ ] Whitelist still applies when NO chains specified

8. **Backward Compatibility**
   - [ ] Single chain works exactly as before
   - [ ] No chains works exactly as before
   - [ ] Existing searches not affected

---

## Performance Considerations

### API Request Impact

**Scenario:** User requests 3 chains (RIU, Iberostar, Melia)

**Impact:**
- **Requests:** 3 API calls to EUROVIPS (instead of 1)
- **Latency:** ~3x single-chain search (sequential requests)
- **Deduplication:** O(N) where N = total hotels across all chains

**Optimization Opportunities:**
1. **Parallel Requests:** Execute all N requests concurrently (requires async refactor)
2. **Caching:** Cache results per chain per city (15-minute TTL)
3. **Smart Limits:** Cap at 50-75 hotels POST-merge to avoid overwhelming UI

**Current Implementation:**
- Sequential requests (one after another)
- Deduplication using Set (efficient)
- No caching (future enhancement)

---

## Console Log Verification Checklist

When testing, verify these console logs appear:

### Parser Logs
```javascript
🏨 [MULTI-CHAIN] Detecting chains in: "..."
🔍 [MULTI-CHAIN] Pattern matched: "..."
📋 [MULTI-CHAIN] Split into parts: [...]
✅ [MULTI-CHAIN] Matched known chain: "..." → X
🏁 [MULTI-CHAIN] Final result: [...]
```

### Search Handler Logs
```javascript
🏨 [MULTI-CHAIN] Making X API requests (1 per chain): [...]
📤 [MULTI-CHAIN] Request 1/X: Searching hotels for chain "..."
✅ [MULTI-CHAIN] Chain "...": Received Y hotels
🔗 [MULTI-CHAIN] Total hotels before deduplication: N
✅ [MULTI-CHAIN] Total hotels after deduplication: M
```

### Deduplication Logs
```javascript
🗑️ [DEDUP] Removed duplicate: "Hotel Name" (key: id:12345)
```

### Chain Filter Logs
```javascript
🏨 [CHAIN FILTER] Filtering hotels by chains: X, Y, Z
✅ [CHAIN FILTER] Included: "Hotel Name" (matches one of: X, Y, Z)
🚫 [CHAIN FILTER] Excluded: "Hotel Name" (does not match any of: X, Y, Z)
```

---

## Edge Cases

### 1. Unknown Chain Name
**Input:** `"cadena unknown_chain"`
**Expected:** AI parser includes it as-is, API returns 0 results

### 2. Mixed Known/Unknown Chains
**Input:** `"cadena riu y fake_chain"`
**Expected:** RIU hotels returned, fake_chain returns 0 results

### 3. Duplicate Chains in Input
**Input:** `"cadena riu y riu y iberostar"`
**Expected:** Parser deduplicates to `["Riu", "Iberostar"]`, 2 requests made

### 4. Empty Chain After Parsing
**Input:** `"cadena  "`
**Expected:** Parser returns empty array, no chain filter applied

### 5. Chain + Specific Hotel Name
**Input:** `"cadena riu, hotel riu bambu"`
**Expected:** `hotelChains: ["Riu"], hotelName: "Riu Bambu"` - Both filters applied

---

## Rollback Plan

If issues arise, the multi-chain feature can be disabled by:

1. **AI Parser:** Revert prompt to detect only first chain
2. **Context Types:** Change `hotelChains?: string[]` back to `hotelChain?: string`
3. **Search Handlers:** Remove N-request logic, use single request
4. **Iteration Detection:** Revert field tracking to `hotels.hotelChain`

All changes are backward compatible - single-chain searches work identically.

---

## Success Metrics

- ✅ All 10 test scenarios pass
- ✅ Console logs show correct multi-chain flow
- ✅ Deduplication removes duplicates
- ✅ Performance impact acceptable (< 5s for 3 chains)
- ✅ No regressions in single-chain searches
- ✅ Iteration system preserves multi-chain context
- ✅ Punta Cana whitelist respects multi-chain requests

---

## Next Steps (Future Enhancements)

1. **Parallel API Requests:** Use `Promise.all()` to execute N requests concurrently
2. **Result Caching:** Cache chain search results per city (15-min TTL)
3. **Smart Pagination:** Implement "Load More" for large result sets
4. **Chain Popularity Sorting:** Sort results by chain popularity/user preference
5. **Analytics:** Track multi-chain search usage and performance metrics
