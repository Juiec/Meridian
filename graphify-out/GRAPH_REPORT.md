# Graph Report - Meridian  (2026-11-26)

## Corpus Check
- 177 files · ~119,124 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .example 1, .ico 1)

## Summary
- 1208 nodes · 3735 edges · 62 communities (47 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6076ebd4`
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
- agent-tools.ts
- image-store.ts
- sidebar.tsx
- image-studio.tsx
- composer.tsx
- custom-tools.ts
- mcp-config.ts
- chat-screen.tsx
- components.json
- mcp-runtime.ts
- ask-user.ts
- compilerOptions
- live-flight.ts
- Meridian
- shell.tsx
- text-tool-calls.ts
- tools.ts
- package.json
- compact.ts
- dependencies
- DatabaseSync
- react
- devDependencies
- skills.ts
- markdown-text.tsx
- demo-mcp.mjs
- scripts
- eslint.config.mjs
- Brief examples
- allowScripts
- AGENTS.md
- SOUL.md
- code-explain/SKILL.md
- cursor-phraser/SKILL.md
- daily-planning/SKILL.md
- image/SKILL.md
- itinerary-day/SKILL.md
- packing-list/SKILL.md
- local-model-notes.md
- prompt-refine/SKILL.md
- travel-research/SKILL.md
- trip-planning/SKILL.md
- source-rubric.md
- web-research/SKILL.md
- tools-panel.tsx
- clean-context.ts
- toolsOverview
- readJson
- SettingsForm
- types.ts
- tool-types.ts
- group-messages.ts
- vitest

## God Nodes (most connected - your core abstractions)
1. `caught()` - 66 edges
2. `jsonError()` - 52 edges
3. `readBody()` - 51 edges
4. `getSession()` - 49 edges
5. `ChatScreen()` - 44 edges
6. `next` - 44 edges
7. `runTurn()` - 39 edges
8. `Button()` - 36 edges
9. `vitest` - 35 edges
10. `messageOf()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Architecture` --references--> `renderMemorySnapshot()`  [INFERRED]
  README.md → lib/memory.ts
- `Memory` --references--> `remove()`  [INFERRED]
  README.md → components/skill-editor.tsx
- `render()` --indirect_call--> `MarkdownText()`  [INFERRED]
  lib/markdown-text.test.ts → components/markdown-text.tsx
- `POST()` --calls--> `runTurn()`  [EXTRACTED]
  app/api/chat/route.ts → lib/agent.ts
- `POST()` --calls--> `prepareAttachments()`  [EXTRACTED]
  app/api/chat/route.ts → lib/attachments.ts

## Import Cycles
- None detected.

## Communities (62 total, 15 thin omitted)

### Community 0 - "sessions.ts"
Cohesion: 0.15
Nodes (27): GET(), attachmentNote(), parseStoredAttachments(), isChatMode(), db(), alignTravelSession(), createSession(), createTripPlan() (+19 more)

### Community 1 - "travel.ts"
Cohesion: 0.06
Nodes (80): DELETE(), num(), PATCH(), POST(), TravelPage(), gapLabel(), ItineraryRow, itineraryRows() (+72 more)

### Community 2 - "settings.ts"
Cohesion: 0.06
Nodes (78): GET(), GET(), PUT(), Context, DELETE(), GET(), PUT(), writeAtomic() (+70 more)

### Community 3 - "caught"
Cohesion: 0.07
Nodes (62): POST(), GET(), isTarget(), PUT(), GET(), PATCH(), POST(), Context (+54 more)

### Community 4 - "subagent.ts"
Cohesion: 0.11
Nodes (32): GET(), buildContextSummary(), clip(), CONTEXT_SUMMARY_MAX, planSubagentFit(), SUBAGENT_CHAR_LIMIT, SUBAGENT_KEEP_TAIL, SUBAGENT_WORK_MAX (+24 more)

### Community 5 - "projects.ts"
Cohesion: 0.09
Nodes (48): GET(), POST(), IMAGE_TYPES, IncomingAttachment, isSecretFilename(), looksLikeEnvFile(), mediaTypeFor(), parseImage() (+40 more)

### Community 6 - "transcript.tsx"
Cohesion: 0.18
Nodes (23): isQuestionPart(), QuestionCard(), argumentHint(), CompactionNote(), DelegateResult(), delegateView(), DisclosureChevron(), GeneratedImages() (+15 more)

### Community 7 - "agent.ts"
Cohesion: 0.21
Nodes (20): Acc, accumulate(), cleanGeneratedTitle(), CompleteFn, deliverSteers(), deliverSteerTexts(), finishedCalls(), generateConversationTitle() (+12 more)

### Community 8 - "agent-tools.ts"
Cohesion: 0.13
Nodes (21): executeAgentTool(), safeList(), modeAllowsTool(), modeRefusal(), executeCustomTool(), readCap(), withQuery(), messageOf() (+13 more)

### Community 9 - "image-store.ts"
Cohesion: 0.10
Nodes (35): GET(), GET(), ImageRequest, parseRequest(), POST(), confirmImageGeneration(), PendingImage, readPending() (+27 more)

### Community 10 - "sidebar.tsx"
Cohesion: 0.12
Nodes (24): runningSessionKey(), subscribeRunning(), Sidebar(), importFile(), selectSession(), Reference, SkillEditor(), Source (+16 more)

### Community 11 - "image-studio.tsx"
Cohesion: 0.22
Nodes (10): ImagesPage(), fetchSavedImages(), GeneratedImage, IMAGE_SIZES, ImageStudio(), generate(), StoredImage, SidebarToggle() (+2 more)

### Community 12 - "composer.tsx"
Cohesion: 0.10
Nodes (35): Composer(), addFiles(), choose(), chooseMode(), writeDraft(), ComposerAttachment, ComposerSkill, ComposerTool (+27 more)

### Community 13 - "custom-tools.ts"
Cohesion: 0.19
Nodes (20): Context, DELETE(), PUT(), POST(), apply(), assertParameterSchema(), cleanDescription(), cleanMethod() (+12 more)

### Community 14 - "mcp-config.ts"
Cohesion: 0.14
Nodes (26): Context, DELETE(), PUT(), POST(), assertResolved(), apply(), assertRunnable(), BLOCKED_HEADERS (+18 more)

### Community 15 - "chat-screen.tsx"
Cohesion: 0.11
Nodes (31): appendReasoning(), appendText(), ChatScreen(), applyEvent(), begin(), chooseDirection(), retryLast(), runChat() (+23 more)

### Community 16 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 18 - "mcp-runtime.ts"
Cohesion: 0.24
Nodes (20): getMcpServer(), McpServerRecord, build(), callMcpTool(), clip(), closeClient(), connectServer(), disconnectAllMcp() (+12 more)

### Community 19 - "ask-user.ts"
Cohesion: 0.23
Nodes (13): askAnswerPayload(), AskOption, clipLabel(), findPendingQuestion(), matchAskOption(), parseAskUser(), PendingQuestion, readAskAnswer() (+5 more)

### Community 20 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "live-flight.ts"
Cohesion: 0.17
Nodes (14): bumpEpoch(), clearFlight(), emit(), epochs, Flight, FlightLive, flights, listeners (+6 more)

### Community 22 - "Meridian"
Cohesion: 0.12
Nodes (16): Add an MCP server, Architecture, Chat, Docker, Fares, Identity, Install Tailscale, Meridian (+8 more)

### Community 23 - "shell.tsx"
Cohesion: 0.20
Nodes (11): display, geistMono, geistSans, metadata, RootLayout(), AppStateProvider(), ShellOpenContext, ShellOpenProvider() (+3 more)

### Community 24 - "text-tool-calls.ts"
Cohesion: 0.25
Nodes (12): extractTextToolCalls(), parametersFromArguments(), parseJsonCall(), readParameters(), resolveTurnCalls(), splitToolCallText(), stripEdge(), file (+4 more)

### Community 25 - "tools.ts"
Cohesion: 0.12
Nodes (29): GET(), POST(), view(), fetchPublicUrl(), FetchUrlResult, readLimited(), htmlToText(), validSize() (+21 more)

### Community 26 - "package.json"
Cohesion: 0.14
Nodes (13): name, private, version, class-variance-authority, shadcn, tailwindcss, @tailwindcss/turbopack, tw-animate-css (+5 more)

### Community 27 - "compact.ts"
Cohesion: 0.22
Nodes (11): clip(), COMPACT_CHAR_LIMIT, COMPACT_KEEP_TURNS, COMPACT_SYSTEM, CompactionPlan, extractiveSummary(), groupTurns(), messageWeight() (+3 more)

### Community 28 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @base-ui/react, class-variance-authority, cn, leaflet, lucide-react, @modelcontextprotocol/sdk, next (+5 more)

### Community 29 - "DatabaseSync"
Cohesion: 0.17
Nodes (4): DatabaseSync, node:sqlite, SqlValue, StatementSync

### Community 30 - "react"
Cohesion: 0.27
Nodes (9): useAppState(), Doc, DocEditor(), Field(), Inspector(), MemoryEditor(), Textarea(), cn (+1 more)

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/leaflet, @types/node, @types/react (+3 more)

### Community 32 - "skills.ts"
Cohesion: 0.23
Nodes (17): agentDir(), assembleSystemPrompt(), loadIdentity(), loadProjectContext(), readCapped(), skillsChangedNote(), indexSkills(), listFiles() (+9 more)

### Community 33 - "markdown-text.tsx"
Cohesion: 0.29
Nodes (11): AssistantText(), CodeBlock(), codeLanguage(), copyText(), MarkdownText(), nodeText(), safeImageSrc(), TextToolCallBlock() (+3 more)

### Community 34 - "demo-mcp.mjs"
Cohesion: 0.29
Nodes (4): @modelcontextprotocol/sdk, require, server, { z }

### Community 35 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

### Community 36 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 37 - "Brief examples"
Cohesion: 0.50
Nodes (3): Brief examples, Strong, Weak

### Community 38 - "allowScripts"
Cohesion: 0.67
Nodes (3): allowScripts, esbuild@0.28.2, unrs-resolver@1.12.2

### Community 53 - "tools-panel.tsx"
Cohesion: 0.35
Nodes (9): CustomForm(), McpForm(), parseEnv(), parseHeaders(), statusClass(), statusLabel(), ToolsDeskSummary(), ToolsPanel() (+1 more)

### Community 54 - "clean-context.ts"
Cohesion: 0.08
Nodes (42): buildApiMessages(), defaultComplete(), expandUserContent(), filterToolsForMode(), modeInstructions(), cachedContextLimit(), cleanSessionContext(), limitCache (+34 more)

### Community 55 - "toolsOverview"
Cohesion: 0.50
Nodes (7): GET(), buildToolBundle(), listCustomTools(), listMcpServers(), mcpLiveView(), exposedName(), toolsOverview()

### Community 56 - "readJson"
Cohesion: 0.15
Nodes (18): readJson(), save(), DirRow(), FileRow(), NameTag(), ProjectDir(), ProjectFiles(), clone() (+10 more)

### Community 57 - "SettingsForm"
Cohesion: 0.33
Nodes (5): SettingsPage(), draftFromEndpoint(), SettingsForm(), check(), save()

### Community 58 - "types.ts"
Cohesion: 0.20
Nodes (12): AppState, AppStateContext, SkillResponse, EndpointDraft, HealthResult, MemoryStoreView, MemoryView, MessageRole (+4 more)

### Community 59 - "tool-types.ts"
Cohesion: 0.22
Nodes (8): CatalogEntry, HttpMethod, McpConnectionStatus, McpTransport, PublicCustomTool, PublicMcpServer, PublicMcpTool, ToolsOverview

### Community 60 - "group-messages.ts"
Cohesion: 0.38
Nodes (4): ASK_USER_NAME, groupMessages(), toolOk(), TranscriptItem

### Community 64 - "vitest"
Cohesion: 0.15
Nodes (13): listen(), PNG, catalogEndpoint, chatEndpoint, imageEndpoint, PNG, prepare(), CompletionDelta (+5 more)

## Knowledge Gaps
- **9 isolated node(s):** `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack`, `@types/leaflet`, `@types/node` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 316 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `caught` to `travel.ts`, `settings.ts`, `package.json`, `projects.ts`, `image-store.ts`, `sidebar.tsx`, `image-studio.tsx`, `custom-tools.ts`, `mcp-config.ts`, `chat-screen.tsx`, `shell.tsx`, `tools-panel.tsx`, `toolsOverview`, `tools.ts`, `types.ts`, `react`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `ChatScreen()` (e.g. with `getDeskCollapsed()` and `subscribeDesk()`) actually correct?**
  _`ChatScreen()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sessions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14623655913978495 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `sessions.ts`, `markdown-text.tsx`, `travel.ts`, `caught`, `subagent.ts`, `projects.ts`, `settings.ts`, `agent-tools.ts`, `composer.tsx`, `ask-user.ts`, `clean-context.ts`, `text-tool-calls.ts`, `tools.ts`, `package.json`, `compact.ts`, `group-messages.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `travel.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05745614035087719 - nodes in this community are weakly interconnected._
- **Why does `Meridian` connect `Meridian` to `readJson`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._