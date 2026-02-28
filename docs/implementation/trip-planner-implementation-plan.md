# Trip Planner Implementation Plan

## Goal
Implement a `Trip Planner` mode inside the current Vibook chat flow so users can generate and iteratively refine full trip itineraries through chat, while also seeing the trip in a structured visual planner.

This plan is specific to the current repo and reuses the existing chat architecture instead of proposing a separate product stack.

## Current Repo Baseline

### Existing Entry Points
- The authenticated chat route is mounted in [src/pages/Chat.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/pages/Chat.tsx).
- The main chat composition lives in [src/features/chat/ChatFeature.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/ChatFeature.tsx).
- The conversation list UI lives in [src/features/chat/components/ChatSidebar.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/components/ChatSidebar.tsx).
- The global app navigation is in [src/components/layout/MainLayout.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/components/layout/MainLayout.tsx).

### Existing Parsing and Search Flow
- Travel request parsing lives in [src/services/aiMessageParser.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/services/aiMessageParser.ts).
- Chat message orchestration lives in [src/features/chat/hooks/useMessageHandler.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/hooks/useMessageHandler.ts).
- Search handlers live in [src/features/chat/services/searchHandlers.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/services/searchHandlers.ts).

### Existing Itinerary Support
The repo already has a basic itinerary flow:
- `ParsedTravelRequest.requestType` includes `itinerary`.
- `ParsedTravelRequest.itinerary` currently supports only:
  - `destinations: string[]`
  - `days: number`
- `handleItineraryRequest()` already exists in [src/features/chat/services/searchHandlers.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/services/searchHandlers.ts) and calls the Supabase Edge Function `travel-itinerary`.

This means the correct approach is to expand the existing itinerary path into a richer Trip Planner flow, not create a disconnected feature from scratch.

## Proposed Product Placement

### Recommended UX Placement
Add the Trip Planner as a submenu or mode under the current `Chat` area rather than as a separate top-level route.

Recommended implementation:
- Keep `/chat` as the route.
- Add a planner mode toggle in [ChatSidebar.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/components/ChatSidebar.tsx).
- Show two chat-side modes:
  - `Conversations`
  - `Trip Planner`

This keeps planning within the same mental model and reuse path as the existing assistant, contextual memory, and PDF workflows.

### Why This Fits the Current Repo
- `MainLayout` already treats `Chat` as a special expandable destination.
- `ChatFeature` already owns message handling and can mount planner UI beside or inside the chat panel.
- The parser and search layer already understand itinerary requests and can be extended safely.

## Functional Architecture

### Phase 1: Planner Mode and Visual Shell
Create a planner-specific shell inside chat.

Suggested new components:
- `src/features/trip-planner/components/TripPlannerPanel.tsx`
- `src/features/trip-planner/components/TripPlannerHeader.tsx`
- `src/features/trip-planner/components/TripSegmentCard.tsx`
- `src/features/trip-planner/components/TripDayCard.tsx`
- `src/features/trip-planner/components/TripSidebarModeSwitch.tsx`

Suggested integration points:
- Mount planner mode controls in [ChatSidebar.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/components/ChatSidebar.tsx).
- Mount the visual planner panel inside [ChatFeature.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/ChatFeature.tsx), likely beside `ChatInterface` on desktop and as a secondary panel on mobile.

### Phase 2: Richer Request Model
Extend `ParsedTravelRequest.itinerary` in [aiMessageParser.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/services/aiMessageParser.ts).

Current:
```ts
itinerary?: {
  destinations: string[];
  days: number;
};
```

Proposed:
```ts
itinerary?: {
  destinations: string[];
  days?: number;
  startDate?: string;
  endDate?: string;
  budgetLevel?: 'low' | 'mid' | 'high' | 'luxury';
  budgetAmount?: number;
  interests?: string[];
  travelStyle?: string[];
  pace?: 'relaxed' | 'balanced' | 'fast';
  hotelCategory?: string;
  travelers?: {
    adults?: number;
    children?: number;
    infants?: number;
  };
  constraints?: string[];
};
```

