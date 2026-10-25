import { beforeEach, describe, expect, it } from "vitest";

import { createSession, exportSession, importSession, insertMessage, listSessions, updateSession } from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";

beforeEach(() => {
  makeHome();
});

describe("session tools", () => {
  it("pins, archives, searches, and round-trips an export", () => {
    const first = createSession();
    insertMessage({ sessionId: first.id, role: "user", content: "The cedar desk is the one I want." });
    updateSession(first.id, { title: "Desk", pinned: true });
    const second = createSession();
    updateSession(second.id, { title: "Other", archived: true });
    const visible = listSessions();
    expect(visible.map((session) => session.title)).toEqual(["Desk"]);
    expect(visible[0]?.pinned).toBe(true);
    expect(listSessions({ archived: "only" }).map((session) => session.id)).toEqual([second.id]);
    expect(listSessions({ query: "cedar", archived: "all" })[0]?.id).toBe(first.id);

    const payload = exportSession(first.id);
    expect(payload?.session.messages[0]?.content).toContain("cedar");
    const imported = importSession(payload);
    expect(imported.title).toBe("Desk");
    expect(listSessions({ query: "cedar", archived: "all" }).length).toBe(2);
  });
});
