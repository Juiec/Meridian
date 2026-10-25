import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { parseSseEvent, streamCompletion } from "@/lib/lmstudio";
import { TOOLS } from "@/lib/tools";

let server: Server | null = null;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server?.close((err) => (err ? reject(err) : resolve()));
  });
  server = null;
});

function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<string> {
  server = createServer(handler);
  return new Promise((resolve) => {
    server?.listen(0, "127.0.0.1", () => {
      const address = server?.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}/v1`);
    });
  });
}

describe("LM Studio client", () => {
  it("parses streamed text and tool-call deltas", () => {
    const events = parseSseEvent(
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: "c1", function: { name: "current_time", arguments: "{}" } }],
            },
            finish_reason: "tool_calls",
          },
        ],
      })}`,
    );
    expect(events.map((event) => event.type)).toEqual(["tool_delta", "finish"]);
  });

  it("streams a completion from an OpenAI-compatible server", async () => {
    const baseUrl = await listen((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Hello" } }] })}\n\n`);
      res.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "current_time", arguments: "" } }] },
            },
          ],
        })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] }, finish_reason: "tool_calls" }],
        })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
    });
    const events = [];
    for await (const event of streamCompletion({
      baseUrl,
      model: "local",
      messages: [{ role: "user", content: "hi" }],
      tools: TOOLS,
    })) {
      events.push(event);
    }
    expect(events).toContainEqual({ type: "text", text: "Hello" });
    expect(events).toContainEqual({
      type: "tool_delta",
      index: 0,
      id: "call_1",
      name: "current_time",
      arguments: "",
    });
    expect(events).toContainEqual({
      type: "tool_delta",
      index: 0,
      id: undefined,
      name: undefined,
      arguments: "{}",
    });
  });

  it("retries once without tool_choice when the server rejects it", async () => {
    let calls = 0;
    const baseUrl = await listen((req, res) => {
      calls += 1;
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { tool_choice?: string };
        if (calls === 1) {
          expect(body.tool_choice).toBe("auto");
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "unknown field tool_choice" } }));
          return;
        }
        expect(body.tool_choice).toBeUndefined();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Recovered" }, finish_reason: "stop" }] }));
      });
    });
    const events = [];
    for await (const event of streamCompletion({
      baseUrl,
      model: "local",
      messages: [{ role: "user", content: "hi" }],
      tools: TOOLS,
    })) {
      events.push(event);
    }
    expect(calls).toBe(2);
    expect(events).toContainEqual({ type: "text", text: "Recovered" });
  });
});
