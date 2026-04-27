# Fix: consumer cannot create conversations ("User has no agency assigned")

## Scope

Bug-fix surgical PR. Two layers were blocking a consumer from creating their first conversation in `/emilia/chat` after Paso 4 (consumer auth) merged:

1. **JS check** in `src/hooks/useChat.ts:223` threw `"User has no agency assigned"` because `canHaveNullAgency` only included `OWNER` and `SUPERADMIN` — `CONSUMER` was added in Paso 1.1.a but this guard was never updated.
2. **RLS policy** `conversations_insert_policy` (defined in `20260309000001_rls_use_jwt_claims.sql`) required `agency_id = public.get_user_agency_id()`. For a consumer both sides are `NULL`, and Postgres evaluates `NULL = NULL` as `NULL` (treated as `FALSE` inside `WITH CHECK`), so the insert was silently rejected at the DB layer even after fixing the JS check.

This PR fixes both layers with the minimum possible change. **Motor compartido and the B2B path are intacto bit-a-bit.**

## Que cambia

### `src/hooks/useChat.ts` (1-line fix)

```ts
// Before:
const canHaveNullAgency = userRole === 'OWNER' || userRole === 'SUPERADMIN';

// After:
const canHaveNullAgency =
  userRole === 'OWNER' || userRole === 'SUPERADMIN' || userRole === 'CONSUMER';
```

A short comment was added above to explain the CONSUMER case alongside the existing OWNER/SUPERADMIN comment.

**Why `userRole === 'CONSUMER'` and not `accountType === 'consumer'`**: `userData` in this scope only loads `{agency_id, tenant_id, role}` (line 208-212). It does not fetch `account_type`. Using `role === 'CONSUMER'` avoids extending the SELECT, and is semantically equivalent because the CHECK constraint `users_account_type_role_check` from Paso 1.1.a guarantees the pair `(account_type='consumer', role='CONSUMER')`.

### `supabase/migrations/20260411000002_consumer_conversations_rls.sql` (new, additive)

```sql
DROP POLICY IF EXISTS "consumer_insert_own_conversations" ON public.conversations;

CREATE POLICY "consumer_insert_own_conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_account_type() = 'consumer'
    AND created_by = auth.uid()
    AND agency_id IS NULL
    AND tenant_id IS NULL
  );
```

**Pattern matches** the consumer-specific policies added in earlier B2C phases:
- `consumer_select_own_trips`, `consumer_insert_own_trips`, `consumer_update_own_trips` (Paso 1.1.a)
- `consumer_insert_handoff_leads` (Paso 2)

**Postgres RLS for INSERT**: the row must satisfy `WITH CHECK` of **at least one** policy. Agents satisfy the existing `conversations_insert_policy` (`agency_id = public.get_user_agency_id()`); consumers satisfy this new one. Zero overlap because the new policy gates on `get_user_account_type() = 'consumer'`.

**Defense-in-depth**: the `WITH CHECK` requires `agency_id IS NULL AND tenant_id IS NULL` — a malicious consumer attempting to inject an arbitrary agency_id into the payload would still be rejected.

## Que NO se toco

- **`conversations_insert_policy`** (existing B2B INSERT policy) — intact bit-a-bit. Agents continue passing through it unchanged.
- **`conversations_select_policy`** — already filters by `created_by`, which works for consumers as-is. No change needed; verified that consumers can read their own conversations.
- **`conversations_update_policy`** — out of scope for this bug.
- **Trips, leads, messages RLS policies** — all intact.
- **Motor compartido**: `tripService`, `usePlannerState`, `useTripPlanner`, `useMessageHandler`, `conversationOrchestrator`, `planner-agent`. Nothing.
- **Paso 1/2/3/4**: `CompanionLayout`, `ChatSidebarCompanion`, `HandoffBanner/Modal`, `ItineraryPanel`, `ConsumerSignup/Login/Profile`, `RequireConsumer`, `consumer-signup` edge function — all intact.
- **B2B auth**: `Login.tsx`, `create-user` edge function, `Users.tsx`, `ProtectedRoute`, CRM, Dashboard, etc. — intact.
- **AuthContext**, layouts, routes, schemas Zod — intact.
- **`config.toml`** — not touched in this PR.

## Bonus discovery (out of scope, follow-up)

The existing B2B `conversations_insert_policy` also silently blocks `OWNER` and `SUPERADMIN` from creating conversations: both have `agency_id = NULL` in their JWT claims, so `agency_id = public.get_user_agency_id()` evaluates to `NULL = NULL → NULL → FALSE`. This is a **pre-existing bug** unrelated to consumer auth. It hasn't been reported because OWNER and SUPERADMIN don't typically create conversations through the web UI. **Not fixed in this PR** — the user explicitly asked for a surgical consumer fix, and mixing the two changes increases scope and regression surface.

