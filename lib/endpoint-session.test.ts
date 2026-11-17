import { beforeEach, describe, expect, it } from "vitest";

import { createSession, getSession, updateSession } from "@/lib/sessions";
import { saveEndpointProfiles } from "@/lib/settings";
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
});
