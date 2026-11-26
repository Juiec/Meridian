import { buildApiMessages } from "@/lib/agent";
import { buildToolBundle } from "@/lib/agent-tools";
import { filterToolsForMode } from "@/lib/chat-mode";
import { turnInstructions } from "@/lib/workspace";
import {
  CONTEXT_CLEANED_PREFIX,
  apiMessageChars,
  estimateTokens,
  planWindowHasStops,
  renderPlanContext,
  type ContextUsage,
} from "@/lib/context-usage";
import { modelContextLimit } from "@/lib/lmstudio";
import { clearMessageReasoning, getSession, insertMessage, listMessages, updateSession } from "@/lib/sessions";
import { getSettings } from "@/lib/settings";
import { listTripPlaces } from "@/lib/travel-store";
import { MAX_TRIP_DAYS } from "@/lib/travel-types";

const limitCache = new Map<string, { at: number; limit: number | null }>();

export function measureSessionContext(sessionId: string): ContextUsage {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found.");
  const system = `${session.systemPrompt}\n\n${turnInstructions(session)}`;
  const history = buildApiMessages(sessionId);
  const tools = filterToolsForMode(buildToolBundle().definitions, session.chatMode);
  const systemChars = system.length;
  const historyChars = history.reduce((sum, message) => sum + apiMessageChars(message), 0);
  const toolChars = JSON.stringify(tools).length;
  const thinkingChars = listMessages(sessionId).reduce((sum, message) => sum + (message.reasoning?.length ?? 0), 0);
  const chars = systemChars + historyChars + toolChars;
  return {
    chars,
    tokens: estimateTokens(chars),
    limitTokens: null,
    systemChars,
    historyChars,
    toolChars,
    thinkingChars,
  };
}

export async function sessionContextUsage(sessionId: string): Promise<ContextUsage> {
  const usage = measureSessionContext(sessionId);
  const session = getSession(sessionId);
  if (!session) return usage;
  const settings = getSettings(session.endpointId);
  usage.limitTokens = await cachedContextLimit(settings.baseUrl, settings.apiKey, session.model);
  return usage;
}

async function cachedContextLimit(baseUrl: string, apiKey: string, model: string): Promise<number | null> {
  const key = `${baseUrl}\n${model}`;
  const cached = limitCache.get(key);
  if (cached && Date.now() - cached.at < 60_000) return cached.limit;
  let limit: number | null = null;
  if (baseUrl.trim() && model.trim()) {
    try {
      limit = await modelContextLimit({
        baseUrl,
        apiKey: apiKey || undefined,
        model,
        signal: AbortSignal.timeout(2_500),
      });
    } catch {
      limit = null;
    }
  }
  limitCache.set(key, { at: Date.now(), limit });
  return limit;
}

export function cleanSessionContext(
  sessionId: string,
  focusDay?: number,
): { context: ContextUsage; focusDay: number | null; plan: string | null } {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found.");
  if (session.purpose !== "travel") {
    clearMessageReasoning(sessionId);
    return { context: measureSessionContext(sessionId), focusDay: null, plan: null };
  }

  const places = listTripPlaces(sessionId);
  if (places.length === 0) {
    throw new Error("Add stops on the map before cleaning this trip chat.");
  }
  const scheduled = places.map((place) => place.day).filter((day): day is number => day !== null);
  const focus = focusDay ?? (scheduled.length > 0 ? Math.max(...scheduled) : 1);
  if (!Number.isInteger(focus) || focus < 1 || focus > MAX_TRIP_DAYS) {
    throw new Error(`Day must be a whole number from 1 to ${MAX_TRIP_DAYS}.`);
  }
  if (!planWindowHasStops(places, focus)) {
    throw new Error("That day window has no stops. Keep the day you are refining, the one before it, or up to two days after.");
  }

  clearMessageReasoning(sessionId);
  const plan = renderPlanContext(places, focus);
  const existing = listMessages(sessionId);
  const last = existing[existing.length - 1];
  if (last) {
    updateSession(sessionId, {
      compactedSummary: `${CONTEXT_CLEANED_PREFIX} Thinking was removed. The model sees this day, the day before it, and at most two days after, with each stop's description. Other days stay on the map.`,
      compactedUntilSeq: last.seq,
    });
  }
  insertMessage({ sessionId, role: "assistant", content: plan });
  return { context: measureSessionContext(sessionId), focusDay: focus, plan };
}
