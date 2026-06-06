# Canvas 2.0 Implementation Roadmap

## Source Of Truth
- `C:\Users\李昊桐\Downloads\Canvas重构方案2.0.md`
- `C:\Users\李昊桐\Downloads\Canvas_2.0_重构计划注意细则.md`

## Current Baseline
- Branch: `codex/canvas-lab-public-server`
- Public-server skeleton exists in `server/` and `shared/`.
- 画布优先 shell is the active frontend direction.
- Completed frontend capabilities include 12 modes, secondary mode panel, workflow context, preview annotations, video keyframes, HTML export, image/video import, and website remix fetch.

## Implementation Phases
1. Stabilize and commit the current baseline after `typecheck`, `typecheck:server`, and `build`.
2. Finish canvas-first tools without occupying drawing space:
   - Web Embed URL references with editable placeholders, iframe preview, failure feedback, and prompt metadata.
   - Website Copy remains separate from Web Embed and continues to use HTML, CSS hints, and screenshot reference context.
   - Context compression v1 for previous turns, video keyframes, and website references.
3. Expand model and provider management:
   - Header keeps quick switching only.
   - Channel/model creation moves to personal model settings.
   - New provider channels must be verified from official sources before hardcoded model lists are added.
   - Model capabilities use `vision`, `video`, `toolCalling`, and `contextWindow`.
4. Convert server placeholders into platform APIs:
   - Session, workflow, works, providers, notices, assets, remix, and settings routes.
   - Guest remains browser-local BYOK.
   - Logged-in tiers default to server-managed execution.
5. Add account, security, quota, works, gallery, notices, ops, disclaimer, update, and migration features.

## Acceptance Rules
- Canvas remains the primary visual and interaction area.
- Heavy controls live in secondary panels or settings.
- Public-facing wording uses `inscanvas` where the product, login, bridge, wallet, or notices are mentioned.
- Compatibility keys stay stable until an explicit migration exists:
  - `vcanvas_*` localStorage keys
  - `VCANVAS_*` env vars
  - `/opt/vcanvas` deployment path
- Every implementation stage must pass:
  - `npm run typecheck`
  - `npm run typecheck:server`
  - `npm run build`

## GitHub Finish
- Commit message: `feat: advance canvas 2.0 public server roadmap`
- Push target: `publish codex/canvas-lab-public-server`
- Do not push this work to `origin`.
