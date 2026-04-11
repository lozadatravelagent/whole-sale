# PR: Paso 4 — Registro / perfil consumer B2C

## Scope

Cierra el Paso 4 del roadmap macro post-Paso 3: flujo de signup/login dedicado para consumers B2C bajo `/emilia/signup`, `/emilia/login`, y `/emilia/profile`. Una edge function nueva `consumer-signup` crea el auth user + public.users row con `account_type='consumer'` y `role='CONSUMER'` usando el service role (necesario para setear `app_metadata`). Post-signup, el cliente hace auto-signin y aterriza en `/emilia/chat`. El perfil mínimo ofrece view del email + lista de "Mis viajes" del consumer usando `listTripsByUser` style query, con botón de logout.

Además, fix de un bug conocido en `RequireConsumer`: cuando un consumer perdía sesión, era redirigido a `/login` (B2B) en lugar de `/emilia/login`. Ahora va al flow B2C correcto.

**El motor compartido, el auth B2B (`Login.tsx`, `create-user` edge function, `Users.tsx`, `ProtectedRoute`), y todo Paso 1/2/3 quedan intactos.**

## Problema que resuelve

Post-Paso 3, Emilia B2C es funcional pero **no hay forma de que un consumer se registre o haga login desde la UI**. El signup existente (`Users.tsx` en CRM) es B2B-only: requiere un caller autenticado con permisos de OWNER/ADMIN, y la edge function `create-user` valida roles B2B (OWNER → cualquier rol, ADMIN → SELLER). Un consumer no tiene cómo crearse cuenta.

Además, el client-side `supabase.auth.signUp()` no puede setear `app_metadata.account_type='consumer'` — solo el service_role puede modificar `app_metadata`. Eso significa que un signup directo desde el cliente crearía un auth user con JWT claims incompletos, rompiendo la lectura de `account_type` en `AuthContext` y todas las RLS policies que dependen de `get_user_account_type()`.

Antes de esta PR:
- `/emilia` (landing) tenía dos CTAs que apuntaban a `https://app.vibook.ai` (URL externa, dead link para el flow interno).
- `RequireConsumer` redirigía users sin sesión a `/login` B2B (bug UX).
- No existía `/emilia/signup`, `/emilia/login`, ni `/emilia/profile`.

## Que cambia

### `supabase/functions/consumer-signup/index.ts` (nueva edge function)

Endpoint público (sin JWT header requerido) que crea una cuenta consumer B2C. ~140 líneas.

**Input**: `{ email, password, name }`

**Flujo**:
1. Validación mínima: `email + password + name` presentes, `password.length >= 8`.
2. Crea cliente admin con `SUPABASE_SERVICE_ROLE_KEY`.
3. `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name }, app_metadata: { user_role: 'CONSUMER', account_type: 'consumer' } })` — setea los JWT claims que `AuthContext` y las RLS policies consumen.
4. Insert en `public.users` con `id`, `email`, `name`, `role='CONSUMER'`, `account_type='consumer'`, `agency_id=null`, `tenant_id=null`, `provider='email'`. El CHECK constraint `users_account_type_role_check` de Paso 1.1.a fuerza la pareja correcta (`account_type='consumer'` ↔ `role='CONSUMER'`).
5. Rollback en `auth.admin.deleteUser()` si el insert a `public.users` falla — evita orphan rows.
6. Responde `{ success: true, user: { id, email, name } }` o error estructurado.

**Design notes**:
- Paralela a `create-user/index.ts` pero **intencionalmente separada**. No mezcla flows — `create-user` sigue siendo B2B-only con permission checks, `consumer-signup` es B2C self-service sin permisos.
- `email_confirm: true` salta la verificación de email por mail (mejor UX para MVP). Follow-up para agregar flow de verification si el producto lo requiere.
- NO rate-limit en esta PR — TODO comment documentado en el header. Follow-up con Upstash Redis o similar.
- Reusa `_shared/cors.ts` sin modificaciones.
- **NO se deploya automáticamente** — política D13. El usuario hace `supabase functions deploy consumer-signup` manualmente tras review.

### `src/features/companion/utils/consumerAuthSchema.ts` (nuevo)

Zod schemas puros para validación de forms:

- `consumerSignupSchema`: name min 2 + email formato + password min 8 + confirmPassword refinement (`password === confirmPassword`). Trims name/email.
- `consumerLoginSchema`: email + password required.

### `src/features/companion/utils/authRedirectDecider.ts` (nuevo)

