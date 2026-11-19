import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { endpointSecretsPath, endpointsPath, settingsPath } from "@/lib/paths";
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

  it("keeps a saved key out of the endpoint profile and private on disk", () => {
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

    const profiles = readFileSync(endpointsPath(), "utf8");
    const secrets = readFileSync(endpointSecretsPath(), "utf8");
    expect(profiles).not.toContain("cloud-secret-value");
    expect(profiles).not.toContain("apiKey");
    expect(secrets).toContain("cloud-secret-value");
    expect(statSync(endpointSecretsPath()).mode & 0o777).toBe(0o600);
    expect(statSync(path.dirname(endpointSecretsPath())).mode & 0o777).toBe(0o700);
    const pub = toPublicSettings(getSettings("cloud"));
    expect(pub.apiKeySet).toBe(true);
    expect(pub.apiKeyHint).toBe("••••alue");
    expect(JSON.stringify(pub)).not.toContain("cloud-secret-value");
  });

  it("does not write the environment key until an endpoint is saved", () => {
    expect(getSettings().apiKey).toBe("super-secret-key");
    expect(existsSync(endpointsPath())).toBe(false);
    expect(existsSync(endpointSecretsPath())).toBe(false);
  });

  it("migrates a legacy settings file and deletes it", () => {
    writeFileSync(
      settingsPath(),
      `${JSON.stringify({
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "legacy-secret-value",
        model: "old-model",
      })}\n`,
    );

    expect(getSettings().apiKey).toBe("legacy-secret-value");
    expect(getSettings().model).toBe("old-model");
    expect(existsSync(settingsPath())).toBe(false);
    expect(readFileSync(endpointsPath(), "utf8")).not.toContain("legacy-secret-value");
    expect(readFileSync(endpointSecretsPath(), "utf8")).toContain("legacy-secret-value");
  });

  it("migrates an endpoint array out of settings.json", () => {
    writeFileSync(
      settingsPath(),
      `${JSON.stringify({
        activeEndpointId: "cloud",
        endpoints: [
          {
            id: "cloud",
            name: "Cloud host",
            baseUrl: "https://models.example/v1",
            model: "vision-model",
            apiKey: "array-secret-value",
          },
        ],
      })}\n`,
    );

    expect(getSettings().endpointId).toBe("cloud");
    expect(getSettings().apiKey).toBe("array-secret-value");
    expect(existsSync(settingsPath())).toBe(false);
    expect(readFileSync(endpointsPath(), "utf8")).not.toContain("array-secret-value");
    expect(readFileSync(endpointsPath(), "utf8")).not.toContain("apiKey");
    expect(readFileSync(endpointSecretsPath(), "utf8")).toContain("array-secret-value");
  });
});
