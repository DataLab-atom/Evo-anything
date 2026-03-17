"""
Multi-target cooperative coevolution integration test.

4 targets (independently evolved code segments):
  1. compute_loss    — loss function hyperparams
  2. update_weights  — optimizer hyperparams
  3. schedule_lr     — LR schedule hyperparams
  4. init_weights    — initialization hyperparams

3 objectives (all minimized):
  1. final_loss      — lower = better training
  2. 1 - accuracy    — lower = more accurate
  3. total_batch_ops — lower = cheaper to train

Each target maintains its own population & Pareto front.
Synergy checks test whether improvements across targets compose well.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import random
import shutil
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "plugin", "evo-engine"))
os.environ["U2E_STATE_DIR"] = "/tmp/evo-multi-target-test-state"

import server  # noqa: E402
from ml_pipeline import train  # noqa: E402

# ---------------------------------------------------------------------------
# Per-target parameter spaces
# ---------------------------------------------------------------------------

TARGET_PARAMS = {
    "compute_loss": {
        "label_smoothing": (0.0, 0.3, False),
        "focal_gamma":     (0.0, 5.0, False),
        "l2_reg":          (0.0, 0.01, False),
    },
    "update_weights": {
        "base_lr":      (1e-4, 0.5, True),
        "momentum":     (0.0, 0.99, False),
        "nesterov":     (False, True, False),
        "weight_decay": (0.0, 0.01, False),
        "grad_clip":    (0.0, 10.0, False),
    },
    "schedule_lr": {
        "schedule":     ["constant", "cosine", "linear", "step"],
        "warmup_frac":  (0.0, 0.3, False),
        "min_lr_frac":  (0.0, 0.5, False),
    },
    "init_weights": {
        "init_method":  ["xavier", "he", "lecun", "normal", "uniform"],
        "init_gain":    (0.1, 3.0, False),
    },
}

SEED_CONFIG = {
    "compute_loss": {"label_smoothing": 0.0, "focal_gamma": 0.0, "l2_reg": 0.0},
    "update_weights": {"base_lr": 0.01, "momentum": 0.0, "nesterov": False,
                       "weight_decay": 0.0, "grad_clip": 0.0},
    "schedule_lr": {"schedule": "constant", "warmup_frac": 0.0, "min_lr_frac": 0.0},
    "init_weights": {"init_method": "xavier", "init_gain": 1.0},
}


def random_params_for(target_id: str, rng: random.Random) -> dict:
    space = TARGET_PARAMS[target_id]
    p = {}
    for k, v in space.items():
        if isinstance(v, list):
            p[k] = rng.choice(v)
        elif isinstance(v[0], bool):
            p[k] = rng.choice([True, False])
        elif v[2]:  # log scale
            p[k] = 10 ** rng.uniform(math.log10(v[0]), math.log10(v[1]))
        else:
            p[k] = rng.uniform(v[0], v[1])
    return p


def mutate_params(params: dict, target_id: str, rng: random.Random) -> dict:
    space = TARGET_PARAMS[target_id]
    p = dict(params)
    keys = list(space.keys())
    n_changes = rng.randint(1, max(1, len(keys) // 2))
    for k in rng.sample(keys, n_changes):
        v = space[k]
        if isinstance(v, list):
            p[k] = rng.choice(v)
        elif isinstance(v[0], bool):
            p[k] = rng.choice([True, False])
        elif v[2]:
            log_val = math.log10(max(v[0], p.get(k, v[0])))
            log_val += rng.gauss(0, 0.3)
            p[k] = max(v[0], min(v[1], 10 ** log_val))
        else:
            val = p.get(k, (v[0] + v[1]) / 2)
            val += rng.gauss(0, (v[1] - v[0]) * 0.2)
            p[k] = max(v[0], min(v[1], val))
    return p


def crossover_params(p1: dict, p2: dict, target_id: str, rng: random.Random) -> dict:
    result = {}
    for k in TARGET_PARAMS[target_id]:
        result[k] = p1[k] if rng.random() < 0.5 else p2[k]
    return result


def evaluate(config: dict) -> list[float]:
    """Run full pipeline with merged config from all 4 targets."""
    merged = {}
    for tid in TARGET_PARAMS:
        merged.update(config.get(tid, SEED_CONFIG[tid]))
    r = train(**merged)
    # All objectives are minimized: final_loss, 1-accuracy, total_batch_ops
    return [r["final_loss"], 1.0 - r["accuracy"], float(r["total_batch_ops"])]


def code_hash_of(config: dict) -> str:
    s = json.dumps(config, sort_keys=True, default=str)
    return hashlib.sha256(s.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    rng = random.Random(777)
    t_start = time.time()

    print("=" * 78)
    print("MULTI-TARGET COOPERATIVE COEVOLUTION TEST")
    print("4 targets × 3 objectives × 6 generations")
    print("=" * 78)

    state_dir = os.environ["U2E_STATE_DIR"]
    if os.path.exists(state_dir):
        shutil.rmtree(state_dir)

    # ---------------------------------------------------------------- INIT
    print("\n[INIT]")
    server.evo_init(
        repo_path="/home/user/Evo-anything/test-gd",
        benchmark_cmd="python benchmark_ml.py",
        objectives=[
            {"name": "final_loss", "direction": "min"},
            {"name": "error_rate", "direction": "min"},  # 1 - accuracy
            {"name": "compute_ops", "direction": "min"},
        ],
        benchmark_format="numbers",
        max_fe=80,
        pop_size=4,
        mutation_rate=0.5,
        synergy_interval=2,
        top_k_survive=3,
    )

    # -------------------------------------------------------- REGISTER 4 TARGETS
    print("\n[REGISTER 4 TARGETS]")
    server.evo_register_targets([
        {"id": "compute_loss", "file": "ml_pipeline.py",
         "function": "compute_loss", "impact": "high",
         "description": "Cross-entropy loss with smoothing/focal/L2"},
        {"id": "update_weights", "file": "ml_pipeline.py",
         "function": "update_weights", "impact": "high",
         "description": "SGD optimizer step with momentum/nesterov/decay/clip"},
        {"id": "schedule_lr", "file": "ml_pipeline.py",
         "function": "schedule_lr", "impact": "medium",
         "description": "LR schedule: constant/cosine/linear/step + warmup"},
        {"id": "init_weights", "file": "ml_pipeline.py",
         "function": "init_weights", "impact": "medium",
         "description": "Weight init: xavier/he/lecun/normal/uniform + gain"},
    ])

    # -------------------------------------------------------- SEED
    print("\n[SEED]")
    seed_fitness = evaluate(SEED_CONFIG)
    print(f"  baseline: loss={seed_fitness[0]:.4f}, error={seed_fitness[1]:.4f}, "
          f"ops={seed_fitness[2]:.0f}")
    server.evo_report_seed(fitness_values=seed_fitness)

    # Track configs per branch.
    # Each branch has a full config = {target_id: params_for_that_target, ...}.
    # When mutating one target, the other targets keep their current best config.
    branch_configs: dict[str, dict] = {"seed-baseline": dict(SEED_CONFIG)}
    target_best_config: dict[str, dict] = {tid: dict(SEED_CONFIG[tid]) for tid in TARGET_PARAMS}

    max_gens = 6
    gen_history = []

    for gen in range(max_gens):
        print(f"\n{'='*78}")
        print(f"GENERATION {gen}  (elapsed {time.time()-t_start:.0f}s)")
        print(f"{'='*78}")

        step_result = server.evo_step(phase="begin_generation")
        if step_result.get("action") == "done":
            print(f"  DONE: {step_result.get('reason')}")
            break

        batch = step_result["items"]
        print(f"  batch: {len(batch)} items")

        # Count operations per target.
        target_ops = {}
        for item in batch:
            tid = item["target_id"]
            target_ops[tid] = target_ops.get(tid, 0) + 1
        print(f"  per-target: {target_ops}")

        for item in batch:
            branch = item["branch"]
            target_id = item["target_id"]
            operation = item["operation"]
            parent_branches = item["parent_branches"]

            # --- SYNERGY: merge best of each constituent target
            if operation == "synergy":
                parts = target_id.split("+")
                synergy_config = dict(SEED_CONFIG)
                for part in parts:
                    synergy_config[part] = target_best_config.get(part, SEED_CONFIG[part])

                t0 = time.time()
                fitness = evaluate(synergy_config)
                dt = time.time() - t0

                individual_fitnesses = {}
                for part in parts:
                    part_config = dict(SEED_CONFIG)
                    part_config[part] = target_best_config.get(part, SEED_CONFIG[part])
                    individual_fitnesses[part] = evaluate(part_config)

                server.evo_step(
                    phase="fitness_ready", branch=branch,
                    fitness_values=fitness, success=True,
                    operation=operation, target_id=target_id,
                    parent_branches=parent_branches,
                )
                server.evo_record_synergy(
                    branch=branch, target_ids=parts,
                    fitness_values=fitness, success=True,
                    individual_fitnesses=individual_fitnesses,
                )
                print(f"  SYNERGY {target_id}: loss={fitness[0]:.4f} err={fitness[1]:.4f} "
                      f"ops={fitness[2]:.0f}  ({dt:.1f}s)")
                continue

            # --- MUTATE or CROSSOVER on a single target
            # Build full config: use current best for all targets, then modify this one.
            full_config = {tid: dict(target_best_config[tid]) for tid in TARGET_PARAMS}

            parent_cfg = branch_configs.get(
                parent_branches[0] if parent_branches else "seed-baseline",
                SEED_CONFIG,
            )

            if operation == "crossover" and len(parent_branches) >= 2:
                p1_cfg = branch_configs.get(parent_branches[0], SEED_CONFIG)
                p2_cfg = branch_configs.get(parent_branches[1], SEED_CONFIG)
                new_target_params = crossover_params(
                    p1_cfg.get(target_id, SEED_CONFIG[target_id]),
                    p2_cfg.get(target_id, SEED_CONFIG[target_id]),
                    target_id, rng,
                )
            else:
                base_params = parent_cfg.get(target_id, SEED_CONFIG[target_id])
                new_target_params = mutate_params(base_params, target_id, rng)

            full_config[target_id] = new_target_params
            branch_configs[branch] = full_config

            ch = code_hash_of(full_config)
            t0 = time.time()
            fitness = evaluate(full_config)
            dt = time.time() - t0

            report = server.evo_step(
                phase="fitness_ready", branch=branch,
                fitness_values=fitness, success=True,
                operation=operation, target_id=target_id,
                parent_branches=parent_branches, code_hash=ch,
            )
            pf = " *PF*" if report.get("on_pareto_front") else ""
            print(f"  {target_id:16s} {operation:9s} loss={fitness[0]:.4f} "
                  f"err={fitness[1]:.4f} ops={fitness[2]:.0f}  ({dt:.1f}s){pf}")

        # ----- Selection
        sel = server.evo_step(phase="select")
        print(f"\n  SELECT → keep={len(sel['keep'])}, elim={len(sel['eliminate'])}, "
              f"pareto={sel['pareto_front_size']}, best_obj={sel.get('best_obj')}")

        # Update target_best_config from the best branch of each target.
        status = server.evo_get_status()
        for tid, tinfo in status["targets"].items():
            best_b = tinfo.get("current_best_branch")
            if best_b and best_b in branch_configs:
                target_best_config[tid] = branch_configs[best_b].get(tid, SEED_CONFIG[tid])

        gen_history.append({
            "gen": gen,
            "best_obj": sel.get("best_obj"),
            "pareto_size": sel.get("pareto_front_size"),
        })

        # Reflect
        ref = server.evo_step(phase="reflect_done")
        if ref.get("action") == "done":
            print(f"  DONE: {ref.get('reason')}")
            break

    # -------------------------------------------------------- FINAL STATUS
    elapsed = time.time() - t_start
    print(f"\n{'='*78}")
    print(f"FINAL STATUS  (total {elapsed:.0f}s)")
    print(f"{'='*78}")

    status = server.evo_get_status()
    print(f"  Generations: {status['generation']}")
    print(f"  Evaluations: {status['total_evals']} / {status['total_evals'] + status['budget_remaining']}")
    print(f"  Pareto front: {status['pareto_front_size']} solutions")
    print()

    seed = status["seed_obj"]
    best = status["best_obj_overall"]
    print(f"  Seed:     loss={seed[0]:.4f}  error={seed[1]:.4f}  ops={seed[2]:.0f}")
    print(f"  Best:     loss={best[0]:.4f}  error={best[1]:.4f}  ops={best[2]:.0f}")
    print(f"  Improve:  {status['improvement']}")
    print()

    print("  Targets:")
    for tid, t in status["targets"].items():
        print(f"    {tid:16s}: temp={t['temperature']:.1f}  stag={t['stagnation']}  "
              f"pareto={t['pareto_front_size']}  active={t['active_branches']}  "
              f"best={t['current_best_obj']}")
    print()

    print("  Pareto Front:")
    for sol in status["pareto_front"]:
        f = sol["fitness"]
        print(f"    {sol['branch']:50s} loss={f[0]:.4f} err={f[1]:.4f} ops={f[2]:.0f}")
    print()

    print("  Synergy Records:")
    for rec in status.get("synergy_records", []):
        # Need to fetch from state directly
        pass
    # Fetch synergy from state.
    state = server._get_state()
    for rec in state.synergy_records:
        fv = rec.get("fitness_values", rec.get("fitness"))
        gain = rec.get("synergy_gain", {})
        print(f"    gen-{rec['generation']} {rec['target_ids']}: "
              f"fitness={fv}  gain={gain}")
    print()

    print("  Generation History:")
    print(f"  {'gen':>3s} {'pf':>3s} {'loss':>8s} {'error':>8s} {'ops':>6s}")
    for h in gen_history:
        bo = h["best_obj"]
        if bo:
            print(f"  {h['gen']:3d} {h['pareto_size']:3d} {bo[0]:8.4f} {bo[1]:8.4f} {bo[2]:6.0f}")

    # Best branch lineage.
    if status["best_branch_overall"]:
        print(f"\n  Lineage of best ({status['best_branch_overall']}):")
        lineage = server.evo_get_lineage(status["best_branch_overall"])
        for e in lineage["lineage"]:
            print(f"    gen-{e['generation']} {e['operation']:9s} {e['target_id']:16s} "
                  f"fitness={e['fitness']}  rank={e.get('pareto_rank')}")

    # -------------------------------------------------------- ASSERTIONS
    print(f"\n{'='*78}")
    print("ASSERTIONS")
    print(f"{'='*78}")

    assert status["generation"] >= 4
    assert status["total_evals"] >= 20
    assert status["pareto_front_size"] >= 1
    assert len(status["objectives"]) == 3

    # Multiple targets should have been evolved.
    active_targets = [t for t in status["targets"].values()
                      if t["active_branches"] > 0]
    assert len(active_targets) >= 2, f"Expected >=2 active targets, got {len(active_targets)}"
    print(f"  Active targets: {len(active_targets)} / {len(status['targets'])}")

    # At least one objective improved.
    any_improved = any(b < s for b, s in zip(best, seed))
    print(f"  loss improved:  {best[0] < seed[0]}")
    print(f"  error improved: {best[1] < seed[1]}")
    print(f"  ops improved:   {best[2] < seed[2]}")
    assert any_improved, "No objective improved"

    # Temperature should vary across targets (different stagnation rates).
    temps = [t["temperature"] for t in status["targets"].values()]
    print(f"  Temperatures: {temps}")

    # Synergy records should exist (synergy_interval=2, 4 targets).
    assert len(state.synergy_records) > 0, "No synergy records"
    print(f"  Synergy records: {len(state.synergy_records)}")

    print(f"\n{'='*78}")
    print(f"ALL ASSERTIONS PASSED  ({elapsed:.0f}s total)")
    print(f"{'='*78}")

    return status


if __name__ == "__main__":
    main()
