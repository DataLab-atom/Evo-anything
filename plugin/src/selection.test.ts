import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dominates,
  fastNonDominatedSort,
  crowdingDistanceAssignment,
  selectSurvivors,
  rankSelect,
  planGeneration,
  updateTemperatures,
  paretoFrontOf,
  representativeBranch,
} from "./selection.js";
import {
  Objective,
  Operation,
  TargetStatus,
  type ObjectiveSpec,
  type Individual,
  type Target,
} from "./models.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeTarget(
  id: string,
  overrides: Partial<Target> = {},
): Target {
  return {
    id,
    file: "main.py",
    function: "solve",
    description: "",
    hint: "",
    derived_from: [],
    impact: "medium",
    status: TargetStatus.ACTIVE,
    temperature: 1.0,
    current_best_obj: null,
    current_best_branch: null,
    pareto_branches: [],
    stagnation_count: 0,
    ...overrides,
  };
}

const minObj: ObjectiveSpec[] = [{ name: "error", direction: Objective.MIN }];
const maxObj: ObjectiveSpec[] = [{ name: "score", direction: Objective.MAX }];
const multiObj: ObjectiveSpec[] = [
  { name: "accuracy", direction: Objective.MAX },
  { name: "latency", direction: Objective.MIN },
];

// ===========================================================================
// dominates
// ===========================================================================

