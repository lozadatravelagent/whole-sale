# useChatState.ts — conflict preview

File current size: **309 lines**.

## c4244ae8 (main side) — landing L1-C6: bridge landing prompts to chat input via sessionStorage

```diff
commit c4244ae8f8d14c3665f67c00254959ab9d32e069
Author: franciscoquinteros <franciscoquinterosok@gmail.com>
Date:   Sun Apr 19 13:27:55 2026 -0300

    feat(landing): bridge landing prompts to chat input via sessionStorage (C6 of L1)
    
    Sixth commit of L1. Closes the deep-link flow from the landing chips /
    inspiration cards to the chat input: a user who clicks "Plan a 10-day
    trip through Italy" lands on /emilia/chat with that text already sitting
    in the input, ready to edit or send.
    
    The /emilia route is still pointing at the legacy EmiliaLanding.tsx; the
    router swap is C8. This commit only wires the bridge so the new landing
    (already composed as LandingPage.tsx but not yet live) will Just Work
    when C8 flips the entry.
    
    --- Read-only findings before edit ---
    
    ProtectedRoute.tsx preserves the full location object (pathname + search
    + hash) in state.from when it bounces an anonymous user to /login, so in
    principle the query string survives the redirect. Login.tsx, however,
    reads only (location.state as any)?.from?.pathname at post-auth redirect
    (src/pages/Login.tsx:33-34), so anything in .search is dropped during
    the /login round trip. That discards any ?prompt=... set by the landing
    in the anonymous flow.
    
    Consequence: the URL query alone is not a reliable channel for the
    anonymous case. A sessionStorage bridge is required -- this is the
    §1.2-D3 option (ii) the plan preapproved as a fallback when
    ProtectedRoute/Login do not preserve search end-to-end.
    
    --- Mechanism chosen (user-approved Option B + option (ii)) ---
    
    Writer side (landing, src/features/landing/):
    - New utility pendingPrompt.ts exposes writePendingPrompt(prompt) and
      consumePendingPrompt() against the key 'emilia:pendingPrompt' in
      sessionStorage. Both functions are SSR-safe (typeof window guard) and
      wrap sessionStorage access in try/catch so they silently no-op if
      storage is disabled (privacy mode, quota, etc.).
    - PromptChip and InspirationCard both now call writePendingPrompt(prompt)
      immediately before navigate(buildPromptChatPath(prompt)). The URL
      still carries ?prompt=... as a second, redundant channel so the
      hook can also recognise the intent in the rare case a caller navigates
      with the query without having written storage.
    
    Reader side (chat, src/features/chat/hooks/useChatState.ts):
    - The existing useEffect that handled ?new=1 was extended to also
      consume a pending prompt. At mount it calls consumePendingPrompt()
      once (read + remove so it is not replayed on refresh), and if a value
      comes back it pushes it into chat state with
      updateChatState({ message: pendingPrompt }). The ?prompt= URL param,
      if present, is stripped from the URL via setSearchParams replace so
      the address bar remains canonical.
    - The bridge does NOT auto-send the message; the prompt is only loaded
      into the input so the user can still edit or confirm before sending.
      Matches the brief.
    
    --- Scope of edits inside src/features/chat/ ---
    
    EXACTLY ONE FILE: src/features/chat/hooks/useChatState.ts. Diff stats:
      +25 insertions, -5 deletions, within an existing useEffect and one
      added import. No new props, no new exports, no signature changes.
      Confirmed via `git diff --stat src/features/chat/`. ChatFeature.tsx
      was NOT touched. The hook was chosen because:
       (a) it already owns the ?new=1 URL-driven initialization pattern,
           so extending it for ?prompt= is strictly additive inside the
           same useEffect.
       (b) PR 3 (feat/pr3-chat-unification) is reshaping ChatFeature.tsx
           heavily (+288 / -288 lines in diff --stat vs main) but leaves
           useChatState.ts alone, so a change here has near-zero merge
           conflict risk.
    
    The import direction chat -> landing (useChatState imports from
    @/features/landing/lib/pendingPrompt) is an exception to the usual
    feature isolation, justified by contract ownership: the landing is the
    protocol definer (key name, value shape, consume-once semantics), the
    chat feature is the consumer. The utility was placed under
    src/features/landing/lib/ for exactly that reason. No equivalent file
    was needed in src/features/chat/.
    
    --- Files touched ---
    
    New:
    - src/features/landing/lib/pendingPrompt.ts
      writePendingPrompt(prompt) + consumePendingPrompt() + the storage
      key constant PENDING_PROMPT_STORAGE_KEY (exported for tests in C7).
      SSR-safe, try/catch-wrapped, single source of truth for the bridge.
    
    Modified:
    - src/features/landing/components/PromptChip.tsx
      handleClick now calls writePendingPrompt(prompt) before navigating.
      buildPromptChatPath is still used for the URL so the query param
      remains available as the secondary channel.
    - src/features/landing/components/InspirationCard.tsx
      Same change as PromptChip.
    - src/features/chat/hooks/useChatState.ts
      Extended the existing ?new=1 useEffect to also consumePendingPrompt
      and to clean the ?prompt= param from the URL if it appears. Added
      updateChatState to the dependency array; added one import.
    
    NOT touched (explicit):
    - src/features/chat/ChatFeature.tsx
    - Any other file under src/features/chat/ except the single hook above.
    - src/pages/CompanionChatPage.tsx (no longer needs sessionStorage
      handling; the hook does it centrally).
    - src/pages/Login.tsx (the post-auth .pathname-only redirect finding is
      reported here for the record but the fix is out of L1 scope; the
      sessionStorage bridge sidesteps the need for it).
    - src/App.tsx (no routing changes).
    - The 20 legacy components under src/features/landing/components/.
    
    --- Tests ---
    
    No test file is added in this commit. C7 brings the unit tests for the
    pure utility pair (writePendingPrompt / consumePendingPrompt) using the
    Camino B approach (no React Testing Library).
    
    --- Verification on this commit's tree ---
    
    - npx tsc --noEmit     OK  (exit 0)
    - npm run build        OK  (exit 0, 15.07s, pre-existing ChatFeature
                               chunk-size warning unchanged)
    - npm test -- --run    OK  (251 passed / 14 skipped / 0 failed,
                               baseline preserved)
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/src/features/chat/hooks/useChatState.ts b/src/features/chat/hooks/useChatState.ts
index 9f0f2feb..3d255a41 100644
--- a/src/features/chat/hooks/useChatState.ts
+++ b/src/features/chat/hooks/useChatState.ts
@@ -5,6 +5,7 @@ import type { ChatState, ConversationWorkspaceMode } from '../types/chat';
 import { useAuth, useConversations } from '@/hooks/useChat';
 import { useAuth as useAuthContext } from '@/contexts/AuthContext'; // ⚡ OPTIMIZATION: Use cached user data
 import { useToast } from '@/hooks/use-toast';
+import { consumePendingPrompt } from '@/features/landing/lib/pendingPrompt';
 
 interface UseChatStateOptions {
   defaultWorkspaceMode?: ConversationWorkspaceMode;
@@ -237,15 +238,29 @@ const useChatState = (options: UseChatStateOptions = {}) => {
     loadConversations();
   }, [loadConversations]);
 
-  // Handle ?new=1 URL parameter to create new chat automatically
+  // Handle ?new=1 URL parameter to create new chat automatically,
+  // and consume any pending prompt written by the landing (PromptChip /
+  // InspirationCard) so the chat input is preloaded at mount. The landing
+  // uses sessionStorage (see src/features/landing/lib/pendingPrompt.ts)
+  // because Login.tsx discards location.search during post-auth redirect;
+  // the ?prompt= query arriving here in the authenticated flow is cleaned
+  // up defensively so the URL stays canonical.
   useEffect(() => {
     const shouldCreateNew = searchParams.get('new') === '1';
-    if (shouldCreateNew && conversations.length >= 0) {
-      searchParams.delete('new');
+    const hasPromptParam = searchParams.has('prompt');
+    const pendingPrompt = consumePendingPrompt();
+
+    if (!shouldCreateNew && !hasPromptParam && !pendingPrompt) return;
+
+    if (shouldCreateNew) searchParams.delete('new');
+    if (hasPromptParam) searchParams.delete('prompt');
+    if (shouldCreateNew || hasPromptParam) {
       setSearchParams(searchParams, { replace: true });
-      createNewChat(undefined, defaultWorkspaceMode);
     }
-  }, [searchParams, conversations.length, setSearchParams, createNewChat, defaultWorkspaceMode]);
+
+    if (shouldCreateNew) createNewChat(undefined, defaultWorkspaceMode);
+    if (pendingPrompt) updateChatState({ message: pendingPrompt });
+  }, [searchParams, conversations.length, setSearchParams, createNewChat, defaultWorkspaceMode, updateChatState]);
 
   // Typing indicator is now controlled manually in useMessageHandler
   // No automatic timeout needed
```

