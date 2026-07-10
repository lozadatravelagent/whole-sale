# Delfos Multi-Provider Search — Implementation Plan

> **For agentic workers:** implement PR-by-PR below. Prefer TDD on mappers/merge. Do **not** implement booking/price. Spec: [`docs/adr/ADR-003-delfos-multi-provider-search.md`](../../adr/ADR-003-delfos-multi-provider-search.md).

**Goal:** Add Delfos as a parallel **search-only** inventory source for flights and hotels alongside Starling and EUROVIPS, behind `DELFOS_SEARCH_ENABLED`, without changing NLP/parser or introducing booking.

**Status (2026-07-10):** Core implementation landed in workspace (adapter + fan-out edge/web/api + tests). Deploy still requires secrets + flag enable. PR5 ops polish optional.

**Architecture:** New edge adapter `delfos-api` (OAuth + ACL mappers) → fan-out `Promise.allSettled` in the three search executors → merge/dedupe → existing UI/API envelopes.

**Tech stack:** Supabase Edge (Deno), Fastify API (Node 20), React chat handlers, Vitest (and Deno tests where the project already uses them for edge).

**Out of scope:** flight price/book, hotel book, per-agency `integrations` credentials, Hotelbeds fan-out, packages/services via Delfos, LLM provider preference.

---

## PR DAG

```
PR1  Types + feature flag contract
 │
 ▼
PR2  Edge adapter delfos-api (OAuth, searchFlights, searchHotels, mappers)
 │
 ├──────────────┐
 ▼              ▼
PR3a Edge       PR3b Web
searchExecutor  searchHandlers
fan-out+merge   fan-out+merge
 │              │
 └──────┬───────┘
        ▼
PR4  Fastify api/searchExecutor parity (+ optional meta polish)
 │
 ▼
PR5  Ops: secrets checklist, Cloudflare path, light UI provider badge (optional)
```

**Merge order:** PR1 → PR2 → (PR3a ∥ PR3b) → PR4 → PR5.  
**Emilia API** works after PR3a. **Emilia Web** after PR3b. **`/v1/search`** after PR4.

---

## PR1 — Types + flag contract

**Branch:** `feat/delfos-search-types`  
**Risk:** low  
**Depends on:** —

### Files

| Action | Path |
|---|---|
| Edit | `src/types/index.ts` — extend `HotelData.provider`, add `providerOfferId` / `providerMeta` on flight & hotel shapes used by chat |
| Edit | `src/types/external/index.ts` — same provider union |
| Edit | `src/features/chat/types/chat.ts` (if `FlightData` local duplicate exists) |
| Create | `supabase/functions/_shared/providers/types.ts` — Deno-side `SearchProviderId`, `ProviderSearchMeta`, canonical item stubs if needed |
| Create | `supabase/functions/_shared/providers/flags.ts` — `isDelfosSearchEnabled()` reading `DELFOS_SEARCH_ENABLED` |
| Edit | `docs/adr/ADR-003-...` status note if anything drifts (optional) |

### Steps

- [ ] **1.1** Extend provider unions:

```ts
export type TravelSearchProvider = 'STARLING' | 'EUROVIPS' | 'DELFOS' | 'HOTELBEDS';

// On HotelData:
provider?: TravelSearchProvider;
providerOfferId?: string;
providerMeta?: {
  priceableUntil?: string;
  expiresAt?: string;
  sourceProvider?: string;
};
```

Apply the same optional fields to the flight item shape used by edge (`searchExecutor` mapped objects) — document in `providers/types.ts` even if FlightData UI type lags slightly.

- [ ] **1.2** Flag helper:

```ts
// flags.ts
export function isDelfosSearchEnabled(): boolean {
  const raw = Deno.env.get('DELFOS_SEARCH_ENABLED') ?? 'false';
  return raw === '1' || raw.toLowerCase() === 'true';
}
```

Mirror for Node in `api/src/services/providers/flags.ts` (or inline `process.env`) in PR4 — for PR1 only edge is enough if Web reads via edge response only; Web needs no env for Delfos if it always *invokes* edge and edge no-ops when disabled... **Decision:** Web will invoke `delfos-api` only when `import.meta.env.VITE_DELFOS_SEARCH_ENABLED === 'true'` **or** always invoke and let edge return `{ skipped: true }` when disabled. Prefer **edge owns the flag** so Web can always call and get empty+skipped without a second flag.  
**Final:** Edge checks flag. Web/API always attempt invoke only through executor methods that check flag **before** invoke (Web needs a way to know — use `VITE_DELFOS_SEARCH_ENABLED` for client to avoid useless invokes, default false). Document both env vars must match in deploy.

