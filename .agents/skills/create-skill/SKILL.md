---
name: create-skill
description: "Create, edit, or replace a skill when the user explicitly asks. Do not use it because a task is repetitive, to tidy instructions, or to suggest a skill they did not request."
disable-model-invocation: true
---

# Create or edit a skill

The user asked to create a skill, change one, or replace one. If they did not, stop. Do not offer to make a skill.

1. If they named an existing skill, load it with `skill_view` before you change it. Load a reference only when the edit touches that file. Use `list_skills` when you are unsure of the name.
2. A skill is a procedure this model would not already follow: steps, a format, or a constraint. A fact about the person belongs in USER. A fact about this machine belongs in MEMORY. Do not make a skill for a one-off request.
3. The name is lowercase words with single hyphens, 64 characters or fewer. Do not use `ask`, `plan`, or `agent`. The description says what it does and the exact situation that should load it, in 1024 characters or fewer. The body is the procedure, in 20000 characters or fewer. Put a long example in `references/` as `notes.md` or `notes.txt`.
4. Save with `skill_write`. Pass the full name, description, and body. On an edit, pass `references` only for the files you are keeping or changing. Omit `references` to leave the current files in place. Pass `previousName` only when they asked to rename. Set `disableModelInvocation` only when they want that skill hidden from the index and run only as `/name`.
5. Leave `create-skill` hidden. Do not pass `disableModelInvocation: false` for it unless they explicitly say to put it in the index. Do not rename another skill onto `create-skill`.
6. When the tool result says the write succeeded, reply with the name, whether it was created or updated, and the one-line description. Do not paste the body back. If the tool returns an error, fix that call. Do not claim the skill was saved.
7. Do not delete a skill. The desk deletes skills. Ask and Plan cannot write. If the mode blocked `skill_write`, tell them to switch with `/agent`.
