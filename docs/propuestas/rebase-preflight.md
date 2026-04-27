# Rebase preflight — PR 3 (feat/pr3-chat-unification) vs origin/main

Generated: 2026-04-22 15:29 UTC

## Counts

- PR 3 side: **15 commits**, **27 files** touched.
- main side: **21 commits**, **41 files** touched.
- **Intersection: 1 file** — `src/features/chat/hooks/useChatState.ts`.

## PR 3 commits (15)

```
b2de5443 chore(debt): close D21, review D11/D14/D17, add D22, untrack supabase cli-latest
339ca6de fix(chat): load consumer sidebar conversations without agency filter (C7.1.f, closes D21)
5d242d24 chore(docs): document D21 sidebar consumer RPC mismatch
4d7cf4b9 fix(routing): route agent planner mode to standard_itinerary (reverts ADR-002 partial)
20fbee26 fix(chat): add scroll affordance to recommended places carousel via gradient fade
b7ca8615 fix(chat): prevent horizontal overflow in recommended places carousel under UnifiedLayout (v2)
09999dc9 fix(chat): suppress redundant branding in ChatHeader for agents under UnifiedLayout
76fd8421 fix(chat): pass mode override to handler to avoid stale closure in bridge switch
77b4a726 refactor(chat): migrate B2B branch to UnifiedLayout
a3b4e79e feat(chat): integrate ModeSwitch into ChatHeader — first visual change
cfb6c579 feat(chat): wire chatMode state + bridge handlers + accountType prop rename
1cd50e2e feat(chat): render mode_bridge turn + thread handler options
a3f28cf0 feat(chat): strict mode routing in resolveConversationTurn + mode_bridge
fa45e5a9 feat(chat): add ModeSwitch component + pure state derivation
67677293 feat(chat): add optional mode param to resolveConversationTurn (no-op)
```

## main commits (21)

```
73cf285a Merge pull request #74 from lozadatravelagent/feat/landing-redesign-L1.5
01faec3d fix(landing): section-light applies its own background + text color (L1.5 post-C9 #2)
0def65d4 fix(landing): readable text contrast on section-light (L1.5 post-C9)
fee7c259 feat(landing): footer photo credit + PR doc + L1.5 close (L1.5-C9)
813f8b52 feat(landing): icon micro-animations on-scroll (L1.5-C8)
6e9e7b1f feat(landing): stagger entrance on grids + coral hover glow on cards (L1.5-C7)
0838240b feat(landing): HeroAurora gradient canvas + h1 scale upgrade (L1.5-C6)
5f02dce4 feat(landing): functional ChatPreview with prompt handoff (L1.5-C5)
d3018c1b feat(landing): InspirationCard with full-bleed Unsplash imagery + overlay (L1.5-C4)
1642a53a feat(landing): Unsplash image utility + wrapper + tests (L1.5-C3)
22a8db8e feat(landing): light theme alternation on 4 sections + bg-card fix on cards (L1.5-C2)
135ed69b feat(landing): warm coral palette scoped to .landing-shell (L1.5-C1)
51522258 Merge L1: landing redesign (8 commits)
1241321b feat(landing): swap /emilia entry to new LandingPage + PR doc (C8 of L1)
15cf3453 test(landing): unit tests for buildPromptChatPath + pendingPrompt (C7 of L1)
c4244ae8 feat(landing): bridge landing prompts to chat input via sessionStorage (C6 of L1)
65e433e2 feat(landing): implement Trust + FinalCta and retrofit Ecosystem motion (C5 of L1)
af27f57f feat(landing): implement Inspiration + Understands + Personalized sections (C4 of L1)
4bd54547 feat(landing): implement HowItWorks + PromptDemo + HelpsWith sections (C3 of L1)
f2325cd0 feat(landing): implement Hero + Ecosystem sections with primitives (C2 of L1)
619806b2 feat(landing): scaffold new landing + rewrite landing i18n (C1 of L1)
```

## Files touched by main (41)

