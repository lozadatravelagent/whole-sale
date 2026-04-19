# PR: Landing Redesign L1 — premium consumer-first landing for Emilia B2C

## Scope

Reemplaza la landing pública en `/emilia` (anteriormente `src/pages/EmiliaLanding.tsx`, 87 líneas con copy B2B "asistente para agencias de viajes") por una experiencia consumer-first construida como árbol de componentes bajo `src/features/landing/`. La nueva landing renderiza las 10 secciones fijadas por el brief en orden (Hero → Ecosystem → HowItWorks → PromptDemo → HelpsWith → Inspiration → Understands → Personalized → Trust → FinalCta), reescribe el namespace `landing` en i18n × 3 idiomas (EN canónico del brief, ES voseo AR, PT-BR), y cierra el flow de deep-link desde los prompt chips / inspiration cards al input del chat vía un sessionStorage bridge.

**Lo que hace L1:**
- Reescribe la page `/emilia` end-to-end con un árbol premium minimal dark (tokens HSL, sin colores hardcoded).
- Consumer-first copy en 3 idiomas.
- Bridge landing → chat (prompt chip click → `/emilia/chat` con el input preloadeado).
- Tests de funciones puras para las utilities del bridge.

**Lo que NO hace L1:**
- No toca el motor de chat (`ChatFeature.tsx`, `conversationOrchestrator`, `useMessageHandler`, edge functions, planner agent, trip planner).
- No toca el router de `src/App.tsx` (la route `/emilia` sigue apuntando a `./pages/EmiliaLanding`, que ahora re-exporta la landing nueva).
- No toca schema de DB, migrations ni RLS.
- No borra los 20 componentes legacy bajo `src/features/landing/components/` (Navigation, Footer, EmiliaAI + 17 sin uso) — dead code diferido a PR 4.
- No cambia el layout de las otras pages bajo `/emilia/*` (chat, signup, profile, admin).

**Baseline de tests:**
- Antes de L1 (post-PR-2, main @ `4ce93f67`): **251 passed / 14 skipped / 0 failed**.
- Después de L1 (post-C8 de esta rama): **269 passed / 14 skipped / 0 failed**. +18 casos (7 en `buildPromptChatPath`, 11 en `pendingPrompt`).

## Decisiones cerradas del plan (D1–D13)

Referencia: `docs/plans/landing-redesign-L1-paso1.md` (plan de Paso 1, aprobado antes de ejecutar). Resumen de outcomes:

