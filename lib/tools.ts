import { fetchPublicUrl } from "@/lib/fetch-url";
import { validSize } from "@/lib/image-generator";
import { ImageSettingsError, resolveImageTarget } from "@/lib/image-settings";
import { applyMemory, MEMORY_LIMITS, type MemoryOp, type MemoryTarget } from "@/lib/memory";
import { discoverSkills, readSkillFile } from "@/lib/skills";
import { fileSessionAsTrip, getSession } from "@/lib/sessions";
import { executeTravelTool } from "@/lib/travel";
import { executeWorkspaceTool } from "@/lib/workspace";

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const operationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["add", "patch", "remove"] },
    content: { type: "string" },
    old_text: {
      type: "string",
      description:
        "Unique substring identifying one entry for patch or remove. An exact full-entry match rewrites that entry on patch.",
    },
  },
  required: ["action"],
};

export const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "memory",
      description:
        "Add, patch, or remove entries in MEMORY (agent notes, 2200 chars) or USER (profile, 1375 chars). Over-limit writes return an error and change nothing. The system-prompt snapshot stays frozen until the next session; this result is the live state.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          target: {
            type: "string",
            enum: ["memory", "user"],
            description: "memory = agent notes. user = the person's profile.",
          },
          operations: { type: "array", items: operationSchema },
        },
        required: ["target", "operations"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skill_view",
      description:
        "Load a skill's instructions, or a reference file inside that skill. Call this when a task matches a skill in the index before following the procedure.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Skill name from the index, such as code-explain." },
          path: {
            type: "string",
            description: "Optional path inside the skill, such as references/source-rubric.md. Omit to load SKILL.md.",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_skills",
      description:
        "List installed skills with name, description, and path. The index is already in the system prompt; use this to confirm the live disk state.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "delegate",
      description:
        "Hand one task to a subagent that starts from a short context summary, not this chat. Use it when the next step would fill the context with a page, search results, or several lookups. The subagent does not see this conversation. Always pass context with the facts, constraints, and decisions it needs. You receive a short result, not its tool trace. Up to 3 calls per turn.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          task: { type: "string", description: "One assignment. Say what done looks like." },
          context: {
            type: "string",
            description: "Facts the subagent cannot see: names, dates, constraints, and decisions so far. Keep it short.",
          },
          title: { type: "string", description: "Optional label, about 3 to 6 words." },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Fetch a public http(s) URL and return readable text. Refuses private, loopback, and link-local addresses. Truncates long pages and says so.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string", description: "Absolute http or https URL." },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "current_time",
      description: "Return the server clock as UTC and local time. Use when the answer depends on the actual time.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "image_generate",
      description:
        "Prepare an image with the saved Image Studio endpoint and its API key. Does not call the provider. The user confirms in the chat, and that confirmation sends the request. Omit endpointId and model so the Image Studio default is used (gpt-image-2 when that endpoint offers it). Use it when the user asks for an image, or after /image.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: {
            type: "string",
            description: "Detailed description of the image to create.",
          },
          size: {
            type: "string",
            description: 'Optional: "auto", "1024x1024", "1536x1024", "1024x1536", or WIDTHxHEIGHT (256-4096, multiples of 16).',
          },
          n: { type: "integer", minimum: 1, maximum: 10, description: "How many images, 1 to 10. Defaults to 1." },
          endpointId: {
            type: "string",
            description: "Optional saved image endpoint id. Omit it to use the Image Studio default. A chat endpoint is refused.",
          },
          model: {
            type: "string",
            description: "Optional image model id. Defaults to gpt-image-2 when the Image Studio endpoint offers it.",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "travel_geocode",
      description:
        "Look up a place name with Open-Meteo geocoding. Returns latitude, longitude, and a label. Use this before weather, places, or pinning. Do not invent coordinates. Do not assume a home city.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { query: { type: "string", description: "City, neighborhood, or address." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "travel_weather",
      description:
        "Forecast from Open-Meteo for a place name or coordinates. Only the returned days are known. Do not invent weather outside that window.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { place: { type: "string" }, lat: { type: "number" }, lng: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "travel_places",
      description:
        "Find nearby points of interest from OpenStreetMap. Pass a place name or coordinates and a query such as museum or station. An empty list means nothing matched.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          place: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          query: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "travel_route",
      description:
        "Distance and duration between two places. Uses OSRM when it responds, and always includes straight-line distance. Do not state a travel time this tool did not return.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          fromLat: { type: "number" },
          fromLng: { type: "number" },
          toLat: { type: "number" },
          toLng: { type: "number" },
          profile: { type: "string", enum: ["driving", "foot"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "travel_prices",
      description:
        "Compare fare quotes between two places. Without a configured price URL these are illustrative distance estimates and live is false. Links only open a public search. Never book, pay, or collect card details.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD if known." },
          passengers: { type: "number" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "travel_plan",
      description:
        "List, add, remove, or update places on the Travel Planner map. Add geocodes a name when coordinates are omitted. This does not book anything.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["list", "add", "remove", "update"] },
          name: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          kind: { type: "string", enum: ["destination", "stay", "poi", "transit"] },
          day: { type: "number", description: "Optional itinerary day, a whole number from 1 to 365." },
          note: { type: "string" },
          id: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "workspace_list",
      description:
        "List files and folders in the project this chat is bound to. Paths are relative to that project. Omit path to list the top. Refuses paths outside the project.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", description: "Optional folder inside the project, such as src or a cloned repository name." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "workspace_read",
      description:
        "Read a text file inside the bound project. Refuses secrets, binary files, and paths outside the project.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", description: "Relative path, such as README.md or repo/src/app.ts." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "workspace_write",
      description:
        "Create or replace a text file inside the bound project. Parent folders are created. Refuses secrets and paths outside the project. Does not run the file.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "workspace_run",
      description:
        "Run a shell command in the bound project folder, such as a test or a build. Output is capped and the command stops after 60 seconds. The command starts in the project folder.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          command: { type: "string", description: "Command to run, such as npm test." },
        },
        required: ["command"],
      },
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseToolArguments(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const record = asRecord(parsed);
    if (!record) return { ok: false, error: "Tool arguments must be a JSON object." };
    return { ok: true, value: record };
  } catch {
    return { ok: false, error: "Arguments were not valid JSON." };
  }
}

