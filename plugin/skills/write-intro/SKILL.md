---
name: write-intro
description: "Generate introduction section LaTeX from a research forest"
---

# /write-intro — Introduction Section Draft

1. Inspect the target forest with `research_get_forest`
2. Confirm that convergence points and contribution records are present
3. Call `write_intro` with the chosen `forest_id`
4. Refine the generated contribution bullets if the forest is still incomplete

Default artifact path:

```text
research/paper/sections/introduction.tex
```
