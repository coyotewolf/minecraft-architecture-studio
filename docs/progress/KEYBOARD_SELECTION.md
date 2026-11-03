# Keyboard, multiple selection and modifier drag — 2026-10-22

Implemented a unified selection flow in the existing canonical editor. Shift/Ctrl/Meta click toggles blocks; the explicit multi-select toggle provides the same action without a keyboard. Selected logical structures include every door/bed member. Outlines use one LineSegments batch, bounded to 5,000 selected cells.

## Controls

- Delete/Backspace previews deletion; Enter on the canvas confirms; Escape cancels a drag or preview, then clears selection on the next press.
- Alt + left drag on an already selected block previews XZ movement. Alt + Shift + left drag previews Y movement. Both snap to integer coordinates, lock mode at pointer-down, and require confirmation after release.
- Alt + arrows previews X/Z increments; Alt + PageUp/PageDown changes Y; Shift increases the step to 10.
- Ctrl/Meta + Z undoes, Ctrl/Meta + Shift + Z or Ctrl + Y redoes, Ctrl/Meta + S saves. Ctrl/Meta + A on canvas selects currently shown cells up to the 5,000-cell limit.
- V selects, B places, R replaces, I samples material, F focuses while the canvas has keyboard focus.
- Inputs, textareas, selects, contenteditable regions and IME composition retain native editing behavior.

Selection movement/copy can also use XYZ numeric controls. Arbitrary selections retain gaps; commands never substitute their bounding box. Collisions cancel atomically. Moves preserve identities; copies create independent identities and logical groups. Single-block replacement remains single-selection only. No OS clipboard or marquee selection is claimed.

Delegation: actual GPT-6 Astra medium agents implemented viewer gestures and isolated selection commands/tests; lead integrated UI, shortcuts and browser validation.

Validation: TypeScript, production client/server build and changed-file ESLint passed. 38 test files / 1,411 unit tests passed. Production Chrome verified actual additive clicks, Delete preview/Enter confirmation, undo/redo, Y drag/confirm/undo, XZ drag and Escape cancellation, camera stability during drag, text-input isolation, numeric group movement and saved export coordinates. Existing preview-edit flow including mobile width check passed. No Minecraft in-game acceptance or paid generation was performed.

Direct mouse follow-up: the canvas toolbar now offers an explicit drag-mode toggle. With it enabled, left-drag an already-selected block to move the group on XZ; Shift-drag changes Y. Ctrl/Meta click remains additive. Disabled drag mode retains Alt gestures. Production browser test passed for both direct gestures, cancellation and camera stability; build and scoped lint passed.
