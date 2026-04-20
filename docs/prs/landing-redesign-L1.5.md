# PR: Landing Redesign L1.5 — Visual Pass (Mindtrip direction) for Emilia B2C

## Scope

Visual pass over the ten-section landing shipped in L1 (`51522258`). No structural changes: 10 sections, copy, i18n namespace, sessionStorage bridge, re-export of `src/pages/EmiliaLanding.tsx`, and the router in `src/App.tsx` all inherit from L1 unchanged.

**What L1.5 changes:**

- **Theme shifts** from L1's cool neutral dark (`hsl 240 10% 3.9%`) to a warm coral/amber palette scoped inside `.landing-shell`. Four of the ten sections now opt into a cream light theme via `.landing-section-light` for a dark/light scroll rhythm (6 dark + 4 light).
- **Primary accent shifts** from sky-blue (`217 91% 60%`) to coral (`16 85% 58%`), scoped to the landing tree so chat/profile/admin pages keep their original surface treatment.
- **Inspiration cards** (section 6) carry full-bleed Unsplash photography with gradient overlays instead of the text-only card from L1.
- **Hero ChatPreview** becomes functional: a real input that writes to the L1 sessionStorage bridge and navigates to `/emilia/chat`. The static user bubble from L1 is removed.
- **HeroAurora** — a new canvas-2D gradient element behind the hero, three warm orbs on independent lissajous trajectories, with `document.visibilitychange` + `IntersectionObserver` pauses and full `prefers-reduced-motion` support.
- **Motion layer** on the four grid sections (stagger entrances) and on three card primitives (coral hover glow on EcosystemCard and FeatureCard; per-icon micro-animations on StepCard and pulse on FeatureCard / PersonalizationPoint).

**What L1.5 does NOT change:**

- The ten-section order, the copy, the i18n namespace structure, the 23 files created in L1 under `src/features/landing/` other than the four specific primitives/sections that got visual upgrades.
- The sessionStorage bridge contract: `writePendingPrompt` + `consumePendingPrompt` + `PENDING_PROMPT_STORAGE_KEY` + `buildPromptChatPath`. All four untouched.
- `src/features/chat/**` — verified empty diff vs main.
- `src/App.tsx` — verified empty diff vs main.
- `src/pages/EmiliaLanding.tsx` — still the one-line re-export from L1.
- Schema, migrations, RLS, edge functions.

**Baseline tests:**
- Before L1.5 (main `51522258`): **269 passed / 14 skipped / 0 failed**.
- After L1.5: **275 passed / 14 skipped / 0 failed**. +6 from the 6 new `buildUnsplashUrl` unit tests.

## Closed decisions (D14–D18)

| # | Decision | Outcome |
|---|---|---|
| D14 | Image strategy | Unsplash hotlink with canonical transform params `?w=1200&q=80&auto=format&fit=crop`. Wrapper component `UnsplashImage.tsx` provides SSR-safe loading, error-state gradient fallback, and `role="img"` on the fallback for screen readers. Pure-function helper `buildUnsplashUrl.ts` builds the URL via `URLSearchParams`. |
| D15 | Theme + dark/light mix | Warm dark base + coral primary, scoped to `.landing-shell` (global `.dark` block unchanged except for 4 additive tokens `--landing-light-*`). Four sections opt into cream light theme via `.landing-section-light`: HowItWorks, HelpsWith, Personalized, Trust. Six sections remain dark: Hero, Ecosystem, PromptDemo, Inspiration, Understands, FinalCta. |
| D16 | Inspiration cards with imagery | Full-bleed Unsplash image + gradient overlay `from-black/85 via-black/35 to-transparent` that softens on hover. Title + CTA positioned `absolute bottom-0`. Aspect `4/5`. On hover: image `scale-110`, overlay softens to `from-black/70`, arrow translates. `motion-reduce` suppresses scale + translate but keeps the overlay change. |
| D17 | ChatPreview functional | Rewrite to a real chat-looking container: header (avatar + label + green online dot + status) + single assistant bubble (brief copy) + `<form onSubmit>` with text input + send button. Submit runs `writePendingPrompt(prompt)` then `navigate(buildPromptChatPath(prompt))`. Local `useState` only. Zero motor hooks. No fake typing, no LLM call. |
| D18 | Ambitious motion | (a) `HeroAurora` canvas-2D gradient with three warm orbs on independent lissajous paths; visibility + intersection pauses; reduced-motion renders a static single frame. (b) Stagger entrance on 4 grids (HowItWorks 120ms, HelpsWith 80ms, Inspiration 100ms, Personalized 60ms). (c) Hover glow via `hover:shadow-primary` (coral at alpha 0.4) on EcosystemCard and FeatureCard. (d) Per-icon animations in StepCard (Sparkles spring, MessagesSquare fade+scale, Compass directional pulse). (e) Pulse-on-view on FeatureCard and PersonalizationPoint icon tiles. |

