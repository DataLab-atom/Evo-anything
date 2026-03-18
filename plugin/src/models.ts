/**
 * Data models for evolution state.
 * TypeScript port of models.py — all Pydantic models become interfaces.
 */

export enum Objective {
  MIN = "min",
  MAX = "max",
}

export interface ObjectiveSpec {
  name: string;
  direction: Objective;
}

export enum BenchmarkOutputFormat {
  JSON = "json",
  NUMBERS = "numbers",
}

export interface BenchmarkSpec {
  cmd: string;
  output_format: BenchmarkOutputFormat;
  quick_cmd?: string | null;
}

export enum Operation {
  MUTATE = "mutate",
  CROSSOVER = "crossover",
  SYNERGY = "synergy",
  STRUCTURAL = "structural",
}

export enum TargetStatus {
  ACTIVE = "active",
  FROZEN = "frozen",
}

export interface Target {
  id: string;
  file: string;
  function: string;
  description: string;
  hint: string;
  derived_from: string[];
  impact: string;
  status: TargetStatus;
  temperature: number;
  current_best_obj: number[] | null;
  current_best_branch: string | null;
  pareto_branches: string[];
  stagnation_count: number;
}

export interface Individual {
  branch: string;
  generation: number;
  target_id: string;
  operation: Operation;
  parent_branches: string[];
  fitness: number[] | null;
  pareto_rank: number | null;
  success: boolean;
  code_hash: string | null;
  raw_output: string | null;
  timestamp: number;
}

export interface BatchItem {
  branch: string;
  operation: Operation;
  target_id: string;
  parent_branches: string[];
  target_file: string;
  target_function: string;
  target_description: string;
  target_hint: string;
  structural_op: string;
}

export interface SurvivorResult {
  keep: string[];
  eliminate: string[];
  best_branch: string;
  best_obj: number[] | null;
  pareto_front_size: number;
}

export interface EvolutionConfig {
  repo_path: string;
  benchmark: BenchmarkSpec;
  objectives: ObjectiveSpec[];
  max_fe: number;
  pop_size: number;
  mutation_rate: number;
  structural_rate: number;
  directions: string[];
  synergy_interval: number;
  top_k_survive: number;
  protected_patterns: string[];
}

export interface EvolutionState {
  config: EvolutionConfig;
  generation: number;
  total_evals: number;
  seed_obj: number[] | null;
  seed_branch: string;
  best_obj_overall: number[] | null;
  best_branch_overall: string | null;
  pareto_front: string[];
  targets: Record<string, Target>;
  individuals: Record<string, Individual>;
  active_branches: Record<string, string[]>;
  fitness_cache: Record<string, number[]>;
  synergy_records: Record<string, unknown>[];
  current_batch: BatchItem[];
  batch_cursor: number;
}

export function createDefaultTarget(t: {
  id: string;
  file: string;
  function: string;
  description?: string;
  hint?: string;
  impact?: string;
  derived_from?: string[];
}): Target {
  return {
    id: t.id,
    file: t.file,
    function: t.function,
    description: t.description ?? "",
    hint: t.hint ?? "",
    derived_from: t.derived_from ?? [],
    impact: t.impact ?? "medium",
    status: TargetStatus.ACTIVE,
    temperature: 1.0,
    current_best_obj: null,
    current_best_branch: null,
    pareto_branches: [],
    stagnation_count: 0,
  };
}

export function createDefaultState(config: EvolutionConfig): EvolutionState {
  return {
    config,
    generation: 0,
    total_evals: 0,
    seed_obj: null,
    seed_branch: "seed-baseline",
    best_obj_overall: null,
    best_branch_overall: null,
    pareto_front: [],
    targets: {},
    individuals: {},
    active_branches: {},
    fitness_cache: {},
    synergy_records: [],
    current_batch: [],
    batch_cursor: 0,
  };
}

export const DEFAULT_PROTECTED_PATTERNS: string[] = [
  "benchmark*.py",
  "eval*.py",
  "evaluate*.py",
  "run_eval*",
  "test_bench*",
  "*.sh",
];
