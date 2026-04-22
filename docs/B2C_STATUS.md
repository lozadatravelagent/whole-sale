# Emilia B2C — Estado del desarrollo

**Última actualización:** 22 Abril 2026 (post-PR 4 cleanup)

## Estado actual

**🟢 PR 4 ejecutada.** Purga post-unificación completa: `src/features/companion/` borrado (handoff stack + relocaciones a `auth/` y `chat/`), pages B2B legacy eliminadas (CRM, Marketplace, Reports, HotelbedsTest), `src/features/crm/` orphan borrado, `MainLayout` + `CompanionLayout` + skeletons eliminados, deprecated exports de `host.ts` limpiados, `planner_agent` dead-path removido del stack de routing + handler + pipeline + ChatInterface + edge function dir, migration de reverso de `leads` commiteada (pendiente push a prod), `CompanionChatPage` renombrada a `EmiliaChatPage`. Dual-write a `messages` en `persistPlannerState` ya había cerrado en PR #63 (1.1.g). Tests: 330 → 292 passed. Pendiente: `supabase functions delete planner-agent --linked` + `supabase db push --linked` (checklist D13) como pasos manuales post-merge.

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
| PR 2 | Unificación routing/layouts: dual-host colapsado, `UnifiedLayout`, `RequireAgent`, login unificado | `4ce93f67` |
| PR 3 | Chat unification: ModeSwitch, strict mode routing, `mode_bridge`, rama B2B bajo UnifiedLayout | #75 (`d82ac244`) |
| PR 4 | Purga post-unificación: `src/features/companion/`, pages B2B, `crm/` orphan, layouts muertos, deprecated host exports, planner_agent stack, rename CompanionChatPage → EmiliaChatPage, migration reverso leads | pendiente merge |

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

# Post-PR-4 (paso manual, una vez):
# supabase functions delete planner-agent --linked
```

## Migrations aplicadas

- `20260409000001_add_consumer_role_value.sql`
- `20260409000002_b2c_ownership.sql`
- `20260411000001_b2c_handoff_leads.sql`
- `20260411000002_consumer_conversations_rls.sql`
- `20260418000001_revert_b2c_handoff.sql` (PR 4, pendiente push a prod — checklist D13)

---

## Capacidades en prod

El consumer puede:
1. Registrarse en `/emilia/signup`
2. Loguearse en `/login` (login unificado post-PR-2; `/emilia/login` se eliminó junto con `ConsumerLogin.tsx`)
3. Chatear en `/emilia/chat`
4. Ver itinerario actualizándose en tiempo real (panel derecho `rightPanel` del `UnifiedLayout`)
5. Ver sus viajes en `/emilia/profile`

**Post-PR-4**: el handoff humano (lead en CRM) fue removido del producto. Las pages B2B (CRM, Marketplace, Reports) ya no existen.

---

## Pendiente (refinamientos)

| Item | Descripción | Prioridad | Estado al 22-Abr |
|------|-------------|-----------|------------------|
| Coherencia texto | Texto conversacional debe reflejar cambios estructurales | Alta | Planner-agent borrado en PR 4; revisar prompts de `travel-itinerary` si persiste |
| Limpiar secciones | Quitar "Qué hacer en X" / "Puntos de interés" redundantes | Alta | Aún hardcodeados en `TripPlannerMap.tsx`, `TripPlannerWorkspace.tsx`, `plannerPlaceMapper.ts` |
| ~~Inbox B2C~~ | ~~Vista en CRM para leads con `agency_id IS NULL`~~ | — | **Descartado por ADR-002** (handoff y CRM borrados en PR 4) |
| Mobile drawer | Panel de itinerario en mobile | Media | `ItineraryPanel.tsx` sin branch responsive (ahora en `src/features/chat/components/`) |
| D17 — UnifiedLayout sin i18n | Avatar menu + "Cerrar sesión" literal en español | Baja | Diferido fuera de PR 3 (decisión 2026-04-22). Candidato a polish pre-launch |
| Paso 5 | Capa social (feed, perfiles públicos) | Baja | No iniciado |

---

## Baseline de tests

- **292 passed / 11 skipped / 0 failed** (baseline post-PR-4). −38 vs post-PR-3 (330/11/0): 8 handoffFormSchema + 13 handoffService + 11 isTripReadyForHandoff + 3 consumerLoginSchema + 2 orchestrator legacy planner-agent + 1 pipeline agent convergence = 38 tests borrados con su código. Los test files de companion, las 3 suites handoff y los 2 legacy tests del orchestrator ya no existen.
- Build: limpio (warning informativo de `ChatFeature-*.js` ~2.68 MB pre-existente).
- TypeScript: sin errores.
- D11 (las dos fallas históricas `localStorage is not defined`) confirmada cerrada — no reapareció en los 6 ciclos de test de PR 2 ni en el baseline post-PR-3/4. Cierre formal registrado en `TECH_DEBT.md` el 2026-04-22 (commit `877a6c66`).

---

## Cómo testear

**Flujo completo:**
1. `/emilia` → "Empezar gratis" → Signup
2. Auto-login → `/emilia/chat`
3. "Quiero Italia 7 días, Roma y Florencia"
4. "Agregá Venecia" → Panel debe actualizarse
5. "Mostrame hoteles" → NO debe regenerar itinerario
6. Ver viajes acumulados en `/emilia/profile`

**Verificar en DB:**
```sql
-- Consumer creado
SELECT id, email, account_type, role FROM public.users WHERE email = '...';

