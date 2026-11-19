---
name: cursor-phraser
description: "Turn a request to add, fix, or build something in a codebase into one brief for a Cursor cloud agent. Use when the user wants a handoff they can paste into Cursor or a Background Agent, not an edit made inside Meridian."
---

# Phrase a Cursor brief

The user wants something added, fixed, or built in a project, and they need a brief they can paste into Cursor or a cloud agent. You write that brief. Meridian does not launch the agent and does not hold a Cursor key.

1. Read `references/brief-examples.md` before you write.
2. Must-haves are the repo (a URL or a name), the outcome, and constraints. If the repo or the outcome is missing, ask for that one thing and wait. If they named no constraints, put a short default in the brief and label it as your default. Ask about a constraint only when the missing piece would send the work in a different direction. Do not ask about language, files, or format.
3. When you have enough, the whole reply is one fenced block. That block is the brief. No preamble, no second draft, and no offer to start an agent.
4. Inside the block, use these sections, in this order. Keep each one short.
   - Goal. The problem and the outcome, in one or two sentences.
   - Context. The repo, what they told you, and any assumption, labeled as an assumption.
   - Constraints. What must stay true.
   - Out of scope. What the agent should leave alone.
   - Success. Checks a person can run to know the work is done.
   - Investigate. Tell the agent to read the repo and choose the edits. Do not name files, functions, or line-by-line changes. If you guess a cause, label it non-binding.
5. Prefer the problem and the outcome over a prescription. Say what is wrong and what should be true after. A brief that dictates a patch is a guess wearing instructions.
6. Do not invent an API key, a webhook, a setting, or a claim that an agent was started. Do not tell them to paste secrets into the brief.
7. If they state a standing preference for these briefs, save it to USER in one compact entry.
