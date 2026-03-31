/**
 * D/E-layer: Minimal paper writing helpers.
 *
 * Converts a derivation forest into a method section and assembles a minimal
 * LaTeX paper draft around that section.
 */
import type { DerivationForest } from "./models.js";
export interface GeneratedSection {
    title: string;
    latex: string;
    summary: Record<string, unknown>;
}
export interface GeneratedPaper {
    latex: string;
    summary: Record<string, unknown>;
    sections: Record<string, string>;
}
export interface GeneratedPaperBundle {
    main_latex: string;
    main_summary: Record<string, unknown>;
    files: Record<string, string>;
}
export interface PaperValidationResult {
    ok: boolean;
    errors: string[];
    warnings: string[];
    checked_files: string[];
}
export interface PaperDraftOptions {
    title: string;
    author?: string;
    abstract_latex?: string;
    intro_latex?: string;
    related_latex?: string;
    method_latex?: string;
    experiments_latex?: string;
    conclusion_latex?: string;
    bibliography_path?: string;
    output_path?: string;
}
export interface PaperBundleOptions extends PaperDraftOptions {
    sections_dir?: string;
}
export declare function generateIntroductionSection(forest: DerivationForest, sectionTitle?: string): GeneratedSection;
export declare function generateRelatedWorkSection(forest: DerivationForest, sectionTitle?: string): GeneratedSection;
export declare function generateExperimentsSection(forest: DerivationForest, sectionTitle?: string): GeneratedSection;
export declare function generateMethodSection(forest: DerivationForest, sectionTitle?: string): GeneratedSection;
export declare function generatePaperDraft(forest: DerivationForest | null, options: PaperDraftOptions): GeneratedPaper;
export declare function generatePaperBundle(forest: DerivationForest | null, options: PaperBundleOptions): GeneratedPaperBundle;
export declare function resolveRepoOutputPath(repoPath: string, outputPath: string): string;
export declare function writeGeneratedArtifact(repoPath: string, outputPath: string, content: string): string;
export declare function writeGeneratedArtifacts(repoPath: string, files: Record<string, string>): Record<string, string>;
export declare function validatePaperArtifacts(repoPath: string, mainOutputPath: string, bibliographyPath?: string): PaperValidationResult;
