# Lineage Plot Scripts

This document explains how to use:

- `plot_lineage_2d_png.py`
- `plot_lineage_3d_png.py`

Both scripts read an evolution state JSON file (for example `state(2).json`) and generate PNG figures for branch-lineage analysis.

## 1) Requirements

Install Python dependency:

```bash
pip install matplotlib
```

## 2) Input Data

Both scripts expect a JSON with this structure (key fields):

- `individuals`
  - branch id
  - `generation`
  - `fitness` (runtime in ms)
  - `parent_branches`

## 3) `plot_lineage_2d_png.py`

### Purpose

Generate a single 2D lineage plot:

- x-axis: branch lane
- y-axis: generation
- node color: runtime (ms)

### Basic usage

```bash
python plot_lineage_2d_png.py --state "state(2).json" --out "lineage_2d.png"
```

### Arguments

- `--state` path to state JSON (default: `state(2).json`)
- `--out` output PNG path (default: `lineage_2d.png`)
- `--color-mode` `linear` or `log` (default: `log`)
- `--clip-low` lower percentile for color clipping (default: `5`)
- `--clip-high` upper percentile for color clipping (default: `95`)
- `--fig-width` figure width in inches (default: `9.0`)
- `--fig-height` figure height in inches (default: `11.0`)

### Example (custom settings)

```bash
python plot_lineage_2d_png.py --state "state(2).json" --out "lineage_2d_custom.png" --color-mode log --clip-low 2 --clip-high 98 --fig-width 10 --fig-height 12
```

## 4) `plot_lineage_3d_png.py`

### Purpose

This script currently exports **three 2D projections** split from the lineage view:

1. generation vs branch lane
2. generation vs runtime (log scale)
3. branch lane vs runtime (log scale)

Runtime axes use fixed major ticks:

- `10^-2`, `10^-1`, `10^0`, `10^1`, `10^2`

and only major grids are shown.

### Basic usage

```bash
python plot_lineage_3d_png.py --state "state(2).json" --out-prefix "lineage_2d"
```

### Arguments

- `--state` path to state JSON (default: `state(2).json`)
- `--out-prefix` output prefix (default: `lineage_2d`)

### Output files

With `--out-prefix "lineage_2d"`, outputs are:

- `lineage_2d_gen_lane.png`
- `lineage_2d_gen_runtime.png`
- `lineage_2d_lane_runtime.png`

## 5) Typical Workflow

```bash
python plot_lineage_2d_png.py --state "state(2).json" --out "lineage_2d.png"
python plot_lineage_3d_png.py --state "state(2).json" --out-prefix "lineage_2d"
```

## 6) Notes

- In this project, `fitness` is interpreted as runtime in milliseconds.
- For log-scale plotting, runtime values must be positive.
- If your JSON has missing or non-numeric runtime values, those points/edges are skipped automatically.
