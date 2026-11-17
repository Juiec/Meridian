import { beforeEach, describe, expect, it } from "vitest";

import {
  getSettings,
  modelCatalog,
  normalizeBaseUrl,
  rememberModels,
  saveEndpointProfiles,
  saveSettings,
  toPublicSettings,
} from "@/lib/settings";
import { makeHome } from "@/lib/test-home";

beforeEach(() => {
  makeHome();
  process.env.LM_STUDIO_API_KEY = "super-secret-key";
  process.env.LM_STUDIO_BASE_URL = "http://machine.tailnet.ts.net:1234";
  process.env.MODEL = "loaded-model";
});

describe("settings", () => {
  it("appends /v1 and hides the API key from the public view", () => {
    expect(normalizeBaseUrl("http://machine.tailnet.ts.net:1234")).toBe(
      "http://machine.tailnet.ts.net:1234/v1",
    );
    expect(normalizeBaseUrl("http://machine.tailnet.ts.net:1234/v1/")).toBe(
      "http://machine.tailnet.ts.net:1234/v1",
    );
    const pub = toPublicSettings(getSettings());
    expect(pub.baseUrl).toBe("http://machine.tailnet.ts.net:1234/v1");
    expect(pub.model).toBe("loaded-model");
    expect(pub.apiKeySet).toBe(true);
    expect(JSON.stringify(pub)).not.toContain("super-secret-key");
    expect(pub.apiKeyHint).toBe("••••-key");
  });

  it("lets a saved file override env without echoing the key", () => {
    saveSettings({ baseUrl: "http://127.0.0.1:9/v1", model: "other", apiKey: "new-key-value" });
    const pub = toPublicSettings(getSettings());
    expect(pub.baseUrl).toBe("http://127.0.0.1:9/v1");
    expect(pub.model).toBe("other");
    expect(JSON.stringify(pub)).not.toContain("new-key-value");
    saveSettings({ apiKey: "" });
    expect(toPublicSettings(getSettings()).apiKeySet).toBe(false);
  });

  it("keeps endpoint credentials and model lists separate", () => {
    saveEndpointProfiles(
      [
        { id: "default", name: "Local GPU", baseUrl: "http://127.0.0.1:1234/v1", model: "qwen-local" },
        {
          id: "cloud",
          name: "Cloud host",
          baseUrl: "https://models.example/v1",
          model: "vision-model",
          apiKey: "cloud-secret-value",
        },
      ],
      "cloud",
    );
    rememberModels(["qwen-local", "qwen-local"], "default");
    rememberModels(["vision-model"], "cloud");

    expect(getSettings().endpointId).toBe("cloud");
    expect(getSettings("default").apiKey).toBe("super-secret-key");
    expect(getSettings("cloud").apiKey).toBe("cloud-secret-value");
    expect(modelCatalog("default")).toEqual(["qwen-local"]);
    expect(modelCatalog("cloud")).toEqual(["vision-model"]);
    const publicSettings = toPublicSettings(getSettings());
    expect(publicSettings.endpoints.map((endpoint) => endpoint.name)).toEqual(["Local GPU", "Cloud host"]);
    expect(JSON.stringify(publicSettings)).not.toContain("cloud-secret-value");
  });

  it("preserves a stored key when saving other endpoint fields", () => {
    saveEndpointProfiles(
      [
        {
          id: "cloud",
          name: "Cloud host",
          baseUrl: "https://models.example/v1",
          model: "vision-model",
          apiKey: "cloud-secret-value",
        },
      ],
      "cloud",
    );
    saveEndpointProfiles(
      [{ id: "cloud", name: "Cloud host", baseUrl: "https://models.example/v1", model: "new-model" }],
      "cloud",
    );

    expect(getSettings("cloud").apiKey).toBe("cloud-secret-value");
    expect(getSettings("cloud").model).toBe("new-model");
  });
});
