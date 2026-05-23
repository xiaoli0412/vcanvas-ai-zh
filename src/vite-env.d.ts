/// <reference types="vite/client" />

interface Window {
  vcanvasDesktop?: {
    proxyUrl: string | null
    platform: string
  }
}
