# Auditoría y decisión arquitectónica B2B / B2C — Emilia

**Fecha:** 2026-04-09
**Contexto:** Se incorporó al producto la capa B2C (Emilia Companion, Etapa 1) sobre la plataforma B2B existente (cotizador para agencias). Este documento resume la auditoría del estado actual y la decisión arquitectónica tomada.

## 1. Qué se auditó

Se corrió una auditoría de solo lectura sobre el repo para verificar dos cosas:

1. Que el flujo B2B existente sigue funcionando sin regresiones.
2. Que la nueva capa B2C esté incorporada de forma aislada, sin pisar el B2B.

## 2. Estado actual del B2B (cotizador)

**Funciona normal.** No hay regresiones.

- 119/119 tests pasan. Los 2 únicos fallos de la suite son pre-existentes (`localStorage is not defined` en Vitest, sin relación con B2C).
- Auth, CRM, API gateway, trip planner, integraciones (Starling, Eurovips, Hotelbeds, Foursquare): intactos.
- La migración de DB (`add_companion_workspace_mode`) es aditiva e idempotente: solo agrega un valor al enum `conversation_workspace_mode`. Sin DROP, sin renombrados, sin cambios de defaults ni de RLS.

## 3. Estado actual del B2C (companion / planner)

**Incorporado parcialmente.** Hoy existe:

- Cañería de routing: companion mode en el `conversationOrchestrator` que rutea a `planner_agent` o `ask_minimal`, **nunca a `standard_search`**. Esa es la barrera técnica que garantiza que B2C no cotiza ni reserva.
- Landing básica en `/emilia` (`EmiliaLanding.tsx`).
- Soporte de `?mode=companion` en `/chat`.
- Migración de DB con el nuevo valor de enum `'companion'`.
- 3 tests nuevos en `conversationOrchestrator` cubriendo el routing companion + un regression test del flujo standard.

**Faltante de la Etapa 1:** registro/perfil consumer, panel de itinerario vivo, recomendaciones contextuales, perfil de usuario, feed social, y la pieza más importante para cerrar el loop comercial: **modal de derivación humana** (handoff a lead).

## 4. Riesgos detectados

Tres puntos donde el aislamiento entre B2B y B2C no quedó bien hecho:

| # | Severidad | Archivo | Problema |
|---|---|---|---|
| 1 | Medio | `src/features/chat/components/ChatSidebar.tsx:149` | Filtro relajado de `=== 'standard'` a `!== 'planner'`. Las conversaciones companion se cuelan en el sidebar B2B. |
| 2 | Medio | `src/integrations/supabase/types.ts:1055` | Array `Constants` desincronizado del enum: el enum tiene `'companion'`, el array no. Cualquier validación basada en Constants rechazará valores válidos. |
| 3 | Medio | `src/features/chat/hooks/useMessageHandler.ts` + `branches/plannerAgentBranch.ts` | Refactor de ~350 líneas del planner branch a archivo nuevo (529 líneas). Funcionalmente equivalente pero sin tests propios. |

## 5. Decisión arquitectónica

**Motor compartido, productos separados.**

### Principio rector

> Si un archivo necesita ramificar por `workspaceMode` para decidir **lógica de negocio**, queda compartido (es motor).
> Si necesita ramificar por `workspaceMode` para decidir **UI o navegación**, se separa en dos componentes.

### Qué es motor (compartido)

- `conversationOrchestrator`, `routeRequest`
- `planner_agent`, `ask_minimal` y demás edge functions
- Integraciones externas (Starling, Eurovips, Hotelbeds, Foursquare)
- Tabla `conversations` con discriminador `workspace_mode`
- Modelo de datos base
- Hooks puros de chat (`useChat`, lógica de estado)

### Qué es producto (separado)

- **Routing:** B2B bajo rutas actuales (`/dashboard`, `/crm`, `/chat`, etc.). B2C bajo `/emilia/*`.
- **Layouts:** `B2BLayout` (sidebar de agencia, CRM, marketplace) vs `CompanionLayout` (limpio, consumer).
- **Sidebars:** `ChatSidebarB2B` filtra estricto `'standard' | 'planner'`. `ChatSidebarCompanion` filtra estricto `'companion'`. No hay sidebar compartido.
- **Auth:** un solo `AuthContext` con campo discriminador `accountType: 'agent' | 'consumer'` y guards `requireAgent()` / `requireConsumer()`. La separación en dos contextos queda como decisión futura si hace falta.
- **Componentes de UI** que hoy ramifican por modo: se extraen a sub-componentes y se pasan como props/slots al motor de chat compartido.

### Punto único de contacto entre B2B y B2C

El **handoff**. Cuando se implemente el modal de derivación humana en B2C, va a generar un lead que aterriza en el CRM del B2B. Una sola dirección (B2C → B2B), una sola interfaz. Eso es lo que justifica que sean el mismo producto y no dos repos.

## 6. Plan de ejecución

**Paso 0 (bloqueante, antes de cualquier feature nueva):**
Aplicar los 2 fixes de severidad media (sidebar filter + Constants desincronizado).

**Paso 1 (estructural):**
Establecer la separación motor/producto: crear `B2BLayout` y `CompanionLayout`, mover B2C bajo `/emilia/*`, separar sidebars, agregar `accountType` y guards en Auth, deprecar `?mode=companion` con redirect a `/emilia/chat`. **Sin tocar motor.**

**Paso 2 (feature comercial):**
Implementar modal de derivación humana + creación de lead desde companion al CRM B2B. Es la pieza que cierra el loop y la única que justifica todo el resto del B2C.

**Paso 3 (experiencia):**
Panel de itinerario vivo al costado del chat companion.

**Paso 4 (identidad):**
Registro/perfil consumer separado del flujo de agencia.

**Paso 5 (capa social):**
Perfil público, feed liviano, recomendaciones contextuales.

## 7. Conclusión

El B2B sigue funcionando. El B2C está inyectado a nivel motor (routing del chat) pero le falta casi toda la capa de producto. La arquitectura elegida —motor compartido, productos separados por layout/routing/auth— permite avanzar B2C sin romper B2B y mantiene el costo de mantenimiento bajo, a cambio de disciplina en respetar la regla de qué es motor y qué es producto. Los 2 bugs medios detectados son ejemplos exactos de qué pasa cuando esa regla no se respeta, y son el paso 0 obligatorio antes de cualquier feature nueva.