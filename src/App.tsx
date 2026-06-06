import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { BinaryFileData } from '@excalidraw/excalidraw/types'
import { Header } from './components/Header'
import { ControlCenterModal } from './components/ControlCenterModal'
import { ModePanel } from './components/ModePanel'
import { ModelQuickSwitch } from './components/ModelQuickSwitch'
import { PersonalSettingsModal } from './components/PersonalSettingsModal'
import { ProviderModal } from './components/ProviderModal'
import { PresetLibraryModal } from './components/PresetLibraryModal'
import { Canvas } from './components/Canvas'
import { FramePicker } from './components/FramePicker'
import { PromptBar } from './components/PromptBar'
import { Preview } from './components/Preview'
import { PreviewAnnotations } from './components/PreviewAnnotations'
import { WebEmbedPanel } from './components/WebEmbedPanel'
import { WorkCenterModal } from './components/WorkCenterModal'
import { StreamOverlay } from './components/StreamOverlay'
import { PlanOverlay } from './components/PlanOverlay'
import type { PlanPhase } from './components/PlanOverlay'
import { MessageStrip } from './components/MessageStrip'
import { ResizeHandle } from './components/ResizeHandle'
import { streamChat, extractHTML } from './lib/api'
import { exportSourceAsPng, exportAllAsPng, getSources } from './lib/export'
import { createTranslator, getInitialLocale, saveLocale, type Locale } from './lib/i18n'
import {
  applyPromptPreset,
  createPromptPresetPayload,
  createUserPromptPreset,
  loadUserPromptPresets,
  overwriteUserPromptPreset,
  renameUserPromptPreset,
  saveUserPromptPresets,
  type PromptPresetRecord,
} from './lib/presetLibrary'
import {
  formatPromptStudioSummary,
  loadPromptStudioState,
  savePromptStudioState,
  type PromptStudioState,
} from './lib/promptPresets'
import {
  buildGeneratePrompt,
  buildPlanPhaseContext,
  buildRefinePrompt,
  buildSystemPrompt,
} from './lib/promptBuilder'
import {
  PROVIDER_STATE_STORAGE_KEY,
  VISION_PROVIDER_STATE_STORAGE_KEY,
  getActiveModelId,
  getProvider,
  isProviderConfigured,
  isModelVideoEnabled,
  loadProviderState,
  loadVisionSupportMap,
  saveProviderState,
  saveVisionSupportMap,
  type ProviderState,
  type VisionSupportMap,
} from './lib/providers'
import type { Message } from './lib/api'
import type { ChatChip, ExportedCanvasData } from './lib/store'
import {
  CANVAS_MODE_DEFINITIONS,
  getCanvasModeDefinition,
  getModeContextPreferences,
  getModePromptDraft,
  getModeRemixState,
  getModeStudioState,
  loadModeSessionState,
  saveModeSessionState,
  type ModeSessionState,
  type RemixModeState,
} from './lib/canvasModes'
import { buildWorkflowContextNotes, createWorkflowContext, createWorkflowTurnReference } from './lib/workflowContext'
import { fetchWebsiteReference } from './lib/websiteReference'
import { buildPreviewAnnotationNotes, type PreviewAnnotation } from './lib/previewAnnotations'
import {
  buildVideoReferenceNotes,
  createVideoReference,
  getSelectedVideoKeyframes,
  type VideoReference,
} from './lib/videoReferences'
import {
  buildWebEmbedContextNotes,
  createWebEmbedReference,
  updateWebEmbedUrl,
  type WebEmbedReference,
} from './lib/webEmbeds'
import type { WorkflowTurnReference } from '../shared/contracts/publicServer'
import { getVisionRoutingError, prepareVisionMessages } from './lib/vision'
import './styles/app.css'

const SYSTEM_PROMPT = `You are an expert frontend developer. The user will show you a sketch/wireframe/reference and describe what they want. Generate a COMPLETE, self-contained HTML file.

## Output
- Do NOT explain your reasoning or thinking process. Do NOT write a plan, commentary, or preamble. Just output the code.
- Output ONLY raw, clean HTML inside a single \`\`\`html code fence. Nothing before it, nothing after it.
- CRITICAL — syntax highlighting contamination:
  Your training data contains web-scraped HTML from sites like Stack Overflow where code blocks are rendered with syntax highlighting (e.g. \`<span class="hljs-keyword">\`, \`<span class="s-str">\`). These are NOT part of the actual code — they are artifacts from highlight.js, Google Prettify, and Prism.js code formatters used to display code on those websites. You must NOT reproduce them. Specifically:
  - NEVER output classes: s-str, s-attr, s-tag, s-key, s-kw, s-num, s-comment, s-meta, hljs-keyword, hljs-string, hljs-attr, hljs-tag, hljs-number, hljs-comment, token-keyword, token-string, etc.
  - NEVER wrap HTML tokens in \`<span class="s-...">\` or \`<span class="hljs-...">\` — these come from code viewers, not from actual HTML source code
  - Output plain, valid HTML that a browser can render directly — as if you typed it in a text editor, not as if it was displayed on a documentation website
- Single self-contained file — all CSS/JS inline, dependencies via CDN
- Use Tailwind CSS (\`<script src="https://cdn.tailwindcss.com"></script>\`), Google Fonts, and Lucide Icons (\`<script src="https://unpkg.com/lucide@latest"></script>\`)
- For charts use Chart.js, for generative art use Canvas 2D API (NOT p5.js), for animation use GSAP or CSS, for 3D use three.js
- Use real placeholder content, not lorem ipsum. Use SVG or icon libraries for icons, never emoji.
- For placeholder assets (images, avatars, data), use the open APIs listed below — never use broken links or local file paths.

## Placeholder Assets — Open APIs (no auth required)

**Photos & Hero Images**
- \`https://images.unsplash.com/photo-{ID}?w={W}&h={H}&fit=crop\` — real photography. Use specific Unsplash photo IDs for consistency (e.g. \`photo-1506744038136-46273834b3fb\` for landscape, \`photo-1542291026-7eec264c27ff\` for product).
- \`https://loremflickr.com/{W}/{H}/{keyword}\` — random photos by keyword. E.g. \`/400/300/nature\`, \`/800/600/food\`, \`/600/400/architecture\`.
- \`https://placehold.co/{W}x{H}/{bg}/{text}?text={Label}\` — solid color with text label. E.g. \`/600x400/1a1a2e/eaeaea?text=Hero\`. Good for wireframes.

**Avatars & Profile Pictures**
- \`https://i.pravatar.cc/150?img={1-70}\` — realistic human face photos. Append \`?img=N\` for deterministic faces.
- \`https://api.dicebear.com/9.x/notionists/svg?seed={name}\` — illustrated avatar from seed string. Also supports styles: \`avataaars\`, \`bottts\`, \`lorelei\`, \`notionists\`.
- \`https://ui-avatars.com/api/?name={First+Last}&background=random&size=128\` — initials avatar with random background color.
- \`https://robohash.org/{seed}.png?size=200x200\` — robot/monster avatars from any seed string.
- \`https://randomuser.me/api/portraits/{women|men}/{1-99}.jpg\` — direct photo URL, no API call needed.

**Logos & Brands**
- \`https://logo.clearbit.com/{domain}\` — company logo by domain. E.g. \`/google.com\`, \`/stripe.com\`, \`/spotify.com\`.
- \`https://flagcdn.com/w80/{code}.png\` — country flags. E.g. \`/w80/us.png\`, \`/w80/jp.png\`. Widths: 20, 40, 80, 160, 320.

**Product & Content Data**
- \`https://dummyjson.com/products?limit=6\` — product data with images (title, price, thumbnail, description).
- \`https://dummyjson.com/recipes?limit=6\` — recipe data with images.
- \`https://dummyjson.com/quotes?limit=6\` — inspirational quotes.
- \`https://dummyjson.com/users?limit=6\` — user profiles with names, emails, and images.
- \`https://jsonplaceholder.typicode.com/posts\` — blog post text data (title, body).

**Usage rules**: Always fetch data with \`fetch()\` in a \`<script>\` tag and render dynamically. For images, use \`<img>\` tags with the direct URLs above. Vary the seeds/IDs so images look different from each other. Prefer Unsplash or loremflickr for hero/feature images, pravatar or dicebear for avatars, and dummyjson for structured content.

## Mockup-First Thinking
Before writing code, ask: **where does this design live in the real world?**

If it's a **website or landing page** — render full-width, it IS the viewport.
If it's a **generative art piece or game** — render full-canvas, edge-to-edge.
If it's **anything else** (app, dashboard, HUD, watch, kiosk, etc.) — render it as a **mockup**:
- \`<body>\` = the stage/environment (dark surface, desk, neutral bg)
- A centered device frame with correct aspect ratio sits on that stage
- The UI lives INSIDE the device frame
- Think Dribbble shot: background → device → UI

Examples of mockup contexts:
- **Phone app**: phone bezel + status bar + home indicator, ~9:19.5 ratio
- **Desktop app**: window chrome with traffic lights, drop shadow
- **Car HUD**: wide dark dashboard frame, ~21:9 ratio
- **Watch**: circular/rounded bezel, dark, minimal
- **AR/glasses**: semi-transparent panels floating over blurred background
- **Tablet, TV, kiosk, terminal**: appropriate frame and aspect ratio

## What GOOD Design Looks Like
- **Typography**: Pick distinctive Google Fonts — pair a display font with a body font. Vary weights dramatically (200 vs 800). Use a clear type scale.
- **Color**: Commit to a palette. One dominant + sharp accents. Tint your neutrals toward the brand hue. Never pure black/white.
- **Layout**: Create rhythm through VARIED spacing — tight groups, generous gaps. Break the grid intentionally. Not everything needs a card.
- **Content**: Real names, real companies, real descriptions. Never lorem ipsum.
- **Interaction**: Hover states that don't shift layout. Smooth transitions (150-300ms). Cursor pointer on clickable elements.
- **Polish**: Staggered page-load animations. Subtle shadows for depth. Consistent border radius. Intentional whitespace.

## Anti-Patterns — The "AI Slop" Test
If someone looks at the output and instantly thinks "AI made this" — that's the problem. Avoid these tells:
- Emoji as icons
- Cards inside cards inside cards
- Everything centered with identical spacing
- Purple-to-blue gradients, cyan-on-dark, neon glow aesthetic
- Gradient text on headings/metrics
- Big rounded rectangles with generic drop shadows
- Same-sized card grids repeated endlessly (icon + heading + text × 6)
- Hero section with big number + small label + supporting stats template
- Glassmorphism/blur as decoration without purpose
- Bounce/elastic easing (real objects don't bounce)
- Monospace font as lazy "technical" shorthand
- Large rounded-corner icons above every heading
- Repeating the same information the user can already see`

