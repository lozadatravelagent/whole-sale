# Resumen estado — feat/pr3-chat-unification

Handoff generado el 2026-04-18. Bootstrap para chat nuevo de planning (C7.1.f / cierre PR 3).

## 1. Repo y rama

- **Repo**: `wholesale-connect-ai` (`C:\Users\Fran\Desktop\Projects\WholeSale\wholesale-connect-ai`).
- **Branch actual**: `feat/pr3-chat-unification`.
- **Tip**: `4d7cf4b9 fix(routing): route agent planner mode to standard_itinerary (reverts ADR-002 partial)` — commit C7.1.e.
- **Sync con origin**: no hay upstream configurado para la branch (`fatal: no upstream configured for branch 'feat/pr3-chat-unification'`). La branch es local, aún no fue push-eada.
- **Working tree**:
  - Staged: ninguno.
  - Unstaged: `TECH_DEBT.md` (intencional — D21 draft pendiente de cierre).
  - Untracked: `docs/handoffs/` (7 archivos históricos), `docs/propuestas/` (1 archivo). Convención del proyecto: estas carpetas quedan untracked.

## 2. Baseline de tests y build

- **`npm test`**: 300 passed / 11 skipped / 0 failed. 27 archivos passed / 1 skipped (`b2cOwnershipRls.test.ts`).
- **Tests skipped**:
  - `b2cOwnershipRls.test.ts` — skipped por falta de `SUPABASE_SERVICE_ROLE_KEY` (tests de RLS que requieren bypass). Debe correrse antes de mergear PR que toque migrations/policies.
  - No hay `.skip(` en el código de tests (`grep -rn "\.skip(" src/` → 0 matches). Los 11 tests skipped provienen del file-level skip de `b2cOwnershipRls.test.ts` vía guard de env var.
- **Tests failed**: ninguno.
- **`npm run build`**: limpio (`✓ built in 13.95s`). Warning de chunk size en `ChatFeature-*.js` (2.68 MB) — preexistente, no bloqueante.
- **`npx tsc --noEmit`**: sin output (exit 0, sin errores).

## 3. PR 3 — qué cubre y dónde estamos

### Plan original (del ADR-002)

PR 3 es la tercera de cinco PRs de la unificación B2B/B2C. Entrega: (a) chat con switch agency/passenger (componente `ModeSwitch`); (b) `resolveConversationTurn` rediseñado para modo estricto según el rol; (c) UX de puente entre modos (`mode_bridge`); (d) garantía de continuidad de `previousParsedRequest` entre turnos (Nivel 2). Deja `standard_itinerary` y `src/features/companion/` vivos — su purga era responsabilidad de PR 4.

### Ejecución hasta ahora

Commits desde `4ce93f67` (merge de PR 2) al tip actual:

| # | Hash | Descripción | Estado |
|---|------|-------------|--------|
| 1 | `67677293` | feat(chat): add optional mode param to resolveConversationTurn (no-op) | ✅ smoked OK |
| 2 | `fa45e5a9` | feat(chat): add ModeSwitch component + pure state derivation | ✅ smoked OK |
| 3 | `a3f28cf0` | feat(chat): strict mode routing in resolveConversationTurn + mode_bridge | ✅ smoked OK |
| 4 | `1cd50e2e` | feat(chat): render mode_bridge turn + thread handler options | ✅ smoked OK |
| 5 | `cfb6c579` | feat(chat): wire chatMode state + bridge handlers + accountType prop rename | ✅ smoked OK |
| 6 | `a3b4e79e` | feat(chat): integrate ModeSwitch into ChatHeader — first visual change | ✅ smoked OK |
| 7 | `77b4a726` | refactor(chat): migrate B2B branch to UnifiedLayout | ✅ smoked OK |
| 8 | `76fd8421` | fix(chat): pass mode override to handler to avoid stale closure in bridge switch | ✅ smoked OK |
| 9 | `09999dc9` | fix(chat): suppress redundant branding in ChatHeader for agents under UnifiedLayout | ✅ smoked OK |
| 10 | `b7ca8615` | fix(chat): prevent horizontal overflow in recommended places carousel under UnifiedLayout (v2) | ✅ smoked OK |
| 11 | `20fbee26` | fix(chat): add scroll affordance to recommended places carousel via gradient fade | ✅ smoked OK |
| 12 | `4d7cf4b9` | fix(routing): route agent planner mode to standard_itinerary (reverts ADR-002 partial) | ⏸ esperando smoke |