This should remain backward compatible with the current simpler itinerary flow.

### Phase 3: Planner State Model
Introduce a structured planner result model.

Suggested new types:
- `TripPlannerState`
- `TripSegment`
- `TripDay`
- `TripActivity`
- `TripTransport`
- `TripHotelSuggestion`

Suggested file:
- `src/features/trip-planner/types.ts`

Suggested shape:
```ts
interface TripPlannerState {
  tripId: string;
  title: string;
  summary: string;
  destinations: string[];
  startDate?: string;
  endDate?: string;
  days: number;
  budgetLevel?: string;
  interests: string[];
  pace?: string;
  segments: TripSegment[];
  lastUserIntent?: string;
}

interface TripSegment {
  id: string;
  city: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  nights?: number;
  hotelSuggestions?: TripHotelSuggestion[];
  transportIn?: TripTransport | null;
  transportOut?: TripTransport | null;
  days: TripDay[];
}
```

## Chat and Planner Synchronization

### Recommended Flow
1. User sends a planner-style message in chat.
2. [useMessageHandler.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/hooks/useMessageHandler.ts) parses it through `parseMessageWithAI`.
3. The parser returns `requestType: 'itinerary'` with richer itinerary fields.
4. `handleItineraryRequest()` calls the itinerary generation service.
5. The assistant returns:
   - chat response
   - structured `plannerData` in message metadata
6. `ChatFeature` stores and renders the latest `plannerData` in `TripPlannerPanel`.

### Storage Strategy
Persist planner state in the conversation thread first, using message metadata and existing contextual memory.

Recommended near-term approach:
- Store the latest planner payload in assistant message metadata.
- Store the latest parsed itinerary request in contextual memory through the existing `saveContextualMemory()` hook.

Recommended later upgrade:
- Add a dedicated `trip_plans` table if planners become long-lived assets independent from a single chat thread.

## Parser Changes

### File
- [src/services/aiMessageParser.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/services/aiMessageParser.ts)

### Required Changes
- Extend itinerary extraction beyond `destinations` and `days`.
- Detect:
  - date ranges
  - duration
  - destinations
  - interests
  - budget
  - pace
  - hotel quality preferences
  - traveler counts
- Support follow-up modifications against a previous itinerary request.

### Required Validation Updates
Expand `validateItineraryRequiredFields()` so it accepts either:
- `destinations + days`
- or `destinations + date range`

It should also support partial follow-ups without throwing away previous context.

## Search and Generation Layer

### File
- [src/features/chat/services/searchHandlers.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/services/searchHandlers.ts)

### Current State
`handleItineraryRequest()` calls the `travel-itinerary` Edge Function with only:
- `destinations`
- `days`

### Proposed Changes
Expand the request body to support:
- date window
- budget
- interests
- pace
- hotel preference
- traveler profile

Proposed body:
```ts
{
  destinations,
  days,
  startDate,
  endDate,
  budgetLevel,
  budgetAmount,
  interests,
  pace,
  hotelCategory,
  travelers,
  constraints
}
```

### Response Contract
The edge function should return:
- narrative summary
- structured planner state
- segment list
- daily items
- optional hotel and transport suggestions

## UI Implementation

### 1. Sidebar Mode Switch
File to update:
- [src/features/chat/components/ChatSidebar.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/components/ChatSidebar.tsx)

Change:
- Add a planner mode switch above the conversation tabs.
- Allow the user to create a new planner conversation or filter planner-oriented chats later.

### 2. Chat Layout
File to update:
- [src/features/chat/ChatFeature.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/ChatFeature.tsx)

Change:
- Add `TripPlannerPanel` next to `ChatInterface` when planner data is present or planner mode is active.
- Desktop:
  - split view with chat on one side and planner on the other
- Mobile:
  - tabbed or stacked panel approach

### 3. Message Rendering
Potential files:
- `src/features/chat/components/ChatInterface.tsx`
- `src/features/chat/components/MessageItem.tsx`

Change:
- Assistant itinerary messages should render a compact planner summary card in chat.
- The full editable structure should remain in the planner panel.