Función pura `decideAuthRedirectAction(inputs): 'wait' | 'none' | 'chat' | 'dashboard'`. Consolida la lógica de auto-redirect que usan `ConsumerSignup` y `ConsumerLogin` cuando detectan que el user ya está autenticado:

- Auth loading → `'wait'` (no navegar todavía)
- No user → `'none'` (mostrar el form)
- Consumer autenticado → `'chat'` (redirect a `/emilia/chat`)
- Agent autenticado → `'dashboard'` (redirect a `/dashboard`, este es el producto B2C)
- Anything else → `'none'`

Extraída a función pura para testing sin DOM/router/auth mocks.

### `src/features/companion/services/consumerAuthService.ts` (nuevo)

Thin wrappers sobre Supabase Auth + la edge function:

- `signUpConsumer({ name, email, password })` → llama `supabase.functions.invoke('consumer-signup', ...)` y devuelve un resultado discriminado `{ ok: true, userId } | { ok: false, message }`.
- `signInConsumer(email, password)` → pass-through sobre `supabase.auth.signInWithPassword` con el mismo shape de resultado.
- `signOutConsumer()` → pass-through sobre `supabase.auth.signOut`.
- `fetchUserAccountType(userId)` → query directo a `public.users` para obtener `account_type`, usado por `ConsumerLogin` para detectar si el user recién autenticado es agent (redirect a `/dashboard` con toast warning).

Todas las funciones devuelven resultados tipados sin throw, para que los callers manejen errors con toasts.

### `src/pages/ConsumerSignup.tsx` (nueva)

Page pública en `/emilia/signup`. Usa `react-hook-form` + `zodResolver(consumerSignupSchema)` — mismo pattern que `HandoffModal` de Paso 2.

**Fields**: nombre, email, password, confirmPassword.

**Flow**:
1. Auto-redirect al mount via `decideAuthRedirectAction` (si user ya logueado).
2. Submit: `signUpConsumer` → si OK, `signInConsumer` auto → navigate `/emilia/chat` con toast success.
3. Si `signUpConsumer` falla: toast destructive, stay on page.
4. Si `signUpConsumer` OK pero `signInConsumer` falla (edge case): toast "Cuenta creada, iniciá sesión" + navigate `/emilia/login`.

**Layout**: full-page centered Card con shadcn primitives (`Card`, `Input`, `Label`, `Button`), fondo dark coherente con `EmiliaLanding` (`bg-[#040814]`), header con `Sparkles` icon + brand "Emilia". No usa `CompanionLayout` (user aún no autenticado).

Link "¿Ya tenés cuenta? Iniciá sesión" → `/emilia/login`.

### `src/pages/ConsumerLogin.tsx` (nueva)

Page pública en `/emilia/login`. Misma estética que `ConsumerSignup`.

**Fields**: email, password.

**Flow**:
1. Auto-redirect al mount via `decideAuthRedirectAction`.
2. Submit: `signInConsumer`.
3. Si OK: `fetchUserAccountType(userId)` para confirmar que es consumer:
   - `'consumer'` → navigate `/emilia/chat`.
   - `'agent'` → toast warning + navigate `/dashboard`.
   - `null` (ni agent ni consumer — edge case): toast error + `signOutConsumer`.
4. Si signin falla: toast destructive.

**Nota crítica**: el chequeo de `accountType` post-signin es necesario porque un agent podría usar este form por error. La CHECK constraint de DB garantiza que el role es consistente con account_type, pero esta UI redirige al agent a su workspace B2B en lugar de dejarlo en la B2C interface.

Link "¿No tenés cuenta? Crear una" → `/emilia/signup`.

### `src/pages/ConsumerProfile.tsx` (nueva)

Page autenticada en `/emilia/profile` (wrapped en `RequireConsumer`). Usa `CompanionLayout` (ya hay sesión).

**Secciones**:

1. **Tu perfil** (Card):
   - Email del user (read-only)
   - Botón "Cerrar sesión" → `signOutConsumer` + navigate `/emilia`

2. **Mis viajes** (Card):
   - Query directo a `supabase.from('trips').select(...).eq('owner_user_id', user.id).eq('account_type', 'consumer').neq('status', 'archived').order('updated_at desc')`.
   - **Nota**: NO usa `listTripsByUser` de `tripService.ts` porque esa función no devuelve `conversation_id` (el shape `TripRow` no lo incluye), y necesito ese field para linkear al chat. Hago un query custom local al profile page — self-contained, no toca el motor, no requiere modificar `TripRow`.
   - Estados UI: loading (spinner), error (mensaje), empty (CTA "Empezar ahora" → `/emilia/chat`), list (cards con destino, fechas, status label en español).
   - Cada trip card linkea a `/emilia/chat/:conversationId` si hay `conversation_id`, sino a `/emilia/chat` (fallback).

