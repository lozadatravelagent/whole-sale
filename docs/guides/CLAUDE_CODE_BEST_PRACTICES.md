# Best Practices para Claude Code — Nivel Raiz + Aplicado a WholeSale Connect AI

Documento exhaustivo de mejores practicas para usar Claude Code, basado en:
1. El hilo de **@hooeem** sobre el "Claude Architect" (5 dominios de conocimiento)
2. Las **best practices oficiales de Anthropic** (code.claude.com/docs)
3. El thread de **Boris Cherny** (creador de Claude Code)
4. **Aplicacion directa** al proyecto WholeSale Connect AI

---

## PARTE 1: MEJORES PRACTICAS A NIVEL RAIZ (Universal)

### 1. Gestion del Contexto (Lo mas importante)

La ventana de contexto es el recurso mas critico. El rendimiento degrada a medida que se llena.

- **`/clear` entre tareas no relacionadas** — Nunca acumular contexto irrelevante
- **`/compact <instrucciones>`** — Compactar selectivamente: `/compact Focus on the API changes`
- **Usar subagents para investigacion** — Exploran en contexto separado y devuelven resumenes
- **Nunca hacer "kitchen sink sessions"** — Una sesion = una tarea/feature
- **Despues de 2 correcciones fallidas** → `/clear` y reescribir el prompt con lo aprendido
- **Colocar informacion clave al INICIO** del input (efecto "lost in the middle")

### 2. Flujo de Trabajo: Explorar → Planificar → Implementar → Verificar

```
1. EXPLORAR (Plan Mode - Shift+Tab x2)
   → Claude lee archivos y responde preguntas sin hacer cambios

2. PLANIFICAR (Plan Mode)
   → Crear plan detallado de implementacion
   → Ctrl+G para editar el plan en tu editor

3. IMPLEMENTAR (Normal Mode)
   → Auto-accept mode para que Claude ejecute sin interrupciones
   → Verificar contra el plan

4. VERIFICAR + COMMIT
   → Tests, screenshots, validacion
   → Commit descriptivo + PR
```

**Cuando SALTAR la planificacion:** Tareas donde el diff se describe en una frase (typos, logs, renames).

### 3. Verificacion: Lo que mas impacto tiene (2-3x calidad)

> "Dar a Claude una forma de verificar su trabajo es lo que mas impacto tiene en la calidad" — Boris Cherny

| Estrategia | Ejemplo |
|---|---|
| Tests automatizados | "Escribe tests para edge cases. Ejecutalos despues" |
| Screenshots (Chrome ext.) | "Toma screenshot y compara con el diseno original" |
| Root cause, no sintomas | "El build falla con ESTE error: [pegar]. Arregla la causa raiz" |
| Linters/type-check | "Asegurate de que pasa lint y typecheck al terminar" |

### 4. Prompts Especificos y Efectivos

| Vago | Especifico |
|---|---|
| "arregla el bug de login" | "Login falla despues de session timeout. Revisa src/auth/, especialmente token refresh. Escribe test que reproduzca el issue" |
| "agrega tests para foo.py" | "Escribe test para foo.py cubriendo el edge case cuando el user esta logged out. Sin mocks" |
| "agrega un widget" | "Mira como se implementan widgets en HotDogWidget.php. Sigue ese patron para implementar un calendario" |

**Contenido rico:**
- `@archivo` para referenciar archivos
- Pegar imagenes/screenshots directamente
- Dar URLs de documentacion
- `cat error.log | claude` para enviar contenido directamente

### 5. CLAUDE.md Efectivo

**Incluir:**
- Comandos bash que Claude no puede adivinar
- Reglas de estilo que difieren del default
- Instrucciones de testing
- Convenciones de repo (branch naming, PR)
- Decisiones arquitectonicas del proyecto
- Gotchas no obvios

**NO incluir:**
- Lo que Claude puede inferir leyendo codigo
- Convenciones estandar del lenguaje
- Documentacion detallada de APIs (linkear en su lugar)
- Informacion que cambia frecuentemente
- Descripciones archivo por archivo
- "Escribe codigo limpio" (auto-evidente)

**Regla de oro:** Para cada linea, preguntar: "Si quito esto, Claude cometera errores?" Si no → eliminarlo.

### 6. Skills, Hooks y Subagents

**Skills (.claude/skills/):**
- Conocimiento de dominio que solo aplica a veces
- Workflows repetibles invocables con `/skill-name`
- `disable-model-invocation: true` para workflows con side effects
- `context:fork` para aislar output verboso

