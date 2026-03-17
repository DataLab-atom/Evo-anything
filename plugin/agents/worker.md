# WorkerAgent

You handle the full lifecycle of a single code variant: generate, validate, evaluate.

## Input

A single `item` from the batch:
```json
{
  "branch": "gen-0/loss-fn/mutate-0",
  "operation": "mutate",
  "target_id": "loss-fn",
  "parent_branches": ["seed-baseline"],
  "target_file": "model.py",
  "target_function": "compute_loss"
}
```

## Flow

### 1. CodeGen — generate the variant

```
git checkout -b {item.branch} {item.parent_branches[0]}
parent_commit = git rev-parse {item.parent_branches[0]}
```

Read context:
- Read the target function code from `item.target_file`
- Read `memory/targets/{item.target_id}/long_term.md` for accumulated wisdom
- Read `memory/targets/{item.target_id}/failures.md` to avoid known bad paths
- If `operation == "crossover"`: also read code from `parent_branches[1]`

**Choose generation method based on operation complexity:**

#### Simple mutate (default)

For localized changes (loss function tweak, hyperparameter, single algorithm swap):
- Generate variant directly using `edit`/`write`
- Keep function signature unchanged
- Fix obvious issues (missing imports, syntax errors)

#### Complex mutate or crossover (use `coding-agent` when available)

For structural changes, crossover between two significantly different branches,
or when the target function has complex dependencies:

**If `claude` CLI is available** (preferred):
```
cd <repo worktree path>
claude --permission-mode bypassPermissions --print \
  "Rewrite the function `{item.target_function}` in `{item.target_file}`.
   Operation: {item.operation}.
   {if crossover: "Merge the best ideas from these two implementations:" + diff of both parents}
   Constraints:
   - Keep the function signature EXACTLY unchanged: {signature}
   - Only modify the function body
   - Do NOT touch any other file
   - Apply lessons from memory: {summary of long_term.md}
   - Avoid these known-bad approaches: {summary of failures.md}"
```

**If `codex` CLI is available** (alternative):
```
bash pty:true workdir:<repo> command:"codex exec --full-auto \
  'Rewrite {target_function} in {target_file}: {instruction}'"
```

After coding-agent completes, verify:
- Only `item.target_file` was changed
- Function signature is unchanged
- No test/benchmark files were modified (revert if so)

Then: `git add` + `git commit`

### 2. Policy Check — request review

```
step = evo_step("code_ready",
                branch=item.branch,
                parent_commit=parent_commit)
# Returns: {action: "check_policy", diff, changed_files, protected_patterns, ...}
```

Hand the `step` to **PolicyAgent** for review.

- If PolicyAgent approves:
  ```
  step = evo_step("policy_pass", branch=item.branch)
  # Returns: {action: "run_benchmark", ...}
  ```

- If PolicyAgent rejects:
  ```
  step = evo_step("policy_fail", branch=item.branch, reason="...")
  # Returns: {action: "worker_done", rejected=True}
  ```
  Exit early — do not benchmark.

### 3. Benchmark — evaluate the variant

```
git worktree add /tmp/eval-{branch} {step.branch}
cd /tmp/eval-{branch}
exec {benchmark_cmd}         # capture stdout + stderr
fitness = parse last line as float
git worktree remove /tmp/eval-{branch}
```

If the variant crashes:
- Trivial fix (missing import, typo): fix it, re-commit, call `evo_step("code_ready")` again
- Logic error: report `success=False`

### 4. Report

```
evo_step("fitness_ready",
         branch=step.branch,
         fitness=fitness,
         success=true/false,
         operation=step.operation,
         target_id=step.target_id,
         parent_branches=step.parent_branches)
# Returns: {action: "worker_done", fitness, is_new_best, ...}
```

## Tools

- `read` / `edit` / `write` — code generation (simple mutations)
- `/coding-agent` — **preferred for crossover and complex mutations** (requires `claude` or `codex`)
- `exec git` — branch creation, worktree management
- `exec` — run benchmark command
- `evo_step` — advance the state machine
- `evo_check_cache` — skip duplicates
