import { connection } from "next/server";

import { jsonError } from "@/lib/http";
import { getGeneratedImage, readImageBytes } from "@/lib/image-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;
  const image = getGeneratedImage(id);
  if (!image) return jsonError("Image not found.", 404);

  const bytes = readImageBytes(image);
  if (bytes) {
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": image.mediaType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${image.fileName ?? `image.${image.mediaType.split("/")[1]}`}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (image.sourceUrl && /^https?:\/\//i.test(image.sourceUrl)) {
    return Response.redirect(image.sourceUrl, 307);
  }
  return jsonError("Image bytes are no longer on disk.", 404);
}
