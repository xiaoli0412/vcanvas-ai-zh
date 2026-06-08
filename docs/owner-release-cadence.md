# Owner Release Cadence

## Branch And Identity
- Primary publish remote: `publish` -> `xiaoli0412/vcanvas-ai-zh`.
- Owner-style Git identity for this workspace:
  - `user.name=xiaoli0412`
  - `user.email=222041974+xiaoli0412@users.noreply.github.com`
- Push current work branches to `publish`; do not push implementation branches to `origin` unless explicitly requested.

## Per-Round Rule
- After each completed implementation round, create exactly one commit for that round.
- Push the active branch to `publish` after validation.
- Keep the canvas-first branch line visible by pushing both the long-running branch and any version branch that is created for the round.

## Version Rule
- Patch versions advance one step per completed release slice.
- Current owner-release line is `1.11.x`.
- Continue as `1.11.7`, `1.11.8`, and so on until the minor version is intentionally raised.

## Verification Floor
- Run at least `npm run typecheck`, `npm run typecheck:server`, `node --check scripts/serve-vcanvas.mjs`, and `npm run build` for code-bearing rounds.
- For UI-bearing rounds, also run a browser screenshot review and confirm the workspace/canvas area is not compressed by new controls.
