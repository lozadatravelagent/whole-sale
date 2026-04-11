# PR: Paso 3 — Panel de itinerario vivo (read-only sidebar B2C)

## Scope

Cierra el Paso 3 del roadmap macro post-Paso 2: un `ItineraryPanel` read-only en el companion chat que muestra el viaje construyéndose en tiempo real a la derecha del chat. Destino, fechas, viajeros, itinerario por segments, estilo, presupuesto y notas se refrescan automáticamente cuando el planner agent actualiza el `plannerState`. Sidebar visible ≥1024px (`lg`+) con panel de 320px fijo; en viewports menores colapsa y el companion chat sigue como hoy.

**Read-only**: sin edit inline. El editing sigue siendo vía chat con Emilia. Única acción interactiva: botón opcional "¿Querés ajustar algo?" que pre-llena el input del chat con `"Quiero ajustar mi viaje: "`. El motor compartido (`tripService`, `usePlannerState`, `useTripPlanner`, `useMessageHandler`, `conversationOrchestrator`, `planner-agent`) queda intacto.

## Problema que resuelve

Post-Paso 2, Emilia B2C es funcional de extremo a extremo:
- Fase 1.1 cerró el motor de persistencia (`trips` es SoT).
- Paso 1 separó la UI/routing B2B↔B2C (`/emilia/*` + `CompanionLayout` + `ChatSidebarCompanion`).
- Paso 2 cerró el camino comercial con el modal de derivación humana.

Lo que faltaba es **la sensación de construcción real** — la sección 4 del doc `Emilia_B2C`. Todo el trabajo que hace Emilia (destinos, fechas, segments, travelers, estilo, presupuesto, notas) vive dentro del `plannerState`, pero el consumer no lo ve directamente mientras chatea. Solo aparece cuando Emilia lo menciona en los mensajes del assistant. Sin un panel visual, la experiencia es "chat con un bot listo" en vez de "compañero de viaje construyendo algo juntos".

Antes de esta PR:
- No hay superficie visual que muestre el plannerState en el companion chat.
- `TripPlannerWorkspace` existe pero es un componente B2B pesado acoplado a editor de itinerario, drag reorder, inventario, PDF export — inapropiado para companion read-only.
- `useTripPlanner` ya alimenta `ChatFeature` con `plannerState` reactivo, pero nadie lo renderiza fuera del flow B2B.

## Que cambia

### `src/features/companion/utils/hasItineraryContent.ts` (nuevo)

Función pura `hasItineraryContent(state: TripPlannerState | null | undefined): boolean`. Devuelve `true` si al menos uno de:

- `destinations` con al menos un string no vacío
- `segments` con al menos uno que tenga `city` no vacío
- `startDate` o `endDate` truthy
- `isFlexibleDates === true`
- `notes` con al menos una entrada no vacía
- `budgetLevel` o `pace` set

Permissive: **cualquier señal** de Emilia es suficiente para mostrar el panel. Los bloques individuales del panel siguen siendo condicionales por su propio campo.

### `src/features/companion/components/ItineraryPanel.tsx` (nuevo)

Componente React purely presentational, read-only, con `React.memo` para evitar re-renders innecesarios durante streaming del plannerState.

**Props**:
```ts
interface ItineraryPanelProps {
  plannerState: TripPlannerState | null;
  onRequestChanges?: () => void; // botón opcional "Pedir cambios"
  className?: string;
}
```

**Early return**: si `hasItineraryContent(plannerState)` devuelve `false`, retorna `null` — el contenedor padre colapsa via `flex`.

**Header sticky**:
- Icono `Sparkles` + título "Tu viaje"
- Subtitle dinámico:
  - "Construyéndose…" con spinner `Loader2` si `generationMeta.isDraft === true` o `uiPhase !== 'ready'`
  - Destino principal (`formatDestinationLabel(destinations[0])`) si ya está listo
  - "En progreso" como fallback

**Bloques condicionales** (usando componente helper `<Block>` interno con icon + label + children):

