# Emilia B2C — Estado del desarrollo

**Última actualización:** 18 Abril 2026 (post-ADR-002, pre-unificación B2B/B2C)

## Estado actual

**🟡 Etapa 1 + Fase 1.2 completas. Entrando en unificación B2B/B2C** (ver [ADR-002](adr/ADR-002-chat-unification.md)). El estado previo a la unificación queda congelado como baseline para la ejecución de PRs 2-5.

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
2. Loguearse en `/emilia/login`
3. Chatear en `/emilia/chat`
4. Ver itinerario actualizándose en tiempo real (panel derecho)
5. Pedir ayuda con vuelos/hoteles → lead en CRM
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

- **240 passed / 14 skipped / 0 failed** (baseline del 18-Abr post-ADR). Las dos fallas históricas de D11 (`localStorage is not defined`) ya no aparecen — probablemente resueltas por refactors de auth/i18n. D11 tentativamente cerrada, a confirmar en PR 2.
- Build: limpio
- TypeScript: sin errores

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
2. Unificación de routing y layouts (pendiente).
3. Chat con switch + Nivel 2 de continuidad (pendiente).
4. Purga de CRM, handoff y `standard_itinerary` (pendiente).
5. Export PDF de itinerario (pendiente).

Las fases previas (0 → Paso 4 + Fase 1.2) quedan como baseline de ejecución. No se revierten; se refactorizan en las PRs siguientes.

---

## Archivos clave

**Edge functions:**
- `supabase/functions/planner-agent/` — cerebro del chat
- `supabase/functions/consumer-signup/` — registro de consumers

**B2C UI:**
- `src/pages/ConsumerSignup.tsx`
- `src/pages/ConsumerLogin.tsx`
- `src/pages/ConsumerProfile.tsx`
- `src/pages/CompanionChatPage.tsx`
- `src/features/companion/components/`

**Motor (compartido B2B/B2C):**
- `src/features/trip-planner/services/tripService.ts`
- `src/features/trip-planner/hooks/usePlannerState.ts`
- `src/hooks/useChat.ts`

**Layout y guards:**
- `src/components/layouts/CompanionLayout.tsx`
- `src/components/RequireConsumer.tsx`
- `src/features/companion/components/` — `HandoffBanner`, `HandoffModal`, `ItineraryPanel`
- `src/features/companion/services/consumerAuthService.ts`

**Handoffs y contexto adicional:**
- `docs/handoffs/auditoria-b2b-b2c-emilia.md`
- `docs/handoffs/Emilia B2C.md`
- `docs/handoffs/Handoff — Emilia B2C, post-1.1.d  pre-Fase 1.1.e.md` (último handoff por fase)