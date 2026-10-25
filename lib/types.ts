export type MessageRole = "user" | "assistant" | "tool" | "note";

export type ToolCallRecord = {
  id: string;
  name: string;
  arguments: string;
};

export type Attachment = {
  id: string;
  name: string;
  mediaType: string;
  kind: "text" | "image";
  text?: string;
  dataUrl?: string;
};

export type StoredMessage = {
  id: string;
  sessionId: string;
  seq: number;
  role: MessageRole;
  content: string;
  toolCalls: ToolCallRecord[] | null;
  toolCallId: string | null;
  toolName: string | null;
  reasoning: string | null;
  attachments: Attachment[];
  createdAt: number;
};

export type SessionRecord = {
  id: string;
  title: string;
  model: string;
  systemPrompt: string;
  skillsIndexHash: string;
  compactedSummary: string | null;
  compactedUntilSeq: number | null;
  pinned: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SessionSummary = {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  compacted: boolean;
  pinned: boolean;
  archived: boolean;
};

export type PublicSettings = {
  baseUrl: string;
  model: string;
  apiKeySet: boolean;
  apiKeyHint: string | null;
  models: string[];
};

export type SkillInfo = {
  name: string;
  description: string;
  path: string;
  disableModelInvocation: boolean;
  files: string[];
};

export type MemoryStoreView = {
  entries: string[];
  used: number;
  limit: number;
};

export type MemoryView = {
  memory: MemoryStoreView;
  user: MemoryStoreView;
};

export type HealthResult = {
  ok: boolean;
  baseUrl: string;
  model: string;
  latencyMs: number | null;
  models: string[];
  error?: string;
  stale?: boolean;
};

export type AgentEvent =
  | { type: "user"; message: StoredMessage }
  | { type: "note"; message: StoredMessage }
  | { type: "iteration"; n: number; max: number; phase: "tools" | "answer" }
  | { type: "delta"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool_call"; call: ToolCallRecord }
  | {
      type: "tool_result";
      toolCallId: string;
      name: string;
      content: string;
      ok: boolean;
    }
  | { type: "compaction"; summary: string; mode: "model" | "extractive" }
  | { type: "error"; message: string }
  | { type: "done"; iterations: number; aborted?: boolean };