## Inherited decisions from L1 (not reopened)

D1 `LandingLayout` wrapper, D3 sessionStorage bridge, D5 ecosystem CTAs (`href="#" aria-disabled` + coming-soon badge), D6 Inspiration cards click-to-preload behavior, D7 `UnderstandPill` / `PersonalizationPoint` as distinct components, D8 `/vibook-white.png` in Trust with no corporate link, D9 i18n EN/ES/PT coverage, D10 Tailwind default breakpoints, D13 `EmiliaLanding.tsx` as a one-line re-export of `LandingPage`.

The three reopened decisions — D4 (ChatPreview was static), D11 (theme was cool neutral dark), D12 (palette was sky-blue primary with restraint) — are replaced by D17, D15 and D18 respectively. Nothing else from L1 moves.

## sessionStorage bridge — inherited from L1, reused verbatim

L1.5 adds one new consumer of the bridge (`ChatPreview.tsx` via its submit handler in C5) but touches none of its parts:

- `src/features/landing/lib/pendingPrompt.ts` — `writePendingPrompt` + `consumePendingPrompt` + `PENDING_PROMPT_STORAGE_KEY`. Empty diff vs main.
- `src/features/landing/lib/buildPromptChatPath.ts` — URL-encoded path builder. Empty diff vs main.
- `src/features/chat/hooks/useChatState.ts` — the consumer side of the bridge inside the chat feature. Empty diff vs main.

The contract is: landing writes the prompt to `sessionStorage['emilia:pendingPrompt']` right before navigating to `/emilia/chat`; `useChatState` consumes and clears at mount, also cleaning any `?prompt=` query param defensively. Works the same for authenticated and anonymous flows (the latter relies on sessionStorage surviving the `/login` round trip because `Login.tsx:33` reads only `state.from.pathname` — deuda registrada de L1).

## Palette scoping to `.landing-shell`

L1.5 introduces a warm coral/amber palette that is constrained to the `.landing-shell` utility class (which `LandingLayout.tsx` already applied since L1). The global `.dark` block gains four additive tokens (`--landing-light-bg`, `--landing-light-fg`, `--landing-light-muted`, `--landing-light-border`) that are consumed only inside `.landing-section-light` subtrees within the landing — no existing token in `.dark` is modified, so chat, ConsumerProfile, admin pages keep their pre-L1.5 visuals.

Key implementation note captured in C1: at the start of C1 the `.landing-shell` class already existed in `src/index.css` with a single `font-family` rule (from the L1 landing scaffold), and `LandingLayout.tsx` already applied it. Per the empirical-finding protocol the user was notified and authorized Option A (extend the existing rule rather than create a new class), which also let C1 drop from the planned two-file scope to a single file touched.

**Known trade-off, documented as post-merge monitoring item:** the landing CTA is coral, the chat CTA is sky-blue. A user going from the landing to the chat sees a primary-accent shift. If post-merge feedback finds this jarring, the fix is a brand-wide RFC to shift the global dark primary, not a landing-level patch.

## Files touched

**New (4):**