**NO** hay editing de nombre/email, **NO** hay avatar upload, **NO** hay preferences. Follow-ups explícitos.

### `src/components/RequireConsumer.tsx` (modificado — fix de bug)

Cambio de 1 línea: `navigate('/login', ...)` → `navigate('/emilia/login', ...)` cuando `action === 'redirect-login'`. El branch `'redirect-home'` (user autenticado pero no consumer) queda igual, redirige a `/`.

**Sin regresión para B2B**: `ProtectedRoute` (que usan las rutas B2B) sigue redirigiendo a `/login` como antes. Solo `RequireConsumer` (que solo protege `/emilia/*`) cambia su destino de redirect.

### `src/pages/EmiliaLanding.tsx` (modificado)

Reemplaza los 2 CTAs externos por links internos usando React Router `<Link>`:

- Hero "Empezar gratis" → `/emilia/signup` (antes era `https://app.vibook.ai`)
- CTA final "Crear cuenta gratis" → `/emilia/signup`
- **Nuevo link secundario** debajo del CTA del hero: "¿Ya tenés cuenta? Iniciá sesión" → `/emilia/login`

Preserva el look dark con gradientes. No toca `Navigation`, `EmiliaAI`, ni `Footer`.

### `src/App.tsx` (modificado)

Agrega 3 lazy imports (`ConsumerSignup`, `ConsumerLogin`, `ConsumerProfile`) y 3 rutas:

- `/emilia/signup` → `<ConsumerSignup />` (pública)
- `/emilia/login` → `<ConsumerLogin />` (pública)
- `/emilia/profile` → `<RequireConsumer><ConsumerProfile /></RequireConsumer>` (autenticada)

Rutas existentes de `/emilia`, `/emilia/chat`, `/emilia/chat/:conversationId` sin cambios. `LegacyCompanionRedirect` sin cambios — no interfiere con las rutas nuevas.

## Que NO se toco

- **Motor compartido**: `tripService`, `usePlannerState`, `useTripPlanner`, `useMessageHandler`, `conversationOrchestrator`, `planner-agent/`. Nada.
- **Auth B2B**: `src/pages/Login.tsx`, `src/pages/Users.tsx`, `supabase/functions/create-user/index.ts`, `useUsers.ts` hook — todos intactos. El B2B sigue funcionando idéntico.
- **`ProtectedRoute`**: sin cambios. Las rutas B2B siguen redirigiendo a `/login` B2B.
- **`AuthContext`**: sin cambios de signature. Ya exponía `isAgent`/`isConsumer` desde Paso 1.
- **`MainLayout`**, `ChatSidebar` B2B, rutas B2B, `CRM`, `Dashboard`, `Marketplace`, `Reports`, `Users`, `Agencies`, `Tenants`, `Settings`, `HotelbedsTest` — ninguno tocado.
- **Paso 1/2/3**: `CompanionLayout`, `ChatSidebarCompanion`, `CompanionChatPage`, `HandoffBanner`, `HandoffModal`, `handoffService`, `ItineraryPanel`, `hasItineraryContent`, `isTripReadyForHandoff` — todos intactos. `RequireConsumer` solo cambia el path de redirect (1 línea).
- **RLS policies**, migrations SQL — sin cambios. No hay migration en esta PR.
- **`src/integrations/supabase/types.ts`** — sin regen. El schema DB no cambió.
- **`TripRow` interface y `listTripsByUser`** — sin cambios. `ConsumerProfile` usa un query local con `conversation_id` sin tocar el motor.
- **`vite.config.ts`** — sin cambios. El path `src/features/companion/__tests__/*.test.ts` ya estaba incluido desde Paso 2.

## Tests

### 15 unit tests nuevos en 2 archivos

**`src/features/companion/__tests__/consumerAuthSchema.test.ts`** (9 tests):

- Signup: payload válido → pasa
- Signup: nombre vacío → error en `name`
- Signup: email inválido → error en `email`
- Signup: password < 8 chars → error en `password`
- Signup: password + confirmPassword mismatch → error en `confirmPassword`
- Signup: whitespace en name/email se trimea
- Login: payload válido → pasa
- Login: email vacío → error
- Login: password vacío → error

**`src/features/companion/__tests__/authRedirectDecider.test.ts`** (6 tests):

