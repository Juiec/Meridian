# Graph Report - Meridian  (2026-11-26)

## Corpus Check
- 179 files · ~121,767 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .example 1, .ico 1)

## Summary
- 1235 nodes · 3798 edges · 71 communities (54 shown, 17 thin omitted)
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
- workspace.ts
- transcript.tsx
- agent.ts
- Sidebar
- image-store.ts
- sidebar.tsx
- image-studio.tsx
- composer.tsx
- chat/route.ts
- custom-tools.ts
- chat-screen.tsx
- components.json
- agent.test.ts
- ask-user.ts
- compilerOptions
- mcp-runtime.ts
- Meridian
- settings-form.tsx
- text-tool-calls.ts
- memory.ts
- package.json
- types.ts
- dependencies
- DatabaseSync
- Button
- devDependencies
- skill-store.ts
- vitest
- demo-mcp.mjs
- scripts
- eslint.config.mjs
- travel-screen.tsx
- allowScripts
- AGENTS.md
- SOUL.md
- mcp-config.ts
- agent-tools.ts
- tool-registry.ts
- context-summary.ts
- markdown-text.tsx
- Product
- docs.ts
- tool-types.ts
- tools.ts
- Brief examples
- code-explain/SKILL.md
- cursor-phraser/SKILL.md
- tools-panel.tsx
- clean-context.ts
- prompt.ts
- project-files.tsx
- SettingsForm
- skills.ts
- daily-planning/SKILL.md
- image/SKILL.md
- create-skill/SKILL.md
- itinerary-day/SKILL.md
- image-tool.test.ts
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
- `generate()` --calls--> `batchFileStamp()`  [EXTRACTED]
  components/image-studio.tsx → lib/image-names.ts
- `render()` --indirect_call--> `MarkdownText()`  [INFERRED]
  lib/markdown-text.test.ts → components/markdown-text.tsx
- `POST()` --calls--> `runTurn()`  [EXTRACTED]
  app/api/chat/route.ts → lib/agent.ts

## Import Cycles
- None detected.

## Communities (71 total, 17 thin omitted)

### Community 0 - "sessions.ts"
Cohesion: 0.14
Nodes (30): GET(), travelSession(), parseStoredAttachments(), isChatMode(), cleanSessionContext(), measureSessionContext(), db(), alignTravelSession() (+22 more)

### Community 1 - "travel.ts"
Cohesion: 0.06
Nodes (68): escapeHtml(), TripMap(), columnNames(), migrate(), pools, messageOf(), scrubSecrets(), BLOCKED_HOSTS (+60 more)

### Community 2 - "settings.ts"
Cohesion: 0.15
Nodes (33): GET(), GET(), endpointSecretsPath(), endpointsPath(), settingsPath(), EndpointInput, EndpointsFile, envBootstrap() (+25 more)

### Community 3 - "caught"
Cohesion: 0.06
Nodes (83): Context, DELETE(), PUT(), POST(), isTarget(), PUT(), GET(), PATCH() (+75 more)

### Community 4 - "subagent.ts"
Cohesion: 0.17
Nodes (23): executeAgentTool(), CompletionDelta, CompletionRequest, createSubagentSession(), visibleMessages(), Acc, accumulate(), background() (+15 more)

### Community 5 - "workspace.ts"
Cohesion: 0.17
Nodes (24): isSecretFilename(), modeInstructions(), cleanRelative(), getProject(), hiddenEntry(), insideRoot(), listProjectDir(), ProjectRecord (+16 more)

### Community 6 - "transcript.tsx"
Cohesion: 0.20
Nodes (20): argumentHint(), CompactionNote(), DelegateResult(), delegateView(), DisclosureChevron(), GeneratedImages(), imagePending(), ImageResultItem (+12 more)

### Community 7 - "agent.ts"
Cohesion: 0.15
Nodes (28): Acc, accumulate(), buildApiMessages(), cleanGeneratedTitle(), CompleteFn, deliverSteers(), deliverSteerTexts(), expandUserContent() (+20 more)

### Community 8 - "Sidebar"
Cohesion: 0.13
Nodes (12): readJson(), save(), runningSessionKey(), subscribeRunning(), ProjectFiles(), clone(), forget(), Sidebar() (+4 more)

### Community 9 - "image-store.ts"
Cohesion: 0.08
Nodes (50): GET(), GET(), ImageRequest, parseRequest(), POST(), downloadImage(), GeneratedImagePayload, generateImages() (+42 more)

### Community 10 - "sidebar.tsx"
Cohesion: 0.15
Nodes (19): Reference, SkillEditor(), remove(), save(), Source, ThemeToggle(), toggle(), Dialog() (+11 more)

