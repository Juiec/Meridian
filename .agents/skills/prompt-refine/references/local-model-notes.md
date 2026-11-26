# Notes for local models

These are writing constraints, not a ranking of models.

- Put the task in the first sentence. Role language after that is easy to ignore.
- Ask for one output shape. If the shape is strict, show a tiny example. A second example usually hurts more than it helps.
- Replace "be thorough" with the actual sections you want, and a ceiling ("at most four bullets").
- Cut stacked identities ("you are a world-class expert who is also a coach"). One role is enough.
- Do not ask the model to plan silently and then execute in the same breath if the model is small. Ask for the plan, or ask for the result.
- Tool calls need small, valid JSON. Tell the model the exact keys. Do not say "call whatever tools you need" unless the tools are already listed.
- Negative instructions ("don't mention that you are an AI") waste space. State the desired behavior.
- If the prompt is for a model with weak tool calling, say the fact must be written with the memory tool, not merely promised in prose.
