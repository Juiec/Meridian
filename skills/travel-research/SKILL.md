---
name: travel-research
description: "Outline what to look up for a trip: fares, weather, getting around, and entry rules. Use when the user wants comparisons or sources, not a finished booking."
---

# Travel research

1. Separate the questions: getting there, getting around, weather, where to stay, and entry rules. Ask which ones they want if they said "research the trip" with no focus.
2. Fares go through `travel_prices` only. Read the `live` flag. Illustrative quotes must be described that way. Share the search link. Do not complete checkout or collect payment.
3. Weather is `travel_weather`. Nearby places are `travel_places`. Distances are `travel_route`. Do not fill gaps with guesses.
4. Visa and entry rules change. Do not state one as fact unless `fetch_url` read an official page the user named. Otherwise say you did not confirm entry rules.
5. Do not scrape airline, hotel, or agency sites. If they have an MCP server or custom tool for a provider, use that tool and still do not book unless they explicitly ask and the tool itself only reads.