**Hooks (.claude/settings.json):**
- Para acciones que DEBEN ocurrir siempre (deterministas)
- PostToolUse: formatear codigo despues de cada edit
- PreToolUse: bloquear escrituras a carpetas protegidas

**Subagents (.claude/agents/):**
- Contexto aislado con herramientas especificas
- Limitar a 4-5 herramientas por subagent
- Ideales para: code review, seguridad, investigacion

### 7. Sesiones Paralelas y Escalado

- **5 terminales en paralelo** numeradas 1-5 con notificaciones del sistema
- **Patron Writer/Reviewer:** Session A implementa → Session B revisa → Session A corrige
- **Fan-out para migraciones:** `for file in $(cat files.txt); do claude -p "..." done`
- **`--allowedTools`** para restringir permisos en batch
- **`claude --continue`** para retomar, **`--resume`** para elegir sesion

### 8. Modelo y Configuracion (Boris Cherny)

- Usar **Opus con thinking** para todo — requiere menos steering, mejor tool use
- Pre-permitir comandos bash frecuentes para evitar prompts de permisos
- MCP servers para integrar servicios externos (Slack, BigQuery, Sentry)
- Nombrar sesiones con `/rename` ("oauth-migration", "debugging-memory-leak")

---

## PARTE 2: LOS 5 DOMINIOS DEL CLAUDE ARCHITECT (@hooeem)

### Dominio 1: Arquitectura Agentica y Orquestacion (27%)

**Errores criticos a evitar:**
- NO parsear lenguaje natural para terminacion de loops
- NO usar caps arbitrarios de iteracion
- NO verificar texto del assistant como senal de completion

**Principio clave:** "Los subagents operan con contexto aislado. Cada pieza de informacion debe pasarse explicitamente en el prompt."

**Para sistemas financieros/seguridad:** Usar hooks y prerequisite gates para forzar orden de herramientas — los prompts solos no son suficientes.

### Dominio 2: Diseno de Tools y MCP (18%)

- Las **descripciones de tools** determinan la fiabilidad del routing
- Descripciones vagas o solapadas causan misrouting
- `tool_choice`: "auto" (puede devolver texto), "any" (debe llamar tool), forced
- **4-5 tools maximo por subagent**
- Siempre refinar descripciones hasta eliminar ambiguedad

### Dominio 3: Configuracion y Workflows de Claude Code (20%)

**Jerarquia CLAUDE.md:**
1. **User-level** (`~/.claude/CLAUDE.md`) — aplica a todas las sesiones
2. **Project-level** (`./CLAUDE.md`) — checked into git, compartido con el equipo
3. **Directory-level** — Claude las carga on-demand

**Rules con glob patterns:**
- `.claude/rules/` con patrones YAML (`**/*.test.tsx`) para convenciones cross-codebase
- Mas potente que CLAUDE.md a nivel directorio

### Dominio 4: Prompt Engineering y Output Estructurado (20%)

- "Be explicit" — Nunca directivas vagas como "be conservative"
- **2-4 few-shot examples** para casos ambiguos con reasoning
- JSON schemas eliminan errores de sintaxis pero NO semanticos
- Disenar schemas con: campos nullable, enum values "unclear", "other" + detail strings
- **Batches API:** 50% ahorro, procesamiento hasta 24h, sin tool calling multi-turn

### Dominio 5: Gestion de Contexto y Fiabilidad (15%)

- **NUNCA** resumir progresivamente datos transaccionales
- Mantener bloques "case facts" persistentes (montos, fechas, IDs)
- **Escalation triggers validos:** cliente pide humano, gaps de politicas, incapacidad de progreso
- **Error propagation:** tipo de fallo, query intentado, resultados parciales, alternativas
- NO suprimir errores silenciosamente ni matar workflows por fallos individuales

---

## PARTE 3: APLICADO A WHOLESALE CONNECT AI

### 3.1 Skills Existentes y su Uso Optimo

El proyecto tiene **9 skills configuradas**:

| Skill | Cuando Usar | Invocacion |
|---|---|---|
| `chat-system` | Modificar sistema de chat, mensajes, real-time | `/chat-system` |
| `flight-search` | Cambios en busqueda de vuelos (Starling) | `/flight-search` |
| `hotel-search` | Cambios en busqueda de hoteles (EUROVIPS) | `/hotel-search` |
| `pdf-system` | Generacion de cotizaciones PDF (PDFMonkey) | `/pdf-system` |
| `crm-leads` | CRM y gestion de leads | `/crm-leads` |
| `api-gateway` | API publica Fastify (Railway) | `/api-gateway` |
| `fix-issue` | Arreglar un issue de GitHub | `/fix-issue <number>` |
| `review-pr` | Revisar un PR | `/review-pr <number>` |
| `iteration-detection` | Detectar loops en agentes | `/iteration-detection` |

