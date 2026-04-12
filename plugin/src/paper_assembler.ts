/**
 * E1-E4: Paper assembler — merges LaTeX chapters into a full paper.
 *
 * Combines D-layer chapter files with a template, integrates BibTeX,
 * and performs consistency checks.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { parseBib, dedupBib, formatBib, type BibEntry } from "./bibtex.js";

export interface SectionFile {
  name: string;      // e.g. "intro", "method", "experiment", "related"
  path: string;     // absolute path to .tex file
  exists: boolean;
  content?: string;
}

export interface AssemblerOptions {
  repo_path: string;
  paper_dir?: string;       // default: research/paper
  template_path?: string;   // default: research/paper/template.tex
  output_path?: string;      // default: research/paper/paper.tex
  sections?: string[];      // order of sections: intro, related, method, experiment
}

export interface ConsistencyIssue {
  type: "citation" | "notation" | "terminology" | "format";
  severity: "warning" | "error";
  message: string;
  location?: string;
}

export interface AssemblyResult {
  output_path: string;
  sections_found: string[];
  sections_missing: string[];
  bib_entries_found: number;
  consistency_issues: ConsistencyIssue[];
  word_count: number;
}

/** Find all section files in the paper directory. */
export function findSections(paperDir: string): Record<string, SectionFile> {
  const sectionNames = ["intro", "related", "method", "experiment", "conclusion"];
  const sections: Record<string, SectionFile> = {};

  for (const name of sectionNames) {
    const path = join(paperDir, "sections", `${name}.tex`);
    const exists = existsSync(path);
    sections[name] = {
      name,
      path,
      exists,
      content: exists ? readFileSync(path, "utf-8") : undefined,
    };
  }

  return sections;
}

/** Extract BibTeX keys cited in a LaTeX string. */
export function extractCitations(latex: string): string[] {
  const keys: string[] = [];
  // Match \cite{key}, \citep{key}, \citet{key}, \ref{key}
  const citePattern = /\\cite[pt]?\{([^}]+)\}/g;
  let match;
  while ((match = citePattern.exec(latex)) !== null) {
    // Handle multiple keys in one \cite{key1, key2, key3}
    const inner = match[1].split(",").map((k) => k.trim());
    keys.push(...inner);
  }
  // Also match \ref{} for figures and tables
  const refPattern = /\\ref\{([^}]+)\}/g;
  while ((match = refPattern.exec(latex)) !== null) {
    keys.push(`ref:${match[1]}`);
  }
  return [...new Set(keys)];
}

/** Extract figure references from LaTeX content. */
export function extractFigureRefs(latex: string): string[] {
  const refs: string[] = [];
  const figPattern = /\\ref\{fig:([^}]+)\}/g;
  let match;
  while ((match = figPattern.exec(latex)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

/** Extract table references from LaTeX content. */
export function extractTableRefs(latex: string): string[] {
  const refs: string[] = [];
  const tblPattern = /\\ref\{tab:([^}]+)\}/g;
  let match;
  while ((match = tblPattern.exec(latex)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

/** Count approximate words in LaTeX (strip commands first). */
export function countWords(latex: string): number {
  // Remove LaTeX commands and their arguments
  let text = latex.replace(/\\[a-zA-Z]+\{[^}]*\}/g, " ");
  text = text.replace(/\{[^}]*\}/g, " ");
  text = text.replace(/\\[a-zA-Z]+/g, " ");
  text = text.replace(/[^a-zA-Z\s]/g, " ");
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

/** Perform consistency checks across all sections. */
export function checkConsistency(
  sections: Record<string, SectionFile>,
  bibEntries: BibEntry[],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Check citation consistency: are all cited keys in the bib file?
  const bibKeys = new Set(bibEntries.map((e) => e.key));
  for (const [name, section] of Object.entries(sections)) {
    if (!section.exists || !section.content) continue;
    const citedKeys = extractCitations(section.content).filter((k) => !k.startsWith("ref:"));
    for (const key of citedKeys) {
      if (!bibKeys.has(key)) {
        issues.push({
          type: "citation",
          severity: "warning",
          message: `Citation '${key}' in section '${name}' not found in references.bib`,
          location: name,
        });
      }
    }
  }

  // Check figure reference consistency: all fig: refs should have corresponding \includegraphics
  for (const [name, section] of Object.entries(sections)) {
    if (!section.exists || !section.content) continue;
    const figRefs = extractFigureRefs(section.content);
    const hasIncludes = section.content.includes("\\includegraphics");
    if (figRefs.length > 0 && !hasIncludes) {
      issues.push({
        type: "format",
        severity: "warning",
        message: `Section '${name}' references figures (${figRefs.join(", ")}) but has no \\includegraphics commands`,
        location: name,
      });
    }
  }

  // Check for common notation inconsistencies
  const notationPatterns = [
    { pattern: /\$\\mathcal\{[^}]+\}/g, label: "mathcal" },
    { pattern: /\$\\mathbf\{[^}]+\}/g, label: "mathbf" },
    { pattern: /\$\\mathbb\{[^}]+\}/g, label: "mathbb" },
  ];
  const notationUsage: Record<string, string[]> = {};
  for (const [name, section] of Object.entries(sections)) {
    if (!section.exists || !section.content) continue;
    for (const { pattern, label } of notationPatterns) {
      const matches = section.content.match(pattern) || [];
      if (matches.length > 0) {
        if (!notationUsage[label]) notationUsage[label] = [];
        notationUsage[label].push(`${name}(${matches.length})`);
      }
    }
  }

  // Warn if notation usage is uneven across sections (could indicate inconsistency)
  for (const [label, sectionsList] of Object.entries(notationUsage)) {
    const sectionsWithUsage = sectionsList.length;
    const totalSections = Object.values(sections).filter((s) => s.exists).length;
    if (sectionsWithUsage < totalSections * 0.5 && totalSections > 2) {
      issues.push({
        type: "notation",
        severity: "warning",
        message: `Math notation '${label}' used inconsistently across sections: ${sectionsList.join(", ")}`,
      });
    }
  }

  return issues;
}

