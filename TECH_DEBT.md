# Technical Debt Registry

## D10 — Regeneracion de types.ts post-1.1.a ✅ CERRADA

**Cerrada parcial el**: 2026-04-09 (desde local, commit d071411c)
**Cerrada definitiva el**: 2026-04-09

types.ts regenerado desde produccion via `supabase gen types typescript --linked`
y comparado con la version local. Diff de 311 lineas en 3 categorias:

1. **conversations.agency_id/tenant_id nullable** (`string` → `string | null`):
   correccion esperada de 1.1.a. Aceptada.
2. **superadmin_agencies_view FK refs removidas**: la vista no aparece en el
   types regenerado desde prod. Investigacion pendiente (ver D16). Aceptada
   porque no afecta runtime (solo metadata de relaciones de una vista).
3. **Cosmetic**: header `__InternalSupabase` metadata block del CLI. Irrelevante.

types.ts reemplazado con la version de prod. Build y tests verificados sin
regresiones (132/12/2).

## D11 — Vitest localStorage failures ✅ CERRADA

2 suites fallaban por `localStorage is not defined` (`signatures.test.ts`, `structuralMods.test.ts`).
Pre-existentes desde antes de 1.1.a. Ruido en CI que puede camuflar fallos reales. Prioridad baja.

Causa raiz: importan modulos que transitivamente cargan `src/integrations/supabase/client.ts`,
el cual referencia `localStorage` en su config de auth. En entorno Node/Vitest no hay `localStorage`.
Fix: mock de `localStorage` en vitest setup o lazy-init del cliente Supabase.

Cerrada 2026-04-22. No reproduce en los 6 ciclos de test de PR 2 ni en
verificación empírica de hoy: ambas suites passan ✓, cero matches de
'localStorage is not defined' en output verbose. Causa probable: side
effect de refactors de auth/i18n. Reservado: si reaparece en CI o
entorno distinto, reabrir con contexto de donde falla.

## D12 — Push de migrations 1.1.a a produccion ✅ CERRADA

**Checklist ejecutado**:
- [x] Backup de la DB de produccion tomado.
- [x] Drift de migrations resuelto previamente (cerrado por commit 1c91cfb2).
- [x] Ventana de mantenimiento coordinada (aunque la migration sea aditiva).
- [x] Script de verificacion post-push (12 queries) corrido contra prod.
- [x] Plan de rollback documentado (3 niveles: pg_dump restore, SQL manual, dashboard backup).
- [x] Tests RLS de 1.1.a corridos contra prod post-push (9/9 verdes, cleanup verificado).

### Resolucion

- **Fecha**: 2026-04-09
- **Tier de Supabase**: Pro (verificado en dashboard)
- **Backup automatico verificado**: fisico del 9 Apr 2026 04:34 UTC
- **Backup manual pre-push**: pg_dump completo de schema public, 2.38 GB,
  archivado offline por el usuario
- **Migration A** (20260409000001): aplicada via `supabase db push --linked`
  sin incidentes
- **Migration B** (20260409000002): el push CLI murio por statement_timeout
  default de 2min en el rol postgres del session pooler. Aplicada
  manualmente via psql --single-transaction con SET LOCAL
  statement_timeout='10min'. Tiempo real de ejecucion: 6.9 segundos.
  Registrada manualmente en supabase_migrations.schema_migrations.
- **Verificacion post-push**: 12/12 queries verdes (enum CONSUMER, columnas
  trips/users con CHECKs y FKs correctas, 3 RLS policies consumer_*,
  INSERT policy B2B reforzada, sentinel user, invariantes en 0).
- **Tests RLS contra prod**: 9/9 verdes. Cleanup verificado limpio antes y
  despues del run.
- **Aprendizaje para futuras migrations grandes**: usar psql
  --single-transaction con SET LOCAL statement_timeout cuando la migration
  tenga muchas secciones DDL. El default de 2min del CLI no alcanza aunque
  cada statement individual sea trivial.