Nota: los estados "smoked OK" corresponden a smokes del usuario en sesiones previas implícitos por la progresión de trabajo; no verificable empíricamente desde disco más que por el hecho de que cada commit construyó sobre el anterior sin reversión.

### Decisiones arquitectónicas tomadas durante PR 3

1. **Reversión parcial del ADR-002 en C7.1.e (commit `4d7cf4b9`)**: passenger mode emite `standard_itinerary` en lugar de `planner_agent`. Supuesto falso del ADR original: se creía que `planner_agent` producía `CanonicalItineraryResult` estructurado; empíricamente sólo emite prosa. Cambio localizado al bloque passenger del strict mode en `conversationOrchestrator.ts` (L609-623) + comentarios del strict mode + 5 tests adaptados + addendum al ADR-002.

2. **Cancelación de C8 (eliminar `standard_itinerary`)**: documentada en el addendum del ADR-002. `standard_itinerary` pasa a ser la rama productiva del modo planner para ambos roles. PR 4 no lo purga.

3. **`planner_agent` queda como código diferido**: la edge function `supabase/functions/planner-agent/` y su handler en `useMessageHandler.ts:755-1205` siguen vivos pero sin call sites de routing (el gate `shouldUsePlannerAgent` nunca se dispara post-C7.1.e). Eliminación/reescritura se difiere a PR futura fuera del alcance de PR 3–5.

4. **Discovery bypass preservado en legacy path**: `isDiscoveryIntent` cae al legacy path del orchestrator, emitiendo `standard_itinerary` con `responseMode: 'show_places'`. No requiere rama dedicada — la advertencia original sobre C8 queda obsoleta.

5. **Invariantes nuevas post-C7.1.e**:
   - El modo planner es soberano sobre `standard_itinerary`; quitar esa rama requiere nuevo ADR.
   - `planner_agent` no puede volver a tener call sites de routing sin emisión empírica de `plannerData` estructurado.

### Pendiente para cerrar PR 3

- **Smoke de C7.1.e**: agent agency + planner mode (casos descritos en commit body de `4d7cf4b9`), consumer planner mode como regression, switch agency↔planner consistente.
- **C7.1.f — D21** (sidebar consumer RPC equivocada): hook del sidebar consumer llama `get_conversations_with_agency` que filtra por `agency_id`; consumers no tienen agency → response vacío. Archivos candidatos: `src/features/chat/components/ChatSidebarCompanion.tsx`, `src/hooks/useChat.ts`, `src/features/chat/utils/sidebarFilters.ts`. No verificable qué fix exacto aplica sin abrir los archivos.
- **Push a origin** y creación de PR hacia `main`.
- Correr tests RLS (`b2cOwnershipRls.test.ts`) con `SUPABASE_SERVICE_ROLE_KEY` seteada antes del merge (requirement documentado en el skip message).

## 4. Modelo de chat unificado actual (post-C7.1.e)

Verificado contra `conversationOrchestrator.ts:464-719` + `ChatHeader.tsx` + `ChatFeature.tsx`:

| Elemento | Agent | Consumer |
|----------|-------|----------|
| Switch agency/planner en header | Visible (`showModeSwitch = accountType==='agent' && mode !== undefined && onModeChange !== undefined`, ChatHeader.tsx:53) | Oculto (mismo gate, `accountType==='consumer'` falla) |
| Modo agency → branch | `standard_search` (orchestrator L627-640) | N/A (consumer no tiene modo) |
| Modo planner → branch | `standard_itinerary` (orchestrator L609-624, post-C7.1.e) | `standard_itinerary` (legacy path, L688-703) |
| Panel derecho en planner | Hidratado (via `handleItineraryRequest` + `buildCanonicalResultFromStandard`) | Hidratado (mismo handler) |
| Cards "Lugares recomendados" | Visible (vía `recommendedPlaces` del canonical result) | Visible (mismo path) |
| Historial de conversaciones | Visible vía RPC con agency filter (intacto) | Roto pre-C7.1.f — llama la RPC con agency filter (D21) |

## 5. Deuda técnica vigente

Verificado contra `TECH_DEBT.md` (estado actual, unstaged):

