# Graph Report - Meridian  (2026-11-26)

## Corpus Check
- 178 files · ~119,584 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .example 1, .ico 1)

## Summary
- 1210 nodes · 3739 edges · 54 communities (39 shown, 15 thin omitted)
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
- skill-store.ts
- image-generator.ts
- sidebar.tsx
- image-store.ts
- ask-user.ts
- travel-screen.tsx
- custom-tools.ts
- chat-screen.tsx
- components.json
- chat/route.ts
- compilerOptions
- Meridian
- shell.tsx
- image-settings.ts
- extra-tools.test.ts
- package.json
- dependencies
- DatabaseSync
- composer.tsx
- devDependencies
- vitest
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
- clean-context.ts
- readJson
- types.ts
- paths.ts
- tools.ts

## God Nodes (most connected - your core abstractions)
1. `caught()` - 66 edges
2. `jsonError()` - 52 edges
3. `readBody()` - 51 edges
4. `getSession()` - 49 edges
5. `ChatScreen()` - 46 edges
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
- `GET()` --calls--> `listGeneratedImages()`  [EXTRACTED]
  app/api/images/route.ts → lib/image-store.ts
- `render()` --indirect_call--> `MarkdownText()`  [INFERRED]
  lib/markdown-text.test.ts → components/markdown-text.tsx
- `POST()` --calls--> `runTurn()`  [EXTRACTED]
  app/api/chat/route.ts → lib/agent.ts

## Import Cycles
- None detected.

## Communities (54 total, 15 thin omitted)

### Community 0 - "sessions.ts"
Cohesion: 0.15
Nodes (27): Context, GET(), GET(), readAskAnswer(), parseStoredAttachments(), isChatMode(), alignTravelSession(), createSession() (+19 more)

### Community 1 - "travel.ts"
Cohesion: 0.07
Nodes (66): TripMap, escapeHtml(), TripMap(), messageOf(), fetchPublicUrl(), FetchUrlResult, readLimited(), htmlToText() (+58 more)

### Community 2 - "settings.ts"
Cohesion: 0.16
Nodes (31): GET(), GET(), PUT(), endpointSecretsPath(), endpointsPath(), EndpointInput, EndpointsFile, envBootstrap() (+23 more)

### Community 3 - "caught"
Cohesion: 0.07
Nodes (65): Context, DELETE(), PUT(), POST(), isTarget(), PUT(), GET(), PATCH() (+57 more)

### Community 4 - "subagent.ts"
Cohesion: 0.11
Nodes (33): executeAgentTool(), prepareAgentTools(), buildContextSummary(), clip(), CONTEXT_SUMMARY_MAX, planSubagentFit(), SUBAGENT_CHAR_LIMIT, SUBAGENT_KEEP_TAIL (+25 more)

### Community 5 - "projects.ts"
Cohesion: 0.08
Nodes (51): Context, GET(), attachmentNote(), IMAGE_TYPES, IncomingAttachment, isSecretFilename(), looksLikeEnvFile(), mediaTypeFor() (+43 more)

### Community 6 - "transcript.tsx"
Cohesion: 0.05
Nodes (63): AssistantText(), CodeBlock(), codeLanguage(), copyText(), MarkdownText(), nodeText(), safeImageSrc(), TextToolCallBlock() (+55 more)

### Community 7 - "agent.ts"
Cohesion: 0.19
Nodes (22): Acc, accumulate(), buildApiMessages(), CompleteFn, deliverSteers(), deliverSteerTexts(), expandUserContent(), finishedCalls() (+14 more)

### Community 8 - "skill-store.ts"
Cohesion: 0.16
Nodes (24): GET(), writeAtomic(), DOC_LIMITS, docPath(), DocTarget, FILES, readDoc(), writeDoc() (+16 more)

### Community 9 - "image-generator.ts"
Cohesion: 0.15
Nodes (15): GET(), ImageRequest, parseRequest(), POST(), downloadImage(), GeneratedImagePayload, generateImages(), ImageGenerationInput (+7 more)

### Community 10 - "sidebar.tsx"
Cohesion: 0.11
Nodes (25): subscribeRunning(), Sidebar(), importFile(), moveToTravel(), patchSession(), selectSession(), Reference, SkillEditor() (+17 more)

### Community 11 - "image-store.ts"
Cohesion: 0.18
Nodes (23): GET(), generate(), db(), batchFileStamp(), batchImageBaseName(), batchSlotTaken(), deleteImagesForSession(), getGeneratedImage() (+15 more)

### Community 12 - "ask-user.ts"
Cohesion: 0.07
Nodes (39): Composer(), addFiles(), choose(), chooseMode(), writeDraft(), readFile(), cleanGeneratedTitle(), generateConversationTitle() (+31 more)

### Community 13 - "travel-screen.tsx"
Cohesion: 0.16
Nodes (15): TravelPage(), ShellOpenContext, useOpenSidebar(), gapLabel(), ItineraryRow, itineraryRows(), KIND_OPTIONS, legLabel() (+7 more)

### Community 14 - "custom-tools.ts"
Cohesion: 0.05
Nodes (82): buildToolBundle(), safeList(), apply(), assertParameterSchema(), assertResolved(), cleanDescription(), cleanMethod(), cleanName() (+74 more)

