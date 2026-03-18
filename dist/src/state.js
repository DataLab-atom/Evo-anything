"use strict";
/**
 * State persistence and Pareto bookkeeping helpers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.save = save;
exports.getState = getState;
exports.setState = setState;
exports.updateGlobalPareto = updateGlobalPareto;
exports.updateTargetPareto = updateTargetPareto;
exports.paretoFrontExpanded = paretoFrontExpanded;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const selection_js_1 = require("./selection.js");
// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------
const STATE_DIR = process.env["U2E_STATE_DIR"] ??
    (0, node_path_1.join)(process.env["HOME"] ?? "~", ".openclaw", "u2e-state");
let _state = null;
function statePath() {
    return (0, node_path_1.join)(STATE_DIR, "state.json");
}
function save() {
    if (!_state)
        return;
    const p = statePath();
    (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(p), { recursive: true });
    (0, node_fs_1.writeFileSync)(p, JSON.stringify(_state, null, 2));
}
function load() {
    const p = statePath();
    if (!(0, node_fs_1.existsSync)(p))
        return null;
    return JSON.parse((0, node_fs_1.readFileSync)(p, "utf-8"));
}
function getState() {
    if (!_state)
        _state = load();
    if (!_state)
        throw new Error("Evolution not initialized. Call evo_init first.");
    return _state;
}
function setState(s) {
    _state = s;
}
// ---------------------------------------------------------------------------
// Pareto bookkeeping helpers
// ---------------------------------------------------------------------------
function updateGlobalPareto(state) {
    const allValid = Object.values(state.individuals).filter((ind) => ind.success && ind.fitness !== null);
    const front = (0, selection_js_1.paretoFrontOf)(allValid, state.config.objectives);
    state.pareto_front = front.map((ind) => ind.branch);
    const rep = (0, selection_js_1.representativeBranch)(state.pareto_front, state.individuals, state.config.objectives);
    if (rep) {
        state.best_branch_overall = rep;
        state.best_obj_overall = state.individuals[rep].fitness;
    }
}
function updateTargetPareto(state, targetId) {
    const target = state.targets[targetId];
    if (!target)
        return;
    const active = state.active_branches[targetId] ?? [];
    const activeInds = active
        .filter((b) => b in state.individuals && state.individuals[b].success && state.individuals[b].fitness !== null)
        .map((b) => state.individuals[b]);
    if (activeInds.length === 0)
        return;
    const front = (0, selection_js_1.paretoFrontOf)(activeInds, state.config.objectives);
    target.pareto_branches = front.map((ind) => ind.branch);
    const rep = (0, selection_js_1.representativeBranch)(target.pareto_branches, state.individuals, state.config.objectives);
    if (rep) {
        target.current_best_branch = rep;
        target.current_best_obj = state.individuals[rep].fitness;
    }
}
function paretoFrontExpanded(newIndividuals, existingFrontBranches, allIndividuals, objectives) {
    const existingFitnesses = existingFrontBranches
        .filter((b) => b in allIndividuals && allIndividuals[b].fitness !== null)
        .map((b) => allIndividuals[b].fitness);
    for (const ind of newIndividuals) {
        if (ind.fitness === null)
            continue;
        const dominated = existingFitnesses.some((ef) => (0, selection_js_1.dominates)(ef, ind.fitness, objectives));
        if (!dominated)
            return true;
    }
    return false;
}