function memoryOps(value: unknown): MemoryOp[] | { error: string } {
  if (!Array.isArray(value)) return { error: "operations must be an array." };
  const ops: MemoryOp[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) return { error: "Each operation must be an object." };
    const action = record.action;
    if (action !== "add" && action !== "patch" && action !== "remove") {
      return { error: "Each operation needs action add, patch, or remove." };
    }
    ops.push({
      action,
      content: typeof record.content === "string" ? record.content : undefined,
      old_text: typeof record.old_text === "string" ? record.old_text : undefined,
    });
  }
  return ops;
}

export type ToolContext = {
  sessionId?: string;
  toolCallId?: string;
  mode?: "agent" | "ask" | "plan";
  delegate?: (rawArgs: string) => Promise<Record<string, unknown>>;
};

export async function executeTool(
  name: string,
  rawArgs: string,
  context: ToolContext = {},
): Promise<Record<string, unknown>> {
  const parsed = parseToolArguments(rawArgs);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const args = parsed.value;

  if (name.startsWith("travel_")) {
    const session = context.sessionId ? getSession(context.sessionId) : null;
    return executeTravelTool(name, args, session?.purpose === "travel" ? session.id : undefined);
  }

  if (name === "memory") {
    const target = args.target;
    if (target !== "memory" && target !== "user") {
      return {
        ok: false,
        error: 'target must be "memory" or "user".',
        limits: MEMORY_LIMITS,
      };
    }
    const ops = memoryOps(args.operations);
    if ("error" in ops) return { ok: false, error: ops.error };
    const result = applyMemory(target as MemoryTarget, ops);
    return { ...result };
  }

  if (name === "skill_view") {
    const skillName = typeof args.name === "string" ? args.name.trim() : "";
    if (!skillName) return { ok: false, error: "skill_view requires name." };
    if (skillName === "itinerary-day" && context.sessionId) fileSessionAsTrip(context.sessionId);
    const rel = typeof args.path === "string" ? args.path : undefined;
    return readSkillFile(skillName, rel);
  }

  if (name === "list_skills") {
    const { skills, skipped } = discoverSkills();
    return {
      ok: true,
      skills: skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        path: skill.rel,
        disableModelInvocation: skill.disableModelInvocation,
        files: skill.files,
      })),
      skipped,
    };
  }

  if (name === "fetch_url") {
    const url = typeof args.url === "string" ? args.url : "";
    if (!url) return { ok: false, error: "fetch_url requires url." };
    return fetchPublicUrl(url);
  }

  if (name === "image_generate") {
    const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
    if (!prompt) return { ok: false, error: "image_generate requires a prompt." };
    const size = typeof args.size === "string" && args.size.trim() ? args.size.trim() : "auto";
    const n = typeof args.n === "number" && Number.isInteger(args.n) ? args.n : 1;
    if (!validSize(size)) return { ok: false, error: "Choose a supported image size (dimensions must be multiples of 16)." };
    if (n < 1 || n > 10) return { ok: false, error: "Batch amount must be between 1 and 10." };
    try {
      const target = resolveImageTarget({
        endpointId: typeof args.endpointId === "string" ? args.endpointId : undefined,
        model: typeof args.model === "string" ? args.model : undefined,
      });
      const keyNote = target.apiKeySet
        ? "The saved Image Studio key is sent only after you confirm."
        : "This endpoint has no saved key. Confirm only if the service does not need one.";
      return {
        ok: true,
        needsConfirm: true,
        text: `Confirm to generate with ${target.endpointName} · ${target.model}. ${keyNote}`,
        prompt,
        size,
        n,
        endpointId: target.endpointId,
        endpointName: target.endpointName,
        model: target.model,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof ImageSettingsError || error instanceof Error ? error.message : "Image generation failed.",
      };
    }
  }

  if (name.startsWith("workspace_")) {
    return executeWorkspaceTool(name, args, context.sessionId);
  }

  if (name === "current_time") {
    const now = new Date();
    return {
      ok: true,
      utc: now.toISOString(),
      epochMs: now.getTime(),
      local: now.toString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    };
  }

  return { ok: false, error: `Unknown tool "${name}".` };
}