### Community 15 - "chat-screen.tsx"
Cohesion: 0.07
Nodes (52): appendReasoning(), appendText(), ChatScreen(), applyEvent(), begin(), chooseDirection(), retryLast(), runChat() (+44 more)

### Community 16 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 19 - "chat/route.ts"
Cohesion: 0.31
Nodes (10): POST(), claimRun(), completionSignal(), drainSteers(), finishRun(), Run, runs, steerRun() (+2 more)

### Community 20 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 22 - "Meridian"
Cohesion: 0.11
Nodes (17): Add an MCP server, Architecture, Chat, Docker, Fares, Identity, Install Tailscale, Memory (+9 more)

### Community 23 - "shell.tsx"
Cohesion: 0.24
Nodes (9): display, geistMono, geistSans, metadata, RootLayout(), AppStateProvider(), ShellOpenProvider(), isLeftTool() (+1 more)

### Community 24 - "image-settings.ts"
Cohesion: 0.21
Nodes (17): catalog(), chooseModel(), DEFAULT_IMAGE_MODEL, ImageSettingsError, ImageTarget, isImageEndpoint(), pickImageEndpoint(), readStored() (+9 more)

### Community 25 - "extra-tools.test.ts"
Cohesion: 0.14
Nodes (22): GET(), POST(), view(), listen(), applyMemory(), applyOps(), closest(), findMatch() (+14 more)

### Community 26 - "package.json"
Cohesion: 0.14
Nodes (13): name, private, version, class-variance-authority, shadcn, tailwindcss, @tailwindcss/turbopack, tw-animate-css (+5 more)

### Community 28 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @base-ui/react, class-variance-authority, cn, leaflet, lucide-react, @modelcontextprotocol/sdk, next (+5 more)

### Community 29 - "DatabaseSync"
Cohesion: 0.17
Nodes (4): DatabaseSync, node:sqlite, SqlValue, StatementSync

### Community 30 - "composer.tsx"
Cohesion: 0.16
Nodes (19): ComposerSkill, GROUP_LABEL, Doc, DocEditor(), Field(), Inspector(), MemoryEditor(), CustomForm() (+11 more)

### Community 31 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/leaflet, @types/node, @types/react (+3 more)

### Community 32 - "vitest"
Cohesion: 0.16
Nodes (23): GET(), renderMemorySnapshot(), agentDir(), assembleSystemPrompt(), loadIdentity(), loadProjectContext(), readCapped(), skillsChangedNote() (+15 more)

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

### Community 54 - "clean-context.ts"
Cohesion: 0.09
Nodes (38): defaultComplete(), filterToolsForMode(), cachedContextLimit(), cleanSessionContext(), limitCache, measureSessionContext(), sessionContextUsage(), apiMessageChars() (+30 more)

### Community 56 - "readJson"
Cohesion: 0.20
Nodes (14): readJson(), save(), DirRow(), FileRow(), NameTag(), ProjectDir(), ProjectFiles(), clone() (+6 more)

### Community 58 - "types.ts"
Cohesion: 0.09
Nodes (26): ImagesPage(), SettingsPage(), AppState, AppStateContext, SkillResponse, useAppState(), fetchSavedImages(), GeneratedImage (+18 more)

### Community 62 - "paths.ts"
Cohesion: 0.31
Nodes (7): columnNames(), migrate(), pools, dataDir(), dbPath(), meridianHome(), settingsPath()

### Community 64 - "tools.ts"
Cohesion: 0.13
Nodes (19): confirmImageGeneration(), PendingImage, readPending(), validSize(), catalogEndpoint, chatEndpoint, imageEndpoint, PNG (+11 more)

## Knowledge Gaps
- **9 isolated node(s):** `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack`, `@types/leaflet`, `@types/node` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 316 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `caught` to `sessions.ts`, `settings.ts`, `package.json`, `projects.ts`, `image-generator.ts`, `sidebar.tsx`, `image-store.ts`, `travel-screen.tsx`, `chat-screen.tsx`, `chat/route.ts`, `shell.tsx`, `extra-tools.test.ts`, `types.ts`, `composer.tsx`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `ChatScreen()` (e.g. with `getDeskCollapsed()` and `subscribeDesk()`) actually correct?**
  _`ChatScreen()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `shadcn`, `tw-animate-css`, `@tailwindcss/turbopack` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sessions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14717741935483872 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `sessions.ts`, `travel.ts`, `tools.ts`, `settings.ts`, `subagent.ts`, `projects.ts`, `transcript.tsx`, `skill-store.ts`, `image-generator.ts`, `image-store.ts`, `ask-user.ts`, `chat/route.ts`, `clean-context.ts`, `extra-tools.test.ts`, `package.json`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `travel.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06783511846802986 - nodes in this community are weakly interconnected._
- **Why does `ChatScreen()` connect `chat-screen.tsx` to `transcript.tsx`, `sidebar.tsx`, `ask-user.ts`, `travel-screen.tsx`, `shell.tsx`, `readJson`, `types.ts`, `composer.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._