describe("dominates", () => {
  describe("single objective — MIN", () => {
    it("a < b → a dominates b", () => {
      expect(dominates([1], [2], minObj)).toBe(true);
    });
    it("a > b → a does NOT dominate b", () => {
      expect(dominates([3], [2], minObj)).toBe(false);
    });
    it("a == b → neither dominates", () => {
      expect(dominates([2], [2], minObj)).toBe(false);
    });
  });

  describe("single objective — MAX", () => {
    it("a > b → a dominates b", () => {
      expect(dominates([5], [3], maxObj)).toBe(true);
    });
    it("a < b → a does NOT dominate b", () => {
      expect(dominates([1], [3], maxObj)).toBe(false);
    });
    it("a == b → neither dominates", () => {
      expect(dominates([3], [3], maxObj)).toBe(false);
    });
  });

  describe("multi-objective", () => {
    it("a better on both → a dominates b", () => {
      expect(dominates([0.9, 10], [0.8, 20], multiObj)).toBe(true);
    });
    it("a better on first, worse on second → no domination", () => {
      expect(dominates([0.9, 30], [0.8, 20], multiObj)).toBe(false);
    });
    it("a equal on first, better on second → a dominates b", () => {
      expect(dominates([0.9, 10], [0.9, 20], multiObj)).toBe(true);
    });
    it("both equal → neither dominates", () => {
      expect(dominates([0.9, 10], [0.9, 10], multiObj)).toBe(false);
    });
    it("a worse on both → no domination", () => {
      expect(dominates([0.7, 30], [0.8, 20], multiObj)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("zero-length objectives → returns false", () => {
      expect(dominates([], [], [])).toBe(false);
    });
  });
});

// ===========================================================================
// fastNonDominatedSort
// ===========================================================================

describe("fastNonDominatedSort", () => {
  it("returns empty array for empty input", () => {
    expect(fastNonDominatedSort([], minObj)).toEqual([]);
  });

  it("returns empty array when all individuals have null fitness", () => {
    const inds = [makeInd("a", null), makeInd("b", null)];
    expect(fastNonDominatedSort(inds, minObj)).toEqual([]);
  });

  it("single individual → single front", () => {
    const inds = [makeInd("a", [1])];
    const fronts = fastNonDominatedSort(inds, minObj);
    expect(fronts.length).toBe(1);
    expect(fronts[0].length).toBe(1);
    expect(fronts[0][0].branch).toBe("a");
  });

  it("two non-dominating individuals → same front", () => {
    const inds = [makeInd("a", [0.9, 30]), makeInd("b", [0.8, 20])];
    const fronts = fastNonDominatedSort(inds, multiObj);
    expect(fronts.length).toBe(1);
    expect(fronts[0].length).toBe(2);
  });

  it("clear domination → two fronts", () => {
    const inds = [
      makeInd("best", [0.9, 10]),
      makeInd("worst", [0.8, 20]),
    ];
    const fronts = fastNonDominatedSort(inds, multiObj);
    expect(fronts.length).toBe(2);
    expect(fronts[0][0].branch).toBe("best");
    expect(fronts[1][0].branch).toBe("worst");
  });

  it("three individuals with chain domination → three fronts", () => {
    const inds = [
      makeInd("c", [0.7, 30]),
      makeInd("a", [0.9, 10]),
      makeInd("b", [0.8, 20]),
    ];
    const fronts = fastNonDominatedSort(inds, multiObj);
    expect(fronts.length).toBe(3);
    expect(fronts[0][0].branch).toBe("a");
    expect(fronts[1][0].branch).toBe("b");
    expect(fronts[2][0].branch).toBe("c");
  });

  it("filters out individuals with null fitness", () => {
    const inds = [makeInd("a", [1]), makeInd("b", null), makeInd("c", [2])];
    const fronts = fastNonDominatedSort(inds, minObj);
    const allBranches = fronts.flat().map((i) => i.branch);
    expect(allBranches).not.toContain("b");
    expect(allBranches).toContain("a");
    expect(allBranches).toContain("c");
  });

  it("handles identical fitness values", () => {
    const inds = [makeInd("a", [5]), makeInd("b", [5]), makeInd("c", [5])];
    const fronts = fastNonDominatedSort(inds, minObj);
    expect(fronts.length).toBe(1);
    expect(fronts[0].length).toBe(3);
  });
});

// ===========================================================================
// crowdingDistanceAssignment
// ===========================================================================

describe("crowdingDistanceAssignment", () => {
  it("returns Infinity for all when front has <= 2 individuals", () => {
    const front = [makeInd("a", [1, 10]), makeInd("b", [2, 20])];
    const dist = crowdingDistanceAssignment(front, multiObj);
    expect(dist.get("a")).toBe(Infinity);
    expect(dist.get("b")).toBe(Infinity);
  });

  it("single individual → Infinity", () => {
    const front = [makeInd("a", [1])];
    const dist = crowdingDistanceAssignment(front, minObj);
    expect(dist.get("a")).toBe(Infinity);
  });

  it("boundary individuals get Infinity in larger front", () => {
    const front = [
      makeInd("a", [1]),
      makeInd("b", [5]),
      makeInd("c", [10]),
    ];
    const dist = crowdingDistanceAssignment(front, minObj);
    expect(dist.get("a")).toBe(Infinity);
    expect(dist.get("c")).toBe(Infinity);
    expect(dist.get("b")).toBeLessThan(Infinity);
    expect(dist.get("b")!).toBeGreaterThan(0);
  });

  it("middle individual gets finite crowding distance", () => {
    const front = [
      makeInd("a", [1, 100]),
      makeInd("b", [5, 50]),
      makeInd("c", [10, 10]),
    ];
    const dist = crowdingDistanceAssignment(front, multiObj);
    // a and c should be boundaries on at least one dimension
    expect(dist.get("b")!).toBeLessThan(Infinity);
    expect(dist.get("b")!).toBeGreaterThan(0);
  });

  it("identical fitness → distances remain 0 (span = 0)", () => {
    const front = [
      makeInd("a", [5]),
      makeInd("b", [5]),
      makeInd("c", [5]),
    ];
    const dist = crowdingDistanceAssignment(front, minObj);
    // All get Infinity because boundaries are set to Infinity
    // a and c are boundary; b might get 0 + Infinity from boundary re-assignment
    // Actually: sorted by fitness[0], all equal, so a=first→Inf, c=last→Inf
    expect(dist.get("a")).toBe(Infinity);
    expect(dist.get("c")).toBe(Infinity);
  });
});

// ===========================================================================
// selectSurvivors
// ===========================================================================

describe("selectSurvivors", () => {
  it("returns empty keep for empty input", () => {
    const res = selectSurvivors([], 5, minObj);
    expect(res.keep).toEqual([]);
    expect(res.eliminate).toEqual([]);
  });

  it("returns empty keep when all individuals failed", () => {
    const inds = [makeInd("a", [1], false), makeInd("b", null, true)];
    const res = selectSurvivors(inds, 5, minObj);
    expect(res.keep).toEqual([]);
    expect(res.eliminate.length).toBe(2);
  });

  it("keeps all valid when topK >= count", () => {
    const inds = [makeInd("a", [1]), makeInd("b", [2])];
    const res = selectSurvivors(inds, 10, minObj);
    expect(res.keep.length).toBe(2);
    expect(res.eliminate.length).toBe(0);
  });

  it("selects top K by Pareto rank", () => {
    const inds = [
      makeInd("best", [0.9, 10]),
      makeInd("mid", [0.8, 20]),
      makeInd("worst", [0.7, 30]),
    ];
    const res = selectSurvivors(inds, 1, multiObj);
    expect(res.keep.length).toBe(1);
    expect(res.keep[0].branch).toBe("best");
    expect(res.eliminate.length).toBe(2);
  });

  it("assigns pareto_rank to individuals", () => {
    const inds = [
      makeInd("a", [0.9, 10]),
      makeInd("b", [0.8, 20]),
    ];
    selectSurvivors(inds, 5, multiObj);
    expect(inds[0].pareto_rank).toBe(1);
    expect(inds[1].pareto_rank).toBe(2);
  });

  it("failed individuals always go to eliminate", () => {
    const inds = [
      makeInd("good", [1]),
      makeInd("failed", [0.5], false),
    ];
    const res = selectSurvivors(inds, 5, minObj);
    expect(res.keep.length).toBe(1);
    expect(res.keep[0].branch).toBe("good");
    expect(res.eliminate.some((i) => i.branch === "failed")).toBe(true);
  });

  it("uses crowding distance to break ties within a front", () => {
    // All on same Pareto front (non-dominating), topK < front size
    const inds = [
      makeInd("a", [0.9, 30]),
      makeInd("b", [0.85, 25]),
      makeInd("c", [0.8, 20]),
    ];
    const res = selectSurvivors(inds, 2, multiObj);
    expect(res.keep.length).toBe(2);
    // Boundary individuals (a and c) have Infinity crowding distance, should be kept
    const kept = res.keep.map((i) => i.branch).sort();
    expect(kept).toEqual(["a", "c"]);
  });
});

// ===========================================================================
// rankSelect
// ===========================================================================

describe("rankSelect", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
  });

  it("returns empty for fewer than 2 valid individuals", () => {
    expect(rankSelect([makeInd("a", [1])], 1, minObj)).toEqual([]);
    expect(rankSelect([], 1, minObj)).toEqual([]);
  });

  it("returns pairs of individuals", () => {
    vi.restoreAllMocks();
    const inds = [
      makeInd("a", [1]),
      makeInd("b", [2]),
      makeInd("c", [3]),
    ];
    const pairs = rankSelect(inds, 2, minObj);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    for (const [p1, p2] of pairs) {
      expect(p1.branch).not.toBe(p2.branch);
    }
  });

  it("first element of pair is the better individual", () => {
    vi.restoreAllMocks();
    const inds = [makeInd("good", [1]), makeInd("bad", [10])];
    const pairs = rankSelect(inds, 5, minObj);
    for (const [better] of pairs) {
      // "good" has rank 1 (lower fitness = better for MIN)
      expect(better.branch).toBe("good");
    }
  });

  it("filters out failed individuals", () => {
    vi.restoreAllMocks();
    const inds = [
      makeInd("a", [1]),
      makeInd("fail", [0.5], false),
      makeInd("b", [2]),
    ];
    const pairs = rankSelect(inds, 5, minObj);
    const branches = pairs.flat().map((i) => i.branch);
    expect(branches).not.toContain("fail");
  });

  it("respects nPairs limit", () => {
    vi.restoreAllMocks();
    const inds = [
      makeInd("a", [1]),
      makeInd("b", [2]),
      makeInd("c", [3]),
      makeInd("d", [4]),
    ];
    const pairs = rankSelect(inds, 2, minObj);
    expect(pairs.length).toBeLessThanOrEqual(2);
  });

  it("handles individuals with same rank (crowding distance tiebreak)", () => {
    vi.restoreAllMocks();
    // All on same Pareto front for multi-objective
    const inds = [
      makeInd("a", [0.9, 30]),
      makeInd("b", [0.85, 25]),
      makeInd("c", [0.8, 20]),
    ];
    const pairs = rankSelect(inds, 3, multiObj);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    // Every pair should have two distinct branches
    for (const [p1, p2] of pairs) {
      expect(p1.branch).not.toBe(p2.branch);
    }
  });

  it("uses Math.random to sample weighted pairs", () => {
    // Ensure deterministic with controlled random
    let callCount = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      callCount++;
      return 0.99; // Always pick last element → tests weightedChoice fallback
    });
    const inds = [makeInd("a", [1]), makeInd("b", [2])];
    const pairs = rankSelect(inds, 1, minObj);
    expect(callCount).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });
});