const INITIAL_MODE_STATE = loadModeSessionState(loadPromptStudioState())

function dataUrlToImagePayload(dataUrl: string | null | undefined): Message['content'][number] | null {
  if (!dataUrl) return null
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: match[1],
      data: match[2],
    },
  }
}

export function App() {
  const editorRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const [editor, setEditor] = useState<ExcalidrawImperativeAPI | null>(null)
  const [locale, setLocale] = useState<Locale>(getInitialLocale)
  const [providerState, setProviderState] = useState<ProviderState>(() => loadProviderState(PROVIDER_STATE_STORAGE_KEY))
  const [visionProviderState, setVisionProviderState] = useState<ProviderState>(() => loadProviderState(VISION_PROVIDER_STATE_STORAGE_KEY))
  const [visionSupportMap, setVisionSupportMap] = useState<VisionSupportMap>(loadVisionSupportMap)
  const [modeState, setModeState] = useState<ModeSessionState>(INITIAL_MODE_STATE)
  const [promptStudio, setPromptStudio] = useState<PromptStudioState>(() => getModeStudioState(INITIAL_MODE_STATE, INITIAL_MODE_STATE.activeModeId))
  const [promptDraft, setPromptDraft] = useState(() => getModePromptDraft(INITIAL_MODE_STATE, INITIAL_MODE_STATE.activeModeId))
  const [savedPresets, setSavedPresets] = useState<PromptPresetRecord[]>(loadUserPromptPresets)
  const [showModelQuickSwitch, setShowModelQuickSwitch] = useState(false)
  const [showControlCenter, setShowControlCenter] = useState(false)
  const [showProviderSettings, setShowProviderSettings] = useState(false)
  const [showPersonalSettings, setShowPersonalSettings] = useState(false)
  const [showPresetLibrary, setShowPresetLibrary] = useState(false)
  const [showModePanel, setShowModePanel] = useState(false)
  const [showWebEmbedPanel, setShowWebEmbedPanel] = useState(false)
  const [showWorkCenter, setShowWorkCenter] = useState(false)
  const [fineTuneExpanded, setFineTuneExpanded] = useState(false)
  const [fetchingRemixReference, setFetchingRemixReference] = useState(false)
  const [lastTurnReference, setLastTurnReference] = useState<WorkflowTurnReference | null>(null)

  const t = useMemo(() => createTranslator(locale), [locale])
  const activeModeId = modeState.activeModeId
  const modeDefinition = useMemo(() => getCanvasModeDefinition(activeModeId), [activeModeId])
  const compactPromptBar = true
  const contextPreferences = useMemo(() => getModeContextPreferences(modeState, activeModeId), [modeState, activeModeId])
  const remixState = useMemo<RemixModeState | null>(() => getModeRemixState(modeState, activeModeId), [modeState, activeModeId])
  const provider = getProvider(providerState.activeProviderId)
  const modelId = getActiveModelId(providerState)
  const apiKey = providerState.keys[provider.id] || ''
  const modelLabel = provider.id === 'custom'
    ? (providerState.custom.mode === 'azure'
      ? (providerState.custom.deployment?.trim() || providerState.custom.modelId?.trim() || '—')
      : (providerState.custom.modelId?.trim() || '—'))
    : (provider.models.find(m => m.id === modelId)?.label || modelId)
  const [messages, setMessages] = useState<Message[]>([])
  const [chips, setChips] = useState<ChatChip[]>([])
  const [iteration, setIteration] = useState(0)
  const [lastHTML, setLastHTML] = useState('')
  const [generating, setGenerating] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [thinkingText, setThinkingText] = useState('')
  const [streamTokenCount, setStreamTokenCount] = useState(0)
  const [streamDone, setStreamDone] = useState(false)
  const [usage, setUsage] = useState<{ input_tokens: number | string; output_tokens: number | string } | null>(null)
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set())
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null)
  const [previewAnnotationMode, setPreviewAnnotationMode] = useState(false)
  const [previewAnnotations, setPreviewAnnotations] = useState<PreviewAnnotation[]>([])
  const [videoReference, setVideoReference] = useState<VideoReference | null>(null)
  const [webEmbeds, setWebEmbeds] = useState<WebEmbedReference[]>([])
  const [canvasVersion, setCanvasVersion] = useState(0)
  const [planMode, setPlanMode] = useState(false)
  const [planPhases, setPlanPhases] = useState<PlanPhase[]>([])
  const [planActiveIndex, setPlanActiveIndex] = useState(0)
  const [planTokenCount, setPlanTokenCount] = useState(0)
  const [planDone, setPlanDone] = useState(false)

  const compiledSystemPrompt = useMemo(
    () => buildSystemPrompt(SYSTEM_PROMPT, promptStudio, {
      modeManifesto: modeDefinition.manifesto,
    }),
    [promptStudio, modeDefinition],
  )
  const promptStudioSummary = useMemo(
    () => formatPromptStudioSummary(promptStudio, t),
    [promptStudio, t],
  )
  const videoRoutingNote = useMemo(() => {
    if (activeModeId !== 'video') return ''
    if (isModelVideoEnabled(provider, modelId)) return ''
    return [
      '## Video Capability Routing',
      'The active model is not marked as video-capable. Do not assume direct video understanding.',
      'Use selected keyframes, canvas screenshots, and visual translation notes as the authoritative video reference path.',
    ].join('\n')
  }, [activeModeId, provider, modelId])

  const previewRef = useRef<HTMLIFrameElement>(null)
  const panelLeftRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.lang = locale
    saveLocale(locale)
  }, [locale])

  useEffect(() => {
    savePromptStudioState(promptStudio)
  }, [promptStudio])

  useEffect(() => {
    setPromptStudio(getModeStudioState(modeState, activeModeId))
    setPromptDraft(getModePromptDraft(modeState, activeModeId))
  }, [modeState, activeModeId])

  useEffect(() => {
    saveModeSessionState(modeState)
  }, [modeState])

  useEffect(() => {
    saveUserPromptPresets(savedPresets)
  }, [savedPresets])

  useEffect(() => {
    setPreviewAnnotationMode(false)
    setPreviewAnnotations([])
  }, [lastHTML])

  const persistProviderState = useCallback((newState: ProviderState) => {
    setProviderState(newState)
    saveProviderState(newState, PROVIDER_STATE_STORAGE_KEY)
  }, [])

  const persistVisionProviderState = useCallback((newState: ProviderState) => {
    setVisionProviderState(newState)
    saveProviderState(newState, VISION_PROVIDER_STATE_STORAGE_KEY)
  }, [])

  const persistVisionSupportMap = useCallback((map: VisionSupportMap) => {
    setVisionSupportMap(map)
    saveVisionSupportMap(map)
  }, [])

  const handleProviderUpdate = useCallback((newState: ProviderState) => {
    persistProviderState(newState)
  }, [persistProviderState])

  const handleVisionProviderUpdate = useCallback((newState: ProviderState) => {
    persistVisionProviderState(newState)
  }, [persistVisionProviderState])

  const handleVisionSupportUpdate = useCallback((map: VisionSupportMap) => {
    persistVisionSupportMap(map)
  }, [persistVisionSupportMap])

  const handleModeChange = useCallback((modeId: typeof activeModeId) => {
    const mode = getCanvasModeDefinition(modeId)
    setModeState((prev) => ({
      ...prev,
      activeModeId: modeId,
      studioByMode: {
        ...prev.studioByMode,
        [modeId]: prev.studioByMode[modeId] || mode.defaultStudioState,
      },
      promptByMode: {
        ...prev.promptByMode,
        [modeId]: prev.promptByMode[modeId] || '',
      },
      contextByMode: {
        ...prev.contextByMode,
      },
      remixByMode: {
        ...prev.remixByMode,
      },
    }))
    setShowModePanel(false)
    setFineTuneExpanded(false)
  }, [])

  const handlePromptChange = useCallback((value: string) => {
    setPromptDraft(value)
    setModeState((prev) => ({
      ...prev,
      promptByMode: {
        ...prev.promptByMode,
        [prev.activeModeId]: value,
      },
    }))
  }, [])

  const handleStudioChange = useCallback((nextStudio: PromptStudioState) => {
    setPromptStudio(nextStudio)
    setModeState((prev) => ({
      ...prev,
      studioByMode: {
        ...prev.studioByMode,
        [prev.activeModeId]: nextStudio,
      },
    }))
  }, [])

  const handleContextPreferencesChange = useCallback((nextPreferences: { carryPolicy: 'disabled' | 'last-turn' | 'full'; includePreviousPrompt: boolean; includePreviousOutput: boolean; includePreviousScreenshot: boolean }) => {
    setModeState((prev) => ({
      ...prev,
      contextByMode: {
        ...prev.contextByMode,
        [prev.activeModeId]: nextPreferences,
      },
    }))
  }, [])

  const handleRemixUrlChange = useCallback((url: string) => {
    setModeState((prev) => ({
      ...prev,
      remixByMode: {
        ...prev.remixByMode,
        [prev.activeModeId]: {
          ...(prev.remixByMode[prev.activeModeId] || {
            url: '',
            html: '',
            stylesheetSnippets: [],
            styleHints: [],
            fetchedAt: '',
            error: null,
            fetchStatus: 'idle',
          }),
          url,
          error: null,
          fetchStatus: 'idle',
        },
      },
    }))
  }, [])

  const handleFetchRemixReference = useCallback(async () => {
    const current = modeState.activeModeId
    const mode = getCanvasModeDefinition(current)
    if (!mode.requiresWebsiteReference) return
    const url = modeState.remixByMode[current]?.url?.trim() || ''
    if (!url) return
    setFetchingRemixReference(true)
    setModeState((prev) => ({
      ...prev,
      remixByMode: {
        ...prev.remixByMode,
        [current]: {
          ...(prev.remixByMode[current] || {
            url,
            html: '',
            stylesheetSnippets: [],
            styleHints: [],
            fetchedAt: '',
            error: null,
            fetchStatus: 'idle',
          }),
          fetchStatus: 'loading',
          error: null,
        },
      },
    }))
    try {
      const reference = await fetchWebsiteReference(url)
      setModeState((prev) => ({
        ...prev,
        remixByMode: {
          ...prev.remixByMode,
          [current]: {
            ...reference,
            fetchStatus: 'ready',
          },
        },
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setModeState((prev) => ({
        ...prev,
        remixByMode: {
          ...prev.remixByMode,
          [current]: {
            ...(prev.remixByMode[current] || {
              url,
              html: '',
              stylesheetSnippets: [],
              styleHints: [],
              fetchedAt: '',
              error: null,
              fetchStatus: 'idle',
            }),
            error: message,
            fetchStatus: 'error',
          },
        },
      }))
    } finally {
      setFetchingRemixReference(false)
    }
  }, [modeState])

  const handleVideoKeyframeToggle = useCallback((keyframeId: string) => {
    setVideoReference((current) => {
      if (!current) return current
      const selected = new Set(current.selectedKeyframeIds)
      if (selected.has(keyframeId)) {
        selected.delete(keyframeId)
      } else {
        selected.add(keyframeId)
      }
      return {
        ...current,
        selectedKeyframeIds: Array.from(selected),
      }
    })
  }, [])

  const handleClearVideoReference = useCallback(() => {
    setVideoReference(null)
  }, [])

  const handleSurprise = useCallback(() => {
    const nextPrompt = promptDraft.trim()
      ? `${promptDraft.trim()}\n\n${modeDefinition.surprisePrompt}`
      : modeDefinition.surprisePrompt
    handlePromptChange(nextPrompt)
  }, [handlePromptChange, modeDefinition, promptDraft])

  const buildCurrentPresetPayload = useCallback(() => {
    return createPromptPresetPayload(promptStudio, promptDraft, providerState, visionProviderState, visionSupportMap)
  }, [promptStudio, promptDraft, providerState, visionProviderState, visionSupportMap])

  const handleSavePresetAsNew = useCallback((name: string) => {
    const next = createUserPromptPreset(name, buildCurrentPresetPayload())
    setSavedPresets((prev) => [next, ...prev])
  }, [buildCurrentPresetPayload])

  const handleOverwritePreset = useCallback((presetId: string) => {
    setSavedPresets((prev) => prev.map((preset) => (
      preset.id === presetId ? overwriteUserPromptPreset(preset, buildCurrentPresetPayload()) : preset
    )))
  }, [buildCurrentPresetPayload])

  const handleRenamePreset = useCallback((presetId: string, name: string) => {
    setSavedPresets((prev) => prev.map((preset) => (
      preset.id === presetId ? renameUserPromptPreset(preset, name) : preset
    )))
  }, [])

  const handleDeletePreset = useCallback((presetId: string) => {
    setSavedPresets((prev) => prev.filter((preset) => preset.id !== presetId))
  }, [])

  const handleApplyPreset = useCallback((preset: PromptPresetRecord) => {
    const applied = applyPromptPreset(preset, providerState, visionProviderState, visionSupportMap)
    handleStudioChange(applied.promptStudio)
    handlePromptChange(applied.promptDraft)
    persistProviderState(applied.providerState)
    persistVisionProviderState(applied.visionProviderState)
    persistVisionSupportMap(applied.visionSupportMap)
    setShowPresetLibrary(false)
  }, [handlePromptChange, handleStudioChange, persistProviderState, persistVisionProviderState, persistVisionSupportMap, providerState, visionProviderState, visionSupportMap])

  const addChip = useCallback((chip: ChatChip) => {
    setChips((prev) => [...prev, chip])
  }, [])

  const handleClear = useCallback(() => {
    setMessages([])
    setChips([])
    setIteration(0)
    setLastHTML('')
    handlePromptChange('')
    setStreamText('')
    setThinkingText('')
    setStreamTokenCount(0)
    setStreamDone(false)
    setUsage(null)
    setPreviewScreenshot(null)
    setPreviewAnnotationMode(false)
    setPreviewAnnotations([])
    setVideoReference(null)
    setWebEmbeds([])
    setLastTurnReference(null)
  }, [handlePromptChange])

  const handleResize = useCallback((deltaX: number) => {
    const el = panelLeftRef.current
    if (!el) return
    const w = el.getBoundingClientRect().width + deltaX
    el.style.width = Math.max(320, Math.min(w, window.innerWidth - 350)) + 'px'
  }, [])

  const handleAddFrame = useCallback(() => {
    const api = editorRef.current
    if (!api) return
    const frameCount = getSources(api).filter(s => s.kind === 'frame').length
    const newElements = convertToExcalidrawElements([{
      type: 'frame',
      x: 100 + frameCount * 50,
      y: 100 + frameCount * 50,
      width: 400,
      height: 300,
      name: t('canvas.frameName', { index: frameCount + 1 }),
      children: [],
    }])
    api.updateScene({
      elements: [...api.getSceneElements(), ...newElements],
    })
  }, [t])

  const handleAddWebEmbed = useCallback(() => {
    const api = editorRef.current
    if (!api) return
    const rawUrl = window.prompt(t('webEmbed.prompt'))
    if (!rawUrl) return

    try {
      const draft = createWebEmbedReference({ url: rawUrl })
      const frameCount = getSources(api).filter(s => s.kind === 'frame').length
      const newElements = convertToExcalidrawElements([{
        type: 'frame',
        x: 120 + frameCount * 42,
        y: 120 + frameCount * 42,
        width: 520,
        height: 320,
        name: `${t('webEmbed.framePrefix')}: ${draft.title}`,
        children: [],
      }])
      api.updateScene({
        elements: [...api.getSceneElements(), ...newElements],
      })
      const frameId = newElements[0]?.id || null
      setWebEmbeds((prev) => [...prev, { ...draft, frameId }])
      setShowWebEmbedPanel(true)
      setCanvasVersion((version) => version + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      window.alert(t(message) === message ? message : t(message))
    }
  }, [t])

  const handleReplaceWebEmbed = useCallback((id: string, url: string) => {
    try {
      setWebEmbeds((prev) => prev.map((embed) =>
        embed.id === id ? updateWebEmbedUrl(embed, url) : embed,
      ))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      window.alert(t(message) === message ? message : t(message))
      setWebEmbeds((prev) => prev.map((embed) =>
        embed.id === id
          ? { ...embed, status: 'error', error: t(message) === message ? message : t(message), updatedAt: new Date().toISOString() }
          : embed,
      ))
    }
  }, [t])

  const handleRemoveWebEmbed = useCallback((id: string) => {
    setWebEmbeds((prev) => {
      const next = prev.filter((embed) => embed.id !== id)
      if (next.length === 0) setShowWebEmbedPanel(false)
      return next
    })
  }, [])

  const handleWebEmbedStatusChange = useCallback((id: string, status: WebEmbedReference['status'], error?: string | null) => {
    setWebEmbeds((prev) => prev.map((embed) =>
      embed.id === id
        ? { ...embed, status, error: error || null, updatedAt: new Date().toISOString() }
        : embed,
    ))
  }, [])

  const handleSave = useCallback(() => {
    const api = editorRef.current
    if (!api) return
    const data: ExportedCanvasData = {
      elements: api.getSceneElements(),
      files: api.getFiles(),
      workflowState: lastTurnReference,
      webEmbeds,
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('system.export.filename')}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [t, lastTurnReference, webEmbeds])

  const buildCurrentCanvasData = useCallback(() => {
    const api = editorRef.current
    if (!api) return null
    const data: ExportedCanvasData = {
      elements: api.getSceneElements(),
      files: api.getFiles(),
      workflowState: lastTurnReference,
      webEmbeds,
    }
    return JSON.stringify(data)
  }, [lastTurnReference, webEmbeds])

  const handleExportHtml = useCallback(() => {
    if (!lastHTML) return
    const blob = new Blob([lastHTML], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vcanvas-${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }, [lastHTML])

  const handleLoad = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const api = editorRef.current
      if (!api) return
      if (file.type.startsWith('application/json') || file.name.endsWith('.json')) {
        const text = await file.text()
        const parsed = JSON.parse(text) as ExportedCanvasData
        api.updateScene({ elements: (parsed.elements as any[]) || [] })
        if (parsed.files) api.addFiles(Object.values(parsed.files as Record<string, BinaryFileData>))
        setLastTurnReference(parsed.workflowState || null)
        setWebEmbeds(parsed.webEmbeds || [])
        return
      }

      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : ''
        if (!dataUrl) return
        const frameCount = getSources(api).filter((s) => s.kind === 'frame').length
        const elementType = file.type.startsWith('video/') ? 'frame' : 'image'
        const baseElement = {
          x: 140 + frameCount * 36,
          y: 140 + frameCount * 36,
          width: file.type.startsWith('video/') ? 420 : 360,
          height: file.type.startsWith('video/') ? 236 : 240,
        }

        if (elementType === 'image') {
          const newElements = convertToExcalidrawElements([{
            type: 'image',
            fileId: file.name,
            status: 'saved',
            ...baseElement,
          } as any])
          api.updateScene({
            elements: [...api.getSceneElements(), ...newElements],
          })
          api.addFiles([{
            id: file.name,
            mimeType: file.type || 'image/png',
            dataURL: dataUrl,
            created: Date.now(),
            lastRetrieved: Date.now(),
          } as any])
          return
        }

        const videoLabel = `${t('canvas.videoLabel')}: ${file.name}`
        const newElements = convertToExcalidrawElements([{
          type: 'frame',
          name: videoLabel,
          children: [],
          ...baseElement,
        }])
        api.updateScene({
          elements: [...api.getSceneElements(), ...newElements],
        })
        handleModeChange('video')
        try {
          const nextVideoReference = await createVideoReference(file.name, dataUrl)
          setVideoReference(nextVideoReference)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          setVideoReference({
            id: `video-${Date.now()}`,
            fileName: file.name,
            duration: 0,
            keyframes: [],
            selectedKeyframeIds: [],
            createdAt: new Date().toISOString(),
            error: message,
          })
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }, [handleModeChange, lastTurnReference, t])

  // Debounced canvas change — bumps version so FramePicker re-exports thumbs
  const canvasChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleCanvasChange = useCallback(() => {
    if (canvasChangeTimer.current) clearTimeout(canvasChangeTimer.current)
    canvasChangeTimer.current = setTimeout(() => setCanvasVersion(v => v + 1), 400)
  }, [])

  // Export selected sources as images
  // If no frames exist, always send full canvas (images alone don't isolate)
  const getSelectedFrameImages = useCallback(async () => {
    const api = editorRef.current
    if (!api) return []

    const allSources = getSources(api)
    const hasFrames = allSources.some(s => s.kind === 'frame')

    if (!hasFrames) {
      // No frames — full canvas mode
      const b64 = await exportAllAsPng(api)
      if (b64) return [{ base64: b64, label: t('system.prompt.fullCanvas') }]
      return []
    }

    const selected = allSources.filter((s) => selectedFrameIds.has(s.id))
    if (selected.length === 0) {
      // Frames exist but none selected — export entire canvas
      const b64 = await exportAllAsPng(api)
      if (b64) return [{ base64: b64, label: t('system.prompt.fullCanvas') }]
      return []
    }

    const results: { base64: string; label: string }[] = []
    for (const src of selected) {
      const b64 = await exportSourceAsPng(api, src.id)
      if (b64) results.push({ base64: b64, label: src.name })
    }
    return results
  }, [selectedFrameIds, t])

  const getCurrentCanvasLabels = useCallback(async () => {
    const api = editorRef.current
    if (!api) return []
    return getSources(api).map((source) => `${source.kind}:${source.name}`)
  }, [])

  // Capture preview iframe as screenshot
  const capturePreview = useCallback(async (): Promise<string | null> => {
    const iframe = previewRef.current
    if (!iframe) return null
    try {
      const { default: html2canvas } = await import('html2canvas')
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (!doc?.body) return null
      const screenshot = await html2canvas(doc.body, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 0.8,
        logging: false,
      })
      return screenshot.toDataURL('image/png').split(',')[1]
    } catch {
      return null
    }
  }, [])

  const getModeWorkflowContext = useCallback(async (currentPrompt: string, currentOutputHtml?: string) => {
    const currentLabels = await getCurrentCanvasLabels()
    const websiteReference = remixState?.fetchStatus === 'ready'
      ? {
        url: remixState.url,
        html: remixState.html,
        rebasedHtml: remixState.rebasedHtml || '',
        screenshotDataUrl: remixState.screenshotDataUrl || null,
        stylesheetSnippets: remixState.stylesheetSnippets || [],
        styleHints: remixState.styleHints || [],
        fetchedAt: remixState.fetchedAt,
        error: remixState.error || null,
      }
      : null

    return createWorkflowContext({
      modeId: activeModeId,
      prompt: currentPrompt,
      currentCanvasLabels: currentLabels,
      currentOutputHtml,
      previousTurn: lastTurnReference,
      preferences: contextPreferences,
      websiteReference,
      webEmbeds,
      previewAnnotations,
      videoReference,
    })
  }, [activeModeId, contextPreferences, getCurrentCanvasLabels, lastTurnReference, previewAnnotations, remixState, videoReference, webEmbeds])

  const prepareMessagesForCodeModel = useCallback(async (messages: Message[]) => {
    return prepareVisionMessages(providerState, messages, {
      supportMap: visionSupportMap,
      analyzerState: visionProviderState,
    })
  }, [providerState, visionProviderState, visionSupportMap])

  const appendWorkflowReferenceImages = useCallback((
    userContent: Exclude<Message['content'], string>,
    chipImages: NonNullable<ChatChip['images']>,
    workflowContextNotes: string,
    options?: { includeCurrentPreview?: boolean },
  ) => {
    const previousImage = dataUrlToImagePayload(lastTurnReference?.screenshotDataUrl || null)
    if (contextPreferences.includePreviousScreenshot && previousImage) {
      userContent.push(previousImage)
      chipImages.push({
        src: lastTurnReference!.screenshotDataUrl!,
        label: t('mode.context.prevScreenshot'),
      })
    }

    const remixImage = dataUrlToImagePayload(remixState?.fetchStatus === 'ready' ? remixState.screenshotDataUrl : null)
    if (remixImage) {
      userContent.push(remixImage)
      chipImages.push({
        src: remixState!.screenshotDataUrl!,
        label: t('mode.remix.reference'),
      })
    }

    if (options?.includeCurrentPreview && previewScreenshot) {
      const currentPreviewImage = dataUrlToImagePayload(previewScreenshot)
      if (currentPreviewImage) {
        userContent.push(currentPreviewImage)
        chipImages.push({
          src: previewScreenshot,
          label: t('system.prompt.currentOutput'),
        })
      }
    }

    if (workflowContextNotes.trim()) {
      userContent.push({ type: 'text', text: workflowContextNotes })
    }
  }, [contextPreferences.includePreviousScreenshot, lastTurnReference, previewScreenshot, remixState, t])

  const appendVideoKeyframeImages = useCallback((
    userContent: Exclude<Message['content'], string>,
    chipImages: NonNullable<ChatChip['images']>,
  ) => {
    if (activeModeId !== 'video') return
    for (const keyframe of getSelectedVideoKeyframes(videoReference)) {
      const imagePayload = dataUrlToImagePayload(keyframe.dataUrl)
      if (!imagePayload) continue
      userContent.push(imagePayload)
      chipImages.push({
        src: keyframe.dataUrl,
        label: `${t('mode.video.keyframe')} ${keyframe.label}`,
      })
    }
  }, [activeModeId, t, videoReference])

  const handleGenerate = useCallback(async (prompt: string) => {
    if (!isProviderConfigured(providerState) || generating) return

    setGenerating(true)
    setStreamText('')
    setThinkingText('')
    setStreamTokenCount(0)
    setStreamDone(false)
    setUsage(null)

    const frameImages = await getSelectedFrameImages()
    const workflowContext = await getModeWorkflowContext(prompt)
    const workflowContextNotes = [
      buildWorkflowContextNotes(workflowContext),
      buildWebEmbedContextNotes(webEmbeds),
      activeModeId === 'video' ? buildVideoReferenceNotes(videoReference) : '',
      videoRoutingNote,
    ].filter(Boolean).join('\n\n')
    const compiledPrompt = buildGeneratePrompt(prompt, promptStudio, {
      modeStarter: modeDefinition.starterPrompts[0],
      workflowContextNotes,
    })
    const compiledSystem = buildSystemPrompt(SYSTEM_PROMPT, promptStudio, {
      modeManifesto: modeDefinition.manifesto,
      workflowContextNotes,
    })

    // Build user message content
    const userContent: Message['content'] = []
    const chipImages: ChatChip['images'] = []

    for (const img of frameImages) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: img.base64 },
      })
      chipImages.push({ src: 'data:image/png;base64,' + img.base64, label: img.label })
    }
    appendVideoKeyframeImages(userContent, chipImages)
    userContent.push({ type: 'text', text: compiledPrompt })

    const newMessages: Message[] = [
      { role: 'system', content: compiledSystem },
      { role: 'user', content: userContent },
    ]

    try {
      const dispatch = await prepareMessagesForCodeModel(newMessages)

      setMessages(dispatch.preparedMessages)
      addChip({ role: 'user', text: `${promptStudioSummary}\n${prompt}`, images: chipImages })
      if (dispatch.analyzerSummary) {
        addChip({ role: 'assistant', text: dispatch.analyzerSummary })
      }
      setIteration((i) => i + 1)
      setLastTurnReference(createWorkflowTurnReference({
        id: `turn-${Date.now()}`,
        modeId: activeModeId,
        prompt,
        html: '',
      }))

      await streamChat(provider, providerState, apiKey, modelId, dispatch.preparedMessages, {
        onChunk: (text, tokenIdx) => {
          setStreamText((prev) => prev + text)
          setStreamTokenCount(tokenIdx)
        },
        onThinking: (text) => setThinkingText((prev) => prev + text),
        onDone: (fullText, u) => {
          setUsage(u)
          setStreamDone(true)

          const html = extractHTML(fullText)
          if (html) {
            setTimeout(() => {
              setLastHTML(html)
              setLastTurnReference(createWorkflowTurnReference({
                id: `turn-${Date.now()}`,
                modeId: activeModeId,
                prompt,
                html,
              }))
              setGenerating(false)
              addChip({ role: 'assistant', text: t('system.chip.generated') })
            }, 500)
          } else {
            setGenerating(false)
            addChip({ role: 'assistant', text: t('system.chip.noHtml') })
          }

          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: fullText },
          ])
        },
        onError: (err) => {
          setGenerating(false)
          addChip({ role: 'assistant', text: 'ERR:' + err.message })
        },
      })
    } catch (err: any) {
      setGenerating(false)
      addChip({ role: 'assistant', text: 'ERR:' + (t(err.message) === err.message ? err.message : t(err.message)) })
    }
  }, [provider, providerState, apiKey, modelId, generating, getSelectedFrameImages, addChip, prepareMessagesForCodeModel, t, promptStudio, activeModeId, getModeWorkflowContext, modeDefinition, contextPreferences, lastTurnReference, promptStudioSummary, videoReference, appendVideoKeyframeImages, webEmbeds, videoRoutingNote])

  const handleRefine = useCallback(async (prompt: string) => {
    if (!isProviderConfigured(providerState) || generating) return

    setGenerating(true)
    setStreamText('')
    setThinkingText('')
    setStreamTokenCount(0)
    setStreamDone(false)
    setUsage(null)

    // Capture current preview screenshot
    const screenshotB64 = await capturePreview()
    const currentPreviewDataUrl = screenshotB64 ? 'data:image/png;base64,' + screenshotB64 : null
    setPreviewScreenshot(currentPreviewDataUrl)

    const workflowContext = await getModeWorkflowContext(prompt || t('system.prompt.refineDefault'), lastHTML)
    const workflowContextNotes = [
      buildWorkflowContextNotes(workflowContext),
      buildWebEmbedContextNotes(webEmbeds),
      buildPreviewAnnotationNotes(previewAnnotations),
      activeModeId === 'video' ? buildVideoReferenceNotes(videoReference) : '',
      videoRoutingNote,
    ].filter(Boolean).join('\n\n')
    const refinementPrompt = buildRefinePrompt(prompt, promptStudio, t('system.prompt.refineDefault'), {
      modeStarter: modeDefinition.starterPrompts[0],
      workflowContextNotes,
    })
    const compiledSystem = buildSystemPrompt(SYSTEM_PROMPT, promptStudio, {
      modeManifesto: modeDefinition.manifesto,
      workflowContextNotes,
    })

    const userContent: Message['content'] = []
    const chipImages: ChatChip['images'] = []

    // 1. Screenshot of current rendered output
    if (screenshotB64 && currentPreviewDataUrl) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: screenshotB64 },
      })
      chipImages.push({ src: currentPreviewDataUrl, label: t('system.prompt.currentOutput') })
    }

    // 2. Canvas sketches (original reference)
    const frameImages = await getSelectedFrameImages()
    for (const img of frameImages) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: img.base64 },
      })
      chipImages.push({ src: 'data:image/png;base64,' + img.base64, label: img.label })
    }
    appendVideoKeyframeImages(userContent, chipImages)

    // 3. Previous HTML + refinement prompt (flat, no stacked history)
    userContent.push({
      type: 'text',
      text: `Here is the current HTML output:\n\n\`\`\`html\n${lastHTML}\n\`\`\`\n\nHere's a screenshot of how it currently renders. ${refinementPrompt}\n\nPlease provide the COMPLETE updated HTML file in a \`\`\`html code fence.`,
    })
    appendWorkflowReferenceImages(userContent, chipImages, workflowContextNotes)

    // Flat message list: system + single user turn (no conversation history)
    const newMessages: Message[] = [
      { role: 'system', content: compiledSystem },
      { role: 'user', content: userContent },
    ]

    try {
      const dispatch = await prepareMessagesForCodeModel(newMessages)

      setMessages(dispatch.preparedMessages)
      addChip({ role: 'user', text: `${promptStudioSummary}\n${prompt || t('system.chip.refineAction')}`, images: chipImages.length ? chipImages : undefined })
      if (dispatch.analyzerSummary) {
        addChip({ role: 'assistant', text: dispatch.analyzerSummary })
      }
      setIteration((i) => i + 1)

      await streamChat(provider, providerState, apiKey, modelId, dispatch.preparedMessages, {
        onChunk: (text, tokenIdx) => {
          setStreamText((prev) => prev + text)
          setStreamTokenCount(tokenIdx)
        },
        onThinking: (text) => setThinkingText((prev) => prev + text),
        onDone: (fullText, u) => {
          setUsage(u)
          setStreamDone(true)

          const html = extractHTML(fullText)
          if (html) {
            setTimeout(() => {
              setLastHTML(html)
              setLastTurnReference(createWorkflowTurnReference({
                id: `turn-${Date.now()}`,
                modeId: activeModeId,
                prompt: prompt || t('system.prompt.refineDefault'),
                html,
                screenshotDataUrl: currentPreviewDataUrl,
              }))
              setGenerating(false)
              addChip({ role: 'assistant', text: t('system.chip.refined') })
            }, 500)
          } else {
            setGenerating(false)
            addChip({ role: 'assistant', text: t('system.chip.noHtml') })
          }
        },
        onError: (err) => {
          setGenerating(false)
          addChip({ role: 'assistant', text: 'ERR:' + err.message })
        },
      })
    } catch (err: any) {
      setGenerating(false)
      addChip({ role: 'assistant', text: 'ERR:' + (t(err.message) === err.message ? err.message : t(err.message)) })
    }
  }, [provider, providerState, apiKey, modelId, generating, lastHTML, capturePreview, getSelectedFrameImages, addChip, prepareMessagesForCodeModel, t, promptStudio, promptStudioSummary, getModeWorkflowContext, modeDefinition, appendWorkflowReferenceImages, activeModeId, previewAnnotations, videoReference, appendVideoKeyframeImages, webEmbeds, videoRoutingNote])

  // ── Plan Mode: multi-step Gaze → Dream → Create ──

  const planPhaseContext = useMemo(() => buildPlanPhaseContext(promptStudio, {
    modeManifesto: modeDefinition.manifesto,
    modeStarter: modeDefinition.starterPrompts[0],
  }), [promptStudio, modeDefinition])

  const makeGazePrompt = useCallback((userRequest: string) =>
    `You are an artist and visual thinker. Gaze deeply into this image. Let it speak to you.

The user's request: "${userRequest}"

${planPhaseContext}

Now describe what you see — not clinically, but with feeling:
- What story is the image telling? What is its essence?
- Shapes, forms, flows, negative space — how does the composition breathe?
- Colors, light, contrast — what mood do they create?
- Any text, labels, annotations, arrows the user drew — what are they communicating?
- What does this WANT to become? A sleek app? A wild art piece? A polished page?
- What emotions or associations does it evoke?

Be poetic but specific. See beyond the obvious. This is the foundation of everything that follows.`,
  [planPhaseContext])

  const makeDreamPrompt = useCallback((userRequest: string) =>
    `You are a visionary designer in a flow state. Based on what you saw in the image, now DREAM.

The user's request: "${userRequest}"

${planPhaseContext}

Let your imagination run wild, then focus it:
- **What is this becoming?** Not just "a landing page" — what KIND? What's the vibe, the world it lives in?
- **Visual identity** — Dream up specific fonts (Google Fonts, distinctive ones), an exact color palette (hex codes), a texture/pattern language
- **The feeling** — When someone sees this, what do they FEEL? Elegant calm? Electric energy? Cozy warmth? Brutal honesty?
- **The magic moment** — What one detail will make someone stop and say "wow"? A scroll animation? A color transition? An unexpected layout break?
- **Wild ideas** — Throw out 3-5 creative ideas that could elevate this beyond generic. Go bold. Particle effects? Asymmetric grids? Cinematic typography? Interactive physics?
- **The vibe board** — If this were a mood board, what's on it? Be specific.

Dream big, then crystallize it into a vision someone could build. Be opinionated. Be brave.`,
  [planPhaseContext])

  const makePlanCreatePrompt = useCallback((gazeResult: string, dreamResult: string, userRequest: string) =>
    `You are implementing a design based on deep observation and creative vision.

## The User's Request:
${userRequest}

## Studio Direction:
${planPhaseContext}

## What Was Seen (Gaze):
${gazeResult}

## The Creative Vision (Dream):
${dreamResult}

Now bring this vision to life. Generate the COMPLETE HTML file that realizes this dream. Every font, color, interaction, and detail from the vision should be faithfully implemented. Make it extraordinary.

${compiledSystemPrompt}`,
  [compiledSystemPrompt, planPhaseContext])

  const runPlanPhase = useCallback(async (
    messages: Message[],
    phaseIndex: number,
    onText: (text: string) => void,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      prepareMessagesForCodeModel(messages)
        .then((dispatch) => streamChat(provider, providerState, apiKey, modelId, dispatch.preparedMessages, {
        onChunk: (text, tokenIdx) => {
          onText(text)
          setPlanTokenCount(tokenIdx)
        },
        onDone: (fullText) => resolve(fullText),
        onError: (err) => reject(err),
      }))
        .catch(reject)
    })
  }, [provider, providerState, apiKey, modelId, prepareMessagesForCodeModel])

  const handlePlanGenerate = useCallback(async (prompt: string) => {
    if (!isProviderConfigured(providerState) || generating) return

    setGenerating(true)
    setPlanDone(false)
    setPlanTokenCount(0)
    setPlanActiveIndex(0)

    const initialPhases: PlanPhase[] = [
      { name: 'gaze', label: t('plan.gaze'), status: 'active', text: '' },
      { name: 'dream', label: t('plan.dream'), status: 'waiting', text: '' },
      { name: 'create', label: t('plan.create'), status: 'waiting', text: '' },
    ]
    setPlanPhases(initialPhases)

    const frameImages = await getSelectedFrameImages()
    const chipImages: ChatChip['images'] = []
    const imageContent: Message['content'] = []
    const workflowContext = await getModeWorkflowContext(prompt)
    const workflowContextNotes = [
      buildWorkflowContextNotes(workflowContext),
      buildWebEmbedContextNotes(webEmbeds),
      activeModeId === 'video' ? buildVideoReferenceNotes(videoReference) : '',
      videoRoutingNote,
    ].filter(Boolean).join('\n\n')

    for (const img of frameImages) {
      imageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: img.base64 },
      })
      chipImages.push({ src: 'data:image/png;base64,' + img.base64, label: img.label })
    }
    appendVideoKeyframeImages(imageContent, chipImages)
    appendWorkflowReferenceImages(imageContent, chipImages, workflowContextNotes)

    addChip({ role: 'user', text: `${t('system.chip.planTag')} ${promptStudioSummary}\n${prompt}`, images: chipImages })

    try {
      // Phase 1: Gaze
      const gazeResult = await runPlanPhase([
        { role: 'user', content: [...imageContent, { type: 'text', text: `${workflowContextNotes}\n\n${makeGazePrompt(prompt)}` }] },
      ], 0, (text) => {
        setPlanPhases(prev => prev.map((p, i) => i === 0 ? { ...p, text: p.text + text } : p))
      })

      // Phase 2: Dream
      setPlanPhases(prev => prev.map((p, i) => ({
        ...p, status: i === 0 ? 'done' : i === 1 ? 'active' : 'waiting',
      })))
      setPlanActiveIndex(1)

      const dreamResult = await runPlanPhase([
        { role: 'user', content: [...imageContent, { type: 'text', text: `${workflowContextNotes}\n\n${makeGazePrompt(prompt)}` }] },
        { role: 'assistant', content: gazeResult },
        { role: 'user', content: [{ type: 'text', text: makeDreamPrompt(prompt) }] },
      ], 1, (text) => {
        setPlanPhases(prev => prev.map((p, i) => i === 1 ? { ...p, text: p.text + text } : p))
      })

      // Phase 3: Create
      setPlanPhases(prev => prev.map((p, i) => ({
        ...p, status: i <= 1 ? 'done' : 'active',
      })))
      setPlanActiveIndex(2)
      setStreamText('')
      setStreamTokenCount(0)
      setStreamDone(false)

      const createMessages: Message[] = [
        { role: 'user', content: [...imageContent, { type: 'text', text: makePlanCreatePrompt(gazeResult, dreamResult, prompt) }] },
      ]

      let createTokenIdx = 0
      const createResult = await runPlanPhase(createMessages, 2, (text) => {
        createTokenIdx++
        setStreamText(prev => prev + text)
        setStreamTokenCount(createTokenIdx)
      })

      // Done
      setPlanPhases(prev => prev.map(p => ({ ...p, status: 'done' as const })))
      setPlanDone(true)
      setStreamDone(true)

      const html = extractHTML(createResult)
      if (html) {
        setTimeout(() => {
          setLastHTML(html)
          setLastTurnReference(createWorkflowTurnReference({
            id: `turn-${Date.now()}`,
            modeId: activeModeId,
            prompt,
            html,
          }))
          setGenerating(false)
          setIteration((i) => i + 1)
          addChip({ role: 'assistant', text: t('system.chip.planComplete') })
        }, 800)
      } else {
        setGenerating(false)
        addChip({ role: 'assistant', text: t('system.chip.noPlanHtml') })
      }
    } catch (err: any) {
      setGenerating(false)
      setPlanDone(true)
      addChip({ role: 'assistant', text: 'ERR: ' + (t(err.message) === err.message ? err.message : t(err.message)) })
    }
  }, [providerState, generating, getSelectedFrameImages, addChip, runPlanPhase, t, promptStudioSummary, makeGazePrompt, makeDreamPrompt, makePlanCreatePrompt, getModeWorkflowContext, appendWorkflowReferenceImages, activeModeId, videoReference, appendVideoKeyframeImages, webEmbeds, videoRoutingNote])

  const handlePlanRefine = useCallback(async (prompt: string) => {
    if (!isProviderConfigured(providerState) || generating) return

    setGenerating(true)
    setPlanDone(false)
    setPlanTokenCount(0)
    setPlanActiveIndex(0)

    const initialPhases: PlanPhase[] = [
      { name: 'gaze', label: t('plan.gaze'), status: 'active', text: '' },
      { name: 'dream', label: t('plan.dream'), status: 'waiting', text: '' },
      { name: 'create', label: t('plan.create'), status: 'waiting', text: '' },
    ]
    setPlanPhases(initialPhases)

    const screenshotB64 = await capturePreview()
    const currentPreviewDataUrl = screenshotB64 ? 'data:image/png;base64,' + screenshotB64 : null
    setPreviewScreenshot(currentPreviewDataUrl)

    const frameImages = await getSelectedFrameImages()
    const chipImages: ChatChip['images'] = []
    const imageContent: Message['content'] = []
    const workflowContext = await getModeWorkflowContext(prompt || t('system.prompt.planRefineDefault'), lastHTML)
    const workflowContextNotes = [
      buildWorkflowContextNotes(workflowContext),
      buildWebEmbedContextNotes(webEmbeds),
      buildPreviewAnnotationNotes(previewAnnotations),
      activeModeId === 'video' ? buildVideoReferenceNotes(videoReference) : '',
      videoRoutingNote,
    ].filter(Boolean).join('\n\n')

    if (screenshotB64) {
      imageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: screenshotB64 },
      })
      chipImages.push({ src: currentPreviewDataUrl!, label: t('system.prompt.currentOutput') })
    }
    for (const img of frameImages) {
      imageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: img.base64 },
      })
      chipImages.push({ src: 'data:image/png;base64,' + img.base64, label: img.label })
    }
    appendVideoKeyframeImages(imageContent, chipImages)

    const refinementPrompt = buildRefinePrompt(prompt, promptStudio, t('system.prompt.planRefineDefault'), {
      modeStarter: modeDefinition.starterPrompts[0],
      workflowContextNotes,
    })
    appendWorkflowReferenceImages(imageContent, chipImages, workflowContextNotes, { includeCurrentPreview: false })
    addChip({ role: 'user', text: `${t('system.chip.planRefineTag')} ${promptStudioSummary}\n${prompt || t('system.prompt.planRefineDefault')}`, images: chipImages })

    try {
      // Gaze at both screenshot and canvas
      const gazeResult = await runPlanPhase([
        { role: 'user', content: [...imageContent, { type: 'text', text: `${workflowContextNotes}\n\n${makeGazePrompt(refinementPrompt)}\n\nThe first image is the current rendered output. Subsequent images are the original sketches/references.` }] },
      ], 0, (text) => {
        setPlanPhases(prev => prev.map((p, i) => i === 0 ? { ...p, text: p.text + text } : p))
      })

      setPlanPhases(prev => prev.map((p, i) => ({ ...p, status: i === 0 ? 'done' : i === 1 ? 'active' : 'waiting' })))
      setPlanActiveIndex(1)

      const dreamResult = await runPlanPhase([
        { role: 'user', content: [...imageContent, { type: 'text', text: `${workflowContextNotes}\n\n${makeGazePrompt(refinementPrompt)}` }] },
        { role: 'assistant', content: gazeResult },
        { role: 'user', content: [{ type: 'text', text: makeDreamPrompt(refinementPrompt) + `\n\nThis is a REFINEMENT. Here is the current HTML to evolve:\n\`\`\`html\n${lastHTML}\n\`\`\`` }] },
      ], 1, (text) => {
        setPlanPhases(prev => prev.map((p, i) => i === 1 ? { ...p, text: p.text + text } : p))
      })

      setPlanPhases(prev => prev.map((p, i) => ({ ...p, status: i <= 1 ? 'done' : 'active' })))
      setPlanActiveIndex(2)
      setStreamText('')
      setStreamTokenCount(0)
      setStreamDone(false)

      let createTokenIdx2 = 0
      const createResult = await runPlanPhase([
        { role: 'user', content: [...imageContent, { type: 'text', text: makePlanCreatePrompt(gazeResult, dreamResult, refinementPrompt) + `\n\nHere is the previous HTML to improve upon:\n\`\`\`html\n${lastHTML}\n\`\`\`` }] },
      ], 2, (text) => {
        createTokenIdx2++
        setStreamText(prev => prev + text)
        setStreamTokenCount(createTokenIdx2)
      })

      setPlanPhases(prev => prev.map(p => ({ ...p, status: 'done' as const })))
      setPlanDone(true)
      setStreamDone(true)

      const html = extractHTML(createResult)
      if (html) {
        setTimeout(() => {
          setLastHTML(html)
          setLastTurnReference(createWorkflowTurnReference({
            id: `turn-${Date.now()}`,
            modeId: activeModeId,
            prompt: prompt || t('system.prompt.planRefineDefault'),
            html,
            screenshotDataUrl: currentPreviewDataUrl,
          }))
          setGenerating(false)
          setIteration((i) => i + 1)
          addChip({ role: 'assistant', text: t('system.chip.planRefineComplete') })
        }, 800)
      } else {
        setGenerating(false)
        addChip({ role: 'assistant', text: t('system.chip.noPlanHtml') })
      }
    } catch (err: any) {
      setGenerating(false)
      setPlanDone(true)
      addChip({ role: 'assistant', text: 'ERR: ' + (t(err.message) === err.message ? err.message : t(err.message)) })
    }
  }, [providerState, generating, lastHTML, capturePreview, getSelectedFrameImages, addChip, runPlanPhase, t, promptStudio, promptStudioSummary, makeGazePrompt, makeDreamPrompt, makePlanCreatePrompt, getModeWorkflowContext, appendWorkflowReferenceImages, activeModeId, previewAnnotations, modeDefinition, videoReference, appendVideoKeyframeImages, webEmbeds, videoRoutingNote])

  const canGenerate = isProviderConfigured(providerState)
  const needsKey = !canGenerate

  return (
    <>
      <Header
        providerName={provider.name}
        modelLabel={modelLabel}
        studioSummary={promptStudioSummary}
        modeLabel={t(modeDefinition.labelKey)}
        modeSummary={t(modeDefinition.summaryKey)}
        hasKey={canGenerate}
        onOpenSettings={() => setShowModelQuickSwitch(true)}
        onOpenModePanel={() => setShowModePanel(true)}
        onOpenControlCenter={() => setShowControlCenter(true)}
        locale={locale}
        onToggleLocale={() => setLocale(prev => prev === 'zh-CN' ? 'en' : 'zh-CN')}
        t={t}
      />
      {showControlCenter && (
        <ControlCenterModal
          onClose={() => setShowControlCenter(false)}
          onOpenPersonalSettings={() => {
            setShowControlCenter(false)
            setShowPersonalSettings(true)
          }}
          onOpenProviderSettings={() => {
            setShowControlCenter(false)
            setShowProviderSettings(true)
          }}
          onOpenWorkCenter={() => {
            setShowControlCenter(false)
            setShowWorkCenter(true)
          }}
          t={t}
        />
      )}
      <ModePanel
        visible={showModePanel}
        activeModeId={activeModeId}
        modes={CANVAS_MODE_DEFINITIONS}
        contextPreferences={contextPreferences}
        remixState={remixState}
        onClose={() => setShowModePanel(false)}
        onModeChange={handleModeChange}
        onContextPreferencesChange={handleContextPreferencesChange}
        onRemixUrlChange={handleRemixUrlChange}
        onFetchRemixReference={handleFetchRemixReference}
        fetchingRemixReference={fetchingRemixReference}
        t={t}
      />
      {showModelQuickSwitch && (
        <ModelQuickSwitch
          state={providerState}
          hasKey={canGenerate}
          onUpdate={handleProviderUpdate}
          onOpenConnectionSettings={() => {
            setShowModelQuickSwitch(false)
            setShowProviderSettings(true)
          }}
          onOpenPersonalSettings={() => {
            setShowModelQuickSwitch(false)
            setShowPersonalSettings(true)
          }}
          onClose={() => setShowModelQuickSwitch(false)}
        />
      )}
      {showPersonalSettings && (
        <PersonalSettingsModal
          onClose={() => setShowPersonalSettings(false)}
          onOpenConnectionSettings={() => {
            setShowPersonalSettings(false)
            setShowProviderSettings(true)
          }}
        />
      )}
      {showProviderSettings && (
        <ProviderModal
          state={providerState}
          visionState={visionProviderState}
          visionSupportMap={visionSupportMap}
          onUpdate={handleProviderUpdate}
          onUpdateVisionState={handleVisionProviderUpdate}
          onUpdateVisionSupportMap={handleVisionSupportUpdate}
          onClose={() => setShowProviderSettings(false)}
          t={t}
        />
      )}
      {showPresetLibrary && (
        <PresetLibraryModal
          savedPresets={savedPresets}
          onApply={handleApplyPreset}
          onSaveCurrent={handleSavePresetAsNew}
          onOverwrite={handleOverwritePreset}
          onRename={handleRenamePreset}
          onDelete={handleDeletePreset}
          onClose={() => setShowPresetLibrary(false)}
          t={t}
        />
      )}
      {showWorkCenter && (
        <WorkCenterModal
          lastHTML={lastHTML}
          modeId={activeModeId}
          promptDraft={promptDraft}
          getCanvasData={buildCurrentCanvasData}
          onClose={() => setShowWorkCenter(false)}
          t={t}
        />
      )}
      <div className="workspace">
        <div className="panel-left" ref={panelLeftRef}>
          <Canvas onEditorReady={(e) => { editorRef.current = e; setEditor(e) }} onCanvasChange={handleCanvasChange} locale={locale} />
          <FramePicker
            editor={editor}
            selectedIds={selectedFrameIds}
            onSelectionChange={setSelectedFrameIds}
            onAddFrame={handleAddFrame}
            onAddWebEmbed={handleAddWebEmbed}
            onManageWebEmbeds={() => setShowWebEmbedPanel((visible) => !visible)}
            onOpenWorkCenter={() => setShowWorkCenter(true)}
            webEmbedCount={webEmbeds.length}
            canvasVersion={canvasVersion}
            onSave={handleSave}
            onLoad={handleLoad}
            previewScreenshot={previewScreenshot}
            t={t}
          />
          {showWebEmbedPanel && (
            <WebEmbedPanel
              embeds={webEmbeds}
              onReplace={handleReplaceWebEmbed}
              onRemove={handleRemoveWebEmbed}
              onStatusChange={handleWebEmbedStatusChange}
              onClose={() => setShowWebEmbedPanel(false)}
              t={t}
            />
          )}
          <MessageStrip chips={chips} t={t} />
          <PromptBar
            onGenerate={planMode ? handlePlanGenerate : handleGenerate}
            onRefine={planMode ? handlePlanRefine : handleRefine}
            onClear={handleClear}
            prompt={promptDraft}
            onPromptChange={handlePromptChange}
            studio={promptStudio}
            onStudioChange={handleStudioChange}
            onOpenLibrary={() => setShowPresetLibrary(true)}
            hasOutput={!!lastHTML}
            generating={generating}
            planMode={planMode}
            onPlanModeToggle={() => setPlanMode(p => !p)}
            modeDefinition={modeDefinition}
            compact={compactPromptBar}
            fineTuneExpanded={fineTuneExpanded}
            onToggleFineTune={() => setFineTuneExpanded((prev) => !prev)}
            onSurprise={handleSurprise}
            contextPreferences={contextPreferences}
            onContextPreferencesChange={handleContextPreferencesChange}
            remixState={remixState}
            onRemixUrlChange={handleRemixUrlChange}
            onFetchRemixReference={handleFetchRemixReference}
            fetchingRemixReference={fetchingRemixReference}
            videoReference={videoReference}
            onVideoKeyframeToggle={handleVideoKeyframeToggle}
            onClearVideoReference={handleClearVideoReference}
            hasKey={canGenerate}
            t={t}
          />
        </div>
        <ResizeHandle onResize={handleResize} />
        <div className="panel-right">
          {needsKey && (
            <div className="api-key-overlay">
              <div className="api-key-overlay-card">
                <div className="api-key-overlay-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                </div>
                <h2 className="api-key-overlay-title">{provider.id === 'custom' ? t('overlay.apiKeyRequiredCustom') : t('overlay.apiKeyRequired')}</h2>
                <p className="api-key-overlay-desc">
                  {provider.id === 'custom'
                    ? t('overlay.customDesc')
                    : t('overlay.apiDesc', { provider: provider.name })}
                </p>
                <div className="api-key-overlay-steps">
                  {provider.id === 'custom' ? (
                    <>
                      <div className="api-key-step"><span className="api-key-step-num">1</span> {t('overlay.customStep1')}</div>
                      <div className="api-key-step"><span className="api-key-step-num">2</span> {t('overlay.customStep2')}</div>
                      <div className="api-key-step"><span className="api-key-step-num">3</span> {t('overlay.customStep3')}</div>
                      <div className="api-key-step"><span className="api-key-step-num">4</span> {t('overlay.customStep4')}</div>
                    </>
                  ) : (
                    <>
                      <div className="api-key-step"><span className="api-key-step-num">1</span> {t('overlay.step1', { label: provider.keyUrlLabel })}</div>
                      <div className="api-key-step"><span className="api-key-step-num">2</span> {t('overlay.step2')}</div>
                      <div className="api-key-step"><span className="api-key-step-num">3</span> {t('overlay.step3', { provider: provider.name })}</div>
                    </>
                  )}
                </div>
                <button className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }} onClick={() => setShowModelQuickSwitch(true)}>
                  {t('overlay.openSettings')}
                </button>
              </div>
            </div>
          )}
          <div className="preview-container">
            <Preview html={lastHTML} iframeRef={previewRef} t={t} />
            {lastHTML && (
              <PreviewAnnotations
                active={previewAnnotationMode && !generating}
                annotations={previewAnnotations}
                onChange={setPreviewAnnotations}
                t={t}
              />
            )}
            {generating && !planMode && (
              <StreamOverlay
                streamText={streamText}
                thinkingText={thinkingText}
                tokenCount={streamTokenCount}
                done={streamDone}
                t={t}
              />
            )}
            {generating && planMode && (
              <PlanOverlay
                phases={planPhases}
                activePhaseIndex={planActiveIndex}
                tokenCount={planTokenCount}
                done={planDone}
                streamText={streamText}
                streamTokenCount={streamTokenCount}
                streamDone={streamDone}
                t={t}
              />
            )}
          </div>
          {lastHTML && (
            <div className="preview-toolbar">
              <div className="preview-toolbar-left">
                <button
                  className={`btn btn-secondary preview-annotation-toggle ${previewAnnotationMode ? 'active' : ''}`}
                  onClick={() => setPreviewAnnotationMode((active) => !active)}
                  disabled={generating}
                >
                  {t('preview.annotations.toggle')}
                  {previewAnnotations.length > 0 ? ` ${previewAnnotations.length}` : ''}
                </button>
                {previewAnnotations.length > 0 && (
                  <button
                    className="btn btn-ghost preview-annotation-clear"
                    onClick={() => setPreviewAnnotations([])}
                    disabled={generating}
                  >
                    {t('preview.annotations.clear')}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => {
                  navigator.clipboard.writeText(lastHTML)
                }}>{t('preview.copy')}</button>
                <button className="btn btn-secondary" onClick={handleExportHtml}>{t('preview.exportHtml')}</button>
                <button className="btn btn-secondary" onClick={() => {
                  const w = window.open()
                  if (w) { w.document.write(lastHTML); w.document.close() }
                }}>{t('preview.open')}</button>
              </div>
              <span className="mono preview-meta">
                {iteration > 0 && `#${iteration}`}
                {usage && ` / ${usage.input_tokens} in / ${usage.output_tokens} out`}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
