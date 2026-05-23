# VCanvas Remix

A visual canvas playground for vision-language models. Draw sketches, describe what you want, and the model generates complete HTML/CSS/JS rendered live in a side-by-side preview.

BYOK (Bring Your Own Key). The default app runs in the browser. For custom endpoints that do not expose browser CORS headers, an optional local proxy is included.

![VCanvas screenshot](screenshot/sc.png)

> A demo recording is available at [`screenshot/rec.mp4`](screenshot/rec.mp4).

## How it works

1. **Draw** — Sketch wireframes, paste screenshots, drop reference images onto an Excalidraw canvas
2. **Describe** — Type a prompt: "Turn this into a landing page", "Generative art piece", or just "Make it beautiful"
3. **Generate** — The model sees your canvas + prompt and streams a complete, self-contained HTML file
4. **Refine** — Click Refine to iterate. The model sees the original sketch, a screenshot of the current output, and your feedback

## Providers

| Provider | Models | Get a key |
|----------|--------|-----------|
| **z.ai** | GLM-5V Turbo | [z.ai](https://z.ai) |
| **Google** | Gemini 3.1 Pro, Flash, Flash Lite | [AI Studio](https://aistudio.google.com/apikey) |
| **Fireworks** | Kimi K2.5 Turbo (Fire Pass) | [Fire Pass](https://app.fireworks.ai/fire-pass) |
| **OpenRouter** | Claude 4.6, Gemini 3, Grok 4.1, Qwen 3.5, MiMo V2, Kimi K2.5 | [OpenRouter](https://openrouter.ai/keys) |
| **Custom OpenAI** | OpenAI, Azure OpenAI, and compatible endpoints | — |

OpenRouter also supports searching and selecting from 100+ vision models via the API.

The custom provider does not hardcode any endpoint or model. Users provide their own connection details, and model IDs can be fetched dynamically from the upstream `/models` API.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Click the model button in the header to configure your provider and API key.

## Desktop Apps

The project can be packaged as installable desktop apps for Windows, macOS, and Linux using Electron.

### Local desktop run

```bash
npm install
npm run desktop
```

This will:

- build a desktop-safe frontend bundle with relative asset paths
- launch Electron in a resizable desktop window
- start an embedded local proxy automatically for custom OpenAI-compatible endpoints
- use dedicated desktop app icons and application menu wiring

### Build installable packages

```bash
npm run dist:desktop
```

Artifacts are written to the `release/` directory.

### CI packaging

GitHub Actions includes `.github/workflows/desktop.yml`, which builds desktop artifacts for:

- Windows (`nsis` installer)
- macOS (`dmg`)
- Linux (`AppImage`, `deb`)

The workflow runs on:

- `main`
- `codex/v1.10.5-remix-release`
- `codex/style-presets-workflow-lab`

### Tagged release publishing

If you push a git tag such as:

```bash
git tag v1.10.8
git push publish v1.10.8
```

the desktop workflow will also publish a GitHub Release and attach the packaged installers from all supported platforms.

## Language Support

- English and Simplified Chinese UI toggle
- Locale follows browser language on first load and persists locally
- Excalidraw locale follows the selected app locale

## Custom OpenAI

The `Custom OpenAI` provider supports three modes:

- `OpenAI`: enter a base URL such as `https://api.openai.com` or `https://api.openai.com/v1`; the app completes the chat completions path automatically.
- `Azure OpenAI`: enter the resource URL, deployment name, API version, and API key; the app builds the Azure chat completions route automatically.
- `Compatible`: enter either a plain base URL, a `/v1` base URL, or a full chat completions endpoint; the app normalizes the request path automatically.

For compatible and custom connections:

- model IDs can be fetched dynamically from the upstream `/models` endpoint
- the picker includes search, a scrollable list, and incremental `Show more`
- no test endpoint or model is embedded in the shipped UI

## Optional Local Proxy

Some OpenAI-compatible relays do not expose browser CORS headers. In that case, browser requests cannot reach them directly from a static frontend.

Run the local proxy only when needed:

```bash
npm run proxy
```

The proxy listens on `http://127.0.0.1:8765` and forwards custom provider requests without hardcoding any upstream endpoint.

In the desktop build, this proxy is started automatically inside the Electron app, so custom compatible endpoints still work without requiring a separate browser or manual proxy process.

For deployed servers, the same proxy handler can also be exposed through the same origin at `/_vcanvas_proxy` so browser requests do not depend on a local desktop proxy.

## Remote Deploy

This repo includes a repeatable remote deployment script for the current static build and custom proxy service.

```bash
node scripts/deploy-remote.mjs \
  --host YOUR_SERVER_IP \
  --user root \
  --password 'YOUR_SERVER_PASSWORD'
```

The script will:

- build the current frontend locally
- upload the `dist` output and proxy script to the server
- replace `/opt/vcanvas/dist`
- install or update a unified `vcanvas.service`
- restart `vcanvas.service`

The deployed `vcanvas.service` serves both:

- static frontend files from `/opt/vcanvas/dist`
- same-origin proxy requests on `/_vcanvas_proxy`

You can also provide credentials through environment variables:

```bash
VCANVAS_DEPLOY_HOST=YOUR_SERVER_IP
VCANVAS_DEPLOY_USER=root
VCANVAS_DEPLOY_PASSWORD=YOUR_SERVER_PASSWORD
node scripts/deploy-remote.mjs
```

## Build

```bash
# Default (base path /)
npm run build

# For deployment at /vcanvas-ai-zh/
npm run build:gh

# Custom base path
VCANVAS_BASE=/your/path/ npm run build
```

## Features

- **Multi-provider** — Switch between providers and models in one click. Keys stored per-provider in localStorage.
- **Frame selection** — Create named frames on the canvas to send specific regions to the model instead of the full canvas.
- **Plan mode** — Three-phase generation: Gaze (deep image analysis) → Dream (creative ideation) → Create (implementation). Slower but more intentional results.
- **Thinking visualization** — Models that use chain-of-thought reasoning (DeepSeek, Kimi, Gemini) show their thinking process in a collapsible panel during streaming.
- **Live streaming** — Watch the HTML stream in with token count, speed graph, and phase detection.
- **Refinement loop** — The model captures a screenshot of the current output and uses it alongside your sketch for iterative improvement.
- **Save/Load** — Export and import canvas drawings as JSON.

## Architecture

```text
src/
  App.tsx                     — Main orchestrator, state management
  main.tsx                    — Entry point
  components/
    Canvas.tsx                — Excalidraw instance
    FramePicker.tsx           — Frame thumbnail strip, selection
    PromptBar.tsx             — Text input, Generate/Refine, Plan toggle
    Preview.tsx               — Sandboxed iframe renderer
    StreamOverlay.tsx         — Live code viewer, thinking, speed graph
    PlanOverlay.tsx           — Gaze/Dream/Create phase viewer
    ProviderModal.tsx         — Provider/model settings popup
    Header.tsx                — App header, model status
    MessageStrip.tsx          — Chat history chips
    ResizeHandle.tsx          — Panel resize
  lib/
    api.ts                    — Streaming (OpenAI-compat + Gemini), HTML extraction
    providers.ts              — Provider configs, model lists, state persistence
    export.ts                 — Canvas → PNG export
    store.ts                  — Shared types
  styles/
    globals.css               — Design tokens, base styles
    app.css                   — Layout, overlays
```

## Acknowledgments

Built on [Excalidraw](https://github.com/excalidraw/excalidraw) — the open-source virtual whiteboard that powers the drawing canvas. Excalidraw is licensed under MIT.

## License

MIT