D13 (politica: prohibido aplicar migrations fuera de git) reforzada.
Migration B fue aplicada via psql pero el contenido SQL provino del archivo
commiteado en PR #60 sin modificaciones. La politica se cumple: el SQL
aplicado es exactamente el de git.

## D13 — Politica: prohibido aplicar migrations a prod fuera de git 🟡 PROCESO

**Origen**: Durante la verificacion de pre-requisitos de 1.1.b se descubrio
que la migration `20260407000001_add_companion_workspace_mode.sql` habia sido
aplicada al remoto en una sesion previa pero nunca commiteada al repo. El
archivo solo existia como untracked en el working directory y fue recuperado
de un stash. types.ts ya reflejaba el cambio porque alguien lo regenero post-push.

**Por que importa**:
- El repo deja de ser source of truth del schema.
- Cualquier `supabase db reset` local rompe porque le falta el archivo.
- Cualquier rebuild de DB (DR, staging fresco) pierde la migration.
- Auditorias futuras no encuentran el cambio en git history.

**Politica**:
1. Toda migration que se aplique a cualquier entorno (local, staging, prod)
   DEBE existir como archivo commiteado en `supabase/migrations/` antes de
   aplicarse.
2. Nadie corre `supabase db push` sobre un archivo untracked.
3. Si un fix de hotfix se aplica a prod via dashboard SQL editor (caso
   excepcional), el SQL se commitea como migration en el siguiente commit
   al repo, con timestamp posterior y comentario explicando el origen.

**Status**: politica nueva, requiere comunicacion al equipo. Cerrado el
incidente puntual con el commit 1c91cfb2.

**Actualización 2026-04-22 (PR 4):** la migration
`20260418000001_revert_b2c_handoff.sql` se commitea al repo en PR 4 y se
aplica a local via `supabase db reset` para validación + verificación de
schema + tests RLS (skipped localmente sin `SUPABASE_SERVICE_ROLE_KEY`).
El push a prod (`supabase db push --linked`) queda como paso manual
post-merge con checklist D12 (backup pre-push + 12 queries de
verificación + RLS suite con service role key). Política preservada: el
SQL commiteado es autoridad, no se modifica entre merge y push.

**Actualización 2026-04-22 (post-PR-5):** Los dos pasos operacionales que estaban documentados aquí como D13-a y D13-b tienen sus propios IDs: D25 (edge function delete, ✅ cerrada) y D24 (migration push, pendiente). Ver D24 y D25.

## D14 — Companion routing en resolveConversationTurn ✅ CERRADA

**Origen**: Durante recuperacion de archivos untracked en cierre de
prerrequisitos de 1.1.b se encontraron 3 tests TDD spec-first en
`conversationOrchestrator.test.ts` que asumen que `resolveConversationTurn`
acepta un parametro `workspaceMode` y devuelve un branch `companion_fallback`.

**Estado actual**: Companion routing NO existe en ningun layer del chat:
- `useMessageHandler.ts` acepta `workspaceMode` pero lo ignora para routing
  (linea 681: "route based on content, not workspace_mode").
- `resolveConversationTurn` no acepta `workspaceMode` ni devuelve branches
  companion.
- `routeRequest.ts` no menciona companion.

Los 3 tests estan marcados como `.skip` con TODO en
`conversationOrchestrator.test.ts`.

**Contradiccion a resolver**: El contexto de Fase 1.0/1.0.5 indicaba routing
companion implementado. La investigacion confirma posibilidad (b): Fase
1.0/1.0.5 cerraron parcial y companion routing quedo pendiente.

**Accion**: revisar antes de cualquier sub-fase que toque el orchestrator o
useMessageHandler. Decidir si:
  (a) los tests se reescriben para el layer correcto, o
  (b) se implementa la funcionalidad en resolveConversationTurn.

**Bloquea**: nada hoy. Pero bloquea que digamos "companion routing esta
cubierto por tests" hasta resolverlo.