| # | Decisión | Outcome |
|---|---|---|
| D1 | Layout envolvente de la landing | Wrapper propio `LandingLayout` (navbar + main + footer). No reusa `UnifiedLayout`. |
| D2 | Navbar: shape + scroll behaviour | Sticky, dos estados (transparent → blur+border en `scrollY > 24`). Logo wordmark "Emilia" (sin icono tras amend de C1). Dos anchor links (#ecosystem-agencies, #ecosystem-wholesalers) + LanguageSelector + CTA "Start chatting". Mobile: `<Sheet>` hamburguesa. |
| D3 | Prompt chips: mecanismo de preload | sessionStorage bridge (`emilia:pendingPrompt`). Writer: PromptChip + InspirationCard. Reader: `useChatState.ts` al mount. Ver "Mecanismo del sessionStorage bridge" abajo. |
| D4 | Chat preview del hero | Mockup estático con animación de entrada única (framer-motion `whileInView` fade + slide-up). Sin typing, sin state, sin lógica interactiva. |
| D5 | Ecosystem CTAs "Learn more" | `href="#"` con `aria-disabled="true"` + `pointer-events: none` + badge "Coming soon" i18n. Cero dead-ends, cero dependencias externas. |
| D6 | Inspiration cards | Mismo patrón que PromptChip. 6 prompts naturales traducidos a los 3 idiomas. Navega al chat con el prompt preloadeado vía el mismo bridge de D3. |
| D7 | Secciones 7 y 8 | Dos componentes distintos (`UnderstandPill` no interactivo + `PersonalizationPoint` con icon+label+caption). |
| D8 | Trust / Built by Vibook | Card soft con `vibook-white.png` + eyebrow + headline + subheadline. Sin link corporativo. Sin wordmark en texto separado (el PNG ya incluye wordmark). Alt text reusa `footer.vibookLogoAlt`. |
| D9 | i18n coverage | EN canónico del brief, ES voseo AR, PT-BR. Ninguna fallback-to-EN. |
| D10 | Responsive breakpoints | Tailwind defaults (sm 640, md 768, lg 1024, xl 1280, 2xl 1536). Sin custom. |
| D11 | Theme default | Dark con tokens HSL (no hardcoded `#040814`). Consistente con `ThemeProvider defaultTheme="dark"` del repo. Light mode queda explícitamente fuera de scope (RFC propio si llegara). |
| D12 | Tono visual específico | Inter 400/500/600/700, radii `0.75rem`, `shadow-card` existente, motion sutil (fade+slide-up 16px/400ms/ease-out, `viewport once amount 0.3`), `prefers-reduced-motion` respetado nativamente por framer-motion. |
| D13 | Cómo se reemplaza `EmiliaLanding.tsx` | Re-export de 1 línea hacia `@/features/landing/LandingPage`. Mantiene la convención `src/pages/*` del router en `App.tsx` (18 rutas apuntando a `./pages/<Name>`) sin introducir una excepción por una sola page. Un refactor global `pages/ → features/` sería un RFC independiente. |

## Mecanismo del sessionStorage bridge (opción ii del plan §1.2-D3)

**Por qué sessionStorage y no solo query param.** El plan §1.2-D3 describía dos paths: (i) `navigate('/emilia/chat?prompt=...')` confiando en que `ProtectedRoute` y `Login.tsx` preserven el `?prompt=` end-to-end; (ii) escribir a sessionStorage desde el onClick antes de navegar, independizando el bridge del query URL. En C6, la lectura read-only de `src/pages/Login.tsx:33` reveló:

```tsx
const from = (location.state as any)?.from?.pathname || '/emilia/chat';
navigate(from, { replace: true });
```

`.pathname` descarta el `.search` en el post-auth redirect. En el flow anónimo (click chip → `ProtectedRoute` redirect a `/login?...` preservando location completo → post-login `navigate(state.from.pathname)`) el `?prompt=...` se pierde. Eso invalida la opción (i) pura y activa (ii).

**Contrato:**

- Storage: `window.sessionStorage`.
- Key: `'emilia:pendingPrompt'` (namespace `emilia:` consistente con `STORAGE_KEY = 'emilia-language'` de i18n).
- Valor: string plano (prompt pre-trim, post-decode).
- Lifetime: la tab del navegador (sessionStorage). Sobrevive el round-trip `/emilia` → `/emilia/chat` → `/login` → `/emilia/chat` dentro de la misma tab.
- Semántica consume-once: `consumePendingPrompt()` hace `getItem` + `removeItem` atómicamente; un F5 post-preload no re-dispara.

**Producer (landing):**

- `src/features/landing/lib/pendingPrompt.ts` — `writePendingPrompt(prompt)` + `consumePendingPrompt()` + `PENDING_PROMPT_STORAGE_KEY`.
- SSR-safe (`typeof window === 'undefined'` guard) y try/catch-wrapped (no-ops en privacy mode / quota / SecurityError).
- `PromptChip` y `InspirationCard` llaman `writePendingPrompt(prompt)` antes del `navigate(buildPromptChatPath(prompt))`. La URL también carga el `?prompt=...` como canal redundante — el hook lo limpia defensivamente si llega.

**Consumer (chat):**

- `src/features/chat/hooks/useChatState.ts` — un único useEffect (el que ya existía para `?new=1`) extendido para también `consumePendingPrompt()` al mount. Si retorna string, `updateChatState({ message })`. Ver "Excepción autorizada sobre `src/features/chat/**`" abajo.
- No auto-send: el prompt solo se carga al input para que el user edite o confirme.

**Cross-reference para rebases posteriores:** PR 3 (en `feat/pr3-chat-unification`) refactora fuertemente `ChatFeature.tsx` (+288/-288 vs main) pero NO toca `useChatState.ts`. El bridge de L1 vive exclusivamente en el hook, minimizando el conflict risk al rebasear.

## Excepción autorizada sobre `src/features/chat/**`

El plan de L1 prohibía tocar `src/features/chat/**`. Durante C6 se determinó empíricamente que ninguna solución para el preload del prompt era viable sin tocar al menos un archivo de chat. La evaluación completa, con el user-facing breakdown de opciones y autorización explícita vía `AskUserQuestion`:

**Opciones evaluadas en C6:**

| Opción | Archivo | Diff | Risk vs PR 3 |
|---|---|---|---|
| A | `ChatFeature.tsx` prop `initialInput` | ~6 líneas + firma pública | Alto — PR 3 reescribe ChatFeature casi entero |
| **B** | `useChatState.ts` — extender el useEffect existente de `?new=1` | +20/-5 líneas dentro del useEffect + 1 import | **Mínimo** — PR 3 no toca useChatState.ts |
| C | `ChatFeature.tsx` custom event listener | ~8 líneas siguiendo patrón existente de `chat:retryWithStops` | Alto — mismo archivo que A |
| D | Inyección DOM desde CompanionChatPage | 0 edits en chat | Hacky, race conditions, no recomendable |
| E | Posponer feature a PR post-merge de PR 3 | 0 | Promesa del brief queda parcial |
| F | Chips/cards no-op | 0 en chat | Regression del brief |

**Outcome:** Opción B + activación de opción (ii) del §1.2-D3 (sessionStorage bridge por el hallazgo de `Login.tsx:33`). Autorizada explícitamente por el user en el turn previo al commit C6.

**Diff final en `src/features/chat/`:**

```
src/features/chat/hooks/useChatState.ts | 25 ++++++++++++++++++++-----
1 file changed, 20 insertions(+), 5 deletions(-)
```

- 1 import nuevo (`consumePendingPrompt` desde `@/features/landing/lib/pendingPrompt`).
- useEffect existente (el de `?new=1`) reestructurado para manejar también `?prompt=` (cleanup defensivo) y `consumePendingPrompt()` (lectura del sessionStorage). Sin cambios fuera del useEffect. Sin cambios de firma. Sin nuevos hooks ni exports.
- `updateChatState` agregado al array de deps.

**Dirección del import `chat → landing`**: excepción a la isolation usual entre features, justificada por ownership del contrato. La landing es el protocol definer (key name, shape, consume-once semantics); el chat es el consumer. La utility vive bajo `src/features/landing/lib/` reflejando esa direccionalidad. No se creó equivalente en `src/features/chat/`.

## Archivos tocados

### Nuevos (24 archivos)

**Landing root + layout + navbar + footer (4):**
- `src/features/landing/LandingPage.tsx`
- `src/features/landing/components/LandingLayout.tsx`
- `src/features/landing/components/LandingNavbar.tsx`
- `src/features/landing/components/LandingFooter.tsx`

**Atoms/molecules reusables (10):**
- `src/features/landing/components/SectionEyebrow.tsx`
- `src/features/landing/components/SectionHeading.tsx`
- `src/features/landing/components/PromptChip.tsx`
- `src/features/landing/components/ChatPreview.tsx`
- `src/features/landing/components/EcosystemCard.tsx`
- `src/features/landing/components/StepCard.tsx`
- `src/features/landing/components/FeatureCard.tsx`
- `src/features/landing/components/InspirationCard.tsx`
- `src/features/landing/components/UnderstandPill.tsx`
- `src/features/landing/components/PersonalizationPoint.tsx`

**Secciones (10):**
- `src/features/landing/sections/Hero.tsx`
- `src/features/landing/sections/Ecosystem.tsx`
- `src/features/landing/sections/HowItWorks.tsx`
- `src/features/landing/sections/PromptDemo.tsx`
- `src/features/landing/sections/HelpsWith.tsx`
- `src/features/landing/sections/Inspiration.tsx`
- `src/features/landing/sections/Understands.tsx`
- `src/features/landing/sections/Personalized.tsx`
- `src/features/landing/sections/Trust.tsx`
- `src/features/landing/sections/FinalCta.tsx`

**Utilities compartidas (2):**
- `src/features/landing/lib/buildPromptChatPath.ts`
- `src/features/landing/lib/pendingPrompt.ts`

**Tests (2):**
- `src/features/landing/__tests__/buildPromptChatPath.test.ts` (7 casos)
- `src/features/landing/__tests__/pendingPrompt.test.ts` (11 casos)

**Docs (1):**
- `docs/prs/landing-redesign-L1.md` (este archivo)

### Modificados (7)

- `src/pages/EmiliaLanding.tsx` — reescrito a re-export de 1 línea (C8).
- `src/i18n/locales/en/landing.json` — reescrito entero con keys nuevas del brief (C1).
- `src/i18n/locales/es/landing.json` — reescrito entero, voseo AR (C1).
- `src/i18n/locales/pt/landing.json` — reescrito entero, PT-BR (C1).
- `src/features/chat/hooks/useChatState.ts` — sessionStorage bridge reader (C6). Ver sección de excepción autorizada.
- `vite.config.ts` — una línea aditiva en `test.include` para `src/features/landing/__tests__/*.test.ts` (C7).
- `docs/prs/landing-redesign-L1.md` — no aplica (archivo nuevo listado arriba).

### NO tocados (explícito — verificación empírica en C8)

- `src/App.tsx` — `git diff --stat main..HEAD -- src/App.tsx` = vacío. Confirmado.
- `src/features/chat/ChatFeature.tsx` y cualquier otro archivo bajo `src/features/chat/**` excepto `useChatState.ts`. Confirmado vía `git diff --stat main..HEAD -- src/features/chat/`.
- Motor compartido: `conversationOrchestrator`, `routeRequest`, `itineraryPipeline`, `useMessageHandler`, `useChat`.
- Edge functions (`planner-agent`, `consumer-signup`, etc.).
- `tripService.ts`, `usePlannerState.ts`, hooks del trip planner.
- `AuthContext.tsx`, `RequireConsumer.tsx`, `RequireAgent.tsx`, `UnifiedLayout.tsx`, `MainLayout.tsx`, `CompanionLayout.tsx`.
- `ItineraryPanel`, `HandoffBanner`, `HandoffModal`, `ChatInterface.tsx`, `ChatHeader.tsx`, `ModeSwitch.tsx`.
- Schema de DB, migrations, RLS policies.
- `src/pages/Login.tsx` (ver Deuda).
- Los 20 componentes legacy bajo `src/features/landing/components/` (`Navigation`, `Footer`, `EmiliaAI` + 17 sin uso).

## Dead code post-L1 (barrido en PR 4)

Los siguientes archivos pierden sus últimos consumers productivos tras el swap en C8 y quedan como dead code acumulable para la PR de purga general:

- `src/features/landing/components/Navigation.tsx` — legacy sticky navbar con CTAs a `app.vibook.ai/{login,signup}` (host externo).
- `src/features/landing/components/Footer.tsx` — legacy 4-column footer con copy ES hardcoded.
- `src/features/landing/components/EmiliaAI.tsx` — legacy chat demo con typing animation y quick prompts B2B.
- 17 componentes adicionales sin uso desde la landing actual: `Hero.tsx` (legacy), `LandingHero3D.tsx`, `AboutUs.tsx`, `Features.tsx`, `Pricing.tsx`, `Showcase.tsx`, `Testimonial.tsx`, `VibookServicesLanding.tsx`, `Card3D.tsx`, `CursorGlow.tsx`, `MagneticButton.tsx`, `Marquee.tsx`, `TextScramble.tsx`, `TravelRoutesScene.tsx`, `TravelRoutesFallback.tsx`, `LandingSceneBackground.tsx`, `LandingScrollProgress.tsx`.

Se mantuvieron en disco deliberadamente: borrarlos en L1 mezcla scope de feature + cleanup, y PR 4 ya tiene el backlog de dead code de la auditoría original (`docs/B2C_STATUS.md` sección "Dead code pendiente para PR 4").

## Deuda registrada

1. **`Login.tsx:33` descarta `location.search` en post-auth redirect.** Hallazgo empírico de C6. El código hace `const from = (location.state as any)?.from?.pathname || '/emilia/chat'` — cualquier query param en el `from` original se pierde. Afecta cualquier deep-link que pase por `/login`, no solo el prompt preload de L1. L1 lo bordea con sessionStorage. **Fix: ticket separado.** Opciones para el fix: usar el objeto location completo (`navigate(state.from, { replace: true })`) o construir explícitamente path + search + hash. Requiere también que `ProtectedRoute` siga guardando el location completo (hoy ya lo hace).
2. **Marcadores `REVIEW_PT` en traducciones PT** de `landing.json` en keys donde la traducción puede requerir revisión nativa. No bloqueante para merge (el fallback de i18next no aplica porque PT está completo, solo la calidad del matiz puede ajustarse). Ver §1.2-D9 del plan.
3. **Sin analytics en CTAs.** La landing no trackea conversiones de "Start chatting", prompt chips, inspiration cards, ecosystem CTAs. Trabajo aditivo post-L1.
4. **Sin A/B testing harness.** No existe en el repo. Para iterar copy + CTAs a futuro.
5. **Sin asset Emilia dedicado.** El navbar usa wordmark text-only ("Emilia" en `text-xl font-semibold`). Si la brand team provee un SVG, se agrega como cambio aditivo mínimo al `LandingNavbar`.
6. **Light mode** — fuera de scope de L1 (D11). Si llega, RFC propio con cambio global de convención de theme.
7. **`vibook-white.png`** — asset existente reusado en Trust + LandingFooter. Si a futuro se quiere un logo diferenciado para Emilia (sin Vibook), es un asset nuevo + swap puntual.
8. **Manifest iterable de secciones + `getLandingNavSections` utility** — no extraídos en C7 por regla de "no crear utilities nuevas en commit de tests". Hoy `LandingPage.tsx` hardcodea JSX y `LandingNavbar.tsx` tiene `NAV_LINKS` como const privada inline. Refactor opcional post-L1.

## Reglas de proceso aprendidas durante L1

Acumuladas de sesiones previas + L1:

1. **Desvíos de decisiones cerradas explícitas se preguntan antes de commitear.** Establecida post-C2 cuando el mobile ordering del Hero se desvió del plan §1.15 y requirió amend.
2. **Desvíos legítimos sin preguntar: micro-decisiones cosméticas genuinas.** Shade de hover, gap de pixels, icono específico dentro de la paleta lucide autorizada. Se listan explícitos en el body del commit pero no requieren pregunta previa.
3. **Nunca commitear "me desvié del plan pero si querés lo cambio".** Invierte la carga de la prueba y fuerza un amend cada vez.
4. **Hallazgos que invalidan decisiones autorizadas disparan parada obligatoria.** Establecida post-C6 cuando el hallazgo de `Login.tsx:33` debería haber parado la ejecución antes de implementar sessionStorage — en cambio fui directo a implementar y lo reporté post-facto. El user ratificó retroactivamente `c4244ae8` bajo la regla nueva. El caso C6 queda documentado como canónico: costo de parar = un mensaje; costo de no parar = commit que representa una decisión no autorizada + proceso de revisión invertido.

## Smoke checklist (ejecución humana requerida — Claude Code no puede correrlo)

Estado: **pendiente de ejecución humana vía `npm run dev`**. Claude Code verificó tsc + build + test automáticamente; el smoke visual/funcional lo corre Francisco. Items (§1.14 del plan):

- [ ] **a. `/emilia` anónima** — 10 secciones en orden, sin overflow horizontal, sin keys i18n undefined.
- [ ] **b. Responsive 4 breakpoints** — 375 (mobile CTAs full-width, ChatPreview after text block, chips wrap sin scroll), 768 (Ecosystem/HelpsWith/Inspiration 2 cols), 1024 (Hero 2 cols, grids 3 cols, navbar muestra los 2 anchor links), 1440 (idem 1024 con más aire lateral).
- [ ] **c. CTAs funcionales** — Start chatting → `/emilia/chat` (→ `/login?from=...` si anónimo); See how it works → anchor scroll a §3; navbar Agencies → scroll a `#ecosystem-agencies`; navbar Wholesalers → scroll a `#ecosystem-wholesalers`; prompt chip → `/emilia/chat?prompt=...`; InspirationCard → `/emilia/chat?prompt=...`; Ecosystem CTA → disabled + badge "Coming soon" visible; FinalCta → mismo comportamiento que hero.
- [ ] **d. Flow end-to-end del prompt preload** — (d1) logueado: click chip → chat con input preloadeado exacto; (d2) anónimo: click chip → login → post-auth lleva al chat con input preloadeado exacto (valida sessionStorage bridge); (d3) URL sin `?prompt=` post-preload; (d4) F5 post-preload no re-dispara (sessionStorage consumido, URL limpia).
- [ ] **e. i18n switch EN/ES/PT** — copy correcta por idioma en las 10 secciones. PT con marcadores `REVIEW_PT` donde apliquen (deuda anotada).
- [ ] **f. Motion** — fade+slide-up se dispara una vez por sección al scroll. DevTools `prefers-reduced-motion: reduce` + recarga → entradas instantáneas.
- [ ] **g. Accesibilidad spot-check** — Tab navigation en CTAs/chips/navbar/InspirationCards; focus-visible ring en todos los interactivos; DOM tiene exactamente 1 `<h1>` + 9 `<h2>`; alt text en `<img>` del Trust; ningún link apuntando a `/emilia/login` (ruta muerta post-PR-2).
- [ ] **h. Consola DevTools limpia** — sin errores ni warnings nuevos introducidos por L1. Warnings pre-existentes del repo (p.ej. `optimizeDeps.esbuildOptions` deprecation de vite-swc plugin) no bloquean.

**Regla de parada aplicable al smoke:** items estructurales (p.ej. d2 — prompt no llega al chat post-login) bloquean el merge y requieren fix + amend/commit adicional. Items cosméticos menores (spacing raro en un breakpoint específico) se anotan y se arreglan inline si son triviales, o se difieren como deuda menor post-merge.

## Verificación ejecutada (automática en C8)

- [x] `npx tsc --noEmit` — exit 0.
- [x] `npm run build` — exit 0, ~15–16s, warning pre-existente de chunk size de `ChatFeature` (no introducido por L1).
- [x] `npm test -- --run` — **269 passed / 14 skipped / 0 failed** (+18 sobre baseline de 251).
- [x] `git diff --stat main..HEAD -- src/features/chat/` — solo `useChatState.ts`, +20/-5 líneas. Confirmado que no hay fuga de scope hacia chat más allá de la excepción autorizada de C6.
- [x] `git diff --stat main..HEAD -- src/App.tsx` — vacío. Router no tocado.

<details>
<summary>Output — npm test (sin SUPABASE_SERVICE_ROLE_KEY)</summary>

```
 Test Files  24 passed | 1 skipped (25)
      Tests  269 passed | 14 skipped (283)
```

269 = 251 baseline + 18 nuevos (7 buildPromptChatPath + 11 pendingPrompt).
14 skipped = baseline sin cambios.
</details>

## Commits

1. `619806b2` — `feat(landing): scaffold new landing + rewrite landing i18n (C1 of L1)` (amended)
2. `f2325cd0` — `feat(landing): implement Hero + Ecosystem sections with primitives (C2 of L1)` (amended)
3. `4bd54547` — `feat(landing): implement HowItWorks + PromptDemo + HelpsWith sections (C3 of L1)`
4. `af27f57f` — `feat(landing): implement Inspiration + Understands + Personalized sections (C4 of L1)`
5. `65e433e2` — `feat(landing): implement Trust + FinalCta and retrofit Ecosystem motion (C5 of L1)`
6. `c4244ae8` — `feat(landing): bridge landing prompts to chat input via sessionStorage (C6 of L1)` (ratificado retroactivamente tras análisis empírico de Login.tsx; ver "Excepción autorizada" y "Reglas de proceso aprendidas")
7. `15cf3453` — `test(landing): unit tests for buildPromptChatPath + pendingPrompt (C7 of L1)`
8. _(este commit)_ — `feat(landing): swap /emilia entry to new LandingPage + PR doc (C8 of L1)`

## Dependencia previa

- [PR 2 — unificación routing + layouts](../B2C_STATUS.md) — merge commit `4ce93f67`. Provee `UnifiedLayout`, `/emilia/*` route tree, login unificado en `/login`.
- [ADR-002 — chat unification](../adr/ADR-002-chat-unification.md) — baseline arquitectónico del producto Emilia.

## Next

- PR 3 (en progreso en `feat/pr3-chat-unification`) — chat con switch agency/passenger + Nivel 2 de continuidad. Se mergea después de L1 y rebasea limpiamente (L1 toca `useChatState.ts`, PR 3 no).
- PR 4 — purga de dead code acumulado: Navigation/Footer/EmiliaAI legacy + 17 componentes landing sin uso + CRM/Marketplace/Reports + handoff + `MainLayout`/`CompanionLayout` deprecados + `standard_itinerary`.
- Deuda anotada arriba: fix de `Login.tsx:33` (ticket separado), review PT nativo, analytics, A/B harness, asset Emilia dedicado, light mode RFC.
