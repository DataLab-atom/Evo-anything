"use strict";
/**
 * Selection algorithms for evolutionary population management.
 * TypeScript port of selection.py — NSGA-II semantics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dominates = dominates;
exports.fastNonDominatedSort = fastNonDominatedSort;
exports.crowdingDistanceAssignment = crowdingDistanceAssignment;
exports.selectSurvivors = selectSurvivors;
exports.rankSelect = rankSelect;
exports.planGeneration = planGeneration;
exports.updateTemperatures = updateTemperatures;
exports.paretoFrontOf = paretoFrontOf;
exports.representativeBranch = representativeBranch;
const models_js_1 = require("./models.js");
// ---------------------------------------------------------------------------
// Core NSGA-II primitives
// ---------------------------------------------------------------------------
function dominates(a, b, objectives) {
    let atLeastAsGood = true;
    let strictlyBetter = false;
    for (let i = 0; i < objectives.length; i++) {
        const ai = a[i], bi = b[i];
        if (objectives[i].direction === models_js_1.Objective.MIN) {
            if (ai > bi) {
                atLeastAsGood = false;
                break;
            }
            if (ai < bi)
                strictlyBetter = true;
        }
        else {
            if (ai < bi) {
                atLeastAsGood = false;
                break;
            }
            if (ai > bi)
                strictlyBetter = true;
        }
    }
    return atLeastAsGood && strictlyBetter;
}
function fastNonDominatedSort(individuals, objectives) {
    const valid = individuals.filter((ind) => ind.fitness !== null);
    const n = valid.length;
    if (n === 0)
        return [];
    const dominatedCount = new Array(n).fill(0);
    const dominationList = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j)
                continue;
            if (dominates(valid[i].fitness, valid[j].fitness, objectives)) {
                dominationList[i].push(j);
            }
            else if (dominates(valid[j].fitness, valid[i].fitness, objectives)) {
                dominatedCount[i]++;
            }
        }
    }
    const fronts = [[]];
    for (let i = 0; i < n; i++) {
        if (dominatedCount[i] === 0)
            fronts[0].push(i);
    }
    let current = 0;
    while (fronts[current].length > 0) {
        const nextFront = [];
        for (const i of fronts[current]) {
            for (const j of dominationList[i]) {
                dominatedCount[j]--;
                if (dominatedCount[j] === 0)
                    nextFront.push(j);
            }
        }
        current++;
        fronts.push(nextFront);
    }
    return fronts.filter((f) => f.length > 0).map((f) => f.map((i) => valid[i]));
}
function crowdingDistanceAssignment(front, objectives) {
    const distances = new Map();
    for (const ind of front)
        distances.set(ind.branch, 0);
    const n = front.length;
    if (n <= 2) {
        for (const ind of front)
            distances.set(ind.branch, Infinity);
        return distances;
    }
    for (let m = 0; m < objectives.length; m++) {
        const sorted = [...front].sort((a, b) => a.fitness[m] - b.fitness[m]);
        distances.set(sorted[0].branch, Infinity);
        distances.set(sorted[n - 1].branch, Infinity);
        const fMin = sorted[0].fitness[m];
        const fMax = sorted[n - 1].fitness[m];
        const span = fMax - fMin;
        if (span === 0)
            continue;
        for (let k = 1; k < n - 1; k++) {
            const prev = distances.get(sorted[k].branch) ?? 0;
            distances.set(sorted[k].branch, prev + (sorted[k + 1].fitness[m] - sorted[k - 1].fitness[m]) / span);
        }
    }
    return distances;
}
// ---------------------------------------------------------------------------
// Public selection API
// ---------------------------------------------------------------------------
function selectSurvivors(individuals, topK, objectives) {
    const valid = individuals.filter((ind) => ind.success && ind.fitness !== null);
    const invalid = individuals.filter((ind) => !ind.success || ind.fitness === null);
    if (valid.length === 0)
        return { keep: [], eliminate: invalid };
    const fronts = fastNonDominatedSort(valid, objectives);
    for (let rank = 0; rank < fronts.length; rank++) {
        for (const ind of fronts[rank])
            ind.pareto_rank = rank + 1;
    }
    const keep = [];
    let remaining = topK;
    for (const front of fronts) {
        if (remaining <= 0)
            break;
        if (front.length <= remaining) {
            keep.push(...front);
            remaining -= front.length;
        }
        else {
            const distances = crowdingDistanceAssignment(front, objectives);
            const sorted = [...front].sort((a, b) => (distances.get(b.branch) ?? 0) - (distances.get(a.branch) ?? 0));
            keep.push(...sorted.slice(0, remaining));
            remaining = 0;
        }
    }
    const keepSet = new Set(keep.map((ind) => ind.branch));
    const eliminate = valid.filter((ind) => !keepSet.has(ind.branch)).concat(invalid);
    return { keep, eliminate };
}
function rankSelect(individuals, nPairs, objectives) {
    const valid = individuals.filter((ind) => ind.success && ind.fitness !== null);
    if (valid.length < 2)
        return [];
    const fronts = fastNonDominatedSort(valid, objectives);
    const rankOf = new Map();
    const cdOf = new Map();
    for (let rank = 0; rank < fronts.length; rank++) {
        for (const ind of fronts[rank])
            rankOf.set(ind.branch, rank + 1);
        const cd = crowdingDistanceAssignment(fronts[rank], objectives);
        for (const [k, v] of cd)
            cdOf.set(k, v);
    }
    valid.sort((a, b) => {
        const ra = rankOf.get(a.branch) ?? 9999, rb = rankOf.get(b.branch) ?? 9999;
        if (ra !== rb)
            return ra - rb;
        return (cdOf.get(b.branch) ?? 0) - (cdOf.get(a.branch) ?? 0);
    });
    const n = valid.length;
    const probs = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
        const p = 1.0 / (i + 1 + n);
        probs.push(p);
        total += p;
    }
    for (let i = 0; i < n; i++)
        probs[i] /= total;
    const isBetter = (a, b) => {
        const ra = rankOf.get(a.branch) ?? 9999, rb = rankOf.get(b.branch) ?? 9999;
        if (ra !== rb)
            return ra < rb;
        return (cdOf.get(a.branch) ?? 0) >= (cdOf.get(b.branch) ?? 0);
    };
    const pairs = [];
    const maxTrials = nPairs * 100;
    let trials = 0;
    while (pairs.length < nPairs && trials < maxTrials) {
        trials++;
        const idxs = weightedSampleTwo(probs);
        if (!idxs)
            continue;
        const [a, b] = [valid[idxs[0]], valid[idxs[1]]];
        if (a.branch === b.branch)
            continue;
        pairs.push(isBetter(a, b) ? [a, b] : [b, a]);
    }
    return pairs;
}
// ---------------------------------------------------------------------------
// Generation planning
// ---------------------------------------------------------------------------
function planGeneration(targets, popSize, mutationRate, structuralRate, budgetRemaining, synergyInterval, generation) {
    const plan = [];
    const active = {};
    for (const [k, v] of Object.entries(targets)) {
        if (v.status === "active")
            active[k] = v;
    }
    if (Object.keys(active).length === 0)
        return plan;
    let totalTemp = Object.values(active).reduce((s, t) => s + t.temperature, 0);
    if (totalTemp === 0)
        totalTemp = Object.keys(active).length;
    for (const [targetId, target] of Object.entries(active)) {
        const weight = target.temperature / totalTemp;
        const nVariants = Math.max(1, Math.round(popSize * weight));
        let effectiveStructuralRate = structuralRate;
        if (target.stagnation_count >= 3)
            effectiveStructuralRate = Math.min(0.5, structuralRate * 2);
        const nStructural = Math.round(nVariants * effectiveStructuralRate);
        const nRemaining = Math.max(1, nVariants - nStructural);
        if (nStructural > 0) {
            plan.push({
                target_id: targetId,
                operation: models_js_1.Operation.STRUCTURAL,
                count: nStructural,
                priority: target.stagnation_count >= 3 ? "high" : "medium",
            });
        }
        const nMutate = Math.max(1, Math.round(nRemaining * mutationRate));
        const nCrossover = Math.max(0, nRemaining - nMutate);
        if (nCrossover > 0) {
            plan.push({
                target_id: targetId,
                operation: models_js_1.Operation.CROSSOVER,
                count: nCrossover,
                priority: target.temperature > 1.0 ? "high" : "medium",
            });
        }
        plan.push({
            target_id: targetId,
            operation: models_js_1.Operation.MUTATE,
            count: nMutate,
            priority: target.temperature > 1.0 ? "high" : "medium",
        });
    }
    const activeIds = Object.keys(active);
    if (generation > 0 && generation % synergyInterval === 0 && activeIds.length > 1) {
        for (let i = 0; i < activeIds.length; i++) {
            for (let j = i + 1; j < activeIds.length; j++) {
                plan.push({
                    target_id: `${activeIds[i]}+${activeIds[j]}`,
                    operation: models_js_1.Operation.SYNERGY,
                    count: 1,
                    priority: "low",
                });
            }
        }
    }
    return plan;
}
function updateTemperatures(targets) {
    for (const target of Object.values(targets)) {
        if (target.status === "frozen") {
            target.temperature = 0;
            continue;
        }
        if (target.stagnation_count === 0) {
            target.temperature = Math.min(2.0, target.temperature + 0.3);
        }
        else if (target.stagnation_count >= 3) {
            target.temperature = Math.max(0.2, target.temperature - 0.2);
        }
    }
}
// ---------------------------------------------------------------------------
// Pareto front helpers
// ---------------------------------------------------------------------------
function paretoFrontOf(individuals, objectives) {
    const fronts = fastNonDominatedSort(individuals, objectives);
    return fronts.length > 0 ? fronts[0] : [];
}
function representativeBranch(paretoBranches, individuals, objectives) {
    const candidates = paretoBranches
        .filter((b) => b in individuals && individuals[b].fitness !== null)
        .map((b) => individuals[b]);
    if (candidates.length === 0)
        return null;
    const reverse = objectives[0].direction === models_js_1.Objective.MAX;
    candidates.sort((a, b) => reverse ? b.fitness[0] - a.fitness[0] : a.fitness[0] - b.fitness[0]);
    return candidates[0].branch;
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function weightedSampleTwo(probs) {
    if (probs.length < 2)
        return null;
    const idx1 = weightedChoice(probs);
    const adjusted = [...probs];
    adjusted[idx1] = 0;
    const total = adjusted.reduce((s, p) => s + p, 0);
    if (total === 0)
        return null;
    for (let i = 0; i < adjusted.length; i++)
        adjusted[i] /= total;
    const idx2 = weightedChoice(adjusted);
    return [idx1, idx2];
}
function weightedChoice(probs) {
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
        cumulative += probs[i];
        if (r <= cumulative)
            return i;
    }
    return probs.length - 1;
}
