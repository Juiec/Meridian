# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person per install. They run Meridian on their own machine and talk to a model they already host, often LM Studio, including over Tailscale. The product is not a shared service and does not grow accounts.

## Product Purpose

Meridian is the personal agent for that model: persistent sessions, a skill index loaded on demand, and two short memory files that stay on disk. Success is that this one person can keep working with the agent across sessions. Image Studio and Travel Planner stay available beside the agent. They are not equal centers of the product.

## Positioning

The agent sits in front of a model the user already runs. Meridian does not supply the model. Skills enter the prompt as an index until a body is loaded. Memory is size-capped, and a write that would overflow is refused instead of truncated.

## Operating Context

The person uses it in a browser against a local Next.js server (`npm run dev` on port 43123, or Docker Compose). The server talks to an OpenAI-compatible endpoint they configure. Sessions, skills, memory, and secrets stay on that machine (`data/`, `.agents/skills/`, `agent/`). User skills in `~/.agents/skills/` are read too. A Compose stack can join their tailnet. That path stays private and does not add a login. The desk is where they edit skills, memory, identity, and see tools. Chat modes are Agent, Ask, and Plan.

## Capabilities and Constraints

The agent streams a reply, calls tools, and can be steered or stopped mid-turn. Older turns can be compacted while the full transcript stays stored. A subagent can take one lookup and return only the result.

Skills, the user profile, and agent notes are edited in the desk and capped: user profile 1,375 characters, agent notes 2,200, a skill description 1,024, a skill body 20,000, identity 6,000, instructions 8,000. Overflow is an error and changes nothing.

Image Studio generates and edits images beside the current chat. Travel Planner keeps a map, itinerary, and fare checks beside chat. Places, weather, distances, and fares come from lookups. Meridian does not invent them. A fare or booking action only helps find the link. Nothing is booked, paid for, or charged.

Binding constraints:

- One operator per install. No accounts, and no login.
- Do not expose the app to the public internet.
- Memory and skills stay size-capped and refuse overflow instead of truncating.
- Travel facts are looked up. A booking action finds a link and stops there.

Current behavior that is not a locked promise: the browser does not call the model, MCP servers, or webhooks itself; the Next.js server does. The README states that the prose and code are original, and that the shape borrows from Hermes Agent and Pi.

## Brand Commitments

The product name is Meridian. The agent's voice is the text in `agent/SOUL.md`, which the desk edits: direct, matched to the size of the request, and without filler.

## Evidence on Hand

- `README.md` is the operator's manual.
- `docs/meridian-product.png` is a wireframe of the layout, not a marketing shot.
- Shipped skills live under `.agents/skills/`.
- There are no testimonials, customers, pricing, press, or case studies. Do not invent them.

## Product Principles

- One person, one install. Do not turn Meridian into a shared product.
- The agent is the center. Image Studio and Travel Planner stay alongside it.
- Keep memory and skills bounded. Refuse a write that does not fit.
- Stay private. No public exposure and no login.
- Travel information is retrieved. A booking action finds a link and stops there.