-- Conversación creada
SELECT id, agency_id, workspace_mode FROM public.conversations WHERE created_by = '...';

-- Leads pre-migration de reverso: sólo B2B post-PR-4 (agency_id NOT NULL)
SELECT id, agency_id FROM public.leads WHERE agency_id IS NULL;  -- esperado: 0
```

---

## Unificación B2B/B2C (en progreso)

Ver [`docs/adr/ADR-002-chat-unification.md`](adr/ADR-002-chat-unification.md) para la decisión arquitectónica completa y [`docs/context/2026-04-18-chat-unification-context.md`](context/2026-04-18-chat-unification-context.md) para el mapa de contexto técnico.

Resumen: se unifica el chat B2B y B2C en un único surface con switch estricto agency/passenger. El modelo "motor compartido, productos separados" de la auditoría original se revierte parcialmente — el motor sigue compartido, los productos se fusionan.

PRs planeadas:
1. ADR + scaffolding (✅ mergeada en `dda48aac`).
2. Unificación de routing y layouts (✅ mergeada a main en `4ce93f67`).
3. Chat con switch + Nivel 2 de continuidad (✅ mergeada a main en `d82ac244`, PR #75).
4. Purga post-unificación: companion/, pages B2B, crm/ orphan, layouts, host exports, planner_agent stack, migration reverso leads, rename EmiliaChatPage. Ejecutada; pendiente push a prod de la migration + `supabase functions delete planner-agent --linked`. **NO purga `standard_itinerary`** (cancelado por C7.1.e). 1.1.g (dual-write a `messages`) ya estaba cerrado en PR #63.
5. Export PDF de itinerario (pendiente).

Las fases previas (0 → Paso 4 + Fase 1.2) quedan como baseline de ejecución. No se revierten; se refactorizan en las PRs siguientes.

---

## Archivos clave

**Edge functions:**
- `supabase/functions/consumer-signup/` — registro de consumers
- `supabase/functions/travel-itinerary/` — generador de itinerarios
- `supabase/functions/ai-message-parser/` — NLP parsing de mensajes

**B2C UI (post-PR-4):**
- `src/pages/Login.tsx` — login unificado role-agnostic (absorbió `ConsumerLogin.tsx`, borrado en C5b).
- `src/pages/ConsumerSignup.tsx`
- `src/pages/ConsumerProfile.tsx`
- `src/pages/EmiliaChatPage.tsx` — role-aware (lee `accountType` y delega `mode` al `ChatFeature`). Renombrada desde `CompanionChatPage.tsx` en PR 4.
- `src/features/auth/` — servicios + utils + tests de auth consumer (relocalizados desde `companion/` en PR 4).
- `src/features/chat/components/ItineraryPanel.tsx` — panel derecho del `UnifiedLayout`, relocalizado desde `companion/` en PR 4.

**Motor (compartido B2B/B2C):**
- `src/features/trip-planner/services/tripService.ts`
- `src/features/trip-planner/hooks/usePlannerState.ts`
- `src/hooks/useChat.ts`

**Layout y guards:**
- `src/components/layouts/UnifiedLayout.tsx` — layout único para consumer y agent, prop opcional `rightPanel` (320px en `lg:`).
- `src/components/layouts/unifiedLayoutMenu.ts` — función pura `getAvatarMenuItems(role)` para el menu del avatar.
- `src/components/RequireAgent.tsx` + `requireAgentLogic.ts` — guard para rutas admin.
- `src/components/RequireConsumer.tsx` — protege `/emilia/profile`.

---

**Handoffs y contexto adicional:**
- `docs/handoffs/auditoria-b2b-b2c-emilia.md`
- `docs/handoffs/Emilia B2C.md`
- `docs/handoffs/Handoff — Emilia B2C, post-1.1.d  pre-Fase 1.1.e.md`
- `docs/handoffs/Handoff___Emilia_B2C__post_PR-3__pre_PR-4.md` (último handoff por fase)