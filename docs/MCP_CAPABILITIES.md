# Environment-specific capability audit

**2026-10-19 Asia/Singapore.** This execution is Windows ChatGPT Work Mode, with workspace `C:\Users\coyot\Documents\Codex\2026-10-19\new-chat-4`, not a pre-mounted Linux Codex Cloud checkout. Do not transfer capability claims to a different task or production browser.

## Verified in this environment

| Capability | Executed evidence | Meaning |
| --- | --- | --- |
| GitHub private repository read | github_fetch / github_fetch_file read all required documents and main commit | Target repo exists, private, connector reports push permission |
| GitHub branch creation | create_branch created codex/m0-foundation from 9f32a95b215ed16fe7e0f04abe896a87a5c3edd4 | Connector mutation works; code commit/readback evidence in M0 report |
| Local processes/files | exec_command ran Node 24.16.0, npm 11.13.0, Git 2.54.0.windows.1 | Windows execution, no assumption of Linux shared paths |
| Subagent | collaboration.spawn_agent + followup_task completed contract_review | Inherited model/reasoning only; no distinct tier routing tested |
| Higgsfield authentication | list_workspaces returned accessible workspace | Read-only access works in THIS agent session |
| Higgsfield model catalog | models_list(type="3d",limit=20) returned catalog, has_more=false | Metadata, not generated outputs |
| Versioned registry source | GitHub pinned wrapper/data reads by reviewer | Candidate source verified; production registry import not implemented |

Higgsfield metadata includes sam_3_3d (Meta; single-image textured GLB), image_to_3d and multi_image_to_3d (Meshy; general GLB), and additional Meshy/Tripo/Hunyuan models. Catalog details describe general meshes, not legal Minecraft block coordinates/states. The catalog also exposes Blender scene inspection/edit/import/export tools; those tools were **discovered only**, not executed in this audit. No generation, scene creation, upload or paid job was invoked. No generated output or actual credit debit was tested.

Available tool surfaces include GitHub, Higgsfield, shell/files, Node execution, browser control and collaboration. Discovery is not authentication/execution proof for every tool. No Minecraft process or in-game access was tested. No credentials were read or copied.

## Blocked / unverified

- Direct Git clone: `getaddrinfo() thread failed to start`.
- npm online ping: `ENOTFOUND registry.npmjs.org`. Network is restricted; there is no verified domain allowlist in this Windows session. No firewall/proxy/access-control changes made.
- Installed dependencies and check outcomes must be read from M0.md, not inferred from Node being installed. Existing npm tarballs were used to reconstruct a writable scratch cache after an offline index miss.
- Distinct model/High/Medium/Low routing is advertised in tool schema but was not exercised. No claim of Astra or any other switched model.
- Isolated Git worktrees and Linux Cloud environment are not tested.
- Paid Higgsfield output is untested because it is not authorized or necessary for M0.
- Website runtime API credentials, per-user consent/billing, production licensing and provider rate limits remain unverified. Never copy personal connector credentials to the app.
- Actual game compatibility, NBT/Litematic serialization and in-game tests are not implemented.
- Full 1.20.1 block registry runtime ingestion and live provider structured output are not implemented.

## Planned

Manual voxel engine and registry (M1), geometry/picking and editor (M2–M5), materials/build reconciliation (M6), persistence/export (M7), optional server-side provider integration and human-approved bounded diffs (M8), responsive/performance/release testing (M9–M10).

M0 contracts deliberately separate mesh_reference from voxel_proposal; tests are a type-level boundary and synthetic contract checks, **not a live generation/voxelization test**. A missing AI provider does not block the manual editor.

## Policy

Use independently authorized server-side provider integrations. Validate every external plan against exact schema/game version, bounded coordinates, duplicate/conflicting occupants and a versioned registry. Keep observed/inferred/ai_estimated evidence separate from user modification. Show unavailable capabilities honestly, and seek explicit authorization of cost before paid generation.
