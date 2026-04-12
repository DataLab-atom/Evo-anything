---
name: write-intro
description: "Generate the Introduction section of an academic paper from the C-layer derivation forest's convergence points and contributions. Outputs LaTeX format."
---

# /write-intro — Introduction Chapter Writing

> **D4: Introduction chapter generation** — transforms the deep motivation Q and contribution
> list into a compelling introduction for an academic paper.

## Purpose

Read the C-layer derivation forest's convergence points (deep motivation Q) and
contributions, and generate a well-structured **Introduction** section in LaTeX format.

## Usage

```
/write-intro <forest_id> [--venue <venue_name>]
```

Examples:
- `/write-intro exp-2024-run-01 --venue NeurIPS`
- `/write-intro my-forest --venue ICML`

## Prerequisites

Before running this skill, ensure:
1. The derivation forest has at least one convergence point
2. Contributions have been recorded (primary and auxiliary)
3. You know the target conference/journal (for appropriate framing)

## Behavior

### Step 1: Gather Content

1. Read the forest: `research_get_forest(forest_id)`
2. Extract:
   - **Convergence points** — the deep motivation Q(s) driving the research
   - **Primary contributions** — what makes this work novel
   - **Auxiliary contributions** — additional benefits
   - **Evidence nodes** — supporting context
3. Identify the **gap** — what problem exists that this work addresses

### Step 2: Structure the Introduction

Follow the standard academic introduction structure:

1. **Opening / Hook** — Start with the broader problem area and its importance
2. **Problem Statement** — Describe the specific challenge or limitation
3. **Existing Approaches and Their Limitations** — What's been tried and why it falls short
4. **Proposed Approach** — How this work addresses the gap (from deep motivation Q)
5. **Key Contributions** — Numbered list of primary contributions
6. **Additional Benefits** — Auxiliary contributions
7. **Broader Impact** (optional) — Wider implications of the work
8. **Paper Structure** — Brief roadmap of the remaining sections

### Step 3: Generate LaTeX Content

Draft the introduction in academic prose:
- Use formal academic language
- Build a logical narrative from problem to solution
- Clearly articulate what makes this work novel
- Be specific about contributions (not generic claims)

### Step 4: Write to File

1. Output path: `<repo>/research/paper/sections/intro.tex`
2. Include contribution list as a numbered list or bullet points
3. No BibTeX citations needed in introduction (typically)

## Output Format

```latex
\section{Introduction}
\label{sec:intro}

% Opening: broader context and importance
% Problem: specific challenge addressed
% Limitations: why existing approaches fall short
% Approach: proposed solution (from deep motivation Q)
% Contributions: numbered list of key contributions
% Paper structure: roadmap of remaining sections
```

## Contribution List Generation

From the forest, extract and format contributions:

```latex
The main contributions of this paper are:
\begin{itemize}
  \item We identify and formalize [deep motivation Q] as a key problem...
  \item We propose [novel mechanism] which achieves [improvement]...
  \item We demonstrate through extensive experiments that [result]...
\end{itemize}
```

## Tool Usage

| Tool | Purpose |
|------|---------|
| `research_get_forest` | Read convergence points and contributions |
| `/ask-lit` | Look up existing problem framing in literature (optional) |

## Output

Returns:
- Path to the written LaTeX file: `research/paper/sections/intro.tex`
- Number of contributions listed
- Brief summary of the introduction narrative

## Pipeline Handoff

After writing the introduction, invoke the next skill in the pipeline:

- `/write-related <forest_id>` — Related Work (requires evidence nodes with literature refs)
- `/paper-assemble --forest <forest_id>` — Assemble all sections into paper.tex

Do NOT call multiple write skills in parallel. Run them sequentially so each
chapter can reference the output of the previous one.
