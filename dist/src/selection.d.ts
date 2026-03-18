/**
 * Selection algorithms for evolutionary population management.
 * TypeScript port of selection.py — NSGA-II semantics.
 */
import type { Individual, ObjectiveSpec, Target } from "./models.js";
import { Operation } from "./models.js";
export declare function dominates(a: number[], b: number[], objectives: ObjectiveSpec[]): boolean;
export declare function fastNonDominatedSort(individuals: Individual[], objectives: ObjectiveSpec[]): Individual[][];
export declare function crowdingDistanceAssignment(front: Individual[], objectives: ObjectiveSpec[]): Map<string, number>;
export declare function selectSurvivors(individuals: Individual[], topK: number, objectives: ObjectiveSpec[]): {
    keep: Individual[];
    eliminate: Individual[];
};
export declare function rankSelect(individuals: Individual[], nPairs: number, objectives: ObjectiveSpec[]): [Individual, Individual][];
export declare function planGeneration(targets: Record<string, Target>, popSize: number, mutationRate: number, structuralRate: number, budgetRemaining: number, synergyInterval: number, generation: number): {
    target_id: string;
    operation: Operation;
    count: number;
    priority: string;
}[];
export declare function updateTemperatures(targets: Record<string, Target>): void;
export declare function paretoFrontOf(individuals: Individual[], objectives: ObjectiveSpec[]): Individual[];
export declare function representativeBranch(paretoBranches: string[], individuals: Record<string, Individual>, objectives: ObjectiveSpec[]): string | null;
