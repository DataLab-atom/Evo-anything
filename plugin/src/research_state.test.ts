import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";

// ---------------------------------------------------------------------------
// Mock fs
// ---------------------------------------------------------------------------

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

const fsMock = vi.mocked(fs);

import {
  initForest,
  getForest,
  addNode,
  updateNode,
  mergeNodes,
  checkConvergence,
  addConvergencePoint,
  verifyConvergencePoint,
  recordContribution,
  incrementIteration,
  markForestDone,
  getForestSummary,
} from "./research_state.js";

// ---------------------------------------------------------------------------
// Forest lifecycle
// ---------------------------------------------------------------------------

describe("initForest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new forest with correct defaults", () => {
    const f = initForest("test-forest", "Testing evo session");
    expect(f.id).toBe("test-forest");
    expect(f.evo_session_summary).toBe("Testing evo session");
    expect(f.status).toBe("exploring");
    expect(f.iteration_count).toBe(0);
    expect(f.max_iterations).toBe(20);
    expect(Object.keys(f.nodes)).toEqual([]);
    expect(f.convergence_points).toEqual([]);
    expect(f.contributions).toEqual([]);
    expect(f.created_at).toBeGreaterThan(0);
  });

  it("persists the forest to disk", () => {
    initForest("persist-test", "summary");
    expect(fsMock.writeFileSync).toHaveBeenCalled();
  });
});

