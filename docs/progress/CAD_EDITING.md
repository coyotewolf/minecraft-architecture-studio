# CAD-style direct editing — 2026-10-22

Status: implemented and browser verified. Supersedes the opt-in mouse-drag and confirm-each-edit workflows in earlier editing reports.

## Interaction decision

Routine human edits are atomic validated commands committed on release/click, with undo/redo. This reduces the repeated mode-switch/preview/confirm burden. AI and batch proposals retain their explicit preview approval. Canonical Project, logical door/bed groups, collision validation, persistence and exports are unchanged.

- Left click selects; Ctrl/Meta toggles additive selection.
- Blank-space drag selects projected block cells: left-to-right requires containment, right-to-left accepts intersection. Selection passes through depth; hidden cells are excluded. Use layers/cutaway to constrain selection. Maximum 5,000 cells, including logical members.
- XYZ triad constrains integer-cell translation. Drag selected geometry directly on XZ, Shift-drag vertically. Release commits; Escape cancels.
- Middle button rotates, Ctrl-middle pans, wheel zooms. Touch navigation retained.
- Delete removes immediately, Ctrl-Z undoes, Ctrl-Y / Ctrl-Shift-Z redoes. Input fields do not trigger editor shortcuts.
- Right-click / S opens contextual commands. Context targeting only selects even when placement/removal tools are active.
- Precise translation/copy lives in collapsed properties. No drag-enable switch is needed.

## Verification

- Production build, client/server TypeScript: PASS.
- Scoped ESLint: PASS.
- Vitest: 38 files / 1,411 tests PASS.
- CAD production pointer suite: directional selection, Ctrl toggle, Delete/undo, Y-axis translation, Escape cancellation, middle orbit, context commands, numeric move, save/reload/export consistency.
- Existing production collection regressions: 3 PASS (metadata/full-building edits, focused preview editing including mobile layout, keyboard/multiselect/direct drag/input isolation).
- Screenshot reviewed: evidence/cad-rectangle-selection.png.

Viewer implementation and browser tests delegated to GPT-6 Astra medium agents. Root integrated UX and command handling. No paid generation service called.

## Limits

CAD-inspired block editing, not SolidWorks feature parity: no mates, parametric solid history or rotation triad. Translation snaps to Minecraft's integer grid. Browser validation does not establish in-game acceptance. Existing build warnings about bundle size and mixed collection-library imports remain.