// ===========================================================================
// planGeneration
// ===========================================================================

describe("planGeneration", () => {
  it("returns empty plan for no active targets", () => {
    const plan = planGeneration({}, 10, 0.7, 0.1, 100, 5, 1);
    expect(plan).toEqual([]);
  });

  it("returns empty plan when all targets are frozen", () => {
    const targets = {
      t1: makeTarget("t1", { status: TargetStatus.FROZEN }),
    };
    const plan = planGeneration(targets, 10, 0.7, 0.1, 100, 5, 1);
    expect(plan).toEqual([]);
  });

  it("generates MUTATE entries for active targets", () => {
    const targets = { t1: makeTarget("t1") };
    const plan = planGeneration(targets, 10, 0.7, 0.1, 100, 5, 1);
    const mutateEntries = plan.filter((p) => p.operation === Operation.MUTATE);
    expect(mutateEntries.length).toBeGreaterThan(0);
    expect(mutateEntries[0].target_id).toBe("t1");
  });

  it("generates STRUCTURAL entries when structuralRate > 0", () => {
    const targets = { t1: makeTarget("t1") };
    const plan = planGeneration(targets, 10, 0.7, 0.2, 100, 5, 1);
    const structuralEntries = plan.filter((p) => p.operation === Operation.STRUCTURAL);
    expect(structuralEntries.length).toBeGreaterThan(0);
  });

  it("generates CROSSOVER entries when mutationRate < 1", () => {
    const targets = { t1: makeTarget("t1") };
    const plan = planGeneration(targets, 10, 0.5, 0.0, 100, 5, 1);
    const crossoverEntries = plan.filter((p) => p.operation === Operation.CROSSOVER);
    expect(crossoverEntries.length).toBeGreaterThan(0);
  });

  it("generates SYNERGY at synergy interval with multiple targets", () => {
    const targets = {
      t1: makeTarget("t1"),
      t2: makeTarget("t2"),
    };
    const plan = planGeneration(targets, 10, 0.7, 0.1, 100, 5, 5);
    const synergyEntries = plan.filter((p) => p.operation === Operation.SYNERGY);
    expect(synergyEntries.length).toBeGreaterThan(0);
    expect(synergyEntries[0].target_id).toBe("t1+t2");
  });

  it("does NOT generate SYNERGY on non-interval generations", () => {
    const targets = {
      t1: makeTarget("t1"),
      t2: makeTarget("t2"),
    };
    const plan = planGeneration(targets, 10, 0.7, 0.1, 100, 5, 3);
    const synergyEntries = plan.filter((p) => p.operation === Operation.SYNERGY);
    expect(synergyEntries.length).toBe(0);
  });

  it("does NOT generate SYNERGY on generation 0", () => {
    const targets = {
      t1: makeTarget("t1"),
      t2: makeTarget("t2"),
    };
    const plan = planGeneration(targets, 10, 0.7, 0.1, 100, 5, 0);
    const synergyEntries = plan.filter((p) => p.operation === Operation.SYNERGY);
    expect(synergyEntries.length).toBe(0);
  });

  it("does NOT generate SYNERGY with only one target", () => {
    const targets = { t1: makeTarget("t1") };
    const plan = planGeneration(targets, 10, 0.7, 0.1, 100, 5, 5);
    const synergyEntries = plan.filter((p) => p.operation === Operation.SYNERGY);
    expect(synergyEntries.length).toBe(0);
  });

  it("doubles structural rate for stagnating targets", () => {
    const targets = {
      t1: makeTarget("t1", { stagnation_count: 3 }),
    };
    const planStagnant = planGeneration(targets, 10, 0.7, 0.1, 100, 5, 1);
    const structuralStagnant = planStagnant.filter(
      (p) => p.operation === Operation.STRUCTURAL,
    );
    // Should have high priority
    expect(structuralStagnant.every((s) => s.priority === "high")).toBe(true);
  });

  it("distributes variants proportionally to temperature", () => {
    const targets = {
      t1: makeTarget("t1", { temperature: 2.0 }),
      t2: makeTarget("t2", { temperature: 1.0 }),
    };
    const plan = planGeneration(targets, 30, 0.7, 0.0, 100, 5, 1);
    const t1Count = plan
      .filter((p) => p.target_id === "t1")
      .reduce((s, p) => s + p.count, 0);
    const t2Count = plan
      .filter((p) => p.target_id === "t2")
      .reduce((s, p) => s + p.count, 0);
    // t1 should get roughly twice as many as t2
    expect(t1Count).toBeGreaterThan(t2Count);
  });

  it("marks high priority for boosted temperature targets", () => {
    const targets = {
      t1: makeTarget("t1", { temperature: 1.5 }),
    };
    const plan = planGeneration(targets, 10, 0.7, 0.0, 100, 5, 1);
    const mutateEntries = plan.filter((p) => p.operation === Operation.MUTATE);
    expect(mutateEntries[0].priority).toBe("high");
  });

  it("marks medium priority for default temperature targets", () => {
    const targets = {
      t1: makeTarget("t1", { temperature: 0.8 }),
    };
    const plan = planGeneration(targets, 10, 0.7, 0.0, 100, 5, 1);
    const mutateEntries = plan.filter((p) => p.operation === Operation.MUTATE);
    expect(mutateEntries[0].priority).toBe("medium");
  });
});

