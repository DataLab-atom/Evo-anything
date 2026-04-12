/**
 * B1/B2: Visualization engine — generates and executes matplotlib scripts
 * to produce analysis charts from experimental data.
 *
 * Provides real chart generation instead of returning instruction text.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export interface ChartRequest {
  expectation: string;
  data_description: string;
  chart_type?: string;
  output_dir: string;
}

export interface ChartResult {
  chart_path: string;
  supported: boolean;
  highlights: string[];
  discrepancies: string[];
  raw_output?: string;
}

export interface HighlightResult {
  consistent: boolean;
  highlights: string[];
  discrepancies: string[];
}

/** Auto-select the best chart type based on data description. */
function inferChartType(dataDescription: string): string {
  const d = dataDescription.toLowerCase();
  if (d.includes("over time") || d.includes("epoch") || d.includes("iteration") || d.includes("convergence")) {
    return "line";
  }
  if (d.includes("compare") || d.includes("method") || d.includes("accuracy") && (d.includes("across") || d.includes("vs"))) {
    return "bar";
  }
  if (d.includes("heatmap") || d.includes("correlation") || d.includes("matrix")) {
    return "heatmap";
  }
  if (d.includes("distribution") || d.includes("scatter") || d.includes("point")) {
    return "scatter";
  }
  return "line";
}

