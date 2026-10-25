import { fetchPublicUrl } from "@/lib/fetch-url";
import { applyMemory, MEMORY_LIMITS, type MemoryOp, type MemoryTarget } from "@/lib/memory";
import { discoverSkills, readSkillFile } from "@/lib/skills";
import { executeTravelTool } from "@/lib/travel";

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
        "List, add, remove, or update places on the Travel Agent map. Add geocodes a name when coordinates are omitted. This does not book anything.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["list", "add", "remove", "update"] },
          name: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          kind: { type: "string", enum: ["destination", "stay", "poi", "transit"] },
          day: { type: "number" },
          note: { type: "string" },
          id: { type: "string" },
        },
        required: ["action"],
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

export async function executeTool(name: string, rawArgs: string): Promise<Record<string, unknown>> {
  const parsed = parseToolArguments(rawArgs);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const args = parsed.value;

  if (name.startsWith("travel_")) return executeTravelTool(name, args);

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
