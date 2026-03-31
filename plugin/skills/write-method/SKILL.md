---
name: write-method
description: "Generate method section LaTeX from a research forest"
---

# /write-method — Method Section Draft

1. Confirm the target `forest_id`
2. Call `research_get_forest` to inspect the available nodes, convergence points, and contributions
3. Call `write_method` with the same `forest_id`
4. Review the generated LaTeX and tighten the wording if the forest contains weak placeholders

Default artifact path:

```text
research/paper/sections/method.tex
```

The generated section is a draft, not a final camera-ready method section. It is intended to turn the current derivation forest into an editable LaTeX starting point.
