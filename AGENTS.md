# AGENTS.md — Binding Instructions for Codex Agents

## Read order

1. `README.md`
2. `docs/MASTER_SPEC.md` (source of truth for product requirements)
3. `docs/ARCHITECTURE.md`
4. `docs/ROADMAP.md` and `docs/TEST_PLAN.md`
5. `docs/MCP_CAPABILITIES.md` and `docs/AGENT_TASKS.md`

If files disagree, report the contradiction; `MASTER_SPEC.md` controls product scope, while the implementation architecture must be amended through a documented decision.

## Execution environment

- Primary target: Codex Cloud against this GitHub repo. Do not assume Windows/local files, browser sessions, open ports, or installed Minecraft are shared with the cloud machine.
- Inspect actual tools, model tiers, subagents, worktrees, MCP permissions, network and secrets **before** relying on them.
- Never claim to have used Astra, Higgsfield, another model, cloud browser, or tested the game unless tool executions prove it.
- Never begin paid Higgsfield generations without user authorization of required credits/cost.

## Role and delegation policy

- **Lead/High**: architectural contracts, canonical block state, coordinate conventions, transactional commands, Java 1.20.1 validation, rendering/picking strategy, cross-module merges, AI safety/structured proposals, final gates.
- **Medium** (only if actual agent/model selection exists): isolated features with frozen interfaces, e.g., block palette, materials UI, project dashboard, blueprint UI, construction controls.
- **Low** (only if available): docs, styles, fixtures, simple test cases and repetitive low-risk tasks.
- An agent may **not** change core contracts without lead approval. Do not invent agent delegation. If subagents/model selection are unavailable, implement serially and record the limitation.
- For delegated tasks specify allowed files, inputs, immutable interfaces, commands to run, tests and expected return format. Avoid concurrent edits to shared files.

## Development cycle

`PLAN → (DELEGATE if supported) → IMPLEMENT → TEST → REVIEW → INTEGRATE → REGRESSION → COMMIT → NEXT GATE`

- Start at M0. For each milestone write a PASS/FAIL/BLOCKED report in `docs/progress/M{n}.md` with code commit, exact commands/results, agent work, known issues.
- Gate passes **only on executed evidence**. A failed gate blocks dependent tasks; unrelated tasks may proceed if boundaries remain isolated.
- Keep the repo functional at each commit. Code changes should be in scoped commits/branches or PRs where available.
- Do not weaken assertions or replace live functional tests with mock-only tests to obtain a green result.
- Explicitly distinguish: implemented, tested, manually verified, mock-only, blocked, not started.

## Nonnegotiable engineering invariants

1. Canonical Block Model is the single source of structure truth; all visualizations/statistics/exports are derived projections.
2. Each occupied `(x,y,z)` has at most one block; integer coordinates only.
3. Block-state values and Minecraft Java Edition 1.20.1 IDs must be verified against a versioned registry/data source.
4. Multi-cell structures (e.g., doors/beds) must be atomically valid; material inventory is **not** a raw occupied-cell count.
5. All edits are atomic commands with undo/redo; AI proposals may not bypass validation or approval.
6. View transforms (exploded/ghost/cutaway) must never mutate canonical coordinates.
7. Editing after build progress requires a design-version-aware reconciliation.
8. Preserve `observed/inferred/ai_estimated` provenance separately from `user_modified` edit history.
9. Production must never disguise mock AI results as real tool outputs.
10. Never commit credentials or unlicensed Minecraft game assets.

## Scope discipline

Prioritize a trustworthy block-model editor before photo-to-building AI. The complete roadmap is the target, not an invitation to make 10 shallow, fake implementations. On limited time: deliver the highest-integrity working vertical slice, note unfinished scope and preserve recovery state.

## M0 done condition

Produce reproducible environment report, architecture/contracts, tested minimal app setup, a running test command, written MCP/model delegation capability audit, and a commit. This package is planning-only: do not mark M0 PASS before actual execution.