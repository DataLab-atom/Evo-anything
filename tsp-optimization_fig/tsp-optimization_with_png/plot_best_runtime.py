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

    seed_obj = state.get("seed_obj", [None])[0]
    individuals = state.get("individuals", {})

    gen_to_best = {}
    for _, item in individuals.items():
        gen = item.get("generation")
        fitness = item.get("fitness", [None])[0]
        success = item.get("success", False)

        if gen is None or fitness is None or not success:
            continue

        if gen not in gen_to_best:
            gen_to_best[gen] = fitness
        else:
            gen_to_best[gen] = min(gen_to_best[gen], fitness)

    if not gen_to_best:
        raise ValueError("No valid generation fitness data found in state file.")

    generations = sorted(gen_to_best.keys())
    best_per_gen = [gen_to_best[g] for g in generations]

    best_so_far = []
    current_best = float("inf")
    for v in best_per_gen:
        current_best = min(current_best, v)
        best_so_far.append(current_best)

    plt.style.use("default")
    fig, ax = plt.subplots(figsize=(9, 5.5))

    # Baseline
    if seed_obj is not None:
        ax.axhline(
            seed_obj,
            linestyle="--",
            linewidth=1.8,
            color="gray",
            alpha=0.8,
            label=f"Seed baseline ({seed_obj:.2f} ms)",
        )

    # Best in each generation
    ax.plot(
        generations,
        best_per_gen,
        marker="o",
        markersize=7,
        linewidth=2.0,
        label="Best in generation",
    )

    # Best so far
    ax.plot(
        generations,
        best_so_far,
        marker="s",
        markersize=6,
        linewidth=2.4,
        label="Best so far",
    )

    # Annotate best-so-far values
    for x, y in zip(generations, best_so_far):
        ax.annotate(
            f"{y:.2f}",
            (x, y),
            textcoords="offset points",
            xytext=(0, 8),
            ha="center",
            fontsize=9,
        )

    # Improvement text
    if seed_obj is not None and best_so_far:
        final_best = best_so_far[-1]
        speedup = seed_obj / final_best if final_best > 0 else float("inf")
        ax.text(
            0.02,
            0.05,
            f"Final best: {final_best:.2f} ms\nSpeedup vs seed: {speedup:.1f}×",
            transform=ax.transAxes,
            fontsize=10,
            bbox=dict(boxstyle="round,pad=0.3", alpha=0.15),
        )

    ax.set_xlabel("Generation", fontsize=12)
    ax.set_ylabel("Runtime (ms)", fontsize=12)
    ax.set_title("Evolutionary Search Progress on TSP Runtime", fontsize=14)
    ax.set_xticks(generations)
    ax.set_yscale("log")

    ax.grid(True, which="major", linestyle=":", alpha=0.5)
    ax.grid(True, which="minor", linestyle=":", alpha=0.15)

    ax.legend(frameon=True, fontsize=10, loc="upper right", bbox_to_anchor=(1.0, 0.82))

    plt.tight_layout()

    out_file = root / "best_runtime_vs_generation.png"
    plt.savefig(out_file, dpi=300, bbox_inches="tight")
    plt.close()

    print(f"Read state from: {state_file}")
    print(f"Saved plot to: {out_file}")


if __name__ == "__main__":
    main()