### Community 11 - "image-studio.tsx"
Cohesion: 0.23
Nodes (8): ImagesPage(), useAppState(), fetchSavedImages(), GeneratedImage, IMAGE_SIZES, ImageStudio(), generate(), StoredImage

### Community 12 - "composer.tsx"
Cohesion: 0.09
Nodes (38): Composer(), addFiles(), choose(), chooseMode(), writeDraft(), ComposerAttachment, ComposerSkill, ComposerTool (+30 more)

### Community 13 - "chat/route.ts"
Cohesion: 0.19
Nodes (16): POST(), IMAGE_TYPES, IncomingAttachment, looksLikeEnvFile(), mediaTypeFor(), parseImage(), prepareAttachments(), TEXT_TYPES (+8 more)

### Community 14 - "custom-tools.ts"
Cohesion: 0.17
Nodes (23): apply(), assertParameterSchema(), assertResolved(), cleanDescription(), cleanMethod(), cleanName(), createCustomTool(), CustomToolRecord (+15 more)

### Community 15 - "chat-screen.tsx"
Cohesion: 0.08
Nodes (46): appendReasoning(), appendText(), ChatScreen(), applyEvent(), begin(), chooseDirection(), retryLast(), runChat() (+38 more)

### Community 16 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 18 - "agent.test.ts"
Cohesion: 0.27
Nodes (8): Context, GET(), deleteSession(), exportSession(), lastUserMessage(), listMessages(), sessionMarkdown(), AgentEvent

### Community 19 - "ask-user.ts"
Cohesion: 0.26
Nodes (11): isQuestionPart(), QuestionCard(), AskOption, clipLabel(), matchAskOption(), parseAskUser(), PendingQuestion, readAskAnswer() (+3 more)

### Community 20 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "mcp-runtime.ts"
Cohesion: 0.26
Nodes (19): getMcpServer(), build(), callMcpTool(), clip(), closeClient(), connectServer(), disconnectAllMcp(), disconnectMcp() (+11 more)

### Community 22 - "Meridian"
Cohesion: 0.11
Nodes (17): Add an MCP server, Architecture, Chat, Docker, Fares, Identity, Install Tailscale, Memory (+9 more)

### Community 23 - "settings-form.tsx"
Cohesion: 0.13
Nodes (17): display, geistMono, geistSans, metadata, RootLayout(), AppState, AppStateContext, AppStateProvider() (+9 more)

### Community 24 - "text-tool-calls.ts"
Cohesion: 0.23
Nodes (13): extractTextToolCalls(), parametersFromArguments(), parseJsonCall(), readParameters(), resolveTurnCalls(), splitToolCallText(), stripEdge(), file (+5 more)

### Community 25 - "memory.ts"
Cohesion: 0.28
Nodes (14): applyMemory(), applyOps(), closest(), findMatch(), memoryFile(), MemoryResult, parseEntries(), readEntries() (+6 more)

### Community 26 - "package.json"
Cohesion: 0.12
Nodes (15): name, private, version, class-variance-authority, react-dom, react-markdown, shadcn, tailwindcss (+7 more)

### Community 27 - "types.ts"
Cohesion: 0.11
Nodes (20): clip(), COMPACT_CHAR_LIMIT, COMPACT_KEEP_TURNS, COMPACT_SYSTEM, CompactionPlan, extractiveSummary(), groupTurns(), messageWeight() (+12 more)

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
Cohesion: 0.20
Nodes (24): writeAtomic(), legacySkillsDir(), skillsDir(), assertDeletable(), assertName(), createSkill(), deleteSkill(), directoryFor() (+16 more)

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
Cohesion: 0.16
Nodes (16): TravelPage(), SidebarToggle(), gapLabel(), ItineraryRow, itineraryRows(), KIND_OPTIONS, legLabel(), planStatus() (+8 more)

### Community 38 - "allowScripts"
Cohesion: 0.67
Nodes (3): allowScripts, esbuild@0.28.2, unrs-resolver@1.12.2

### Community 41 - "mcp-config.ts"
Cohesion: 0.19
Nodes (18): listen(), apply(), assertRunnable(), BLOCKED_HEADERS, cleanArgs(), cleanCommand(), cleanName(), cleanTransport() (+10 more)

### Community 42 - "agent-tools.ts"
Cohesion: 0.40
Nodes (8): buildToolBundle(), prepareAgentTools(), safeList(), listCustomTools(), listMcpServers(), mcpLiveView(), exposedName(), ToolContext

### Community 43 - "tool-registry.ts"
Cohesion: 0.18
Nodes (13): BUILTIN_TOOL_NAMES, clip(), CustomRegistryInput, McpRegistryInput, mergeToolRegistry(), RegistryTool, schemaOrEmpty(), builtins (+5 more)

