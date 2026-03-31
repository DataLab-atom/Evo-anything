---
name: paper-validate
description: "Validate generated paper draft artifacts"
---

# /paper-validate — Paper Draft Validation

1. Ensure `paper_assemble` has already produced `research/paper/main.tex`
2. Call `paper_validate`
3. Review reported errors and warnings
4. Fix missing section files, bibliography paths, or placeholder text before polishing the draft

Checks include:

- missing `main.tex`
- missing `\input{}` section files
- placeholder text still present in sections
- missing bibliography file
