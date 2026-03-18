"use strict";
/**
 * Data models for evolution state.
 * TypeScript port of models.py — all Pydantic models become interfaces.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROTECTED_PATTERNS = exports.TargetStatus = exports.Operation = exports.BenchmarkOutputFormat = exports.Objective = void 0;
exports.createDefaultTarget = createDefaultTarget;
exports.createDefaultState = createDefaultState;
var Objective;
(function (Objective) {
    Objective["MIN"] = "min";
    Objective["MAX"] = "max";
})(Objective || (exports.Objective = Objective = {}));
var BenchmarkOutputFormat;
(function (BenchmarkOutputFormat) {
    BenchmarkOutputFormat["JSON"] = "json";
    BenchmarkOutputFormat["NUMBERS"] = "numbers";
})(BenchmarkOutputFormat || (exports.BenchmarkOutputFormat = BenchmarkOutputFormat = {}));
var Operation;
(function (Operation) {
    Operation["MUTATE"] = "mutate";
    Operation["CROSSOVER"] = "crossover";
    Operation["SYNERGY"] = "synergy";
    Operation["STRUCTURAL"] = "structural";
})(Operation || (exports.Operation = Operation = {}));
var TargetStatus;
(function (TargetStatus) {
    TargetStatus["ACTIVE"] = "active";
    TargetStatus["FROZEN"] = "frozen";
})(TargetStatus || (exports.TargetStatus = TargetStatus = {}));
function createDefaultTarget(t) {
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
function createDefaultState(config) {
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
exports.DEFAULT_PROTECTED_PATTERNS = [
    "benchmark*.py",
    "eval*.py",
    "evaluate*.py",
    "run_eval*",
    "test_bench*",
    "*.sh",
];
