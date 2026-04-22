# PR 4 — Purga post-unificación Emilia B2C

## Contexto

Post-PR-3 (unificación del chat Emilia 5.0, `d82ac244`), PR 4 ejecuta el cleanup diferido acumulado durante PR 2 y PR 3: purga del stack de handoff B2C→B2B, pages B2B legacy sin consumers post-unificación, layouts muertos, deprecated exports, el dead-path de `planner_agent` (removal + reescritura diferidos en C7.1.e), migration de reverso de `leads` que restaura la constraint `NOT NULL` pre-handoff, y rename `CompanionChatPage → EmiliaChatPage`. Sin features nuevas.

La decisión arquitectónica original (ADR-002) planeaba eliminar `standard_itinerary` en C8. C7.1.e canceló esa eliminación (passenger mode productivo usa `standard_itinerary`, no `planner_agent`). PR 4 ejecuta la contraparte: `planner_agent` sale, `standard_itinerary` se queda.

## Decisiones cerradas en Paso 1 (ver handoff `post_PR-3__pre_PR-4`)

1. **planner_agent: purga completa (opción 1a).** Con levantamiento acotado de la regla §8 "NO tocar orchestrator" — el comentario en `conversationOrchestrator.ts:512-528` (commit `8e3c6fda`, C7.1.e) ya documentaba el removal como "deferred". PR 4 ejecuta ese deferred, no reabre el diseño de routing. Diagnóstico empírico: `mode` nunca es `undefined` en producción (garantizado upstream por `deriveDefaultMode` + `resolveEffectiveMode`), por lo que el legacy path que asignaba `shouldUsePlannerAgent: true` es unreachable. Alcance en orchestrator = diff mínimo case (ii): borrar sólo líneas path-specific, preservar ramas legacy vivas (`ask_minimal`, `standard_itinerary` para discovery bypass, `standard_search`).
2. **Migration de reverso de `leads`**: ejecutada sólo contra local. Pre-check `SELECT count(*) FROM leads WHERE agency_id IS NULL = 0` confirmado contra prod antes de abrir la sesión. Push a prod queda como checklist D13 post-merge.
3. **`CompanionChatPage.tsx` → `EmiliaChatPage.tsx`**: rename + 3 refs mecánicas en App.tsx + 1 comment ref en `buildPromptChatPath.ts`. Vocabulario "companion" no sobrevive PR 4.
4. **Redirects legacy**: los 6 redirects en `App.tsx` (`/chat`, `/dashboard`, `/users`, `/agencies`, `/tenants`, `/settings`) quedan intactos — destinos `/emilia/...` sobreviven, bookmarks externos preservados.
5. **`ItineraryPanel` + `hasItineraryContent`**: relocalizados a `src/features/chat/` (no borrados) — el panel es productivo en ambos modos de `ChatFeature`.
6. **Auth consumer stack** (`consumerAuthService`, `authRedirectDecider`, `consumerAuthSchema` + tests): relocalizado a nuevo feature home `src/features/auth/`. Dropeados `fetchUserAccountType` (0 callers post-C5b) y `consumerLoginSchema` + `ConsumerLoginFormData` (0 callers productivos).
7. **Dual-write a `messages` en `persistPlannerState`** (1.1.g): YA CERRADO en PR #63 (commit `f6f23d3e`). Fuera del scope de PR 4.
8. **`PlannerAgentInputPrompt` → `MissingFieldsInputPrompt`**: rename (commit 11.b) porque el componente sirve también al branch `ask_minimal` y a 8+ validation paths, no sólo a planner-agent.

## Inventario

### Archivos creados (10)

- `src/features/auth/services/consumerAuthService.ts` (relocado, drop `fetchUserAccountType`)
- `src/features/auth/utils/authRedirectDecider.ts` (relocado)
- `src/features/auth/utils/consumerAuthSchema.ts` (relocado, drop `consumerLoginSchema` + `ConsumerLoginFormData`)
- `src/features/auth/__tests__/authRedirectDecider.test.ts` (relocado)
- `src/features/auth/__tests__/consumerAuthSchema.test.ts` (relocado, drop describe `'consumerLoginSchema'`)
- `src/features/chat/components/ItineraryPanel.tsx` (relocado)
- `src/features/chat/utils/hasItineraryContent.ts` (relocado)
- `src/features/chat/__tests__/hasItineraryContent.test.ts` (relocado)
- `supabase/migrations/20260418000001_revert_b2c_handoff.sql`
- `src/pages/EmiliaChatPage.tsx` (rename destino)
- `src/features/trip-planner/components/MissingFieldsInputPrompt.tsx` (rename destino, 11.b)
- `docs/prs/pr4-cleanup.md` (este archivo)

