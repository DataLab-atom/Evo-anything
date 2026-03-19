/**
 * OpenClaw-Evo — Native OpenClaw plugin entry point.
 *
 * Registers all agent tools for the evolutionary algorithm engine.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

import {
  type BatchItem,
  type EvolutionState,
  type Individual,
  type ObjectiveSpec,
  type SurvivorResult,
  type Target,
  BenchmarkOutputFormat,
  Objective,
  Operation,
  TargetStatus,
  createDefaultState,
  createDefaultTarget,
  DEFAULT_PROTECTED_PATTERNS,
} from "./src/models.js";

import {
  planGeneration,
  rankSelect,
  selectSurvivors,
  updateTemperatures,
} from "./src/selection.js";

import {
  getState,
  save,
  setState,
  updateGlobalPareto,
  updateTargetPareto,
  paretoFrontExpanded,
} from "./src/state.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STRUCTURAL_OPS = [
  "insert", "merge", "decouple", "split", "extract",
  "parallelize", "pipeline", "stratify", "cache",
];

const PHASE_BEGIN = "begin_generation";
const PHASE_CODE = "code_ready";
const PHASE_POLICY_PASS = "policy_pass";
const PHASE_POLICY_FAIL = "policy_fail";
const PHASE_FITNESS = "fitness_ready";
const PHASE_SELECT = "select";
const PHASE_REFLECT = "reflect_done";
const PHASE_DONE = "done";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function chooseParents(state: EvolutionState, targetId: string, op: Operation): string[] {
  const target = state.targets[targetId];
  const objectives = state.config.objectives;
  const pareto = target.pareto_branches;
  const active = state.active_branches[targetId] ?? [];

  if (op === Operation.MUTATE || op === Operation.STRUCTURAL) {
    if (pareto.length > 0) return [randomChoice(pareto)];
    if (target.current_best_branch) return [target.current_best_branch];
    return [state.seed_branch];
  }

  // CROSSOVER — need two distinct parents.
  if (pareto.length >= 2) return randomSample(pareto, 2);

  const activeInds = active
    .filter((b) => b in state.individuals && state.individuals[b].success)
    .map((b) => state.individuals[b]);
  const pairs = rankSelect(activeInds, 1, objectives);
  if (pairs.length > 0) return [pairs[0][0].branch, pairs[0][1].branch];
  if (target.current_best_branch) return [target.current_best_branch];
  return [state.seed_branch];
}

function calcImprovement(state: EvolutionState): Record<string, string> | null {
  if (!state.seed_obj || !state.best_obj_overall) return null;
  const result: Record<string, string> = {};
  for (let i = 0; i < state.config.objectives.length; i++) {
    const seedVal = state.seed_obj[i];
    const bestVal = state.best_obj_overall[i];
    if (seedVal === 0) continue;
    const pct = ((bestVal - seedVal) / Math.abs(seedVal)) * 100;
    result[state.config.objectives[i].name] = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function writeDirectionsToMemory(directions: string[], repoPath: string): void {
  const memDir = join(repoPath, "memory", "global");
  mkdirSync(memDir, { recursive: true });
  const memFile = join(memDir, "long_term.md");
  const lines = ["# User-specified optimization directions\n"];
  for (const d of directions) lines.push(`- ${d}\n`);
  lines.push("\n");
  const existing = existsSync(memFile) ? readFileSync(memFile, "utf-8") : "";
  writeFileSync(memFile, lines.join("") + existing);
}

function inheritFromParent(state: EvolutionState, newTarget: Target, parentId: string): void {
  if (parentId in state.targets) {
    const parent = state.targets[parentId];
    if (parent.pareto_branches.length > 0) {
      state.active_branches[newTarget.id] = [...parent.pareto_branches];
    }
    if (parent.current_best_branch && !newTarget.current_best_branch) {
      newTarget.current_best_branch = parent.current_best_branch;
      newTarget.current_best_obj = parent.current_best_obj;
    }
  }

  const srcDir = join(state.config.repo_path, "memory", "targets", parentId);
  const dstDir = join(state.config.repo_path, "memory", "targets", newTarget.id);
  if (existsSync(srcDir)) {
    mkdirSync(dstDir, { recursive: true });
    for (const name of readdirSync(srcDir)) {
      const srcFile = join(srcDir, name);
      const dstFile = join(dstDir, name);
      const note = `# inherited from target '${parentId}' after structural op\n\n`;
      const existing = readFileSync(srcFile, "utf-8");
      writeFileSync(dstFile, note + existing);
    }
  }
}

function gitExec(repoPath: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", repoPath, ...args], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Core tool implementations
// ---------------------------------------------------------------------------

function beginGenerationImpl(state: EvolutionState): Record<string, unknown> {
  const budgetRemaining = state.config.max_fe - state.total_evals;
  if (budgetRemaining <= 0) {
    return { action: PHASE_DONE, reason: "budget exhausted", total_evals: state.total_evals };
  }

  const plan = planGeneration(
    state.targets, state.config.pop_size, state.config.mutation_rate,
    state.config.structural_rate, budgetRemaining,
    state.config.synergy_interval, state.generation,
  );

  const batch: BatchItem[] = [];
  const varCounter: Record<string, number> = {};

  for (const item of plan) {
    const tid = item.target_id;
    const op = item.operation;
    for (let c = 0; c < item.count; c++) {
      const key = `${tid}/${op}`;
      const idx = varCounter[key] ?? 0;
      varCounter[key] = idx + 1;

      if (op === Operation.SYNERGY) {
        const b = `gen-${state.generation}/synergy/${tid}-${idx}`;
        const parts = tid.split("+");
        const parents = parts
          .filter((p) => p in state.targets && state.targets[p].current_best_branch)
          .map((p) => state.targets[p].current_best_branch!);
        batch.push({
          branch: b, operation: op, target_id: tid,
          parent_branches: parents, target_file: "", target_function: "",
          target_description: "", target_hint: "", structural_op: "",
        });
      } else {
        const target = state.targets[tid];
        const b = `gen-${state.generation}/${tid}/${op}-${idx}`;
        const parents = chooseParents(state, tid, op);
        const structuralOp = op === Operation.STRUCTURAL ? randomChoice(STRUCTURAL_OPS) : "";
        batch.push({
          branch: b, operation: op, target_id: tid,
          parent_branches: parents, target_file: target.file,
          target_function: target.function, target_description: target.description,
          target_hint: target.hint, structural_op: structuralOp,
        });
      }
    }
  }

  state.current_batch = batch;
  state.batch_cursor = 0;
  save();

  if (batch.length === 0) {
    return { action: PHASE_DONE, reason: "empty batch", total_evals: state.total_evals };
  }

  return {
    action: "dispatch_workers",
    generation: state.generation,
    batch_size: batch.length,
    objectives: state.config.objectives.map((o) => ({ name: o.name, direction: o.direction })),
    benchmark_format: state.config.benchmark.output_format,
    items: batch,
  };
}

function evoSelectSurvivorsImpl(): SurvivorResult {
  const state = getState();
  const objectives = state.config.objectives;
  const allKeep: string[] = [];
  const allEliminate: string[] = [];

  for (const [targetId, branches] of Object.entries(state.active_branches)) {
    const inds = branches.filter((b) => b in state.individuals).map((b) => state.individuals[b]);
    const { keep, eliminate } = selectSurvivors(inds, state.config.top_k_survive, objectives);

    const keepBranches = keep.map((ind) => ind.branch);
    const elimBranches = eliminate.map((ind) => ind.branch);

    for (const pfBranch of state.pareto_front) {
      const elimIdx = elimBranches.indexOf(pfBranch);
      if (elimIdx !== -1) {
        elimBranches.splice(elimIdx, 1);
        if (!keepBranches.includes(pfBranch)) keepBranches.push(pfBranch);
      }
    }

    state.active_branches[targetId] = keepBranches;
    allKeep.push(...keepBranches);
    allEliminate.push(...elimBranches);

    if (targetId in state.targets) {
      const target = state.targets[targetId];
      const genInds = branches
        .filter((b) => b in state.individuals
          && state.individuals[b].generation === state.generation
          && state.individuals[b].success
          && state.individuals[b].fitness !== null)
        .map((b) => state.individuals[b]);
      const prevFront = target.pareto_branches.filter(
        (b) => b in state.individuals && state.individuals[b].generation < state.generation,
      );
      if (paretoFrontExpanded(genInds, prevFront, state.individuals, objectives)) {
        target.stagnation_count = 0;
      } else {
        target.stagnation_count++;
      }
    }
    updateTargetPareto(state, targetId);
  }

  updateGlobalPareto(state);
  updateTemperatures(state.targets);
  state.generation++;
  save();

  return {
    keep: allKeep,
    eliminate: allEliminate,
    best_branch: state.best_branch_overall ?? state.seed_branch,
    best_obj: state.best_obj_overall,
    pareto_front_size: state.pareto_front.length,
  };
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export default function (api: any) {
  // ── evo_init ───────────────────────────────────────────────────────────
  api.registerTool({
    name: "evo_init",
    description: "Initialize a new evolution run.",
    parameters: {
      type: "object",
      properties: {
        repo_path: { type: "string", description: "Path to the target git repository." },
        benchmark_cmd: { type: "string", description: "Shell command that evaluates a code variant." },
        objectives: {
          type: "array", items: { type: "object", properties: { name: { type: "string" }, direction: { type: "string", enum: ["min", "max"] } }, required: ["name", "direction"] },
          description: 'List of objectives. Defaults to [{"name":"score","direction":"min"}].',
        },
        benchmark_format: { type: "string", enum: ["numbers", "json"], default: "numbers" },
        max_fe: { type: "number", default: 500 },
        pop_size: { type: "number", default: 8 },
        mutation_rate: { type: "number", default: 0.5 },
        structural_rate: { type: "number", default: 0.2 },
        synergy_interval: { type: "number", default: 3 },
        top_k_survive: { type: "number", default: 5 },
        quick_cmd: { type: "string", default: "" },
        directions: { type: "array", items: { type: "string" }, description: "Domain knowledge hints." },
      },
      required: ["repo_path", "benchmark_cmd"],
    },
    async execute(_id: string, params: any) {
      const objectives = params.objectives ?? [{ name: "score", direction: "min" }];
      const objSpecs: ObjectiveSpec[] = objectives.map((o: any) => ({
        name: o.name, direction: o.direction as Objective,
      }));
      const config = {
        repo_path: params.repo_path,
        benchmark: {
          cmd: params.benchmark_cmd,
          output_format: (params.benchmark_format ?? "numbers") as BenchmarkOutputFormat,
          quick_cmd: params.quick_cmd || null,
        },
        objectives: objSpecs,
        max_fe: params.max_fe ?? 500,
        pop_size: params.pop_size ?? 8,
        mutation_rate: params.mutation_rate ?? 0.5,
        structural_rate: params.structural_rate ?? 0.2,
        directions: params.directions ?? [],
        synergy_interval: params.synergy_interval ?? 3,
        top_k_survive: params.top_k_survive ?? 5,
        protected_patterns: DEFAULT_PROTECTED_PATTERNS,
      };
      const state = createDefaultState(config);
      setState(state);
      save();
      if (config.directions.length > 0) writeDirectionsToMemory(config.directions, config.repo_path);
      const result = {
        status: "initialized", repo_path: config.repo_path,
        objectives: objSpecs.map((o) => ({ name: o.name, direction: o.direction })),
        benchmark_format: config.benchmark.output_format,
        max_fe: config.max_fe, pop_size: config.pop_size,
        structural_rate: config.structural_rate,
        directions_loaded: config.directions.length,
      };
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  });

  // ── evo_register_targets ───────────────────────────────────────────────
  api.registerTool({
    name: "evo_register_targets",
    description: "Register optimization targets identified by code analysis.",
    parameters: {
      type: "object",
      properties: {
        targets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" }, file: { type: "string" }, function: { type: "string" },
              description: { type: "string" }, hint: { type: "string" },
              impact: { type: "string" }, derived_from: { type: "array", items: { type: "string" } },
            },
            required: ["id", "file", "function"],
          },
        },
      },
      required: ["targets"],
    },
    async execute(_id: string, params: any) {
      const state = getState();
      const inherited: string[] = [];
      for (const t of params.targets) {
        const target = createDefaultTarget(t);
        state.targets[target.id] = target;
        state.active_branches[target.id] = [];
        for (const parentId of target.derived_from) {
          inheritFromParent(state, target, parentId);
          inherited.push(`${target.id} <- ${parentId}`);
        }
      }
      save();
      return { content: [{ type: "text", text: JSON.stringify({ registered: params.targets.length, target_ids: params.targets.map((t: any) => t.id), inherited }) }] };
    },
  });

  // ── evo_report_seed ────────────────────────────────────────────────────
  api.registerTool({
    name: "evo_report_seed",
    description: "Report the seed baseline fitness.",
    parameters: {
      type: "object",
      properties: { fitness_values: { type: "array", items: { type: "number" }, description: "Objective values of the unmodified seed code." } },
      required: ["fitness_values"],
    },
    async execute(_id: string, params: any) {
      const state = getState();
      state.seed_obj = params.fitness_values;
      state.best_obj_overall = params.fitness_values;
      state.total_evals++;
      for (const target of Object.values(state.targets)) target.current_best_obj = params.fitness_values;
      save();
      return { content: [{ type: "text", text: JSON.stringify({ seed_obj: params.fitness_values, objectives: state.config.objectives.map((o) => o.name), total_evals: state.total_evals }) }] };
    },
  });

  // ── evo_next_batch ─────────────────────────────────────────────────────
  api.registerTool({
    name: "evo_next_batch",
    description: "Get the next batch of operations to execute.",
    parameters: { type: "object", properties: {} },
    async execute() {
      const state = getState();
      const budgetRemaining = state.config.max_fe - state.total_evals;
      if (budgetRemaining <= 0) return { content: [{ type: "text", text: JSON.stringify({ done: true, reason: "budget exhausted", batch: [] }) }] };

      const plan = planGeneration(state.targets, state.config.pop_size, state.config.mutation_rate, state.config.structural_rate, budgetRemaining, state.config.synergy_interval, state.generation);
      const batch: BatchItem[] = [];
      const varCounter: Record<string, number> = {};

      for (const item of plan) {
        const tid = item.target_id, op = item.operation;
        for (let c = 0; c < item.count; c++) {
          const key = `${tid}/${op}`;
          const idx = varCounter[key] ?? 0;
          varCounter[key] = idx + 1;

          if (op === Operation.SYNERGY) {
            const branch = `gen-${state.generation}/synergy/${tid}-${idx}`;
            const parts = tid.split("+");
            const parents = parts.filter((p) => p in state.targets && state.targets[p].current_best_branch).map((p) => state.targets[p].current_best_branch!);
            batch.push({ branch, operation: op, target_id: tid, parent_branches: parents, target_file: "", target_function: "", target_description: "", target_hint: "", structural_op: "" });
          } else {
            const target = state.targets[tid];
            const branch = `gen-${state.generation}/${tid}/${op}-${idx}`;
            const parents = chooseParents(state, tid, op);
            const structuralOp = op === Operation.STRUCTURAL ? randomChoice(STRUCTURAL_OPS) : "";
            batch.push({ branch, operation: op, target_id: tid, parent_branches: parents, target_file: target.file, target_function: target.function, target_description: target.description, target_hint: target.hint, structural_op: structuralOp });
          }
        }
      }

      state.current_batch = batch;
      state.batch_cursor = 0;
      save();

      return { content: [{ type: "text", text: JSON.stringify({ generation: state.generation, budget_remaining: budgetRemaining, objectives: state.config.objectives.map((o) => ({ name: o.name, direction: o.direction })), benchmark_format: state.config.benchmark.output_format, batch_size: batch.length, batch }) }] };
    },
  });

  // ── evo_report_fitness ─────────────────────────────────────────────────
  api.registerTool({
    name: "evo_report_fitness",
    description: "Report the fitness evaluation result for a branch.",
    parameters: {
      type: "object",
      properties: {
        branch: { type: "string" }, target_id: { type: "string" },
        operation: { type: "string", enum: ["mutate", "crossover", "structural", "synergy"] },
        parent_branches: { type: "array", items: { type: "string" } },
        fitness_values: { type: "array", items: { type: "number" } },
        success: { type: "boolean" },
        code_hash: { type: "string", default: "" },
        raw_output: { type: "string", default: "" },
      },
      required: ["branch", "target_id", "operation", "parent_branches", "fitness_values", "success"],
    },
    async execute(_id: string, params: any) {
      const state = getState();
      const nObj = state.config.objectives.length;
      if (params.success && params.fitness_values.length !== nObj) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `fitness_values has ${params.fitness_values.length} element(s) but ${nObj} objective(s) are configured. Pass one value per objective.` }) }] };
      }
      if (params.code_hash && params.code_hash in state.fitness_cache) {
        state.total_evals++;
        save();
        return { content: [{ type: "text", text: JSON.stringify({ cached: true, fitness_values: state.fitness_cache[params.code_hash], branch: params.branch }) }] };
      }
      const ind: Individual = {
        branch: params.branch, generation: state.generation, target_id: params.target_id,
        operation: params.operation as Operation, parent_branches: params.parent_branches,
        fitness: params.success ? params.fitness_values : null,
        pareto_rank: null, success: params.success,
        code_hash: params.code_hash || null,
        raw_output: params.raw_output ? params.raw_output.slice(0, 500) : null,
        timestamp: Date.now() / 1000,
      };
      state.individuals[params.branch] = ind;
      state.total_evals++;
      if (params.code_hash && params.success) state.fitness_cache[params.code_hash] = params.fitness_values;
      if (!(params.target_id in state.active_branches)) state.active_branches[params.target_id] = [];
      if (params.success) {
        state.active_branches[params.target_id].push(params.branch);
        updateTargetPareto(state, params.target_id);
        updateGlobalPareto(state);
      }
      save();
      return { content: [{ type: "text", text: JSON.stringify({ branch: params.branch, fitness_values: params.success ? params.fitness_values : null, success: params.success, total_evals: state.total_evals, on_pareto_front: state.pareto_front.includes(params.branch) }) }] };
    },
  });

  // ── evo_select_survivors ───────────────────────────────────────────────
  api.registerTool({
    name: "evo_select_survivors",
    description: "Run NSGA-II selection at end of generation.",
    parameters: { type: "object", properties: {} },
    async execute() {
      const result = evoSelectSurvivorsImpl();
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  });

  // ── evo_get_status ─────────────────────────────────────────────────────
  api.registerTool({
    name: "evo_get_status",
    description: "Get current evolution status.",
    parameters: { type: "object", properties: {} },
    async execute() {
      const state = getState();
      const targetStatus: Record<string, unknown> = {};
      for (const [tid, target] of Object.entries(state.targets)) {
        targetStatus[tid] = {
          status: target.status, temperature: Math.round(target.temperature * 100) / 100,
          current_best_obj: target.current_best_obj, current_best_branch: target.current_best_branch,
          pareto_front_size: target.pareto_branches.length, stagnation: target.stagnation_count,
          active_branches: (state.active_branches[tid] ?? []).length,
        };
      }
      const paretoSummary = state.pareto_front.filter((b) => b in state.individuals).map((b) => ({
        branch: b, fitness: state.individuals[b].fitness,
        generation: state.individuals[b].generation, target_id: state.individuals[b].target_id,
      }));
      return { content: [{ type: "text", text: JSON.stringify({
        generation: state.generation, total_evals: state.total_evals,
        budget_remaining: state.config.max_fe - state.total_evals,
        objectives: state.config.objectives.map((o) => ({ name: o.name, direction: o.direction })),
        seed_obj: state.seed_obj, best_obj_overall: state.best_obj_overall,
        best_branch_overall: state.best_branch_overall,
        pareto_front_size: state.pareto_front.length, pareto_front: paretoSummary,
        improvement: calcImprovement(state), targets: targetStatus,
      }) }] };
    },
  });

  // ── evo_get_lineage ────────────────────────────────────────────────────
  api.registerTool({
    name: "evo_get_lineage",
    description: "Trace the full ancestry of a branch.",
    parameters: { type: "object", properties: { branch: { type: "string" } }, required: ["branch"] },
    async execute(_id: string, params: any) {
      const state = getState();
      const lineage: Record<string, unknown>[] = [];
      const visited = new Set<string>();
      const queue = [params.branch];
      while (queue.length > 0) {
        const b = queue.shift()!;
        if (visited.has(b) || !(b in state.individuals)) continue;
        visited.add(b);
        const ind = state.individuals[b];
        lineage.push({ branch: ind.branch, generation: ind.generation, target_id: ind.target_id, operation: ind.operation, parent_branches: ind.parent_branches, fitness: ind.fitness, pareto_rank: ind.pareto_rank, success: ind.success });
        queue.push(...ind.parent_branches);
      }
      return { content: [{ type: "text", text: JSON.stringify({ branch: params.branch, lineage }) }] };
    },
  });

  // ── evo_freeze_target ──────────────────────────────────────────────────
  api.registerTool({
    name: "evo_freeze_target",
    description: "Freeze a target — stop evolving it.",
    parameters: { type: "object", properties: { target_id: { type: "string" } }, required: ["target_id"] },
    async execute(_id: string, params: any) {
      const state = getState();
      if (!(params.target_id in state.targets)) return { content: [{ type: "text", text: JSON.stringify({ error: `Target '${params.target_id}' not found` }) }] };
      state.targets[params.target_id].status = TargetStatus.FROZEN;
      state.targets[params.target_id].temperature = 0;
      save();
      return { content: [{ type: "text", text: JSON.stringify({ target_id: params.target_id, status: "frozen" }) }] };
    },
  });

  // ── evo_boost_target ───────────────────────────────────────────────────
  api.registerTool({
    name: "evo_boost_target",
    description: "Boost a target — increase its evolution priority.",
    parameters: { type: "object", properties: { target_id: { type: "string" } }, required: ["target_id"] },
    async execute(_id: string, params: any) {
      const state = getState();
      if (!(params.target_id in state.targets)) return { content: [{ type: "text", text: JSON.stringify({ error: `Target '${params.target_id}' not found` }) }] };
      const target = state.targets[params.target_id];
      target.status = TargetStatus.ACTIVE;
      target.temperature = Math.min(3.0, target.temperature + 1.0);
      target.stagnation_count = 0;
      save();
      return { content: [{ type: "text", text: JSON.stringify({ target_id: params.target_id, temperature: target.temperature }) }] };
    },
  });

  // ── evo_record_synergy ─────────────────────────────────────────────────
  api.registerTool({
    name: "evo_record_synergy",
    description: "Record the result of a synergy experiment.",
    parameters: {
      type: "object",
      properties: {
        branch: { type: "string" }, target_ids: { type: "array", items: { type: "string" } },
        fitness_values: { type: "array", items: { type: "number" } }, success: { type: "boolean" },
        individual_fitnesses: { type: "object", additionalProperties: { type: "array", items: { type: "number" } } },
      },
      required: ["branch", "target_ids", "fitness_values", "success"],
    },
    async execute(_id: string, params: any) {
      const state = getState();
      const objectives = state.config.objectives;
      let gain: Record<string, number> | null = null;
      if (params.individual_fitnesses && params.success) {
        gain = {};
        for (let i = 0; i < objectives.length; i++) {
          const vals = Object.values(params.individual_fitnesses as Record<string, number[]>).map((v) => v[i]).filter((v) => v !== undefined);
          if (vals.length === 0) continue;
          const individualBest = objectives[i].direction === Objective.MIN ? Math.min(...vals) : Math.max(...vals);
          const combined = params.fitness_values[i];
          gain[objectives[i].name] = objectives[i].direction === Objective.MIN ? individualBest - combined : combined - individualBest;
        }
      }
      const record = { branch: params.branch, generation: state.generation, target_ids: params.target_ids, fitness_values: params.fitness_values, success: params.success, individual_fitnesses: params.individual_fitnesses, synergy_gain: gain };
      state.synergy_records.push(record);
      save();
      return { content: [{ type: "text", text: JSON.stringify(record) }] };
    },
  });

  // ── evo_check_cache ────────────────────────────────────────────────────
  api.registerTool({
    name: "evo_check_cache",
    description: "Check if a code variant was already evaluated.",
    parameters: { type: "object", properties: { code_hash: { type: "string" } }, required: ["code_hash"] },
    async execute(_id: string, params: any) {
      const state = getState();
      if (params.code_hash in state.fitness_cache) return { content: [{ type: "text", text: JSON.stringify({ cached: true, fitness_values: state.fitness_cache[params.code_hash] }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ cached: false }) }] };
    },
  });

  // ── evo_step — stateless loop driver ───────────────────────────────────
  api.registerTool({
    name: "evo_step",
    description: "Multi-agent evolution loop driver. Called by OrchestratorAgent and WorkerAgents to advance the evolution.",
    parameters: {
      type: "object",
      properties: {
        phase: { type: "string", enum: [PHASE_BEGIN, PHASE_CODE, PHASE_POLICY_PASS, PHASE_POLICY_FAIL, PHASE_FITNESS, PHASE_SELECT, PHASE_REFLECT] },
        branch: { type: "string", default: "" }, parent_commit: { type: "string", default: "" },
        fitness_values: { type: "array", items: { type: "number" } },
        success: { type: "boolean", default: true },
        operation: { type: "string", default: "" }, target_id: { type: "string", default: "" },
        parent_branches: { type: "array", items: { type: "string" } },
        code_hash: { type: "string", default: "" }, raw_output: { type: "string", default: "" },
        reason: { type: "string", default: "" },
      },
      required: ["phase"],
    },
    async execute(_id: string, params: any) {
      const state = getState();
      const pb: string[] = params.parent_branches ?? [];

      // begin_generation
      if (params.phase === PHASE_BEGIN) {
        const result = beginGenerationImpl(state);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      // code_ready
      if (params.phase === PHASE_CODE) {
        if (!params.branch) return { content: [{ type: "text", text: JSON.stringify({ error: "branch is required for phase 'code_ready'" }) }] };
        const item = state.current_batch.find((it) => it.branch === params.branch);
        let parent = params.parent_commit || "";
        if (!parent && item && item.parent_branches.length > 0) {
          parent = gitExec(state.config.repo_path, ["rev-parse", item.parent_branches[0]]);
        }
        if (!parent) return { content: [{ type: "text", text: JSON.stringify({ error: "Cannot determine parent commit for policy check. Pass parent_commit= explicitly." }) }] };
        const changedFiles = gitExec(state.config.repo_path, ["diff", "--name-only", `${parent}..${params.branch}`]).split("\n").filter(Boolean);
        const diff = gitExec(state.config.repo_path, ["diff", `${parent}..${params.branch}`]).slice(0, 8000);
        return { content: [{ type: "text", text: JSON.stringify({
          action: "check_policy", branch: params.branch, parent_commit: parent,
          target_id: item?.target_id ?? "", target_file: item?.target_file ?? "",
          operation: item?.operation ?? "", parent_branches: item?.parent_branches ?? [],
          changed_files: changedFiles, diff, protected_patterns: state.config.protected_patterns,
        }) }] };
      }

      // policy_pass
      if (params.phase === PHASE_POLICY_PASS) {
        if (!params.branch) return { content: [{ type: "text", text: JSON.stringify({ error: "branch is required for phase 'policy_pass'" }) }] };
        const item = state.current_batch.find((it) => it.branch === params.branch);
        return { content: [{ type: "text", text: JSON.stringify({
          action: "run_benchmark", branch: params.branch,
          benchmark_cmd: state.config.benchmark.cmd, quick_cmd: state.config.benchmark.quick_cmd,
          benchmark_format: state.config.benchmark.output_format,
          objectives: state.config.objectives.map((o) => ({ name: o.name, direction: o.direction })),
          target_id: item?.target_id ?? params.target_id,
          operation: item?.operation ?? params.operation,
          parent_branches: item?.parent_branches ?? pb,
        }) }] };
      }

      // policy_fail
      if (params.phase === PHASE_POLICY_FAIL) {
        if (!params.branch) return { content: [{ type: "text", text: JSON.stringify({ error: "branch is required for phase 'policy_fail'" }) }] };
        const item = state.current_batch.find((it) => it.branch === params.branch);
        const failReason = params.reason || params.raw_output || "policy violation";
        const ind: Individual = {
          branch: params.branch, generation: state.generation,
          target_id: item?.target_id ?? params.target_id,
          operation: item?.operation ?? Operation.MUTATE,
          parent_branches: item?.parent_branches ?? pb,
          fitness: null, pareto_rank: null, success: false,
          code_hash: null, raw_output: `policy_violation: ${failReason}`,
          timestamp: Date.now() / 1000,
        };
        state.individuals[params.branch] = ind;
        save();
        return { content: [{ type: "text", text: JSON.stringify({ action: "worker_done", branch: params.branch, rejected: true, reason: failReason }) }] };
      }

      // fitness_ready
      if (params.phase === PHASE_FITNESS) {
        const fv: number[] = params.fitness_values ?? [];
        const nObj = state.config.objectives.length;
        if (params.success && fv.length !== nObj) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `fitness_values has ${fv.length} element(s) but ${nObj} objective(s) are configured. Pass one value per objective.` }) }] };
        }
        if (params.code_hash && params.code_hash in state.fitness_cache) {
          state.total_evals++;
          save();
          return { content: [{ type: "text", text: JSON.stringify({ action: "worker_done", branch: params.branch, cached: true, fitness_values: state.fitness_cache[params.code_hash], total_evals: state.total_evals }) }] };
        }
        const ind: Individual = {
          branch: params.branch, generation: state.generation, target_id: params.target_id,
          operation: (params.operation || Operation.MUTATE) as Operation,
          parent_branches: pb, fitness: params.success ? fv : null,
          pareto_rank: null, success: params.success,
          code_hash: params.code_hash || null,
          raw_output: params.raw_output ? params.raw_output.slice(0, 500) : null,
          timestamp: Date.now() / 1000,
        };
        state.individuals[params.branch] = ind;
        state.total_evals++;
        if (params.code_hash && params.success) state.fitness_cache[params.code_hash] = fv;
        if (!(params.target_id in state.active_branches)) state.active_branches[params.target_id] = [];
        if (params.success) {
          state.active_branches[params.target_id].push(params.branch);
          updateTargetPareto(state, params.target_id);
          updateGlobalPareto(state);
        }
        save();
        return { content: [{ type: "text", text: JSON.stringify({ action: "worker_done", branch: params.branch, fitness_values: params.success ? fv : null, success: params.success, on_pareto_front: state.pareto_front.includes(params.branch), total_evals: state.total_evals }) }] };
      }

      // select
      if (params.phase === PHASE_SELECT) {
        const result = evoSelectSurvivorsImpl();
        return { content: [{ type: "text", text: JSON.stringify({ ...result, action: "reflect" }) }] };
      }

      // reflect_done
      if (params.phase === PHASE_REFLECT) {
        const budgetRemaining = state.config.max_fe - state.total_evals;
        if (budgetRemaining <= 0) {
          return { content: [{ type: "text", text: JSON.stringify({ action: PHASE_DONE, reason: "budget exhausted", total_evals: state.total_evals, best_obj: state.best_obj_overall, pareto_front_size: state.pareto_front.length }) }] };
        }
        const result = beginGenerationImpl(state);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }

      return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown phase: '${params.phase}'.` }) }] };
    },
  });

  // ── evo_revalidate_targets ─────────────────────────────────────────────
  api.registerTool({
    name: "evo_revalidate_targets",
    description: "Check that all registered targets still exist in the repo after a structural op.",
    parameters: { type: "object", properties: {} },
    async execute() {
      const state = getState();
      const repo = state.config.repo_path;
      const valid: string[] = [];
      const missing: string[] = [];
      for (const [tid, target] of Object.entries(state.targets)) {
        if (target.status === TargetStatus.FROZEN) continue;
        const filePath = join(repo, target.file);
        if (!existsSync(filePath)) { missing.push(tid); continue; }
        const grepResult = gitExec(repo, ["grep", "-n", `def ${target.function}`, "--", target.file]);
        if (!grepResult) missing.push(tid);
        else valid.push(tid);
      }
      return { content: [{ type: "text", text: JSON.stringify({ valid, missing }) }] };
    },
  });
}
