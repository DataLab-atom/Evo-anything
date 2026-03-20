import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  save,
  getState,
  setState,
  updateGlobalPareto,
  updateTargetPareto,
  paretoFrontExpanded,
} from "./state.js";
import {
  Objective,
  Operation,
  BenchmarkOutputFormat,
  TargetStatus,
  createDefaultState,
  createDefaultTarget,
  type EvolutionConfig,
  type EvolutionState,
  type Individual,
  type ObjectiveSpec,
} from "./models.js";

// ---------------------------------------------------------------------------
// Mock fs to avoid actual disk I/O
// ---------------------------------------------------------------------------

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(): EvolutionConfig {
  return {
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
}

function makeInd(branch: string, fitness: number[] | null, success = true): Individual {
  return {
    branch,
    generation: 1,
    target_id: "t1",
    operation: Operation.MUTATE,
    parent_branches: [],
    fitness,
    pareto_rank: null,
    success,
    code_hash: null,
    raw_output: null,
    timestamp: Date.now(),
  };
}

const maxObj: ObjectiveSpec[] = [{ name: "score", direction: Objective.MAX }];
const multiObj: ObjectiveSpec[] = [
  { name: "accuracy", direction: Objective.MAX },
  { name: "latency", direction: Objective.MIN },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("setState / getState", () => {
  it("setState then getState returns same state", () => {
    const s = createDefaultState(makeConfig());
    setState(s);
    expect(getState()).toBe(s);
  });

  it("getState throws when no state is set and no file exists", () => {
    setState(null as unknown as EvolutionState);
    expect(() => getState()).toThrow("Evolution not initialized");
  });
});

describe("save", () => {
  it("does not throw when state is set", () => {
    setState(createDefaultState(makeConfig()));
    expect(() => save()).not.toThrow();
  });
});

// ===========================================================================
// updateGlobalPareto
// ===========================================================================

describe("updateGlobalPareto", () => {
  let state: EvolutionState;

  beforeEach(() => {
    state = createDefaultState(makeConfig());
  });

  it("does nothing when no individuals", () => {
    updateGlobalPareto(state);
    expect(state.pareto_front).toEqual([]);
    expect(state.best_branch_overall).toBeNull();
  });

  it("sets pareto front with a single successful individual", () => {
    state.individuals["b1"] = makeInd("b1", [0.9]);
    updateGlobalPareto(state);
    expect(state.pareto_front).toEqual(["b1"]);
    expect(state.best_branch_overall).toBe("b1");
    expect(state.best_obj_overall).toEqual([0.9]);
  });

  it("filters out failed individuals", () => {
    state.individuals["ok"] = makeInd("ok", [0.8]);
    state.individuals["fail"] = makeInd("fail", [0.95], false);
    updateGlobalPareto(state);
    expect(state.pareto_front).toEqual(["ok"]);
  });

  it("filters out individuals with null fitness", () => {
    state.individuals["ok"] = makeInd("ok", [0.8]);
    state.individuals["null"] = makeInd("null", null);
    updateGlobalPareto(state);
    expect(state.pareto_front).toEqual(["ok"]);
  });

  it("selects the best individual as representative", () => {
    state.individuals["a"] = makeInd("a", [0.7]);
    state.individuals["b"] = makeInd("b", [0.95]);
    state.individuals["c"] = makeInd("c", [0.85]);
    updateGlobalPareto(state);
    expect(state.best_branch_overall).toBe("b");
    expect(state.best_obj_overall).toEqual([0.95]);
  });

  it("handles multi-objective Pareto front", () => {
    state.config.objectives = multiObj;
    state.individuals["a"] = makeInd("a", [0.9, 30]);
    state.individuals["b"] = makeInd("b", [0.8, 20]);
    state.individuals["c"] = makeInd("c", [0.7, 40]);
    updateGlobalPareto(state);
    // a and b are non-dominating, c is dominated by b
    expect(state.pareto_front).toContain("a");
    expect(state.pareto_front).toContain("b");
    expect(state.pareto_front).not.toContain("c");
  });
});

// ===========================================================================
// updateTargetPareto
// ===========================================================================

describe("updateTargetPareto", () => {
  let state: EvolutionState;

  beforeEach(() => {
    state = createDefaultState(makeConfig());
    state.targets["t1"] = createDefaultTarget({ id: "t1", file: "f.py", function: "fn" });
  });

  it("does nothing for nonexistent target", () => {
    updateTargetPareto(state, "nonexistent");
    // No error thrown
  });

  it("does nothing when no active branches", () => {
    updateTargetPareto(state, "t1");
    expect(state.targets["t1"].pareto_branches).toEqual([]);
  });

  it("sets target pareto with active branches", () => {
    state.active_branches["t1"] = ["b1", "b2"];
    state.individuals["b1"] = makeInd("b1", [0.9]);
    state.individuals["b2"] = makeInd("b2", [0.7]);
    updateTargetPareto(state, "t1");
    expect(state.targets["t1"].pareto_branches).toContain("b1");
    expect(state.targets["t1"].current_best_branch).toBe("b1");
    expect(state.targets["t1"].current_best_obj).toEqual([0.9]);
  });

  it("filters out failed branches from target pareto", () => {
    state.active_branches["t1"] = ["ok", "fail"];
    state.individuals["ok"] = makeInd("ok", [0.8]);
    state.individuals["fail"] = makeInd("fail", [0.95], false);
    updateTargetPareto(state, "t1");
    expect(state.targets["t1"].pareto_branches).toEqual(["ok"]);
  });
});

// ===========================================================================
// paretoFrontExpanded
// ===========================================================================

describe("paretoFrontExpanded", () => {
  it("returns false when new individuals have null fitness", () => {
    const newInds = [makeInd("new", null)];
    const result = paretoFrontExpanded(newInds, ["existing"], {
      existing: makeInd("existing", [0.8]),
    }, maxObj);
    expect(result).toBe(false);
  });

  it("returns true when new individual is not dominated by existing front", () => {
    const allInds: Record<string, Individual> = {
      existing: makeInd("existing", [0.8]),
    };
    const newInds = [makeInd("new", [0.9])];
    const result = paretoFrontExpanded(newInds, ["existing"], allInds, maxObj);
    expect(result).toBe(true);
  });

  it("returns false when new individual is dominated by existing front", () => {
    const allInds: Record<string, Individual> = {
      existing: makeInd("existing", [0.9, 10]),
    };
    const newInds = [makeInd("new", [0.8, 20])];
    const result = paretoFrontExpanded(newInds, ["existing"], allInds, multiObj);
    expect(result).toBe(false);
  });

  it("returns true when new individual is non-dominated (different tradeoff)", () => {
    const allInds: Record<string, Individual> = {
      existing: makeInd("existing", [0.9, 30]),
    };
    const newInds = [makeInd("new", [0.8, 10])];
    const result = paretoFrontExpanded(newInds, ["existing"], allInds, multiObj);
    expect(result).toBe(true);
  });

  it("returns true for empty existing front", () => {
    const newInds = [makeInd("new", [0.5])];
    const result = paretoFrontExpanded(newInds, [], {}, maxObj);
    expect(result).toBe(true);
  });

  it("returns true if any one of multiple new individuals is not dominated", () => {
    const allInds: Record<string, Individual> = {
      existing: makeInd("existing", [0.9]),
    };
    const newInds = [
      makeInd("bad", [0.5]),
      makeInd("great", [0.95]),
    ];
    const result = paretoFrontExpanded(newInds, ["existing"], allInds, maxObj);
    expect(result).toBe(true);
  });

  it("skips missing existing front branches gracefully", () => {
    const newInds = [makeInd("new", [0.5])];
    const result = paretoFrontExpanded(newInds, ["missing_branch"], {}, maxObj);
    // No existing fitnesses to dominate, so new is not dominated → true
    expect(result).toBe(true);
  });
});
