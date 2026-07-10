# ADR-003 — Multi-provider search: integrar Delfos (solo búsquedas)

**Fecha:** 2026-07-10  
**Estado:** Aceptado (implementación en curso — search only)  
**Alcance:** search only (flights + hotels). **Booking / pricing / reservas = fuera de scope** (ADR futuro).  
**Proveedor externo:** [Delfos API B2B](https://github.com/) — OAuth client credentials; vuelos (Lleego) + hoteles (Dingus).  
**Contexto técnico previo:** análisis de capas en sesión 2026-07-10; stack actual Starling (TVC) + EUROVIPS.

---

## Contexto

Wholesale Connect AI cotiza viajes desde tres superficies:

| Superficie | Path | Executor de search |
|---|---|---|
| Emilia Web | `/emilia/chat` | `src/features/chat/services/searchHandlers.ts` |
| Emilia API | `POST /v1/emilia/turn` → edge `emilia-turn` | `supabase/functions/_shared/searchExecutor.ts` |
| Search API | `POST /v1/search` (Fastify) | `api/src/services/searchExecutor.ts` |

Hoy el fan-out es **1 proveedor por vertical**:

- Vuelos → solo `starling-flights` (TVC)
- Hoteles / packages / services → solo `eurovips-soap`
- Hotelbeds existe como edge (`hotelbeds-api`) pero **casi no entra** al path Emilia

El enum `provider_code` ya incluye `DELFOS` (migration inicial + `src/types/index.ts`), y la tabla `integrations` admite filas por agency — pero **no hay adapter runtime**.

Delfos API B2B expone un contrato REST unificado:

- `POST /v1/oauth/token` (client credentials)
- `POST /v1/flights/search` → `{ data: { offers: FlightOffer[] }, meta }` (`offer_id` opaco `off_*`)
- `POST /v1/hotels/search` → `{ data: { offers: HotelOffer[] }, meta }` (`offer_id` opaco `hof_*`)
- Sin CORS (server-to-server). Errores RFC 7807.

Necesitamos **más inventario de search** sin tocar el parser/LLM ni abrir booking.

---

## Decisión

### D1 — Delfos es un **tercer adapter de search**, no un reemplazo

- **Flights:** Starling ∥ Delfos (fan-out paralelo, merge)
- **Hotels:** EUROVIPS ∥ Delfos (fan-out paralelo, merge)
- **Packages / services / activities / transfers:** sin cambio (EUROVIPS / Hotelbeds paths existentes)
- **Booking, reprice, ticketing, hotel commit:** **explícitamente fuera**. Los `offer_id` se guardan en el item canónico para una etapa futura, pero ninguna superficie invoca price/book.

### D2 — El LLM no elige proveedor

El `ai-message-parser` (PROMPT `emilia-parser-v26`) y el tool loop **no cambian**. Siguen emitiendo `requestType` + slots. El dispatch multi-provider es **determinístico** en los executors.

### D3 — Anti-Corruption Layer en el borde

Nueva Edge Function `delfos-api` (único punto de contacto con Delfos):

- OAuth token cache (memoria/Redis) hasta `expires_in − skew`
- `searchFlights` / `searchHotels` actions
- Mappers **Delfos → modelos canónicos Wholesale** (`FlightData` / `HotelData` extendidos)
- Rate limit (`withRateLimit`), timeout 45s, `X-Request-ID`
- Credenciales por Supabase secrets en MVP; wiring a `integrations` queda como fase posterior **sin bloquear** el search path

**Prohibido:** invocar Delfos desde el browser, o embeber tipos Lleego/Dingus en UI/PDF.

### D4 — Feature flag global (MVP), routing por agency después

| Flag | Default | Efecto |
|---|---|---|
| `DELFOS_SEARCH_ENABLED` | `false` | Si `false`, los executors no invocan `delfos-api` |
| `DELFOS_BASE_URL` | required when enabled | Staging/prod URL |
| `DELFOS_CLIENT_ID` / `DELFOS_CLIENT_SECRET` | required when enabled | OAuth |

Fase posterior (no este ADR): por-agency enable via `integrations.provider_code = 'DELFOS'`.

### D5 — Partial failure es éxito parcial

Si Starling responde y Delfos falla (o viceversa):

- Devolver resultados del proveedor que respondió
- Metadata: `providers_searched`, `providers_succeeded`, `provider_errors[]`
- Status: `completed` si hay ≥1 item; `incomplete` solo si **todos** los providers de esa vertical fallan con error (empty offers de un provider ≠ error)

Ya hay semilla de este patrón en combined search Web (`providerErrors`).

### D6 — Merge policy (search)

**Vuelos**

1. Concatenar arrays canónicos
2. Dedupe soft (no agresivo): misma marketing carrier + flight_number + dep airport/time + arr airport/time → conservar el más barato; si precio difiere >1% conservar ambos con providers distintos
3. Orden: precio asc
4. Cap: `min(40, total)` post-filtros de negocio (layover, baggage, cabin) — filtros se aplican **después** del merge sobre canónico
5. Cada item lleva `provider: 'STARLING' | 'DELFOS'`

**Hoteles**

1. Concatenar
2. Dedupe soft: `normalize(name) + check_in + check_out` → conservar min room price; si mismo hotel distinto provider, preferir interleave en UI (no borrar el segundo si precio/regimen difiere materialmente)
3. Reutilizar post-filters de cadena/nombre/room de EUROVIPS sobre canónico
4. Cap: `min(40, total)`
5. `provider: 'EUROVIPS' | 'DELFOS'` (y `HOTELBEDS` si algún día entra al path)

### D7 — Unificar el fan-out lo mínimo necesario (pragmatismo)

**No** reescribimos las 3 copias del executor en un monorepo package compartido en este ADR (costo alto, Deno vs Node). En cambio:

1. **Single source of truth de mappers + merge** vive en edge `_shared/providers/` (Deno)
2. Edge `searchExecutor` y Web `searchHandlers` invocan `delfos-api` (que ya devuelve canónico)
3. Fastify `api/src/services/searchExecutor.ts` se alinea en la misma PR de orquestación **o** se documenta como “sigue solo Starling/EUROVIPS hasta PR de parity” — **decisión cerrada:** se alinea en la misma fase de orquestación para que `/v1/search` y `/v1/emilia/turn` no diverjan

Duplicar solo el **wiring del fan-out** (pocas líneas); la lógica de map/merge no se reimplementa tres veces.

### D8 — Scope de tipos canónicos

Extender (mínimo):

```ts
// FlightData / HotelData
provider?: 'STARLING' | 'EUROVIPS' | 'DELFOS' | 'HOTELBEDS';
providerOfferId?: string;      // off_* | hof_* | fare id TVC | unique_id EUROVIPS
providerMeta?: {
  priceableUntil?: string;     // vuelos Delfos
  expiresAt?: string;          // hoteles Delfos
  sourceProvider?: string;     // 'lleego' | 'dingus' (informativo, no UI)
};
```

`ProviderCode` enum en DB **ya tiene DELFOS** — no requiere migration de enum.

### D9 — Superficies que ganan Delfos

| Superficie | ¿Search multi-provider? |
|---|---|
| Emilia Web `standard_search` | Sí |
| Emilia API `/v1/emilia/turn` | Sí (vía edge `executeSearch`) |
| `/v1/search` | Sí |
| Packages/services | No |
| PDF generation | Solo muestra badge/provider si el item lo trae; sin lógica Delfos-specific de booking |
| Context Engineering tools | No (salvo metadata opcional en `get_recent_searches` en fase late) |

### D10 — Fuera de scope (explícito)

- `POST /v1/flights/price`, booking flights, postbooking
- Hotel book two-phase (Dingus)
- Preferencia de usuario “solo Delfos / solo TVC” en NLP
- Credenciales per-agency en `integrations` (fase 2)
- Unificación total de `searchHandlers` + ambos `searchExecutor` en un package
- Hotelbeds en el fan-out Emilia

---

## Contratos de mapper (normativos)

### Auth

```
POST {DELFOS_BASE_URL}/v1/oauth/token
Content-Type: application/x-www-form-urlencoded
grant_type=client_credentials
Authorization: Basic base64(client_id:client_secret)  // preferido
→ { access_token, token_type, expires_in, scope }
```

### Flights request (desde `ParsedRequest.flights`)

```ts
{
  journeys: Array<{ origin: IATA3; destination: IATA3; date: 'YYYY-MM-DD' }>, // 1–2
  passengers: { ages: number[] }, // expand adults→30, children→8, infants→1 defaults if ages absent
  options?: { max_results?: number } // default 20
}
```

- IATA vía `resolveFlightCodes` existente (misma regla EZE/AEP).
- Multi-city >2 legs: **no invocar Delfos** en MVP (Delfos max 2 journeys); log + solo Starling.

### Flights response → canónico (shape edge post-transform, alineado a searchExecutor Starling items)

Campos mínimos:

| Delfos | Wholesale item |
|---|---|
| `offer_id` | `id`, `providerOfferId` |
| `price.total.amount` (string) | `price.amount` (number) |
| `price.total.currency` | `price.currency` |
| `journeys[0].segments[0].marketing_carrier` | `airline.code` |
| journey segments | `legs[].options[].segments` (adaptar al shape ya usado en API/Web) |
| `priceable_until` | `providerMeta.priceableUntil` |
| const | `provider: 'DELFOS'` |

Money amount es **string decimal** en Delfos → parse float seguro.

### Hotels request (desde `ParsedRequest.hotels`)

```ts
{
  // hotel_codes omitido en MVP → catálogo activo de la credencial Delfos
  check_in: 'YYYY-MM-DD',
  check_out: 'YYYY-MM-DD',
  rooms: [{ adults: number, children_ages?: number[] }] // max 1 room (Fase 1 Delfos)
}
```

- Multi-room Wholesale: invocar con 1 room (adults/children del request); documentar limitación.
- City filter: post-filter por nombre de hotel / chain sobre resultados (mismo pipeline EUROVIPS name filter), no cityCode Delfos (no existe en el contrato de search).

### Hotels response → `HotelData`

| Delfos | HotelData |
|---|---|
| `offer_id` | `unique_id`, `providerOfferId` |
| `hotel.name` | `name` |
| `hotel.code` | id auxiliar |
| `price` | room `total_price` (single synthetic room) |
| `meal_plan.codes` | room meal plan string |
| `room_type` | room name/code |
| `cancel_policies` | `policy_cancellation` text join |
| `expires_at` | `providerMeta.expiresAt` |
| const | `provider: 'DELFOS'` |

---

## Arquitectura objetivo (search only)

```
ParsedRequest
     │
     ▼
┌────────────────────────────────────────────────────┐
│ executeFlightSearch / handleFlightSearch           │
│  if DELFOS_SEARCH_ENABLED:                         │
│    Promise.allSettled([ starling, delfos-api ])    │
│  else: starling only                               │
│  → mergeFlights → filters → cap                    │
└────────────────────────────────────────────────────┘
     │                         │
     ▼                         ▼
starling-flights          delfos-api
 (TVC shape→canon)      (OAuth+map→canon)
```

```
Emilia API:  /v1/emilia/turn → emilia-turn → executeSearch (edge) ──┐
Emilia Web:  searchHandlers ───────────────────────────────────────┼─► delfos-api
/v1/search:  api searchExecutor ───────────────────────────────────┘
```

---

## Consecuencias

### Positivas

- Más inventario en cotización sin cambiar UX de chat ni contrato externo de Emilia API de forma breaking (solo metadata extra)
- Partial failure resiliente
- `offer_id` listo para booking futuro sin re-search si el TTL sigue vivo
- Flag off = comportamiento idéntico a hoy

### Negativas / tradeoffs

- Latencia p95 ≈ max(Starling, Delfos) cuando flag on (no suma si paralelo)
- Payload de resultados más grande (cap mitiga)
- Tres call sites del fan-out siguen existiendo (deuda conocida; no se resuelve en este ADR)
- Hotel search Delfos sin city semantics nativa → dependencia de catálogo de la credencial + post-filter
- Money string→number puede tener floating issues; redondear a 2 decimales en mapper

### Riesgos operativos

| Riesgo | Mitigación |
|---|---|
| Token OAuth inválido | cache + force refresh on 401 once |
| Dingus/Lleego lentos | timeout 45s independiente; allSettled |
| Empty catalog hotel | log + no fallar el merge EUROVIPS |
| Secrets mal configurados | flag off default; health log al primer call |

---

## Verificación de aceptación (Definition of Done)

1. Con flag **off**: tests de regresión de search Starling/EUROVIPS verdes; zero calls a Delfos.
2. Con flag **on** + mock Delfos: flights y hotels mergean; metadata `providers_*` correcta.
3. Delfos 503 + Starling 200 → items Starling + `provider_errors` Delfos.
4. Multi-city >2 legs → solo Starling (Delfos skip).
5. Emilia API turn de cotización devuelve items con `provider: 'DELFOS'` cuando mock responde.
6. **Ningún** endpoint de price/book invocado en el código nuevo.
7. `npm test` + lint/build de packages tocados.

---

## Referencias

- Delfos OpenAPI público: `delfos-api-b2b/specs/openapi.public.yaml`
- Flight search: `specs/005-flight-search/contracts/flights.openapi.yaml`
- Hotel search: `specs/012-hotel-search/contracts/hotel-search.openapi.yaml`
- Plan de implementación: [`docs/superpowers/plans/2026-07-10-delfos-search-integration.md`](../superpowers/plans/2026-07-10-delfos-search-integration.md)
- Executors actuales: `_shared/searchExecutor.ts`, `searchHandlers.ts`, `api/.../searchExecutor.ts`
- Provider enum: `src/types/index.ts` `ProviderCode`