1. **Destino** (`MapPin`) — solo si `destinations.length > 0`. Destino principal destacado + resto como `Badge` chips.
2. **Fechas** (`Calendar`) — solo si hay dates concretas (`startDate + endDate`) o `isFlexibleDates`. Usa `formatDateRange` o `formatFlexibleMonth`.
3. **Viajeros** (`Users`) — solo si `adults + children + infants > 0`. Texto "2 adultos · 1 menor" construido en una helper `formatTravelersText` local.
4. **Itinerario** (`Route`) — solo si `segments` tiene al menos uno con city. Lista vertical con `formatDestinationLabel(city)` a la izquierda y "N noches" a la derecha (usa `segment.nights ?? segment.days.length`).
5. **Estilo de viaje** (`Sparkles`) — solo si `pace` está set. Badge con `formatPaceLabel`. Label del bloque dice "Estilo de viaje" (corresponde al `travelStyle` del prompt del usuario, que conceptualmente es `pace` en el schema — no existe un campo `travelStyle` separado en `TripPlannerState`).
6. **Presupuesto** (`DollarSign`) — solo si `budgetLevel` set. Badge con `formatBudgetLevel`.
7. **Notas** (`FileText`) — solo si `notes` tiene al menos una entrada no vacía. Text blocks apilados.

**Footer opcional**: si `onRequestChanges` está set, renderiza separator + botón full-width "¿Querés ajustar algo?".

Todo usa shadcn primitives (`Badge`, `Button`, `Separator`) y iconos `lucide-react`. Reutiliza 100% los formatters existentes de `src/features/trip-planner/utils.ts` — no duplica lógica de formateo.

### `src/features/chat/ChatFeature.tsx` (modificado)

Solo en el branch `mode === 'companion'`, ~20 líneas agregadas:

- Nuevo import: `ItineraryPanel` from `@/features/companion/components/ItineraryPanel`.
- Nuevo handler:
  ```ts
  const handleRequestItineraryChanges = useCallback(() => {
    setMessage('Quiero ajustar mi viaje: ');
  }, [setMessage]);
  ```
- Nueva 3ra columna dentro del `<div className="flex h-full">` del companion render, como sibling de la columna central (después de la columna del chat):
  ```tsx
  <div className="hidden lg:block w-80 flex-shrink-0">
    <ItineraryPanel
      plannerState={planner.plannerState}
      onRequestChanges={handleRequestItineraryChanges}
    />
  </div>
  ```

**Responsive**: `hidden lg:block` oculta el panel en viewports `<1024px`. En mobile/tablet, el chat ocupa todo el ancho como antes. Sin cambios al sidebar izquierdo ni al HandoffBanner.

**No toca el B2B render path**. No toca props existentes. Ningún handler motor se altera. El `useTripPlanner` ya alimentaba `planner.plannerState` — solo hay un nuevo consumer del mismo state.

## Que NO se toco

- **Motor compartido**: `tripService`, `usePlannerState`, `useTripPlanner`, `useMessageHandler`, `conversationOrchestrator`, `planner-agent/`, `useChatState`. Nada.
- **`CompanionLayout.tsx`**: sigue con slot único `children`. Intocado.
- **`ChatSidebarCompanion.tsx`**: intocado.
- **`ChatSidebar.tsx` (B2B)**, rutas B2B, `MainLayout`, pages B2B — intactos.
- **`TripPlannerWorkspace.tsx`, `TripSpecsBar.tsx` y demás componentes B2B del trip-planner** — no se tocan ni se reutilizan directamente. Solo se importan formatters puros de `src/features/trip-planner/utils.ts`.
- **Paso 2**: `HandoffBanner`, `HandoffModal`, `handoffService`, `handoffFormSchema`, `handoffReadiness`, `isTripReadyForHandoff` — todos intactos. El banner sigue apareciendo en la columna central (footer) y el modal sigue abriendo desde ahí.
- **`src/features/trip-planner/utils.ts`** — solo lectura de `formatDestinationLabel`, `formatDateRange`, `formatFlexibleMonth`, `formatBudgetLevel`, `formatPaceLabel`. No se modifica.
- **`Role` type**, RLS policies, schema DB — intactos.
- **`vite.config.ts`**: no se modifica. El path `src/features/companion/__tests__/*.test.ts` ya estaba incluido desde Paso 2.

## Funciones/utilities reutilizadas

