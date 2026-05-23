import { getDataURL } from '@excalidraw/excalidraw'
import type { BinaryFileData } from '@excalidraw/excalidraw/types'

export interface ImportedCanvasMedia {
  fileData: BinaryFileData
  width: number
  height: number
  label?: string
}

function readMediaDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width || 1280,
        height: image.naturalHeight || image.height || 720,
      })
      URL.revokeObjectURL(url)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image dimensions.'))
    }

    image.src = url
  })
}

async function createBinaryFileData(file: File): Promise<BinaryFileData> {
  const dataURL = await getDataURL(file)

  return {
    id: crypto.randomUUID() as BinaryFileData['id'],
    dataURL,
    mimeType: (file.type || 'image/png') as BinaryFileData['mimeType'],
    created: Date.now(),
    lastRetrieved: Date.now(),
    version: 1,
  }
}

async function captureVideoPoster(videoFile: File) {
  const objectUrl = URL.createObjectURL(videoFile)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.crossOrigin = 'anonymous'
  video.src = objectUrl

  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.onloadeddata = null
        video.onerror = null
      }

      video.onloadeddata = () => {
        cleanup()
        resolve()
      }
      video.onerror = () => {
        cleanup()
        reject(new Error('Failed to decode the selected video.'))
      }
    })

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to create a canvas context for video import.')
    }

    context.drawImage(video, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('Failed to create a poster image from the selected video.'))
      }, 'image/png')
    })

    return new File(
      [blob],
      `${videoFile.name.replace(/\.[^/.]+$/, '') || 'video'}-poster.png`,
      { type: 'image/png' },
    )
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function fitImportedMediaSize(
  width: number,
  height: number,
  maxWidth = 360,
  maxHeight = 240,
) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
  return {
    width: Math.max(120, Math.round(width * ratio)),
    height: Math.max(80, Math.round(height * ratio)),
  }
}

export async function prepareImportedImage(file: File): Promise<ImportedCanvasMedia> {
  const [{ width, height }, fileData] = await Promise.all([
    readMediaDimensions(file),
    createBinaryFileData(file),
  ])

  return {
    fileData,
    width,
    height,
    label: file.name,
  }
}

export async function prepareImportedVideo(file: File): Promise<ImportedCanvasMedia> {
  const posterFile = await captureVideoPoster(file)
  const [{ width, height }, fileData] = await Promise.all([
    readMediaDimensions(posterFile),
    createBinaryFileData(posterFile),
  ])

  return {
    fileData,
    width,
    height,
    label: file.name,
  }
}
