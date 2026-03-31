---
name: write-related
description: "Generate related-work section LaTeX from a research forest"
---

# /write-related — Related Work Draft

1. Inspect the forest and confirm that `literature_refs` are attached to relevant nodes
2. If literature grounding is weak, enrich the forest first via `/ask-lit` and `research_update_node`
3. Call `write_related` with the chosen `forest_id`
4. Rewrite the scaffold into a full narrative once the cited papers are confirmed

Default artifact path:

```text
research/paper/sections/related_work.tex
```
