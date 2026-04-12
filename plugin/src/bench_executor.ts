/**
 * B5: Benchmark executor — runs benchmarks in isolated git worktrees.
 *
 * Manages the full lifecycle: worktree creation → execution → parsing → cleanup.
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface BenchmarkResult {
  metrics: Record<string, number>;
  raw_output: string;
  success: boolean;
  stderr?: string;
}

/** Execute a shell command and return stdout + stderr. */
function runCommand(cmd: string, cwd: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      cwd,
      timeout: 600000, // 10 min max
      shell: true,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; status?: number; code?: number };
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: error.status ?? error.code ?? 1,
    };
  }
}

/** Parse benchmark output — supports both "numbers" and "json" formats. */
function parseBenchmarkOutput(rawOutput: string, format: "numbers" | "json"): Record<string, number> {
  const metrics: Record<string, number> = {};

  if (format === "json") {
    try {
      const parsed = JSON.parse(rawOutput);
      // Handle common JSON benchmark formats
      if (typeof parsed === "number") {
        metrics["score"] = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === "number") {
            metrics[key] = value;
          } else if (typeof value === "object" && value !== null) {
            // Flatten nested objects: { "acc": { "top1": 0.85 } } → { "acc.top1": 0.85 }
            for (const [subKey, subVal] of Object.entries(value)) {
              if (typeof subVal === "number") {
                metrics[`${key}.${subKey}`] = subVal;
              }
            }
          }
        }
      }
    } catch {
      // Fall through to number parsing
    }
  }

  // numbers format: try to extract key=value or "key: value" pairs
  if (Object.keys(metrics).length === 0) {
    const lines = rawOutput.split("\n");
    for (const line of lines) {
      // Skip empty or comment lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

      // Try "key: value" or "key = value" or "key=value"
      const kvMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_\.]*)\s*[=:]\s*([-+]?[0-9]*\.?[0-9]+)/);
      if (kvMatch) {
        metrics[kvMatch[1]] = parseFloat(kvMatch[2]);
        continue;
      }

      // Try bare numbers at end of lines (last resort)
      const bareMatch = line.match(/([-+]?[0-9]*\.?[0-9]+)\s*$/);
      if (bareMatch && !metrics["score"]) {
        metrics["score"] = parseFloat(bareMatch[1]);
      }
    }
  }

  return metrics;
}

/**
 * Run a benchmark in an isolated git worktree.
 *
 * @param repoPath   Path to the git repository
 * @param branch    Branch to evaluate
 * @param cmd       Benchmark command to run
 * @param format    Output format: "numbers" or "json"
 * @param worktreePath  Optional worktree path (auto-generated if omitted)
 */
export function runBenchmarkInWorktree(
  repoPath: string,
  branch: string,
  cmd: string,
  format: "numbers" | "json" = "numbers",
  worktreePath?: string,
): BenchmarkResult {
  const wtPath = worktreePath ?? join(repoPath, ".worktrees", `bench-${branch.replace(/\//g, "_")}-${Date.now().toString(36)}`);

  // Step 1: Create worktree
  try {
    mkdirSync(wtPath, { recursive: true });
    runCommand(`git worktree add "${wtPath}" "${branch}"`, repoPath);
  } catch {
    return {
      metrics: {},
      raw_output: "",
      success: false,
      stderr: `Failed to create worktree at ${wtPath} for branch ${branch}`,
    };
  }

  // Step 2: Run benchmark
  const { stdout, stderr, exitCode } = runCommand(cmd, wtPath);

  // Step 3: Parse results
  const metrics = parseBenchmarkOutput(stdout, format);
  const success = exitCode === 0 && Object.keys(metrics).length > 0;

  // Step 4: Cleanup worktree
  try {
    runCommand(`git worktree remove "${wtPath}" --force`, repoPath);
  } catch {
    // Non-fatal: warn but don't fail
  }

  return {
    metrics,
    raw_output: stdout.slice(0, 2000),
    success,
    stderr: stderr.slice(0, 500),
  };
}

/**
 * Check if a worktree exists for a given branch and clean it up.
 * Useful for re-running after code changes.
 */
export function cleanupWorktree(repoPath: string, branch: string): void {
  try {
    // Find all worktrees
    const listOutput = runCommand("git worktree list --porcelain", repoPath).stdout;
    const lines = listOutput.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("worktree ")) {
        const path = line.slice(9);
        const branchLine = lines[i + 1]?.trim() ?? "";
        if (branchLine.startsWith("branch ") && branchLine.includes(branch)) {
          runCommand(`git worktree remove "${path}" --force`, repoPath);
        }
      }
    }
  } catch {
    // Non-fatal
  }
}
