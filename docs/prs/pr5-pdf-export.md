# PR 5 — Export de itinerario a PDF

**Branch:** `feat/pr5-pdf-export-itinerary`
**Base:** `main`
**Fecha:** 22 Abril 2026

---

## Scope

Implementa la descarga del itinerario planificado como PDF directamente desde el panel lateral del chat. El export es on-demand (botón en footer del `ItineraryPanel`), produce un blob local sin pasar por servidor y usa el sistema de PDFs custom existente (html2canvas + jsPDF), no PDFMonkey.

**No incluye:** Supabase Storage (diferido — D25), i18n del template (diferido — D24).

---

## Decisions (Paso 1 — Plan)

### D1 — Motor de PDF: sistema custom vs PDFMonkey
**Decisión:** html2canvas + jsPDF (`customPdfGenerator.ts`).
**Por qué:** El sistema custom ya probado en producción. PDFMonkey implica round-trip a servidor, latencia, y el endpoint de itinerario no existe. El consumidor B2C quiere descarga inmediata.

### D2 — Template HTML: nuevo archivo vs reutilizar customPdfTemplates
**Decisión:** Archivo nuevo `itineraryPdfTemplate.ts`. Reutiliza las helpers de `customPdfTemplates.ts` (`pageOpen`, `pageClose`, `wrapHtmlDocument`, `renderCustomHeader`, `renderCustomFooter`) exportándolas.
**Por qué:** El template de cotizaciones (`customPdfTemplates.ts`) tiene estructura fija para quotes B2B. El itinerario requiere estructura day-by-day completamente distinta. Un archivo nuevo mantiene la separación de concerns.

### D3 — Branding: qué datos usar y desde dónde
**Decisión:** `fetchAgencyBranding(agencyId)` (exportada desde `pdfMonkey.ts`). En consumer context: `user?.agency_id ?? undefined` desde `useAuth()` en `ChatFeature.tsx`.
**Por qué:** `fetchAgencyBranding` ya existe y retorna el set completo de campos de branding. El consumer B2C pertenece a la agencia del tenant; pasar `agencyId` preserva el branding multi-tenant.

### D4 — Visibility: cuándo mostrar el botón de descarga
**Decisión:** `canExportPdf(plannerState)` — predicado puro que requiere: (1) state no nulo, (2) no `isDraft`, (3) segmentos no vacíos, (4) al menos un segmento con `days.length > 0`.
**Por qué:** El botón no debe aparecer mientras el itinerario se está construyendo (isDraft) ni cuando solo hay metadatos sin días generados. Predicate puro → 100% testeable sin mocks.

### D5 — Estructura del PDF: layout de páginas
**Decisión:** Página de resumen (título, ruta origen→destinos, fechas, viajeros, presupuesto, ritmo) + páginas day-by-day agrupadas en chunks de 3 días por página A4.
**Por qué:** Density óptima para A4 con el motor html2canvas (scale:2). Menos de 3 días/página → PDF demasiado largo. Más de 3 → texto muy pequeño o overflow.

### D6 — Descarga: blob local vs Supabase Storage
**Decisión:** On-demand blob download (`URL.createObjectURL` + `<a download>` + `revokeObjectURL`).
**Por qué:** El bucket `documents` no tiene tenant isolation a nivel RLS (D25). Guardar en Storage sin isolation RLS expone PDFs de un consumer a otro. Diferido hasta que se cree un bucket `itineraries` con `owner_user_id`-scoped RLS.

### D7 — Estado `TripPlannerState`: inmutable (Nivel 3)
**Decisión:** El tipo no se modifica. El template consume los campos existentes read-only.
**Por qué:** Modificar `TripPlannerState` requeriría auditar todos sus call sites (estado central del sistema de planificación). El template puede construir todo lo que necesita a partir del estado actual.