### Archivos modificados (14)

- `src/App.tsx` — lazy imports + rutas CRM/Marketplace/Reports/HotelbedsTest borradas; lazy import + 2 element refs `CompanionChatPage` → `EmiliaChatPage`.
- `src/pages/ConsumerSignup.tsx` — 3 imports `@/features/companion/...` → `@/features/auth/...`.
- `src/pages/ConsumerProfile.tsx` — 1 import.
- `src/features/chat/ChatFeature.tsx` — quitar 3 imports handoff + 2 state slices + `showHandoffBanner` + renders banner/modal; actualizar import `ItineraryPanel` al nuevo path.
- `src/features/chat/hooks/useMessageHandler.ts` — borrar bloque L754-1206 (handler planner-agent); drop 4 imports.
- `src/features/chat/services/itineraryPipeline.ts` — borrar `buildCanonicalResultFromAgent`; narrow union `source`.
- `src/features/chat/components/ChatInterface.tsx` — drop bloque cards inline + action chips planner-agent-only; drop 4 imports no usados; rename import + JSX `PlannerAgentInputPrompt` → `MissingFieldsInputPrompt`.
- `src/features/chat/services/conversationOrchestrator.ts` — diff mínimo case (ii): drop `'planner_agent'` de 2 unions, drop `shouldUsePlannerAgent` de interface + 7 return sites, drop cómputo legacy + return block, simplificar `shouldUseStandardItinerary`, reducir comentarios.
- `src/features/trip-planner/__tests__/conversationOrchestrator.test.ts` — borrar 2 tests legacy; drop 5 asserts `shouldUsePlannerAgent`.
- `src/features/trip-planner/__tests__/itineraryPipeline.test.ts` — drop import + test "agent branch"; refactor test "both branches" → std only.
- `src/lib/host.ts` — borrar 9 exports deprecated; sobrevive `COOKIE_DOMAIN`.
- `vite.config.ts` — test.include: agregar `auth/`, quitar `companion/`.
- `src/features/landing/lib/buildPromptChatPath.ts` — 1 doc comment.
- `docs/B2C_STATUS.md`, `TECH_DEBT.md` — actualizaciones.

### Archivos borrados (65+)

**Companion stack:**
- `src/features/companion/` — directorio completo (15 archivos).
- `src/features/trip-planner/handoffReadiness.ts` + `isTripReadyForHandoff.test.ts` — huérfanos post-commit 3.

**Pages B2B legacy (4):**
- `src/pages/{CRM,Marketplace,Reports,HotelbedsTest}.tsx`.

**CRM feature orphan (38 archivos):**
- `src/features/crm/**`.

**Layouts + skeletons (4):**
- `src/components/layout/MainLayout.tsx`, `src/components/layouts/CompanionLayout.tsx`, `src/components/skeletons/{CRMSkeleton,ReportsSkeleton}.tsx`.

**Planner-agent stack:**
- `src/features/trip-planner/components/PlannerAgentInputPrompt.tsx` (rename source).
- `supabase/functions/planner-agent/` — 12 archivos.

**Page rename source:**
- `src/pages/CompanionChatPage.tsx`.

## Migration SQL

`supabase/migrations/20260418000001_revert_b2c_handoff.sql`:

- `DROP POLICY "consumer_insert_handoff_leads" ON public.leads;`
- `DROP INDEX idx_leads_b2c_inbox, idx_leads_trip_id;`
- `ALTER TABLE public.leads DROP COLUMN IF EXISTS trip_id;`
- `ALTER TABLE public.leads ALTER COLUMN agency_id SET NOT NULL;`
- `ALTER TABLE public.leads ALTER COLUMN tenant_id SET NOT NULL;`
- Restore `leads_agency_id_fkey` + `leads_tenant_id_fkey` a `ON DELETE CASCADE`.

NO se toca `20260411000002_consumer_conversations_rls.sql` — su policy (`consumer_insert_own_conversations`) es requerida por el B2C chat que sobrevive; no es handoff-specific.

