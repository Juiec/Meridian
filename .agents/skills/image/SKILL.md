---
name: image
description: "Generate an image with /image. Use when the user asks to create, draw, or generate a picture from a description; calls image_generate and stores a backend record."
---

# Image generation

Use this when the user asks for a picture, illustration, or visual from a description.

1. Turn the user's request into one detailed prompt. Keep the subject, setting, style, lighting, and composition they asked for. Do not silently add brand names or people they did not mention. If the request is genuinely ambiguous about the medium or framing, ask one focused question before generating.
2. Call the `image_generate` tool. Pass `prompt`. Use `n: 1` and `size: "auto"` unless the user specified a count or canvas. A custom size is `WIDTHxHEIGHT`, 256–4096 px in steps of 16. Omit `endpointId` and `model`. The app uses the Image Studio endpoint, its saved API key, and the default image model (`gpt-image-2` when that endpoint offers it). Do not pass this chat's host. Pass `endpointId` or `model` only when the user names a different saved image endpoint or model.
3. The tool does not generate yet. A result with `needsConfirm: true` is waiting for the user to press **Generate image** in the chat. That confirmation sends the saved Image Studio key. Tell them the prompt is ready and name the endpoint and model from the result. Do not claim an image exists, and do not invent a link.
4. After they confirm, the card shows the saved image. Only then, if a later tool result includes image `url`s, show each one with Markdown: `![short description](/api/images/<id>)`, using the exact `url`. Give at most one short line of context. On an error, report the tool's error and do not invent an image.

For edits of an uploaded image, say plainly that image-to-image editing is done in Image Studio and give the user the path there. This skill generates new images from text.
