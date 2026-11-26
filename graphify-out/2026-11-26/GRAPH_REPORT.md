# Graph Report - Meridian  (2026-11-26)

## Corpus Check
- 179 files · ~122,003 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .example 1, .ico 1)

## Summary
- 1245 nodes · 3813 edges · 70 communities (54 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6fb6c0f1`
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
- projects.ts
- image-store.ts
- sidebar.tsx
- image-studio.tsx
- composer.tsx
- chat/route.ts
- custom-tools.ts
- chat-screen.tsx
- components.json
- getSession
- ask-user.ts
- compilerOptions
- clean-context.ts
- Meridian
- types.ts
- text-tool-calls.ts
- memory.ts
- package.json
- compact.ts
- dependencies
- DatabaseSync
- inspector.tsx
- devDependencies
- skill-store.ts
- image-generator.ts
- demo-mcp.mjs
- scripts
- eslint.config.mjs
- travel-screen.tsx
- allowScripts
- AGENTS.md
- SOUL.md
- jsonError
- paths.ts
- image-settings.ts
- context-summary.ts
- places/route.ts
- Product
- ref_node_fs
- tools.ts
- Brief examples
- code-explain/SKILL.md
- cursor-phraser/SKILL.md
- tools-panel.tsx
- lmstudio.ts
- prompt.ts
- readJson
- settings-form.tsx
- skills.ts
- daily-planning/SKILL.md
- image/SKILL.md
- create-skill/SKILL.md
- itinerary-day/SKILL.md
- agent.test.ts
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
- `generate()` --calls--> `batchFileStamp()`  [EXTRACTED]
  components/image-studio.tsx → lib/image-names.ts
- `render()` --indirect_call--> `MarkdownText()`  [INFERRED]
  lib/markdown-text.test.ts → components/markdown-text.tsx

## Import Cycles
- None detected.

## Communities (70 total, 16 thin omitted)

### Community 0 - "sessions.ts"
Cohesion: 0.16
Nodes (25): attachmentNote(), parseStoredAttachments(), isChatMode(), db(), alignTravelSession(), createSession(), createTripPlan(), fileSessionAsTrip() (+17 more)

### Community 1 - "travel.ts"
Cohesion: 0.07
Nodes (61): TripMap, escapeHtml(), TripMap(), BLOCKED_HOSTS, classifyUrl(), explainUrlBlock(), isBlockedIp(), travelPlanPath() (+53 more)

### Community 2 - "settings.ts"
Cohesion: 0.16
Nodes (24): GET(), EndpointInput, endpointSettingsList(), EndpointsFile, envBootstrap(), keyHint(), LegacyEndpoint, LegacyFile (+16 more)

### Community 3 - "caught"
Cohesion: 0.11
Nodes (29): Context, DELETE(), PUT(), POST(), isTarget(), PUT(), GET(), PATCH() (+21 more)

### Community 4 - "subagent.ts"
Cohesion: 0.14
Nodes (27): ApiMessage, CompletionDelta, CompletionRequest, createSubagentSession(), visibleMessages(), skillsIndexHash(), Acc, accumulate() (+19 more)

### Community 5 - "workspace.ts"
Cohesion: 0.19
Nodes (20): Context, POST(), cleanRelative(), getProject(), ProjectRecord, resolveProjectPath(), assertHttpsRepo(), assertInside() (+12 more)

### Community 6 - "transcript.tsx"
Cohesion: 0.18
Nodes (24): isQuestionPart(), QuestionCard(), argumentHint(), CompactionNote(), DelegateResult(), delegateView(), DisclosureChevron(), GeneratedImages() (+16 more)

### Community 7 - "agent.ts"
Cohesion: 0.16
Nodes (19): Acc, accumulate(), cleanGeneratedTitle(), CompleteFn, deliverSteers(), deliverSteerTexts(), expandUserContent(), finishedCalls() (+11 more)

### Community 8 - "projects.ts"
Cohesion: 0.14
Nodes (28): Context, DELETE(), PATCH(), Context, GET(), GET(), POST(), addProject() (+20 more)

### Community 9 - "image-store.ts"
Cohesion: 0.20
Nodes (17): GET(), batchFileStamp(), batchImageBaseName(), batchSlotTaken(), deleteImagesForSession(), GeneratedImage, getGeneratedImage(), imageExtension() (+9 more)

### Community 10 - "sidebar.tsx"
Cohesion: 0.11
Nodes (26): runningSessionKey(), subscribeRunning(), Sidebar(), importFile(), moveToTravel(), patchSession(), selectSession(), Reference (+18 more)

### Community 11 - "image-studio.tsx"
Cohesion: 0.15
Nodes (12): ImagesPage(), ACCEPTED_IMAGE_TYPES, fetchSavedImages(), GeneratedImage, IMAGE_SIZES, ImageStudio(), addReferences(), generate() (+4 more)

### Community 12 - "composer.tsx"
Cohesion: 0.09
Nodes (38): Composer(), addFiles(), choose(), chooseMode(), writeDraft(), ComposerAttachment, ComposerSkill, ComposerTool (+30 more)

### Community 13 - "chat/route.ts"
Cohesion: 0.17
Nodes (18): POST(), IMAGE_TYPES, IncomingAttachment, isSecretFilename(), looksLikeEnvFile(), mediaTypeFor(), parseImage(), prepareAttachments() (+10 more)

### Community 14 - "custom-tools.ts"
Cohesion: 0.05
Nodes (92): Context, POST(), Context, DELETE(), PUT(), buildToolBundle(), safeList(), apply() (+84 more)

### Community 15 - "chat-screen.tsx"
Cohesion: 0.09
Nodes (46): appendReasoning(), appendText(), ChatScreen(), applyEvent(), begin(), chooseDirection(), retryLast(), runChat() (+38 more)

### Community 16 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 18 - "getSession"
Cohesion: 0.26
Nodes (13): Context, GET(), settleFirstTitle(), confirmImageGeneration(), PendingImage, readPending(), exportSession(), getSession() (+5 more)

### Community 19 - "ask-user.ts"
Cohesion: 0.16
Nodes (14): ASK_USER_NAME, askAnswerPayload(), AskOption, clipLabel(), matchAskOption(), PendingQuestion, readOption(), sameText() (+6 more)

### Community 20 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "clean-context.ts"
Cohesion: 0.20
Nodes (19): buildApiMessages(), filterToolsForMode(), cachedContextLimit(), cleanSessionContext(), limitCache, measureSessionContext(), sessionContextUsage(), apiMessageChars() (+11 more)

### Community 22 - "Meridian"
Cohesion: 0.11
Nodes (17): Add an MCP server, Architecture, Chat, Docker, Fares, Identity, Install Tailscale, Memory (+9 more)

### Community 23 - "types.ts"
Cohesion: 0.14
Nodes (16): display, geistMono, geistSans, metadata, RootLayout(), AppState, AppStateContext, AppStateProvider() (+8 more)

### Community 24 - "text-tool-calls.ts"
Cohesion: 0.16
Nodes (20): AssistantText(), CodeBlock(), codeLanguage(), copyText(), MarkdownText(), nodeText(), safeImageSrc(), TextToolCallBlock() (+12 more)

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

### Community 30 - "inspector.tsx"
Cohesion: 0.26
Nodes (8): useAppState(), Doc, DocEditor(), Field(), Inspector(), MemoryEditor(), Textarea(), cn

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/leaflet, @types/node, @types/react (+3 more)

### Community 32 - "skill-store.ts"
Cohesion: 0.17
Nodes (29): GET(), POST(), writeAtomic(), legacySkillsDir(), meridianHome(), skillsDir(), assertDeletable(), assertName() (+21 more)

### Community 33 - "image-generator.ts"
Cohesion: 0.13
Nodes (21): GET(), ImageRequest, parseRequest(), POST(), ACCEPTED_IMAGE_TYPES, assertImageFile(), collectInputImages(), downloadImage() (+13 more)

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
Cohesion: 0.14
Nodes (18): TravelPage(), ShellOpenContext, ShellOpenProvider(), useOpenSidebar(), Shell(), gapLabel(), ItineraryRow, itineraryRows() (+10 more)

### Community 38 - "allowScripts"
Cohesion: 0.67
Nodes (3): allowScripts, esbuild@0.28.2, unrs-resolver@1.12.2

### Community 41 - "jsonError"
Cohesion: 0.23
Nodes (13): Context, GET(), POST(), Context, DELETE(), GET(), PATCH(), POST() (+5 more)

### Community 42 - "paths.ts"
Cohesion: 0.23
Nodes (12): columnNames(), migrate(), pools, dataDir(), dbPath(), endpointSecretsPath(), endpointsPath(), imagesDir() (+4 more)

### Community 43 - "image-settings.ts"
Cohesion: 0.24
Nodes (15): catalog(), chooseModel(), DEFAULT_IMAGE_MODEL, ImageSettingsError, ImageTarget, isImageEndpoint(), pickImageEndpoint(), readStored() (+7 more)

### Community 44 - "context-summary.ts"
Cohesion: 0.26
Nodes (9): buildContextSummary(), clip(), CONTEXT_SUMMARY_MAX, planSubagentFit(), SUBAGENT_CHAR_LIMIT, SUBAGENT_KEEP_TAIL, SUBAGENT_WORK_MAX, summarizeSubagentWork() (+1 more)

### Community 45 - "places/route.ts"
Cohesion: 0.50
Nodes (7): DELETE(), num(), PATCH(), POST(), GET(), openTrip(), tripView()

### Community 46 - "Product"
Cohesion: 0.18
Nodes (10): Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product, Product Principles (+2 more)

### Community 47 - "ref_node_fs"
Cohesion: 0.31
Nodes (7): GET(), DOC_LIMITS, docPath(), DocTarget, FILES, readDoc(), writeDoc()

### Community 49 - "tools.ts"
Cohesion: 0.17
Nodes (13): fetchPublicUrl(), FetchUrlResult, readLimited(), htmlToText(), builtins, asRecord(), executeTool(), memoryOps() (+5 more)

### Community 50 - "Brief examples"
Cohesion: 0.50
Nodes (3): Brief examples, Strong, Weak

### Community 53 - "tools-panel.tsx"
Cohesion: 0.38
Nodes (9): CustomForm(), McpForm(), parseEnv(), parseHeaders(), statusClass(), statusLabel(), ToolsDeskSummary(), ToolsPanel() (+1 more)

### Community 54 - "lmstudio.ts"
Cohesion: 0.14
Nodes (23): GET(), defaultComplete(), scrubSecrets(), ChoiceChunk, consumeSseBuffer(), contextLimitFromModel(), deltasFromChoice(), endpoint() (+15 more)

### Community 55 - "prompt.ts"
Cohesion: 0.42
Nodes (9): renderMemorySnapshot(), agentDir(), assembleSystemPrompt(), loadIdentity(), loadProjectContext(), readCapped(), skillsChangedNote(), indexSkills() (+1 more)

### Community 56 - "readJson"
Cohesion: 0.18
Nodes (15): readJson(), save(), DirRow(), FileRow(), NameTag(), ProjectDir(), ProjectFiles(), clone() (+7 more)

### Community 57 - "settings-form.tsx"
Cohesion: 0.24
Nodes (8): SettingsPage(), draftFromEndpoint(), EndpointDraft, SettingsForm(), check(), save(), SidebarToggle(), PublicEndpoint

### Community 58 - "skills.ts"
Cohesion: 0.16
Nodes (14): globalSkillDirs(), globalLabel(), implicitInvocationDisabled(), listFiles(), LoadedSkill, loadSkill(), readSkillFile(), SkillMeta (+6 more)

### Community 64 - "agent.test.ts"
Cohesion: 0.19
Nodes (10): skipSteeredTools(), catalogEndpoint, chatEndpoint, imageEndpoint, PNG, prepare(), deleteSession(), insertMessage() (+2 more)

## Knowledge Gaps
- **9 isolated node(s):** `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack`, `@types/leaflet`, `@types/node` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 337 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `caught` to `workspace.ts`, `projects.ts`, `image-store.ts`, `sidebar.tsx`, `image-studio.tsx`, `chat/route.ts`, `custom-tools.ts`, `getSession`, `types.ts`, `memory.ts`, `package.json`, `inspector.tsx`, `skill-store.ts`, `image-generator.ts`, `travel-screen.tsx`, `jsonError`, `places/route.ts`, `tools-panel.tsx`, `lmstudio.ts`, `settings-form.tsx`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `ChatScreen()` (e.g. with `getDeskCollapsed()` and `subscribeDesk()`) actually correct?**
  _`ChatScreen()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `travel.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07355242566510173 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `tools.ts` to `sessions.ts`, `travel.ts`, `subagent.ts`, `workspace.ts`, `agent.ts`, `projects.ts`, `image-store.ts`, `composer.tsx`, `chat/route.ts`, `ask-user.ts`, `clean-context.ts`, `text-tool-calls.ts`, `memory.ts`, `package.json`, `compact.ts`, `skill-store.ts`, `image-generator.ts`, `paths.ts`, `context-summary.ts`, `ref_node_fs`, `lmstudio.ts`, `prompt.ts`, `skills.ts`, `agent.test.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `caught` be split into smaller, more focused modules?**
  _Cohesion score 0.11414141414141414 - nodes in this community are weakly interconnected._
- **Why does `readJson()` connect `readJson` to `travel-screen.tsx`, `sidebar.tsx`, `image-studio.tsx`, `chat-screen.tsx`, `tools-panel.tsx`, `types.ts`, `settings-form.tsx`, `inspector.tsx`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._