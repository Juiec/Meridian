import { isAbortError } from "@/lib/errors";

export function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function statusOf(err: unknown): number | null {
  if (!err || typeof err !== "object" || !("status" in err)) return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export function isTransientError(err: unknown): boolean {
  if (isAbortError(err)) return false;
  const status = statusOf(err);
  if (status !== null) return isTransientStatus(status);
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : "";
  return /fetch failed|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(message);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withNetworkRetries<T>(
  run: () => Promise<T>,
  options?: { attempts?: number; signal?: AbortSignal; retryIf?: (err: unknown) => boolean },
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const retryIf = options?.retryIf ?? isTransientError;
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await run();
    } catch (err) {
      last = err;
      if (isAbortError(err) || attempt === attempts || !retryIf(err)) throw err;
      await delay(200 * 3 ** (attempt - 1), options?.signal);
    }
  }
  throw last;
}
