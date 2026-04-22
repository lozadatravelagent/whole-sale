# Emilia B2C — Estado del desarrollo

**Última actualización:** 18 Abril 2026 (post-PR 2 unificación routing/layouts)

## Estado actual

**🟢 PR 2 de la unificación cerrada en rama** `feat/pr2-unification-routing-layouts`. Dual-host colapsado bajo `emilia.vibook.ai`, login unificado en `/login` (raíz), admin pages bajo `/emilia/*`, `UnifiedLayout` reemplaza `MainLayout`/`CompanionLayout` para todas las superficies que sobreviven, `RequireAgent` añadido. Sin downtime del chat: agents ven la rama B2B de `ChatFeature` (aún sobre `MainLayout`, PR 3 reescribe), consumers ven la rama companion sobre `UnifiedLayout` con `ItineraryPanel` como `rightPanel`. Pendiente: smoke 2 visual completo + merge a `main`.

---

## Fases cerradas

| Fase | Qué hizo | PR |
|------|----------|----|
| 0 | `workspace_mode='companion'` E2E, `planner_agent` modular | — |
| 1.0 | Routing mode-aware en orchestrator | — |
| 1.0.5 | `useMessageHandler` respeta `executionBranch` | — |
| 1.1.a | Schema B2C: `owner_user_id`, `account_type`, RLS policies | #60 |
| 1.1.b | `upsertTrip` acepta `accountType` | #61 |
| 1.1.c | `trips` es source of truth en lectura | — |
| 1.1.d | Debounce 3s + flush en persistencia | #62 |
| 1.1.e-g | `listTripsByUser`, `deriveTripStatus`, eliminar dual-write | #63 |
| Paso 1 | Separación estructural: `CompanionLayout`, `/emilia/*`, `RequireConsumer` | #64 |
| Paso 2 | Modal de derivación humana: lead en CRM | #65 |
| Paso 3 | Panel de itinerario vivo | #66 |
| Paso 4 | Registro/login/profile consumer | #67 |
| Fase 1.2 | Internacionalización (i18n) para Emilia B2C — `LanguageSelector`, auto-detección de idioma del mensaje | #72 |

## Fixes y refinamientos aplicados durante testing

| Fix | Problema | Commit/PR |
|-----|----------|-----------|
| Consumer conversations RLS | "User has no agency assigned" al crear chat | #68 |
| Planner sync en turnos | Panel no se actualizaba después del primer mensaje | #69 |
| LanguageSelector en Popover | Click no funcionaba en contexto anidado | `7b71327e` |
| Supabase cookie handling | Refactor del manejo de cookies en cliente Supabase | `27880f1d` |
| AuthCallback + routing Emilia host | Callback de auth y enrutamiento dedicado para host Emilia | `5a1e5e22` |
| Login route + auth refactor | Ruta dedicada de login y refactor del flujo de autenticación | `d3c4124a` |
| Consumer sidebar vacío | `get_conversations_with_agency` no retornaba data para consumers + `inferConversationWorkspaceMode` degradaba `'companion'` a `'standard'` | `339ca6de` (C7.1.f) |
| Coherencia de texto | Texto conversacional no refleja cambios estructurales | Pendiente |
| Secciones redundantes | "Qué hacer en X" / "Puntos de interés" repetidos | Pendiente |

---

## Edge functions deployadas

```bash
# Ejecutar después de cada merge que toque edge functions
supabase functions deploy consumer-signup --linked
supabase functions deploy planner-agent --linked
```

## Migrations aplicadas

- `20260409000001_add_consumer_role_value.sql`
- `20260409000002_b2c_ownership.sql`
- `20260411000001_b2c_handoff_leads.sql`
- `20260411000002_consumer_conversations_rls.sql`

---

## Capacidades en prod

El consumer puede:
1. Registrarse en `/emilia/signup`
2. Loguearse en `/login` (login unificado post-PR-2; `/emilia/login` se eliminó junto con `ConsumerLogin.tsx`)
3. Chatear en `/emilia/chat`
4. Ver itinerario actualizándose en tiempo real (panel derecho `rightPanel` del `UnifiedLayout`)
5. Pedir ayuda con vuelos/hoteles → lead en CRM (hasta que PR 4 borre el handoff)
6. Ver sus viajes en `/emilia/profile`

---

## Pendiente (refinamientos)

