import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import NullLocator


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
                "fitness": fitness,
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

    max_count = max((len(v) for v in by_gen.values()), default=1)
    global_slots = [i - (max_count - 1) / 2.0 for i in range(max_count)]

    positions = {}
    for gen in sorted(by_gen):
        bucket = by_gen[gen]
        bucket.sort(
            key=lambda r: (
                not isinstance(r["fitness"], (int, float)),
                r["fitness"] if isinstance(r["fitness"], (int, float)) else math.inf,
                r["branch"],
            )
        )
        n = len(bucket)
        start = (max_count - n) // 2
        for idx, r in enumerate(bucket):
            y = global_slots[start + idx]
            positions[r["branch"]] = y
    return positions


def set_runtime_log_axis(ax, min_fit: float, max_fit: float):
    ax.set_yscale("log")
    ax.set_ylim(min_fit, max_fit)
    ticks = [10**e for e in (-2, -1, 0, 1, 2)]
    ax.set_yticks(ticks)
    ax.set_yticklabels([r"$10^{-2}$", r"$10^{-1}$", r"$10^{0}$", r"$10^{1}$", r"$10^{2}$"])
    ax.yaxis.set_minor_locator(NullLocator())


def plot_2d_views(rows, out_prefix: Path):
    y_pos = assign_y_positions(rows)
    valid_fitness = [r["fitness"] for r in rows if isinstance(r["fitness"], (int, float)) and r["fitness"] > 0]
    if not valid_fitness:
        raise ValueError("No positive runtime values found for log scale")
    min_fit = min(valid_fitness)
    max_fit = max(valid_fitness)

    by_branch = {r["branch"]: r for r in rows}

    targets = sorted({r["target_id"] for r in rows})
    cmap = plt.get_cmap("tab10")
    color_map = {t: cmap(i % 10) for i, t in enumerate(targets)}

    edges = []
    for r in rows:
        p = r["parent"]
        c = r["branch"]
        if p is None:
            continue
        parent_row = by_branch.get(p)
        if parent_row is None:
            continue

        p_fit = parent_row["fitness"] if isinstance(parent_row["fitness"], (int, float)) else float("nan")
        c_fit = r["fitness"] if isinstance(r["fitness"], (int, float)) else float("nan")
        if math.isnan(p_fit) or math.isnan(c_fit):
            continue
        if p_fit <= 0 or c_fit <= 0:
            continue

        edges.append(
            {
                "x0": parent_row["generation"],
                "x1": r["generation"],
                "y0": y_pos[p],
                "y1": y_pos[c],
                "r0": p_fit,
                "r1": c_fit,
            }
        )

    output_paths = []

    # 1) generation vs branch lane
    fig1, ax1 = plt.subplots(figsize=(14, 8), dpi=150)
    for e in edges:
        ax1.plot([e["x0"], e["x1"]], [e["y0"], e["y1"]], color=(0.55, 0.55, 0.55, 0.55), linewidth=1.0)

    for target in targets:
        subset = [r for r in rows if r["target_id"] == target and isinstance(r["fitness"], (int, float)) and r["fitness"] > 0]
        if not subset:
            continue
        xs = [r["generation"] for r in subset]
        ys = [y_pos[r["branch"]] for r in subset]
        ax1.scatter(xs, ys, s=35, alpha=0.95, color=color_map[target], label=target)

    ax1.set_xlabel("Generation")
    ax1.set_ylabel("Branch lane")
    ax1.grid(alpha=0.25)
    ax1.legend(loc="upper right", fontsize=8)
    fig1.subplots_adjust(left=0.08, right=0.98, bottom=0.10, top=0.98)
    out1 = out_prefix.with_name(out_prefix.name + "_gen_lane.png")
    fig1.savefig(out1, bbox_inches="tight", pad_inches=0.04)
    plt.close(fig1)
    output_paths.append(out1)

    # 2) generation vs runtime
    fig2, ax2 = plt.subplots(figsize=(14, 8), dpi=150)
    for e in edges:
        ax2.plot([e["x0"], e["x1"]], [e["r0"], e["r1"]], color=(0.55, 0.55, 0.55, 0.55), linewidth=1.0)

    for target in targets:
        subset = [r for r in rows if r["target_id"] == target and isinstance(r["fitness"], (int, float)) and r["fitness"] > 0]
        if not subset:
            continue
        xs = [r["generation"] for r in subset]
        ys = [r["fitness"] for r in subset]
        ax2.scatter(xs, ys, s=35, alpha=0.95, color=color_map[target], label=target)

    ax2.set_xlabel("Generation")
    ax2.set_ylabel("Runtime (ms, log scale)")
    set_runtime_log_axis(ax2, min_fit, max_fit)
    ax2.grid(alpha=0.25, which="major")
    ax2.legend(loc="upper right", fontsize=8)
    fig2.subplots_adjust(left=0.08, right=0.98, bottom=0.10, top=0.98)
    out2 = out_prefix.with_name(out_prefix.name + "_gen_runtime.png")
    fig2.savefig(out2, bbox_inches="tight", pad_inches=0.04)
    plt.close(fig2)
    output_paths.append(out2)

    # 3) branch lane vs runtime
    fig3, ax3 = plt.subplots(figsize=(14, 8), dpi=150)
    for e in edges:
        ax3.plot([e["y0"], e["y1"]], [e["r0"], e["r1"]], color=(0.55, 0.55, 0.55, 0.55), linewidth=1.0)

    for target in targets:
        subset = [
            r
            for r in rows
            if r["target_id"] == target and isinstance(r["fitness"], (int, float)) and r["fitness"] > 0
        ]
        if not subset:
            continue
        xs = [y_pos[r["branch"]] for r in subset]
        ys = [r["fitness"] for r in subset]
        ax3.scatter(xs, ys, s=35, alpha=0.95, color=color_map[target], label=target)

    ax3.set_xlabel("Branch lane")
    ax3.set_ylabel("Runtime (ms, log scale)")
    set_runtime_log_axis(ax3, min_fit, max_fit)
    ax3.grid(alpha=0.25, which="major")
    ax3.legend(loc="lower right", fontsize=8)
    fig3.subplots_adjust(left=0.08, right=0.98, bottom=0.10, top=0.98)
    out3 = out_prefix.with_name(out_prefix.name + "_lane_runtime.png")
    fig3.savefig(out3, bbox_inches="tight", pad_inches=0.04)
    plt.close(fig3)
    output_paths.append(out3)

    return output_paths


def main():
    parser = argparse.ArgumentParser(description="Split lineage into three 2D PNG views")
    parser.add_argument("--state", default="state(2).json", help="Path to state JSON")
    parser.add_argument("--out-prefix", default="lineage_2d", help="Output PNG prefix")
    args = parser.parse_args()

    rows = load_rows(Path(args.state))
    if not rows:
        raise ValueError("No individuals found in state JSON")

    output_paths = plot_2d_views(rows, Path(args.out_prefix))
    print("Done:")
    for p in output_paths:
        print(p.resolve())


if __name__ == "__main__":
    main()
