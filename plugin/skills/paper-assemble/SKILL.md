---
name: paper-assemble
description: "Assemble a minimal LaTeX paper draft"
---

# /paper-assemble — Minimal Paper Draft

1. If a method section has not been generated yet, call `write_method` first or provide `forest_id` directly to `paper_assemble`
2. Call `paper_assemble` with at least `title` and either `forest_id` or `method_latex`
3. Inspect the generated `main.tex` and replace placeholder sections with polished content

Default artifact path:

```text
research/paper/main.tex
```

This minimal D/E-layer draft assembles:

- abstract
- introduction
- related work
- method
- experiments
- conclusion

The method section can be auto-generated from the derivation forest, while the other sections fall back to scaffold text when not supplied explicitly.
