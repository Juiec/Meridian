# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person per installation. They self-host a model, or connect one they already have, and want an agent UI for it.

## Product Purpose

Meridian is that agent UI. It keeps conversations, a skill index, and a short memory on the machine, and it can plan a trip. Success is a working conversation with the model they saved, including the trip conversation, while the trip stays a plan.

## Positioning

The install belongs to one person. Conversations, skills, memory, and the trip share that install, and every conversation reaches a model through an endpoint the person saved.

## Operating Context

The person uses it in a browser against their own Next.js server. Named endpoints are saved on that server: profiles in `data/endpoints.json`, keys in `data/secrets/endpoints.json`. Today the browser does not call the model itself, and storage stays on that machine. Those are how this install works, not locked requirements.

## Capabilities and Constraints

- Travel can plan. It does not book.
- The trip conversation uses the same saved endpoints as other chats. Its header can switch host and model. A trip whose stored model is no longer offered by its endpoint follows the active saved endpoint.
- Fare checks can use a separate price URL. With none, quotes are illustrative. Nothing is booked.
- Retrieval over added project folders is a committed capability. It is not built yet.

## Brand Commitments

Keep Fraunces for display and Geist for sans.

## Evidence on Hand

The running app, `README.md`, `agent/SOUL.md`, and `agent/AGENTS.md` are the product record. There are no testimonials, case studies, or press. Do not invent them.

## Product Principles

- One person, one installation.
- The model is theirs. Meridian is the agent around it.
- A saved endpoint is how every conversation, including the trip, reaches a model.
- A trip is a plan. Meridian does not book it.
- Project-folder retrieval is part of the product, even before the retrieval exists.
