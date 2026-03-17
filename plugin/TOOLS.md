# Tool Usage Conventions

## By Agent

### OrchestratorAgent
- `evo_step` — advance the evolution state machine (`begin_generation`, `select`, `reflect_done`)
- `evo_get_status` — check current evolution progress
- `evo_get_lineage` — trace how a branch evolved
- `evo_freeze_target` / `evo_boost_target` — manual priority control
- `evo_revalidate_targets` — verify targets still exist after structural ops
- `exec git branch -D` / `exec git tag` — branch cleanup and tagging
- `write` + `canvas` — live fitness dashboard (built-in, updated after each generation)

### MapAgent
- `read` — read source files and benchmark scripts
- `exec` — run static analysis, grep call chains, profiling
- `/oracle` — *(optional)* whole-repo context analysis; preferred when oracle binary is available
- `evo_register_targets` — register identified optimization targets

### WorkerAgent
- `read` / `edit` / `write` — code generation (simple mutations)
- `/coding-agent` — *(optional)* complex mutations and crossover; preferred when `claude` or `codex` is available
- `exec python -m py_compile` — static syntax check before every commit
- `exec pyflakes` — *(optional)* import/name check before commit
- `exec git checkout -b` — create variant branches
- `exec git worktree add/remove` — isolated evaluation directories
- `exec` — short benchmark execution (<30s)
- `tmux` — *(optional)* long benchmark execution (non-blocking); used when benchmark is expected to take >30s
- `evo_step` — report code (`code_ready`), report fitness (`fitness_ready`)
- `evo_check_cache` — skip duplicate code evaluations

### PolicyAgent
- `evo_step` — report policy decision (`policy_pass`, `policy_fail`)
- No other tools needed — all input comes from the `check_policy` response

### ReflectAgent
- `read` / `write` — memory file I/O (short_term, long_term, failures)
- `exec git diff` — compare best vs second-best variants
- `exec git cherry-pick` — combine branches for synergy checks
- `/session-logs` — *(optional)* cross-run meta-learning; queried on first generation only
- `evo_record_synergy` — record synergy experiment results
- `evo_get_lineage` — trace branch ancestry for context

### /evolve Skill (initialization)
- `evo_init` — initialize a new evolution run with repo, benchmark, objectives
- `evo_report_seed` — report the baseline fitness of unmodified code

### Standalone Tools (direct access, parallel to evo_step)
- `evo_next_batch` — get next batch of operations (standalone alternative to `evo_step("begin_generation")`)
- `evo_report_fitness` — report a branch's fitness (standalone alternative to `evo_step("fitness_ready")`)
- `evo_select_survivors` — run NSGA-II selection (standalone alternative to `evo_step("select")`)
- `evo_revalidate_targets` — check all targets still exist after structural ops

## General Rules

- All deterministic evolution bookkeeping goes through `evo_*` MCP tools.
  Never manually track population state.
- Use `exec` for git commands and benchmark execution.
- Use `read` / `edit` / `write` for code changes. Never blindly generate —
  always read the target function first.
- Always run `python -m py_compile` on the target file before committing.
- Always capture both stdout and stderr when running benchmarks.
- Optional tools (marked with *optional*) degrade gracefully: if the required
  binary or skill is unavailable, fall back to the next simpler method.