| ID | Estado | Descripción |
|----|--------|-------------|
| D10 | ✅ CERRADA | Regeneración de `types.ts` desde prod, aceptada. |
| D11 | 🟡 BAJA | localStorage failures en `signatures.test.ts` y `structuralMods.test.ts`. **Inconsistencia**: al correr `npm test` hoy ambos archivos passan (300/11/0). Ver sección 10. |
| D12 | ✅ CERRADA | Push de migrations 1.1.a a prod completado 2026-04-09. |
| D13 | 🟡 PROCESO | Política: prohibido aplicar migrations fuera de git. Vigente. |
| D14 | 🟡 SPEC PENDIENTE (según TECH_DEBT.md) | Companion routing tests `.skip` en orchestrator. **Inconsistencia**: `grep -n "\.skip("` sobre `conversationOrchestrator.test.ts` devuelve 0 matches. El archivo no tiene referencias a `workspace_mode` ni `companion_fallback`. Ver sección 10. |
| D15 | 🟡 BAJA | `tripService.duplicateTrip` no setea `owner_user_id`. Sin call sites. |
| D16 | 🟡 BAJA | `superadmin_agencies_view` FKs ausentes en types regenerado. No afecta runtime. |
| D17 | 🟡 UX | `UnifiedLayout` sin i18n para avatar menu y logout. |
| D21 | 🟡 MEDIA-ALTA | Sidebar consumer RPC equivocada (`get_conversations_with_agency`). Pendiente C7.1.f. |

No hay D18, D19, D20 en el registro (verificado con `grep -n "^## D" TECH_DEBT.md`). No hay deudas nuevas anotadas durante PR 3 más allá de D21.

## 6. Reglas de proceso vigentes

Referencias a handoffs anteriores en `docs/handoffs/` para cuerpo completo:

