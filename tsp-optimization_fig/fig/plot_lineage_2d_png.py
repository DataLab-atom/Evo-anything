import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm, Normalize


def load_rows(state_path: Path):
    with state_path.open("r", encoding="utf-8") as f:
        state = json.load(f)

    rows = []
    for branch, info in state.get("individuals", {}).items():
        fitness = (info.get("fitness") or [None])[0]
        parent = (info.get("parent_branches") or [None])[0]
        rows.append(
            {
                "branch": branch,
                "generation": info.get("generation", 0),
                "target_id": info.get("target_id", "unknown"),
                "operation": info.get("operation", "unknown"),
                "runtime_ms": fitness,
                "parent": parent,
                "timestamp": info.get("timestamp", 0),
            }
        )

    rows.sort(key=lambda r: (r["generation"], r["timestamp"], r["branch"]))
    return rows


def assign_y_positions(rows):
    by_gen = defaultdict(list)
    for r in rows:
        by_gen[r["generation"]].append(r)

    y_pos = {}
    for gen in sorted(by_gen):
        bucket = by_gen[gen]
        bucket.sort(
            key=lambda r: (
                not isinstance(r["runtime_ms"], (int, float)),
                r["runtime_ms"] if isinstance(r["runtime_ms"], (int, float)) else math.inf,
                r["branch"],
            )
        )
        n = len(bucket)
        for idx, r in enumerate(bucket):
            y_pos[r["branch"]] = idx - (n - 1) / 2.0
    return y_pos


def percentile(values, p):
    if not values:
        return None
    vals = sorted(values)
    if p <= 0:
        return vals[0]
    if p >= 100:
        return vals[-1]
    k = (len(vals) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return vals[int(k)]
    return vals[f] + (vals[c] - vals[f]) * (k - f)


def plot_2d(
    rows,
    out_path: Path,
    color_mode: str,
    clip_low: float,
    clip_high: float,
    fig_width: float,
    fig_height: float,
):
    y_pos = assign_y_positions(rows)

    points = [r for r in rows if isinstance(r["runtime_ms"], (int, float))]
    if not points:
        raise ValueError("No numeric runtime values found in state JSON")

    runtimes = [r["runtime_ms"] for r in points]
    vmin = percentile(runtimes, clip_low)
    vmax = percentile(runtimes, clip_high)
    if vmin is None or vmax is None:
        raise ValueError("Failed to compute color normalization range")
    if vmax <= vmin:
        vmin, vmax = min(runtimes), max(runtimes)

    if color_mode == "log":
        positive = [x for x in runtimes if x > 0]
        if not positive:
            raise ValueError("Log color mode requires positive runtime values")
        vmin = max(vmin, min(positive))
        norm = LogNorm(vmin=vmin, vmax=max(vmax, vmin * 1.01))
    else:
        norm = Normalize(vmin=vmin, vmax=vmax)

    cmap = plt.get_cmap("turbo")

    fig, ax = plt.subplots(figsize=(fig_width, fig_height), dpi=150)

    # Edges
    row_by_branch = {r["branch"]: r for r in rows}
    for r in rows:
        p = r["parent"]
        c = r["branch"]
        if p is None or p not in row_by_branch:
            continue
        rp = row_by_branch[p]
        if not isinstance(rp["runtime_ms"], (int, float)) or not isinstance(r["runtime_ms"], (int, float)):
            continue
        ax.plot(
            [y_pos[p], y_pos[c]],
            [rp["generation"], r["generation"]],
            color=(0.55, 0.55, 0.55, 0.45),
            linewidth=0.9,
            zorder=1,
        )

    # Nodes (color depth = runtime)
    xs = [y_pos[r["branch"]] for r in points]
    ys = [r["generation"] for r in points]
    cs = [r["runtime_ms"] for r in points]
    sc = ax.scatter(xs, ys, c=cs, cmap=cmap, norm=norm, s=42, edgecolors="none", zorder=2)

    cbar = fig.colorbar(sc, ax=ax, fraction=0.03, pad=0.02)
    if color_mode == "log":
        cbar.set_label("Runtime (ms, log scale)")
    else:
        cbar.set_label("Runtime (ms)")

    ax.set_xlabel("Branch lane")
    ax.set_ylabel("Generation")
    ax.invert_yaxis()
    ax.grid(alpha=0.18, linewidth=0.6)

    fig.subplots_adjust(left=0.04, right=0.97, bottom=0.07, top=0.98)
    fig.savefig(out_path, bbox_inches="tight", pad_inches=0.03)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description="Plot 2D branch lineage with runtime color depth")
    parser.add_argument("--state", default="state(2).json", help="Path to state JSON")
    parser.add_argument("--out", default="lineage_2d.png", help="Output PNG path")
    parser.add_argument(
        "--color-mode",
        choices=["linear", "log"],
        default="log",
        help="Color normalization mode (default: log)",
    )
    parser.add_argument(
        "--clip-low",
        type=float,
        default=5.0,
        help="Lower percentile for color clipping (default: 5)",
    )
    parser.add_argument(
        "--clip-high",
        type=float,
        default=95.0,
        help="Upper percentile for color clipping (default: 95)",
    )
    parser.add_argument("--fig-width", type=float, default=9.0, help="Figure width in inches")
    parser.add_argument("--fig-height", type=float, default=11.0, help="Figure height in inches")
    args = parser.parse_args()

    rows = load_rows(Path(args.state))
    if not rows:
        raise ValueError("No individuals found in state JSON")

    if not (0 <= args.clip_low < args.clip_high <= 100):
        raise ValueError("clip percentiles must satisfy 0 <= clip-low < clip-high <= 100")

    plot_2d(
        rows,
        Path(args.out),
        args.color_mode,
        args.clip_low,
        args.clip_high,
        args.fig_width,
        args.fig_height,
    )
    print(f"Done: {Path(args.out).resolve()}")


if __name__ == "__main__":
    main()
