/**
 * F3: BibTeX management — parse, deduplicate, format, and persist references.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BibEntry {
  /** BibTeX cite key, e.g. "wang2024attention" */
  key: string;
  type: string;
  fields: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a BibTeX string into structured entries.
 * Uses depth-counting state machine — handles multi-line entries,
 * nested braces in field values, and any brace depth correctly.
 */
export function parseBib(bibtex: string): BibEntry[] {
  const entries: BibEntry[] = [];
  let i = 0;

  while (i < bibtex.length) {
    // Find next @
    const atIdx = bibtex.indexOf("@", i);
    if (atIdx === -1) break;

    let pos = atIdx + 1;
    // Read entry type
    const typeMatch = bibtex.slice(pos).match(/^(\w+)\s*\{/);
    if (!typeMatch) { i = atIdx + 1; continue; }
    const type = typeMatch[1].toLowerCase();
    pos = atIdx + 1 + typeMatch[0].length;

    // Read key: accumulate until first comma
    let key = "";
    while (pos < bibtex.length && bibtex[pos] !== ",") key += bibtex[pos++];
    pos++; // skip ','

    // Read body using depth counting
    let body = "";
    let depth = 1;
    while (pos < bibtex.length && depth > 0) {
      const ch = bibtex[pos];
      if (ch === "{") { depth++; body += ch; }
      else if (ch === "}") { depth--; if (depth > 0) body += ch; }
      else { body += ch; }
      pos++;
    }

    // Parse fields from body
    const fields: Record<string, string> = {};
    const fieldRegex = /(\w+)\s*=\s*(?:\{([^}]*(?:\{[^}]*\}[^}]*)*)\}|"([^"]*)"|(\d+))/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      fields[fieldMatch[1].toLowerCase()] =
        (fieldMatch[2] ?? fieldMatch[3] ?? fieldMatch[4] ?? "").trim();
    }

    if (key) entries.push({ key: key.trim(), type, fields });
    i = pos;
  }
  return entries;
}

/**
 * Deduplicate entries by key (keep first occurrence).
 * Also dedup by title similarity if titles match after normalization.
 */
export function dedupBib(entries: BibEntry[]): BibEntry[] {
  const seen = new Map<string, BibEntry>();
  const seenTitles = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.key)) continue;

    const normalizedTitle = (entry.fields["title"] ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (normalizedTitle && seenTitles.has(normalizedTitle)) continue;

    seen.set(entry.key, entry);
    if (normalizedTitle) seenTitles.add(normalizedTitle);
  }

  return [...seen.values()];
}

/**
 * Format a single BibEntry back to BibTeX string.
 */
export function formatEntry(entry: BibEntry): string {
  const lines = [`@${entry.type}{${entry.key},`];
  const fieldOrder = ["author", "title", "journal", "booktitle", "year", "volume", "number", "pages", "publisher", "url", "doi", "arxiv"];
  const orderedFields: string[] = [];

  // Add fields in preferred order
  for (const f of fieldOrder) {
    if (f in entry.fields) orderedFields.push(f);
  }
  // Add remaining fields
  for (const f of Object.keys(entry.fields)) {
    if (!orderedFields.includes(f)) orderedFields.push(f);
  }

  for (let i = 0; i < orderedFields.length; i++) {
    const f = orderedFields[i];
    const comma = i < orderedFields.length - 1 ? "," : "";
    lines.push(`  ${f} = {${entry.fields[f]}}${comma}`);
  }
  lines.push("}");
  return lines.join("\n");
}

/**
 * Format all entries to a complete BibTeX file string.
 */
export function formatBib(entries: BibEntry[]): string {
  return entries.map(formatEntry).join("\n\n") + "\n";
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

/**
 * Load entries from a .bib file. Returns empty array if file doesn't exist.
 */
export function loadBibFile(path: string): BibEntry[] {
  if (!existsSync(path)) return [];
  return parseBib(readFileSync(path, "utf-8"));
}

/**
 * Append new entries to a .bib file, deduplicating against existing content.
 * Returns the number of actually new entries added.
 */
export function appendBib(path: string, newEntries: BibEntry[]): number {
  const existing = loadBibFile(path);
  const combined = dedupBib([...existing, ...newEntries]);
  const added = combined.length - existing.length;
  if (added > 0) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, formatBib(combined));
  }
  return added;
}

/**
 * Generate a BibTeX key from author/year/title.
 */
export function generateKey(authors: string[], year: number, title: string): string {
  const firstAuthor = (authors[0] ?? "unknown")
    .split(/\s+/)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z]/g, "") ?? "unknown";
  const firstWord = title
    .toLowerCase()
    .split(/\s+/)
    .find((w) => w.length > 3 && !["the", "and", "for", "with"].includes(w)) ?? "paper";
  return `${firstAuthor}${year}${firstWord}`;
}
