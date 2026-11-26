# Graph Report - Meridian  (2026-11-26)

## Corpus Check
- 181 files · ~128,179 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .example 1, .ico 1)

## Summary
- 1274 nodes · 3841 edges · 65 communities (49 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `db801643`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- sessions.ts
- travel.ts
- settings.ts
- caught
- subagent.ts
- projects.ts
- transcript.tsx
- agent.ts
- Design System: Meridian
- custom-tools.ts
- sidebar.tsx
- image-studio.tsx
- composer.tsx
- mcp-config.ts
- mcp-runtime.ts
- chat-screen.tsx
- components.json
- listMessages
- ask-user.ts
- compilerOptions
- clean-context.ts
- Meridian
- layout.tsx
- text-tool-calls.ts
- agent-tools.ts
- package.json
- compact.ts
- dependencies
- DatabaseSync
- readJson
- devDependencies
- paths.ts
- image-store.ts
- demo-mcp.mjs
- scripts
- eslint.config.mjs
- travel-screen.tsx
- allowScripts
- AGENTS.md
- SOUL.md
- tool-types.ts
- context-summary.ts
- Product
- tool-registry.ts
- Brief examples
- code-explain/SKILL.md
- cursor-phraser/SKILL.md
- tools-panel.tsx
- lmstudio.ts
- vitest
- project-files.tsx
- types.ts
- daily-planning/SKILL.md
- image/SKILL.md
- create-skill/SKILL.md
- itinerary-day/SKILL.md
- executeTool
- packing-list/SKILL.md
- local-model-notes.md
- prompt-refine/SKILL.md
- travel-research/SKILL.md
- trip-planning/SKILL.md
- source-rubric.md
- web-research/SKILL.md

## God Nodes (most connected - your core abstractions)
1. `caught()` - 66 edges
2. `jsonError()` - 52 edges
3. `readBody()` - 51 edges
4. `getSession()` - 49 edges
5. `ChatScreen()` - 44 edges
6. `next` - 43 edges
7. `runTurn()` - 39 edges
8. `Button()` - 36 edges
9. `vitest` - 35 edges
10. `messageOf()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Architecture` --references--> `renderMemorySnapshot()`  [INFERRED]
  README.md → lib/memory.ts
- `Memory` --references--> `remove()`  [INFERRED]
  README.md → components/skill-editor.tsx
- `GET()` --calls--> `listSessions()`  [EXTRACTED]
  app/api/sessions/route.ts → lib/sessions.ts
- `GET()` --calls--> `discoverSkills()`  [EXTRACTED]
  app/api/skills/route.ts → lib/skills.ts
- `generate()` --calls--> `batchFileStamp()`  [EXTRACTED]
  components/image-studio.tsx → lib/image-names.ts

## Import Cycles
- None detected.

## Communities (65 total, 16 thin omitted)

### Community 0 - "sessions.ts"
Cohesion: 0.16
Nodes (29): rebuildPrompt(), attachmentNote(), parseStoredAttachments(), isChatMode(), db(), readEntries(), alignTravelSession(), createSession() (+21 more)

### Community 1 - "travel.ts"
Cohesion: 0.06
Nodes (73): DELETE(), num(), PATCH(), POST(), TripMap, escapeHtml(), TripMap(), messageOf() (+65 more)

### Community 2 - "settings.ts"
Cohesion: 0.15
Nodes (31): GET(), GET(), listModels(), endpointSecretsPath(), endpointsPath(), settingsPath(), EndpointInput, EndpointsFile (+23 more)

### Community 3 - "caught"
Cohesion: 0.07
Nodes (62): POST(), Context, DELETE(), PUT(), isTarget(), PUT(), GET(), PATCH() (+54 more)

### Community 4 - "subagent.ts"
Cohesion: 0.12
Nodes (31): executeAgentTool(), CompletionDelta, CompletionRequest, createSubagentSession(), visibleMessages(), discoverSkills(), Acc, accumulate() (+23 more)

### Community 5 - "projects.ts"
Cohesion: 0.09
Nodes (48): IMAGE_TYPES, IncomingAttachment, isSecretFilename(), looksLikeEnvFile(), mediaTypeFor(), parseImage(), prepareAttachments(), TEXT_TYPES (+40 more)

### Community 6 - "transcript.tsx"
Cohesion: 0.18
Nodes (24): isQuestionPart(), QuestionCard(), argumentHint(), CompactionNote(), DelegateResult(), delegateView(), DisclosureChevron(), GeneratedImages() (+16 more)

### Community 7 - "agent.ts"
Cohesion: 0.17
Nodes (20): Acc, accumulate(), cleanGeneratedTitle(), CompleteFn, deliverSteers(), deliverSteerTexts(), expandUserContent(), finishedCalls() (+12 more)

### Community 8 - "Design System: Meridian"
Cohesion: 0.07
Nodes (28): Buttons, Cards / Containers, Chips, Colors, Components, Composer, Design System: Meridian, Do: (+20 more)

### Community 9 - "custom-tools.ts"
Cohesion: 0.16
Nodes (24): POST(), apply(), assertParameterSchema(), assertResolved(), cleanDescription(), cleanMethod(), cleanName(), createCustomTool() (+16 more)

### Community 10 - "sidebar.tsx"
Cohesion: 0.11
Nodes (26): runningSessionKey(), subscribeRunning(), Sidebar(), importFile(), moveToTravel(), patchSession(), selectSession(), Reference (+18 more)

### Community 11 - "image-studio.tsx"
Cohesion: 0.15
Nodes (12): ImagesPage(), ACCEPTED_IMAGE_TYPES, fetchSavedImages(), GeneratedImage, IMAGE_SIZES, ImageStudio(), addReferences(), generate() (+4 more)

### Community 12 - "composer.tsx"
Cohesion: 0.09
Nodes (37): Composer(), addFiles(), choose(), chooseMode(), writeDraft(), ComposerAttachment, ComposerSkill, ComposerTool (+29 more)

### Community 13 - "mcp-config.ts"
Cohesion: 0.21
Nodes (18): POST(), apply(), assertRunnable(), BLOCKED_HEADERS, cleanArgs(), cleanCommand(), cleanName(), cleanTransport() (+10 more)

### Community 14 - "mcp-runtime.ts"
Cohesion: 0.20
Nodes (23): Context, DELETE(), PUT(), getMcpServer(), McpServerRecord, build(), callMcpTool(), clip() (+15 more)

### Community 15 - "chat-screen.tsx"
Cohesion: 0.09
Nodes (46): appendReasoning(), appendText(), ChatScreen(), applyEvent(), begin(), chooseDirection(), retryLast(), runChat() (+38 more)

### Community 16 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 18 - "listMessages"
Cohesion: 0.48
Nodes (6): Context, GET(), exportSession(), lastUserMessage(), listMessages(), sessionMarkdown()

### Community 19 - "ask-user.ts"
Cohesion: 0.16
Nodes (14): ASK_USER_NAME, askAnswerPayload(), AskOption, clipLabel(), matchAskOption(), PendingQuestion, readOption(), sameText() (+6 more)

### Community 20 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "clean-context.ts"
Cohesion: 0.22
Nodes (17): buildApiMessages(), filterToolsForMode(), cachedContextLimit(), cleanSessionContext(), limitCache, measureSessionContext(), sessionContextUsage(), apiMessageChars() (+9 more)

### Community 22 - "Meridian"
Cohesion: 0.12
Nodes (16): Add an MCP server, Architecture, Chat, Docker, Fares, Identity, Install Tailscale, Meridian (+8 more)

### Community 23 - "layout.tsx"
Cohesion: 0.29
Nodes (6): display, geistMono, geistSans, metadata, RootLayout(), AppStateProvider()

### Community 24 - "text-tool-calls.ts"
Cohesion: 0.16
Nodes (20): AssistantText(), CodeBlock(), codeLanguage(), copyText(), MarkdownText(), nodeText(), safeImageSrc(), TextToolCallBlock() (+12 more)

### Community 25 - "agent-tools.ts"
Cohesion: 0.23
Nodes (13): Context, POST(), GET(), buildToolBundle(), prepareAgentTools(), safeList(), listCustomTools(), listen() (+5 more)

### Community 26 - "package.json"
Cohesion: 0.12
Nodes (15): name, private, version, class-variance-authority, react-dom, react-markdown, shadcn, tailwindcss (+7 more)

### Community 27 - "compact.ts"
Cohesion: 0.23
Nodes (10): clip(), COMPACT_CHAR_LIMIT, COMPACT_KEEP_TURNS, COMPACT_SYSTEM, CompactionPlan, extractiveSummary(), groupTurns(), messageWeight() (+2 more)

### Community 28 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @base-ui/react, class-variance-authority, cn, leaflet, lucide-react, @modelcontextprotocol/sdk, next (+5 more)

### Community 29 - "DatabaseSync"
Cohesion: 0.17
Nodes (4): DatabaseSync, node:sqlite, SqlValue, StatementSync

### Community 30 - "readJson"
Cohesion: 0.29
Nodes (8): readJson(), Doc, DocEditor(), save(), Field(), remove(), save(), Memory

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/leaflet, @types/node, @types/react (+3 more)

### Community 32 - "paths.ts"
Cohesion: 0.05
Nodes (77): GET(), GET(), POST(), view(), writeAtomic(), columnNames(), migrate(), pools (+69 more)

### Community 33 - "image-store.ts"
Cohesion: 0.07
Nodes (57): GET(), GET(), ImageRequest, parseRequest(), POST(), ACCEPTED_IMAGE_TYPES, assertImageFile(), collectInputImages() (+49 more)

### Community 34 - "demo-mcp.mjs"
Cohesion: 0.29
Nodes (4): @modelcontextprotocol/sdk, require, server, { z }

### Community 35 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

### Community 36 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 37 - "travel-screen.tsx"
Cohesion: 0.13
Nodes (19): TravelPage(), ShellOpenContext, ShellOpenProvider(), useOpenSidebar(), Shell(), gapLabel(), ItineraryRow, itineraryRows() (+11 more)

### Community 38 - "allowScripts"
Cohesion: 0.67
Nodes (3): allowScripts, esbuild@0.28.2, unrs-resolver@1.12.2

### Community 41 - "tool-types.ts"
Cohesion: 0.22
Nodes (8): CatalogEntry, HttpMethod, McpConnectionStatus, McpTransport, PublicCustomTool, PublicMcpServer, PublicMcpTool, ToolsOverview

### Community 44 - "context-summary.ts"
Cohesion: 0.26
Nodes (9): buildContextSummary(), clip(), CONTEXT_SUMMARY_MAX, planSubagentFit(), SUBAGENT_CHAR_LIMIT, SUBAGENT_KEEP_TAIL, SUBAGENT_WORK_MAX, summarizeSubagentWork() (+1 more)

### Community 46 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 49 - "tool-registry.ts"
Cohesion: 0.22
Nodes (12): BUILTIN_TOOL_NAMES, clip(), CustomRegistryInput, McpRegistryInput, mergeToolRegistry(), RegistryTool, sanitizeToolToken(), schemaOrEmpty() (+4 more)

### Community 50 - "Brief examples"
Cohesion: 0.50
Nodes (3): Brief examples, Strong, Weak

### Community 53 - "tools-panel.tsx"
Cohesion: 0.21
Nodes (14): useAppState(), Inspector(), MemoryEditor(), CustomForm(), McpForm(), parseEnv(), parseHeaders(), statusClass() (+6 more)

### Community 54 - "lmstudio.ts"
Cohesion: 0.13
Nodes (23): defaultComplete(), summarize(), isAbortError(), scrubSecrets(), ChoiceChunk, consumeSseBuffer(), contextLimitFromModel(), deltasFromChoice() (+15 more)

### Community 55 - "vitest"
Cohesion: 0.31
Nodes (3): makeHome(), AgentEvent, vitest

### Community 56 - "project-files.tsx"
Cohesion: 0.26
Nodes (10): DirRow(), FileRow(), NameTag(), ProjectDir(), ProjectFiles(), clone(), forget(), ProjectHeader() (+2 more)

### Community 57 - "types.ts"
Cohesion: 0.14
Nodes (17): SettingsPage(), AppState, AppStateContext, SkillResponse, draftFromEndpoint(), EndpointDraft, SettingsForm(), check() (+9 more)

### Community 64 - "executeTool"
Cohesion: 0.23
Nodes (10): confirmImageGeneration(), PendingImage, readPending(), catalogEndpoint, chatEndpoint, imageEndpoint, PNG, prepare() (+2 more)

## Knowledge Gaps
- **9 isolated node(s):** `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack`, `@types/leaflet`, `@types/node` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 358 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `caught` to `paths.ts`, `image-store.ts`, `settings.ts`, `travel.ts`, `travel-screen.tsx`, `custom-tools.ts`, `sidebar.tsx`, `image-studio.tsx`, `mcp-config.ts`, `mcp-runtime.ts`, `listMessages`, `tools-panel.tsx`, `layout.tsx`, `agent-tools.ts`, `package.json`, `types.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `ChatScreen()` (e.g. with `getDeskCollapsed()` and `subscribeDesk()`) actually correct?**
  _`ChatScreen()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `travel.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06478578892371996 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `sessions.ts`, `travel.ts`, `settings.ts`, `caught`, `subagent.ts`, `projects.ts`, `composer.tsx`, `ask-user.ts`, `clean-context.ts`, `text-tool-calls.ts`, `agent-tools.ts`, `package.json`, `compact.ts`, `paths.ts`, `image-store.ts`, `context-summary.ts`, `tool-registry.ts`, `lmstudio.ts`, `executeTool`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `settings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14616755793226383 - nodes in this community are weakly interconnected._
- **Why does `readJson()` connect `readJson` to `travel-screen.tsx`, `sidebar.tsx`, `image-studio.tsx`, `chat-screen.tsx`, `tools-panel.tsx`, `layout.tsx`, `project-files.tsx`, `types.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._