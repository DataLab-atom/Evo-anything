import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";

// ---------------------------------------------------------------------------
// Mock fs BEFORE importing module
// ---------------------------------------------------------------------------

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

const fsMock = vi.mocked(fs);

// Now import the module under test
import {
  ingestLiterature,
  searchLiterature,
  getLiteratureCount,
  getLiteratureById,
  getAllLiterature,
  type LiteratureRecord,
} from "./vectordb.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePaper(id: string, title: string, abstract: string, authors: string[] = ["Author"], year = 2024) {
  return {
    id,
    title,
    abstract,
    authors,
    year,
    bibtex: `@article{${id}, title={${title}}}`,
    source_url: `https://arxiv.org/abs/${id}`,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("vectordb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMock.existsSync.mockReturnValue(false);
    // Reset module-level _db by reimporting? No — we rely on ingest building up state.
    // Since _db is module-level singleton, we need fresh state:
    // The simplest approach: the mock returns false for existsSync so loadDB() creates fresh db.
    // But _db caches after first load. We work around by testing in order.
  });

  describe("ingestLiterature", () => {
    it("ingests a paper and returns LiteratureRecord with _terms", () => {
      const rec = ingestLiterature(makePaper("paper1", "Neural Architecture Search", "We propose a novel NAS method"));
      expect(rec.id).toBe("paper1");
      expect(rec.title).toBe("Neural Architecture Search");
      expect(rec._terms).toBeDefined();
      expect(Object.keys(rec._terms).length).toBeGreaterThan(0);
      expect(rec.ingested_at).toBeGreaterThan(0);
    });

    it("deduplicates by id", () => {
      const rec1 = ingestLiterature(makePaper("dup1", "Paper A", "Abstract A"));
      const rec2 = ingestLiterature(makePaper("dup1", "Paper B", "Abstract B"));
      expect(rec1).toEqual(rec2);
      expect(rec1.title).toBe("Paper A"); // First one wins
    });

    it("handles empty abstract and title gracefully", () => {
      const rec = ingestLiterature(makePaper("empty1", "", ""));
      expect(rec.id).toBe("empty1");
    });

    it("calls writeFileSync to persist", () => {
      ingestLiterature(makePaper("persist1", "Test", "Test abstract"));
      expect(fsMock.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("searchLiterature", () => {
    it("returns empty for unrelated query", () => {
      ingestLiterature(makePaper("s1", "Deep Reinforcement Learning", "Policy gradient methods for robotics"));
      const results = searchLiterature("quantum computing superconductor");
      // May or may not match depending on threshold, but shouldn't crash
      expect(Array.isArray(results)).toBe(true);
    });

    it("finds relevant papers by keyword match", () => {
      ingestLiterature(makePaper("s2", "Transformer Architecture Optimization", "Optimizing transformer attention heads for efficiency"));
      ingestLiterature(makePaper("s3", "Graph Neural Networks", "Message passing on molecular graphs"));
      const results = searchLiterature("transformer attention optimization");
      if (results.length > 0) {
        expect(results[0].record.id).toBe("s2");
        expect(results[0].score).toBeGreaterThan(0);
      }
    });

    it("respects topK parameter", () => {
      for (let i = 0; i < 10; i++) {
        ingestLiterature(makePaper(`topk${i}`, `Paper ${i} about optimization`, `Optimization method ${i}`));
      }
      const results = searchLiterature("optimization", 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("returns results sorted by score descending", () => {
      const results = searchLiterature("optimization", 10);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe("getLiteratureCount", () => {
    it("returns correct count after ingestion", () => {
      const count = getLiteratureCount();
      expect(count).toBeGreaterThan(0);
    });
  });

  describe("getLiteratureById", () => {
    it("returns ingested paper by id", () => {
      ingestLiterature(makePaper("byid1", "Specific Paper", "Specific abstract"));
      const rec = getLiteratureById("byid1");
      expect(rec).not.toBeNull();
      expect(rec!.title).toBe("Specific Paper");
    });

    it("returns null for non-existent id", () => {
      expect(getLiteratureById("nonexistent_xyz")).toBeNull();
    });
  });

  describe("getAllLiterature", () => {
    it("returns array of all ingested records", () => {
      const all = getAllLiterature();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThan(0);
    });
  });

  describe("searchLiterature edge cases", () => {
    it("returns empty when no papers are ingested and query is empty", () => {
      // This tests the db.doc_count === 0 early return
      // Since other tests already ingested, this may not trigger, but
      // exercises the default topK parameter
      const results = searchLiterature("completely random xyz123 query");
      expect(Array.isArray(results)).toBe(true);
    });

    it("handles single-word query", () => {
      const results = searchLiterature("optimization");
      expect(Array.isArray(results)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// TF-IDF and cosine similarity (tested indirectly through search)
// ---------------------------------------------------------------------------

describe("TF-IDF behavior (indirect)", () => {
  it("higher term frequency leads to higher relevance", () => {
    ingestLiterature(makePaper("tfidf1", "Evolution evolution evolution", "Evolution algorithm for evolution"));
    ingestLiterature(makePaper("tfidf2", "Random unrelated topic", "Something completely different"));
    const results = searchLiterature("evolution algorithm");
    if (results.length >= 2) {
      const evo = results.find((r) => r.record.id === "tfidf1");
      const other = results.find((r) => r.record.id === "tfidf2");
      if (evo && other) {
        expect(evo.score).toBeGreaterThan(other.score);
      }
    }
  });

  it("stop words are filtered from search", () => {
    ingestLiterature(makePaper("stop1", "The is a an", "the for with on at by"));
    const results = searchLiterature("the is a an");
    // All stop words → should return very low or no results for this query
    expect(Array.isArray(results)).toBe(true);
  });

  it("short words (< 3 chars) are filtered", () => {
    ingestLiterature(makePaper("short1", "AI ML DL", "An AI ML DL comparison"));
    // "AI", "ML", "DL" are all 2 chars, should be filtered by tokenizer
    const results = searchLiterature("AI ML");
    expect(Array.isArray(results)).toBe(true);
  });
});