/**
 * Assemble a full paper from chapter sections and a template.
 */
export function assemblePaper(opts: AssemblerOptions): AssemblyResult {
  const paperDir = opts.paper_dir ?? join(opts.repo_path, "research", "paper");
  const templatePath = opts.template_path ?? join(paperDir, "template.tex");
  const outputPath = opts.output_path ?? join(paperDir, "paper.tex");
  const sectionOrder = opts.sections ?? ["intro", "related", "method", "experiment", "conclusion"];

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  // Load sections
  const sections = findSections(paperDir);

  // Determine which sections were actually found
  const sectionsFound = sectionOrder.filter((name) => sections[name]?.exists);
  const sectionsMissing = sectionOrder.filter((name) => !sections[name]?.exists);

  // Load template
  let template = "";
  if (existsSync(templatePath)) {
    template = readFileSync(templatePath, "utf-8");
  } else {
    // Generate a minimal template
    template = generateMinimalTemplate();
  }

  // Load BibTeX
  const bibPath = join(opts.repo_path, "research", "refs", "references.bib");
  let bibEntries: BibEntry[] = [];
  if (existsSync(bibPath)) {
    const bibRaw = readFileSync(bibPath, "utf-8");
    bibEntries = dedupBib(parseBib(bibRaw));
  }

  // Build the paper by replacing placeholder comments in the template
  let paper = template;

  for (const sectionName of sectionOrder) {
    const section = sections[sectionName];
    if (!section?.exists || !section.content) continue;

    // Replace \input{sections/<name>} or the placeholder comment
    const inputPattern = new RegExp(`\\\\input\\{sections/${sectionName}\\}`, "g");
    const placeholderPattern = new RegExp(`%\\s*SECTION:${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n%\\s*SECTION:|$)`, "g");

    if (inputPattern.test(paper)) {
      paper = paper.replace(inputPattern, section.content);
    } else if (placeholderPattern.test(paper)) {
      paper = paper.replace(placeholderPattern, section.content);
    } else {
      // Insert before \end{document}
      paper = paper.replace("\\end{document}", `${section.content}\n\n\\end{document}`);
    }
  }

  // Append bibliography if not already in template
  if (!paper.includes("\\bibliography") && !paper.includes("\\bibliographystyle")) {
    const bibSection = `\n\\bibliography{../refs/references}\n\\bibliographystyle{plain}\n`;
    paper = paper.replace("\\end{document}", `${bibSection}\\end{document}`);
  }

  // Write output
  writeFileSync(outputPath, paper, "utf-8");

  // Consistency checks
  const issues = checkConsistency(sections, bibEntries);

  // Word count
  const wordCount = countWords(paper);

  return {
    output_path: outputPath,
    sections_found: sectionsFound,
    sections_missing: sectionsMissing,
    bib_entries_found: bibEntries.length,
    consistency_issues: issues,
    word_count: wordCount,
  };
}

/** Generate a minimal NeurIPS-style template. */
function generateMinimalTemplate(): string {
  return `% Auto-generated paper template — replace with your venue-specific template
\\documentclass[nonacm]{acmart}
\\settopmatter{printacmref=false}

\\title{[Paper Title — Edit this]}
\\author{Anonymous Authors}
\\date{\\today}

\\begin{document}
\\maketitle

% SECTION:intro

% SECTION:related

% SECTION:method

% SECTION:experiment

% SECTION:conclusion

% Bibliography
\\bibliography{../refs/references}
\\bibliographystyle{plain}

\\end{document}
`;
}
