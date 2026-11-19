import type { ChatMode } from "@/lib/chat-mode";

export type { ChatMode };

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
  purpose: "chat" | "travel" | "subagent";
  parentId: string | null;
  endpointId: string;
  model: string;
  systemPrompt: string;
  skillsIndexHash: string;
  compactedSummary: string | null;
  compactedUntilSeq: number | null;
  pinned: boolean;
  archived: boolean;
  chatMode: ChatMode;
  createdAt: number;
  updatedAt: number;
};

export type SessionSummary = {
  id: string;
  title: string;
  endpointId: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  compacted: boolean;
  pinned: boolean;
  archived: boolean;
};

export type PublicSettings = {
  endpointId: string;
  baseUrl: string;
  model: string;
  apiKeySet: boolean;
  apiKeyHint: string | null;
  models: string[];
  endpoints: PublicEndpoint[];
};

export type PublicEndpoint = {
  id: string;
  name: string;
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
  endpointId: string;
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
  | { type: "title"; title: string }
  | { type: "title_error"; message: string }
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
  | { type: "partial"; message: StoredMessage }
  | { type: "subagent"; title: string; detail: string }
  | { type: "compaction"; summary: string; mode: "model" | "extractive" }
  | {
      type: "question";
      toolCallId: string;
      prompt: string;
      options: { label: string; value: string }[];
    }
  | { type: "error"; message: string }
  | { type: "done"; iterations: number; aborted?: boolean; awaiting?: "question" };
