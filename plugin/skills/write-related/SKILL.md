---
name: write-related
description: "Generate the Related Work section by surveying existing approaches and positioning the paper's contributions relative to the literature."
---

# /write-related — Related Work Chapter Writing

> **D3: Related work chapter generation** — synthesizes literature from A-layer
> searches into a structured related work section.

## Purpose

Read the literature gathered during the C-layer derivation process (evidence nodes
with literature references) and the A-layer search results, then generate a
well-structured **Related Work** section in LaTeX format.

## Usage

```
/write-related <forest_id> [--venue <venue_name>]
```

Examples:
- `/write-related exp-2024-run-01 --venue NeurIPS`
- `/write-related my-forest --venue ICML`

## Prerequisites

Before running this skill, ensure:
1. A-layer literature searches have been performed during research loop
2. Evidence nodes in the forest have `literature_refs` populated
3. `research/refs/references.bib` contains the relevant BibTeX entries

## Behavior

### Step 1: Gather Literature

1. Read the forest: `research_get_forest(forest_id)`
2. Extract all evidence nodes with `literature_refs`
3. Collect all unique BibTeX keys from the forest
4. Read `research/refs/references.bib` for the full bibliography

### Step 2: Organize by Theme

Group related papers into themes/clusters:

- **Foundational Work** — papers that established the problem area
- **Directly Related** — papers addressing the same/similar problem (the deep motivation Q)
- **Technical Precursors** — papers that proposed the mechanisms used in this work
- **Alternative Approaches** — methods that address similar goals differently
- **Evolutionary Computation in ML** — other work combining evolution with ML

### Step 3: Synthesize the Related Work Chapter

Generate a LaTeX related work chapter with structured discussions:

1. **Foundations** — background and context for the problem
2. **Prior Work on [Deep Motivation Q]** — what's been done on the core problem
3. **Key Mechanisms in Literature** — prior work on specific techniques
4. **Positioning** — where this work fits relative to the literature

### Step 4: Write to File

1. Output path: `<repo>/research/paper/sections/related.tex`
2. Use BibTeX citations: `\cite{<key>}`, `\citep{<key>}`, `\citet{<key>}`
3. Ensure all cited papers have entries in `research/refs/references.bib`
4. Call `bib_append` to fill in any missing references

## Output Format

```latex
\section{Related Work}
\label{sec:related}

% Organized by theme, using \citep{}, \citet{} citations
\subsection{Background and Foundations}
% Foundational work

\subsection{Prior Work on [Core Problem]}
% Papers addressing the deep motivation Q

\subsection{Related Techniques}
% Prior work on specific mechanisms

\subsection{Distinction from Prior Work}
% How this work differs from the literature
```

## Tool Usage

| Tool | Purpose |
|------|---------|
| `research_get_forest` | Read evidence nodes and literature references |
| `bib_append` | Add missing BibTeX entries to references.bib |
| `/ask-lit` | Search for additional related work if needed |

## Output

Returns:
- Path to the written LaTeX file: `research/paper/sections/related.tex`
- Number of papers cited
- Number of BibTeX entries appended

## Pipeline Handoff

After writing the related work chapter, invoke the next skill in the pipeline:

- `/paper-assemble --forest <forest_id>` — Assemble all sections into paper.tex

Do NOT call multiple write skills in parallel. Run them sequentially so each
chapter can reference the output of the previous one.