// ===========================================================================
// updateTemperatures
// ===========================================================================

describe("updateTemperatures", () => {
  it("increases temperature when stagnation_count is 0", () => {
    const targets = { t1: makeTarget("t1", { temperature: 1.0, stagnation_count: 0 }) };
    updateTemperatures(targets);
    expect(targets.t1.temperature).toBeCloseTo(1.3);
  });

  it("caps temperature at 2.0", () => {
    const targets = { t1: makeTarget("t1", { temperature: 1.9, stagnation_count: 0 }) };
    updateTemperatures(targets);
    expect(targets.t1.temperature).toBe(2.0);
  });

  it("decreases temperature when stagnation_count >= 3", () => {
    const targets = { t1: makeTarget("t1", { temperature: 1.0, stagnation_count: 3 }) };
    updateTemperatures(targets);
    expect(targets.t1.temperature).toBeCloseTo(0.8);
  });

  it("floors temperature at 0.2", () => {
    const targets = { t1: makeTarget("t1", { temperature: 0.3, stagnation_count: 5 }) };
    updateTemperatures(targets);
    expect(targets.t1.temperature).toBe(0.2);
  });

  it("does not change temperature for stagnation_count 1 or 2", () => {
    const targets = { t1: makeTarget("t1", { temperature: 1.0, stagnation_count: 1 }) };
    updateTemperatures(targets);
    expect(targets.t1.temperature).toBe(1.0);
  });

  it("sets temperature to 0 for frozen targets", () => {
    const targets = {
      t1: makeTarget("t1", { status: TargetStatus.FROZEN, temperature: 1.5 }),
    };
    updateTemperatures(targets);
    expect(targets.t1.temperature).toBe(0);
  });
});

