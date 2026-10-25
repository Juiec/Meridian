# Meridian

Meridian is a personal agent UI for a model you already run. The Next.js server talks to LM Studio’s OpenAI-compatible API (`/v1/chat/completions` and `/v1/models`), including streaming and tool calls. The browser never dials your tailnet itself. Sessions, a skill index, and two short memory files stay on disk.

It borrows the shape of [Hermes Agent](https://hermes-agent.nousresearch.com/docs/developer-guide/prompt-assembly) and [Pi](https://pi.dev/docs/latest/skills): a cache-friendly prompt, skills loaded on demand, and bounded memory that errors instead of silently truncating. The prose and code are original.

## Run locally

Node.js 22 or newer (the app uses `node:sqlite`).

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

`npm test` runs the agent, memory, skill, and client tests against a mock OpenAI server. Tailscale does not need to be running.

## Point it at LM Studio over Tailscale

1. In LM Studio, load a model and start the local server (default port **1234**). Enable the OpenAI-compatible endpoint. Tool calling has to be supported by the model you loaded.
2. Join the machine to your tailnet. MagicDNS gives it a name like `studio.tailnet-name.ts.net`.
3. In Meridian, open **LM Studio** and set the base URL:

```text
http://studio.tailnet-name.ts.net:1234/v1
```

Use `https` if you terminate TLS in front of LM Studio. If you leave the path off (`http://host:1234`), Meridian appends `/v1`. Put an API key in the key field only when the server expects `Authorization: Bearer …`. The key is written to `data/settings.json` on the server and is not returned to the browser.

4. **Check connection**. The app calls `GET /v1/models` from the Next.js process and lists what LM Studio reports. Pick a model id and save. New sessions copy that id; the header on a chat can override it for that session only.

The same values can come from the environment. A saved settings file wins when the field is present.

| Variable | Purpose |
| --- | --- |
| `LM_STUDIO_BASE_URL` | Base URL, including `/v1` |
| `LM_STUDIO_API_KEY` | Optional bearer token |
| `MODEL` | Default model id |

This environment does not need Tailscale installed. Set the URL to wherever LM Studio is reachable from the machine running `npm run dev`.

## Chat

- Streaming tokens, a thinking disclosure when the model emits reasoning, and a tool card for every call.
- The loop keeps going until the model returns text with no tool calls, or after 6 passes. The last pass is forced to answer without tools.
- **Stop** aborts the LM Studio request. Partial text is kept, a “Generation stopped.” note is stored, and unrun tool calls are closed with an error so the next turn stays valid. **Retry** drops the last assistant turn and runs the same user message again.
- The header model control lists ids from the last successful `GET /v1/models`. If LM Studio is unreachable, that list stays available and a banner says the server is offline. You can still type an id before the first successful check.
- Attach text, markdown, code, or a PNG/JPEG/GIF/WebP image. Text is stored with the message and sent to the model as part of the turn. Images are sent as OpenAI-style `image_url` parts when the loaded model supports vision. Files named like `.env`, keys, or pems are refused, and a file that is mostly `KEY=value` lines is refused too.
- Sessions can be renamed, pinned, archived, searched (title or transcript), exported as Markdown or JSON, and imported from a Meridian JSON export. Deleting a chat does not touch memory. SQLite lives at `data/meridian.sqlite`. Renaming updates the chat header immediately.
- `/skill:name` at the start of a message loads that skill for the model. The transcript stores what you typed. Up to five leading `/skill:` tokens are honored.
- When the visible history passes about 18,000 characters and there are more than two turns, older turns are summarized. The transcript shows a compaction note. The full messages stay in SQLite. The summary is what the model sees. Compaction also rebuilds the system prompt from disk, which is when a new skill index, new memory, and edited identity enter an ongoing chat.

## Skills

Skills are directories under `skills/` with a `SKILL.md` file:

```markdown
---
name: my-skill
description: "What it does and when to load it. The description is the only part the model sees up front."
---

# The procedure

Steps the model should follow after skill_view, or after /skill:my-skill.
```

Names are lowercase letters, numbers, and single hyphens. A missing description means the skill is skipped.

At session start Meridian injects only an index: name, description, and path. The model loads the body with the `skill_view` tool, and a reference file with `skill_view` plus `path` (for example `references/source-rubric.md`). `list_skills` reports the live directory. Set `disable-model-invocation: true` to hide a skill from the index while still allowing `/skill:name`.

Shipped skills:

| Skill | Use it when |
| --- | --- |
| `web-research` | The user wants a short research brief from real URLs |
| `code-explain` | They pasted code and want it explained, not replaced |
| `daily-planning` | They want a plan for the day or the next block of work |
| `prompt-refine` | They want a prompt rewritten for a local model |
| `trip-planning` | They want an outline that uses geocoding, weather, the map, and fare tools |
| `packing-list` | They want a list shaped by destination and the forecast |
| `itinerary-day` | They want a day-by-day plan from the pinned map |
| `travel-research` | They want fares, weather, or entry notes looked up rather than invented |

The desk can create, edit, and delete skills without a restart. A new skill needs a name (`lowercase-words`), a description of 1024 characters or fewer, and a body of 20,000 characters or fewer. Optional references live in `references/` as `notes.md` or `notes.txt`. `disable-model-invocation` hides a skill from the index while `/skill:name` can still load it. Saving reloads the index for the next session and for compaction. You can also add a skill by creating `skills/your-name/SKILL.md` on disk. The desk inserts `/skill:your-name` into the composer.

## Memory

Two files, created on first write under `data/memory/`:

| File | Role | Limit |
| --- | --- | --- |
| `MEMORY.md` | The agent’s notes: environment, conventions, lessons | 2,200 characters |
| `USER.md` | Who you are: name, preferences, working style | 1,375 characters |

Character counts are the entry text, not the `§` separators. Entries are separated by a line that is only `§`, so a note can span lines.

A snapshot is frozen into the system prompt when the session is created. Writes during the chat hit disk immediately and come back in the tool result, but they do not change that prompt until the next session or a compaction rebuild. The desk shows the live files and the character meters. You can add or remove entries there; the same function the model calls enforces the limit.

The `memory` tool takes `target` (`memory` or `user`) and `operations`: `add`, `patch` (`old_text` plus `content`), or `remove` (`old_text`). A write that would overflow returns an error and changes nothing. The model is told to retry as one batch that frees space and adds the new fact. Exact duplicates are ignored. Entries that look like prompt injection are refused.

## Identity

The desk edits two more files. They are not injected mid-session until the prompt is rebuilt.

| File | Role | Limit |
| --- | --- | --- |
| `agent/SOUL.md` | Stable identity | 6,000 characters |
| `agent/AGENTS.md` | Context instructions for this app | 8,000 characters |

A save that would pass the limit returns an error and leaves the file unchanged. The root `AGENTS.md` is Next.js guidance for coding agents and is not this file.

## Tools

Skills and tools are different. A skill is a prompt playbook: the model sees a short index, then loads the procedure with `skill_view` or `/skill:name`. A tool is a function the model can call. Built-in tools are `memory`, `skill_view`, `list_skills`, `fetch_url`, `current_time`, and the `travel_*` lookups below. MCP tools and custom HTTP tools join that same list. Their calls show up in the same tool cards in the transcript. The settings catalog lists every name the next turn can call.

The browser never talks to an MCP server or a webhook. Settings and the desk ask this Next.js server, and the server connects.

### Add an MCP server

Open **Settings** (or the desk’s Tools section, which links there). Add a server with a name, a transport, and either a command or a URL. Enable it. Meridian connects, lists tools, and prefixes each one so it cannot replace a built-in: `mcp_<server>_<tool>`, lowercased, with anything outside `[a-z0-9_-]` turned into `_`. A remote tool named `memory` on a server named Desk is exposed as `mcp_desk_memory`. If two exposed names would match, the later one gets a numeric suffix.

Transports in this version:

| Transport | What you fill in |
| --- | --- |
| stdio | Command and arguments. Meridian spawns the process with `node:child_process` and speaks MCP on stdin/stdout. The child gets a safe default environment (PATH and similar) plus only the variables you save. It does not inherit `LM_STUDIO_API_KEY`. |
| HTTP | Streamable HTTP URL. Optional headers, such as `Authorization`. |
| SSE | Older HTTP+SSE MCP URL, with the same header rules. |

`scripts/demo-mcp.mjs` is a tiny stdio server with one tool, `ping`. Command `node`, argument `scripts/demo-mcp.mjs`. It imports Zod 3 from the MCP SDK, because that package does not understand Zod 4 schemas. Refresh reconnects and reloads the tool list. Status is Connected, Error, Disabled, or Not connected. A server that fails to connect is skipped on the next chat turn until you Refresh or save it again. One dead server does not stop the chat.

Disable, edit, or remove servers from the same page. Environment values and header values are stored in `data/mcp-servers.json`. The API returns the key names only.

### Register a custom tool

On the same page, add a tool with a name, a description, a JSON Schema for its parameters (`type` must be `object` when set), an HTTP method, and a URL. Optional headers are stored the same way as MCP headers: saved on the server, not echoed back.

POST, PUT, and PATCH send the model’s arguments as a JSON body. GET and DELETE append them to the query string. The response text is what the model sees, capped, with `[truncated]` when it is long. Timeouts are 15 seconds.

If the name collides with a built-in or another tool already in the list, Meridian calls it `custom_<name>` instead of replacing the built-in. Two custom tools cannot share the same sanitized name.

### Security

Meridian assumes it is running on your machine, for you. Do not expose port 43123 to the internet.

- stdio servers are arbitrary commands. Only add servers you trust. The process runs as the same user as the app.
- Custom tools may call localhost and private addresses. That is deliberate, so a webhook on your machine works. `fetch_url` still refuses those addresses. Webhook redirects are checked again, metadata addresses such as `169.254.169.254` are blocked, and headers are dropped if a redirect leaves the original host.
- Do not put secrets in a URL. Put them in environment variables or headers. Those values live under `data/`, which is gitignored, and are not included in API responses.
- Inside Docker, a stdio command has to exist in the image (or a mounted path). `node scripts/demo-mcp.mjs` works because the image includes Node and this repo. A server on the host is reachable at `http://host.docker.internal:<port>/…`.

## Travel Agent

**Travel Agent** in the sidebar (and a short link on the desk) is the same chat with a trip map beside it. Quick actions open a new session and prefill `/skill:trip-planning`, `/skill:packing-list`, or `/skill:itinerary-day`. They do not send the message for you. The model is told not to invent coordinates, weather, distances, or fares, and not to assume a home city.

The map is [Leaflet](https://leafletjs.com/) with [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles. No Google key. Pin a place by name and Meridian geocodes it, or let `travel_plan` do that from chat. Markers are colored by kind (destination, stay, place, transit). Places on the same day are joined by a straight line. Legs list straight-line kilometers and, when the public router answers, road distance and minutes.

| Tool | What it reads |
| --- | --- |
| `travel_geocode` | [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) |
| `travel_weather` | [Open-Meteo forecast](https://open-meteo.com/en/docs), about seven days. Dates outside that window are not invented. |
| `travel_places` | [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) search near a point. Calls are spaced about one second apart and send an identifying user agent. |
| `travel_route` | Straight-line distance, plus [OSRM](https://project-osrm.org/) driving or walking time when the public router responds |
| `travel_prices` | Fare comparison. See below. Links open a search. Nothing is booked. |
| `travel_plan` | List, add, move, or remove places on the shared trip map |

Those lookups only talk to `geocoding-api.open-meteo.com`, `api.open-meteo.com`, `nominatim.openstreetmap.org`, and `router.project-osrm.org`. `fetch_url` is unchanged and can still read other public pages. A price URL you configure is checked with the same public-host rules as `fetch_url`: loopback, private, and link-local addresses are refused. A fare API on your own machine belongs in a custom tool, which may call localhost.

### Fares

There is no keyless live flight API in this setup. With no price URL, `travel_prices` geocodes both ends and returns an **illustrative** distance estimate (`live: false`). Flight quotes always appear. Train quotes appear under about 1,500 km, bus quotes under about 900 km. The note says it is not a live fare. The link is a Google Flights or Rome2Rio search, not a checkout.

To use another source, set a public HTTPS URL. Meridian POSTs `{ from, to, date, passengers }` and, if you saved a key, `Authorization: Bearer …`. It does not follow redirects. A non-2xx response is an error; Meridian does not silently fall back to the illustrative quote. `live` is true only when the JSON says `"live": true`. Expected JSON is `{ "quotes": [{ "mode": "flight"|"train"|"bus", "price": 120, "currency": "USD", "carrier": "…", "link": "https://…", "live": false }] }`.

| Variable | Purpose |
| --- | --- |
| `TRAVEL_PRICE_URL` | Optional search endpoint. Blank uses illustrative quotes. |
| `TRAVEL_PRICE_API_KEY` | Optional bearer token for that URL only. |

The Travel page can save the same two fields. They override the environment and live in `data/travel-settings.json`, which is gitignored. The browser receives a masked hint (`••••` plus the last four characters), never the key. The trip itself is `data/travel-plan.json`, one current plan, up to 40 places. Meridian does not complete a booking or take payment.

## Architecture

Hermes and Pi ideas, and where they live here:

| Idea | In Meridian |
| --- | --- |
| Prompt tiers: stable → context → volatile | `lib/prompt.ts`. Stable is `agent/SOUL.md` plus tool guidance. Context is `agent/AGENTS.md`. Volatile is the skills index, MEMORY and USER snapshots, and the timestamp. |
| Skills index, body on demand | `lib/skills.ts` and `lib/skill-store.ts`. `skill_view` / `list_skills` in `lib/tools.ts`. `/skill:name` in `lib/skill-command.ts` and `lib/agent.ts` |
| Frozen memory snapshot, char-limit errors | `lib/memory.ts`. Snapshot text is rendered in `renderMemorySnapshot` and stored on the session row. |
| Agent loop: stream, tools, append, repeat | `lib/agent.ts`. OpenAI-compatible streaming client in `lib/lmstudio.ts`, with short retries on 408/429/5xx and network blips (`lib/retry.ts`). |
| Compaction that keeps the original transcript | `lib/compact.ts`. Summary and boundary seq are columns on the session. Messages stay in SQLite. |
| Session tree / persistence | `lib/sessions.ts` and `lib/db.ts` (`node:sqlite`). This version stores a single active branch per chat, not Pi’s full message tree. |
| Server-side tools only | `app/api/chat/route.ts` runs the loop. `fetch_url` (`lib/fetch-url.ts`, `lib/net.ts`) refuses loopback, private, link-local, Tailscale CGNAT, and encoded or leading-zero numeric hosts. |
| MCP client and custom tools | `lib/mcp-runtime.ts` connects stdio, streamable HTTP, and SSE. `lib/custom-tools.ts` calls webhooks. `lib/tool-registry.ts` merges them with built-ins without letting either replace `memory`, `skill_view`, `list_skills`, `fetch_url`, `current_time`, or `travel_*`. |
| Travel lookups and the trip map | `lib/travel.ts` calls Open-Meteo, Nominatim, and OSRM. `lib/travel-math.ts` is the haversine and illustrative fare math. `lib/travel-store.ts` stores the plan and price URL. `components/travel-screen.tsx` and `components/trip-map.tsx` are the page and Leaflet map. |

`agent/AGENTS.md` is the model’s project context. The `AGENTS.md` at the repo root is Next.js guidance for coding agents and is not injected into the prompt.

Built-in tools: `memory`, `skill_view`, `list_skills`, `fetch_url`, `current_time`, `travel_geocode`, `travel_weather`, `travel_places`, `travel_route`, `travel_prices`, and `travel_plan`. MCP and custom tools are added beside them at request time.

## Docker

```bash
docker compose up --build
```

The app listens on port **43123**. SQLite and settings live in the `meridian-data` volume. `skills/` and `agent/` are mounted from this directory, so desk edits and files you add on the host are the same tree.

The container does not join your tailnet. Set `LM_STUDIO_BASE_URL` to a name the container can resolve: a MagicDNS host, or `http://host.docker.internal:1234/v1` when LM Studio is on the machine running Docker. Compose reads a `.env` file in this directory for those variables. Copy `.env.example` to `.env` if you want them set.

## Scripts

```bash
npm run dev    # http://127.0.0.1:43123
npm test       # vitest, including prompt assembly, memory limits, and the skill loader
npm run lint
npm run build
```