## Suggested New Feature Folder
Recommended new folder:
- `src/features/trip-planner/`

Suggested structure:
- `components/`
- `hooks/`
- `types.ts`
- `utils/`

This keeps planner logic separate from the generic chat feature while still integrating into it.

## Follow-Up and Context Handling

### Existing Assets to Reuse
- `useContextualMemory`
- `combineWithPreviousRequest`
- `detectIterationIntent`
- `mergeIterationContext`

### Needed Behavior
The planner must support modifications like:
- replace city
- add a city
- remove a city
- adjust budget
- adjust pace
- change hotel level
- add different interests

Recommended rule:
- if the follow-up clearly targets itinerary structure, merge only the changed fields and regenerate the planner state
- if the follow-up asks for flight or hotel quoting, branch into the existing search flows while preserving the planner state

## Edge Function Strategy

### Existing Function
- `travel-itinerary`

### Recommendation
Do not create a brand-new backend path unless necessary. Expand `travel-itinerary` first so it becomes the Trip Planner generation engine.

Expected responsibilities:
- interpret structured itinerary input
- distribute days across destinations
- generate day-level recommendations
- suggest transport between cities
- suggest hotel positioning by segment

## Data Contract for Planner Metadata
Suggested assistant message metadata:
```ts
metadata: {
  type: 'trip_planner',
  plannerData: TripPlannerState,
  originalRequest: ParsedTravelRequest,
  plannerVersion: 1
}
```

This is enough for:
- chat rendering
- planner panel rendering
- contextual memory reuse

## File-by-File Implementation Outline

### Existing files to update
- [src/features/chat/components/ChatSidebar.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/components/ChatSidebar.tsx)
- [src/features/chat/ChatFeature.tsx](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/ChatFeature.tsx)
- [src/features/chat/hooks/useMessageHandler.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/hooks/useMessageHandler.ts)
- [src/features/chat/services/searchHandlers.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/services/searchHandlers.ts)
- [src/services/aiMessageParser.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/services/aiMessageParser.ts)
- [src/features/chat/types/chat.ts](/C:/Users/Fran/Desktop/Projects/WholeSale/wholesale-connect-ai/src/features/chat/types/chat.ts)

### New files recommended
- `src/features/trip-planner/types.ts`
- `src/features/trip-planner/components/TripPlannerPanel.tsx`
- `src/features/trip-planner/components/TripSegmentCard.tsx`
- `src/features/trip-planner/components/TripDayCard.tsx`
- `src/features/trip-planner/components/TripPlannerSummary.tsx`
- `src/features/trip-planner/utils/plannerFormatters.ts`

## Delivery Phases

### Phase 1
- Add planner mode shell in chat UI
- Add planner types
- Expand itinerary parser
- Expand `travel-itinerary` request/response
- Render planner result in chat and side panel

### Phase 2
- Add follow-up editing logic
- Add hotel and flight recommendation linking
- Add stronger segment/day editing affordances

### Phase 3
- Add export to PDF
- Add CRM handoff from planner
- Add reusable trip drafts and richer persistence

## Edge Cases
- User provides a vague idea with no dates.
- User provides dates but no duration.
- Destinations exceed the available number of days.
- User changes only one city after a full plan was generated.
- User asks for hotels only after a planner response.
- User asks for a quote after the planner response.
- User wants activities without flights.

## Acceptance Criteria
- The chat UI exposes a Trip Planner mode.
- The parser can extract a richer itinerary request from natural language.
- The itinerary handler returns structured planner data, not only narrative text.
- The planner appears visually in the chat experience.
- Follow-up prompts can modify the planner without losing the previous trip state.
- Multi-destination itineraries are segmented clearly by city and day.

## Recommended First Build
If the scope needs to be reduced, the best first version is:
- planner mode inside `/chat`
- itinerary parsing for destinations, days, dates, budget, interests, and pace
- one structured planner panel
- Edge Function returns segments and days
- no PDF or CRM export yet

That gets the core experience in place with the least architectural churn.