- `formatDestinationLabel` — `src/features/trip-planner/utils.ts:1148` — title case de nombres de ciudades.
- `formatDateRange` — `utils.ts:1167` — "10 mar - 15 mar" para dates concretas.
- `formatFlexibleMonth` — `utils.ts:1174` — "Flexible en julio de 2026" para dates flexibles.
- `formatBudgetLevel` — `utils.ts:1107` — "Bajo" / "Medio" / "Alto" / "Lujo".
- `formatPaceLabel` — `utils.ts:1122` — "Relajado" / "Equilibrado" / "Intenso".
- `TripPlannerState` type — `src/features/trip-planner/types.ts:281`.
- shadcn primitives: `Badge`, `Button`, `Separator`.
- Lucide icons: `MapPin`, `Calendar`, `Users`, `DollarSign`, `Sparkles`, `Route`, `FileText`, `Loader2`.
- `cn()` utility — `src/lib/utils.ts`.

## Tests

### 11 unit tests nuevos en 1 archivo

**`src/features/companion/__tests__/hasItineraryContent.test.ts`** (11 tests):

- `null` / `undefined` → `false` (2 assertions en 1 test)
- Planner completamente vacío → `false`
- Solo `destinations: ['París']` → `true`
- Whitespace-only destinations → `false` (caso defensivo)
- Solo `segments` con city → `true`
- Solo `startDate` → `true`
- Solo `isFlexibleDates: true` → `true`
- Solo `budgetLevel: 'mid'` → `true`
- Solo `pace: 'relaxed'` → `true`
- Solo `notes: ['alguna nota']` → `true`
- Whitespace-only notes → `false` (caso defensivo)

### Tests NO escritos (scope cut)

- **Tests de render** de `ItineraryPanel` — la infra jsdom + `@testing-library/react` sigue fuera del repo (scope cut consistente con Paso 1/2). El componente es thin sobre la función pura + formatters ya testeados.
- **Tests E2E** del wiring completo en `ChatFeature` companion render — requiere dev env con consumer logueado y plannerState activo. Smoke manual documentado abajo.

### Baseline

