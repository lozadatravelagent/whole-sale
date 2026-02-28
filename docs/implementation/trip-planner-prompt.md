# Trip Planner Prompt

## Objective
Implement a `Trip Planner` feature inside a submenu, inspired by the Mindtrip experience but adapted for Vibook.

The goal is to let users plan an entire trip through chat using natural language prompts, and have the system return a structured, editable, context-aware itinerary based on dates, trip length, budget, interests, and destinations.

## Improved Prompt

```text
I want to implement a `Trip Planner` feature inside a submenu, inspired by the Mindtrip experience but adapted for Vibook.

Objective:
Allow users to plan a full trip by chatting in natural language, and have the system return a complete, editable, context-aware itinerary based on dates, trip duration, and destinations.

Expected behavior:
- The user can write something like: “I want to travel for 12 days through Madrid, Paris, and Rome in May, with a mid-range budget, prioritizing food, walking, and museums.”
- The system should interpret dates, number of days, destinations, travel style, budget, interests, and trip pace.
- Based on that, it should build a day-by-day or segment-by-segment travel plan.
- The itinerary should include:
  - flights or transportation between destinations
  - suggested hotels by city and date range
  - activities, attractions, and things to do based on the destination and travel dates
  - personalized recommendations based on the user’s intent and profile
- The main response should be delivered via chat, but it should also be structured visually inside the module so the user can review, edit, and keep building the trip.

Product experience:
- The flow should feel conversational, like a real travel assistant.
- It should support follow-ups such as:
  - “make it more relaxed”
  - “replace Paris with Lisbon”
  - “add more nightlife”
  - “upgrade the hotels”
  - “lower the budget”
- It should keep context across messages and regenerate the itinerary without losing coherence.
- If the trip includes multiple destinations, the system should organize the plan by city, by date range, and by day.
- Every recommendation should be actionable and useful, not just descriptive.

Functional inspiration to replicate:
- conversational trip planning
- personalized and actionable recommendations
- editable itineraries
- a combination of flights, hotels, and activities
- a clear visual trip structure
- the ability to start from a broad idea and refine it through conversation

Expected deliverable:
I want a complete implementation proposal for this module, including:
- submenu UX
- conversational flow
- itinerary data structure
- chat + visual plan integration
- multi-destination handling
- edge cases
- acceptance criteria
```

## More Technical Version

```text
Design and implement a `Trip Planner` module inside a submenu, with a conversational experience inspired by Mindtrip.

The module must allow a user to plan a full trip through natural language prompts and receive a structured, editable, persistent itinerary as the response.

Functional requirements:
1. The user can start with either a broad or a specific idea:
   - destinations
   - dates
   - number of days
   - budget
   - interests
   - trip type
   - itinerary pace
2. The system must interpret that intent and generate a complete travel plan.
3. The plan must include:
   - flights or connections between destinations
   - hotels by city and travel segment
   - activities and places to visit based on destination and dates
4. The result must be shown:
   - in conversational format inside the chat
   - in a structured visual format inside the submenu
5. The user must be able to iterate on the plan with follow-up prompts without losing context.
6. The system must support multi-destination trips and automatically reorganize the plan when cities or dates are added, removed, or changed.

Experience requirements:
- It should feel like an intelligent travel planner, not a simple search tool.
- Recommendations must be personalized, actionable, and logically ordered.
- The experience should prioritize visual clarity, conversational continuity, and ease of editing.

Use Mindtrip’s behavior as the reference:
- conversational planning
- personalized itineraries
- actionable recommendations
- a mix of inspiration and structure
- the ability to refine the trip iteratively

I want the output to define:
- functional architecture
- UI components
- data structures
- itinerary state model
- prompts and parsing requirements
- context handling
- acceptance criteria
- edge cases
```

## Product Reference

The target reference is to reproduce the kind of experience Mindtrip promotes as:

- conversational travel planning
- built and refinable itineraries
- a mix of inspiration and action
- continuity between chat and a visual plan
- personalization based on user intent

## What the Module Should Be Able to Do

- Understand both broad and specific prompts.
- Infer destinations, dates, number of days, budget, preferences, and interests.
- Build an itinerary by day or by segment.
- Suggest flights or route connections between cities.
- Suggest hotels based on destination and dates.
- Recommend activities and things to do based on context.
- Maintain context across messages.
- Reorganize the plan when the user edits the trip.
- Present the result both in chat and in a structured visual view.

## Example Input

```text
I want to travel for 12 days through Madrid, Paris, and Rome in May, with a mid-range budget, prioritizing food, walking, and museums.
```

## Example Follow-Ups

- `make it more relaxed`
- `replace Paris with Lisbon`
- `add more nightlife`
- `upgrade the hotels`
- `lower the budget`

## Expected Implementation Deliverable

The module should be designed with:

- submenu UX
- conversational flow
- itinerary data structure
- integration between chat and the visual plan
- multi-destination support
- context and refinement handling
- edge cases
- acceptance criteria

## References

- Mindtrip official site: `https://mindtrip.ai/`
- Product overview / how it works: `https://mindtrip.ai/`
- Axios coverage on Mindtrip: `https://www.axios.com/2024/07/31/ai-trip-planner-travel-itinerary-mindtrip`
