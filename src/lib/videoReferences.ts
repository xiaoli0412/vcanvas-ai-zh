export interface VideoKeyframe {
  id: string
  label: string
  time: number
  dataUrl: string
}

export interface VideoReference {
  id: string
  fileName: string
  duration: number
  keyframes: VideoKeyframe[]
  selectedKeyframeIds: string[]
  createdAt: string
  error?: string | null
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: string) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, handleEvent)
      video.removeEventListener('error', handleError)
    }
    const handleEvent = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('Unable to read video metadata.'))
    }
    video.addEventListener(eventName, handleEvent, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

async function seekVideo(video: HTMLVideoElement, time: number) {
  const targetTime = Math.max(0, Math.min(time, video.duration || time))
  if (Math.abs(video.currentTime - targetTime) < 0.01 && video.readyState >= 2) return
  const seeked = waitForVideoEvent(video, 'seeked')
  video.currentTime = targetTime
  await seeked
}

function captureFrame(video: HTMLVideoElement) {
  const canvas = document.createElement('canvas')
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to prepare video frame canvas.')
  ctx.drawImage(video, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

export async function createVideoReference(fileName: string, dataUrl: string): Promise<VideoReference> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'

  const metadataLoaded = waitForVideoEvent(video, 'loadedmetadata')
  video.src = dataUrl
  video.load()
  await metadataLoaded

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1
  const times = [
    Math.min(0.5, duration * 0.08),
    duration * 0.33,
    duration * 0.66,
    Math.max(0, duration - Math.min(0.5, duration * 0.08)),
  ]
    .map((time) => Math.max(0, Math.min(duration, time)))
    .filter((time, index, values) => values.findIndex((candidate) => Math.abs(candidate - time) < 0.25) === index)

  const keyframes: VideoKeyframe[] = []
  for (const [index, time] of times.entries()) {
    await seekVideo(video, time)
    keyframes.push({
      id: `keyframe-${index + 1}`,
      label: `${Math.round(time * 10) / 10}s`,
      time,
      dataUrl: captureFrame(video),
    })
  }

  const id = `video-${Date.now()}`
  return {
    id,
    fileName,
    duration,
    keyframes,
    selectedKeyframeIds: keyframes.map((keyframe) => keyframe.id),
    createdAt: new Date().toISOString(),
    error: null,
  }
}

export function getSelectedVideoKeyframes(reference: VideoReference | null) {
  if (!reference) return []
  const selected = new Set(reference.selectedKeyframeIds)
  return reference.keyframes.filter((keyframe) => selected.has(keyframe.id))
}

export function buildVideoReferenceNotes(reference: VideoReference | null) {
  const keyframes = getSelectedVideoKeyframes(reference)
  if (!reference || keyframes.length === 0) return ''

  return [
    '## Video Reference Keyframes',
    `Source video: ${reference.fileName}`,
    `Duration: ${Math.round(reference.duration * 10) / 10}s`,
    'Selected keyframes are attached as image references. Use them as motion, layout, and visual-state anchors.',
    ...keyframes.map((keyframe, index) => `Keyframe ${index + 1}: ${keyframe.label}`),
  ].join('\n')
}