- **Pre-PR** (post-#65 merge + types regen): 194 passed / 14 skipped / 2 failed suites (D11)
- **Post-PR**: **205 passed / 14 skipped / 2 failed suites (D11)** — 194 + 11 nuevos
- **Build**: limpio (20.8s)
- **TypeScript**: `tsc --noEmit` exit 0
- **Lint**: sin nuevas warnings en archivos nuevos o modificados

## Verificación ejecutada

- [x] `npm test` → **205 / 14 / 2** ✅
- [x] `npm run build` limpio ✅
- [x] `npx tsc --noEmit` exit 0 ✅
- [x] 11 tests nuevos de `hasItineraryContent` verdes
- [x] 194 tests pre-existentes verdes sin regresión
- [ ] Smoke manual con consumer en `/emilia/chat`:
  1. Abrir `/emilia/chat` sin conversación → panel oculto (porque selectedConversation=null y mobile view)
  2. Viewport ≥1024px, seleccionar conversación sin plannerState → panel no aparece (`hasItineraryContent` devuelve false)
  3. Decirle a Emilia "quiero ir 7 días a Roma en julio con mi pareja" → el panel aparece con los campos poblados y subtitle "Construyéndose…"
  4. Esperar a que `generationMeta.uiPhase === 'ready'` → subtitle cambia al destino principal
  5. Click "¿Querés ajustar algo?" → input pre-llenado con "Quiero ajustar mi viaje: "
  6. Resize a viewport 900px → panel desaparece, chat sigue usable
- [ ] Verificar que Paso 2 sigue funcionando: con viaje completo y ready, el `HandoffBanner` sigue apareciendo correctamente en la columna central (no hay colisión visual con el panel derecho).

## Riesgos

- **R1 — Viewport squeeze en 1024px**: cuando aparece el panel, el chat central queda ~632px (72 sidebar + 632 chat + 320 panel = 1024). Aceptable pero ajustado. **Mitigación**: breakpoint `lg` garantiza mínimo 1024px antes de mostrar el panel.
- **R2 — Panel visible durante draft puede confundir**: el consumer ve data parcial mientras Emilia construye. **Mitigación**: subtitle "Construyéndose…" con spinner explicita el estado. Los bloques condicionales solo muestran campos ya poblados — los vacíos quedan ocultos.
- **R3 — Mobile drawer fuera de scope**: consumers en mobile y tablet no ven el panel. **Mitigación**: follow-up explícito. El chat sigue siendo usable sin panel (pre-PR behavior).
- **R4 — `onRequestChanges` no limpia el input si el user no envía**: si clickean el botón y no mandan el mensaje, queda "Quiero ajustar mi viaje: " en el input. **Mitigación**: aceptable — el consumer lo edita o borra.
- **R5 — Re-render performance durante streaming**: `plannerState` puede cambiar frecuente durante la construcción. **Mitigación**: `React.memo` en `ItineraryPanel` + early return con `hasItineraryContent` — si no hay contenido, no re-renderiza ninguna UI.
- **R6 — Campos nuevos del plannerState no manejados**: el planner_agent puede agregar campos nuevos en el futuro. **Mitigación**: el panel solo renderiza campos explícitamente conocidos — cualquier campo nuevo queda ignorado silenciosamente sin error.
- **R7 — Colisión visual con HandoffBanner**: banner en col 2 (footer, full width de la columna central), panel en col 3 (lateral). Sin conflicto de layout ni z-index.
- **R8 — `travelStyle` vs `pace`**: el prompt del usuario menciona "travelStyle" pero el schema usa `pace`. El panel lo renderiza como `pace` con el label "Estilo de viaje" para mantener la semántica del prompt. Esta decisión está documentada en el comentario del bloque en el código y aquí.

## Follow-ups explícitos

1. **Mobile drawer** — sheet/bottom drawer que muestre el panel en mobile con un FAB de toggle. Requiere diseño UX.
2. **Edit inline** del panel — permitir modificar destinos, fechas, viajeros, etc. directo desde el panel sin pasar por chat. Producto debe decidir qué campos son editables inline vs cuáles deben ir por Emilia.
3. **Acciones contextuales por bloque** — p.ej. botón "Ver en mapa" al lado del destino, botón "Editar fechas" al lado del date range.
4. **Render tests** con `@testing-library/react` + jsdom cuando se instale la infra.
5. **Compact mode** para el panel cuando el itinerario tiene muchos segments (p.ej. >5). Scroll vertical ya funciona, pero se puede mejorar con collapsed state por segment.
6. **Loading skeleton** más elaborado cuando `isDraft === true` — hoy solo hay un spinner en el subtitle. Los bloques se renderizan con lo que hay disponible.
7. **Transiciones suaves** — animar la aparición de bloques cuando cambia el plannerState (framer-motion ya está en el proyecto).

## Commits

1. `feat(companion): add hasItineraryContent predicate + tests`
2. `feat(companion): add ItineraryPanel read-only component`
3. `feat(chat): wire ItineraryPanel into companion render path`
4. `docs(prs): add Paso 3 itinerary panel PR description`

## Dependencias previas

- [Fase 1.1.a — B2C ownership schema](1.1.a-b2c-ownership.md) (merged)
- [Fase 1.1.b — upsertTrip adapter](1.1.b-upsert-trip-adapter.md) (merged)
- [Fase 1.1.c — trips as source of truth](1.1.c-trips-source-of-truth.md) (merged)
- [Fase 1.1.d — persist debounce + flush](1.1.d-persist-debounce.md) (merged)
- [Fase 1.1.e/f/g — B2C trips cleanup](1.1.e-f-g-b2c-trips-cleanup.md) (merged PR #63)
- [Paso 1 — Structural separation](paso1-structural-separation.md) (merged PR #64)
- [Paso 2 — Human handoff modal](paso2-human-handoff-modal.md) (merged PR #65, migration aplicada)

## Next

Pasos 4-5 del roadmap macro:

4. **Registro/perfil consumer** — flujo de signup B2C dedicado con persistencia de perfil (avatar, nombre, preferencias de viaje).
5. **Capa social** — feed de viajes públicos, perfiles compartibles, likes/guardados.

Follow-ups técnicos listados arriba (mobile drawer, edit inline, render tests, etc.).