```
docs/prs/landing-redesign-L1.5.md
docs/prs/landing-redesign-L1.md
src/features/chat/hooks/useChatState.ts
src/features/landing/__tests__/buildPromptChatPath.test.ts
src/features/landing/__tests__/buildUnsplashUrl.test.ts
src/features/landing/__tests__/pendingPrompt.test.ts
src/features/landing/components/ChatPreview.tsx
src/features/landing/components/EcosystemCard.tsx
src/features/landing/components/FeatureCard.tsx
src/features/landing/components/HeroAurora.tsx
src/features/landing/components/InspirationCard.tsx
src/features/landing/components/LandingFooter.tsx
src/features/landing/components/LandingLayout.tsx
src/features/landing/components/LandingNavbar.tsx
src/features/landing/components/PersonalizationPoint.tsx
src/features/landing/components/PromptChip.tsx
src/features/landing/components/SectionEyebrow.tsx
src/features/landing/components/SectionHeading.tsx
src/features/landing/components/StepCard.tsx
src/features/landing/components/UnderstandPill.tsx
src/features/landing/components/UnsplashImage.tsx
src/features/landing/LandingPage.tsx
src/features/landing/lib/buildPromptChatPath.ts
src/features/landing/lib/buildUnsplashUrl.ts
src/features/landing/lib/pendingPrompt.ts
src/features/landing/sections/Ecosystem.tsx
src/features/landing/sections/FinalCta.tsx
src/features/landing/sections/HelpsWith.tsx
src/features/landing/sections/Hero.tsx
src/features/landing/sections/HowItWorks.tsx
src/features/landing/sections/Inspiration.tsx
src/features/landing/sections/Personalized.tsx
src/features/landing/sections/PromptDemo.tsx
src/features/landing/sections/Trust.tsx
src/features/landing/sections/Understands.tsx
src/i18n/locales/en/landing.json
src/i18n/locales/es/landing.json
src/i18n/locales/pt/landing.json
src/index.css
src/pages/EmiliaLanding.tsx
vite.config.ts
```

## Files touched by PR 3 (27)

```
docs/adr/ADR-002-chat-unification.md
docs/B2C_STATUS.md
src/features/chat/__tests__/buildModeBridgeMessage.test.ts
src/features/chat/__tests__/deriveDefaultMode.test.ts
src/features/chat/__tests__/deriveModeSwitchState.test.ts
src/features/chat/__tests__/extractBridgeTurnProps.test.ts
src/features/chat/__tests__/resolveEffectiveMode.test.ts
src/features/chat/__tests__/useChat.loadConversations.test.ts
src/features/chat/ChatFeature.tsx
src/features/chat/components/ChatHeader.tsx
src/features/chat/components/ChatInterface.tsx
src/features/chat/components/ModeSwitch.tsx
src/features/chat/components/RecommendedPlacesList.tsx
src/features/chat/hooks/useChatState.ts
src/features/chat/hooks/useMessageHandler.ts
src/features/chat/services/conversationOrchestrator.ts
src/features/chat/utils/deriveDefaultMode.ts
src/features/chat/utils/deriveModeSwitchState.ts
src/features/chat/utils/extractBridgeTurnProps.ts
src/features/chat/utils/resolveEffectiveMode.ts
src/features/trip-planner/__tests__/conversationOrchestrator.test.ts
src/hooks/useChat.ts
src/i18n/locales/en/chat.json
src/i18n/locales/es/chat.json
src/i18n/locales/pt/chat.json
supabase/.temp/cli-latest
TECH_DEBT.md
```

## Intersection (1 file — potential conflict)

```
src/features/chat/hooks/useChatState.ts
```

### Commits on each side touching `useChatState.ts`

```
--- main side ---
c4244ae8 feat(landing): bridge landing prompts to chat input via sessionStorage (C6 of L1)

--- PR 3 side ---
339ca6de fix(chat): load consumer sidebar conversations without agency filter (C7.1.f, closes D21)
```
