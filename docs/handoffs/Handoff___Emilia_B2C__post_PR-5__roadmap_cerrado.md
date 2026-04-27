# Handoff — Emilia B2C, post-PR-5 / roadmap cerrado

**Fecha del handoff:** 22 de Abril 2026
**Rama activa:** `main` (sincronizada con remoto en `38e4c4db`, merge commit de PR 5).
**Última operación:** Merge de PR 5 (export PDF itinerario) a main vía `38e4c4db` (PR #77). Push a `origin/main` confirmado.

---

## 1. Contexto del producto

Emilia arrancó como cotizador B2B para agencias de viaje (wholesale). La auditoría original (`docs/handoffs/auditoria-b2b-b2c-emilia.md`) propuso la tesis **motor compartido, productos separados**: B2B como CRM de agencia, B2C como self-serve para consumers. Esa tesis se revisó en **ADR-002** (mergeado en `dda48aac` el 17-Abr): el motor sigue compartido pero los productos se **fusionan en un único surface** con switch estricto agency/passenger. El handoff B2C→B2B no se sostuvo; los agents usan passenger mode como acelerador de planificación.

El roadmap post-ADR-002 tuvo 5 PRs:

| PR | Qué hizo | Estado |
|----|----------|--------|
| PR 1 — ADR + scaffolding | Decisión arquitectónica + estructura inicial | ✅ `dda48aac` |
| PR 2 — routing + layouts | `UnifiedLayout`, `RequireAgent`, login unificado, routing dual-host colapsado | ✅ `4ce93f67` |
| PR 3 — chat con switch | `ModeSwitch`, strict mode routing, `mode_bridge`, rama B2B bajo `UnifiedLayout`, addendum C7.1.e | ✅ `d82ac244` (PR #75) |
| PR 4 — purga post-unificación | `src/features/companion/` borrado, pages B2B eliminadas, `crm/` orphan, layouts muertos, deprecated host exports, planner_agent stack, rename CompanionChatPage → EmiliaChatPage, migration reverso leads | ✅ `45f59b96` (PR #76) |
| PR 5 — export PDF itinerario | Template day-by-day, `canExportPdf`, `escapeHtml`, botón en `ItineraryPanel`, on-demand blob download | ✅ `38e4c4db` (PR #77) |

**Con el merge de PR 5, el roadmap post-unificación ADR-002 + addendum C7.1.e queda formalmente cerrado.**

El consumer puede hoy:
1. Registrarse en `/emilia/signup`
2. Loguearse en `/login` (unificado post-PR-2)
3. Chatear en `/emilia/chat` — Emilia genera un itinerario day-by-day en el panel derecho
4. Ver el itinerario actualizándose en tiempo real (panel derecho `rightPanel` de `UnifiedLayout`)
5. **Descargar el itinerario como PDF** — botón en el footer del panel, on-demand blob download
6. Ver sus viajes en `/emilia/profile`

El agent puede:
1. Chatear en modo agency (cotizaciones, búsquedas de vuelos/hoteles)
2. Cambiar a modo passenger vía `ModeSwitch` para planificar viajes con `standard_itinerary`
3. Generar card en el CRM desde cualquier conversación agency-mode
4. Exportar itinerario a PDF en modo passenger (mismo `ItineraryPanel`, mismo botón)

---

## 2. Roadmap y dónde estamos

### Fases cerradas (todo el roadmap)

- **Fase 0:** `workspace_mode='companion'` end-to-end, `planner_agent` modular.
- **Fase 1.0/1.0.5:** routing mode-aware en orchestrator, `useMessageHandler` respeta `executionBranch`.
- **Fase 1.1.a-g:** schema B2C, `upsertTrip` con `accountType`, `trips` source of truth, debounce 3s + flush, `listTripsByUser`/`deriveTripStatus`, eliminar dual-write.
- **Pasos 1-4 (auditoría original):** `CompanionLayout`, rutas `/emilia/*`, `RequireConsumer`, modal handoff, panel itinerario vivo, registro/login/profile consumer.
- **Fase 1.2:** i18n con `LanguageSelector` y auto-detección de idioma.
- **PR 1-5:** ver tabla §1.

### Roadmap futuro (post-unificación — sin orden comprometido)

No hay "próxima PR" definida del roadmap de unificación porque el roadmap ya no existe. Los candidatos a priorizar en la siguiente sesión de planificación son:

| Ítem | Descripción | ID deuda |
|------|-------------|----------|
| Theme toggle en consumer | `ThemeToggle` agrupado por accidente bajo condicional agent-only en `ChatHeader.tsx`. Fix: moverlo fuera. PR chica. | D26 |
| PDF v2 | Export v1 entregado minimalista. Candidatas: mapas Mapbox Static, fotos Foursquare, i18n, Storage, export desde `/emilia/profile`. Evaluar por ítem con usuarios reales. | D27 |
| CRM lead handoff B2C→B2B | Punto único de contacto entre productos, diferido por ADR-002. No implementado. | — |
| Mobile drawer ItineraryPanel | Panel sin branch responsive en mobile. `ItineraryPanel.tsx` solo visible en `lg:` en `UnifiedLayout`. | — |
| Coherencia textual planner-agent | Prompts en `supabase/functions/planner-agent/prompts/` sobreviven aunque la edge function se borre. Revisar si su tono/persona refleja la arquitectura post-unificación. | — |
| Vocabulario vestigial `planner-agent` | `messageType` strings con `planner_agent` como literal en el código activo. | D23 |
| UnifiedLayout sin i18n | Avatar menu + "Cerrar sesión" hardcoded en español. | D17 |
| Capa social (Paso 5) | Feed, perfiles públicos. No iniciado. | — |

---

## 3. Qué hizo PR 5 (resumen operacional)

PR 5 implementó el export de itinerario a PDF usando el sistema custom existente (`html2canvas + jsPDF`), no PDFMonkey. Scope v1 explícitamente minimalista: texto-only, branding básico, on-demand blob download sin Supabase Storage, labels en español.

### Arquitectura del pipeline

```
handleExportItineraryPdf (ChatFeature)
  └→ generateItineraryPdf(plannerState, agencyId)
       ├→ fetchAgencyBranding(agencyId)     ← Supabase query → agencies.branding
       ├→ renderItineraryHtml(state, brand) ← template puro HTML/CSS inline
       └→ renderHtmlToPdfBlob(html)         ← html2canvas + jsPDF
            └→ URL.createObjectURL → <a download> → click → revokeObjectURL
```

### Commits cronológicos (del más antiguo al más nuevo)

```
1eec59a5  chore(deps): add jspdf and html2canvas as direct dependencies
4a323032  refactor(pdf): export renderHtmlToPdfBlob, wrapHtmlDocument, pageOpen, pageClose
8d0fc09d  refactor(pdf): export fetchAgencyBranding from pdfMonkey
b7212533  feat(pdf): add itinerary PDF generator with on-demand download
deef4c4d  feat(pdf): add itinerary PDF template, canExportPdf, escapeHtml, and unit tests
63ca077a  feat(chat): wire export-PDF action in ItineraryPanel and ChatFeature
ad45f90f  docs(prs): add PR 5 description
d8a3e5fb  docs: update B2C_STATUS and TECH_DEBT for PR 5
c852dd75  fix(chat): hoist useMemo above early return in ItineraryPanel ← commit F (post-review)
472fa664  test(chat): add React Testing Library infra and ItineraryPanel hooks-order regression test ← commit T (post-review)
18b60f5b  docs(prs): update PR 5 description with post-review addendum
f2a924af  docs: add D26 and D27 to TECH_DEBT, update PR 5 description
5e2c7ffe  docs: refine D26 diagnosis, add CRM button audit to PR 5 description
38e4c4db  Merge pull request #77 from lozadatravelagent/feat/pr5-pdf-export-itinerary ← merge commit
```

### Anomalías detectadas durante el smoke

**Bug blocker post-review — hooks-order violation (commit F `c852dd75`):**

Path 1 del smoke (browser real con transición `plannerState null → poblado`) reveló un crash: `"Rendered more hooks than during the previous render"`. Causa: dos `useMemo` (filtro de `destinations`, filtro de `segmentsWithCity`) declarados después del early return `if (!shouldRender || !plannerState) return null;` en `ItineraryPanel.tsx`. El fix hoistó ambos `useMemo` arriba del early return con optional chaining. El bug se introdujo en el commit de wiring (63ca077a) al dejar los `useMemo` cerca de sus usos en el JSX. Los Paths 2/3/4 del smoke no lo detectaron porque testean via unit tests, CSS e inspección de código, no render real. Sólo Path 1 lo atrapó.

**Regla 26 aplicada post-fix:** barrido de `ItineraryPanel.tsx` (completo), `ChatFeature.tsx` (zonas PR 5), `itineraryPdfGenerator.ts`, `itineraryPdfTemplate.ts`. Sin hallazgos adicionales.

**Infra de testing nueva (commit T `472fa664`):** la violación de hooks era invisible para los tests existentes (todos testeaban funciones puras). Se agregó `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` como devDeps, setup file en `src/test/setup.ts`, y test de regresión `src/features/chat/components/__tests__/ItineraryPanel.test.tsx` (3 casos: null→poblado, poblado→null, poblado→poblado). Environment jsdom scoped al archivo via `// @vitest-environment jsdom` — los 308 tests anteriores no cambiaron de behavior.

**D26 reformulada post-screenshot:** el smoke reveló que `ThemeToggle` NO estaba ausente sino agrupado por accidente con el chrome agent-only en `ChatHeader.tsx:106`. Diagnóstico inicial incorrecto ("toggle no montado") corregido a "toggle bajo condicional de rol incorrecto". Causa exacta ubicada via grep audit.

**Auditoría A/B/C del botón "Generar card en CRM":** visible en agency mode. Clasificación **A — flujo B2B legítimo preexistente**: handler `createComprehensiveLeadFromChat` en `@/utils/chatToLead`, escribe en tabla `leads`, sin imports de `src/features/companion/` (purgado en PR 4), sin `handoffService`, sin `fromCompanion`. Gate `accountType === 'agent'` correcto por diseño.

### Smoke results finales

| Path | Resultado |
|------|-----------|
| Path 1 — Desktop companion: botón visible + PDF correcto | ✅ post-commit F |
| Path 2 — `canExportPdf` gate: sin días/isDraft → sin botón | ✅ vía 5 unit tests |
| Path 3 — Mobile: panel hidden → botón invisible | ✅ vía `hidden lg:block` en `UnifiedLayout` |
| Path 4 — Agent passenger mode: botón disponible | ✅ vía ambos callers en `ChatFeature.tsx` |

---

## 4. Estado actual del repo

- **Rama:** `main`, sincronizada con `origin/main` en `38e4c4db`.
- **Tests:** `npm test -- --run` → **311 passed / 11 skipped / 0 failed** (sin `SUPABASE_SERVICE_ROLE_KEY`). +19 vs baseline post-PR-4 (292/11/0): +16 del template/canExportPdf (Paso 1 Fase B), +3 del test de regresión RTL (commit T).
- **Build:** limpio. Warning informativo `ChatFeature-*.js ~2.69 MB` pre-existente, no error.
- **TSC:** `npx tsc --noEmit` limpio.
- **Working tree:** solo untracked esperados — `docs/handoffs/` (incluyendo este handoff), `docs/propuestas/`.
- **Branches:** solo `main` local + `origin/main` + `feature/maxun-icaro-provider` (WIP local del usuario, no tocar).
- **devDeps nuevas:** `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

---

## 5. Deuda técnica vigente

| ID | Estado | Descripción |
|---|---|---|
| D1, D3-D9 | Histórica | Pre-1.1.a, no se tocan. |
| D10 | ✅ CERRADA | 9 Apr 2026. `types.ts` regenerado desde prod. |
| D11 | ✅ CERRADA | 22 Apr 2026. `localStorage is not defined` no reapareció en 6 ciclos de test PR 2 ni en baseline post-PR-3/4/5. |
| D12 | ✅ CERRADA | 9 Apr 2026. Migrations 1.1.a aplicadas a prod. |
| D13 | 🟡 PROCESO | Política: prohibido aplicar migrations a prod fuera de git. **Vigente.** D25 cerrado (22-Abr). D24 (migration) pendiente — ver §7. |
| D14 | ✅ CERRADA | 22 Apr 2026 (PR 3). Tests `.skip` adaptados al contrato de strict mode. |
| D15 | 🟢 BAJA | `duplicateTrip` no setea `owner_user_id`. Sin call sites actuales. |
| D16 | 🟢 BAJA | `superadmin_agencies_view` FK refs ausentes en types regenerado. No bloquea. |
| D17 | 🟢 UX DIFERIDA | `UnifiedLayout` sin i18n en avatar menu y "Cerrar sesión". Candidata a polish pre-launch. |
| D21 | ✅ CERRADA | 22 Apr 2026. Sidebar consumer cargando RPC B2B equivocada. Fix en `c2507101`. |
| D22 | 🟢 BAJA | Doble fetch en `loadConversations` al mount. Funcionalmente correcto, minor en cold-start. |
| D23 | 🟢 BAJA | Vocabulario vestigial `planner_agent` como literal en `messageType` strings del código activo. |
| D24 | 🟡 OPERACIONAL | Migration `revert_b2c_handoff` pendiente de aplicar a prod. Pre-check: `SELECT count(*) FROM public.leads WHERE agency_id IS NULL`. Ejecutar `supabase db push --project-ref ujigyazketblwlzcomve` en ventana lunes-jueves. |
| D25 | ✅ CERRADA | Edge function `planner-agent` borrada de prod el 22-Abr-2026 vía `supabase functions delete planner-agent --project-ref ujigyazketblwlzcomve`. 4 días de silencio post-PR-4 confirmados. |
| **D26** | 🟡 UX REGRESIÓN | `ThemeToggle` visible solo en agency mode. Agrupado por accidente con ModeSwitch + botón CRM en `ChatHeader.tsx:106` bajo `accountType === 'agent'`. Fix: mover `<ThemeToggle>` fuera del condicional. PR chica. |
| **D27** | 🟢 POLISH FUTURO | Export PDF v1 minimalista. Candidatas de v2: mapas Mapbox Static, fotos Foursquare, i18n template, Storage con RLS, export desde `/emilia/profile`. Evaluar por ítem con usuarios reales. |
| **D28** | 🟢 BAJA | `itineraryPdfTemplate.ts` — labels hardcoded en español. Candidato al mismo PR que i18n de `ItineraryPanel.tsx`. |
| **D29** | 🟡 MEDIA | Bucket `documents` sin tenant isolation RLS. PDFs de itinerario no se guardan en Storage hasta crear bucket `itinerary-pdfs` con `agency_id`-scoped RLS. |

**D25 cerrado (22-Abr-2026). D24 (migration leads) es el único ítem operacional pendiente para cerrar el roadmap sin asteriscos. Todo lo demás es polish o roadmap futuro.**

### 5.bis — Dead code consolidado

Ninguno conocido. PR 5 agregó funcionalidad, no purgó. PR 4 completó la purga. Si aparece algo durante el fix de D26 o una PR futura, documentar aquí.

---

## 6. Reglas de proceso aprendidas (acumulativas)

### Heredadas 1-21 (de handoffs pre-PR-3)

1. Separar planificación de ejecución. Paso 0 / Paso 1 / Paso 2 con hard stops.
2. Checkpoints explícitos en operaciones destructivas.
3. Nada de `supabase db push` sin checklist + OK humano.
4. Nada de archivos untracked importantes entre sesiones.
5. Tests "perdidos" no son ignorables.
6. "Esto no cambia comportamiento" hay que demostrarlo, no afirmarlo.
7. Manual approval (no bypass) en operaciones que tocan motor compartido o prod.
8. Discrepancias entre prompt y realidad del repo: PARAR siempre (Regla A).
9a/9b. Credenciales nunca por chat ni inline en comandos Bash.
10. Claude Code puede loguear env vars inline en output Bash — verificar.
11. Timeout en `db push` no es necesariamente lock contention.
12. Workaround: `psql --single-transaction` + `SET LOCAL statement_timeout`.
13. Preflight empírico antes de operaciones costosas.
14. `pg_dump` contra Supabase Cloud → Session pooler.
15. Tests RLS contra local requieren 3 variables, no sólo `SERVICE_ROLE_KEY`.
16. Cambio de contrato de función → verificar TODOS los call sites (Regla 16).
17. Tradeoffs marginales se documentan en el PR aunque sean aceptables.
18. El patrón Paso 0 (read-only) + Paso 1 (plan en prosa) + Paso 2 (ejecución por commit) escala a PRs grandes.
19. Cinco reglas operacionales en ambigüedad: A (parar en duda), B (ningún commit fuera de lista), C (smoke es smoke, no razonamiento), D (actuar dentro del espíritu de instrucciones previas), E (micro-decisiones cosméticas documentadas).
20. Cambios empíricos requieren validación empírica.
21. Re-smokear cuando un path nuevo entra bajo `UnifiedLayout`.

### Heredadas 22-24 (de PR 3)

22. El "no-op separado" como patrón de cambio de contrato. Cuando se extiende la firma de una función central, dividir: (a) param opcional como no-op con test de equivalencia; (b) implementar comportamiento. Auditabilidad + rollback granular.
23. Reversión parcial de un ADR se documenta como addendum + commit explícito, con (a) supuesto falso, (b) diagnóstico empírico, (c) nueva regla, (d) consecuencias, (e) invariantes nuevas.
24. La adaptación de tests `.skip` es válida cuando el contrato cambió. No hay que reactivar el texto literal si ese contrato ya no existe. Documentar en el commit que es cierre por re-escritura.

### Heredadas 25-28 (de PR 4)

25. Antes de borrar un módulo, `git grep` de todos sus exports contra el resto del repo. Si aparece un caller fuera del módulo a borrar, investigar antes de proceder. El grep audit es el preflight de todo cleanup agresivo.
26. Borrar el código de una edge function del repo no la dropea de Supabase. `supabase functions delete <nombre> --project-ref <ref>` es un paso manual separado, post-merge, con monitoreo de logs antes de ejecutar. Nota: `--linked` no es un flag válido para `functions delete`; usar `--project-ref` con el valor de `supabase/config.toml::project_id`.
27. El commit de cleanup debe documentar qué se borró + qué evidencia demostró que era seguro borrarlo. "Se borró X" no es suficiente sin el "porque no había callers en Y".
28. El inventario §5.bis (dead code) en el handoff previo es la lista de trabajo del Paso 0 de la PR de purga. Si §5.bis del handoff anterior y el estado real del repo no coinciden, PARAR y reconciliar antes de commitear borrados.

### Nuevas de PR 5

**29. Sub-agents en paralelo para auditoría funcionan para PRs con fase de audit extendida.** El Paso 0 de PR 5 lanzó 6 sub-agents en paralelo (estado de archivos, deps, tests baseline, build, TSC, estructura) y sintetizó en el hilo principal. El Paso 1 usó los findings para construir un plan sin re-leer los archivos en el hilo principal. Reutilizable para cualquier PR donde el estado del repo requiere leer múltiples dominios antes de decidir.

**30. Los hooks de React son un punto ciego de los tests unitarios cuando el test suite cubre solo funciones puras.** Un `useMemo` mal ubicado no lanza error hasta el render real con una transición de estado. Mitigación: toda PR que toque condicionales de render en un componente existente (early returns, `if/switch` antes de hooks) requiere al menos un test de rerender con RTL que transite el estado antes/después del condicional.

**31. Addendum al plan post-Paso-1 es válido para gaps técnicos sin cambiar decisiones de producto.** El reviewer detectó 3 gaps (mecanismo HTML→DOM para html2canvas, estilo de template, XSS) y 2 cierres de criterio (visibilidad exacta del botón, test de bufferedDays) tras aprobar el plan inicial. El Paso 2 arrancó solo después del OK explícito al addendum. Patrón: Paso 1 propone → reviewer hace preguntas técnicas → addendum resuelve → OK → Paso 2. Evita volver a iterar en implementación por supuestos mal cerrados.

**32. El smoke manual no es opcional para paths E2E que requieren browser + auth + AI en secuencia.** Los Paths 2/3/4 de PR 5 se verificaron via unit tests, CSS e inspección de código. El Path 1 (browser real, login, mensaje al AI, transición de estado) fue el único que encontró el crash de hooks. Regla: si un path involucra el trío browser+auth+AI, debe correrse en browser real aunque los otros tests pasen.

**33. Clasificación A/B/C como herramienta de audit read-only pre-merge cuando una PR previa declaró "stack purgado".** Cuando aparece en el smoke una feature que debería haber sido purgada (o es ambigua), auditarla vía grep antes de decidir si bloquea el merge. A = flujo legítimo preexistente; B = vestigio del stack purgado; C = reintroducido post-purga. PR 5 aplicó esto al botón "Generar card en CRM" (resultado: A). Reutilizable para cualquier cleanup agresivo donde puede quedar ambigüedad sobre si algo sobrevivió.

---

## 7. Checklists operacionales post-merge (heredados de D13 — PR 4)

### D25 — Eliminar edge function `planner-agent` de Supabase ✅ CERRADA 22-Abr-2026

```bash
supabase functions delete planner-agent --project-ref ujigyazketblwlzcomve
```

Ejecutado el 22-Abr-2026. Confirmado: función ausente en `supabase functions list`. Último evento en Supabase Dashboard: 18-Abr-2026 (4 días de silencio post-merge de PR 4). D25 marcada ✅ en `TECH_DEBT.md`.

### D24 — Aplicar migration de reverso a prod (PENDIENTE)

```bash
# Migration: supabase/migrations/20260418000001_revert_b2c_handoff.sql
# Pre-check obligatorio:
SELECT count(*) FROM public.leads WHERE agency_id IS NULL;
# Si count > 0: investigar antes de proceder (constraint NOT NULL va a fallar)
# Si count = 0: proceder
supabase db push --project-ref ujigyazketblwlzcomve
```

**Ejecutar en ventana lunes-jueves horario laboral, con backup manual previo (policy D12).** Cuando se ejecute, marcar D24 como cerrado en `TECH_DEBT.md`.

---

## 8. Qué sigue

**No hay "próxima PR" definida del roadmap de unificación porque el roadmap está cerrado.**

La próxima sesión con Claude arranca con una conversación de planificación sobre qué ítem del "Roadmap futuro" de §2 priorizar. Los criterios para elegir:

- **Costo estimado:** D26 (theme toggle) es una PR chica de 1-2 commits. D27 (PDF v2) depende del scope elegido. CRM handoff y capa social son semanas.
- **Impacto en usuarios:** D26 afecta UX de todos los consumers. D27 afecta solo consumers que usaron el PDF y quieren más. Capa social es una feature nueva.
- **Bloqueos vs habilitadores:** D25 (Storage RLS) bloquea la persistencia del PDF (D27 parcial). D17 (i18n UnifiedLayout) bloquea fully i18n-aware experience. D26 no bloquea nada pero tiene alta visibilidad.
- **Deuda técnica operacional primero:** D24 (§7) no requiere desarrollo, solo operación manual. Ejecutarlo al inicio de la próxima sesión si no se hizo antes. D25 ya está cerrado.

---

## 9. Primeros pasos en la próxima sesión

La próxima sesión NO arranca con "PR siguiente del roadmap" sino con una conversación de planificación. Pasos sugeridos al inicio:

1. Verificar estado del repo:
   - `git checkout main && git pull --ff-only`
   - `git log --oneline -5` debe mostrar `38e4c4db` arriba.
   - `npm test -- --run` → **311 / 11 / 0**.
   - `npm run build` y `npx tsc --noEmit` limpios.
   - Working tree limpio (untracked: `docs/handoffs/`, `docs/propuestas/`).

2. Si D24 no se ejecutó: ejecutarlo primero (ver §7). D25 ya está cerrado (22-Abr-2026).

3. Elegir el próximo ítem del roadmap futuro (§2) con criterios de §8. D26 es el candidato más natural por ser chico y de alto impacto visual.

4. Cualquier PR futura sigue el patrón: Paso 0 (read-only) → Paso 1 (plan en prosa con OK explícito) → Paso 2 (ejecución commit a commit).

---

## 10. Archivos clave para orientarse

**Documentos del proyecto:**
- `docs/adr/ADR-002-chat-unification.md` — decisión arquitectónica + addendum C7.1.e. Lectura obligatoria antes de cualquier PR que toque el motor.
- `docs/prs/pr5-pdf-export.md` — description completa de PR 5, incluyendo 8 decisions, 3 addendum decisions, commits, smoke results, D26/D27/CRM audit.
- `docs/prs/pr4-cleanup.md` — inventario de la purga post-unificación.
- `docs/prs/pr3-chat-unification.md` — inventario de PR 3 (chat switch, mode_bridge, C7.1.e).
- `docs/B2C_STATUS.md` — estado del producto, capacidades en prod, baseline de tests, historial de fases.
- `TECH_DEBT.md` — registry de deuda técnica con D1-D29 al 22-Abr-2026.
- `docs/handoffs/Handoff___Emilia_B2C__post_PR-5__roadmap_cerrado.md` — este documento.
- `docs/handoffs/Handoff___Emilia_B2C__post_PR-3__pre_PR-4.md` — handoff anterior de referencia para estructura y reglas acumuladas.

**Código del export PDF (nuevo en PR 5):**
- `src/services/pdf/itineraryPdfTemplate.ts` — template HTML + `canExportPdf` + `escapeHtml` (XSS guard).
- `src/services/pdf/itineraryPdfGenerator.ts` — pipeline branding → HTML → blob → download.
- `src/services/pdf/__tests__/itineraryPdfTemplate.test.ts` — 16 tests del template.
- `src/features/chat/components/__tests__/ItineraryPanel.test.tsx` — 3 tests de hooks-order (RTL).
- `src/test/setup.ts` — setup global de `@testing-library/jest-dom`.

**B2C UI (post-PR-4, sin cambios en PR 5 salvo ItineraryPanel):**
- `src/pages/EmiliaChatPage.tsx` — entry point B2C (renombrada de CompanionChatPage en PR 4).
- `src/features/chat/components/ItineraryPanel.tsx` — panel derecho con botón "Descargar itinerario".
- `src/features/chat/ChatFeature.tsx` — `handleExportItineraryPdf` + wiring en ambos modos.

**Motor (compartido B2B/B2C, no tocar sin PR propio):**
- `src/features/trip-planner/services/tripService.ts`
- `src/features/trip-planner/hooks/usePlannerState.ts`
- `src/hooks/useChat.ts`

**Layout y guards:**
- `src/components/layouts/UnifiedLayout.tsx` — layout único, prop `rightPanel` (320px en `lg:`).
- `src/features/chat/components/ChatHeader.tsx` — contiene `ThemeToggle` agrupado con chrome agent (D26).

---

## 11. Notas operacionales

- **`docs/handoffs/` y `docs/propuestas/` siguen untracked por convención.** Este archivo se queda en disco para que el usuario lo suba a la próxima sesión. No commitear.
- **Credenciales filtradas en sesión de D12 (service role key y DB password de Vibook).** Quedaron en el historial del chat de esa sesión. El usuario decidió no rotarlas. Si se exporta o comparte ese chat, datos sensibles.
- **Backup `~/backups/backup_pre_1.1.a_20260409_203300.sql`:** 2.38 GB en disco activo. Pendiente archivar offline.
- **`feature/maxun-icaro-provider`** — branch local WIP del usuario. No tocar.
- **D25 (delete edge function)** — ✅ cerrado el 22-Abr-2026. `supabase functions delete planner-agent --project-ref ujigyazketblwlzcomve`. Nota: `--linked` no es flag válido para `functions delete`.
- **D24 (migration leads)** — pendiente. Pre-check `SELECT count(*) FROM public.leads WHERE agency_id IS NULL` antes de `supabase db push --project-ref ujigyazketblwlzcomve`. Si count > 0, investigar.
- **RTL + jsdom ahora como devDeps.** `src/features/chat/components/__tests__/` es el primer directorio de tests de componentes React del proyecto. Futuras PRs que toquen componentes con early returns pueden agregar sus tests aquí siguiendo el mismo patrón de `ItineraryPanel.test.tsx`.
- **`vite.config.ts::test.include`:** la allowlist incluye ahora `src/features/chat/components/__tests__/*.test.tsx`. Si en PRs futuras aparecen tests `.tsx` en otros directorios, agregar el glob correspondiente.
