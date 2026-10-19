# Continue development — copy and paste

You are the technical lead for AI Minecraft Architecture Studio. Resume from the latest **codex/m2-viewer** branch, not main's planning-only package. Read AGENTS.md and its required documents, then docs/progress/M2.md. M0–M2 have passed bounded gates; the next milestone is **M3: basic 3D editing**.

The user requests actual lower-tier delegation when useful: use GPT-6 Astra medium for independent UI/features after contracts are frozen, and GPT-6 Astra low for small styles/docs/fixtures. Inspect actual tooling before claiming this routing on a new host. Lead retains canonical/transaction/geometry decisions and final review. Specify owned paths and immutable APIs for each delegate.

1. Inspect source status and tool/runtime/browser capabilities. Run npm ci, npm run verify:vendor, npm run check (105 current tests), and npm run test:e2e (six scenarios). Install a matching Playwright browser or set BROWSER_EXECUTABLE_PATH to a supported installed Chrome. Prior evidence is Windows/Chrome, not proof of Cloud runtime behavior.
2. Preserve core schema, Java 1.20.1 registry, logical pairs, immutable snapshots, UID mapping, provenance and atomic command contracts. Read ADR-007 for the bounded viewer geometry and direct Three.js adapter decision.
3. Connect VoxelEngine transactions to UI snapshot updates. Implement palette selection, work-plane/adjacent-face placement, remove, replace, eyedropper, previews, selection and undo/redo. Do not allow a renderer/blueprint to become a second canonical store.
4. Keep camera and editing gestures distinct, especially pointer drags and multitouch. Previews must use validation; illegal partial multicell edits must fail atomically. Unknown shapes remain visibly unsupported until implemented and verified.
5. Test actual edits in browser, exact canonical changes, rollback, collision policies, undo/redo, negative XYZ and camera/edit gesture separation. Maintain existing tests, including focus across resize and context restoration.
6. Review, fix, integrate, regress, commit scoped changes, then write docs/progress/M3.md with executed commands, code SHA and PASS/FAIL/BLOCKED. Do not proceed to dependent milestones on a failed gate.

M4–M10 remain the full roadmap. No paid generation is needed for M3, and no cost-bearing call may occur without the required explicit authorization. No deployment, full Minecraft assets, game acceptance, persisted project or live AI is implied by the current viewer. Save checkpoints and precise restart instructions in GitHub, not only in conversation history.