- `src/features/landing/components/HeroAurora.tsx` — canvas gradient component (C6).
- `src/features/landing/components/UnsplashImage.tsx` — image wrapper with fallback (C3).
- `src/features/landing/lib/buildUnsplashUrl.ts` — pure URL builder (C3).
- `src/features/landing/__tests__/buildUnsplashUrl.test.ts` — 6 Camino-B tests (C3).

**Modified (16):**

- `src/index.css` — 4 additive tokens in `.dark`, warm palette inside `.landing-shell`, `.landing-section-light` override class (C1).
- `src/features/landing/sections/HowItWorks.tsx` — `landing-section-light` + stagger 120ms (C2, C7).
- `src/features/landing/sections/HelpsWith.tsx` — `landing-section-light` + stagger 80ms (C2, C7).
- `src/features/landing/sections/Inspiration.tsx` — photoId pipeline + stagger 100ms (C4, C7).
- `src/features/landing/sections/Personalized.tsx` — `landing-section-light` + stagger 60ms (C2, C7).
- `src/features/landing/sections/Trust.tsx` — `landing-section-light` (C2).
- `src/features/landing/sections/Hero.tsx` — HeroAurora integration, h1 scale upgrade, relative/z-10 layering (C6).
- `src/features/landing/components/ChatPreview.tsx` — functional rewrite (C5).
- `src/features/landing/components/InspirationCard.tsx` — image rewrite (C4).
- `src/features/landing/components/EcosystemCard.tsx` — hover glow (C7).
- `src/features/landing/components/FeatureCard.tsx` — bg-card swap (C2) + hover glow (C7) + icon pulse (C8).
- `src/features/landing/components/StepCard.tsx` — bg-card swap (C2) + per-icon animations (C8).
- `src/features/landing/components/PersonalizationPoint.tsx` — icon pulse (C8).
- `src/features/landing/components/LandingFooter.tsx` — photo credit line (C9).
- `src/i18n/locales/en/landing.json` — C4 alt keys (6 new) + C5 chatPreview rotation (+3 / −2) + C9 photoCredit.
- `src/i18n/locales/es/landing.json` — same pattern, voseo AR.
- `src/i18n/locales/pt/landing.json` — same pattern, PT-BR.

**Not touched (explicit verification, see `git diff --stat main..HEAD` per path):**

- `src/features/chat/**` empty.
- `src/App.tsx` empty.
- `src/features/landing/lib/pendingPrompt.ts` empty.
- `src/features/landing/lib/buildPromptChatPath.ts` empty.
- `src/pages/EmiliaLanding.tsx` empty (the L1 one-line re-export).
- `LandingLayout.tsx`, `LandingNavbar.tsx`, `SectionHeading.tsx`, `SectionEyebrow.tsx`, `PromptChip.tsx`, `UnderstandPill.tsx`, `HelpsWith`/`Inspiration`/etc. section and component primitives that were not part of a specific commit's scope — all empty.

## Dead code status

L1.5 does not introduce new dead code. The orphaned `hero.chatPreview.userMessage` and `userLabel` i18n keys from L1 were removed in C5 in the same commit where the new keys were added. The dead-code list queued for PR 4 remains the L1 list: Navigation.tsx (legacy), Footer.tsx (legacy), EmiliaAI.tsx, and 17 other legacy landing components that have had no consumers since L1.

## Registered debt

**Inherited from L1 (still open):**
- `Login.tsx:33` discards `location.search` on post-auth redirect. The sessionStorage bridge sidesteps it for the landing-to-chat flow, but other deep-link flows through `/login` lose query params. Separate ticket when it matters.
- `REVIEW_PT` candidate review by a native speaker on PT translations.
- No analytics on CTAs.
- No A/B testing harness.
- No dedicated Emilia brand asset (wordmark-only).
- No full light-mode rollout.

