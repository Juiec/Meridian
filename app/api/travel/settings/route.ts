import { connection } from "next/server";

import { caught, readBody } from "@/lib/http";
import { saveTravelSettings } from "@/lib/travel-store";

export async function PUT(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const settings = saveTravelSettings({
      priceUrl: typeof body.priceUrl === "string" ? body.priceUrl : undefined,
      priceApiKey: typeof body.priceApiKey === "string" ? body.priceApiKey : undefined,
    });
    return Response.json({ settings });
  } catch (err) {
    return caught(err, 400);
  }
}
