# Staged diffs review — pre-commit cleanup post-C7.1.f

## git diff --cached --stat

```
 TECH_DEBT.md              | 58 +++++++++++++++++++++++++++++++++++++++++++----
 docs/B2C_STATUS.md        |  1 +
 supabase/.temp/cli-latest |  1 -
 3 files changed, 55 insertions(+), 5 deletions(-)
```

## git diff --cached TECH_DEBT.md

```diff
diff --git a/TECH_DEBT.md b/TECH_DEBT.md
index 9eadd3ba..ee5c07cb 100644
--- a/TECH_DEBT.md
+++ b/TECH_DEBT.md
@@ -18,15 +18,21 @@ y comparado con la version local. Diff de 311 lineas en 3 categorias:
 types.ts reemplazado con la version de prod. Build y tests verificados sin
 regresiones (132/12/2).
 
-## D11 — Vitest localStorage failures
+## D11 — Vitest localStorage failures ✅ CERRADA
 
-2 suites fallan por `localStorage is not defined` (`signatures.test.ts`, `structuralMods.test.ts`).
+2 suites fallaban por `localStorage is not defined` (`signatures.test.ts`, `structuralMods.test.ts`).
 Pre-existentes desde antes de 1.1.a. Ruido en CI que puede camuflar fallos reales. Prioridad baja.
 
 Causa raiz: importan modulos que transitivamente cargan `src/integrations/supabase/client.ts`,
 el cual referencia `localStorage` en su config de auth. En entorno Node/Vitest no hay `localStorage`.
 Fix: mock de `localStorage` en vitest setup o lazy-init del cliente Supabase.
 
+Cerrada 2026-04-22. No reproduce en los 6 ciclos de test de PR 2 ni en
+verificación empírica de hoy: ambas suites passan ✓, cero matches de
+'localStorage is not defined' en output verbose. Causa probable: side
+effect de refactors de auth/i18n. Reservado: si reaparece en CI o
+entorno distinto, reabrir con contexto de donde falla.
+
 ## D12 — Push de migrations 1.1.a a produccion ✅ CERRADA
 
 **Checklist ejecutado**:
@@ -92,7 +98,7 @@ de un stash. types.ts ya reflejaba el cambio porque alguien lo regenero post-pus
 **Status**: politica nueva, requiere comunicacion al equipo. Cerrado el
 incidente puntual con el commit 1c91cfb2.
 
-## D14 — Companion routing en resolveConversationTurn 🟡 SPEC PENDIENTE
+## D14 — Companion routing en resolveConversationTurn ✅ CERRADA
 
 **Origen**: Durante recuperacion de archivos untracked en cierre de
 prerrequisitos de 1.1.b se encontraron 3 tests TDD spec-first en
@@ -121,6 +127,13 @@ useMessageHandler. Decidir si:
 **Bloquea**: nada hoy. Pero bloquea que digamos "companion routing esta
 cubierto por tests" hasta resolverlo.
 
+Cerrada 2026-04-22. Commit a3f28cf0 (PR 3 / C3 — strict mode routing)
+adaptó los 3 tests en lugar de reactivarlos tal cual: el contrato
+cambió de workspaceMode='companion' → companion_fallback a
+mode='passenger' → planner_agent | mode_bridge según rama. Ver commit
+para detalle de cada test. Los 3 matchean el contrato vigente
+post-strict mode.
+
 ## D15 — duplicateTrip no setea owner_user_id 🟡 BAJA
 
 **Origen**: Detectado durante auditoria de 1.1.b.
@@ -184,7 +197,11 @@ post-PR-2 o parte del polish pre-launch. Pasos:
 
 **Origen**: detectado durante PR 2, C6.
 
-## D21 — Sidebar consumer carga con la RPC equivocada (get_conversations_with_agency) 🟡 MEDIA-ALTA
+**Decisión 2026-04-22:** diferida fuera de scope PR 3. Candidata a
+polish pre-launch. Usuario consumer con `preferredLanguage ≠ 'es'` ve
+el menú del avatar y "Cerrar sesión" en español hasta que se porte.
+
+## D21 — Sidebar consumer carga con la RPC equivocada (get_conversations_with_agency) ✅ CERRADA
 
 **Síntoma**: consumer con conversaciones existentes (`workspace_mode='companion'`,
 `created_by` correcto) ve "Aún no hay conversaciones." en el sidebar.
@@ -210,3 +227,36 @@ hook compartido.
 **NO bloquea PR 3**. Detectado durante smoke C7.1.b. Bug pre-existente,
 no introducido por PR 3. Diferido a PR separado o a PR 4 (consumer
 cleanup).
+
+Cerrada 2026-04-22. Commit 339ca6de en `feat/pr3-chat-unification` (C7.1.f).
+Evidencia:
+- Sidebar consumer lista las 16 conversaciones del tester
+  (tester@tester.com, UID `1cab9710-a1f9-4c23-8264-1d42832e81eb`).
+- Sidebar agent intacto (smoke manual con `get_conversations_with_agency`
+  en Network tab, 36 conversaciones visibles).
+- Dos fixes combinados en el commit:
+  1. `loadConversations` branchea por `accountType` (consumer → select
+     directo sobre `conversations` con `eq('created_by', userId)`; agent →
+     RPC existente).
+  2. `inferConversationWorkspaceMode` preserva el valor `'companion'` de
+     la columna en lugar de degradarlo a `'standard'`.
+
+## D22 — Doble fetch en loadConversations al mount 🟢 BAJA
+
+Detectada: 2026-04-22, durante smoke de C7.1.f (commit 339ca6de).
+
+**Descripción**: `loadConversations` en `src/hooks/useChat.ts` usa
+`useCallback` con deps `[accountType, userId]`. Al mount, `authUser.user`
+es `null` → fetch #1 con `accountType=undefined` → branch RPC → devuelve
+`[]`. Cuando `AuthContext` resuelve, deps cambian → `useEffect` re-run →
+fetch #2 con los valores correctos → devuelve data.
+
+**Impacto**: un fetch desperdiciado por mount. Funcionalmente correcto
+(segundo fetch pisa el primero). Performance minor en cold-start del
+chat.
+
+**Fix sugerido** (fuera de scope C7.1.f): guard en el hook que no
+dispare fetch hasta que `accountType !== undefined && userId != null`,
+o early return en el `useEffect` cuando las deps no están resueltas.
+
+**Prioridad**: baja. No bloquea features.
```

## git diff --cached docs/B2C_STATUS.md

```diff
diff --git a/docs/B2C_STATUS.md b/docs/B2C_STATUS.md
index 7ed4a6f6..b4549182 100644
--- a/docs/B2C_STATUS.md
+++ b/docs/B2C_STATUS.md
@@ -36,6 +36,7 @@
 | Supabase cookie handling | Refactor del manejo de cookies en cliente Supabase | `27880f1d` |
 | AuthCallback + routing Emilia host | Callback de auth y enrutamiento dedicado para host Emilia | `5a1e5e22` |
 | Login route + auth refactor | Ruta dedicada de login y refactor del flujo de autenticación | `d3c4124a` |
+| Consumer sidebar vacío | `get_conversations_with_agency` no retornaba data para consumers + `inferConversationWorkspaceMode` degradaba `'companion'` a `'standard'` | `339ca6de` (C7.1.f) |
 | Coherencia de texto | Texto conversacional no refleja cambios estructurales | Pendiente |
 | Secciones redundantes | "Qué hacer en X" / "Puntos de interés" repetidos | Pendiente |
 
```
