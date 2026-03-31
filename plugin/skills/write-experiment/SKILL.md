---
name: write-experiment
description: "Generate experiments section LaTeX from a research forest"
---

# /write-experiment — Experiments Section Draft

1. Inspect the forest with `research_get_forest`
2. Confirm that evidence nodes and `experiment_ids` are attached where possible
3. Call `write_experiment` with the chosen `forest_id`
4. Replace the scaffold with final tables, numbers, and plots once benchmark artifacts are ready

Default artifact path:

```text
research/paper/sections/experiments.tex
```
