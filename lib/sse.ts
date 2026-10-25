export function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function readSse(
  response: Response,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The response had no stream.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");
    let splitAt = buffer.indexOf("\n\n");
    while (splitAt !== -1) {
      const raw = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);
      dispatch(raw, onEvent);
      splitAt = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) dispatch(buffer, onEvent);
}

function dispatch(raw: string, onEvent: (event: string, data: unknown) => void) {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  onEvent(event, JSON.parse(dataLines.join("\n")) as unknown);
}
