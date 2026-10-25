export function messageOf(err: unknown): string {
  if (err instanceof Error) return scrubSecrets(err.message);
  return "Unexpected error";
}

export function scrubSecrets(value: string): string {
  return value.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === "AbortError") ||
    (typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name?: string }).name === "AbortError")
  );
}
