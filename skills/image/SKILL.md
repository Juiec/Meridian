---
name: image
description: "Generate an image with /image. Use when the user asks to create, draw, or generate a picture from a description; calls image_generate and stores a backend record."
---

# Image generation

Use this when the user asks for a picture, illustration, or visual from a description.

1. Turn the user's request into one detailed prompt. Keep the subject, setting, style, lighting, and composition they asked for. Do not silently add brand names or people they did not mention. If the request is genuinely ambiguous about the medium or framing, ask one focused question before generating.
2. Call the `image_generate` tool. Pass `prompt`. Use `n: 1` and `size: "auto"` unless the user specified a count or canvas. A custom size is `WIDTHxHEIGHT`, 256–4096 px in steps of 16. If the user explicitly names a different saved endpoint, pass `endpointId`; otherwise omit it so the chat's endpoint is used.
3. The tool saves each image under `data/images` and adds a record to the backend image log with this session id. Do not claim success unless the result says `ok: true`. On an error, report the tool's error and do not invent an image.
4. In your reply, show each returned image with Markdown: `![short description](/api/images/<id>)`, using the exact `url` from the tool result. Then give at most one short line of context. Do not describe pixels you have not seen and do not invent ids or links.

For edits of an uploaded image, say plainly that image-to-image editing is done in Image Studio and give the user the path there. This skill generates new images from text.
