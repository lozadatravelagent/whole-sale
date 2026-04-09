# Technical Debt Registry

## D10 — Regeneracion de types.ts post-1.1.a ⚠️ CERRADA PARCIAL

**Cerrada parcial el**: 2026-04-09
**Commit**: d071411c

types.ts regenerado desde la instancia local de Supabase. Local tiene las
migrations de 1.1.a aplicadas, remoto no. Esto desbloquea desarrollo de 1.1.b
sin tocar produccion.

**Estado real**: types.ts esta temporalmente desincronizado del schema de
produccion.

## D11 — Vitest localStorage failures

2 suites fallan por `localStorage is not defined` (`signatures.test.ts`, `structuralMods.test.ts`).
Pre-existentes desde antes de 1.1.a. Ruido en CI que puede camuflar fallos reales. Prioridad baja.

Causa raiz: importan modulos que transitivamente cargan `src/integrations/supabase/client.ts`,
el cual referencia `localStorage` en su config de auth. En entorno Node/Vitest no hay `localStorage`.
Fix: mock de `localStorage` en vitest setup o lazy-init del cliente Supabase.

## D12 — Push de migrations 1.1.a a produccion 🔴 PENDIENTE BLOQUEANTE

**Bloquea**: cualquier deploy a produccion de codigo que use `owner_user_id`,
`account_type`, `'CONSUMER'`, o las RLS policies `consumer_*`.

**Accion**: ejecutar `supabase db push` con checklist propio:
- [ ] Backup de la DB de produccion tomado.
- [ ] Drift de migrations resuelto previamente (cerrado por commit 1c91cfb2).
- [ ] Ventana de mantenimiento coordinada (aunque la migration sea aditiva).
- [ ] Script de verificacion post-push (las 12 queries de la seccion f del
      plan de 1.1.a) corrido contra prod.
- [ ] Plan de rollback documentado.
- [ ] Tests RLS de 1.1.a corridos contra prod post-push (con datos de prueba
      aislados, cleanup garantizado).

**Deadline**: antes del primer deploy a produccion de codigo que dependa de
1.1.a o posterior.

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

## D14 — Companion routing en resolveConversationTurn 🟡 SPEC PENDIENTE

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
