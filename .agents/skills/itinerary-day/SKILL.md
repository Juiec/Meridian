---
name: itinerary-day
description: "Turn a trip brief or the pinned map into a day-by-day schedule. Use when the user wants the days ordered, not a new destination."
---

# Day-by-day itinerary

1. Call `travel_plan` with action list. If the map is empty, ask for the destination and pin it with `travel_geocode` before you schedule anything.
2. Order stops within each day. Before you state a travel time, call `travel_route` between the consecutive stops. If routing is unavailable, say you only have the straight-line distance.
3. Leave room for meals and a buffer. Do not fill every hour unless they asked for a timetable. Do not invent opening hours or ticket prices.
4. Update `travel_plan` when they move a stop to another day so the map matches the schedule.