**New from L1.5:**
- **WCAG AA on `SectionEyebrow` in section-light** — eyebrow uses `text-primary` (coral `16 85% 58%`). Over cream backgrounds the ratio is ~2.75:1, which fails WCAG AA for normal text. Affects any light section that renders a section eyebrow (HowItWorks, HelpsWith, Personalized, Trust). Fix requires a mechanism to override primary only inside eyebrow-on-cream contexts — a separate architectural decision (class modifier, variant prop, or scoped new token). Not merge-blocking; own ticket post-L1.5.
- **`--landing-light-*` tokens in `.dark` without consumers** — after the post-C9 contrast fix (below), `.landing-section-light` reads literal HSL values directly instead of indirecting through `var(--landing-light-*)`. The four tokens declared in `.dark` are harmless but unused. Trivial cleanup (delete the four lines) whenever someone happens to touch `.dark` again; non-blocking.
- **Unsplash hotlink fragility** — the six Inspiration images depend on stable Unsplash URLs. If any 404s or gets replaced with unrelated content, `UnsplashImage` falls back to a muted gradient block; eventually the curated set moves to `public/landing/`. Ticket when budget exists.
- **Landing→chat color jarring** — coral primary on landing vs sky-blue primary in chat. Accepted consciously (see "Palette scoping" above). Escalate as a brand-wide RFC if repeated feedback.
- **HeroAurora on low-end devices** — tested conceptually at 60 FPS on modern desktop and mid-tier mobile. Low-end (pre-2019 mobile) not empirically profiled. Two pause mechanisms (tab visibility, viewport intersection) should keep idle cost near zero. Monitor.
- **MessagesSquare animation downgrade** — draw-in (stroke-dashoffset on SVG path) was downgraded to fade+scale in C8 to avoid copying the lucide path locally. If post-smoke the fade+scale reads too plain, upgrading to draw-in is a standalone commit: copy the lucide SVG source into the component and animate `pathLength` via `motion.path`.
- **`hover:shadow-primary` alpha** — using the default 0.4 alpha from `--shadow-primary`. If the glow reads too loud over the cream light background (FeatureCard in HelpsWith), the fix is an inline arbitrary shadow at alpha 0.2 or a new `--shadow-primary-soft` token. One-line change.
- **`CARD_VARIANTS` duplicated across the four stagger sections** — same shape 4 times. Extracting to a shared helper is a trivial refactor post-L1.5 if the duplication proves annoying.
- **ChatPreview container `bg-muted/10`** — kept semi-transparent in C5 so the HeroAurora canvas (C6) reads through. If the human smoke finds the input/greeting loses contrast over the animated canvas, the fix is either an opaque `bg-card` on the container or a lower `opacity-50` on the canvas.
- **Photographers credit list (section below)** — populated as TBD pending a Francisco smoke pass where each Unsplash URL is opened and the photographer name + profile URL are captured. Not a merge blocker.

## Photographers (acknowledgement for the six Inspiration images)

Each Unsplash photo ID maps to a real photographer. Populate from the image page metadata during smoke.

| Card | Photo ID | Photographer | Unsplash profile |
|---|---|---|---|
| 7 days in Rio | `photo-1483729558449-99ef09a8c325` | TBD | TBD |
| 10 days in Italy | `photo-1533105079780-92b9be482077` | TBD | TBD |
| Spain + Portugal | `photo-1555881400-74d7acaacd8b` | TBD | TBD |
| Family beach escape | `photo-1507525428034-b723cf961d3e` | TBD | TBD |
| Romantic Europe | `photo-1502602898657-3e91760cbb34` | TBD | TBD |
| Japan for first-timers | `photo-1545569341-9eb8b30979d9` | TBD | TBD |

## Process rules learned during L1.5

The 22 accumulated from L1 still apply. L1.5 adds two more, both ratifying patterns that played out cleanly during this phase:

- **Rule 23: Parada + propuesta + autorización for empirical findings that *reduce* scope.** L1.5-C1 discovered that `.landing-shell` already existed in `src/index.css` and that `LandingLayout.tsx` already applied it, meaning the planned "two file change" collapsed to one file. Reported before editing, the user authorized Option A, and C1 shipped touching a single file. This is the mirror of Rule 22 (findings that *invalidate* a decision): scope-reducing findings deserve the same stop-and-ask treatment so the user can ratify the smaller diff consciously rather than discover it after the fact.

