---
name: packing-list
description: "Build a packing list from the trip type, dates, and destination weather. Use when the user asks what to pack or bring."
---

# Packing list

1. You need a destination, rough dates, and the trip type: city, beach, hike, cold, formal, or something they name. If any of those are missing, ask. Do not assume a home climate.
2. Once the place is known, call `travel_weather` and pack for the days it actually returns. If the trip is outside that window, say the forecast does not cover the dates and pack from what they told you.
3. Group the list: documents, clothes, health, electronics. Give quantities only when they change the list. Skip items they would obviously already carry unless the trip makes them matter.
4. Do not invent baggage rules. If they ask about an airline's policy, say you did not look it up unless a tool result says so.
