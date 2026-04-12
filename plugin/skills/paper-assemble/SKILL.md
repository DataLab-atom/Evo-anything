---
name: paper-assemble
description: "Assemble D-layer chapter files (intro, method, experiment, related) into a complete LaTeX paper with bibliography and consistency checks. Use when combining all sections into a final manuscript."
---

# /paper-assemble — Paper Assembly

> **E: Paper assembly** — combines D-layer chapter files into a complete LaTeX paper,
> integrates bibliography, and performs consistency checks.

## Purpose

After D-layer chapters (intro, related, method, experiment) have been generated and
written to `research/paper/sections/`, this skill assembles them into a full paper
by merging with a LaTeX template.

## Usage

```
/paper-assemble [--forest <forest_id>] [--venue <venue_name>]
```

Examples:
- `/paper-assemble --forest exp-2024-run-01 --venue NeurIPS`
- `/paper-assemble --venue ICML`

## Prerequisites

1. At least the **Method** section has been written (`research/paper/sections/method.tex`)
2. A LaTeX template exists at `research/paper/template.tex` OR you want a minimal template auto-generated
3. `research/refs/references.bib` contains the relevant citations

## Behavior

### Step 1: Check Available Sections

1. Check `research/paper/sections/` for available chapter files:
   - `intro.tex` — Introduction
   - `related.tex` — Related Work
   - `method.tex` — Method
   - `experiment.tex` — Experiments
   - `conclusion.tex` — Conclusion (optional)

### Step 2: Load Template

1. If `research/paper/template.tex` exists, use it
2. Otherwise, generate a minimal template

### Step 3: Assemble Paper

The assembler:
1. Reads each section file
2. Substitutes `\input{sections/<name>}` placeholders in the template
3. Integrates bibliography references
4. Performs consistency checks

### Step 4: Consistency Checks

The assembler automatically checks for:
- **Citation consistency** — all cited keys appear in `references.bib`
- **Figure references** — `\ref{fig:...}` has a corresponding `\includegraphics`
- **Notation consistency** — math notation usage across sections
- **Format compliance** — template structure integrity

### Step 5: Write Output

1. Output path: `research/paper/paper.tex`
2. Report any consistency issues (warnings/errors)

## Consistency Issues

The assembler will flag these types of issues:

| Type | Severity | Description |
|------|----------|-------------|
| `citation` | warning | Cited key not found in references.bib |
| `figure_ref` | warning | Figure referenced but not included |
| `notation` | warning | Inconsistent math notation across sections |
| `format` | error | Missing required template elements |

## Output

Returns:
- Path to the assembled paper: `research/paper/paper.tex`
- List of sections found and missing
- Number of BibTeX entries
- Consistency issues (if any)
- Approximate word count

## Tool Usage

| Tool | Purpose |
|------|---------|
| `research_get_forest` | (optional) Get forest ID to locate paper directory |
| `bib_append` | Add missing BibTeX entries if issues are found |

## Paper Assembly API

The assembler also exposes a `paper_assemble` tool that can be called directly:
```
tool: paper_assemble
params: {
  repo_path: <path to repo>,
  paper_dir: research/paper,
  output_path: research/paper/paper.tex,
  sections: ["intro", "related", "method", "experiment"]
}
```
