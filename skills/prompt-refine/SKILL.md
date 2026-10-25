---
name: prompt-refine
description: "Rewrite a prompt so a local model can follow it. Use when the user pastes a prompt, system message, or instruction and wants it sharper, shorter, or more reliable."
---

# Refine a prompt

1. Identify the job: who is speaking, what they receive, what a good result looks like, and what they must not do.
2. Read `references/local-model-notes.md` before you rewrite. Local models drop long, vague instructions.
3. Return three parts, in this order:
   - What is weak in the original, at most four bullets.
   - The revised prompt inside a fenced block, ready to paste.
   - The three changes that matter, one line each.
4. Do not add tools, personas, or policies they did not ask for. Do not make the prompt longer unless a missing constraint would make the result wrong.
5. If they name the model they are targeting, or a standing format ("always JSON", "no preamble"), save that to MEMORY or USER as one short entry.
