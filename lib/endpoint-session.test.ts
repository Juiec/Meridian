import { beforeEach, describe, expect, it } from "vitest";

import { createSession, getOrCreateTravelSession, getSession, updateSession } from "@/lib/sessions";
import { rememberModels, saveEndpointProfiles } from "@/lib/settings";
import { makeHome } from "@/lib/test-home";

beforeEach(() => {
  makeHome();
});

describe("session endpoint selection", () => {
  it("stores the selected endpoint with the session's default model", () => {
    saveEndpointProfiles(
      [
        { id: "local", name: "Local", baseUrl: "http://127.0.0.1:1234/v1", model: "small-model" },
        { id: "remote", name: "Remote", baseUrl: "https://models.example/v1", model: "large-model" },
      ],
      "local",
    );

    const session = createSession(undefined, "chat", "remote");
    expect(session.endpointId).toBe("remote");
    expect(session.model).toBe("large-model");

    const updated = updateSession(session.id, { endpointId: "local", model: "small-model" });
    expect(updated?.endpointId).toBe("local");
    expect(getSession(session.id)?.endpointId).toBe("local");
  });

  it("moves a trip conversation onto the active saved endpoint when its model is not on the stored one", () => {
    saveEndpointProfiles(
      [
        { id: "default", name: "Cloud", baseUrl: "https://cloud.example/v1", model: "cloud-model" },
        { id: "local", name: "Local", baseUrl: "http://127.0.0.1:1234/v1", model: "local-model" },
      ],
      "local",
    );
    rememberModels(["cloud-model"], "default");
    rememberModels(["local-model"], "local");
    createSession("old-gguf", "travel", "default");

    const session = getOrCreateTravelSession();
    expect(session.endpointId).toBe("local");
    expect(session.model).toBe("local-model");
    expect(getOrCreateTravelSession().endpointId).toBe("local");
  });
});
