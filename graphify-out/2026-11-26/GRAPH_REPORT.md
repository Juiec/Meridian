# Graph Report - Meridian  (2026-11-26)

## Corpus Check
- 178 files · ~120,597 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .example 1, .ico 1)

## Summary
- 1231 nodes · 3782 edges · 68 communities (53 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6def944f`
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
- image-store.ts
- image-generator.ts
- sidebar.tsx
- image-studio.tsx
- composer.tsx
- chat/route.ts
- custom-tools.ts
- chat-screen.tsx
- components.json
- listMessages
- ask-user.ts
- compilerOptions
- mcp-runtime.ts
- Meridian
- react
- text-tool-calls.ts
- memory.ts
- package.json
- compact.ts
- dependencies
- DatabaseSync
- Button
- devDependencies
- skill-store.ts
- clean-context.ts
- demo-mcp.mjs
- scripts
- eslint.config.mjs
- travel-screen.tsx
- allowScripts
- AGENTS.md
- SOUL.md
- mcp-config.ts
- toolsOverview
- tool-registry.ts
- agent-tools.ts
- markdown-text.tsx
- Product
- tools.ts
- Brief examples
- code-explain/SKILL.md
- cursor-phraser/SKILL.md
- tools-panel.tsx
- lmstudio.ts
- image-settings.ts
- readJson
- SettingsForm
- types.ts
- daily-planning/SKILL.md
- image/SKILL.md
- itinerary-day/SKILL.md
- insertMessage
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
- `GET()` --calls--> `listSessions()`  [EXTRACTED]
  app/api/sessions/route.ts → lib/sessions.ts
- `generate()` --calls--> `batchFileStamp()`  [EXTRACTED]
  components/image-studio.tsx → lib/image-names.ts
- `render()` --indirect_call--> `MarkdownText()`  [INFERRED]
  lib/markdown-text.test.ts → components/markdown-text.tsx

## Import Cycles
- None detected.

## Communities (68 total, 15 thin omitted)

### Community 0 - "sessions.ts"
Cohesion: 0.15
Nodes (26): attachmentNote(), parseStoredAttachments(), isChatMode(), db(), deleteImagesForSession(), alignTravelSession(), createSession(), createTripPlan() (+18 more)

### Community 1 - "travel.ts"
Cohesion: 0.07
Nodes (74): DELETE(), num(), PATCH(), POST(), escapeHtml(), TripMap(), columnNames(), migrate() (+66 more)

### Community 2 - "settings.ts"
Cohesion: 0.15
Nodes (33): GET(), GET(), PUT(), endpointSecretsPath(), endpointsPath(), settingsPath(), EndpointInput, EndpointsFile (+25 more)

### Community 3 - "caught"
Cohesion: 0.10
Nodes (44): Context, DELETE(), PUT(), POST(), isTarget(), PUT(), GET(), PATCH() (+36 more)

### Community 4 - "subagent.ts"
Cohesion: 0.13
Nodes (30): buildContextSummary(), clip(), CONTEXT_SUMMARY_MAX, planSubagentFit(), SUBAGENT_CHAR_LIMIT, SUBAGENT_KEEP_TAIL, SUBAGENT_WORK_MAX, summarizeSubagentWork() (+22 more)

### Community 5 - "projects.ts"
Cohesion: 0.12
Nodes (40): Context, GET(), isSecretFilename(), addProject(), cleanName(), cleanRelative(), createProject(), entryName() (+32 more)

### Community 6 - "transcript.tsx"
Cohesion: 0.20
Nodes (21): isQuestionPart(), argumentHint(), CompactionNote(), DelegateResult(), delegateView(), DisclosureChevron(), GeneratedImages(), imagePending() (+13 more)

### Community 7 - "agent.ts"
Cohesion: 0.14
Nodes (24): Acc, accumulate(), cleanGeneratedTitle(), CompleteFn, deliverSteers(), deliverSteerTexts(), expandUserContent(), finishedCalls() (+16 more)

### Community 8 - "image-store.ts"
Cohesion: 0.22
Nodes (16): GET(), batchFileStamp(), batchImageBaseName(), batchSlotTaken(), getGeneratedImage(), imageExtension(), imageFilePath(), ImageRow (+8 more)

### Community 9 - "image-generator.ts"
Cohesion: 0.13
Nodes (16): GET(), ImageRequest, parseRequest(), POST(), downloadImage(), GeneratedImagePayload, generateImages(), ImageGenerationInput (+8 more)

### Community 10 - "sidebar.tsx"
Cohesion: 0.12
Nodes (21): runningSessionKey(), subscribeRunning(), Sidebar(), importFile(), selectSession(), Reference, SkillEditor(), Source (+13 more)

### Community 11 - "image-studio.tsx"
Cohesion: 0.22
Nodes (9): ImagesPage(), useAppState(), fetchSavedImages(), GeneratedImage, IMAGE_SIZES, ImageStudio(), generate(), StoredImage (+1 more)

### Community 12 - "composer.tsx"
Cohesion: 0.09
Nodes (34): Composer(), addFiles(), choose(), chooseMode(), writeDraft(), ComposerAttachment, ComposerSkill, ComposerTool (+26 more)

### Community 13 - "chat/route.ts"
Cohesion: 0.17
Nodes (17): POST(), IMAGE_TYPES, IncomingAttachment, looksLikeEnvFile(), mediaTypeFor(), parseImage(), prepareAttachments(), TEXT_TYPES (+9 more)

### Community 14 - "custom-tools.ts"
Cohesion: 0.17
Nodes (22): apply(), assertParameterSchema(), assertResolved(), cleanDescription(), cleanMethod(), cleanName(), createCustomTool(), CustomToolRecord (+14 more)

### Community 15 - "chat-screen.tsx"
Cohesion: 0.09
Nodes (44): appendReasoning(), appendText(), ChatScreen(), applyEvent(), begin(), chooseDirection(), retryLast(), runChat() (+36 more)

### Community 16 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 18 - "listMessages"
Cohesion: 0.60
Nodes (5): Context, GET(), exportSession(), listMessages(), sessionMarkdown()

### Community 19 - "ask-user.ts"
Cohesion: 0.15
Nodes (19): QuestionCard(), ASK_USER_NAME, askAnswerPayload(), AskOption, clipLabel(), findPendingQuestion(), matchAskOption(), parseAskUser() (+11 more)

### Community 20 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "mcp-runtime.ts"
Cohesion: 0.24
Nodes (20): PUT(), getMcpServer(), build(), callMcpTool(), clip(), closeClient(), connectServer(), disconnectAllMcp() (+12 more)

### Community 22 - "Meridian"
Cohesion: 0.12
Nodes (16): Add an MCP server, Architecture, Chat, Docker, Fares, Identity, Install Tailscale, Meridian (+8 more)

### Community 23 - "react"
Cohesion: 0.20
Nodes (11): display, geistMono, geistSans, metadata, RootLayout(), AppStateProvider(), ShellOpenContext, ShellOpenProvider() (+3 more)

### Community 24 - "text-tool-calls.ts"
Cohesion: 0.25
Nodes (12): extractTextToolCalls(), parametersFromArguments(), parseJsonCall(), readParameters(), resolveTurnCalls(), splitToolCallText(), stripEdge(), file (+4 more)

### Community 25 - "memory.ts"
Cohesion: 0.21
Nodes (19): GET(), POST(), view(), applyMemory(), applyOps(), closest(), findMatch(), MEMORY_LIMITS (+11 more)

### Community 26 - "package.json"
Cohesion: 0.12
Nodes (15): name, private, version, class-variance-authority, react-dom, react-markdown, shadcn, tailwindcss (+7 more)

### Community 27 - "compact.ts"
Cohesion: 0.24
Nodes (9): clip(), COMPACT_CHAR_LIMIT, COMPACT_KEEP_TURNS, COMPACT_SYSTEM, CompactionPlan, extractiveSummary(), groupTurns(), messageWeight() (+1 more)

### Community 28 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @base-ui/react, class-variance-authority, cn, leaflet, lucide-react, @modelcontextprotocol/sdk, next (+5 more)

### Community 29 - "DatabaseSync"
Cohesion: 0.17
Nodes (4): DatabaseSync, node:sqlite, SqlValue, StatementSync

### Community 30 - "Button"
Cohesion: 0.28
Nodes (9): Doc, DocEditor(), Field(), Inspector(), MemoryEditor(), Button(), buttonVariants, Textarea() (+1 more)

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/leaflet, @types/node, @types/react (+3 more)

### Community 32 - "skill-store.ts"
Cohesion: 0.07
Nodes (65): GET(), Context, DELETE(), GET(), PUT(), GET(), POST(), writeAtomic() (+57 more)

### Community 33 - "clean-context.ts"
Cohesion: 0.20
Nodes (18): buildApiMessages(), filterToolsForMode(), cachedContextLimit(), cleanSessionContext(), limitCache, measureSessionContext(), sessionContextUsage(), apiMessageChars() (+10 more)

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
Cohesion: 0.18
Nodes (14): TravelPage(), gapLabel(), ItineraryRow, itineraryRows(), KIND_OPTIONS, legLabel(), planStatus(), TravelPayload (+6 more)

### Community 38 - "allowScripts"
Cohesion: 0.67
Nodes (3): allowScripts, esbuild@0.28.2, unrs-resolver@1.12.2

### Community 41 - "mcp-config.ts"
Cohesion: 0.19
Nodes (20): Context, DELETE(), apply(), assertRunnable(), BLOCKED_HEADERS, cleanArgs(), cleanCommand(), cleanName() (+12 more)

### Community 42 - "toolsOverview"
Cohesion: 0.30
Nodes (10): Context, POST(), POST(), GET(), buildToolBundle(), listCustomTools(), listMcpServers(), mcpLiveView() (+2 more)

### Community 43 - "tool-registry.ts"
Cohesion: 0.22
Nodes (12): BUILTIN_TOOL_NAMES, clip(), CustomRegistryInput, McpRegistryInput, mergeToolRegistry(), RegistryTool, sanitizeToolToken(), schemaOrEmpty() (+4 more)

### Community 44 - "agent-tools.ts"
Cohesion: 0.23
Nodes (9): executeAgentTool(), prepareAgentTools(), safeList(), modeAllowsTool(), modeRefusal(), listen(), ToolBundle, ToolRoute (+1 more)

### Community 45 - "markdown-text.tsx"
Cohesion: 0.33
Nodes (10): AssistantText(), CodeBlock(), codeLanguage(), copyText(), MarkdownText(), nodeText(), safeImageSrc(), TextToolCallBlock() (+2 more)

### Community 46 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 49 - "tools.ts"
Cohesion: 0.26
Nodes (10): fetchPublicUrl(), FetchUrlResult, readLimited(), htmlToText(), validSize(), asRecord(), executeTool(), memoryOps() (+2 more)

### Community 50 - "Brief examples"
Cohesion: 0.50
Nodes (3): Brief examples, Strong, Weak

### Community 53 - "tools-panel.tsx"
Cohesion: 0.16
Nodes (18): CustomForm(), McpForm(), parseEnv(), parseHeaders(), statusClass(), statusLabel(), ToolsDeskSummary(), ToolsPanel() (+10 more)

### Community 54 - "lmstudio.ts"
Cohesion: 0.14
Nodes (23): defaultComplete(), isAbortError(), scrubSecrets(), ChoiceChunk, consumeSseBuffer(), contextLimitFromModel(), deltasFromChoice(), endpoint() (+15 more)

### Community 55 - "image-settings.ts"
Cohesion: 0.24
Nodes (16): resolveEndpoint(), catalog(), chooseModel(), DEFAULT_IMAGE_MODEL, ImageSettingsError, ImageTarget, isImageEndpoint(), pickImageEndpoint() (+8 more)

### Community 56 - "readJson"
Cohesion: 0.14
Nodes (19): readJson(), save(), DirRow(), FileRow(), NameTag(), ProjectDir(), ProjectFiles(), clone() (+11 more)

### Community 57 - "SettingsForm"
Cohesion: 0.33
Nodes (5): SettingsPage(), draftFromEndpoint(), SettingsForm(), check(), save()

### Community 58 - "types.ts"
Cohesion: 0.20
Nodes (12): AppState, AppStateContext, SkillResponse, EndpointDraft, HealthResult, MemoryStoreView, MemoryView, MessageRole (+4 more)

### Community 64 - "insertMessage"
Cohesion: 0.23
Nodes (10): confirmImageGeneration(), PendingImage, readPending(), catalogEndpoint, chatEndpoint, imageEndpoint, PNG, prepare() (+2 more)

## Knowledge Gaps
- **9 isolated node(s):** `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack`, `@types/leaflet`, `@types/node` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 329 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `caught` to `travel.ts`, `settings.ts`, `projects.ts`, `image-store.ts`, `image-generator.ts`, `sidebar.tsx`, `image-studio.tsx`, `chat/route.ts`, `chat-screen.tsx`, `listMessages`, `react`, `memory.ts`, `package.json`, `Button`, `skill-store.ts`, `travel-screen.tsx`, `mcp-config.ts`, `toolsOverview`, `tools-panel.tsx`, `types.ts`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `ChatScreen()` (e.g. with `getDeskCollapsed()` and `subscribeDesk()`) actually correct?**
  _`ChatScreen()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `travel.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06583072100313479 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `skill-store.ts` to `sessions.ts`, `travel.ts`, `settings.ts`, `subagent.ts`, `projects.ts`, `agent.ts`, `image-generator.ts`, `composer.tsx`, `chat/route.ts`, `ask-user.ts`, `text-tool-calls.ts`, `memory.ts`, `package.json`, `compact.ts`, `clean-context.ts`, `tool-registry.ts`, `agent-tools.ts`, `markdown-text.tsx`, `tools.ts`, `lmstudio.ts`, `insertMessage`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `caught` be split into smaller, more focused modules?**
  _Cohesion score 0.09672619047619048 - nodes in this community are weakly interconnected._
- **Why does `Meridian` connect `Meridian` to `readJson`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._