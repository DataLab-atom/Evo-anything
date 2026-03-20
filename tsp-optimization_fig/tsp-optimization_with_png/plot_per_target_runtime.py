import json
from pathlib import Path
import matplotlib.pyplot as plt


def main():
    root = Path(__file__).resolve().parent
    parent = root.parent

    state_file = parent / "state(2).json"
    if not state_file.exists():
        state_file = parent / "state.json"

    if not state_file.exists():
        raise FileNotFoundError("Cannot find state(2).json or state.json in the parent directory.")

    with open(state_file, "r", encoding="utf-8") as f:
        state = json.load(f)

    individuals = state.get("individuals", {})
    seed_obj = state.get("seed_obj", [None])[0]

    # target -> generation -> best fitness in that generation
    target_gen_best = {}

    for _, item in individuals.items():
        target_id = item.get("target_id")
        gen = item.get("generation")
        success = item.get("success", False)
        fitness = item.get("fitness", [None])[0]

        if not success or target_id is None or gen is None or fitness is None:
            continue

        if target_id not in target_gen_best:
            target_gen_best[target_id] = {}

        if gen not in target_gen_best[target_id]:
            target_gen_best[target_id][gen] = fitness
        else:
            target_gen_best[target_id][gen] = min(target_gen_best[target_id][gen], fitness)

    if not target_gen_best:
        raise ValueError("No valid target/generation fitness data found in state file.")

    all_generations = sorted(
        {g for gen_map in target_gen_best.values() for g in gen_map.keys()}
    )

    # Pretty labels
    label_map = {
        "tsp_pruning": "Pruning",
        "tsp_nearest_neighbor": "Nearest Neighbor",
        "tsp_2opt": "2-opt",
        "tsp_cache_distances": "Cache Distances",
    }

    plt.style.use("default")
    fig, ax = plt.subplots(figsize=(9, 5.5))

    # Baseline
    if seed_obj is not None:
        ax.axhline(
            seed_obj,
            linestyle="--",
            linewidth=1.6,
            color="gray",
            alpha=0.8,
            label=f"Seed baseline ({seed_obj:.2f} ms)",
        )

    # Plot each target as one line
    for target_id in sorted(target_gen_best.keys()):
        gen_map = target_gen_best[target_id]
        gens = sorted(gen_map.keys())
        vals = [gen_map[g] for g in gens]

        ax.plot(
            gens,
            vals,
            marker="o",
            linewidth=2.0,
            markersize=6,
            label=label_map.get(target_id, target_id),
        )

    ax.set_xlabel("Generation", fontsize=12)
    ax.set_ylabel("Best Runtime in Generation (ms)", fontsize=12)
    ax.set_title("Per-Target Runtime Progress Across Generations", fontsize=14)
    ax.set_xticks(all_generations)
    ax.set_yscale("log")

    ax.grid(True, which="major", linestyle=":", alpha=0.5)
    ax.grid(True, which="minor", linestyle=":", alpha=0.15)

    ax.legend(
    frameon=True,
    fontsize=8,
    loc="upper right",
    bbox_to_anchor=(0.98, 0.68)
    )

    plt.tight_layout()

    out_file = root / "per_target_runtime_vs_generation.png"
    plt.savefig(out_file, dpi=300, bbox_inches="tight")
    plt.close()

    print(f"Read state from: {state_file}")
    print(f"Saved plot to: {out_file}")


if __name__ == "__main__":
    main()