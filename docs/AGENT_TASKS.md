# Agent routing and scoped task board

**Initial status:** No Codex Cloud agent/model routing has been verified. High, Medium and Low are **responsibility targets**, not claims that a selectable submodel exists in this workspace.

## Required environment audit (M0)

Lead records:
- Is a subagent API actually present? What tool names and limits?
- Does it allow setting a distinct model or thinking effort per task?
- Is task execution parallel? Are worktrees or branches isolated?
- Which tools can read/write to this GitHub repository? Which can call Higgsfield from the Codex task?
- What happens to work after usage/session limits? Persist tested commits and exact restart instructions.

**If unavailable:** do not pretend tasks were delegated; the lead implements sequentially, or splits work into later model-selected tasks when the user changes the model manually.

## Delegation map

| Work class | Preferred owner | Examples |
| --- | --- | --- |
| High-risk / core | Lead High | Block Model, transaction semantics, 1.20.1 rules, geometry/picking mapping, AI diff schema, conflict reconciliation, final review |
| Independent modules | Medium where available | Block palette, materials UI, 2D grid components after contracts freeze, project dashboard, basic export controls |
| Low-risk repetitive | Low where available | CSS, nonfunctional copy, icons, documentation, test fixtures, simple assertions |

## Task handoff template

```md
### Task ID: M<n>-T<n>
Objective:
Required model/agent (if actually available):
Dependencies:
Owned / allowed paths:
Forbidden paths:
Inputs / frozen interfaces:
Required output / behavior:
Acceptance tests + exact command:
Evidence expected: changed paths, tests run and outcomes, known limits:
Escalation condition:
```

## Change integration policy

- A subagent cannot modify global canonical data interfaces or versioned registry conventions without lead review.
- Protect shared paths with explicit file ownership, worktrees/branches and PR review when possible.
- Agent reports must list **actually executed** commands and commit hashes.
- Merging requires lead review, typecheck, lint, unit/integration and relevant E2E checks.
- Raise to High after repeated failure, invalid data state, cross-module race, critical security issue or an architecture-changing fix.

## Seed backlog

1. **M0-T1 (High):** audit tools/models/MCP and finalize coordinate/registry contracts.
2. **M0-T2 (Medium candidate):** scaffold app, scripts, test runner, lint, build and ensure reproducible run.
3. **M0-T3 (Low candidate):** document audited environment, capture commands and exact capabilities.
4. **M1-T1 (High):** sparse canonical voxel store with collision policy and transactions.
5. **M1-T2 (Medium candidate):** build deterministic block fixtures and unit tests without changing core interfaces.
6. **M2-T1 (High):** render XYZ and state geometry with accurate picking.
7. **M2-T2 (Medium candidate):** camera toolbar and block inspector against frozen contracts.

Nothing in this file constitutes completed implementation. Update status only with executed evidence and milestone-gate reports.

## Executed M0 audit — 2026-10-19

Actual `collaboration.spawn_agent` created `/root/contract_review`; `followup_task` successfully ran a second read-only registry-source investigation. Both returned substantive connector-read evidence. The worker inherited the selected lead model/reasoning; no model or reasoning override was requested. Tool schema advertises model/effort controls and a seven-agent total concurrency ceiling, but distinct routes and saturation limits were not tested. No isolated worktree was used: agents share the workspace.

Ownership: lead alone writes all source/config/docs and integrates; reviewer had read-only docs/source research, no permitted edits or commits. Inputs: required repository docs; outputs: contract pitfalls, M0 test requirements, source pin/licensing caveat. Review commands were GitHub fetch/fetch_file, not app tests. Registry source findings were integrated into ARCHITECTURE.md. Lead owns actual check commands and final gate.

Decision: real inherited-agent delegation is verified. High/Medium/Low remain responsibility labels rather than claims of tested model-tier switches. Do not infer this capability in another Cloud task. Save restart state on `codex/m0-foundation`; inspect docs/progress/M0.md and the branch head before continuing.

## M1 task execution

- Lead: owns canonical model validation, sparse indexes, transaction/undo/redo, integration, tests and GitHub commits. Core contracts were unchanged.
- `/root/m1_registry`: delegated registry projection/module/tests/source notes only, with frozen getRegistryEntry/normalizeBlockState/itemStackSize APIs. Local Node reads stalled; no completed implementation was received. The agent was interrupted and file ownership explicitly returned to the lead before lead writes. Do not credit the worker with implemented files or passing tests.
- `/root/contract_review`: read-only M1 source review. Local filesystem access stalled and the worker correctly reported BLOCKED without approval. Review was resumed through GitHub at the tested source commit; review completed and the provenance fix at 98760cc was approved; see M1.md for evidence.
- Both workers inherited the selected model/reasoning. No distinct model/effort override was exercised. Agents shared the workspace; no isolated worktree or actual local Git checkout was available.
- Lead implemented the registry from pinned connector-fetched data, integrated it with the engine, and executed all check commands. Restart from `codex/m1-engine`, not the earlier M0-only branch.