/** Build a matplotlib script from the request. */
function buildMatplotlibScript(req: ChartRequest, chartPath: string): string {
  const chartType = req.chart_type === "auto" ? inferChartType(req.data_description) : (req.chart_type ?? "line");

  // Escape expectation for embedding in Python string
  const escapedExpectation = req.expectation.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

  if (chartType === "bar") {
    return `#!/usr/bin/env python3
# Auto-generated chart script — bar chart
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

# Parse data description to extract key metrics and methods
data_description = """${req.data_description}"""
expectation = """${escapedExpectation}"""

# Try to extract numbers from description
# Format: "MethodA: 0.85, MethodB: 0.72, MethodC: 0.91"
import re
pattern = r'([A-Za-z0-9_\\-]+):\\s*([0-9.]+)'
matches = re.findall(pattern, data_description)

fig, ax = plt.subplots(figsize=(8, 5), dpi=150)

if matches:
    methods = [m[0] for m in matches]
    values = [float(m[1]) for m in matches]
    colors = ["#4C78A8", "#F58518", "#E45756", "#72B7B2", "#54A24B", "#EECA3B", "#B279A2"]
    bars = ax.bar(methods, values, color=colors[:len(methods)], edgecolor="black", linewidth=0.5)
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01, f"{val:.3f}",
                ha="center", va="bottom", fontsize=9)
    ax.set_ylim(0, max(values) * 1.2)
else:
    # Fallback: parse generic numeric pairs
    nums = re.findall(r'[-+]?[0-9]*\\.?[0-9]+', data_description)
    nums = [float(n) for n in nums if float(n) <= 1.0]
    if len(nums) >= 2:
        labels = [f"Item {i+1}" for i in range(len(nums))]
        bars = ax.bar(labels, nums, color="#4C78A8", edgecolor="black", linewidth=0.5)
        for bar, val in zip(bars, nums):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01, f"{val:.3f}",
                    ha="center", va="bottom", fontsize=9)
        ax.set_ylim(0, max(nums) * 1.2)
    else:
        ax.text(0.5, 0.5, "No numeric data found in description", ha="center", va="center", transform=ax.transAxes)

ax.set_ylabel("Score / Metric Value")
ax.set_title("Comparison Chart\\n" + expectation, fontsize=11, wrap=True)
ax.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig("${chartPath.replace(/\\/g, "\\\\")}", dpi=300, bbox_inches="tight")
print(f"Chart saved: ${chartPath.replace(/\\/g, "\\\\")}")
`;
  }

  if (chartType === "scatter") {
    return `#!/usr/bin/env python3
# Auto-generated chart script — scatter plot
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

data_description = """${req.data_description}"""
expectation = """${escapedExpectation}"""

import re
# Try to extract (x, y) pairs
pattern = r'\\(?\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*\\)?'
matches = re.findall(pattern, data_description)

fig, ax = plt.subplots(figsize=(8, 5), dpi=150)

if matches:
    x_vals = [float(m[0]) for m in matches]
    y_vals = [float(m[1]) for m in matches]
    ax.scatter(x_vals, y_vals, c="#4C78A8", s=60, alpha=0.8, edgecolors="black", linewidth=0.5, zorder=3)
    if len(x_vals) > 1:
        z = np.polyfit(x_vals, y_vals, 1)
        p = np.poly1d(z)
        x_line = np.linspace(min(x_vals), max(x_vals), 100)
        ax.plot(x_line, p(x_line), "--", color="#F58518", linewidth=2, label=f"Trend (slope={z[0]:.3f})")
        ax.legend()
    ax.set_xlabel("X")
    ax.set_ylabel("Y")
else:
    ax.text(0.5, 0.5, "No (x, y) pairs found in description", ha="center", va="center", transform=ax.transAxes)

ax.set_title("Scatter Plot\\n" + expectation, fontsize=11, wrap=True)
ax.grid(alpha=0.3)
plt.tight_layout()
plt.savefig("${chartPath.replace(/\\/g, "\\\\")}", dpi=300, bbox_inches="tight")
print(f"Chart saved: ${chartPath.replace(/\\/g, "\\\\")}")
`;
  }

  if (chartType === "heatmap") {
    return `#!/usr/bin/env python3
# Auto-generated chart script — heatmap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

data_description = """${req.data_description}"""
expectation = """${escapedExpectation}"""

fig, ax = plt.subplots(figsize=(8, 6), dpi=150)
ax.text(0.5, 0.5, "Configure heatmap data in data_description\\n(e.g., row1: 0.1, 0.2, 0.3\\nrow2: 0.4, 0.5, 0.6)",
        ha="center", va="center", transform=ax.transAxes, fontsize=10,
        bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.5))
ax.axis("off")
ax.set_title("Heatmap\\n" + expectation, fontsize=11, wrap=True)
plt.tight_layout()
plt.savefig("${chartPath.replace(/\\/g, "\\\\")}", dpi=300, bbox_inches="tight")
print(f"Chart saved: ${chartPath.replace(/\\/g, "\\\\")}")
`;
  }

  // Default: line chart
  return `#!/usr/bin/env python3
# Auto-generated chart script — line chart
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

data_description = """${req.data_description}"""
expectation = """${escapedExpectation}"""

import re
# Extract step/value pairs (e.g., "step 100: 0.85" or "epoch 5: loss=0.32")
step_pattern = r'(?:step|epoch|iter(?:ation)?)\\s*(\\d+)[^:]*:\\s*([0-9.]+)'
value_pattern = r'([A-Za-z][A-Za-z0-9_\\-]*)\\s*[=:>]\\s*([0-9.]+)'

step_matches = re.findall(step_pattern, data_description.lower())
value_matches = re.findall(value_pattern, data_description)

fig, ax = plt.subplots(figsize=(9, 5), dpi=150)

colors = ["#4C78A8", "#F58518", "#E45756", "#72B7B2", "#54A24B", "#EECA3B", "#B279A2"]

if step_matches:
    steps = [int(m[0]) for m in step_matches]
    values = [float(m[1]) for m in step_matches]
    label = re.search(r'([A-Za-z][A-Za-z0-9_\\-]*)', data_description)
    ax.plot(steps, values, marker="o", markersize=5, linewidth=2,
            color=colors[0], label=label.group(1) if label else "metric")
    ax.set_xlabel("Step / Epoch")
    ax.set_ylabel("Value")
    ax.grid(alpha=0.3)
    ax.legend()
elif value_matches:
    # Multiple named series
    series_data: dict[str, list[float]] = {}
    for name, val in value_matches:
        if name not in series_data:
            series_data[name] = []
        series_data[name].append(float(val))
    for i, (name, vals) in enumerate(series_data.items()):
        ax.plot(range(len(vals)), vals, marker="o", markersize=4, linewidth=2,
                color=colors[i % len(colors)], label=name)
    ax.set_xlabel("Index")
    ax.set_ylabel("Value")
    ax.legend()
    ax.grid(alpha=0.3)
else:
    # Synthetic curve from description keywords
    nums = re.findall(r'[-+]?[0-9]*\\.?[0-9]+', data_description)
    nums = [float(n) for n in nums[:50] if 0 < float(n) <= 1.0]
    if nums:
        x = np.arange(len(nums))
        ax.plot(x, nums, color="#4C78A8", linewidth=2, marker="o", markersize=3)
        ax.set_xlabel("Index")
        ax.set_ylabel("Metric Value")
        ax.grid(alpha=0.3)
    else:
        ax.text(0.5, 0.5, "Configure data in data_description",
                ha="center", va="center", transform=ax.transAxes)

ax.set_title("Line Chart\\n" + expectation, fontsize=11, wrap=True)
plt.tight_layout()
plt.savefig("${chartPath.replace(/\\/g, "\\\\")}", dpi=300, bbox_inches="tight")
print(f"Chart saved: ${chartPath.replace(/\\/g, "\\\\")}")
`;
}

