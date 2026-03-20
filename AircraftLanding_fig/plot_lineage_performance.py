import json
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.lines import Line2D

BASE_DIR = Path(__file__).resolve().parent
STATE_PATH = BASE_DIR / "state.json"
OUT_DIR = BASE_DIR / "analysis"
OUT_DIR.mkdir(exist_ok=True)


def safe_first_float(values, default=0.0):
    if isinstance(values, list) and values:
        try:
            return float(values[0])
        except Exception:
            return default
    return default


def parse_individuals(state: dict) -> list[dict]:
    rows = []
    for branch, ind in state.get("individuals", {}).items():
        fit = safe_first_float(ind.get("fitness"), np.nan)
        rows.append(
            {
                "branch": branch,
                "generation": int(ind.get("generation", -1)),
                "target_id": ind.get("target_id", ""),
                "operation": ind.get("operation", "other"),
                "fitness": fit,
                "success": bool(ind.get("success", False)),
            }
        )
    return rows


def plot_performance_curve(state: dict, rows: list[dict], out_png: Path) -> None:
    cfg = state.get("config", {})
    direction = (cfg.get("objectives", [{}])[0].get("direction") or "max").lower()
    maximize = direction == "max"

    individuals = state.get("individuals", {})
    seq = []

    seed = safe_first_float(state.get("seed_obj"), np.nan)
    if not np.isnan(seed):
        seq.append(
            {
                "eval_idx": 1,
                "branch": state.get("seed_branch", "seed-baseline"),
                "generation": -1,
                "operation": "seed",
                "fitness": seed,
                "timestamp": None,
            }
        )

    events = []
    for r in rows:
        if np.isnan(r["fitness"]):
            continue
        ts = individuals.get(r["branch"], {}).get("timestamp")
        events.append(
            {
                "branch": r["branch"],
                "generation": r["generation"],
                "operation": r["operation"],
                "fitness": float(r["fitness"]),
                "timestamp": float(ts) if ts is not None else float("inf"),
            }
        )

    events.sort(key=lambda x: x["timestamp"])
    start_idx = len(seq) + 1
    for i, e in enumerate(events, start=start_idx):
        e["eval_idx"] = i
        seq.append(e)

    if not seq:
        return

    xs = [s["eval_idx"] for s in seq]
    ys = np.array([s["fitness"] for s in seq], dtype=float)
    if maximize:
        best = np.maximum.accumulate(ys)
    else:
        best = np.minimum.accumulate(ys)

    n = len(ys)
    win = max(3, min(9, (n // 6) * 2 + 1))
    if win % 2 == 0:
        win += 1
    pad = win // 2
    y_pad = np.pad(ys, (pad, pad), mode="edge")
    kernel = np.ones(win, dtype=float) / float(win)
    trend = np.convolve(y_pad, kernel, mode="valid")

    fig, ax = plt.subplots(figsize=(12, 6), dpi=140)
    ax.set_facecolor("#FAFBFD")
    ax.plot(xs, trend, color="#1A73E8", linewidth=2.8)
    ax.set_title("Smoothed Performance Trend Over Evolution")
    ax.set_xlabel("evaluation order (from state records)")
    ax.set_ylabel("fitness")
    ax.grid(alpha=0.22, color="#CFD8DC")
    fig.tight_layout()
    fig.savefig(out_png, bbox_inches="tight")
    plt.close(fig)


def plot_evolution_lineage(state: dict, rows: list[dict], out_png: Path) -> None:
    individuals = state.get("individuals", {})
    synergy_records = state.get("synergy_records", [])
    seed_branch = state.get("seed_branch", "seed-baseline")
    seed_fit = safe_first_float(state.get("seed_obj"), np.nan)

    nodes = {
        seed_branch: {
            "branch": seed_branch,
            "generation": -1,
            "target_id": "seed",
            "operation": "seed",
            "fitness": seed_fit,
            "parent_branches": [],
        }
    }
    for b, ind in individuals.items():
        nodes[b] = {
            "branch": b,
            "generation": int(ind.get("generation", -1)),
            "target_id": ind.get("target_id", "unknown"),
            "operation": ind.get("operation", "other"),
            "fitness": safe_first_float(ind.get("fitness"), np.nan),
            "parent_branches": ind.get("parent_branches", []) if isinstance(ind.get("parent_branches"), list) else [],
        }

    for rec in synergy_records:
        branch = rec.get("branch")
        if not branch or branch in nodes:
            continue
        target_ids = rec.get("target_ids", [])
        target_id = "+".join(str(t) for t in target_ids) if isinstance(target_ids, list) and target_ids else "synergy"
        parent_branches = []
        ind_fit = rec.get("individual_fitnesses")
        if isinstance(ind_fit, dict):
            parent_branches = [k for k in ind_fit.keys() if k in nodes]
        if not parent_branches:
            continue
        nodes[branch] = {
            "branch": branch,
            "generation": int(rec.get("generation", -1)),
            "target_id": target_id,
            "operation": "synergy",
            "fitness": safe_first_float(rec.get("fitness_values"), np.nan),
            "parent_branches": parent_branches,
        }

    if len(nodes) <= 1:
        return

    single_target_ids = list(state.get("targets", {}).keys())
    if not single_target_ids:
        single_target_ids = sorted(
            {n["target_id"] for n in nodes.values() if n["target_id"] != "seed" and "+" not in str(n["target_id"])}
        )

    def lane_target(target_id: str) -> str:
        tid = str(target_id)
        if tid == "seed":
            return "seed"
        if "+" in tid:
            parts = [p for p in tid.split("+") if p]
            for p in parts:
                if p in single_target_ids:
                    return p
            return parts[0] if parts else "synergy"
        return tid

    lanes = ["seed"] + single_target_ids
    lane_to_y = {lane: (len(lanes) - 1 - i) for i, lane in enumerate(lanes)}

    target_abbr = {
        "seed": "SD",
        "plane_ordering": "PO",
        "runway_selection": "RS",
        "landing_time_calculation": "LTC",
        "strategy_attempt_sequence": "SAS",
        "synergy": "SYN",
    }

    def abbr_target(target_id: str) -> str:
        parts = str(target_id).split("+")
        return "+".join(target_abbr.get(p, p[:6].upper()) for p in parts)

    grouped = defaultdict(list)
    for n in nodes.values():
        grouped[(n["generation"], lane_target(n["target_id"]))].append(n["branch"])

    pos = {}
    for (g, tid), branches in grouped.items():
        base_y = lane_to_y.get(tid, 0.0)
        offsets = [0.0] if len(branches) == 1 else np.linspace(-0.22, 0.22, len(branches)).tolist()
        for b, off in zip(sorted(branches), offsets):
            pos[b] = (g + 1, base_y + off)

    op_colors = {
        "seed": "#5F6368",
        "mutate": "#1A73E8",
        "crossover": "#188038",
        "synergy": "#00ACC1",
        "structural": "#8E24AA",
        "other": "#9AA0A6",
    }

    fit_values = [n["fitness"] for n in nodes.values() if not np.isnan(n["fitness"])]
    fmin = min(fit_values) if fit_values else 0.0
    fmax = max(fit_values) if fit_values else 1.0

    def node_size(f):
        if np.isnan(f) or fmax <= fmin:
            return 140.0
        return 120.0 + 280.0 * (f - fmin) / (fmax - fmin)

    fig, ax = plt.subplots(figsize=(15, 8), dpi=140)

    for n in nodes.values():
        b = n["branch"]
        if b not in pos:
            continue
        for p in n["parent_branches"]:
            if p in pos:
                ax.annotate("", xy=pos[b], xytext=pos[p], arrowprops={"arrowstyle": "->", "color": "#B0B7C3", "alpha": 0.55, "lw": 1.1, "shrinkA": 8, "shrinkB": 8}, zorder=1)

    by_op = defaultdict(list)
    for b, n in nodes.items():
        by_op[n["operation"]].append((b, n))

    for op, items in by_op.items():
        xs = [pos[b][0] for b, _ in items if b in pos]
        ys = [pos[b][1] for b, _ in items if b in pos]
        ss = [node_size(n["fitness"]) for b, n in items if b in pos]
        if xs:
            ax.scatter(xs, ys, s=ss, c=op_colors.get(op, "#9AA0A6"), edgecolors="#2F3B52", linewidths=0.45, alpha=0.92, zorder=3)

    pareto = state.get("pareto_front", [])
    px = [pos[b][0] for b in pareto if b in pos]
    py = [pos[b][1] for b in pareto if b in pos]
    if px:
        ax.scatter(px, py, s=460, facecolors="none", edgecolors="#FF1744", linewidths=2.4, zorder=4)

    max_gen = max(n["generation"] for n in nodes.values())
    ax.set_xticks(list(range(0, max_gen + 2)))
    ax.set_xticklabels(["seed"] + [f"g{i}" for i in range(max_gen + 1)])
    ax.set_xlim(-0.4, max_gen + 1.6)

    yticks = [lane_to_y[l] for l in lanes]
    ax.set_yticks(yticks)
    ax.set_yticklabels([abbr_target(l) for l in lanes])

    for lane in lanes:
        ax.axhline(lane_to_y[lane], color="#ECEFF1", linewidth=0.8, zorder=0)

    ax.set_xlabel("generation")
    ax.set_ylabel("target lane (abbrev)")
    ax.grid(axis="x", alpha=0.2)

    handles = []
    op_order = ["seed", "mutate", "crossover", "structural", "synergy", "other"]
    for op in op_order:
        if op in by_op:
            handles.append(Line2D([0], [0], marker="o", linestyle="None", markersize=7, markerfacecolor=op_colors.get(op, "#9AA0A6"), markeredgecolor="#2F3B52", markeredgewidth=0.7, label=op))
    if px:
        handles.append(Line2D([0], [0], marker="o", linestyle="None", markersize=8, markerfacecolor="none", markeredgecolor="#FF1744", markeredgewidth=1.8, label="pareto_front"))

    ax.legend(handles=handles, loc="center left", bbox_to_anchor=(1.01, 0.5), ncol=1, fontsize=9, borderaxespad=0.0, labelspacing=0.9, handletextpad=0.6, borderpad=0.5, frameon=True, facecolor="white", edgecolor="#E0E0E0")

    fig.tight_layout(rect=[0.0, 0.0, 0.85, 1.0])
    fig.savefig(out_png, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    rows = parse_individuals(state)
    plot_evolution_lineage(state, rows, OUT_DIR / "state_lineage_graph.png")
    plot_performance_curve(state, rows, OUT_DIR / "state_performance_curve.png")
    print(f"Wrote two figures to: {OUT_DIR}")


if __name__ == "__main__":
    main()
