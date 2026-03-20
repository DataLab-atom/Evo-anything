# Runtime Plot Scripts

This folder contains plotting scripts for generating paper-style runtime figures from the evolutionary search results.

## Files

### `plot_best_runtime.py`
Draws the overall runtime progress across generations.

- **Input**: `state.json` or `state(2).json`
- **Output**: a figure showing:
  - the **seed baseline runtime**
  - the **best runtime in each generation**
  - the **best-so-far runtime across generations**

This plot is used to show the overall optimization trend and how quickly the search improves over the baseline.

---

### `plot_per_target_runtime.py`
Draws per-target runtime progress across generations.

- **Input**: `state.json` or `state(2).json`
- **Output**: a figure showing the best runtime in each generation for each optimization target, such as:
  - pruning
  - nearest neighbor
  - 2-opt
  - cache distances

This plot is used to compare how different optimization targets contribute to runtime improvement.

## Notes

- These scripts are intended for generating **paper-style figures**.
- The x-axis is **generation**, not training epoch.
- The figures are saved as `.png` files in the same project folder.
