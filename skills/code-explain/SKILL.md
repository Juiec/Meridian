---
name: code-explain
description: "Explain code the user pasted or described. Use when they ask what a snippet does, why it fails, or how control flow moves. Do not use it to invent a large new program."
---

# Explain code

1. Name the language if you can tell. If you are guessing, say so in a clause, not a disclaimer paragraph.
2. Say what the code does in a few sentences before any line-by-line notes.
3. Walk the path that matters: inputs, branches, side effects, and what it returns. Skip ceremony.
4. Name bugs, traps, or security issues you can actually see in the snippet. Do not invent a surrounding codebase, a framework version, or a caller that was not shown.
5. Offer a tighter version only if they asked for a change or the current code is wrong. Otherwise stop after the explanation.
6. If they state a standing preference ("always show the types", "I read TypeScript"), save it to USER in one compact entry.