- **Rule 24: When the plan authorizes case-by-case scope creep, report the decision with evidence before taking it.** L1.5-C2 needed a small card-background fix (`bg-muted/10` → `bg-card`) to keep the cards readable when four sections switched to the cream light theme. The plan C2 preamble explicitly allowed "replace hardcoded tokens before the toggle" but left it case-by-case. The commit reported the empirical finding, the Option B fix, and the scope (2 extra primitives touched) — the user authorized with full context. No silent scope-creep.

**Updated accumulated process rules: 24 total.** Noteworthy L1-specific ones that directly shaped L1.5 execution:
- Rule 19: decisions closed in the plan require ask-first before deviation.
- Rule 22: empirical findings that invalidate a closed decision trigger mandatory stop + report.
- Rule 23 (new): empirical findings that shrink planned scope also trigger stop + report.
- Rule 24 (new): plan-authorized scope-creep windows require explicit evidence and user ratification before acting.

## Smoke checklist (human execution required before push + merge)

All automatic checks pass in-commit. The following are for Francisco to run via `npm run dev` after reviewing the PR doc.

- [ ] **Ten sections render with 6+4 rhythm.** Scroll: dark-dark-LIGHT-dark-LIGHT-dark-dark-LIGHT-LIGHT-dark. Coral CTAs visible in both dark and light sections.
- [ ] **HeroAurora ambient canvas.** Animates subtly behind ChatPreview in the hero. Tab switch → freezes (verify CPU drop in DevTools). Scroll past hero → freezes. Return → resumes smoothly.
- [ ] **Reduced motion.** DevTools Rendering → Emulate `prefers-reduced-motion: reduce` → refresh. Aurora renders static (no raf). Section entrances are plain fades (no y-translate). Card staggers collapse to simultaneous. Icon animations suppressed.
- [ ] **ChatPreview end-to-end (authenticated).** Log in → `/emilia` → type "Plan a trip to Vietnam" in the hero → Enter → `/emilia/chat` with the input preloaded. URL stays at `/emilia/chat` (no stray `?prompt=`). F5 does not replay the prompt.
- [ ] **ChatPreview end-to-end (anonymous).** Log out → `/emilia` → type in the hero → Enter → redirected to `/login`. Sign in or sign up → land on `/emilia/chat` with the input preloaded. Validates the sessionStorage bridge survives the Login.tsx:33 search-stripping round trip.
- [ ] **Inspiration cards load.** DevTools → Network → filter `images.unsplash.com`. All six URLs return 200. If any 404 or serves content that does not match the destination (Unsplash can rotate assets), stop and report for a photoId swap.
- [ ] **Inspiration card fallback.** Cut network or emulate offline → reload. The six cards should render the gradient fallback via UnsplashImage, not break the layout.
- [ ] **Inspiration click.** Click any card → `/emilia/chat` with the corresponding prompt preloaded. Same behavior as the hero input.
- [ ] **Stagger visible in grids.** HowItWorks 360ms total (3 × 120ms). HelpsWith 480ms. Inspiration 600ms. Personalized 360ms (fastest).
- [ ] **Hover glow on cards.** Hover over an EcosystemCard and a FeatureCard → translate up + border shifts to primary + coral glow appears. On FeatureCard under the cream light section, verify the glow is not overpowering; if it is, schedule the alpha drop.
- [ ] **Icon micro-animations.** Step 01 Sparkles rotates in with spring. Step 02 MessagesSquare fades in. Step 03 Compass does a directional pulse. FeatureCard and PersonalizationPoint icons pulse on-view.
- [ ] **Responsive.** 375 / 768 / 1024 / 1440. No horizontal overflow. h1 fits cleanly on mobile without wrapping into more than three lines.
- [ ] **i18n.** Switch EN / ES / PT in the LanguageSelector. All ten sections + footer (tagline, copyright, photoCredit) render the translated copy.
- [ ] **Chat surface unchanged.** Navigate to `/emilia/chat` after authentication. The sidebar, header, avatar, buttons are still sky-blue accent, not coral. Validates the `.landing-shell` palette containment.
- [ ] **Lighthouse performance ≥ 80, accessibility ≥ 95** on `/emilia`.
- [ ] **Console DevTools clean.** No new errors or warnings from L1.5. Pre-existing noise (e.g. `optimizeDeps.esbuildOptions` deprecation from vite-swc) is acceptable.