| Item | Descripción | Prioridad | Estado al 18-Abr |
|------|-------------|-----------|------------------|
| Coherencia texto | Texto conversacional debe reflejar cambios estructurales | Alta | Sin progreso — `supabase/functions/planner-agent/prompts/` sin cambios |
| Limpiar secciones | Quitar "Qué hacer en X" / "Puntos de interés" redundantes | Alta | Aún hardcodeados en `TripPlannerMap.tsx`, `TripPlannerWorkspace.tsx`, `plannerPlaceMapper.ts` |
| ~~Inbox B2C~~ | ~~Vista en CRM para leads con `agency_id IS NULL`~~ | — | **Descartado por ADR-002** (handoff completo se borra en PR 4) |
| Mobile drawer | Panel de itinerario en mobile | Media | `ItineraryPanel.tsx` sin branch responsive |
| Paso 5 | Capa social (feed, perfiles públicos) | Baja | No iniciado |

---

## Baseline de tests

- **251 passed / 14 skipped / 0 failed** (baseline post-PR-2 sobre `feat/pr2-unification-routing-layouts`). +11 sobre el snapshot del 18-Abr post-ADR: 5 de `requireAgentLogic.test.ts` (C3) + 6 de `unifiedLayoutMenu.test.ts` (C6).
- Build: limpio.
- TypeScript: sin errores.
- D11 (las dos fallas históricas `localStorage is not defined`) confirmada cerrada — no reapareció en ninguno de los 6 ciclos de test de PR 2.

---

## Cómo testear

**Flujo completo:**
1. `/emilia` → "Empezar gratis" → Signup
2. Auto-login → `/emilia/chat`
3. "Quiero Italia 7 días, Roma y Florencia"
4. "Agregá Venecia" → Panel debe actualizarse
5. "Mostrame hoteles" → NO debe regenerar itinerario
6. Cuando esté listo → Handoff → Lead en DB

**Verificar en DB:**
```sql
-- Consumer creado
SELECT id, email, account_type, role FROM public.users WHERE email = '...';

-- Conversación creada
SELECT id, agency_id, workspace_mode FROM public.conversations WHERE created_by = '...';

-- Lead generado
SELECT id, agency_id, trip_id FROM public.leads WHERE agency_id IS NULL;
```

---

## Unificación B2B/B2C (en progreso)

Ver [`docs/adr/ADR-002-chat-unification.md`](adr/ADR-002-chat-unification.md) para la decisión arquitectónica completa y [`docs/context/2026-04-18-chat-unification-context.md`](context/2026-04-18-chat-unification-context.md) para el mapa de contexto técnico.

Resumen: se unifica el chat B2B y B2C en un único surface con switch estricto agency/passenger. El modelo "motor compartido, productos separados" de la auditoría original se revierte parcialmente — el motor sigue compartido, los productos se fusionan.

PRs planeadas:
1. ADR + scaffolding (✅ mergeada en `dda48aac`).
2. Unificación de routing y layouts (✅ cerrada en rama `feat/pr2-unification-routing-layouts`, pendiente smoke 2 + merge).
3. Chat con switch + Nivel 2 de continuidad (pendiente).
4. Purga de CRM, handoff y `standard_itinerary` (pendiente).
5. Export PDF de itinerario (pendiente).

Las fases previas (0 → Paso 4 + Fase 1.2) quedan como baseline de ejecución. No se revierten; se refactorizan en las PRs siguientes.

---

## Archivos clave

**Edge functions:**
- `supabase/functions/planner-agent/` — cerebro del chat
- `supabase/functions/consumer-signup/` — registro de consumers

**B2C UI (post-PR-2):**
- `src/pages/Login.tsx` — login unificado role-agnostic (absorbió `ConsumerLogin.tsx`, borrado en C5b).
- `src/pages/ConsumerSignup.tsx`
- `src/pages/ConsumerProfile.tsx`
- `src/pages/CompanionChatPage.tsx` — role-aware desde C7 (lee `accountType` y delega `mode` al `ChatFeature`).
- `src/features/companion/components/`

**Motor (compartido B2B/B2C):**
- `src/features/trip-planner/services/tripService.ts`
- `src/features/trip-planner/hooks/usePlannerState.ts`
- `src/hooks/useChat.ts`

