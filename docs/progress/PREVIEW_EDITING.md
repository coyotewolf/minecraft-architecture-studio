# Preview editing entry — 2026-10-22

The collection preview now has a prominent editing entry. Clicking a block highlights it and reveals its ID, coordinates and placement states; entering editing carries that UID into the existing canonical editor after workspace restoration. Only one viewer remains mounted.

The focused editor expands tools, collapses construction/material panels, and offers an optional overview/reference toggle. Selected-block actions support material pickup, focus, remove/replace previews, explicit confirmation/cancellation, and undo/redo. Save status and manual save are visible at the top. Returning to the library flushes persistence and displays the edited complete building; exports remain one Project per building.

Validation: TypeScript and production client/server builds passed. Changed-file ESLint passed. All 37 unit test files / 1,401 tests passed. Production Chrome test passed: actual canvas selection, UID/XYZ handoff, preview without mutation, confirm removal, undo/redo, save, return, reload and full-building export consistency. Mobile 390x844 layout has no horizontal overflow. Screenshots: evidence/preview-edit-desktop.png and evidence/preview-edit-mobile.png.

No external AI generation or credits were used. Geometry was not rebuilt; reference fidelity and Minecraft in-game acceptance are outside this interface change.