### D8 — Wiring en ChatFeature: dónde anclar el callback
**Decisión:** `handleExportItineraryPdf` como `useCallback` en `ChatFeature.tsx`, pasado como `onExportPdf` a ambos usos de `ItineraryPanel` (companion mode ~línea 760 y passenger mode ~línea 817).
**Por qué:** `ChatFeature` ya tiene acceso a `planner.plannerState` y `user?.agency_id`. Centralizar el callback ahí evita prop drilling adicional y mantiene la lógica async fuera del componente de presentación.

---

## Addendum Decisions (Paso 1b — Gaps técnicos)

### A1 — XSS: campos AI-generados requieren escape
**Decisión:** `escapeHtml(s)` privado aplicado a todos los campos que provienen de IA o del usuario antes de interpolación en template literals HTML.
**Por qué:** `state.origin` y `state.destinations[]` pueden originarse en extracción de texto libre del consumer por la IA (e.g., el usuario escribió "Quiero ir a <script>..." y el parser extrajo ese string). El escape es mitigación necesaria, no defense-in-depth. Ver Security Considerations.

### A2 — `canExportPdf`: definición exacta del criterio 4
**Decisión:** `state.segments.some(s => s.days && s.days.length > 0)`. Una sección `days` con al menos un elemento es suficiente para que el template tenga contenido que renderizar.
**Por qué:** Consistent con el predicado de visibilidad — no tiene sentido exportar un PDF con solo la página de resumen y ningún día.

### A3 — Split de commits: 3a refactor exports + 3b template
**Decisión:** Commit `4a323032` exporta helpers de `customPdfTemplates.ts` y `renderHtmlToPdfBlob` de `customPdfGenerator.ts`. Commit `deef4c4d` crea el template + tests.
**Por qué:** El split permite auditar los cambios de exports (Regla 16) separadamente del template nuevo. Cada commit compila y es revertible de forma independiente.

---

## Baselines

| Métrica | Pre-PR5 (post-PR4) | Post-PR5 |
|---------|-------------------|----------|
| Tests passed | 292 | 308 |
| Tests skipped | 11 | 11 |
| Tests failed | 0 | 0 |
| TypeScript | sin errores | sin errores |
| Build | limpio | limpio |

**+16 tests nuevos:** 5 `canExportPdf` + 11 `renderItineraryHtml` (incluye XSS guard, flexible dates, bufferedDays isolation).

---

## Commits

| # | Hash | Mensaje |
|---|------|---------|
| 1 | `1eec59a5` | `chore(deps): add jspdf and html2canvas as direct dependencies` |
| 2 | `4a323032` | `refactor(pdf): export renderHtmlToPdfBlob, wrapHtmlDocument, pageOpen, pageClose` |
| 3 | `8d0fc09d` | `refactor(pdf): export fetchAgencyBranding from pdfMonkey` |
| 4 | `b7212533` | `feat(pdf): add itinerary PDF generator with on-demand download` |
| 5 | `deef4c4d` | `feat(pdf): add itinerary PDF template, canExportPdf, escapeHtml, and unit tests` |
| 6 | `63ca077a` | `feat(chat): wire export-PDF action in ItineraryPanel and ChatFeature` |
| 7 | `d8a3e5fb` | `docs: update B2C_STATUS and TECH_DEBT for PR 5` |

---

## Security Considerations

### XSS en campos AI-generados (Nota 2)

`state.origin` y `state.destinations[]` pueden provenir de extracción de texto libre del consumer por el parser de IA (`ai-message-parser`). Si el usuario escribió texto que contiene HTML (e.g., `<script>alert('x')</script>`), el campo extraído puede contener ese string literal.

El template HTML se inyecta vía `innerHTML` en un nodo DOM off-screen para que html2canvas lo capture. Sin escape, un campo con HTML incrustado sería interpretado por el browser como markup real, pudiendo ejecutar scripts en el contexto de la aplicación.