// ===========================================================================
// paretoFrontOf
// ===========================================================================

describe("paretoFrontOf", () => {
  it("returns empty for empty input", () => {
    expect(paretoFrontOf([], minObj)).toEqual([]);
  });

  it("returns single individual as front", () => {
    const inds = [makeInd("a", [5])];
    const front = paretoFrontOf(inds, minObj);
    expect(front.length).toBe(1);
    expect(front[0].branch).toBe("a");
  });

  it("returns only non-dominated individuals", () => {
    const inds = [
      makeInd("best", [0.9, 10]),
      makeInd("worst", [0.7, 30]),
    ];
    const front = paretoFrontOf(inds, multiObj);
    expect(front.length).toBe(1);
    expect(front[0].branch).toBe("best");
  });

  it("returns all non-dominating individuals on the front", () => {
    const inds = [
      makeInd("a", [0.9, 30]),
      makeInd("b", [0.8, 20]),
      makeInd("c", [0.95, 40]),
    ];
    const front = paretoFrontOf(inds, multiObj);
    // a and b are non-dominating (a has higher accuracy but higher latency)
    // c dominates a on accuracy but has worst latency, doesn't dominate a
    // Actually: c has [0.95, 40], a has [0.9, 30]. c better on MAX obj but worse on MIN → non-dominating
    expect(front.length).toBeGreaterThanOrEqual(2);
  });
});