Cerrada 2026-04-22. Commit a3f28cf0 (PR 3 / C3 — strict mode routing)
adaptó los 3 tests en lugar de reactivarlos tal cual: el contrato
cambió de workspaceMode='companion' → companion_fallback a
mode='passenger' → planner_agent | mode_bridge según rama. Ver commit
para detalle de cada test. Los 3 matchean el contrato vigente
post-strict mode.

## D15 — duplicateTrip no setea owner_user_id 🟡 BAJA

**Origen**: Detectado durante auditoria de 1.1.b.

`tripService.duplicateTrip` (linea 219) hace un `.insert()` sin incluir
`owner_user_id` ni `account_type`. Post-1.1.a, `owner_user_id` es NOT NULL
sin default, por lo que el INSERT falla contra cualquier DB con la migration
aplicada.

**Impacto actual**: Ninguno. `duplicateTrip` no tiene call sites en el
codebase (no se importa en ningun archivo fuera de tripService.ts).

**Fix**: Agregar `owner_user_id: userId` y opcionalmente `account_type: 'agent'`
al objeto de insert. Es un cambio de 2 lineas.

**Bloquea**: Cualquier feature futura que use `duplicateTrip` (ej. "duplicar
itinerario" en UI). Debe resolverse antes de conectar un call site.

## D16 — superadmin_agencies_view: FKs ausentes en types.ts regenerado 🟡 BAJA

**Origen**: Detectado durante cierre de D10 (2026-04-09).

El types.ts regenerado desde prod via `supabase gen types typescript --linked`
no incluye las FK references a `superadmin_agencies_view` que si tenia la
version local anterior. Multiples tablas (activities, api_keys, conversations,
leads, trips, users) tenian entradas de Relationships apuntando a esta vista.

**Posibles causas**:
- La vista fue dropeada o alterada en prod en algun momento sin tracking en
  migrations.
- El CLI de Supabase cambio su heuristica para incluir/excluir FK refs de
  vistas entre versiones.

**Impacto**: Ninguno en runtime. Las FK refs de vistas solo son metadata para
el type generator, no constraints reales de la DB.

**Accion**: Investigar si la vista existe en prod (`SELECT * FROM
information_schema.views WHERE table_name = 'superadmin_agencies_view'`) y si
sus columnas coinciden con lo esperado. No bloquea features.

## D17 — UnifiedLayout sin i18n para avatar menu y logout 🟡 UX

UnifiedLayout (introducido en PR 2 / C6) renderiza copy literal en español
para los items del avatar menu, el aria-label del trigger y los toasts de
logout. CompanionLayout — al que reemplaza — usaba useTranslation('auth') y
exponía el copy a través de los archivos i18n.

Regresión menor de Fase 1.2 (i18n para Emilia B2C, PR #72). Un consumer con
preferredLanguage distinto a 'es' verá el menú del avatar y el botón de
"Cerrar sesión" en español hasta que se porte UnifiedLayout a i18n.

No bloqueante para el lanzamiento. Fix recomendado: commit independiente
post-PR-2 o parte del polish pre-launch. Pasos:

1. Importar useTranslation en UnifiedLayout.tsx.
2. Mover los strings literales (Settings, Users, Agencies, Tenants, Dashboard,
   Profile, "Cerrar sesión", "Menú de usuario", toast titles) a las claves
   correspondientes en src/i18n/locales/{es,en,pt}/auth.json y common.json.
3. Decidir si los labels del menu (Settings, Users, etc.) viven en common o
   en un namespace nuevo "navigation".

**Origen**: detectado durante PR 2, C6.

**Decisión 2026-04-22:** diferida fuera de scope PR 3. Candidata a
polish pre-launch. Usuario consumer con `preferredLanguage ≠ 'es'` ve
el menú del avatar y "Cerrar sesión" en español hasta que se porte.

## D21 — Sidebar consumer carga con la RPC equivocada (get_conversations_with_agency) ✅ CERRADA

**Síntoma**: consumer con conversaciones existentes (`workspace_mode='companion'`,
`created_by` correcto) ve "Aún no hay conversaciones." en el sidebar.

**Causa raíz confirmada empíricamente**: el sidebar consumer
(`ChatSidebarCompanion` o el hook que usa) llama a la RPC
`get_conversations_with_agency` que filtra por `agency_id`. Consumers no
tienen agency → response = []. Detectado durante smoke de C7.1.b con
`tester@tester.com` que tenía 14 conversaciones companion en DB.
Confirmado en DevTools Network: 4 calls a
`get_conversations_with_agency?order=last_message_at.desc` con response
`[]`.

**Severidad**: media-alta. Funcionalmente, ningún consumer con historial
puede ver sus viajes en el sidebar. Solo no se notó porque la mayoría de
consumers son nuevos sin historial.

**Fix esperado**: cambiar la query del hook del sidebar consumer para
llamar a una RPC distinta que filtre por `created_by = auth.uid()` +
`workspace_mode = 'companion'`. O agregar branch por `accountType` en el
hook compartido.

**NO bloquea PR 3**. Detectado durante smoke C7.1.b. Bug pre-existente,
no introducido por PR 3. Diferido a PR separado o a PR 4 (consumer
cleanup).

Cerrada 2026-04-22. Commit 339ca6de en `feat/pr3-chat-unification` (C7.1.f).
Evidencia:
- Sidebar consumer lista las 16 conversaciones del tester
  (tester@tester.com, UID `1cab9710-a1f9-4c23-8264-1d42832e81eb`).
- Sidebar agent intacto (smoke manual con `get_conversations_with_agency`
  en Network tab, 36 conversaciones visibles).
- Dos fixes combinados en el commit:
  1. `loadConversations` branchea por `accountType` (consumer → select
     directo sobre `conversations` con `eq('created_by', userId)`; agent →
     RPC existente).
  2. `inferConversationWorkspaceMode` preserva el valor `'companion'` de
     la columna en lugar de degradarlo a `'standard'`.

## D22 — Doble fetch en loadConversations al mount 🟢 BAJA

Detectada: 2026-04-22, durante smoke de C7.1.f (commit 339ca6de).

**Descripción**: `loadConversations` en `src/hooks/useChat.ts` usa
`useCallback` con deps `[accountType, userId]`. Al mount, `authUser.user`
es `null` → fetch #1 con `accountType=undefined` → branch RPC → devuelve
`[]`. Cuando `AuthContext` resuelve, deps cambian → `useEffect` re-run →
fetch #2 con los valores correctos → devuelve data.

**Impacto**: un fetch desperdiciado por mount. Funcionalmente correcto
(segundo fetch pisa el primero). Performance minor en cold-start del
chat.

**Fix sugerido** (fuera de scope C7.1.f): guard en el hook que no
dispare fetch hasta que `accountType !== undefined && userId != null`,
o early return en el `useEffect` cuando las deps no están resueltas.

**Prioridad**: baja. No bloquea features.

## D23 — Vocabulario "planner-agent" / "missing_info_request" vestigial 🟢 BAJA

Detectada durante ejecución de PR 4 (2026-04-22).

**Descripción**: Post-PR-4 el literal `'planner_agent'` desaparece del
routing (orchestrator, handler, pipeline, edge function). Pero el
messageType `'missing_info_request'` sobrevive como string literal en:

- `src/features/chat/hooks/useMessageHandler.ts` (líneas 1074, 1160,
  1301, 1337, 1385, 1487, 1491, 1859) — emisión por validation paths
  que no tienen relación con planner-agent.
- `src/features/chat/ChatFeature.tsx` — referencia a messageType.
- `src/features/chat/hooks/useContextualMemory.ts` — filtro de mensajes
  históricos por `messageType.eq.missing_info_request`.
- `src/features/public-chat/usePublicMessageHandler.ts` — case handler.
- `src/services/aiMessageParser.ts` — union type de `requestType`.
- `src/features/chat/components/ChatInterface.tsx` — condición del
  guided input.

El nombre `missing_info_request` es vestigial del dominio planner-agent
pero el contrato real es "mensaje que surface missing fields a
completar". Rename coherente: `validation_missing_fields` o similar.

**Impacto**: cero runtime. Nombre confuso para lectura del código.

**Riesgos del rename**:
- El literal probablemente está persistido en la tabla `messages` via
  `meta.messageType` de conversaciones históricas. Revisar si
  `useContextualMemory.ts:18` depende del valor exacto para
  retrocompatibilidad.
- Cruza 8+ archivos + potencialmente data en prod.

**Fix**: PR futura de cleanup de vocabulario. Scope: renombrar el
literal en todo el src/ + migration que actualice filas viejas si se
confirma persistencia. No bloquea nada hoy.

**Relacionado**: `PlannerAgentInputPrompt` → `MissingFieldsInputPrompt`
renombrado en PR 4 (commit 11.b) por la misma motivación.

## D24 — Aplicar migration revert_b2c_handoff a prod 🟡 OPERACIONAL

**Origen**: PR 4 (2026-04-22). Paso manual post-merge con pre-check obligatorio.

La migration `supabase/migrations/20260418000001_revert_b2c_handoff.sql` (commiteada en PR 4) restaura las constraints declarativas en `leads` (NOT NULL en `agency_id` y `tenant_id`) en producción.

**Pre-check obligatorio antes de ejecutar:**
```sql
SELECT count(*) FROM public.leads WHERE agency_id IS NULL;
```
Si `count = 0` → proceder. Si `count > 0` → investigar antes de aplicar (la constraint NOT NULL fallará sobre esas filas). Count = 0 confirmado localmente en PR 4, pero debe re-verificarse contra prod.

**Ejecución (con D13-checklist completo):**
```bash
supabase db push --project-ref ujigyazketblwlzcomve
```

Checklist D13: backup reciente de DB (< 24h), ventana lunes-jueves horario laboral, `SUPABASE_SERVICE_ROLE_KEY` seteado para verificación RLS post-push.

**No bloquea**: nada hoy. La tabla `leads` en prod es empíricamente consistente. La migration solo restaura constraints declarativas.

## D25 — Edge function planner-agent borrada de prod ✅ CERRADA

**Cerrada**: 22-Abr-2026.

`supabase functions delete planner-agent --project-ref ujigyazketblwlzcomve` ejecutado. Confirmado: función ausente en `supabase functions list`. Último evento en Supabase Dashboard: 18-Abr-2026 (4 días de silencio post-merge de PR 4 que borró los callers en código).

Nota operacional: la flag `--linked` no es válida para `functions delete`. El flag correcto es `--project-ref <ref>`, obtenido de `supabase/config.toml::project_id`.

## D26 — ThemeToggle visible solo en agency mode del header 🟡 UX REGRESIÓN

**Origen**: Detectado en smoke de PR 5 (2026-04-22). Diagnóstico preciso confirmado por grep audit post-smoke.

`ThemeToggle` está montado en `src/features/chat/components/ChatHeader.tsx:106`, dentro del bloque `{showAgentChrome && (...)}` donde `showAgentChrome = accountType === 'agent'`. El toggle quedó agrupado por proximidad con el ModeSwitch (agency/passenger) y el botón "Generar card en CRM", los cuales sí son agent-only por diseño. El ThemeToggle heredó la condición de rol sin intención.

**Fix**: En `ChatHeader.tsx`, mover `<ThemeToggle variant="compact" className="hidden md:flex" />` fuera del bloque `{showAgentChrome && (...)}` para que sea visible en ambos modos. ModeSwitch y botón CRM se quedan dentro del condicional — su ocultamiento en consumer mode es por diseño (ADR-002). PR dedicada chica.

**No bloquea**: la app funciona en modo oscuro para consumers. Bloquea preferencia de tema del consumer.

## D27 — Export PDF v1 minimalista: candidatas de v2 🟢 POLISH FUTURO

**Origen**: Observación del smoke de PR 5 (2026-04-22). Scope de v1 fue deliberadamente acotado.

PR 5 entregó v1 con scope explícito: texto-only, branding básico, sin mapas, sin fotos de lugares, sin email, sin i18n estructural, sin persistencia en Storage, sin export desde `/emilia/profile`. Las mejoras de v2 deben evaluarse con feedback de usuarios reales antes de priorizarse.

**Candidatas individuales** (cada una con su propio trade-off — no bundle):
- **Mapas estáticos**: Mapbox Static API (requiere API key adicional o reutilizar la existente con rate-limit separado).
- **Fotos Foursquare**: impacto en tamaño del PDF y tiempo de generación (html2canvas captura imágenes inline).
- **i18n del template**: ~20-25 strings, alineado con D28. Mismo PR que porte `ItineraryPanel.tsx` a i18n.
- **Persistencia**: bucket `itinerary-pdfs` con RLS por `agency_id` (requiere resolver D29 primero).
- **Export desde `/emilia/profile`**: requiere recuperar `TripPlannerState` desde DB para trips históricos.

**No bloquea**: nada. v1 cumple el caso de uso core.

## D28 — itineraryPdfTemplate sin i18n 🟢 BAJA

**Origen**: Decisión de diseño en PR 5 (2026-04-22). Anteriormente etiquetado incorrectamente como D24.

`renderItineraryHtml` hardcodea todos los labels estructurales en español ("Día X", "Mañana", "Tarde", "Noche", "Ruta", "Fechas", "Viajeros", etc.). El `ItineraryPanel.tsx` tiene la misma deuda — ninguno usa `useTranslation`.

**Impacto**: Consumer con `preferredLanguage = 'en'` o `'pt'` recibe el PDF con labels en español. El contenido generado por AI sí llega en el idioma correcto. Solo los labels estructurales son el problema.

**Fix**: Agregar namespace `itinerary` a los 6 archivos JSON de i18n (es/en/pt × `src/i18n/locales/`), pasar `lang` como parámetro a `renderItineraryHtml`, y refactorizar `formatTravelersText` para usar plurales de i18next. ~20-25 strings. Candidato al mismo PR que porte `ItineraryPanel.tsx` a i18n.

**No bloquea**: nada. Consistente con el estado actual del panel.

## D29 — Bucket `documents` sin tenant isolation para PDFs de consumer 🟡 MEDIA

**Origen**: Auditado en PR 5 (2026-04-22). Anteriormente etiquetado incorrectamente como D25.

El bucket `documents` en Supabase Storage tiene RLS que solo requiere `authenticated` sin verificar `agency_id`. Un usuario autenticado de cualquier agencia puede leer PDFs de otra agencia si conoce el path.

**En PR 5**: se usa on-demand blob download (sin Storage) para los PDFs de itinerario, evitando el problema.

**Fix futuro** (si se decide persistir PDFs en Storage): crear bucket dedicado `itinerary-pdfs` con RLS scoped por `agency_id`. Requiere nueva migration. El path de subida debe incluir `agency_id` como prefijo.

**No bloquea**: PR 5 no usa Storage. Bloquea persistencia de PDFs de consumer.

## D30 — Ciclo de servicio: trip-planner importa desde chat/services/searchHandlers 🟡 ARQUITECTURA

**Origen**: Documentado en refactor B2 (2026-04-25).

`src/features/trip-planner/hooks/usePlannerHotels.ts` y `usePlannerTransport.ts` importan `handleHotelSearch` / `handleFlightSearch` directamente desde `src/features/chat/services/searchHandlers.ts`. Esto mantiene un ciclo de dependencia entre features: trip-planner → chat/services.

**Aceptado en B2** porque extraer los handlers a un módulo neutro requeriría refactorizar `searchHandlers.ts` (~1800 LOC) y su inyección de dependencias. Costo/beneficio desfavorable en este ciclo.

**Mitigación**: Header comment agregado a `searchHandlers.ts` con `@internal SHARED SERVICE` para alertar a futuros desarrolladores sobre los call sites en ambas features.

**Re-evaluar si**: surgen 3+ consumers adicionales de `searchHandlers`, o si el archivo se parte por otra razón independiente.