- [ ] **1.3** Unit test: flag parsing truthy/falsey.
- [ ] **1.4** `npm run build` (types compile).

### DoD PR1

- Types compile; no runtime behavior change.

---

## PR2 — Edge Function `delfos-api`

**Branch:** `feat/delfos-api-edge`  
**Risk:** medium  
**Depends on:** PR1

### Files

| Action | Path |
|---|---|
| Create | `supabase/functions/delfos-api/index.ts` |
| Create | `supabase/functions/delfos-api/oauth.ts` |
| Create | `supabase/functions/delfos-api/mapFlights.ts` |
| Create | `supabase/functions/delfos-api/mapHotels.ts` |
| Create | `supabase/functions/delfos-api/__tests__/mapFlights.test.ts` (or colocated under `_shared` if vitest setup prefers) |
| Create | `supabase/functions/delfos-api/__tests__/mapHotels.test.ts` |
| Create | `supabase/functions/delfos-api/__fixtures__/flight-offers.json` (sanitized) |
| Create | `supabase/functions/delfos-api/__fixtures__/hotel-offers.json` |
| Edit | reuse `../_shared/cors.ts`, `../_shared/rateLimit.ts` |

### Actions supported

```ts
type Action = 'searchFlights' | 'searchHotels' | 'health';
// body: { action, data, request_id? }
```

### Env secrets

```
DELFOS_BASE_URL
DELFOS_CLIENT_ID
DELFOS_CLIENT_SECRET
DELFOS_SEARCH_ENABLED   # optional here; executor also checks
```

### Steps

- [ ] **2.1** OAuth client with in-memory token cache + single-flight refresh; on 401 retry once after refresh.
- [ ] **2.2** `searchFlights`: map Wholesale-ish `data` (`origin/destination/dates/adults/children/infants` **or** already-built `journeys`+`ages`) → Delfos body; call `POST /v1/flights/search`; map offers → canonical array; return:

```json
{
  "success": true,
  "action": "searchFlights",
  "provider": "DELFOS",
  "results": [ /* canonical flight items */ ],
  "meta": { "count": 0, "source_provider": "lleego" }
}
```

- [ ] **2.3** `searchHotels`: map check_in/out + rooms; omit `hotel_codes` in MVP; map to `HotelData`-like results.
- [ ] **2.4** Error mapping: 401 after retry → 502 `DELFOS_AUTH`; 503/504 pass code; empty offers → 200 success empty.
- [ ] **2.5** TDD mappers with fixtures (amount string `"123.45"` → `123.45`; legs/segments mapping; meal_plan codes join).
- [ ] **2.6** Validation: reject multi-city >2 journeys with `success: false, code: 'UNSUPPORTED_ITINERARY'` (caller treats as skip, not hard fail of whole search).
- [ ] **2.7** Deploy notes in PR description: `supabase functions deploy delfos-api --no-verify-jwt` (same pattern as starling if gateway/service role invokes).

### DoD PR2

- Mapper tests green.
- Manual curl against staging Delfos (if credentials available) or nock/fixture-only CI.
- No calls to price/book paths.

---

## PR3a — Edge `searchExecutor` fan-out (Emilia API)

**Branch:** `feat/delfos-edge-fanout`  
**Risk:** medium–high  
**Depends on:** PR2

### Files

| Action | Path |
|---|---|
| Edit | `supabase/functions/_shared/searchExecutor.ts` |
| Create | `supabase/functions/_shared/providers/mergeFlights.ts` |
| Create | `supabase/functions/_shared/providers/mergeHotels.ts` |
| Create | `supabase/functions/_shared/providers/__tests__/mergeFlights.test.ts` |
| Create | `supabase/functions/_shared/providers/__tests__/mergeHotels.test.ts` |
| Edit | `supabase/functions/emilia-turn/index.ts` — only if metadata needs surfacing (prefer executor metadata only) |

### Steps

- [ ] **3a.1** Implement pure `mergeFlights(a, b)` / `mergeHotels(a, b)` per ADR-003 D6; unit tests for dedupe, sort, cap.
- [ ] **3a.2** `executeFlightSearch`:

```ts
const tasks = [() => searchStarling(...)];
if (isDelfosSearchEnabled()) tasks.push(() => invokeDelfosFlights(...));
const settled = await Promise.allSettled(tasks.map(t => t()));
// collect items + provider_errors
// merge + existing layover/baggage filters + selectDistinctPriceFlights if used
// metadata.providers_searched / succeeded / provider_counts
```

- [ ] **3a.3** Same for `executeHotelSearch` (Delfos in parallel with EUROVIPS chain logic — careful: EUROVIPS multi-chain fan-out stays internal; Delfos is one additional sibling call).
- [ ] **3a.4** Combined search unchanged structurally (already parallel flight+hotel); inherits multi-provider via 3a.2/3a.3.
- [ ] **3a.5** If Delfos returns `UNSUPPORTED_ITINERARY`, treat as skipped (not error).
- [ ] **3a.6** Regression: with flag off, behavior identical (mock: zero invoke delfos-api).

### DoD PR3a

- Unit tests merge + flag-off path.
- Manual: `emilia-turn` or local invoke `executeSearch` with flag on/off.

---

## PR3b — Web `searchHandlers` fan-out (Emilia Web)

**Branch:** `feat/delfos-web-fanout`  
**Risk:** medium  
**Depends on:** PR2 (can parallel PR3a)

### Files

| Action | Path |
|---|---|
| Edit | `src/features/chat/services/searchHandlers.ts` |
| Create | `src/features/chat/services/providers/mergeFlights.ts` (or import shared if build allows — else **copy** pure functions from edge with a comment “keep in sync with _shared/providers/merge*” + shared test vectors in `src/.../__tests__/mergeFixtures.ts`) |
| Create | `src/features/chat/services/providers/mergeHotels.ts` |
| Edit | `src/features/chat/services/flightTransformer.ts` — only if needed to accept already-canonical Delfos items (prefer not double-transform) |
| Create | tests under `src/features/chat/services/__tests__/` |

### Env

```
VITE_DELFOS_SEARCH_ENABLED=true|false
```

### Steps

- [ ] **3b.1** Flight path: after or parallel to `starling-flights` invoke, optionally `delfos-api` `searchFlights`; merge; keep existing filter cascade / zero-result hard gates **on merged set**.
- [ ] **3b.2** Hotel path: parallel `eurovips-soap` + `delfos-api`; merge; chain post-filter on merged.
- [ ] **3b.3** Combined path: already parallel flight/hotel handlers — inherits; ensure `providerErrors` includes Delfos.
- [ ] **3b.4** Attach `provider` on all Starling/EUROVIPS items if missing today (`STARLING`/`EUROVIPS`) so UI can badge consistently.
- [ ] **3b.5** Vitest: merge + mock `supabase.functions.invoke` multi-provider.

### DoD PR3b

- Chat search with flag off unchanged.
- With mocks, combined results show both providers.

---

## PR4 — Fastify `/v1/search` parity

**Branch:** `feat/delfos-api-gateway-fanout`  
**Risk:** medium  
**Depends on:** PR3a (share mental model; can re-copy merge helpers to `api/src/services/providers/`)

### Files

| Action | Path |
|---|---|
| Edit | `api/src/services/searchExecutor.ts` |
| Create | `api/src/services/providers/mergeFlights.ts` |
| Create | `api/src/services/providers/mergeHotels.ts` |
| Create | `api/src/services/providers/flags.ts` |
| Edit | `api/README.md` (if documents providers) |

### Steps

- [ ] **4.1** Mirror edge fan-out (invoke `delfos-api` via `supabase.functions.invoke`).
- [ ] **4.2** Env `DELFOS_SEARCH_ENABLED` on Railway API service (must match edge intent).
- [ ] **4.3** Ensure response metadata includes `providers_*` for integrators.
- [ ] **4.4** Smoke: `POST /v1/search` with test API key.

### DoD PR4

- `/v1/search` and `/v1/emilia/turn` same provider set when flags aligned.

---

## PR5 — Ops + light product polish

**Branch:** `feat/delfos-search-ops`  
**Risk:** low  
**Depends on:** PR3a + PR3b

### Files / actions