**Mitigación:** `escapeHtml()` se aplica a **todos** los campos de origen AI o usuario antes de interpolación:
- `state.origin`
- `state.destinations[]`
- `segment.city`, `segment.country`
- `day.title`, `activity.title` (todos los slots: morning/afternoon/evening/restaurants)

`escapeHtml` escapa: `&`, `<`, `>`, `"`, `'` → `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`.

Test dedicado: `'escapes XSS in activity titles'` en `itineraryPdfTemplate.test.ts`.

---

## Regla 16 — Auditoría de call sites

5 funciones previamente privadas fueron exportadas. Se verificó que cada una es context-free (pure / sin side effects que dependan de estado de módulo) y que no hay call sites existentes afectados por el cambio de visibilidad.

| Función exportada | Archivo | Call sites pre-PR5 | Resultado |
|---|---|---|---|
| `renderHtmlToPdfBlob` | `customPdfGenerator.ts` | 0 externos | OK — nueva función pública |
| `wrapHtmlDocument` | `customPdfTemplates.ts` | 0 externos | OK |
| `pageOpen` | `customPdfTemplates.ts` | 0 externos | OK |
| `pageClose` | `customPdfTemplates.ts` | 0 externos | OK |
| `fetchAgencyBranding` | `pdfMonkey.ts` | 0 externos | OK — ya era async pura |

Ninguna exportación rompe contratos existentes. Nota incluida en commit `4a323032` (refactor exports) y `8d0fc09d`.

---

## Inherited Restrictions

| Restricción | Origen | Estado |
|---|---|---|
| No modificar `TripPlannerState` | ADR-002, Nivel 3 — tipo compartido B2B/B2C | Se respeta — template consume read-only |
| No usar Supabase Storage (bucket `documents`) | D25 — falta tenant isolation RLS | Se respeta — blob local on-demand |
| No PDFMonkey para itinerario consumer | Decisión Paso 1 | Se respeta — html2canvas + jsPDF |
| No i18n del template en v1 | D24 — diferido | Se respeta — labels hardcoded en español |
| No hardcodear listas de categorías | CATEGORY_POLICY invariant | No aplica — no toca places |
| RLS mandatory, sin service_role bypass | Multi-tenant invariant | No aplica — no toca DB directamente |

---

## Tech Debt Registrado

| ID | Descripción | Archivo |
|----|-------------|---------|
| D24 | `itineraryPdfTemplate.ts` — labels hardcoded en español (Destino, Fechas, etc.). Candidato a i18n cuando se internacionalice el resto del UI consumer. | `TECH_DEBT.md` |
| D25 | Bucket `documents` carece de tenant isolation en RLS — PDFs de itinerario no deben guardarse ahí hasta crear bucket `itineraries` con `owner_user_id`-scoped RLS. | `TECH_DEBT.md` |

---

## Smoke Results

| Path | Resultado | Observaciones |
|------|-----------|---------------|
| **Path 1** — Desktop companion: botón visible + PDF correcto | ⚠️ Pendiente verificación humana | Bug bloqueante detectado y corregido (ver addendum). Path 1 debe re-correrse post-fix. |
| **Path 2** — `canExportPdf` gate: sin segmentos/isDraft → sin botón | ✅ | Verificado vía 5 unit tests + revisión del guard `onExportPdf && canExportPdf(plannerState)` en `ItineraryPanel.tsx`. |
| **Path 3** — Mobile: panel no visible → botón no visible | ✅ | `UnifiedLayout` renderiza `rightPanel` en `aside` con `hidden lg:block`. El panel no se monta en mobile; el botón tampoco aparece. |
| **Path 4** — Agent passenger mode: botón también disponible | ✅ | Ambos usos de `ItineraryPanel` en `ChatFeature.tsx` tienen `onExportPdf={handleExportItineraryPdf}`. |