1. **Regla A** — En duda, parar y reportar. No improvisar.
2. **Regla B** — Ningún commit puede contener archivos fuera de la lista explícita del plan.
3. **Regla C** — Ningún cambio empírico (números, widths, timings, copy) por razonamiento puro si requiere data del browser/DevTools.
4. **Hard stops** — explícitos entre Paso 0, Paso 1 y Paso 2.
5. **"No cambia comportamiento"** — hay que demostrarlo, no afirmarlo.
6. **Tradeoffs marginales** — se documentan en commit body aunque sean aceptables.
7. **D13** — prohibido aplicar migrations a prod fuera de git.
8. **Convención `docs/handoffs/`** — untracked, no se commitean.
9. **Convención `docs/propuestas/`** — untracked, no se commitean.
10. **No push hasta smoke OK** del usuario.
11. **Si smoke falla** → `git reset --soft HEAD~1` + diagnóstico nuevo.
12. **Sesiones 1M context** — one task per session, `/clear` entre tareas no relacionadas.
13. **Subagents** — para research, verificación externa, documentación.
14. **Category Policy invariant** — `CATEGORY_POLICY` en `usePlacesOrchestrator.ts` es single source of truth.
15. **CanonicalItineraryResult invariant** — única forma que sale del itinerary pipeline.
16. **RLS mandatorio** — nunca bypass con `service_role`.
17. **Separación api/ vs src/** — proyectos independientes, cero shared code.
18. **Edge function CORS** — siempre usar `_shared/cors.ts`.
19. **Provider cooldown propagation** — backend 429 → client `cooldownUntilRef`.
20. **Race condition guards** — version refs, AbortController, signature dedup. No remover sin entender el flujo concurrente.
21. **Modo planner soberano sobre `standard_itinerary`** (nueva, C7.1.e) — quitarlo requiere nuevo ADR.

(Numeración indicativa; el detalle completo vive en handoffs previos y en el ADR-002 + addendum.)

## 7. Lo que sigue después de PR 3

- **PR 4 (purga)**: eliminar `src/features/companion/` completo, `MainLayout` y `CompanionLayout` (reemplazados por `UnifiedLayout`), CRM/Marketplace/Reports (si quedan surfaces obsoletas), migration de reverso para `leads` si aplica. **Nota**: según el addendum del ADR-002, `standard_itinerary` **NO** se purga (cancelado por C7.1.e). `planner_agent` se evalúa pero la decisión se difiere.
- **PR 5**: export de itinerario a PDF — nuevo template y función `generateCustomItineraryPdf` en el sistema custom existente. UX del trigger (botón/slash command/menú) a definir en diseño.

## 8. Archivos clave para próxima sesión

- `docs/adr/ADR-002-chat-unification.md` — ADR rector. Incluye addendum 2026-04-18 con la reversión parcial de C7.1.e.
- `src/features/chat/services/conversationOrchestrator.ts` — `resolveConversationTurn` (función L464-719). Strict mode en L512-641, legacy path en L643-718.
- `src/features/chat/hooks/useMessageHandler.ts` — dispatch de branches. Gate planner_agent en L755, ask_minimal en L1219, mode_bridge en L1264, switch por `requestType` en L1940.
- `src/features/chat/ChatFeature.tsx` — composición root, `chatMode` state, integración con `ModeSwitch`, paso de `mode` al handler en L322-325.
- `src/components/layouts/UnifiedLayout.tsx` — layout unificado (role-aware), pendiente i18n (D17).
- `src/features/chat/components/ChatHeader.tsx` — renderiza `ModeSwitch` condicional por `accountType === 'agent'` + `mode !== undefined`.
- `src/features/chat/components/ModeSwitch.tsx` — toggle agency/passenger.
- `src/features/trip-planner/__tests__/conversationOrchestrator.test.ts` — suite de routing (849 líneas aprox.), 5 tests adaptados en C7.1.e.
- `src/features/trip-planner/__tests__/itineraryPipeline.test.ts` — suite del pipeline canónico, mantiene test de `buildCanonicalResultFromAgent` con `planner_agent` (handler vivo, deferred).
- `src/features/chat/components/ChatSidebarCompanion.tsx` + `src/hooks/useChat.ts` + `src/features/chat/utils/sidebarFilters.ts` — superficie del D21/C7.1.f.
- `TECH_DEBT.md` — registro de deuda (D10–D21).

## 9. Notas operacionales

- **Convención `docs/handoffs/` untracked**: carpeta con 7 archivos de handoffs históricos (`Handoff — Emilia B2C, post-PR-2 / ...`, etc.). No se commitean; se usan como material local para bootstrap de chats nuevos.
- **Convención `docs/propuestas/` untracked**: misma política, contiene actualmente `delfina-propuesta-comercial.md`.
- **Credenciales filtradas en D12** — cerrado desde 2026-04-09; no se arrastra a PR 3.
- **Tests RLS con `SUPABASE_SERVICE_ROLE_KEY`** — correr antes de mergear cualquier PR que toque migrations o policies (PR 3 no toca ninguna, pero la regla vive en el skip message).
- **Baseline esperada para futuras sesiones**: 300 passed / 11 skipped / 0 failed sin SERVICE_ROLE_KEY. 311 passed si se setea.
- **Branch sin upstream** — próximo push debe usar `git push -u origin feat/pr3-chat-unification`.

## 10. Inconsistencias detectadas

1. **D11 sigue listada como pendiente en `TECH_DEBT.md`** (describe 2 suites fallando por `localStorage is not defined`), pero al correr `npm test` hoy `signatures.test.ts` y `structuralMods.test.ts` pasan sin incidentes (27 archivos passed / 1 skipped, y el único skipped es `b2cOwnershipRls.test.ts` por SERVICE_ROLE_KEY, no por localStorage). Puede estar obsoleta o haberse resuelto implícitamente por algún cambio en vitest setup no documentado. No verificable si fue resolución explícita o desaparición del síntoma — requiere revisión de `TECH_DEBT.md` o lookup en git log.

2. **D14 descrita como "3 tests `.skip` con TODO en `conversationOrchestrator.test.ts`"** en `TECH_DEBT.md`, pero `grep -n "\.skip(" src/features/trip-planner/__tests__/conversationOrchestrator.test.ts` devuelve 0 matches, y no hay referencias a `workspace_mode` ni `companion_fallback` en ese archivo. Esto sugiere que D14 fue cerrada durante PR 3 (tests adaptados/eliminados al introducirse el strict mode con `mode: 'agency' | 'passenger'`), pero la entrada en `TECH_DEBT.md` nunca se marcó como cerrada. Requiere actualizar `TECH_DEBT.md` para reflejar el cierre.

3. **Naming de fases en `TECH_DEBT.md`**: D14 menciona "Fase 1.0/1.0.5"; el resto del contexto usa "PR 1/2/3". Es terminología previa, no incompatible pero inconsistente con la nomenclatura actual de PRs. Puramente cosmético.

4. **`ChatSidebarCompanion` como componente existente** (verificado en `grep -rn "ChatSidebarCompanion" src/`) — consistente con la descripción de D21. No es inconsistencia, sólo confirmación de que el surface del fix de C7.1.f existe.
