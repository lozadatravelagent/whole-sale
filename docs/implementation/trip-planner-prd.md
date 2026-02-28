# Trip Planner PRD

## Overview
Build a `Trip Planner` module inside the chat experience that lets a user describe a trip in natural language and receive a structured, editable itinerary. The experience should feel closer to a travel advisor than a search form: the user starts with a broad idea or a detailed brief, and the system turns that into a coherent plan with transportation, hotels, and activities.

The product reference is the conversational planning style used by Mindtrip, adapted to Vibook's current chat-first workflow and travel quoting logic.

## Problem
The current product already supports travel search requests such as flights, hotels, combined trips, services, and a basic itinerary request. That is useful for transactional search, but it is still too narrow for users who want help planning the trip itself.

Current gaps:
- The user cannot plan a multi-destination trip as an evolving conversation.
- There is no persistent visual itinerary view connected to the chat.
- The existing itinerary flow is too limited for budgets, interests, pace, hotel preferences, and iterative edits.
- Recommendations for things to do are not part of the main trip-building loop.

## Product Goal
Allow a user to plan an entire trip in chat, then view and refine that itinerary in a dedicated planner panel without losing context across follow-up messages.

## Success Criteria
- A user can start with a prompt containing dates, duration, destinations, budget, and interests.
- The system returns a structured itinerary that is coherent and useful, not just descriptive text.
- The itinerary can be refined with follow-up prompts while preserving context.
- Multi-destination trips are broken down by city, segment, and day.
- The result is visible both in chat and in a visual planner view.

## Non-Goals
- Real-time booking and checkout inside the planner.
- Full map-building or turn-by-turn navigation.
- A full replacement of the current flight and hotel search modules.
- A perfect replica of Mindtrip's UI. The goal is to replicate the quality of the planning experience, not clone the product literally.

## Primary Users
- Travel advisors using Vibook to plan trips for clients.
- Sales users who need a faster way to turn discovery into a structured proposal.
- Users who start from inspiration rather than a fully defined flight or hotel search.

## Core User Stories
- As a user, I want to describe a trip in plain language and get a first itinerary draft.
- As a user, I want the system to understand multiple destinations and distribute days across them logically.
- As a user, I want recommendations for what to do based on destination, dates, and trip style.
- As a user, I want suggested flights and hotels to appear in the same planning flow.
- As a user, I want to ask for changes like "make it more relaxed" or "replace Paris with Lisbon" and have the itinerary update coherently.
- As a user, I want a visual trip view so I can understand the plan beyond the raw chat response.

## Experience Principles
- Conversational first: the user should not need to fill a rigid form before getting value.
- Structured output: every useful chat result should also have a visual itinerary representation.
- Editable continuity: follow-up prompts should refine the trip, not restart it.
- Actionable recommendations: suggestions should help the user make decisions, not just inspire.
- Multi-destination clarity: the plan must stay understandable when several cities are involved.

## Functional Requirements

### 1. Natural Language Intake
The system must understand:
- destinations
- dates or approximate travel windows
- number of days
- budget level or budget amount
- travel style
- interests
- pace of itinerary
- hotel quality preferences
- special constraints such as family travel, nightlife, museums, beach, food, remote work, or low walking

### 2. Trip Plan Generation
The system must generate a plan that can include:
- trip summary
- segment order
- city-by-city breakdown
- day-by-day plan
- transportation between cities
- suggested hotels by segment
- suggested activities by day or segment
- rationale or notes when useful

### 3. Chat Response
The primary response must be delivered in chat in a concise but useful structure:
- summary of the trip
- high-level itinerary
- notable transport or hotel recommendations
- key activities and daily rhythm

### 4. Visual Planner View
The same trip must be represented visually inside the module with:
- trip summary header
- destination segments
- days within each segment
- cards for flights, hotels, and activities
- editing affordances for changes and regeneration

### 5. Follow-Up Iteration
The user must be able to refine the trip with prompts such as:
- `make it more relaxed`
- `replace Paris with Lisbon`
- `add more nightlife`
- `upgrade the hotels`
- `reduce the budget`
- `stay longer in Rome`

The system must preserve context and update only the relevant parts of the trip when possible.

### 6. Multi-Destination Support
For trips with several destinations, the planner must:
- keep segment order
- keep dates aligned
- distribute nights or days logically
- avoid overlapping segments
- preserve transport between destinations

### 7. Suggestion Types
Recommendations should cover:
- flights or route connections
- hotels
- activities
- food and neighborhood ideas
- timing notes when relevant

### 8. Persistence
The planner state should persist within the conversation so the user can reopen the chat and continue editing the same trip draft.

## Example Prompt
```text
I want to travel for 12 days through Madrid, Paris, and Rome in May, with a mid-range budget, prioritizing food, walking, and museums.
```

## Example Follow-Ups
- `make it more relaxed`
- `replace Paris with Lisbon`
- `add more nightlife`
- `upgrade the hotels`
- `lower the budget`
- `keep Rome but make it only 2 nights`

## Output Shape
The output should support two layers:

### Conversational Output
- short summary
- trip logic
- notable recommendations

### Structured Output
- trip id
- trip summary
- segments
- daily items
- hotels
- transport
- activities
- editable preferences

## UX Requirements
- The Trip Planner must live in a clear submenu or mode within chat.
- The user must be able to tell when they are in planner mode versus standard search mode.
- The visual planner should update after each relevant assistant response.
- Changes should feel incremental, not destructive.
- The planner should degrade gracefully when information is missing by asking targeted follow-up questions.

## Edge Cases
- Missing dates but clear destinations and duration.
- Dates present but no duration.
- Multiple destinations with unrealistic timing.
- Budget too low for the requested trip shape.
- User changes one city after a full itinerary was already generated.
- User wants only inspiration first, then concrete options later.
- User asks for planning plus quote generation in the same thread.

## Acceptance Criteria
- The user can create a trip plan from a single natural language prompt.
- The system can generate a multi-destination itinerary.
- The itinerary is visible in chat and in a structured planner view.
- The user can refine the plan with follow-up prompts without losing context.
- Flights, hotels, and activities are all representable in the planner state.
- The planner can handle incomplete input by asking for only the missing pieces.

## Future Extensions
- Export planner to PDF.
- Push selected hotels and flights directly into quotation flows.
- Show a map view for route context.
- Add collaboration or approval flows for agent-client review.
- Add saved trip templates by profile or travel style.

## References
- Mindtrip official site: `https://mindtrip.ai/`
- Mindtrip product overview: `https://mindtrip.ai/`
- Axios coverage: `https://www.axios.com/2024/07/31/ai-trip-planner-travel-itinerary-mindtrip`