**Path 1 — instrucciones para verificación manual:**
1. `npm run dev` → `/emilia/chat`
2. Iniciar itinerario completo (ej: "Quiero Italia 7 días, Roma y Florencia")
3. Esperar que el panel derecho muestre ciudades y días generados
4. Verificar que el botón "Descargar itinerario" aparece en el footer del panel
5. Clic → spinner "Generando PDF…" → diálogo de descarga del browser
6. Abrir PDF: verificar ciudades, títulos de días, actividades, branding de la agencia, sin texto "undefined" o "null"

---

## Addendum post-review (commits F + T)

### Bug detectado en Path 1

**Runtime crash:** `Uncaught Error: Rendered more hooks than during the previous render` al transicionar `plannerState` de `null` a poblado.

**Causa raíz:** Dos `useMemo` (filtro de `destinations`, filtro de `segmentsWithCity`) declarados después del early return `if (!shouldRender || !plannerState) return null;` en `ItineraryPanel.tsx`. Primera render con `plannerState=null` registraba 2 hooks (useState + useCallback); siguiente render registraba 4. React pierde el tracking por posición → crash.

**Por qué no fue detectado antes de Path 1:** Los tests del Paso 1 Fase B (template) son de funciones puras. Los Paths 2/3/4 verificaron via unit tests, CSS, e inspección de código — ninguno ejecutó render real del componente en un DOM. Solo el smoke manual de Path 1 iba a montarlo con una transición de estado real.

### Fix — Commit F (`c852dd75`)

`fix(chat): hoist useMemo above early return in ItineraryPanel`

Ambos `useMemo` hoistados arriba del early return. Deps con optional chaining (`plannerState?.destinations`, `plannerState?.segments`) — producen `[]` cuando `plannerState` es null, sin errores.

**Regla 26 aplicada:** barrido de `ItineraryPanel.tsx` (completo), `ChatFeature.tsx` (zonas PR 5), `itineraryPdfGenerator.ts`, `itineraryPdfTemplate.ts`. Sin hallazgos adicionales.

### Infra de testing + test de regresión — Commit T (`472fa664`)

`test(chat): add React Testing Library infra and ItineraryPanel hooks-order regression test`

**devDependencies añadidas:** `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

**Scope:** `// @vitest-environment jsdom` como primera línea del test file — los 308 tests previos siguen con el environment default sin cambio de comportamiento.

**Setup:** `src/test/setup.ts` con `import '@testing-library/jest-dom/vitest'` — referenciado en `vite.config.ts::test.setupFiles`.

**Test:** `src/features/chat/components/__tests__/ItineraryPanel.test.tsx` — 3 casos que cubren las 3 transiciones del bug:
- `null → populated` (el caso exacto del crash)
- `populated → null`
- `populated → populated (shape distinto)`

Cada caso hace `rerender` — si hay violación de hooks, lanza sincrónicamente con mensaje claro.

### Baseline final

| | Post-Paso2 | Post-commit F | Post-commit T |
|---|---|---|---|
| Tests passed | 308 | 308 | **311** |
| Tests skipped | 11 | 11 | 11 |
| Tests failed | 0 | 0 | 0 |
| TypeScript | limpio | limpio | limpio |
| Build | limpio | limpio | limpio |

---

## Roadmap Closure

PR 5 cierra formalmente el roadmap ADR-002 + addendum C7.1.e:

| PR | Estado |
|----|--------|
| PR 1 (ADR + scaffolding) | ✅ mergeada |
| PR 2 (routing unification, UnifiedLayout) | ✅ mergeada `4ce93f67` |
| PR 3 (chat switch, mode_bridge) | ✅ mergeada `d82ac244` |
| PR 4 (purga post-unificación) | ✅ mergeada |
| PR 5 (export PDF itinerario) | ✅ esta PR |

Las fases previas (0 → Paso 4 + Fase 1.2) quedan como baseline de ejecución. Pendientes diferidos: D24 (i18n template), D25 (bucket con RLS), mobile drawer, D17 (i18n UnifiedLayout avatar menu).
