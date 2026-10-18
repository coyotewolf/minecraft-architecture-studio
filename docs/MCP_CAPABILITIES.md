# Higgsfield, GitHub and Codex capability audit

**Audit date:** 2026-10-19  
**Scope:** ChatGPT conversation/connector discovery. **DO NOT assume the same apps, scopes or tokens are available in a Codex Cloud task or the final deployed website.**

## Verified in connected ChatGPT session

### GitHub

- GitHub login: `coyotewolf`.
- `coyotewolf/minecraft-architecture-studio` exists, is **private**, and connector reports `push: true` / `admin: true`.
- Creating/editing repository files through the GitHub connection works; readback of committed files must be used to verify bootstrap integrity.
- GitHub connector does not expose **create repository**, but this repository has already been created by the user; no further repository-creation operation is necessary.

### Higgsfield

Read-only `models_list(type="3d")` exposed at least these generation options:

| Model ID | Provider | Input | Output | Interpretation |
| --- | --- | --- | --- | --- |
| `sam_3_3d` | Meta | 1 image | Textured GLB | General object mesh/reference |
| `image_to_3d` | Meshy | 1 image | GLB, optional texture/PBR | General mesh/reference |
| `multi_image_to_3d` | Meshy | 1–4 views | GLB mesh | Multi-view general mesh/reference |

No generation job has been submitted, no credits charged and no generated mesh has been validated. A GLB mesh **does not contain** authoritative legal Minecraft Java 1.20.1 XYZ block placement states. Do not convert it into 'Minecraft build complete' by renaming or merely voxel-rendering its triangles.

The Higgsfield tool catalog also exposes image generation and visual editing operations; this is **not** proof of accurate architecture reconstruction or production API permission.

## NOT YET verified — M0 duties in Codex Cloud

- The active Codex task can see and authenticate Higgsfield tools; scopes and rate/credit limits.
- Actual callable subagent API and ability to route High, Medium or Low per agent; availability of parallel worktrees.
- The exact supported image/vision tools, 3D image outputs, and whether a GLB result can be exported for authorized analysis.
- Reliable structured output from the selected LLM and a tested Minecraft block-registry source.
- An approved, server-side production API for end users of the deployed website, including licensing, user consent, per-request charging, quotas, ToS and security.
- Version-matched Minecraft structure serialization (.nbt/.litematic) and independent format validation.
- Actual Node build and browser-test commands in cloud.

## Implementation policy

1. Keep provider contracts separate: `AiVisionProvider`, `BlockPlanProvider`, `AiEditProposalProvider`, and optionally `HiggsfieldProvider`.
2. Build a functional manual viewer/editor even when all AI providers are missing.
3. Always validate externally generated plans against a **versioned block registry**, schema, coordinates, overlap and transaction limits.
4. Require user approval before any paid Higgsfield generation; record preview/estimated credit cost where supported.
5. No browser-embedded OAuth/API secret, and no copying user-account ChatGPT connector credentials into a deployed app.
6. Explicitly label mock adapters as mocks, never live AI results.
7. Write an environment-specific verified/blocked/planned audit in the M0 progress report before claiming capability.

## M0 proof checklist

- [ ] Higgsfield actually callable from the Codex task
- [ ] Provider can return useful output in authenticated scope
- [ ] Available delegated agent/model tiers checked
- [ ] No credential misuse or unapproved paid generation
- [ ] Output separation (reference GLB vs true Block Model) tested
- [ ] Provenance and structured validation contracts confirmed

This document records verified integration discovery, **not a claim that the Minecraft website or its image-to-voxel pipeline has been implemented**.