// ===========================================================================
// representativeBranch
// ===========================================================================

describe("representativeBranch", () => {
  it("returns null for empty pareto branches", () => {
    expect(representativeBranch([], {}, maxObj)).toBeNull();
  });

  it("returns null when no branches found in individuals", () => {
    expect(representativeBranch(["x", "y"], {}, maxObj)).toBeNull();
  });

  it("returns branch with best first objective (MAX)", () => {
    const individuals: Record<string, Individual> = {
      a: makeInd("a", [0.8]),
      b: makeInd("b", [0.95]),
      c: makeInd("c", [0.9]),
    };
    const result = representativeBranch(["a", "b", "c"], individuals, maxObj);
    expect(result).toBe("b");
  });

  it("returns branch with best first objective (MIN)", () => {
    const individuals: Record<string, Individual> = {
      a: makeInd("a", [5]),
      b: makeInd("b", [2]),
      c: makeInd("c", [8]),
    };
    const result = representativeBranch(["a", "b", "c"], individuals, minObj);
    expect(result).toBe("b");
  });

  it("skips branches not in individuals map", () => {
    const individuals: Record<string, Individual> = {
      a: makeInd("a", [0.5]),
    };
    const result = representativeBranch(["a", "missing"], individuals, maxObj);
    expect(result).toBe("a");
  });

  it("skips branches with null fitness", () => {
    const individuals: Record<string, Individual> = {
      a: makeInd("a", null),
      b: makeInd("b", [0.9]),
    };
    const result = representativeBranch(["a", "b"], individuals, maxObj);
    expect(result).toBe("b");
  });
});
