import { existsSync, readFileSync } from "node:fs";

import { writeAtomic } from "@/lib/atomic";
import { imageSettingsPath } from "@/lib/paths";
import { endpointSettingsList, type ResolvedSettings } from "@/lib/settings";

/** Preferred image model when the saved Images endpoint offers it. */
export const DEFAULT_IMAGE_MODEL = "gpt-image-2";

const IMAGE_MODEL = /gpt-image|dall-e|flux|stable-diffusion|stable-image|imagen/i;

export class ImageSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageSettingsError";
  }
}

export type ImageTarget = {
  endpointId: string;
  endpointName: string;
  model: string;
  apiKeySet: boolean;
};

type StoredImageSettings = {
  endpointId: string;
  model: string;
};

function readStored(): StoredImageSettings | null {
  const file = imageSettingsPath();
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<StoredImageSettings>;
    if (typeof parsed.endpointId !== "string" || !parsed.endpointId.trim()) return null;
    return {
      endpointId: parsed.endpointId.trim(),
      model: typeof parsed.model === "string" ? parsed.model.trim() : "",
    };
  } catch {
    return null;
  }
}

function writeStored(settings: StoredImageSettings) {
  writeAtomic(imageSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`);
}

/** The endpoint is for images when its name is Image or its selected model is an image model. A chat catalog that merely lists one does not count. */
function isImageEndpoint(endpoint: ResolvedSettings): boolean {
  if (/^image$/i.test(endpoint.name.trim())) return true;
  return IMAGE_MODEL.test(endpoint.model.trim());
}

function pickImageEndpoint(endpoints: ResolvedSettings[]): ResolvedSettings | undefined {
  const dedicated = endpoints.filter(isImageEndpoint);
  return (
    dedicated.find((endpoint) => /^image$/i.test(endpoint.name.trim())) ??
    dedicated.find((endpoint) => IMAGE_MODEL.test(endpoint.model.trim())) ??
    endpoints.find((endpoint) => catalog(endpoint).some((model) => IMAGE_MODEL.test(model)))
  );
}

function catalog(endpoint: ResolvedSettings): string[] {
  return [...new Set([endpoint.model, ...endpoint.models].map((model) => model.trim()).filter(Boolean))];
}

function chooseModel(endpoint: ResolvedSettings, requested?: string, saved?: string): string {
  const models = catalog(endpoint);
  const ask = requested?.trim() ?? "";
  if (ask && (models.length === 0 || models.includes(ask))) return ask;
  const remembered = saved?.trim() ?? "";
  if (remembered && (models.length === 0 || models.includes(remembered))) return remembered;
  if (models.includes(DEFAULT_IMAGE_MODEL)) return DEFAULT_IMAGE_MODEL;
  return models.find((model) => IMAGE_MODEL.test(model)) || endpoint.model.trim() || models[0] || DEFAULT_IMAGE_MODEL;
}

function toTarget(endpoint: ResolvedSettings, model: string): ImageTarget {
  return {
    endpointId: endpoint.endpointId,
    endpointName: endpoint.name,
    model,
    apiKeySet: endpoint.apiKey.trim().length > 0,
  };
}

/**
 * The Images endpoint and model chat generation uses.
 * An explicit id must already be an image endpoint or the saved default.
 * With no id, the saved default wins, then an endpoint named Image or one whose model is an image model.
 */
export function resolveImageTarget(input?: { endpointId?: string; model?: string }): ImageTarget {
  const endpoints = endpointSettingsList();
  const explicit = input?.endpointId?.trim() ?? "";
  const stored = readStored();
  if (explicit) {
    const endpoint = endpoints.find((item) => item.endpointId === explicit);
    if (!endpoint) throw new ImageSettingsError("Choose a saved image endpoint in Image Studio.");
    const allowed = isImageEndpoint(endpoint) || stored?.endpointId === endpoint.endpointId;
    if (!allowed) {
      throw new ImageSettingsError("That endpoint is not set up for images. Choose the Image Studio endpoint.");
    }
    return toTarget(endpoint, chooseModel(endpoint, input?.model, stored?.model));
  }

  const remembered = stored ? endpoints.find((item) => item.endpointId === stored.endpointId) : undefined;
  const endpoint = remembered ?? pickImageEndpoint(endpoints);
  if (!endpoint) throw new ImageSettingsError("Choose a saved image endpoint in Image Studio.");
  const model = chooseModel(endpoint, input?.model, stored?.endpointId === endpoint.endpointId ? stored.model : undefined);
  if (!stored || stored.endpointId !== endpoint.endpointId || stored.model !== model) {
    writeStored({ endpointId: endpoint.endpointId, model });
  }
  return toTarget(endpoint, model);
}

/** Remember the endpoint and model Image Studio and chat image generation share. */
export function saveImageSettings(input: { endpointId: string; model: string }): ImageTarget {
  const endpoint = endpointSettingsList().find((item) => item.endpointId === input.endpointId.trim());
  if (!endpoint) throw new ImageSettingsError("Choose a saved image endpoint in Image Studio.");
  const model = chooseModel(endpoint, input.model);
  writeStored({ endpointId: endpoint.endpointId, model });
  return toTarget(endpoint, model);
}