**Best practice:** Siempre invocar el skill relevante ANTES de empezar a trabajar. Carga el contexto de dominio sin contaminar CLAUDE.md.

### 3.2 Subagents Existentes y Uso Optimo

| Agent | Proposito | Cuando Delegarle |
|---|---|---|
| `security-reviewer` | OWASP + multi-tenant review | Antes de PR en auth, RLS, API |
| `supabase-expert` | RLS, Edge Functions, Realtime | Cambios en DB, policies, funciones |

**Uso:** "Usa el subagent security-reviewer para revisar este cambio en auth."

### 3.3 Workflows Recomendados para el Proyecto

#### Feature nueva (multi-archivo):
```
1. /clear
2. Plan Mode → "Lee src/features/X y entiende los patrones"
3. Plan Mode → "Quiero agregar Y. Que archivos cambian? Crea plan"
4. Normal Mode → "Implementa el plan. Ejecuta npm run build y npm run lint"
5. "Usa security-reviewer para revisar los cambios"
6. /commit
```

#### Bug fix:
```
1. /clear
2. "El error es: [pegar error]. Esta en src/X. Investiga la causa raiz"
3. "Arregla y verifica con npm run build && npm run lint"
4. /commit
```

#### Cambio en Edge Function:
```
1. /clear
2. /chat-system (o el skill relevante)
3. Plan Mode → explorar supabase/functions/
4. Implementar + test con supabase functions serve
```

#### Cambio en API Gateway:
```
1. /clear
2. /api-gateway
3. Recordar: api/ es PROYECTO SEPARADO, no impacta src/
4. Implementar + verificar health check
```

### 3.4 Patrones Especificos del Proyecto a Recordar

1. **`api/` vs `src/`**: Son proyectos independientes. NUNCA mezclar cambios
2. **Deduplicacion 5 capas**: Seguir patron de `useChat.ts` con `client_id`
3. **Dual-Mode**: Production (Edge Functions) vs Development (CORS proxy) — detectar con `import.meta.env.DEV`
4. **Imports**: Siempre `@/` alias
5. **Componentes**: shadcn/ui como building blocks
6. **Forms**: React Hook Form + Zod
7. **Roles**: OWNER > SUPERADMIN > ADMIN > SELLER — respetar jerarquia en permisos

### 3.5 Problemas Conocidos a Tener en Cuenta

Del memory existente:
- **useActivities**: subscription refresh descontrolado (missing deps)
- **useLeadManager**: full refetch en filter/sort → patron N+1
- **AuthContext/useChatState**: posibles cascading re-renders
- **useMessageHandler**: 300+ lineas con inline functions → candidato a simplificar
- **Sin virtualizacion**: tablas/listas sin windowing (Kanban, Reports) → riesgo de perf en scroll
- **Context re-renders**: AuthContext puede causar re-renders en cascada

---

## PARTE 4: ANTI-PATRONES A EVITAR

| Anti-Patron | Sintoma | Solucion |
|---|---|---|
| Kitchen sink session | Mezclar tareas no relacionadas | `/clear` entre tareas |
| Correccion en loop | >2 correcciones del mismo error | `/clear` + prompt mejor |
| CLAUDE.md inflado | Claude ignora instrucciones | Podar: si Claude ya lo hace bien sin la regla, borrarla |
| Trust-then-verify gap | Implementacion plausible sin edge cases | Siempre verificar con tests/lint/build |
| Exploracion infinita | Claude lee 100+ archivos sin scope | Acotar o usar subagents |
| Over-engineering | Features no pedidas, abstracciones prematuras | Solo lo pedido, nada mas |
| Resumir datos transaccionales | Perder montos, fechas, IDs | Bloques "case facts" persistentes |
| Suprimir errores | Ocultar fallos en vez de propagar | Error propagation estructurado |

---

## Fuentes

- [@hooeem — Claude Architect Learning Path](https://x.com/hooeem/status/2033198345045336559)
- [Anthropic — Claude Code Best Practices (oficial)](https://code.claude.com/docs/en/best-practices)
- [Boris Cherny — How I Use Claude Code](https://twitter-thread.com/t/2007179832300581177)