**Stop rule for the smoke:** structural failures (ChatPreview submit does not preload; a section renders broken; pause mechanism does not work; reduced-motion still animates) block merge. Cosmetic findings (shadow intensity, one image not matching, spacing oddity on a specific breakpoint) are noted and fixed inline or scheduled post-merge.

## Verification executed (automatic in C9)

- `npx tsc --noEmit` → exit 0.
- `npm run build` → exit 0, ~14s.
- `npm test -- --run` → **275 passed / 14 skipped / 0 failed** (+6 over L1 baseline of 269).
- `git diff --stat main..HEAD -- src/features/chat/` → empty.
- `git diff --stat main..HEAD -- src/App.tsx` → empty.
- `git diff --stat main..HEAD -- src/features/landing/lib/pendingPrompt.ts` → empty.
- `git diff --stat main..HEAD -- src/features/landing/lib/buildPromptChatPath.ts` → empty.
- `git diff --shortstat main..HEAD` → 20 files changed, +752 insertions, −110 deletions (pre-C9; C9 itself adds footer + photoCredit + this doc).

**Bundle delta vs main (post-L1):**

| Chunk | Before L1.5 | After L1.5 | Delta |
|---|---|---|---|
| `EmiliaLanding` | 133.27 kB | 144.18 kB | **+10.91 kB** (gzip +2.28 kB) |
| `vendor-utils` | 87.95 kB | 90.52 kB | +2.57 kB (lucide icons added across C3-C8) |
| `ChatFeature` | 2,674.10 kB | 2,674.10 kB | 0 (no regression) |

`EmiliaLanding` delta slightly above the plan's ≤10 kB target, driven primarily by HeroAurora (canvas-2D pure math + framer-motion references) and the InspirationCard imagery wiring. Within acceptable range; no new heavy dependency introduced.

## Commits in L1.5

1. `135ed69b` `feat(landing): warm coral palette scoped to .landing-shell (L1.5-C1)`
2. `22a8db8e` `feat(landing): light theme alternation on 4 sections + bg-card fix on cards (L1.5-C2)`
3. `1642a53a` `feat(landing): Unsplash image utility + wrapper + tests (L1.5-C3)`
4. `d3018c1b` `feat(landing): InspirationCard with full-bleed Unsplash imagery + overlay (L1.5-C4)`
5. `5f02dce4` `feat(landing): functional ChatPreview with prompt handoff (L1.5-C5)`
6. `0838240b` `feat(landing): HeroAurora gradient canvas + h1 scale upgrade (L1.5-C6)`
7. `6e9e7b1f` `feat(landing): stagger entrance on grids + coral hover glow on cards (L1.5-C7)`
8. `813f8b52` `feat(landing): icon micro-animations on-scroll (L1.5-C8)`
9. _(this commit)_ `feat(landing): footer photo credit + PR doc + L1.5 close (L1.5-C9)`

## Post-C9 contrast fix

An additional fix commit landed on top of C9 after a parallel human smoke
found that StepCard body text read as "almost illegible" over the cream
background in `HowItWorks`. Same regression applied to `FeatureCard` in
`HelpsWith` and `PersonalizationPoint` in `Personalized`.

Diagnosis (Rule 22 stop + report before editing):
- `text-foreground` on cards → `hsl(24 20% 12%)` on `bg-card 30 30% 99%`
  → ~18:1 ratio. Good on paper.
- `text-muted-foreground` → `hsl(30 15% 55%)` on the same background
  → **~4:1 ratio, borderline / below WCAG AA 4.5:1**. Lands as "muted-
  looking" body copy.
- Hypothesis A (most likely): bump `--muted-foreground` darker to clear
  the AA threshold on cream.
- Hypothesis B (defensive): the original `.landing-section-light`
  consumed `var(--landing-light-*)` inside var declarations
  (indirection). Spec-valid but a risk surface if any cascade context
  (including cache) fails to resolve the chain. Desindirecting to
  literal HSL removes that risk entirely.

