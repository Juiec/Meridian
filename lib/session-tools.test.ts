import { beforeEach, describe, expect, it } from "vitest";

import {
  createSession,
  exportSession,
  getOrCreateTravelSession,
  importSession,
  insertMessage,
  listSessions,
  updateSession,
  updateSessionTitleIfDefault,
} from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";

beforeEach(() => {
  makeHome();
});

describe("session tools", () => {
  it("only generates a title while the session still has its default name", () => {
    const session = createSession();
    expect(updateSessionTitleIfDefault(session.id, "Planning a move")?.title).toBe("Planning a move");
    updateSession(session.id, { title: "Moving to Berlin" });
    expect(updateSessionTitleIfDefault(session.id, "Planning a move")?.title).toBe("Moving to Berlin");
  });

  it("keeps the planner conversation separate from regular chats", () => {
    const planner = getOrCreateTravelSession();
    const regular = createSession();

    expect(planner.purpose).toBe("travel");
    expect(getOrCreateTravelSession().id).toBe(planner.id);
    expect(listSessions().map((session) => session.id)).toContain(regular.id);
    expect(listSessions().map((session) => session.id)).not.toContain(planner.id);
    expect(listSessions({ purpose: "travel" }).map((session) => session.id)).toEqual([planner.id]);
  });

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
