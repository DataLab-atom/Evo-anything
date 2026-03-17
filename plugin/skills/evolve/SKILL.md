---
name: evolve
description: "Start evolutionary optimization on a git repository"
---

# /evolve — Start Evolution

User provides: repo path, benchmark command, objective (min/max), and optionally max evaluations.

## Steps

1. Validate the repo:
   - `exec git -C $ARGUMENTS status --porcelain` — must be clean
   - `exec git -C $ARGUMENTS rev-parse HEAD` — record seed commit

2. Run baseline:
   - `exec` the benchmark command in the repo
   - Parse fitness from output (last line as float by default)
   - Call `evo_init` with user's config
   - Call `evo_report_seed` with baseline fitness
   - `exec git -C <repo> tag seed-baseline`

3. Analyze code (MapAgent):
   - Spawn MapAgent to read benchmark entry file, trace call chain, identify targets
   - MapAgent calls `evo_register_targets` with identified targets

4. Create memory structure:
   - `exec mkdir -p <repo>/memory/global`
   - For each target: `exec mkdir -p <repo>/memory/targets/<id>/short_term`

5. Initialize canvas dashboard:
   - `exec mkdir -p ~/clawd/canvas`
   - Write initial `~/clawd/canvas/evo-dashboard.html` (seed baseline only)
   - `canvas action:present target:evo-dashboard.html`

6. Enter evolution loop — follow the Core Loop in AGENTS.md:
   - OrchestratorAgent calls `evo_step("begin_generation")`
     → returns `{action: "dispatch_workers", items: [...]}`
   - Spawn one WorkerAgent per item, in parallel
   - Each WorkerAgent: generates code → static validation → policy check → PolicyAgent
     reviews diff → if approved, runs benchmark → reports fitness
   - When all workers return, OrchestratorAgent calls `evo_step("select")`
   - Clean up eliminated branches, tag best
   - OrchestratorAgent updates canvas dashboard
   - Spawn ReflectAgent to write memory
   - Call `evo_step("reflect_done")` to start next generation or finish
   - Stop when `action == "done"` or results are sufficient

7. Report progress to user after each generation.

8. When budget exhausted:
   - Tag best: `exec git -C <repo> tag best-overall <best_branch>`
   - Generate final report via `/report`
   - **Auto-open PR with best variant** (if `gh` CLI is available and repo has a remote):

     ```bash
     # Push the best branch
     git -C <repo> push origin <best_branch>

     # Open PR targeting the original branch (main/master)
     gh pr create \
       --repo <owner/repo> \
       --head <best_branch> \
       --base <original_branch> \
       --title "evo: improve <target_ids> by <improvement>%" \
       --body "$(cat <<'EOF'
     ## Evolution Results

     Automated by Evo-anything.

     | Target | Seed | Best | Improvement |
     |--------|------|------|-------------|
     <per-target table from /report>

     ## Key Changes
     <summary from ReflectAgent long_term.md>

     ## How to verify
     \`\`\`bash
     git checkout <best_branch>
     <benchmark_cmd>
     \`\`\`
     EOF
     )"
     ```

   - If `gh` is not available or repo has no remote: skip PR, show diff summary instead:
     ```
     exec git -C <repo> diff seed-baseline..<best_branch> -- <target_files>
     ```
