## 1.11.2 - 2026-06-06

### Fixes
- Hardened the standalone `18087` server against malformed double-slash request paths such as `//data:,` so direct public-port access no longer crashes with an empty response.

## 1.11.0 - 2026-05-31

### Highlights
- Rebuilt VCanvas around a more canvas-first workflow while keeping the new creative-lab architecture in place.
- Added six differentiated creation modes, including the new `Remix` homepage reconstruction mode.
- Promoted `Compatible OpenAI` to the primary provider path and expanded built-in provider coverage.

### Canvas And Workflow
- Added mode-aware generation, refine, and plan pipelines so each mode produces meaningfully different prompt context.
- Added optional previous-round context carry-over for refine flows, including the previous prompt and previous HTML output.
- Added HTML export directly from the live preview toolbar.
- Added web embed editing inside the canvas toolbar.
- Added image import and first-frame video import as first-class canvas reference inputs.

### Provider And API
- Renamed the custom connection entry to `Compatible OpenAI` in the UI while preserving storage compatibility.
- Added dedicated `ChatGPT` and `Kimi` provider cards.
- Reordered provider priority so `Compatible OpenAI` comes first, followed by `ChatGPT` and `Kimi`.
- Tightened compatible-provider validation so endpoint, model ID, and API key are all required before generation.
- Fixed legacy `z.ai` fallback behavior so unconfigured users return cleanly to `Compatible OpenAI`.

### UI And Experience
- Moved the mode picker to a fixed portal popover to avoid clipping over the workspace.
- Restored classic mode as the default entry point.
- Converted classic mode controls into a secondary drawer so the canvas keeps visual priority.
- Pulled the theme back toward the darker blue and muted purple direction.
- Reduced bottom control typography to better match the original compact feel.

### Desktop And Release Foundation
- Includes the desktop packaging, asset, and CI/tag publishing work that landed after `v1.10.8`.
- Keeps Electron packaging support for Windows, macOS, and Linux in the same release line.