| Action | Detail |
|---|---|
| Secrets | Document in PR: `supabase secrets set DELFOS_*` |
| Cloudflare | Add `/functions/v1/delfos-api` to same rate-limit rule as starling/eurovips ([`docs/architecture/CLOUDFLARE_RATE_LIMITING_SETUP.md`](../../architecture/CLOUDFLARE_RATE_LIMITING_SETUP.md)) |
| Optional UI | Small provider badge on flight/hotel cards if `item.provider` present — **no** filter chips “solo Delfos” unless product asks |
| Optional | Surface `providers_succeeded` in assistant `meta` already returned by API |
| ADR | Mark ADR-003 **Aceptado** when PR3a+PR3b merged to main |

### Steps

- [ ] **5.1** Update Cloudflare doc snippet.
- [ ] **5.2** Deploy checklist in PR body.
- [ ] **5.3** Optional badge component (skip if timeboxed).

### DoD PR5

- Staging: flag on, real Delfos credentials, one flight + one hotel smoke from Web and from `/v1/emilia/turn`.
- Flag off rollback verified.

---

## Mapper test vectors (shared mental model)

### Flight fixture minimal

```json
{
  "offer_id": "off_01J00000000000000000000000",
  "provider": "lleego",
  "route_type": "ROUND_TRIP",
  "is_two_one_ways": false,
  "price": { "total": { "amount": "899.50", "currency": "USD" }, "breakdown": [] },
  "is_private_fare": false,
  "time_limits": { "last_ticket_date": null, "requires_immediate_ticketing": false },
  "priceable_until": "2026-07-11T12:00:00Z",
  "journeys": [
    {
      "origin": "EZE",
      "destination": "MAD",
      "departure_at": "2026-08-15T22:00:00",
      "arrival_at": "2026-08-16T14:00:00",
      "layovers": 0,
      "duration_minutes": 720,
      "segments": [
        {
          "marketing_carrier": "IB",
          "operating_carrier": "IB",
          "flight_number": "6846",
          "origin": "EZE",
          "destination": "MAD",
          "departure_at": "2026-08-15T22:00:00",
          "arrival_at": "2026-08-16T14:00:00",
          "technical_stops": [],
          "fare_type": "PUBLIC"
        }
      ]
    }
  ]
}
```

Expect: `provider === 'DELFOS'`, `price.amount === 899.5`, `providerOfferId === offer_id`.

### Hotel fixture minimal

```json
{
  "offer_id": "hof_01J00000000000000000000000",
  "hotel": { "code": "H123", "name": "Hotel Ejemplo Cancun" },
  "room_type": { "code": "DBL", "name": "Doble" },
  "rate_plan": { "code": "GENERAL" },
  "meal_plan": { "codes": ["AI"] },
  "price": { "amount": "450.00", "currency": "USD" },
  "cancel_policies": [],
  "refundable": false,
  "expires_at": "2026-07-10T18:00:00Z"
}
```

Expect: `provider === 'DELFOS'`, one room with `total_price === 450`.

---

## Explicit non-goals (guardrail for implementers)

```
❌ supabase.functions or fetch to /v1/flights/price
❌ /v1/flights/bookings or hotel booking endpoints
❌ Changing ai-message-parser prompt or tools for provider selection
❌ Hardcoding Delfos as sole provider
❌ Removing Starling or EUROVIPS
```

---

## Rollout

1. Deploy PR1–PR2 with flag **false** everywhere.
2. Enable flag on **staging** edge + web + API; smoke.
3. Enable flag on **prod** edge first (Emilia API + Web invoke same edge); monitor latency and error rates.
4. Enable Web `VITE_*` only if client-side gate used.
5. Rollback = set flags false (no code revert required).

---

## Estimation (order of magnitude)

| PR | Effort |
|---|---|
| PR1 | 0.5 d |
| PR2 | 2–3 d |
| PR3a | 1.5–2 d |
| PR3b | 1.5–2 d |
| PR4 | 1 d |
| PR5 | 0.5–1 d |
| **Total** | **~7–10 d** |

---

## Open questions (resolve during PR2 probe)

1. Staging base URL and credential delivery for Vibook agency on Delfos.
2. Hotel catalog of that credential: is full-catalog search without `hotel_codes` performant enough, or do we need city→codes cache later?
3. Currency normalization: force USD display like EUROVIPS path or pass-through Delfos currency?
4. Should `selectDistinctPriceFlights` run before or after merge? (**Propose:** after merge on combined list.)

Default if unanswered: (2) full catalog MVP, (3) pass-through with existing UI currency, (4) after merge.