- `loading === true` → `'wait'`
- Sin user → `'none'`
- Consumer autenticado → `'chat'`
- Agent autenticado → `'dashboard'`
- Loading prioritiza sobre todo lo demás
- User sin flags de account type → `'none'` (edge case)

### Tests NO escritos (scope cut)

- **Edge function `consumer-signup`**: requiere runtime Deno para testing local. Smoke manual post-deploy. Follow-up: integration tests cuando haya infra.
- **Render tests** de `ConsumerSignup`, `ConsumerLogin`, `ConsumerProfile`: `@testing-library/react` + jsdom siguen fuera del repo. Lógica cubierta vía funciones puras testeadas (schema + decider).
- **Integration tests** del flow completo signup → auto-signin → redirect: requiere dev env con Supabase y edge function deployada.

### Baseline

- **Pre-PR** (main @ `98dfb8d1`): 205 passed / 14 skipped / 2 failed suites (D11)
- **Post-PR**: **220 passed / 14 skipped / 2 failed suites (D11)** — 205 + 15 nuevos
- **Build**: limpio (20.6s)
- **TypeScript**: `tsc --noEmit` exit 0
- **Lint**: sin nuevas warnings en archivos nuevos o modificados

## Verificación ejecutada

- [x] `npm test` → **220 / 14 / 2** ✅
- [x] `npm run build` limpio ✅
- [x] `npx tsc --noEmit` exit 0 ✅
- [x] 15 tests nuevos verdes (9 schema + 6 decider)
- [x] 205 tests pre-existentes verdes sin regresión
- [ ] **Deploy de edge function a prod** — NO ejecutado (política D13). Usuario hace `supabase functions deploy consumer-signup --linked` manualmente tras review. La UI hasta que se deploye la función va a fallar en el `functions.invoke` con un 404/network error — documentado como paso manual.
- [ ] Smoke manual con consumer creado vía flow nuevo:
  1. Visitar `/emilia` → click "Empezar gratis" → llega a `/emilia/signup`
  2. Completar form con email válido y password de 8+ chars → enviar
  3. Auto-signin después del signup → aterriza en `/emilia/chat`
  4. Verificar en DB: `public.users` tiene fila con `role='CONSUMER'`, `account_type='consumer'`, `agency_id=null`, `tenant_id=null`
  5. Verificar que `auth.users.raw_app_meta_data` tiene `user_role: 'CONSUMER'` y `account_type: 'consumer'`
  6. Logout desde `/emilia/profile` → visitar `/emilia/chat` → redirect a `/emilia/login` (no a `/login` B2B)
  7. Loguear de vuelta → volver a `/emilia/chat`
  8. Visitar `/emilia/profile` → ver email + lista de trips propios (vacía si es cuenta nueva)
- [ ] Smoke manual: agent logueado visita `/emilia/login` → auto-redirect a `/dashboard`
- [ ] Smoke manual: agent logueado visita `/emilia/signup` → auto-redirect a `/dashboard`
- [ ] Smoke manual: agent hace login en `/emilia/login` con sus credenciales → `fetchUserAccountType` devuelve `'agent'` → toast warning + redirect a `/dashboard`
- [ ] Verificar que el flow B2B sigue funcionando: `Login.tsx` en `/login`, creación de users desde CRM en `/users`, `ProtectedRoute` en todas las rutas B2B

## Riesgos

- **R1 — Edge function sin rate limit**: un atacante puede crear cuentas en batch (spam/abuse). **Mitigación**: aceptable para MVP/beta. TODO comment en el header de la función. Follow-up con Upstash Redis o similar (ya disponible en el proyecto vía otras funciones).
- **R2 — Email verification skipped (`email_confirm: true`)**: user puede signup con email de tercero. **Mitigación**: documentado como follow-up. Producto decide si agrega flow de verification con link mail.
- **R3 — Auto-signin post-signup falla**: user queda en limbo ("cuenta creada pero no logueada"). **Mitigación**: fallback toast + redirect a `/emilia/login` con la cuenta ya creada. El user completa el login manual con sus credenciales.
- **R4 — Agent autenticado accede a `/emilia/signup` o `/emilia/login`**: auto-redirect a `/dashboard` via `decideAuthRedirectAction`. Sin UX confusa.
- **R5 — Fix de `RequireConsumer` cambia comportamiento observable**: consumers que hoy perdieron sesión en `/emilia/chat` iban a `/login` B2B. Post-fix van a `/emilia/login`. **No es regresión** — es un fix de UX. Pero es un cambio observable, documentado aquí.
- **R6 — Edge function no deployeada al momento del merge**: el signup va a fallar con network error hasta que el usuario ejecute `supabase functions deploy consumer-signup`. **Mitigación**: documentado en la verificación y en los follow-ups como paso manual post-merge.
- **R7 — `ConsumerProfile` query directo sin RLS check**: el query usa el cliente autenticado del consumer, y las RLS policies `consumer_select_own_trips` de Paso 1.1.a ya garantizan que solo vea sus propios trips. El `.eq('owner_user_id', user.id)` es defense-in-depth explícito.
- **R8 — `fetchUserAccountType` fallback**: si la query a `public.users` falla tras un signin exitoso, el user queda sin clasificar. El código hace `signOutConsumer()` + toast error en ese caso para mantener el estado consistente.
- **R9 — Duplicate email en signup**: `auth.admin.createUser` devuelve error con mensaje que contiene "already" — el handler de la edge function mapea eso a "Ya existe una cuenta con ese email." antes de devolver al cliente.