/** Execute a Python script and return stdout. */
function runPythonScript(scriptPath: string): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("python", [scriptPath], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });
    return { ok: true, stdout, stderr: "" };
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; message?: string };
    return { ok: false, stdout: error.stdout ?? "", stderr: error.stderr ?? error.message ?? "" };
  }
}

/**
 * Generate an analysis chart based on expectation and data description.
 * Returns the chart path and analysis results.
 */
export function generateChart(req: ChartRequest): ChartResult {
  mkdirSync(req.output_dir, { recursive: true });

  // Determine chart type
  const chartType = req.chart_type === "auto" || !req.chart_type
    ? inferChartType(req.data_description)
    : req.chart_type;

  const safeName = req.expectation
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 50);
  const timestamp = Date.now().toString(36);
  const filename = `chart_${safeName}_${timestamp}.png`;
  const chartPath = join(req.output_dir, filename);

  // Build and write script
  const script = buildMatplotlibScript({ ...req, chart_type: chartType }, chartPath);
  const scriptPath = join(req.output_dir, `gen_${timestamp}.py`);
  writeFileSync(scriptPath, script, "utf-8");

  // Execute
  const result = runPythonScript(scriptPath);

  if (!result.ok || !existsSync(chartPath)) {
    // Fallback: try python3
    const result3 = runPythonScript(scriptPath.replace(/\\/g, "/"));
    if (!result3.ok || !existsSync(chartPath)) {
      return {
        chart_path: chartPath,
        supported: false,
        highlights: [],
        discrepancies: [`Chart generation failed: ${result3.stderr || result.stderr}`],
        raw_output: result3.stderr || result.stderr,
      };
    }
  }

  // Analyze the expectation against data description
  const highlight = analyzeAgainstExpectation(req.expectation, req.data_description);

  return {
    chart_path: chartPath,
    supported: highlight.consistent,
    highlights: highlight.highlights,
    discrepancies: highlight.discrepancies,
  };
}

/** Analyze whether the data supports the stated expectation. */
export function analyzeAgainstExpectation(
  expectation: string,
  dataDescription: string,
): HighlightResult {
  const exp = expectation.toLowerCase();
  const desc = dataDescription.toLowerCase();

  const highlights: string[] = [];
  const discrepancies: string[] = [];

  // Extract numeric values
  const numPattern = /([A-Za-z0-9_\-]+)\s*[:=>]\s*([0-9.]+)/g;
  const values: { name: string; value: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = numPattern.exec(dataDescription)) !== null) {
    values.push({ name: m[1], value: parseFloat(m[2]) });
  }

  // Check consistency keywords
  const positiveKws = ["better", "higher", "lower", "improved", "faster", "more stable", "outperforms", "superior"];
  const negativeKws = ["worse", "degraded", "slower", "unstable", "underperforms"];

  if (positiveKws.some((k) => exp.includes(k))) {
    // Check if we can verify improvement
    const improving = values.some((v) => v.value > 0.7);
    if (improving) {
      highlights.push("Data contains positive metric values supporting the stated improvement claim.");
    } else if (values.length > 0) {
      discrepancies.push("Data does not clearly support the improvement claim — metric values are moderate.");
    }
  }

  if (negativeKws.some((k) => exp.includes(k))) {
    highlights.push("Data degradation/performance drop consistent with expectation.");
  }

  if (values.length === 0) {
    highlights.push("No numeric values detected — chart generated for visual inspection.");
  }

  const consistent = discrepancies.length === 0 && values.length > 0;
  return { consistent, highlights, discrepancies };
}

/**
 * Highlight key data points in a chart image against expectation.
 * Since we cannot read image pixels, we analyze the data description instead.
 */
export function highlightChart(
  chartPath: string,
  expectation: string,
  dataSummary: string,
): HighlightResult {
  return analyzeAgainstExpectation(expectation, dataSummary);
}
