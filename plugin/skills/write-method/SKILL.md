---
name: write-method
description: "Generate the Method section of an academic paper describing the proposed approach, baselines, and experimental setup. Outputs LaTeX format."
---

# /write-method — Method Chapter Writing

> **D1: Method chapter generation** — transforms the derivation forest's deep motivation
> and contribution structure into a rigorous methodology LaTeX section.

## Purpose

Read the completed derivation forest (from C-layer), extract the deep motivation Q
and primary contribution branches, and generate a well-structured **Method** section
in LaTeX format suitable for academic submission.

## Usage

```
/write-method <forest_id> [--venue <venue_name>]
```

Examples:
- `/write-method exp-2024-run-01 --venue NeurIPS`
- `/write-method my-forest --venue ICML`

## Prerequisites

Before running this skill, ensure:
1. The derivation forest has **converged** (status = "converging" or "done")
2. At least one convergence point has been verified
3. All contributing branches have been recorded via `research_record_contribution`

## Behavior

### Step 1: Read the Derivation Forest

1. Call `research_get_forest(forest_id)` to retrieve the full forest state
2. Extract:
   - All **convergence_points** with `verification_status === "verified"`
   - For each point: the deep question Q, contributing nodes, literature references
   - All **contributions** with `level === "primary"`

### Step 2: Synthesize the Method Chapter

Based on the forest data, generate a LaTeX method chapter covering:

1. **Problem Formalization** — What is the deep problem Q being solved?
2. **Technical Approach** — How does the evolved code address Q?
3. **Key Mechanisms** — What are the primary contributions? (from converged branches)
4. **Relationship to Existing Methods** — How does this differ from related work?

### Step 3: Write to File

1. Determine output path: `<repo>/research/paper/sections/method.tex`
2. Call `research_get_forest` with the forest ID to get the repo path
3. Write the LaTeX content to the file
4. Call `bib_append` to add any new citations from the forest's literature references

## Output Format

```latex
\section{Method}
\label{sec:method}

\subsection{Problem Definition}
% Content addressing the deep motivation Q

\subsection{Technical Approach}
% How the evolved approach works

\subsection{Key Mechanisms}
% Primary contributions from converged branches

\subsection{Theoretical Analysis (if applicable)}
% Any formal guarantees or analysis
```

## Tool Usage

| Tool | Purpose |
|------|---------|
| `research_get_forest` | Read forest state (convergence points + contributions) |
| `bib_append` | Add/update BibTeX citations |
| `/ask-lit` | Fill in any missing background context |

## Output

Returns:
- Path to the written LaTeX file: `research/paper/sections/method.tex`
- Number of BibTeX entries appended
- A brief summary of the method chapter structure

## Pipeline Handoff

After writing the method chapter, invoke the next skill in the pipeline:

- `/write-experiment <forest_id>` — Experiments section (requires viz_generate figures)
- `/write-intro <forest_id>` — Introduction (requires contributions from Phase 3)
- `/write-related <forest_id>` — Related Work (requires evidence nodes with literature refs)
- `/paper-assemble --forest <forest_id>` — Assemble all sections into paper.tex

Do NOT call multiple write skills in parallel. Run them sequentially so each
chapter can reference the output of the previous one.
