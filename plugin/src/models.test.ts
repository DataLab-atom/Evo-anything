import { describe, it, expect } from "vitest";
import {
  Objective,
  ObjectiveSpec,
  BenchmarkOutputFormat,
  Operation,
  TargetStatus,
  createDefaultTarget,
  createDefaultState,
  DEFAULT_PROTECTED_PATTERNS,
  type EvolutionConfig,
  type Target,
  type Individual,
  type BatchItem,
  type SurvivorResult,
  type EvolutionState,
  type DerivationNode,
  type ConvergencePoint,
  type DerivationForest,
} from "./models.js";

// ---------------------------------------------------------------------------
// Enum values
// ---------------------------------------------------------------------------

describe("Objective enum", () => {
  it("has MIN and MAX values", () => {
    expect(Objective.MIN).toBe("min");
    expect(Objective.MAX).toBe("max");
  });
});

describe("BenchmarkOutputFormat enum", () => {
  it("has JSON and NUMBERS values", () => {
    expect(BenchmarkOutputFormat.JSON).toBe("json");
    expect(BenchmarkOutputFormat.NUMBERS).toBe("numbers");
  });
});

describe("Operation enum", () => {
  it("has all four operation types", () => {
    expect(Operation.MUTATE).toBe("mutate");
    expect(Operation.CROSSOVER).toBe("crossover");
    expect(Operation.SYNERGY).toBe("synergy");
    expect(Operation.STRUCTURAL).toBe("structural");
  });
});

describe("TargetStatus enum", () => {
  it("has ACTIVE and FROZEN values", () => {
    expect(TargetStatus.ACTIVE).toBe("active");
    expect(TargetStatus.FROZEN).toBe("frozen");
  });
});

// ---------------------------------------------------------------------------
// createDefaultTarget
// ---------------------------------------------------------------------------

