const STEER_MAX = 8;
const STEER_CHARS = 8_000;

type Run = {
  stop: AbortController;
  generation: AbortController;
  steers: string[];
};

const runs = new Map<string, Run>();

export function claimRun(sessionId: string): AbortController | null {
  if (runs.has(sessionId)) return null;
  const stop = new AbortController();
  runs.set(sessionId, { stop, generation: new AbortController(), steers: [] });
  return stop;
}

export function finishRun(sessionId: string): void {
  runs.delete(sessionId);
}

export function steerRun(
  sessionId: string,
  content: string,
): { ok: true } | { ok: false; error: string; status: number } {
  const run = runs.get(sessionId);
  if (!run || run.stop.signal.aborted) {
    return { ok: false, error: "Nothing is running to steer.", status: 409 };
  }
  const text = content.trim();
  if (!text) return { ok: false, error: "Steer message is empty.", status: 400 };
  if (text.length > STEER_CHARS) {
    return { ok: false, error: `Steer message is too long (max ${STEER_CHARS} characters).`, status: 400 };
  }
  if (run.steers.length >= STEER_MAX) {
    return { ok: false, error: "Too many steers are waiting. Let the current one land.", status: 429 };
  }
  run.steers.push(text);
  run.generation.abort();
  return { ok: true };
}

export function drainSteers(sessionId: string): string[] {
  const run = runs.get(sessionId);
  if (!run || run.steers.length === 0) return [];
  return run.steers.splice(0, run.steers.length);
}

/** Aborts when the turn is stopped or a steer interrupts the current model call. */
export function completionSignal(sessionId: string, stop?: AbortSignal): AbortSignal {
  const run = runs.get(sessionId);
  if (!run) return stop ?? new AbortController().signal;
  if (run.generation.signal.aborted) run.generation = new AbortController();
  const linked = new AbortController();
  const abort = () => {
    if (!linked.signal.aborted) linked.abort();
  };
  if (stop?.aborted || run.stop.signal.aborted) {
    abort();
    return linked.signal;
  }
  stop?.addEventListener("abort", abort, { once: true });
  run.stop.signal.addEventListener("abort", abort, { once: true });
  run.generation.signal.addEventListener("abort", abort, { once: true });
  return linked.signal;
}