### Community 44 - "context-summary.ts"
Cohesion: 0.26
Nodes (9): buildContextSummary(), clip(), CONTEXT_SUMMARY_MAX, planSubagentFit(), SUBAGENT_CHAR_LIMIT, SUBAGENT_KEEP_TAIL, SUBAGENT_WORK_MAX, summarizeSubagentWork() (+1 more)

### Community 45 - "markdown-text.tsx"
Cohesion: 0.38
Nodes (9): AssistantText(), CodeBlock(), codeLanguage(), copyText(), MarkdownText(), nodeText(), safeImageSrc(), TextToolCallBlock() (+1 more)

### Community 46 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 47 - "docs.ts"
Cohesion: 0.39
Nodes (7): GET(), DOC_LIMITS, docPath(), DocTarget, FILES, readDoc(), writeDoc()

### Community 48 - "tool-types.ts"
Cohesion: 0.22
Nodes (8): CatalogEntry, HttpMethod, McpConnectionStatus, McpTransport, PublicCustomTool, PublicMcpServer, PublicMcpTool, ToolsOverview

### Community 49 - "tools.ts"
Cohesion: 0.19
Nodes (14): fetchPublicUrl(), FetchUrlResult, readLimited(), htmlToText(), validSize(), MEMORY_LIMITS, MemoryOp, readSkillFile() (+6 more)

### Community 50 - "Brief examples"
Cohesion: 0.50
Nodes (3): Brief examples, Strong, Weak

### Community 53 - "tools-panel.tsx"
Cohesion: 0.35
Nodes (9): CustomForm(), McpForm(), parseEnv(), parseHeaders(), statusClass(), statusLabel(), ToolsDeskSummary(), ToolsPanel() (+1 more)

### Community 54 - "clean-context.ts"
Cohesion: 0.10
Nodes (33): defaultComplete(), cachedContextLimit(), limitCache, sessionContextUsage(), apiMessageChars(), contentChars(), CONTEXT_CLEANED_PREFIX, ContextUsage (+25 more)

### Community 55 - "prompt.ts"
Cohesion: 0.48
Nodes (6): MemoryTarget, agentDir(), loadIdentity(), loadProjectContext(), readCapped(), SkillMeta

### Community 56 - "project-files.tsx"
Cohesion: 0.38
Nodes (8): DirRow(), FileRow(), NameTag(), ProjectDir(), ProjectHeader(), useNametagRename(), handlers(), ProjectEntry

### Community 57 - "SettingsForm"
Cohesion: 0.33
Nodes (5): SettingsPage(), draftFromEndpoint(), SettingsForm(), check(), save()

### Community 58 - "skills.ts"
Cohesion: 0.17
Nodes (17): GET(), POST(), globalSkillDirs(), draftFromBody(), discoverSkills(), globalLabel(), implicitInvocationDisabled(), listFiles() (+9 more)

### Community 64 - "image-tool.test.ts"
Cohesion: 0.24
Nodes (9): confirmImageGeneration(), PendingImage, readPending(), catalogEndpoint, chatEndpoint, imageEndpoint, PNG, prepare() (+1 more)

## Knowledge Gaps
- **9 isolated node(s):** `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack`, `@types/leaflet`, `@types/node` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 332 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `caught` to `settings.ts`, `package.json`, `travel-screen.tsx`, `image-store.ts`, `sidebar.tsx`, `image-studio.tsx`, `chat/route.ts`, `chat-screen.tsx`, `agent.test.ts`, `tools-panel.tsx`, `settings-form.tsx`, `skills.ts`, `Button`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `ChatScreen()` (e.g. with `getDeskCollapsed()` and `subscribeDesk()`) actually correct?**
  _`ChatScreen()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sessions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13968253968253969 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `sessions.ts`, `travel.ts`, `settings.ts`, `subagent.ts`, `workspace.ts`, `image-store.ts`, `composer.tsx`, `chat/route.ts`, `agent.test.ts`, `ask-user.ts`, `text-tool-calls.ts`, `memory.ts`, `package.json`, `types.ts`, `mcp-config.ts`, `tool-registry.ts`, `context-summary.ts`, `markdown-text.tsx`, `docs.ts`, `tools.ts`, `clean-context.ts`, `image-tool.test.ts`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `travel.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06464883925947693 - nodes in this community are weakly interconnected._
- **Why does `ChatScreen()` connect `chat-screen.tsx` to `travel-screen.tsx`, `transcript.tsx`, `Sidebar`, `image-studio.tsx`, `composer.tsx`, `ask-user.ts`, `tools-panel.tsx`, `settings-form.tsx`, `Button`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._