Pre-check prod: `count(leads WHERE agency_id IS NULL) = 0` (confirmado antes de abrir sesión, usuario dio el dato). Safe para restaurar NOT NULL.

Validación local: `supabase db reset --local` aplicó todas las migrations incluyendo esta limpiamente. Post-reset schema confirmado vía `docker exec psql`: `trip_id` ausente, `agency_id`/`tenant_id` NOT NULL, `consumer_insert_handoff_leads` policy ausente, ambos índices B2C ausentes.

## Tests

- **Baseline pre-PR-4**: 330 passed / 11 skipped / 0 failed.
- **Baseline post-PR-4**: **292 passed / 11 skipped / 0 failed**.
- **Delta**: −38 passed. Corresponde a:
  - 8 tests `handoffFormSchema.test.ts`
  - 13 tests `handoffService.test.ts`
  - 11 tests `isTripReadyForHandoff.test.ts`
  - 3 tests `consumerLoginSchema` describe
  - 2 tests legacy planner-agent en `conversationOrchestrator.test.ts`
  - 1 test agent convergence en `itineraryPipeline.test.ts`

- Los 11 skipped son la RLS suite (`b2cOwnershipRls.test.ts`) que requiere `SUPABASE_SERVICE_ROLE_KEY`. Inalterada.

## Fundamentos del levantamiento acotado §8

Documentados en el commit message de commit 11 (`3ac3adc9`). Resumen:

1. **"Deferred" explícito**: `conversationOrchestrator.ts:512-528` escrito en C7.1.e (commit `8e3c6fda`) dice literalmente *"removal or rewrite is deferred"*. PR 4 ejecuta ese deferred.
2. **Dead-code diagnóstico**: `mode` nunca es undefined en producción. `deriveDefaultMode` siempre retorna `'agency' | 'passenger'`; `resolveEffectiveMode` nunca retorna undefined si cualquiera de sus argumentos está definido (el `chatMode` del closure lo está). Por lo tanto, el legacy path `mode === undefined` no es alcanzable en prod, y `shouldUsePlannerAgent: true` no puede retornar.
3. **Invariante ADR-002 addendum**: "planner_agent no puede volver a ser routing target sin re-diagnóstico" se preserva mejor con código borrado que con código huérfano señuelo.

## Checklist post-merge

1. **Push migration a prod**: `supabase db push --linked` — requiere checklist D13 (backup pre-push + 12 queries de verificación) y RLS suite corrida con `SUPABASE_SERVICE_ROLE_KEY`.
2. **Borrar edge function deployada**: `supabase functions delete planner-agent --linked` — paso manual, no automatizable desde repo.
3. Smoke manual en las rutas sobrevivientes:
   - `/emilia/chat` (agent + consumer, crear conversación + escribir)
   - `/emilia/profile`
   - `/emilia/signup`
   - `/login`
   - `/emilia` (landing)

## Deuda nueva

**D23 — Vocabulario "planner-agent" / "missing_info_request" vestigial.** Ver `TECH_DEBT.md`. Detectada durante ejecución. No bloquea, candidata a PR futura de cleanup de vocabulario.

## Hashes de commits de PR 4

```
1.    feat(auth): create src/features/auth/ and relocate consumer auth surface
2.    refactor(chat): relocate ItineraryPanel + hasItineraryContent to chat feature
3.    refactor(chat): remove handoff UI from ChatFeature
4.    chore(purge): delete companion handoff stack
5.    chore(purge): delete empty src/features/companion/ directory
6.    feat(migration): revert 20260411000001_b2c_handoff_leads
7.    chore(purge): delete B2B legacy pages and routes
8.    chore(purge): delete orphan src/features/crm/
9.    chore(purge): delete MainLayout + CompanionLayout + dead skeletons
10.   chore(purge): remove deprecated exports from src/lib/host.ts
11.   refactor(routing): drop planner_agent legacy path (PR 4, §8 lifted)
11.b. refactor(chat): rename PlannerAgentInputPrompt to MissingFieldsInputPrompt
12.   chore(purge): delete supabase/functions/planner-agent/
13.   refactor(chat): rename CompanionChatPage.tsx to EmiliaChatPage.tsx
14.   docs: update B2C_STATUS, TECH_DEBT, add pr4-cleanup PR description
```
