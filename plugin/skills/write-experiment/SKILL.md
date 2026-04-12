---
name: write-experiment
description: "Generate the Experiments section with benchmark results, ablation studies, statistical analysis, and comparison with baselines."
---

# /write-experiment — Experiment Chapter Writing

> **D2: Experiment chapter generation** — transforms B-layer experiment results and
> figures into a comprehensive experimental section.

## Purpose

Read the B-layer experiment results (metrics, figures) and the C-layer forest
contributions, and generate a well-structured **Experiment** section in LaTeX format.

## Usage

```
/write-experiment <forest_id> [--venue <venue_name>]
```

Examples:
- `/write-experiment exp-2024-run-01 --venue NeurIPS`
- `/write-experiment my-forest --venue CVPR`

## Prerequisites

Before running this skill, ensure:
1. B-layer experiments have been executed and results collected
2. Viz figures have been generated — call `viz_generate` during Phase 2 Step 4 of
   `/research-loop` to generate ablation curves, score distributions, and contribution
   heatmaps before proceeding. If `research/figures/` is empty, generate them now:
   - Call `viz_generate` on each confirmed hypothesis
   - Call `viz_polish` for publication-quality rendering
   - Record the output paths for reference in the chapter
3. The forest has at least one contribution recorded

## Behavior

### Step 1: Gather Experiment Data

1. Read the forest: `research_get_forest(forest_id)` — get contributions and experiment nodes
2. Collect all experiment results:
   - Metrics from `bench_run` outputs
   - Figure paths from `viz_generate` outputs (stored in `research/figures/`)
   - Polished figures from `viz_polish` outputs
3. List all figures: check `research/figures/` directory
   - If no figures exist: call `viz_generate` now for ablation curves and main result plots
   - Call `viz_polish` on each figure before including in the chapter

### Step 2: Organize Results

Group results into categories:
- **Main Results** — primary performance comparisons
- **Ablation Studies** — contribution of individual components
- **Sensitivity Analysis** — robustness to hyperparameters
- **Additional Experiments** — any supplementary results

### Step 3: Synthesize the Experiment Chapter

Generate a LaTeX experiment chapter covering:

1. **Experimental Setup** — datasets, baselines, evaluation metrics, implementation details
2. **Main Results** — primary performance table/figure with comparisons to baselines and SOTA
3. **Ablation Studies** — breakdown of each contribution's impact
4. **Analysis** — interpretation of results, key insights, statistical significance

### Step 4: Write to File

1. Output path: `<repo>/research/paper/sections/experiment.tex`
2. Include figure references: `\includegraphics{../figures/<figure_name>.png}`
3. Call `bib_append` to add baseline method citations

## Output Format

```latex
\section{Experiments}
\label{sec:experiments}

\subsection{Experimental Setup}
% Datasets, metrics, baselines

\subsection{Main Results}
% Primary performance comparisons (include table/figure)

\subsection{Ablation Studies}
% Contribution breakdown

\subsection{Analysis}
% Key insights and interpretation
```

## Tool Usage

| Tool | Purpose |
|------|---------|
| `research_get_forest` | Read contributions and experiment nodes |
| `bib_append` | Add baseline/SOTA method citations |
| `/ask-lit` | Retrieve baseline method details from literature |
| `viz_generate` | Generate ablation curves, score distributions, contribution heatmaps |
| `viz_polish` | Polish figures for publication quality before including in chapter |

## Output

Returns:
- Path to the written LaTeX file: `research/paper/sections/experiment.tex`
- List of included figures
- Number of BibTeX entries appended

## Pipeline Handoff

After writing the experiment chapter, invoke the next skill in the pipeline:

- `/write-intro <forest_id>` — Introduction (requires contributions from Phase 3)
- `/write-related <forest_id>` — Related Work (requires evidence nodes with literature refs)
- `/paper-assemble --forest <forest_id>` — Assemble all sections into paper.tex

Do NOT call multiple write skills in parallel. Run them sequentially so each
chapter can reference the output of the previous one.
