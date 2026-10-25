const runs = new Map<string, AbortController>();

export function claimRun(sessionId: string): AbortController | null {
  if (runs.has(sessionId)) return null;
  const controller = new AbortController();
  runs.set(sessionId, controller);
  return controller;
}

export function finishRun(sessionId: string): void {
  runs.delete(sessionId);
}
