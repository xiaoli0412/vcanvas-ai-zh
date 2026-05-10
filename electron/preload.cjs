const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('vcanvasDesktop', {
  proxyUrl: process.env.VCANVAS_DESKTOP_PROXY_URL || null,
  platform: process.platform,
})
