"""
Large-scale integration test of the multi-objective coevolution engine.

Target: 20-dimensional Rosenbrock gradient descent optimizer.
Three objectives (all minimized):
  1. steps_to_converge  — fewer = faster
  2. final_loss         — lower = more accurate
  3. total_grad_norm    — lower = more stable training

8 generations, pop_size=6, top_k=4, 50 budget  →  more realistic workload.
Simulates mutation, crossover, and synergy operations.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import random
import shutil
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "plugin", "evo-engine"))
os.environ["U2E_STATE_DIR"] = "/tmp/evo-large-test-state"

import server  # noqa: E402
from optimizer_large import gradient_descent  # noqa: E402

# ---------------------------------------------------------------------------
# Variant pool — realistic hyperparameter search space
# ---------------------------------------------------------------------------

def make_variant(parent_params: dict, operation: str, rng: random.Random) -> dict:
    """Generate a new variant by mutating or crossing over parent params."""
    p = dict(parent_params)

    if operation == "mutate":
        # Randomly perturb 1-3 hyperparameters.
        n_changes = rng.randint(1, 3)
        keys = rng.sample(list(PARAM_RANGES.keys()), min(n_changes, len(PARAM_RANGES)))
        for k in keys:
            lo, hi, log_scale = PARAM_RANGES[k]
            if isinstance(lo, bool):
                p[k] = rng.choice([True, False])
            elif log_scale:
                log_val = math.log10(p.get(k, lo) or lo)
                log_val += rng.gauss(0, 0.3)
                p[k] = max(lo, min(hi, 10 ** log_val))
            else:
                val = p.get(k, (lo + hi) / 2)
                val += rng.gauss(0, (hi - lo) * 0.15)
                p[k] = max(lo, min(hi, val))
    elif operation == "crossover":
        # Uniform crossover between parent and a random config.
        other = random_params(rng)
        for k in PARAM_RANGES:
            if rng.random() < 0.5:
                p[k] = other[k]
    return p


PARAM_RANGES = {
    # (min, max, log_scale)
    "lr":           (1e-5, 0.1, True),
    "momentum":     (0.0, 0.99, False),
    "nesterov":     (False, True, False),
    "adaptive":     (False, True, False),
    "warmup_steps": (0, 500, False),
    "grad_clip":    (0.1, 50.0, True),
    "lr_decay":     (0.0, 0.01, False),
    "beta2":        (0.0, 0.999, False),
}

SEED_PARAMS = {
    "lr": 0.0001, "momentum": 0.0, "nesterov": False, "adaptive": False,
    "warmup_steps": 0, "grad_clip": 5.0, "lr_decay": 0.0, "beta2": 0.0,
}


def random_params(rng: random.Random) -> dict:
    p = {}
    for k, (lo, hi, log_scale) in PARAM_RANGES.items():
        if isinstance(lo, bool):
            p[k] = rng.choice([True, False])
        elif log_scale:
            p[k] = 10 ** rng.uniform(math.log10(lo), math.log10(hi))
        else:
            p[k] = rng.uniform(lo, hi)
    return p


def evaluate(params: dict) -> list[float]:
    """Run optimizer with given params, return [steps, loss, grad_norm]."""
    kw = {k: v for k, v in params.items()
          if k in ("lr", "momentum", "nesterov", "adaptive",
                   "warmup_steps", "grad_clip", "lr_decay", "beta2", "epsilon")}
    # Clamp integer params.
    kw["warmup_steps"] = int(round(kw.get("warmup_steps", 0)))
    r = gradient_descent(**kw)
    return [float(r["steps"]), r["final_loss"], r["total_grad_norm"]]


def code_hash_of(params: dict, gen: int) -> str:
    s = json.dumps(params, sort_keys=True) + str(gen)
    return hashlib.sha256(s.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    rng = random.Random(123)

    print("=" * 78)
    print("LARGE-SCALE MULTI-OBJECTIVE COEVOLUTION TEST")
    print("Target: 20-D Rosenbrock gradient descent")
    print("Objectives: steps (min), final_loss (min), total_grad_norm (min)")
    print("Config: pop_size=6, top_k=4, budget=60, 8 generations max")
    print("=" * 78)

    # Clean state.
    state_dir = os.environ["U2E_STATE_DIR"]
    if os.path.exists(state_dir):
        shutil.rmtree(state_dir)

    # ---------------------------------------------------------------- INIT
    print("\n[INIT]")
    result = server.evo_init(
        repo_path="/home/user/Evo-anything/test-gd",
        benchmark_cmd="python benchmark_large.py",
        objectives=[
            {"name": "steps", "direction": "min"},
            {"name": "final_loss", "direction": "min"},
            {"name": "grad_norm", "direction": "min"},
        ],
        benchmark_format="numbers",
        max_fe=60,
        pop_size=6,
        mutation_rate=0.5,
        synergy_interval=3,
        top_k_survive=4,
    )
    print(f"  objectives: {[o['name'] for o in result['objectives']]}")

    # -------------------------------------------------------- REGISTER
    print("\n[REGISTER]")
    server.evo_register_targets([{
        "id": "gd-20d",
        "file": "optimizer_large.py",
        "function": "gradient_descent",
        "impact": "high",
        "description": "20-D Rosenbrock gradient descent with 8 hyperparameters",
    }])

    # -------------------------------------------------------- SEED
    print("\n[SEED]")
    seed_fitness = evaluate(SEED_PARAMS)
    print(f"  baseline: steps={seed_fitness[0]:.0f}, "
          f"loss={seed_fitness[1]:.4e}, grad_norm={seed_fitness[2]:.2f}")
    server.evo_report_seed(fitness_values=seed_fitness)

    # Track params per branch for mutation/crossover.
    branch_params: dict[str, dict] = {"seed-baseline": dict(SEED_PARAMS)}
    gen_best_params: dict = dict(SEED_PARAMS)

    # -------------------------------------------------------- EVOLUTION LOOP
    max_gens = 8
    gen_history: list[dict] = []

    for gen in range(max_gens):
        print(f"\n{'='*78}")
        print(f"GENERATION {gen}")
        print(f"{'='*78}")

        step_result = server.evo_step(phase="begin_generation")
        if step_result.get("action") == "done":
            print(f"  DONE: {step_result.get('reason')}")
            break

        batch = step_result["items"]
        print(f"  batch_size={len(batch)}")

        gen_results = []

        for item in batch:
            branch = item["branch"]
            target_id = item["target_id"]
            operation = item["operation"]
            parent_branches = item["parent_branches"]

            if operation == "synergy":
                # Can't do real synergy (single target), skip.
                server.evo_step(
                    phase="fitness_ready", branch=branch,
                    fitness_values=[], success=False,
                    operation=operation, target_id=target_id,
                    parent_branches=parent_branches,
                    raw_output="synergy skipped (single target)",
                )
                continue

            # Determine parent params.
            parent_p = branch_params.get(
                parent_branches[0] if parent_branches else "seed-baseline",
                gen_best_params,
            )

            # Generate variant.
            if operation == "crossover" and len(parent_branches) >= 2:
                p1 = branch_params.get(parent_branches[0], gen_best_params)
                p2 = branch_params.get(parent_branches[1], gen_best_params)
                # Uniform crossover between two actual parents.
                params = {}
                for k in PARAM_RANGES:
                    params[k] = p1[k] if rng.random() < 0.5 else p2[k]
            else:
                params = make_variant(parent_p, operation, rng)

            branch_params[branch] = params

            # Evaluate.
            fitness = evaluate(params)
            ch = code_hash_of(params, gen)

            status_char = ""
            report = server.evo_step(
                phase="fitness_ready", branch=branch,
                fitness_values=fitness, success=True,
                operation=operation, target_id=target_id,
                parent_branches=parent_branches, code_hash=ch,
            )

            if report.get("on_pareto_front"):
                status_char = " *PF*"

            compact_params = (f"lr={params['lr']:.5f} mom={params['momentum']:.2f} "
                              f"nest={params['nesterov']} adapt={params['adaptive']} "
                              f"clip={params['grad_clip']:.1f} decay={params['lr_decay']:.5f} "
                              f"beta2={params['beta2']:.3f}")
            print(f"  {operation:9s} steps={fitness[0]:5.0f}  "
                  f"loss={fitness[1]:10.4e}  gnorm={fitness[2]:12.2f}  "
                  f"{status_char}")
            print(f"             {compact_params}")

            gen_results.append({
                "branch": branch, "fitness": fitness,
                "on_pareto_front": report.get("on_pareto_front", False),
            })

        # ----- Select
        sel = server.evo_step(phase="select")
        print(f"\n  SELECT → keep={len(sel['keep'])}, elim={len(sel['eliminate'])}, "
              f"pareto_size={sel['pareto_front_size']}")

        # Update gen_best_params to the representative best's params.
        best_b = sel.get("best_branch", "")
        if best_b in branch_params:
            gen_best_params = branch_params[best_b]

        gen_history.append({
            "gen": gen,
            "best_obj": sel.get("best_obj"),
            "pareto_size": sel.get("pareto_front_size"),
            "keep": len(sel["keep"]),
            "elim": len(sel["eliminate"]),
        })

        # ----- Reflect
        ref = server.evo_step(phase="reflect_done")
        if ref.get("action") == "done":
            print(f"\n  DONE after reflect: {ref.get('reason')}")
            break

    # -------------------------------------------------------- FINAL STATUS
    print(f"\n{'='*78}")
    print("FINAL STATUS")
    print(f"{'='*78}")
    status = server.evo_get_status()

    print(f"  Generations completed: {status['generation']}")
    print(f"  Total evaluations:     {status['total_evals']} / {status['total_evals'] + status['budget_remaining']}")
    print(f"  Pareto front size:     {status['pareto_front_size']}")
    print()

    print("  Objectives:")
    for o in status["objectives"]:
        print(f"    {o['name']:15s}  ({o['direction']})")
    print()

    print(f"  Seed:     {status['seed_obj']}")
    print(f"  Best:     {status['best_obj_overall']}")
    print(f"  Improve:  {status['improvement']}")
    print()

    print("  Pareto Front:")
    print(f"  {'branch':45s} {'steps':>8s} {'loss':>12s} {'grad_norm':>14s}")
    print(f"  {'-'*45} {'-'*8} {'-'*12} {'-'*14}")
    for sol in status["pareto_front"]:
        f = sol["fitness"]
        print(f"  {sol['branch']:45s} {f[0]:8.0f} {f[1]:12.4e} {f[2]:14.2f}")
    print()

    print("  Target Status:")
    for tid, t in status["targets"].items():
        print(f"    {tid}: temp={t['temperature']}, stag={t['stagnation']}, "
              f"pareto={t['pareto_front_size']}, active={t['active_branches']}")
    print()

    # -------------------------------------------------------- GENERATION HISTORY
    print(f"  Generation History:")
    print(f"  {'gen':>3s} {'pareto':>6s} {'best_steps':>10s} {'best_loss':>12s} {'best_gnorm':>14s}")
    for h in gen_history:
        bo = h["best_obj"]
        if bo:
            print(f"  {h['gen']:3d} {h['pareto_size']:6d} {bo[0]:10.0f} {bo[1]:12.4e} {bo[2]:14.2f}")

    # -------------------------------------------------------- LINEAGE OF BEST
    if status["best_branch_overall"]:
        print(f"\n  Lineage of best ({status['best_branch_overall']}):")
        lineage = server.evo_get_lineage(status["best_branch_overall"])
        for entry in lineage["lineage"]:
            prank = entry.get("pareto_rank", "?")
            print(f"    gen-{entry['generation']} {entry['operation']:9s} "
                  f"fitness={entry['fitness']}  rank={prank}  "
                  f"parents={entry['parent_branches']}")

    # -------------------------------------------------------- ASSERTIONS
    print(f"\n{'='*78}")
    print("ASSERTIONS")
    print(f"{'='*78}")

    assert status["generation"] >= 4, f"Expected >=4 generations, got {status['generation']}"
    assert status["total_evals"] >= 20, f"Expected >=20 evals, got {status['total_evals']}"
    assert status["pareto_front_size"] >= 1, "Empty Pareto front"
    assert len(status["objectives"]) == 3, "Expected 3 objectives"

    best = status["best_obj_overall"]
    seed = status["seed_obj"]
    assert best is not None and seed is not None

    # At least one objective should have improved.
    any_improved = any(b < s for b, s in zip(best, seed))
    print(f"  steps:     seed={seed[0]:.0f}  best={best[0]:.0f}  "
          f"{'IMPROVED' if best[0] < seed[0] else 'no change'}")
    print(f"  loss:      seed={seed[1]:.4e}  best={best[1]:.4e}  "
          f"{'IMPROVED' if best[1] < seed[1] else 'no change'}")
    print(f"  grad_norm: seed={seed[2]:.2f}  best={best[2]:.2f}  "
          f"{'IMPROVED' if best[2] < seed[2] else 'no change'}")
    assert any_improved, "No objective improved — evolution failed"

    # Pareto front should have diversity (multiple trade-off solutions).
    pf = status["pareto_front"]
    if len(pf) >= 2:
        f0 = pf[0]["fitness"]
        f1 = pf[1]["fitness"]
        print(f"\n  Pareto diversity check: sol0={f0} vs sol1={f1}")
        assert f0 != f1, "Pareto front has duplicate solutions"

    print(f"\n{'='*78}")
    print("ALL ASSERTIONS PASSED")
    print(f"{'='*78}")

    return status


if __name__ == "__main__":
    main()
