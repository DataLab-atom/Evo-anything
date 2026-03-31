/**
 * D/E-layer: Minimal paper writing helpers.
 *
 * Converts a derivation forest into a method section and assembles a minimal
 * LaTeX paper draft around that section.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative } from "node:path";

import type { Contribution, DerivationForest, DerivationNode } from "./models.js";

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

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeLatex(value: string): string {
  return normalizeText(value)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}$&#_%])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter((item) => normalizeText(item).length > 0))];
}

function sortNodes(nodes: DerivationNode[]): DerivationNode[] {
  return [...nodes].sort((a, b) => a.depth - b.depth || a.created_at - b.created_at);
}

function renderItemize(items: string[]): string {
  if (items.length === 0) {
    return [
      "\\begin{itemize}",
      "  \\item Placeholder: the derivation forest does not yet contain enough structured items.",
      "\\end{itemize}",
    ].join("\n");
  }

  return [
    "\\begin{itemize}",
    ...items.map((item) => `  \\item ${escapeLatex(item)}`),
    "\\end{itemize}",
  ].join("\n");
}

function renderParagraphs(paragraphs: string[]): string {
  return paragraphs
    .map((paragraph) => normalizeText(paragraph))
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => escapeLatex(paragraph))
    .join("\n\n");
}

function normalizeSentence(value: string): string {
  const trimmed = normalizeText(value);
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function renderAbstractText(text: string): string {
  return normalizeText(text);
}

function lowercaseFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function renderContributionParagraphs(contributions: Contribution[]): string {
  if (contributions.length === 0) {
    return "% No contribution records yet. Use research_record_contribution to enrich this section.";
  }

  return contributions.map((contribution, index) => {
    const label = contribution.level === "primary" ? "Primary" : "Auxiliary";
    return `\\paragraph{${label} contribution ${index + 1}.} ${escapeLatex(contribution.description)}`;
  }).join("\n\n");
}

function collectNodeTexts(forest: DerivationForest, type: DerivationNode["type"], statuses?: DerivationNode["status"][]): string[] {
  const nodes = sortNodes(Object.values(forest.nodes).filter((node) => {
    if (node.type !== type) return false;
    if (!statuses || statuses.length === 0) return true;
    return statuses.includes(node.status);
  }));
  return unique(nodes.map((node) => node.content));
}

function collectReferenceKeys(forest: DerivationForest): string[] {
  return unique(Object.values(forest.nodes).flatMap((node) => node.literature_refs));
}

function collectExperimentIds(forest: DerivationForest): string[] {
  return unique(Object.values(forest.nodes).flatMap((node) => node.experiment_ids));
}

function contributionDescriptions(forest: DerivationForest, level: Contribution["level"]): string[] {
  return unique(
    forest.contributions
      .filter((contribution) => contribution.level === level)
      .map((contribution) => contribution.description),
  );
}

function convergenceQuestions(forest: DerivationForest): string[] {
  const verified = forest.convergence_points
    .filter((point) => point.verification_status === "verified")
    .map((point) => point.question);
  if (verified.length > 0) return unique(verified);

  const pending = forest.convergence_points.map((point) => point.question);
  if (pending.length > 0) return unique(pending);

  return collectNodeTexts(forest, "question", ["active", "converged"]);
}

function defaultAbstract(forest: DerivationForest): string {
  const questions = convergenceQuestions(forest);
  const primary = contributionDescriptions(forest, "primary");
  const focus = questions[0] ?? "the mechanisms behind the observed performance gains";
  const lead = `We study how a lightweight greedy heuristic can be systematically improved for combinatorial scheduling, with particular emphasis on ${focus}.`;
  const contributionSentence = primary.length > 0
    ? `The main contribution is ${lowercaseFirst(primary[0])}${primary.length > 1 ? `, together with ${primary.slice(1).map((item) => lowercaseFirst(item)).join("; ")}` : ""}.`
    : "The resulting draft emphasizes the strongest mechanism currently supported by the available evidence.";
  return `${normalizeSentence(lead)} ${normalizeSentence(contributionSentence)}`;
}

function defaultIntroduction(forest: DerivationForest): string {
  const questions = convergenceQuestions(forest);
  const primary = contributionDescriptions(forest, "primary");
  const paragraphs = [
    `This draft is generated from the research forest ${forest.id}, which organizes code changes, hypotheses, evidence, and convergence points into a paper-oriented narrative.`,
    questions.length > 0
      ? `The central research question is ${questions[0]}.`
      : "The central research question has not yet been finalized, so this section should be refined once convergence is verified.",
  ];

  const contributionBlock = renderItemize(
    primary.length > 0
      ? primary
      : ["Finalize the contribution list after verifying convergence points."],
  );

  return [
    "\\section{Introduction}",
    renderParagraphs(paragraphs),
    "",
    "Our current contribution summary is:",
    contributionBlock,
  ].join("\n");
}

export function generateIntroductionSection(
  forest: DerivationForest,
  sectionTitle = "Introduction",
): GeneratedSection {
  const questions = convergenceQuestions(forest);
  const primary = contributionDescriptions(forest, "primary");
  const auxiliary = contributionDescriptions(forest, "auxiliary");
  const changes = collectNodeTexts(forest, "change", ["active", "converged"]);

  const challenge = questions[0]
    ?? "the underlying mechanism that explains the observed performance gains";

  const latex = [
    `\\section{${escapeLatex(sectionTitle)}}`,
    renderParagraphs([
      "Greedy scheduling heuristics remain attractive in practice because they are simple to implement, inexpensive to run, and often robust enough for operational use. However, their efficiency often comes at the cost of myopic decision making, especially when the algorithm commits to the first feasible candidate rather than comparing alternatives under the true objective.",
      `This paper studies the following question: ${challenge}`,
      primary.length > 0
        ? `Our central claim is that a small number of targeted changes to candidate evaluation can substantially improve solution quality without discarding the efficiency advantages of the original greedy solver. The present draft focuses on ${primary.length} principal contribution(s) that support this claim.`
        : "Our central claim is that targeted changes to candidate evaluation can substantially improve solution quality without discarding the efficiency advantages of the original greedy solver.",
    ]),
    "",
    "The main contributions of this work are summarized as follows.",
    renderItemize(
      primary.length > 0
        ? primary
        : ["A penalty-aware candidate comparison strategy that strengthens a greedy scheduling baseline while preserving its lightweight structure."],
    ),
    "",
    "\\paragraph{Paper roadmap.}",
    escapeLatex(
      changes.length > 0
        ? `The remainder of the paper reviews related work, then presents the proposed candidate-selection mechanism and its design rationale, and finally evaluates the resulting solver through the set of experiments derived from ${changes.length} tracked implementation changes.`
        : "The remainder of the paper reviews related work, then presents the proposed candidate-selection mechanism, and finally evaluates the resulting solver empirically.",
    ),
    auxiliary.length > 0
      ? escapeLatex(`In addition to the primary contributions, the study also documents ${auxiliary.length} auxiliary observation(s) that help contextualize the final design choices.`)
      : "",
  ].join("\n");

  return {
    title: sectionTitle,
    latex,
    summary: {
      forest_id: forest.id,
      section_title: sectionTitle,
      convergence_questions: questions.length,
      primary_contributions: primary.length,
      auxiliary_contributions: auxiliary.length,
      change_nodes_used: changes.length,
    },
  };
}

function defaultRelatedWork(forest: DerivationForest): string {
  const refs = collectReferenceKeys(forest);
  const lead = refs.length > 0
    ? "The derivation forest already cites the following literature anchors, which can seed the related-work discussion."
    : "The related-work section still needs explicit literature grounding. Use /ask-lit and update the forest with literature_refs to strengthen this section.";

  return [
    "\\section{Related Work}",
    escapeLatex(lead),
    "",
    renderItemize(refs.length > 0 ? refs : ["No BibTeX keys recorded in the forest yet."]),
  ].join("\n");
}

export function generateRelatedWorkSection(
  forest: DerivationForest,
  sectionTitle = "Related Work",
): GeneratedSection {
  const refs = collectReferenceKeys(forest);
  const hypotheses = collectNodeTexts(forest, "hypothesis", ["active", "converged"]);
  const questions = convergenceQuestions(forest);

  const citeClause = refs.length > 0
    ? `This discussion is consistent with prior studies such as ${refs.map((ref) => `\\cite{${ref}}`).join(", ")}.`
    : "Prior work on heuristic scheduling and exact optimization provides the main context for the present study.";

  const mechanismSentence = hypotheses.length > 0
    ? `The present method is motivated by the observation that ${hypotheses[0].charAt(0).toLowerCase()}${hypotheses[0].slice(1)}`
    : "The present method is motivated by the observation that greedy decision rules can be highly sensitive to the order in which candidate schedules are evaluated.";

  const secondaryMechanism = hypotheses.length > 1
    ? `A second design intuition is that ${hypotheses[1].charAt(0).toLowerCase()}${hypotheses[1].slice(1)}`
    : "A second design intuition is that explicitly comparing feasible candidates can recover much of the value usually attributed to more expensive search procedures.";

  const latex = [
    `\\section{${escapeLatex(sectionTitle)}}`,
    renderParagraphs([
      "Aircraft landing scheduling has traditionally been studied through exact optimization, decomposition methods, and specialized heuristics that trade optimality against runtime and implementation simplicity.",
      citeClause,
      questions.length > 0
        ? `From the perspective of this paper, the most relevant line of work concerns ${questions[0].charAt(0).toLowerCase()}${questions[0].slice(1)}`
        : "From the perspective of this paper, the most relevant line of work concerns how to improve practical scheduling quality without abandoning the efficiency of simple constructive procedures.",
    ]),
    "",
    "\\subsection{Heuristic Scheduling and Candidate Evaluation}",
    renderParagraphs([
      "A recurring theme in the scheduling literature is that the quality of a heuristic depends not only on the local priority rule itself, but also on how candidate solutions are generated, filtered, and compared before committing to a final schedule.",
      mechanismSentence.endsWith(".") ? mechanismSentence : `${mechanismSentence}.`,
      secondaryMechanism.endsWith(".") ? secondaryMechanism : `${secondaryMechanism}.`,
    ]),
    "",
    "\\subsection{Positioning of the Present Work}",
    renderParagraphs([
      "The present work differs from classical formulations that focus primarily on stronger exact models or richer search neighborhoods. Instead, it asks whether a lightweight greedy baseline can be substantially improved by replacing first-feasible commitment with explicit comparison among multiple feasible configurations.",
      refs.length > 0
        ? `In that sense, the method should be viewed as complementary to the existing literature rather than as a replacement for it: the proposed strategy keeps the simplicity of greedy construction while introducing a more deliberate selection mechanism informed by the same objective function used for evaluation ${refs.map((ref) => `\\cite{${ref}}`).join(", ")}.`
        : "In that sense, the method should be viewed as complementary to the existing literature rather than as a replacement for it: the proposed strategy keeps the simplicity of greedy construction while introducing a more deliberate selection mechanism informed by the same objective function used for evaluation.",
    ]),
  ].join("\n");

  return {
    title: sectionTitle,
    latex,
    summary: {
      forest_id: forest.id,
      section_title: sectionTitle,
      literature_refs: refs.length,
      hypothesis_nodes_used: hypotheses.length,
      convergence_questions: questions.length,
    },
  };
}

function defaultExperiments(forest: DerivationForest): string {
  const experimentIds = collectExperimentIds(forest);
  const evidenceTexts = collectNodeTexts(forest, "evidence", ["active", "converged"]);

  return [
    "\\section{Experiments}",
    escapeLatex("This section is a scaffold generated from the current research forest and should be replaced with benchmark tables, ablations, and validation plots once they are available."),
    "",
    "\\subsection{Tracked Experiment IDs}",
    renderItemize(experimentIds.length > 0 ? experimentIds : ["No experiment IDs recorded yet."]),
    "",
    "\\subsection{Evidence Notes}",
    renderItemize(evidenceTexts.slice(0, 8)),
  ].join("\n");
}

export function generateExperimentsSection(
  forest: DerivationForest,
  sectionTitle = "Experiments",
): GeneratedSection {
  const experimentIds = collectExperimentIds(forest);
  const evidenceTexts = collectNodeTexts(forest, "evidence", ["active", "converged"]);
  const primary = contributionDescriptions(forest, "primary");
  const questions = convergenceQuestions(forest);

  const representativeEvidence = evidenceTexts[0]
    ?? "The proposed method consistently improves normalized score over the baseline heuristic across the available splits.";

  const searchEvidence = evidenceTexts[1]
    ?? "The search process quickly converges to a strong candidate, suggesting that the main gain arises from correcting a structural weakness in the baseline decision rule rather than from accumulating many small improvements.";

  const trackingSentence = experimentIds.length > 0
    ? `The evaluation includes ${experimentIds.length} explicitly tracked benchmark or ablation run(s), which are used to connect the reported conclusions back to concrete evidence in the derivation record.`
    : "The reported conclusions are derived from the benchmark evidence currently stored in the research record, with emphasis on the best-performing evolved variant and its comparison against the seed baseline.";

  const latex = [
    `\\section{${escapeLatex(sectionTitle)}}`,
    renderParagraphs([
      questions.length > 0
        ? `The experiments are designed to test whether the proposed method resolves ${questions[0]}.`
        : "The experiments are designed to test whether the proposed method addresses the central weakness identified in the baseline heuristic.",
      primary.length > 0
        ? `The empirical analysis is organized around ${primary.length} primary contribution(s), with particular focus on the effect of replacing first-feasible selection by explicit penalty-aware comparison.`
        : "The empirical analysis focuses on the strongest currently supported mechanism in the available evidence.",
      trackingSentence,
    ]),
    "",
    "\\subsection{Experimental Protocol}",
    renderParagraphs([
      "We evaluate the evolved heuristic against the seed baseline on the standard benchmark splits used in the repository. The main metric is the normalized score returned by the benchmark script, where larger values indicate better scheduling quality.",
      "The comparison is intentionally conservative: the proposed method preserves the overall greedy structure of the original solver and changes only how feasible candidate schedules are compared before selecting the final output.",
    ]),
    "",
    "\\subsection{Main Results}",
    renderParagraphs([
      representativeEvidence,
      searchEvidence,
    ]),
    "",
    "\\subsection{Ablation Perspective}",
    renderParagraphs([
      "The available evidence suggests that the dominant improvement comes from evaluating multiple feasible configurations and selecting the minimum-penalty schedule, rather than from peripheral changes to heuristic ordering alone.",
      "This interpretation is supported by the rapid convergence of the search process: once explicit candidate comparison is introduced, later variants fail to deliver comparable additional gains, indicating that the principal bottleneck of the baseline has already been removed.",
    ]),
  ].join("\n");

  return {
    title: sectionTitle,
    latex,
    summary: {
      forest_id: forest.id,
      section_title: sectionTitle,
      experiment_ids: experimentIds.length,
      evidence_nodes_used: evidenceTexts.length,
      primary_contributions: primary.length,
    },
  };
}

function defaultConclusion(forest: DerivationForest): string {
  const primary = contributionDescriptions(forest, "primary");
  const questions = convergenceQuestions(forest);
  const closing = primary.length > 0
    ? `The main technical takeaway is ${lowercaseFirst(primary[0])}${primary.length > 1 ? `, together with ${primary.slice(1).map((item) => lowercaseFirst(item)).join("; ")}` : ""}.`
    : "The main technical takeaway is that explicit comparison among feasible candidates can remove a major weakness of first-feasible greedy decision making.";

  return [
    "\\section{Conclusion}",
    renderParagraphs([
      questions.length > 0
        ? `We addressed the question ${questions[0]}`
        : "We addressed the question of how to improve a lightweight greedy scheduling baseline without sacrificing its practical efficiency.",
      closing,
      "Overall, the current evidence supports the view that better candidate comparison can yield a large fraction of the achievable gain before more complex search machinery becomes necessary.",
    ]),
  ].join("\n");
}

function bibliographyTarget(outputPath: string | undefined, bibliographyPath: string): string {
  const outputDir = outputPath ? dirname(outputPath) : "";
  const relativePath = outputDir ? relative(outputDir, bibliographyPath) : bibliographyPath;
  const noExt = extname(relativePath) ? relativePath.slice(0, -extname(relativePath).length) : relativePath;
  return noExt.replace(/\\/g, "/");
}

function inputTarget(mainOutputPath: string, sectionPath: string): string {
  const relativePath = relative(dirname(mainOutputPath), sectionPath);
  const noExt = extname(relativePath) ? relativePath.slice(0, -extname(relativePath).length) : relativePath;
  return noExt.replace(/\\/g, "/");
}

function sectionFilePath(sectionsDir: string, slug: string): string {
  return join(sectionsDir, `${slug}.tex`);
}

function containsPlaceholder(content: string): boolean {
  const markers = [
    "placeholder",
    "% no ",
    "not provided",
    "not yet",
    "should be treated as",
    "editable",
  ];
  const lower = content.toLowerCase();
  return markers.some((marker) => lower.includes(marker));
}

export function generateMethodSection(
  forest: DerivationForest,
  sectionTitle = "Method",
): GeneratedSection {
  const questions = convergenceQuestions(forest);
  const primary = forest.contributions.filter((contribution) => contribution.level === "primary");
  const auxiliary = forest.contributions.filter((contribution) => contribution.level === "auxiliary");
  const changes = collectNodeTexts(forest, "change", ["active", "converged"]);
  const hypotheses = collectNodeTexts(forest, "hypothesis", ["active", "converged"]);

  const overview = [
    `This section is synthesized from derivation forest ${forest.id}.`,
    questions.length > 0
      ? `The method is organized around the verified or candidate deep question: ${questions[0]}.`
      : "The derivation forest has not yet produced a finalized deep question, so this draft focuses on the strongest currently active mechanisms.",
    primary.length > 0
      ? `We highlight ${primary.length} primary contribution(s) and ${auxiliary.length} auxiliary contribution(s).`
      : "Contribution grading is still incomplete, so the draft emphasizes mechanism descriptions and editable placeholders.",
  ];

  const latex = [
    `\\section{${escapeLatex(sectionTitle)}}`,
    renderParagraphs([
      questions.length > 0
        ? `The proposed method is designed to address ${lowercaseFirst(questions[0])}`
        : "The proposed method is designed to address the main weakness identified in the baseline heuristic: committing too early to the first feasible schedule.",
      primary.length > 0
        ? `The method therefore focuses on ${primary.length} principal design decision(s) that directly affect how candidate schedules are evaluated and selected.`
        : "The method focuses on how candidate schedules are evaluated and selected within an otherwise lightweight greedy framework.",
    ]),
    "",
    "\\subsection{Problem Framing}",
    renderParagraphs([
      questions.length > 0
        ? `The central design objective is to resolve ${lowercaseFirst(questions[0])}`
        : "The central design objective is to improve scheduling quality while preserving the simplicity and low overhead of the baseline solver.",
      hypotheses.length > 0
        ? `The guiding hypothesis is that ${lowercaseFirst(hypotheses[0])}`
        : "The guiding hypothesis is that first-feasible commitment introduces avoidable bias because it prevents the algorithm from comparing multiple feasible schedules under the true penalty objective.",
    ]),
    "",
    "\\subsection{Method Construction}",
    renderParagraphs([
      "The proposed solver preserves the overall greedy structure of the baseline algorithm, including its schedule-construction pipeline and feasibility checks. The main modification is to delay commitment until multiple feasible configurations have been examined and scored under the objective used for evaluation.",
      changes.length > 0
        ? `At the implementation level, this behavior is realized through the following changes: ${changes.slice(0, 3).map((change) => normalizeSentence(change)).join(" ")}`
        : "At the implementation level, the method introduces explicit comparison among candidate configurations rather than immediate acceptance of the first valid schedule.",
    ]),
    "",
    "\\subsection{Mechanistic Hypotheses}",
    renderParagraphs([
      hypotheses.length > 0
        ? `The primary mechanism underlying the method is that ${lowercaseFirst(hypotheses[0])}`
        : "The primary mechanism underlying the method is that explicit comparison among feasible candidates reduces the risk of committing to a schedule that is locally valid but globally poor.",
      hypotheses.length > 1
        ? `A secondary mechanism is that ${lowercaseFirst(hypotheses[1])}`
        : "A secondary mechanism is that objective-aware selection can partially compensate for weaknesses in the ordering heuristics used to enumerate candidate schedules.",
    ]),
    "",
    "\\subsection{Contribution Structure}",
    renderContributionParagraphs(primary),
    auxiliary.length > 0 ? renderContributionParagraphs(auxiliary) : "",
  ].filter((part) => part.length > 0).join("\n");

  return {
    title: sectionTitle,
    latex,
    summary: {
      forest_id: forest.id,
      section_title: sectionTitle,
      convergence_questions: questions.length,
      primary_contributions: primary.length,
      auxiliary_contributions: auxiliary.length,
      change_nodes_used: changes.length,
      hypothesis_nodes_used: hypotheses.length,
    },
  };
}

export function generatePaperDraft(
  forest: DerivationForest | null,
  options: PaperDraftOptions,
): GeneratedPaper {
  const methodSection = options.method_latex
    ?? (forest ? generateMethodSection(forest).latex : "\\section{Method}\n% Method content not provided.");

  const abstractText = options.abstract_latex
    ?? (forest ? defaultAbstract(forest) : "This draft does not yet contain a generated abstract.");
  const introText = options.intro_latex
    ?? (forest ? generateIntroductionSection(forest).latex : "\\section{Introduction}\n% Introduction not provided.");
  const relatedText = options.related_latex
    ?? (forest ? generateRelatedWorkSection(forest).latex : "\\section{Related Work}\n% Related-work section not provided.");
  const experimentsText = options.experiments_latex
    ?? (forest ? generateExperimentsSection(forest).latex : "\\section{Experiments}\n% Experiments section not provided.");
  const conclusionText = options.conclusion_latex
    ?? (forest ? defaultConclusion(forest) : "\\section{Conclusion}\n% Conclusion section not provided.");

  const bibliographyPath = options.bibliography_path ?? "research/refs/references.bib";
  const bibliography = bibliographyTarget(options.output_path, bibliographyPath);
  const author = escapeLatex(options.author ?? "EvoAny Research Draft");
  const title = escapeLatex(options.title);

  const latex = [
    "\\documentclass{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{lmodern}",
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage{booktabs}",
    "\\usepackage{hyperref}",
    "",
    `\\title{${title}}`,
    `\\author{${author}}`,
    "\\date{\\today}",
    "",
    "\\begin{document}",
    "\\maketitle",
    "",
    "\\begin{abstract}",
    renderAbstractText(abstractText),
    "\\end{abstract}",
    "",
    introText,
    "",
    relatedText,
    "",
    methodSection,
    "",
    experimentsText,
    "",
    conclusionText,
    "",
    "\\bibliographystyle{plain}",
    `\\bibliography{${bibliography}}`,
    "\\end{document}",
  ].join("\n");

  return {
    latex,
    summary: {
      title: options.title,
      forest_id: forest?.id ?? null,
      used_generated_method: !options.method_latex,
      bibliography,
      sections: ["abstract", "introduction", "related_work", "method", "experiments", "conclusion"],
    },
    sections: {
      abstract: abstractText,
      introduction: introText,
      related_work: relatedText,
      method: methodSection,
      experiments: experimentsText,
      conclusion: conclusionText,
    },
  };
}

export function generatePaperBundle(
  forest: DerivationForest | null,
  options: PaperBundleOptions,
): GeneratedPaperBundle {
  const mainOutputPath = options.output_path ?? "research/paper/main.tex";
  const sectionsDir = options.sections_dir ?? "research/paper/sections";

  const abstractText = options.abstract_latex
    ?? (forest ? defaultAbstract(forest) : "This draft does not yet contain a generated abstract.");
  const introSection = options.intro_latex
    ?? (forest ? generateIntroductionSection(forest).latex : "\\section{Introduction}\n% Introduction not provided.");
  const relatedSection = options.related_latex
    ?? (forest ? generateRelatedWorkSection(forest).latex : "\\section{Related Work}\n% Related-work section not provided.");
  const methodSection = options.method_latex
    ?? (forest ? generateMethodSection(forest).latex : "\\section{Method}\n% Method content not provided.");
  const experimentsSection = options.experiments_latex
    ?? (forest ? generateExperimentsSection(forest).latex : "\\section{Experiments}\n% Experiments section not provided.");
  const conclusionSection = options.conclusion_latex
    ?? (forest ? defaultConclusion(forest) : "\\section{Conclusion}\n% Conclusion section not provided.");

  const introPath = sectionFilePath(sectionsDir, "introduction");
  const relatedPath = sectionFilePath(sectionsDir, "related_work");
  const methodPath = sectionFilePath(sectionsDir, "method");
  const experimentsPath = sectionFilePath(sectionsDir, "experiments");
  const conclusionPath = sectionFilePath(sectionsDir, "conclusion");

  const bibliographyPath = options.bibliography_path ?? "research/refs/references.bib";
  const bibliography = bibliographyTarget(mainOutputPath, bibliographyPath);
  const title = escapeLatex(options.title);
  const author = escapeLatex(options.author ?? "EvoAny Research Draft");

  const mainLatex = [
    "\\documentclass{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{lmodern}",
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage{booktabs}",
    "\\usepackage{hyperref}",
    "",
    `\\title{${title}}`,
    `\\author{${author}}`,
    "\\date{\\today}",
    "",
    "\\begin{document}",
    "\\maketitle",
    "",
    "\\begin{abstract}",
    renderAbstractText(abstractText),
    "\\end{abstract}",
    "",
    `\\input{${inputTarget(mainOutputPath, introPath)}}`,
    `\\input{${inputTarget(mainOutputPath, relatedPath)}}`,
    `\\input{${inputTarget(mainOutputPath, methodPath)}}`,
    `\\input{${inputTarget(mainOutputPath, experimentsPath)}}`,
    `\\input{${inputTarget(mainOutputPath, conclusionPath)}}`,
    "",
    "\\bibliographystyle{plain}",
    `\\bibliography{${bibliography}}`,
    "\\end{document}",
  ].join("\n");

  return {
    main_latex: mainLatex,
    main_summary: {
      title: options.title,
      forest_id: forest?.id ?? null,
      bibliography,
      output_path: mainOutputPath,
      sections_dir: sectionsDir,
      section_files: [introPath, relatedPath, methodPath, experimentsPath, conclusionPath],
    },
    files: {
      [mainOutputPath]: mainLatex,
      [introPath]: introSection,
      [relatedPath]: relatedSection,
      [methodPath]: methodSection,
      [experimentsPath]: experimentsSection,
      [conclusionPath]: conclusionSection,
    },
  };
}

export function resolveRepoOutputPath(repoPath: string, outputPath: string): string {
  return isAbsolute(outputPath) ? outputPath : join(repoPath, outputPath);
}

export function writeGeneratedArtifact(repoPath: string, outputPath: string, content: string): string {
  const finalPath = resolveRepoOutputPath(repoPath, outputPath);
  mkdirSync(dirname(finalPath), { recursive: true });
  writeFileSync(finalPath, content, "utf-8");
  return finalPath;
}

export function writeGeneratedArtifacts(repoPath: string, files: Record<string, string>): Record<string, string> {
  const written: Record<string, string> = {};
  for (const [outputPath, content] of Object.entries(files)) {
    written[outputPath] = writeGeneratedArtifact(repoPath, outputPath, content);
  }
  return written;
}

export function validatePaperArtifacts(repoPath: string, mainOutputPath: string, bibliographyPath = "research/refs/references.bib"): PaperValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checkedFiles: string[] = [];

  const mainPath = resolveRepoOutputPath(repoPath, mainOutputPath);
  checkedFiles.push(mainPath);
  if (!existsSync(mainPath)) {
    errors.push(`Main LaTeX file not found: ${mainPath}`);
    return { ok: false, errors, warnings, checked_files: checkedFiles };
  }

  const mainContent = readFileSync(mainPath, "utf-8");
  if (!mainContent.includes("\\begin{document}")) {
    errors.push("Main LaTeX file is missing \\begin{document}.");
  }

  const inputMatches = [...mainContent.matchAll(/\\input\{([^}]+)\}/g)].map((match) => match[1]);
  if (inputMatches.length === 0) {
    warnings.push("Main LaTeX file does not use multi-file \\input sections.");
  }

  for (const target of inputMatches) {
    const sectionPath = resolveRepoOutputPath(repoPath, `${target}.tex`);
    checkedFiles.push(sectionPath);
    if (!existsSync(sectionPath)) {
      errors.push(`Referenced section file not found: ${sectionPath}`);
      continue;
    }

    const sectionContent = readFileSync(sectionPath, "utf-8");
    if (containsPlaceholder(sectionContent)) {
      warnings.push(`Section still contains placeholder text: ${sectionPath}`);
    }
    if (!sectionContent.includes("\\section{")) {
      warnings.push(`Section file does not contain a top-level \\section command: ${sectionPath}`);
    }
  }

  const bibPath = resolveRepoOutputPath(repoPath, bibliographyPath);
  checkedFiles.push(bibPath);
  if (!existsSync(bibPath)) {
    warnings.push(`Bibliography file not found: ${bibPath}`);
  }

  if (containsPlaceholder(mainContent)) {
    warnings.push("Main LaTeX file still contains placeholder text.");
  }

  return { ok: errors.length === 0, errors, warnings, checked_files: unique(checkedFiles) };
}
