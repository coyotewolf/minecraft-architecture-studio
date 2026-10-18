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