## Follow-ups explícitos

1. **Deploy manual de edge function a prod** — `supabase functions deploy consumer-signup --linked`. Política D13.
2. **Rate limit** en `consumer-signup` con Upstash Redis o equivalente.
3. **Email verification flow** — si el producto requiere trust level, implementar verification link con `email_confirm: false` + template de email.
4. **Edit de nombre/email** en `ConsumerProfile`.
5. **Avatar upload** para el profile (requiere storage bucket + policies).
6. **Preferences** del consumer (idioma, moneda preferida, estilos de viaje favoritos).
7. **Forgot password flow** — `supabase.auth.resetPasswordForEmail()` con page dedicada en `/emilia/forgot-password`.
8. **Social auth** (Google, Apple) para consumer signup — paralelo al Google OAuth del B2B Login.
9. **Render tests** con `@testing-library/react` + jsdom cuando se instale la infra.
10. **Integration tests** del flow `consumer-signup` contra Supabase local con service role key.
11. **`Role` type extension** — incluir `'CONSUMER'` en el enum TypeScript del frontend (gap desde 1.1.a, todavía pendiente).
12. **Logout desde header** — agregar opción "Cerrar sesión" en el `CompanionLayout` header (hoy solo se puede desde `/emilia/profile`).

## Commits

1. `feat(companion): add consumer auth Zod schema + redirect decider + tests`
2. `feat(edge): add consumer-signup edge function`
3. `feat(companion): add consumerAuthService wrappers`
4. `feat(auth): add ConsumerSignup + ConsumerLogin pages`
5. `feat(auth): add ConsumerProfile page with Mis viajes list`
6. `fix(auth): RequireConsumer redirects to /emilia/login instead of B2B login`
7. `feat(landing): replace external CTAs with internal /emilia/signup links`
8. `feat(routes): add /emilia/signup, /emilia/login, /emilia/profile`
9. `docs(prs): add Paso 4 consumer auth PR description`

## Dependencias previas

- [Fase 1.1.a — B2C ownership schema](1.1.a-b2c-ownership.md) (merged) — proporciona el `account_type` column + `get_user_account_type()` helper + CHECK constraint `(account_type='consumer' AND role='CONSUMER')`.
- [Fase 1.1.e — listTripsByUser](1.1.e-f-g-b2c-trips-cleanup.md) (merged PR #63) — pattern de query B2C por `owner_user_id`.
- [Paso 1 — Structural separation](paso1-structural-separation.md) (merged PR #64) — `RequireConsumer`, `isAgent/isConsumer` en `AuthContext`, rutas `/emilia/*`.
- [Paso 2 — Human handoff modal](paso2-human-handoff-modal.md) (merged PR #65) — pattern de Zod schema + react-hook-form + shadcn Dialog.
- [Paso 3 — Itinerary panel](paso3-itinerary-panel.md) (merged PR #66) — último paso antes de Paso 4.

## Next

Pasos 5 del roadmap macro + follow-ups técnicos:

5. **Capa social** — feed de viajes públicos, perfiles compartibles, likes/guardados. Requiere el profile B2C que esta PR inicia.

Follow-ups inmediatos post-merge:
- Deploy manual de `consumer-signup` edge function a prod
- Smoke testing del flow completo end-to-end
- Inbox B2C en CRM (leads con `agency_id IS NULL`) — follow-up de Paso 2 que quedó pendiente
- `RequireAgent` guards en rutas B2B — follow-up de Paso 1