Follow-up if product needs OWNER/SUPERADMIN conversation creation: change the existing policy from `agency_id = public.get_user_agency_id()` to `agency_id IS NOT DISTINCT FROM public.get_user_agency_id()` for NULL-safe equality.

## Tests

No new tests. The test suite has no infrastructure for testing RLS policies without `SUPABASE_SERVICE_ROLE_KEY`, and the JS change is a single-line role-check extension that doesn't merit a new pure-function test (the surrounding `createConversation` function is not currently unit-tested).

### Baseline

- **Pre-fix** (main @ `469bb83b`): 220 passed / 14 skipped / 2 failed (D11 pre-existing)
- **Post-fix**: **220 passed / 14 skipped / 2 failed (D11)** — no change, no regression
- **Build**: limpio
- **TypeScript**: `tsc --noEmit` exit 0

## Verificación

### Automática (ejecutada)

- [x] `npm test` → **220 / 14 / 2** (sin regresión)
- [x] `npm run build` → limpio
- [x] `npx tsc --noEmit` → exit 0

### Smoke manual (post-deploy de la migration)

1. **Login como consumer** en `/emilia/login`.
2. **Crear conversación**: en `/emilia/chat`, enviar el primer mensaje.
   - **Antes del fix**: tira `Error: User has no agency assigned`.
   - **Después del fix (solo JS, sin migration aplicada)**: tira error RLS `new row violates row-level security policy for table "conversations"` — confirma que el segundo bug existe.
   - **Después del fix (JS + migration aplicada)**: la conversación se crea, Emilia responde.
3. **Verificar fila en DB**:
   ```sql
   select id, created_by, agency_id, tenant_id, workspace_mode, external_key, created_at
   from public.conversations
   where created_by = '<consumer uuid>'
   order by created_at desc limit 1;
   ```
   Esperado: `agency_id = NULL`, `tenant_id = NULL`, `workspace_mode = 'companion'`.
4. **SELECT también funciona**: recargar `/emilia/chat` → el consumer ve su conversación en el sidebar (via `conversations_select_policy` que filtra por `created_by`).
5. **Regresión B2B**: como agent en `/chat`, crear una conversación → debe seguir funcionando exactamente igual que antes.

### Deploy manual de la migration (política D13)

```bash
supabase db push --linked
```

El usuario aplica esto manualmente tras review del SQL. Hasta que se aplique, el bug persiste en prod (la fix de JS sola no alcanza por el bug 2 a nivel RLS).

## Riesgos

- **R1 — Migration no aplicada al merge**: hasta que el usuario ejecute `supabase db push --linked`, el consumer sigue bloqueado en prod (con un mensaje de error distinto: ya no es "User has no agency assigned" del JS, sino el error de RLS de Postgres). Mitigación: documentado como paso manual post-merge.
- **R2 — Policy nueva colisiona con la existente**: Postgres evalúa policies de INSERT en OR. La nueva es para consumers (`get_user_account_type() = 'consumer'`), la existente para agents — sin solapamiento. Sin colisión.
- **R3 — Consumer inyecta `agency_id` arbitrario en el payload**: el `WITH CHECK` exige `agency_id IS NULL AND tenant_id IS NULL`. Defense-in-depth contra inyección.
- **R4 — `userRole === 'CONSUMER'` vs `accountType === 'consumer'`**: equivalentes en práctica gracias al CHECK constraint `users_account_type_role_check`. Documentado en el commit.
- **R5 — Test suite no cubre RLS**: el smoke manual post-deploy es la única verificación end-to-end. Aceptable para un fix puntual.

## Commits

1. `fix(chat): allow CONSUMER role to create conversations with null agency`
2. `feat(schema): add consumer_insert_own_conversations RLS policy`
3. `docs(prs): add fix description for consumer agency check`

## Dependencias previas

- Paso 1.1.a — schema B2C (`account_type`, `get_user_account_type()` helper, CHECK constraint)
- Paso 1 — `RequireConsumer` y rutas `/emilia/*`
- Paso 4 — flow de signup/login del consumer (PR #67) — sin esto el bug no era reproducible porque no había forma de loguearse como consumer

## Next

- **Manual deploy de la migration** vía `supabase db push --linked` (política D13)
- **Smoke testing** del flow completo end-to-end con un consumer real
- **Follow-up opcional**: arreglar el bug silencioso de OWNER/SUPERADMIN cambiando la policy B2B existente a `IS NOT DISTINCT FROM` (separado de este fix por scope)
