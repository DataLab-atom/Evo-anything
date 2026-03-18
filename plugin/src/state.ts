/**
 * State persistence and Pareto bookkeeping helpers.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { EvolutionState, Individual, ObjectiveSpec } from "./models.js";
import { dominates, paretoFrontOf, representativeBranch } from "./selection.js";

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

const STATE_DIR =
  process.env["U2E_STATE_DIR"] ??
  join(process.env["HOME"] ?? "~", ".openclaw", "u2e-state");

let _state: EvolutionState | null = null;

function statePath(): string {
  return join(STATE_DIR, "state.json");
}

export function save(): void {
  if (!_state) return;
  const p = statePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(_state, null, 2));
}

function load(): EvolutionState | null {
  const p = statePath();
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as EvolutionState;
}

export function getState(): EvolutionState {
  if (!_state) _state = load();
  if (!_state) throw new Error("Evolution not initialized. Call evo_init first.");
  return _state;
}

export function setState(s: EvolutionState): void {
  _state = s;
}

// ---------------------------------------------------------------------------
// Pareto bookkeeping helpers
// ---------------------------------------------------------------------------

export function updateGlobalPareto(state: EvolutionState): void {
  const allValid = Object.values(state.individuals).filter(
    (ind) => ind.success && ind.fitness !== null,
  );
  const front = paretoFrontOf(allValid, state.config.objectives);
  state.pareto_front = front.map((ind) => ind.branch);

  const rep = representativeBranch(
    state.pareto_front,
    state.individuals,
    state.config.objectives,
  );
  if (rep) {
    state.best_branch_overall = rep;
    state.best_obj_overall = state.individuals[rep].fitness;
  }
}

export function updateTargetPareto(
  state: EvolutionState,
  targetId: string,
): void {
  const target = state.targets[targetId];
  if (!target) return;
  const active = state.active_branches[targetId] ?? [];
  const activeInds = active
    .filter((b) => b in state.individuals && state.individuals[b].success && state.individuals[b].fitness !== null)
    .map((b) => state.individuals[b]);
  if (activeInds.length === 0) return;

  const front = paretoFrontOf(activeInds, state.config.objectives);
  target.pareto_branches = front.map((ind) => ind.branch);

  const rep = representativeBranch(
    target.pareto_branches,
    state.individuals,
    state.config.objectives,
  );
  if (rep) {
    target.current_best_branch = rep;
    target.current_best_obj = state.individuals[rep].fitness;
  }
}

export function paretoFrontExpanded(
  newIndividuals: Individual[],
  existingFrontBranches: string[],
  allIndividuals: Record<string, Individual>,
  objectives: ObjectiveSpec[],
): boolean {
  const existingFitnesses = existingFrontBranches
    .filter((b) => b in allIndividuals && allIndividuals[b].fitness !== null)
    .map((b) => allIndividuals[b].fitness!);
  for (const ind of newIndividuals) {
    if (ind.fitness === null) continue;
    const dominated = existingFitnesses.some((ef) =>
      dominates(ef, ind.fitness!, objectives),
    );
    if (!dominated) return true;
  }
  return false;
}
