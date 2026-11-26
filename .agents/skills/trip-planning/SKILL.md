---
name: trip-planning
description: "Plan a trip: destination, dates, constraints, budget frame, and an itinerary outline. Use when the user wants to shape a journey before booking anything."
---

# Trip planning

1. Do not assume a home city, airport, or budget. If origin, destination, dates, who is going, constraints, or a budget frame are missing, ask for the missing pieces in one short question.
2. When a destination is known, call `travel_geocode`. If several matches come back, ask which one. Then call `travel_weather` for that point and `travel_plan` add with the chosen coordinates, kind destination, and a day if one is known.
3. Outline the trip: where to stay, three to six ideas, and what is still undecided. Call `travel_places` only for the kinds of places they asked about. Pin the ones they want to keep.
4. Do not invent fares, opening hours, or visa rules. If they want costs, call `travel_prices`. If `live` is false, say the numbers are illustrative and give the link. Never book, pay, or ask for a card.
5. A lasting preference (aisle seat, slow mornings) can be offered as a short USER memory entry. Do not store one-off dates in memory.
