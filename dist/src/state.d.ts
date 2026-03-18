/**
 * State persistence and Pareto bookkeeping helpers.
 */
import type { EvolutionState, Individual, ObjectiveSpec } from "./models.js";
export declare function save(): void;
export declare function getState(): EvolutionState;
export declare function setState(s: EvolutionState): void;
export declare function updateGlobalPareto(state: EvolutionState): void;
export declare function updateTargetPareto(state: EvolutionState, targetId: string): void;
export declare function paretoFrontExpanded(newIndividuals: Individual[], existingFrontBranches: string[], allIndividuals: Record<string, Individual>, objectives: ObjectiveSpec[]): boolean;