describe("createDefaultTarget", () => {
  it("creates a target with required fields only", () => {
    const t = createDefaultTarget({
      id: "t1",
      file: "main.py",
      function: "solve",
    });
    expect(t.id).toBe("t1");
    expect(t.file).toBe("main.py");
    expect(t.function).toBe("solve");
    expect(t.description).toBe("");
    expect(t.hint).toBe("");
    expect(t.derived_from).toEqual([]);
    expect(t.impact).toBe("medium");
    expect(t.status).toBe(TargetStatus.ACTIVE);
    expect(t.temperature).toBe(1.0);
    expect(t.current_best_obj).toBeNull();
    expect(t.current_best_branch).toBeNull();
    expect(t.pareto_branches).toEqual([]);
    expect(t.stagnation_count).toBe(0);
  });

  it("creates a target with all optional fields", () => {
    const t = createDefaultTarget({
      id: "t2",
      file: "algo.py",
      function: "optimize",
      description: "Optimize the solver",
      hint: "Use dynamic programming",
      impact: "high",
      derived_from: ["t1"],
    });
    expect(t.description).toBe("Optimize the solver");
    expect(t.hint).toBe("Use dynamic programming");
    expect(t.impact).toBe("high");
    expect(t.derived_from).toEqual(["t1"]);
  });

  it("preserves default status as ACTIVE", () => {
    const t = createDefaultTarget({ id: "x", file: "f", function: "g" });
    expect(t.status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// createDefaultState
// ---------------------------------------------------------------------------

describe("createDefaultState", () => {
  const config: EvolutionConfig = {
    repo_path: "/tmp/repo",
    benchmark: { cmd: "python bench.py", output_format: BenchmarkOutputFormat.JSON },
    objectives: [{ name: "score", direction: Objective.MAX }],
    max_fe: 100,
    pop_size: 10,
    mutation_rate: 0.7,
    structural_rate: 0.1,
    directions: ["max"],
    synergy_interval: 5,
    top_k_survive: 5,
    protected_patterns: [],
  };

  it("initializes all fields to defaults", () => {
    const s = createDefaultState(config);
    expect(s.config).toBe(config);
    expect(s.generation).toBe(0);
    expect(s.total_evals).toBe(0);
    expect(s.seed_obj).toBeNull();
    expect(s.seed_branch).toBe("seed-baseline");
    expect(s.best_obj_overall).toBeNull();
    expect(s.best_branch_overall).toBeNull();
    expect(s.pareto_front).toEqual([]);
    expect(s.targets).toEqual({});
    expect(s.individuals).toEqual({});
    expect(s.active_branches).toEqual({});
    expect(s.fitness_cache).toEqual({});
    expect(s.synergy_records).toEqual([]);
    expect(s.current_batch).toEqual([]);
    expect(s.batch_cursor).toBe(0);
  });

  it("does not share references between multiple calls", () => {
    const s1 = createDefaultState(config);
    const s2 = createDefaultState(config);
    s1.targets["x"] = createDefaultTarget({ id: "x", file: "f", function: "g" });
    expect(s2.targets).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_PROTECTED_PATTERNS
// ---------------------------------------------------------------------------

describe("DEFAULT_PROTECTED_PATTERNS", () => {
  it("contains expected glob patterns", () => {
    expect(DEFAULT_PROTECTED_PATTERNS).toContain("benchmark*.py");
    expect(DEFAULT_PROTECTED_PATTERNS).toContain("*.sh");
    expect(DEFAULT_PROTECTED_PATTERNS.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Type shape verification (compile-time + runtime structure check)
// ---------------------------------------------------------------------------

describe("interface shape verification", () => {
  it("Individual interface has all expected keys", () => {
    const ind: Individual = {
      branch: "evo/t1/gen1/m0",
      generation: 1,
      target_id: "t1",
      operation: Operation.MUTATE,
      parent_branches: [],
      fitness: [0.95],
      pareto_rank: 1,
      success: true,
      code_hash: "abc123",
      raw_output: null,
      timestamp: Date.now(),
    };
    expect(ind.branch).toBe("evo/t1/gen1/m0");
    expect(ind.operation).toBe("mutate");
    expect(ind.fitness).toEqual([0.95]);
  });

  it("BatchItem interface has all expected keys", () => {
    const item: BatchItem = {
      branch: "evo/t1/gen1/m0",
      operation: Operation.MUTATE,
      target_id: "t1",
      parent_branches: ["seed-baseline"],
      target_file: "main.py",
      target_function: "solve",
      target_description: "desc",
      target_hint: "hint",
      structural_op: "",
    };
    expect(item.target_id).toBe("t1");
  });

  it("SurvivorResult interface has all expected keys", () => {
    const sr: SurvivorResult = {
      keep: ["b1"],
      eliminate: ["b2"],
      best_branch: "b1",
      best_obj: [0.9],
      pareto_front_size: 1,
    };
    expect(sr.keep).toEqual(["b1"]);
  });

  it("DerivationNode interface has all expected keys", () => {
    const node: DerivationNode = {
      id: "n1",
      type: "hypothesis",
      content: "test",
      parent_ids: [],
      child_ids: [],
      source_branches: [],
      literature_refs: [],
      experiment_ids: [],
      status: "active",
      depth: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    expect(node.type).toBe("hypothesis");
    expect(node.status).toBe("active");
  });

  it("ConvergencePoint has verification_status", () => {
    const cp: ConvergencePoint = {
      id: "cp1",
      question: "Why does X improve Y?",
      contributing_node_ids: ["n1", "n2"],
      evidence_ids: [],
      verification_status: "pending",
    };
    expect(cp.verification_status).toBe("pending");
  });

  it("DerivationForest tracks iterations and status", () => {
    const f: DerivationForest = {
      id: "f1",
      evo_session_summary: "test session",
      nodes: {},
      convergence_points: [],
      contributions: [],
      iteration_count: 0,
      max_iterations: 20,
      status: "exploring",
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    expect(f.status).toBe("exploring");
    expect(f.max_iterations).toBe(20);
  });
});
