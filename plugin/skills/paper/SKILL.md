---
name: paper
description: "Generate a research paper from evolution results"
---

# /paper — Generate Research Paper

User provides: target venue (e.g. "NeurIPS 2026"), and optionally iteration control parameters.

## User-configurable parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `venue` | Yes | — | Target venue name (e.g. "NeurIPS 2026", "ICML 2026") |
| `max_iterations` | No | 10 | Max derivation forest iterations before forced convergence |
| `max_active_branches` | No | 6 | Max concurrent derivation branches |
| `max_experiments_per_iteration` | No | 3 | Max B-layer experiments per C-layer iteration |
| `convergence_patience` | No | 3 | Force convergence after this many stagnant iterations |

## Prerequisites

- A completed evolution run (i.e. `best-overall` tag exists, `evo_get_status()` returns results)
- `pdflatex` + `bibtex` installed (for D6 compilation)
- `memory-lancedb` extension enabled (for A2/F2 local literature search)

## Step 1 — Validate evolution results

Verify that evolution has completed and results are available:

```
status = evo_get_status()
assert status.best_branch_overall is not None
assert git tag "best-overall" exists
```

Collect inputs for C layer:
- Best branch code: `git checkout best-overall`
- Fitness values: `status.best_obj_overall`
- Evolution lineage: `evo_get_lineage(status.best_branch_overall)`
- Evolution memory: read `memory/` directory

Present summary to user and ask for confirmation:

```
"Evolution results:
  Best branch: {best_branch} ({fitness_values})
  Targets: {target_list}
  Generations: {generation_count}

Write paper for {venue}? (y/n)"
```

## Step 2 — Initialize paper directory

Create `paper/` directory structure in the repo:

```
paper/
├── derivation_forest.json    ← C layer output (initially empty)
├── literature_graph.json     ← C layer output (initially empty)
├── motivation.md             ← C layer output (initially empty)
├── references.bib            ← F3 managed, D6 consumed
├── literature/               ← A2/F2 local literature store
│   └── .lancedb/             ← vector index
├── figures/                  ← B1/B3 generated figures
└── latex/                    ← D layer workspace
    ├── main.tex
    ├── method.tex
    ├── experiments.tex
    ├── related_work.tex
    ├── introduction.tex
    ├── abstract.tex
    ├── conclusion.tex
    └── appendix.tex
```

Commit initial structure to git.

## Step 3 — C layer: Derivation forest (research verification loop)

Drive the C layer derivation forest loop. This is the core research phase.

Each iteration:
1. Call **A5** for structured diff analysis of evolution changes
2. Construct/extend derivation tree nodes (hypotheses for why changes work)
3. Call **A4** to search literature for theoretical grounding
4. Call **B0** to design verification experiments, then **B4–B6** to execute
5. Check for branch convergence

Terminate when any hard stop triggers (see 05_a_layer_knowledge_qa.md § Iteration Control).

After convergence or forced stop:
- Write `paper/derivation_forest.json`
- Write `paper/literature_graph.json`
- Write `paper/motivation.md`

Present C layer results to user:

```
"Derivation forest complete ({iteration_count} iterations):
  Deep motivation: {motivation_summary}
  Primary contributions: {primary_count}
  Auxiliary contributions: {auxiliary_count}
  Experiments run: {experiment_count}
  Literature cited: {citation_count}

Proceed to paper writing? (y/n)"
```

## Step 4 — D layer: Paper writing

Follow D0–D6 sequence from 05_a_layer_knowledge_qa.md:

1. **D0**: Initialize LaTeX skeleton (call A4 for venue template)
2. **D1–D4**: Spawn 4 parallel writing agents:
   ```
   sessions_spawn agentId:paper_d1_method
   sessions_spawn agentId:paper_d2_experiments
   sessions_spawn agentId:paper_d3_related_work
   sessions_spawn agentId:paper_d4_introduction
   ```
   Wait for all 4 to complete.
3. **D5**: Write abstract + conclusion (depends on D1–D4 output)
4. **D6**: Compile PDF → trigger E2 consistency mini-loop

## Step 5 — E layer: Review (DECB super loop)

Run E1–E8 review tools on the compiled PDF.

- All pass → output final PDF
- Failures → route back per DECB rules:
  - Surface issues (E1/E4/E5/E6/E7/E8) → back to D layer
  - Content issues (E2/E3) → back to C layer
  - Experiment gaps (E3 → C → B) → C designs, B executes

Loop until E passes or "问题数量连续两轮未减少" → ask user to intervene.

## Step 6 — Output

Present final results:

```
"Paper complete:
  PDF: paper/latex/main.pdf
  Pages: {page_count}
  Figures: {figure_count}
  References: {reference_count}
  DECB rounds: {decb_round_count}

Review the PDF and provide feedback, or /paper is done."
```

Commit all paper artifacts to git.