**Layout y guards (post-PR-2):**
- `src/components/layouts/UnifiedLayout.tsx` — layout único para consumer y agent, hereda chrome de CompanionLayout + logout robusto de MainLayout, prop opcional `rightPanel` (320px en `lg:`).
- `src/components/layouts/unifiedLayoutMenu.ts` — función pura `getAvatarMenuItems(role)` para el menu del avatar.
- `src/components/RequireAgent.tsx` + `requireAgentLogic.ts` — guard nuevo para rutas admin.
- `src/components/RequireConsumer.tsx` — sigue protegiendo `/emilia/profile`.
- `src/features/companion/components/` — `HandoffBanner`, `HandoffModal`, `ItineraryPanel` (este último ahora consumido por `UnifiedLayout` vía `rightPanel`).
- `src/features/companion/services/consumerAuthService.ts`.

**Layouts deprecados (vivos hasta PR 4):**
- `src/components/layout/MainLayout.tsx` — sin nav rail visible (CRM/Marketplace/Reports removidos en C10). Solo lo consumen la rama B2B de `ChatFeature` (PR 3 reescribe) y los skeletons `CRMSkeleton`/`ReportsSkeleton` (PR 4 los borra junto con sus pages).
- `src/components/layouts/CompanionLayout.tsx` — sin consumers post-PR-2.

---

## Dead code pendiente para PR 4

Cleanup acumulado durante PR 2 que se difiere a la PR de purga para mantener atomicidad:

- `src/components/layouts/CompanionLayout.tsx` — sin consumers post-C7.
- `src/components/layout/MainLayout.tsx` — sobrevive solo para la rama B2B de `ChatFeature` y los skeletons `CRMSkeleton`/`ReportsSkeleton`. Se borra cuando PR 3 reescriba `ChatFeature` y PR 4 elimine las pages CRM/Marketplace/Reports.
- `src/features/companion/utils/consumerAuthSchema.ts` exports `consumerLoginSchema` y `ConsumerLoginFormData` — sin callers productivos post-borrado de `ConsumerLogin.tsx` en C5b. El test `consumerAuthSchema.test.ts` sigue ejerciendo el schema, así que queda hasta que PR 4 decida.
- `src/features/companion/services/consumerAuthService.ts` export `fetchUserAccountType` — marcada `@deprecated` en C5b. Su único caller era la lógica "agent entrando por puerta consumer" de `ConsumerLogin`, obsoleta con el login unificado.
- `src/lib/host.ts` exports `isEmiliaHost`, `isMainHost`, `mainOrigin`, `emiliaOrigin`, `isSafeReturnUrl`, `getHostname`, `EMILIA_HOSTS`, `MAIN_HOSTS`, `SAFE_RETURN_HOSTS` — todas marcadas `@deprecated` en C1/C2. Solo `COOKIE_DOMAIN` sobrevive (lo consume `src/integrations/supabase/client.ts`).
- `src/components/skeletons/CRMSkeleton.tsx` y `ReportsSkeleton.tsx` — siguen usando `MainLayout`, se borran junto con sus pages.

---

## TODO antes del merge final de PR 2 a `main`

- **Smoke 2 visual a viewport 1024px (lg mínimo).** El ajuste C7.1 + C7 (rightPanel a 320px, chat ~376px de ancho) pasó análisis estático pero falta confirmación visual con el chat cargado, sidebar abierto y `ItineraryPanel` poblado. Si algo se siente apretado, el fix es subir el breakpoint del split (`lg:` → `xl:`) o reducir el sidebar consumer (`md:w-72` → `md:w-64`).
- **Smoke completo de admin pages migradas** (Dashboard, Users, Agencies, Tenants, Settings) bajo `UnifiedLayout`: cargar cada una con role OWNER/SUPERADMIN y SELLER, abrir el avatar menu, confirmar items condicionales por rol, click cada link.
- **Logout robusto en práctica:** loguearse, hacer logout desde el avatar, confirmar `localStorage` limpio (DevTools → Application → Local Storage, sin claves `sb-*`/`supabase`) y aterrizaje en `/emilia` vía el `RootRedirect` de C1.

**Handoffs y contexto adicional:**
- `docs/handoffs/auditoria-b2b-b2c-emilia.md`
- `docs/handoffs/Emilia B2C.md`
- `docs/handoffs/Handoff — Emilia B2C, post-1.1.d  pre-Fase 1.1.e.md` (último handoff por fase)