describe("getForest", () => {
  it("returns previously created forest", () => {
    initForest("get-test", "summary");
    const f = getForest("get-test");
    expect(f).not.toBeNull();
    expect(f!.id).toBe("get-test");
  });

  it("returns null for non-existent forest", () => {
    fsMock.existsSync.mockReturnValue(false);
    expect(getForest("nonexistent-forest-xyz")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Node operations
// ---------------------------------------------------------------------------

describe("addNode", () => {
  const forestId = "node-test";

  beforeEach(() => {
    initForest(forestId, "node testing");
  });

  it("adds a node to the forest", () => {
    const node = addNode(forestId, "change", "Optimized attention");
    expect(node).not.toBeNull();
    expect(node!.type).toBe("change");
    expect(node!.content).toBe("Optimized attention");
    expect(node!.depth).toBe(0);
    expect(node!.status).toBe("active");
    expect(node!.parent_ids).toEqual([]);
    expect(node!.child_ids).toEqual([]);
  });

  it("sets depth based on parent nodes", () => {
    const parent = addNode(forestId, "change", "Parent node");
    const child = addNode(forestId, "hypothesis", "Child hypothesis", {
      parent_ids: [parent!.id],
    });
    expect(child!.depth).toBe(1);
  });

  it("sets depth to max of multiple parents", () => {
    const p1 = addNode(forestId, "change", "Parent 1");
    const p2Child = addNode(forestId, "hypothesis", "P2 child", {
      parent_ids: [p1!.id],
    });
    const deep = addNode(forestId, "evidence", "Deep node", {
      parent_ids: [p1!.id, p2Child!.id],
    });
    expect(deep!.depth).toBe(2);
  });

  it("updates parent's child_ids", () => {
    const parent = addNode(forestId, "change", "Parent");
    const child = addNode(forestId, "hypothesis", "Child", {
      parent_ids: [parent!.id],
    });
    const forest = getForest(forestId)!;
    expect(forest.nodes[parent!.id].child_ids).toContain(child!.id);
  });

  it("stores optional metadata", () => {
    const node = addNode(forestId, "evidence", "Evidence node", {
      source_branches: ["evo/t1/gen1/m0"],
      literature_refs: ["smith2024"],
      experiment_ids: ["exp1"],
    });
    expect(node!.source_branches).toEqual(["evo/t1/gen1/m0"]);
    expect(node!.literature_refs).toEqual(["smith2024"]);
    expect(node!.experiment_ids).toEqual(["exp1"]);
  });

  it("returns null for non-existent forest", () => {
    expect(addNode("nonexistent-xxx", "change", "test")).toBeNull();
  });
});

describe("updateNode", () => {
  const forestId = "update-test";

  beforeEach(() => {
    initForest(forestId, "update testing");
  });

  it("updates node content", () => {
    const node = addNode(forestId, "hypothesis", "Original");
    const updated = updateNode(forestId, node!.id, { content: "Updated" });
    expect(updated!.content).toBe("Updated");
  });

  it("updates node status", () => {
    const node = addNode(forestId, "hypothesis", "Test");
    const updated = updateNode(forestId, node!.id, { status: "pruned" });
    expect(updated!.status).toBe("pruned");
  });

  it("updates literature refs", () => {
    const node = addNode(forestId, "evidence", "Evidence");
    const updated = updateNode(forestId, node!.id, {
      literature_refs: ["ref1", "ref2"],
    });
    expect(updated!.literature_refs).toEqual(["ref1", "ref2"]);
  });

  it("updates experiment ids", () => {
    const node = addNode(forestId, "evidence", "Evidence");
    const updated = updateNode(forestId, node!.id, {
      experiment_ids: ["exp1"],
    });
    expect(updated!.experiment_ids).toEqual(["exp1"]);
  });

  it("returns null for non-existent forest", () => {
    expect(updateNode("nope-xxx", "n1", { content: "x" })).toBeNull();
  });

  it("returns null for non-existent node", () => {
    expect(updateNode(forestId, "nonexistent-node", { content: "x" })).toBeNull();
  });

  it("preserves unchanged fields", () => {
    const node = addNode(forestId, "hypothesis", "Original", {
      source_branches: ["b1"],
    });
    const updated = updateNode(forestId, node!.id, { content: "New content" });
    expect(updated!.source_branches).toEqual(["b1"]);
    expect(updated!.type).toBe("hypothesis");
  });
});

describe("mergeNodes", () => {
  const forestId = "merge-test";

  beforeEach(() => {
    initForest(forestId, "merge testing");
  });

  it("merges multiple nodes into a single hypothesis", () => {
    const n1 = addNode(forestId, "hypothesis", "Hypothesis A");
    const n2 = addNode(forestId, "hypothesis", "Hypothesis B");
    const merged = mergeNodes(forestId, [n1!.id, n2!.id], "Merged AB");
    expect(merged).not.toBeNull();
    expect(merged!.type).toBe("hypothesis");
    expect(merged!.content).toBe("Merged AB");
  });

  it("marks original nodes as pruned", () => {
    const n1 = addNode(forestId, "hypothesis", "A");
    const n2 = addNode(forestId, "hypothesis", "B");
    mergeNodes(forestId, [n1!.id, n2!.id], "Merged");
    const forest = getForest(forestId)!;
    expect(forest.nodes[n1!.id].status).toBe("pruned");
    expect(forest.nodes[n2!.id].status).toBe("pruned");
  });

  it("reassigns children of merged nodes to the new node", () => {
    const parent = addNode(forestId, "change", "Parent");
    const child = addNode(forestId, "hypothesis", "Child", {
      parent_ids: [parent!.id],
    });
    const grandchild = addNode(forestId, "evidence", "Grandchild", {
      parent_ids: [child!.id],
    });
    const merged = mergeNodes(forestId, [child!.id], "Merged child");
    const forest = getForest(forestId)!;
    expect(forest.nodes[grandchild!.id].parent_ids).toContain(merged!.id);
    expect(merged!.child_ids).toContain(grandchild!.id);
  });

  it("collects metadata from all merged nodes", () => {
    const n1 = addNode(forestId, "hypothesis", "A", {
      source_branches: ["b1"],
      literature_refs: ["ref1"],
    });
    const n2 = addNode(forestId, "hypothesis", "B", {
      source_branches: ["b2"],
      experiment_ids: ["exp1"],
    });
    const merged = mergeNodes(forestId, [n1!.id, n2!.id], "Merged");
    expect(merged!.source_branches).toContain("b1");
    expect(merged!.source_branches).toContain("b2");
    expect(merged!.literature_refs).toContain("ref1");
    expect(merged!.experiment_ids).toContain("exp1");
  });

  it("deduplicates child ids", () => {
    const parent1 = addNode(forestId, "change", "P1");
    const parent2 = addNode(forestId, "change", "P2");
    const shared_child = addNode(forestId, "hypothesis", "Shared", {
      parent_ids: [parent1!.id, parent2!.id],
    });
    const merged = mergeNodes(forestId, [parent1!.id, parent2!.id], "Merged parents");
    const childCount = merged!.child_ids.filter((c) => c === shared_child!.id).length;
    expect(childCount).toBe(1);
  });

  it("returns null for non-existent forest", () => {
    expect(mergeNodes("nope-xxx", ["a"], "m")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Convergence detection
// ---------------------------------------------------------------------------

describe("checkConvergence", () => {
  const forestId = "conv-check";

  beforeEach(() => {
    initForest(forestId, "convergence testing");
  });

  it("returns not converged when forest is empty", () => {
    const result = checkConvergence(forestId);
    expect(result.converged).toBe(false);
    expect(result.candidates).toEqual([]);
  });

  it("returns not converged with only one hypothesis", () => {
    const root = addNode(forestId, "change", "Root");
    addNode(forestId, "hypothesis", "Single hypothesis about optimization performance", {
      parent_ids: [root!.id],
    });
    // Need depth >= 2 for convergence check
    const result = checkConvergence(forestId);
    expect(result.converged).toBe(false);
  });

  it("returns not converged when hypotheses share the same root", () => {
    const root = addNode(forestId, "change", "Shared root change");
    const h1 = addNode(forestId, "hypothesis", "Level 1", { parent_ids: [root!.id] });
    addNode(forestId, "hypothesis", "deep hypothesis about transformer optimization architecture neural", {
      parent_ids: [h1!.id],
    });
    addNode(forestId, "hypothesis", "deep hypothesis about transformer optimization architecture search", {
      parent_ids: [h1!.id],
    });
    const result = checkConvergence(forestId);
    // Same root → should not converge
    expect(result.converged).toBe(false);
  });

  it("detects convergence from different roots with overlapping keywords", () => {
    // Branch 1
    const root1 = addNode(forestId, "change", "Change A");
    const h1a = addNode(forestId, "hypothesis", "Level 1A", { parent_ids: [root1!.id] });
    addNode(forestId, "hypothesis",
      "transformer architecture optimization through attention mechanism pruning significantly reduces latency",
      { parent_ids: [h1a!.id] },
    );

    // Branch 2 (different root)
    const root2 = addNode(forestId, "change", "Change B");
    const h2a = addNode(forestId, "hypothesis", "Level 2A", { parent_ids: [root2!.id] });
    addNode(forestId, "hypothesis",
      "transformer architecture optimization with attention mechanism pruning improves inference latency",
      { parent_ids: [h2a!.id] },
    );

    const result = checkConvergence(forestId);
    expect(result.converged).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].shared_keywords.length).toBeGreaterThanOrEqual(3);
  });

  it("returns not converged for non-existent forest", () => {
    const result = checkConvergence("nope-xxx");
    expect(result.converged).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Convergence point management
// ---------------------------------------------------------------------------

describe("addConvergencePoint", () => {
  const forestId = "conv-point";

  beforeEach(() => {
    initForest(forestId, "convergence point testing");
  });

  it("creates a convergence point", () => {
    const n1 = addNode(forestId, "hypothesis", "H1");
    const n2 = addNode(forestId, "hypothesis", "H2");
    const point = addConvergencePoint(forestId, "Why does X help Y?", [n1!.id, n2!.id]);
    expect(point).not.toBeNull();
    expect(point!.question).toBe("Why does X help Y?");
    expect(point!.verification_status).toBe("pending");
    expect(point!.contributing_node_ids).toEqual([n1!.id, n2!.id]);
  });

  it("marks contributing nodes as converged", () => {
    const n1 = addNode(forestId, "hypothesis", "H1");
    addConvergencePoint(forestId, "Q?", [n1!.id]);
    const forest = getForest(forestId)!;
    expect(forest.nodes[n1!.id].status).toBe("converged");
  });

  it("sets forest status to converging", () => {
    const n1 = addNode(forestId, "hypothesis", "H1");
    addConvergencePoint(forestId, "Q?", [n1!.id]);
    const forest = getForest(forestId)!;
    expect(forest.status).toBe("converging");
  });

  it("returns null for non-existent forest", () => {
    expect(addConvergencePoint("nope-xxx", "Q?", [])).toBeNull();
  });
});

describe("verifyConvergencePoint", () => {
  const forestId = "verify-test";

  beforeEach(() => {
    initForest(forestId, "verify testing");
  });

  it("verifies a convergence point", () => {
    const n1 = addNode(forestId, "hypothesis", "H1");
    const point = addConvergencePoint(forestId, "Q?", [n1!.id]);
    const verified = verifyConvergencePoint(forestId, point!.id, true, ["ev1"]);
    expect(verified!.verification_status).toBe("verified");
    expect(verified!.evidence_ids).toEqual(["ev1"]);
  });

  it("rejects a convergence point and reactivates nodes", () => {
    const n1 = addNode(forestId, "hypothesis", "H1");
    const point = addConvergencePoint(forestId, "Q?", [n1!.id]);
    // After adding, n1 is "converged"
    const rejected = verifyConvergencePoint(forestId, point!.id, false, []);
    expect(rejected!.verification_status).toBe("rejected");
    const forest = getForest(forestId)!;
    expect(forest.nodes[n1!.id].status).toBe("active");
    expect(forest.status).toBe("exploring");
  });

  it("returns null for non-existent point", () => {
    expect(verifyConvergencePoint(forestId, "nonexistent", true, [])).toBeNull();
  });

  it("returns null for non-existent forest", () => {
    expect(verifyConvergencePoint("nope-xxx", "x", true, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Contribution recording
// ---------------------------------------------------------------------------

describe("recordContribution", () => {
  const forestId = "contrib-test";

  beforeEach(() => {
    initForest(forestId, "contribution testing");
  });

  it("records a primary contribution", () => {
    const n1 = addNode(forestId, "hypothesis", "H1");
    const point = addConvergencePoint(forestId, "Q?", [n1!.id]);
    const ok = recordContribution(forestId, point!.id, "primary", "Main finding");
    expect(ok).toBe(true);
    const forest = getForest(forestId)!;
    expect(forest.contributions.length).toBe(1);
    expect(forest.contributions[0].level).toBe("primary");
    expect(forest.contributions[0].description).toBe("Main finding");
  });

  it("records an auxiliary contribution", () => {
    const n1 = addNode(forestId, "hypothesis", "H1");
    const point = addConvergencePoint(forestId, "Q?", [n1!.id]);
    const ok = recordContribution(forestId, point!.id, "auxiliary", "Supporting work");
    expect(ok).toBe(true);
  });

  it("returns false for non-existent convergence point", () => {
    expect(recordContribution(forestId, "nonexistent", "primary", "x")).toBe(false);
  });

  it("returns false for non-existent forest", () => {
    expect(recordContribution("nope-xxx", "x", "primary", "x")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Iteration tracking
// ---------------------------------------------------------------------------

describe("incrementIteration", () => {
  const forestId = "iter-test";

  beforeEach(() => {
    initForest(forestId, "iteration testing");
  });

  it("increments iteration count", () => {
    expect(incrementIteration(forestId)).toBe(1);
    expect(incrementIteration(forestId)).toBe(2);
    expect(incrementIteration(forestId)).toBe(3);
  });

  it("returns -1 for non-existent forest", () => {
    expect(incrementIteration("nope-xxx")).toBe(-1);
  });
});

describe("markForestDone", () => {
  const forestId = "done-test";

  beforeEach(() => {
    initForest(forestId, "done testing");
  });

  it("sets forest status to done", () => {
    markForestDone(forestId);
    const forest = getForest(forestId)!;
    expect(forest.status).toBe("done");
  });

  it("does not throw for non-existent forest", () => {
    expect(() => markForestDone("nope-xxx")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe("getForestSummary", () => {
  const forestId = "summary-test";

  beforeEach(() => {
    initForest(forestId, "summary testing");
  });

  it("returns null for non-existent forest", () => {
    expect(getForestSummary("nope-xxx")).toBeNull();
  });

  it("returns correct summary for empty forest", () => {
    const summary = getForestSummary(forestId);
    expect(summary).not.toBeNull();
    expect(summary!["forest_id"]).toBe(forestId);
    expect(summary!["status"]).toBe("exploring");
    expect(summary!["total_nodes"]).toBe(0);
    expect(summary!["active_nodes"]).toBe(0);
    expect(summary!["pruned_nodes"]).toBe(0);
    expect(summary!["converged_nodes"]).toBe(0);
    expect(summary!["max_depth"]).toBe(0);
    expect(summary!["convergence_points"]).toBe(0);
    expect(summary!["verified_points"]).toBe(0);
    expect(summary!["contributions"]).toBe(0);
  });

  it("returns correct summary after operations", () => {
    const root = addNode(forestId, "change", "Root");
    const h1 = addNode(forestId, "hypothesis", "H1", { parent_ids: [root!.id] });
    addNode(forestId, "evidence", "E1", { parent_ids: [h1!.id] });
    addConvergencePoint(forestId, "Q?", [h1!.id]);
    incrementIteration(forestId);

    const summary = getForestSummary(forestId);
    expect(summary!["total_nodes"]).toBe(3);
    expect(summary!["converged_nodes"]).toBe(1); // h1
    expect(summary!["max_depth"]).toBe(2); // evidence at depth 2
    expect(summary!["convergence_points"]).toBe(1);
    expect(summary!["iteration_count"]).toBe(1);
  });
});