## 339ca6de (PR 3 side) — C7.1.f: load consumer sidebar conversations without agency filter

```diff
commit 339ca6deeaa2c8fa3dbe136e7f88a24a8093acfd
Author: franciscoquinteros <franciscoquinterosok@gmail.com>
Date:   Wed Apr 22 09:57:25 2026 -0300

    fix(chat): load consumer sidebar conversations without agency filter (C7.1.f, closes D21)
    
    El sidebar consumer (ChatSidebarCompanion) cargaba vía
    useConversations → get_conversations_with_agency. La RPC filtra por
    roles OWNER/SUPERADMIN/ADMIN/SELLER y no tiene rama CONSUMER, así que
    un consumer recibe 0 filas aunque tenga conversaciones propias en DB.
    
    Fix principal (RPC mismatch): branching por accountType en
    loadConversations. Consumer hace select directo sobre conversations
    con .eq('created_by', userId) como defensa en profundidad; RLS
    (conversations_select_policy, migración 20260309000001) ya filtra
    por created_by = auth.uid(). Agent queda en la RPC existente (que
    mantiene la expansión de visibilidad por rol vía SECURITY DEFINER).
    
    Helper puro buildConversationsQuery extraído para testeo aislado.
    
    Fix adicional (descubierto en smoke manual de C7.1.f):
    El query ya devolvía las 16 filas del consumer con
    workspace_mode='companion', pero el sidebar seguía vacío. Causa:
    inferConversationWorkspaceMode (useChat.ts) sólo contemplaba
    'planner' vs 'standard' y pisaba cualquier otro valor —incluido
    'companion', agregado al enum en la migración 20260407000001—
    a 'standard'. normalizeConversation aplica esa inferencia a toda
    fila que entra por el hook, así que filterCompanionConversations
    (requiere workspace_mode === 'companion') descartaba las 16.
    Identificado leyendo el JSON del response en DevTools: agency_id=null
    era red herring, el predicado que descartaba no miraba joined fields.
    Se agrega la rama 'companion' a inferConversationWorkspaceMode,
    preservando el valor tal cual.
    
    Archivos:
    - src/hooks/useChat.ts: helper buildConversationsQuery + branching
      en loadConversations + hook acepta (accountType, userId). Agregada
      rama 'companion' en inferConversationWorkspaceMode.
      normalizeConversation exportada para testeo directo.
    - src/features/chat/hooks/useChatState.ts: pasa authUser.user.accountType
      y authUser.user.id al hook.
    - src/features/chat/__tests__/useChat.loadConversations.test.ts:
      nuevo. 4 unit tests del helper buildConversationsQuery (agent→rpc,
      undefined→rpc, consumer+uid→table con eq, consumer+null/undefined
      →table sin eq) + 2 nuevos de normalizeConversation (preserva
      'companion'; regresión 'standard').
    
    Verificación: 306 passed / 11 skipped / 0 failed; tsc limpio;
    build limpio.
    
    Notas:
    - El plan del Paso 1 listaba el test en src/hooks/__tests__/, pero
      vite.config.ts tiene una allowlist explícita que no incluye ese
      path. Movido a src/features/chat/__tests__/ (ya incluido) para no
      tocar config compartida. La allowlist restrictiva es deuda aparte,
      no se resuelve acá.
    - Doble fetch al mount (1 con accountType=undefined → RPC vacío,
      2 con accountType='consumer' → select directo) queda fuera de
      scope para este commit. Se anotará como D22 en TECH_DEBT.md en
      commit aparte.

diff --git a/src/features/chat/hooks/useChatState.ts b/src/features/chat/hooks/useChatState.ts
index 9f0f2feb..9ee07686 100644
--- a/src/features/chat/hooks/useChatState.ts
+++ b/src/features/chat/hooks/useChatState.ts
@@ -45,7 +45,7 @@ const useChatState = (options: UseChatStateOptions = {}) => {
     createConversation,
     updateConversationState,
     updateConversationTitle
-  } = useConversations();
+  } = useConversations(authUser.user?.accountType, authUser.user?.id);
   const { toast } = useToast();
   const [searchParams, setSearchParams] = useSearchParams();
 
```
