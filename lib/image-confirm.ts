import { messageOf } from "@/lib/errors";
import { generateImages } from "@/lib/image-generator";
import { getSession, listMessages, updateToolMessage } from "@/lib/sessions";

type PendingImage = {
  ok?: boolean;
  needsConfirm?: boolean;
  prompt?: string;
  size?: string;
  n?: number;
  endpointId?: string;
  endpointName?: string;
  model?: string;
  images?: unknown;
};

function readPending(content: string): PendingImage | null {
  try {
    const parsed = JSON.parse(content) as PendingImage;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Run the saved Images request that a chat tool left waiting for confirmation. */
export async function confirmImageGeneration(sessionId: string, toolCallId: string): Promise<string> {
  if (!getSession(sessionId)) throw new Error("Session not found.");
  const message = listMessages(sessionId).find(
    (item) => item.role === "tool" && item.toolCallId === toolCallId && item.toolName === "image_generate",
  );
  if (!message) throw new Error("Image confirmation was not found.");
  const pending = readPending(message.content);
  if (!pending) throw new Error("Image confirmation was not found.");
  if (pending.needsConfirm !== true) {
    if (pending.ok === true && Array.isArray(pending.images)) return message.content;
    throw new Error("This image request is not waiting for confirmation.");
  }
  const prompt = typeof pending.prompt === "string" ? pending.prompt.trim() : "";
  const size = typeof pending.size === "string" && pending.size.trim() ? pending.size.trim() : "auto";
  const count = typeof pending.n === "number" ? pending.n : 1;
  const endpointId = typeof pending.endpointId === "string" ? pending.endpointId : "";
  const model = typeof pending.model === "string" ? pending.model : "";
  try {
    const result = await generateImages({
      prompt,
      size,
      count,
      endpointId,
      model,
      sessionId,
      toolCallId,
    });
    const content = JSON.stringify({
      ok: true,
      message: `Generated ${result.images.length} image${result.images.length === 1 ? "" : "s"} with ${result.endpointName}. Saved to the backend image log.`,
      images: result.images.map((image) => ({
        id: image.id,
        url: image.url,
        prompt: image.revisedPrompt || image.prompt,
        size: image.size,
        model: image.model,
        createdAt: image.createdAt,
      })),
      endpointId,
      model,
    });
    updateToolMessage(sessionId, toolCallId, content);
    return content;
  } catch (err) {
    const content = JSON.stringify({
      ok: false,
      needsConfirm: true,
      text: "Image generation failed. You can try again.",
      error: messageOf(err),
      prompt,
      size,
      n: count,
      endpointId,
      endpointName: pending.endpointName,
      model,
    });
    updateToolMessage(sessionId, toolCallId, content);
    return content;
  }
}