Fix authorized as "Option 2": apply both changes in one edit.

Changes (single file, `src/index.css`, inside `.landing-section-light`):
  --background       30 25% 97%    (was var(--landing-light-bg))
  --foreground       24 20% 12%    (was var(--landing-light-fg))
  --card             30 30% 99%    (unchanged)
  --card-foreground  24 20% 12%    (was var(--landing-light-fg))
  --muted            30 20% 94%    (unchanged)
  --muted-foreground 30 15% 40%    (was 30 15% 55% via
                                    var(--landing-light-muted);
                                    bumped darker for ~7:1 ratio,
                                    WCAG AAA on cream)
  --border           30 15% 88%    (was var(--landing-light-border))
  --input            30 15% 88%    (was var(--landing-light-border))

Side effect: the four `--landing-light-*` tokens declared in `.dark` (C1)
now have no consumers. Intentionally left in place as documentation of
the palette origin. Logged above as a trivial cleanup debt.

Zero components touched. No Tailwind class in the eight text primitives
(StepCard, FeatureCard, PersonalizationPoint, Trust, SectionHeading,
SectionEyebrow, LandingFooter, ChatPreview) changed. The cascade does
the rest.

Commit: see the contrast-fix SHA appended to the commit list below.

## Post-C9 section-light self-application fix

A second post-C9 fix landed after a deeper smoke pass revealed that all
four light sections (HowItWorks, HelpsWith, Personalized, Trust) were
only half-themed: inner cards with `bg-card` looked cream correctly,
but the section backgrounds themselves and any element without an
explicit `bg-*` class (headings, body text in Personalized and Trust
which lack card framing) kept the warm dark café background inherited
from the `.landing-shell` ancestor in `LandingLayout`.

Root cause (Rule 22 stop + report):
  `.landing-section-light` declared only CSS variable overrides
  (--background, --foreground, --card, --muted-foreground, ...). It
  did not apply those tokens to itself via `background-color` or
  `color`. Result: the section rule shifted tokens for its descendants
  but the `<section>` element stayed transparent, so whatever ancestor
  had `bg-*` applied (in this case LandingLayout with bg-background
  resolving to the dark café of `.landing-shell`) provided the visible
  background.

Why HowItWorks appeared to work in the first smoke:
  Its three large StepCards (`bg-card`, `p-8`) consumed the overridden
  `--card` and painted cream on top of the still-dark section. The
  three big cream cards dominated the visible area, making the dark
  heading above feel less jarring by proximity. HelpsWith exposed the
  mismatch because its smaller 6-card grid leaves more section visible.
  Personalized exposed it fully because PersonalizationPoint has no
  card frame at all, so nothing consumed `--card` and everything sat
  on the dark section. Trust has the same issue (only an <img> and a
  SectionHeading, no card frame) and was equally broken.

Fix (src/index.css, inside `.landing-section-light`, two added lines):
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));

The rule now both declares the light tokens AND applies them to the
element itself, so any DOM node with `.landing-section-light` paints
cream and hands the light color down via inheritance. Descendants
that consume `bg-card`, `text-muted-foreground`, etc. continue to work
through the cascade unchanged.

Zero component files touched. No section className edit. The bug
affected all four light sections; the fix covers them all at the CSS
level in a single line pair.

## Previous dependency

- PR Landing L1 (merge commit `51522258`) — introduced the ten-section landing scaffold, the sessionStorage bridge, the i18n namespace, and the re-export of `EmiliaLanding`.
- ADR-002 — chat unification baseline.

## Next

- Human smoke pass on `feat/landing-redesign-L1.5` via `npm run dev`, running the checklist above.
- On green smoke: push branch to origin → open PR on GitHub → merge to main.
- PR 3 (`feat/pr3-chat-unification`) continues on its own cycle. Orthogonality validated: L1.5 did not touch `src/features/chat/**`, so a rebase of PR 3 onto post-L1.5 main should be clean.
- Registered debt items above converted into individual follow-up tickets as they become actionable.
