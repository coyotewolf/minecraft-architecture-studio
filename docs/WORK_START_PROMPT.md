# First Codex Cloud task — copy and paste

You are the **Technical Lead** for AI Minecraft Architecture Studio. Work directly in the connected private GitHub repository. Use the reasoning level currently selected, and delegate only if actual subagent/model routing is accessible; never pretend you used an unavailable model.

**Read in full before editing:** `AGENTS.md`, `docs/MASTER_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/TEST_PLAN.md`, `docs/MCP_CAPABILITIES.md`, `docs/AGENT_TASKS.md`.

Do not start with photo generation or decorative UI. Perform **M0 (environment + architecture/contracts)** first:

1. Inspect repo status, existing code, Node/npm, package manager, network policy, available agents/subagents/model selection and accessible MCP tools in this Codex Cloud execution environment.
2. Verify what the Higgsfield connector ACTUALLY exposes here; a ChatGPT-connected Plugin or generated GLB is not proof of runtime support or Minecraft blocks. Do not spend credits without explicit permission.
3. Finalize TypeScript canonical voxel coordinate and Block State interfaces for Minecraft Java 1.20.1, material-item counting and command/undo transaction plan. Document any changes in ARCHITECTURE.md.
4. Bootstrap a minimal runnable TypeScript/React app and test runner, applying the agreed architecture. Set up typecheck, lint, unit test and build commands and execute them.
5. Update MCP_CAPABILITIES.md with **verified in this environment**, **blocked** and **planned** claims. Update AGENT_TASKS.md with tested delegation availability. Do not claim multi-agent routing if missing.
6. Create `docs/progress/M0.md` containing actual commands, output summaries, implemented files, limitations, commit SHA (or task branch SHA), and PASS/FAIL/BLOCKED decision. Only report PASS if all M0 acceptance checks executed and passed.
7. Commit working results in logically scoped commits. Begin M1 only if M0 passed and the task still has execution budget; otherwise leave a clean restart point and precise next instructions.

**Continuing tasks:** follow M1→M10 in ROADMAP. Every milestone must complete implement→test→review→integrate→regression→commit→gate. Dependencies block only impacted work. Save progress in Git; do not rely on uncommitted state crossing Cloud tasks.

Product target: a *real* editable Minecraft voxel project (3D+2D, valid block states, accurate inventory, construction progress, persistence, import/export, optional photo AI), not a static concept, fake data, or triangle mesh pretending to be Minecraft blocks.